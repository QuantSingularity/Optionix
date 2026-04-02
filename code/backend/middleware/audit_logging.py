"""
Audit logging service for Optionix backend.
Provides comprehensive audit trail for all critical operations.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Dict, Optional

import structlog
from fastapi import Request

from ..database import get_db_session
from ..models import AuditLog

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger(__name__)


class AuditLogger:
    """Service for comprehensive audit logging"""

    def __init__(self) -> None:
        """Initialize audit logger"""
        self.executor = ThreadPoolExecutor(max_workers=2)

    def log_event(
        self,
        action: str,
        user_id: Optional[int] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None,
        status: str = "success",
        error_message: Optional[str] = None,
        additional_context: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """
        Log an audit event asynchronously

        Args:
            action (str): Action performed
            user_id (Optional[int]): User ID if applicable
            resource_type (Optional[str]): Type of resource affected
            resource_id (Optional[str]): ID of resource affected
            ip_address (Optional[str]): Client IP address
            user_agent (Optional[str]): Client user agent
            request_data (Optional[Dict]): Request data (sanitized)
            response_data (Optional[Dict]): Response data (sanitized)
            status (str): Event status
            error_message (Optional[str]): Error message if applicable
            additional_context (Optional[Dict]): Additional context
        """
        self.executor.submit(
            self._write_audit_log,
            action,
            user_id,
            resource_type,
            resource_id,
            ip_address,
            user_agent,
            request_data,
            response_data,
            status,
            error_message,
            additional_context,
        )

    def _write_audit_log(
        self,
        action: str,
        user_id: Optional[int],
        resource_type: Optional[str],
        resource_id: Optional[str],
        ip_address: Optional[str],
        user_agent: Optional[str],
        request_data: Optional[Dict[str, Any]],
        response_data: Optional[Dict[str, Any]],
        status: str,
        error_message: Optional[str],
        additional_context: Optional[Dict[str, Any]],
    ) -> Any:
        """Write audit log to database and structured log"""
        try:
            sanitized_request = (
                self._sanitize_data(request_data) if request_data else None
            )
            sanitized_response = (
                self._sanitize_data(response_data) if response_data else None
            )
            log_entry = {
                "event_type": "audit",
                "action": action,
                "user_id": user_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "status": status,
                "error_message": error_message,
                "timestamp": datetime.utcnow().isoformat(),
            }
            if additional_context:
                log_entry.update(additional_context)
            if status == "success":
                logger.info("Audit event", **log_entry)
            elif status in ["failure", "error"]:
                logger.error("Audit event", **log_entry)
            else:
                logger.warning("Audit event", **log_entry)
            db = get_db_session()
            try:
                audit_log = AuditLog(
                    user_id=user_id,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    request_data=(
                        json.dumps(sanitized_request) if sanitized_request else None
                    ),
                    response_data=(
                        json.dumps(sanitized_response) if sanitized_response else None
                    ),
                    status=status,
                    error_message=error_message,
                )
                db.add(audit_log)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.error("Failed to write audit log", error=str(e))

    def _sanitize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize data to remove sensitive information

        Args:
            data (Dict[str, Any]): Data to sanitize

        Returns:
            Dict[str, Any]: Sanitized data
        """
        if not isinstance(data, dict):
            return data
        sensitive_fields = {
            "password",
            "token",
            "secret",
            "key",
            "private_key",
            "access_token",
            "refresh_token",
            "api_key",
            "authorization",
        }
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()
            if any((sensitive in key_lower for sensitive in sensitive_fields)):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_data(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize_data(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized

    def log_authentication_event(
        self,
        action: str,
        user_id: Optional[int],
        email: Optional[str],
        ip_address: str,
        user_agent: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Any:
        """Log authentication-related events"""
        self.log_event(
            action=action,
            user_id=user_id,
            resource_type="auth",
            ip_address=ip_address,
            user_agent=user_agent,
            request_data={"email": email} if email else None,
            status=status,
            error_message=error_message,
            additional_context={"category": "authentication"},
        )

    def log_trade_event(
        self,
        action: str,
        user_id: int,
        trade_id: Optional[str],
        trade_data: Dict[str, Any],
        ip_address: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Any:
        """Log trading-related events"""
        self.log_event(
            action=action,
            user_id=user_id,
            resource_type="trade",
            resource_id=trade_id,
            ip_address=ip_address,
            request_data=trade_data,
            status=status,
            error_message=error_message,
            additional_context={"category": "trading"},
        )

    def log_position_event(
        self,
        action: str,
        user_id: int,
        position_id: Optional[str],
        position_data: Dict[str, Any],
        ip_address: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Any:
        """Log position-related events"""
        self.log_event(
            action=action,
            user_id=user_id,
            resource_type="position",
            resource_id=position_id,
            ip_address=ip_address,
            request_data=position_data,
            status=status,
            error_message=error_message,
            additional_context={"category": "position_management"},
        )

    def log_admin_event(
        self,
        action: str,
        admin_user_id: int,
        target_resource_type: str,
        target_resource_id: str,
        ip_address: str,
        changes: Dict[str, Any],
        status: str,
        error_message: Optional[str] = None,
    ) -> Any:
        """Log administrative events"""
        self.log_event(
            action=action,
            user_id=admin_user_id,
            resource_type=target_resource_type,
            resource_id=target_resource_id,
            ip_address=ip_address,
            request_data=changes,
            status=status,
            error_message=error_message,
            additional_context={"category": "administration"},
        )

    def log_security_event(
        self,
        action: str,
        ip_address: str,
        user_agent: str,
        details: Dict[str, Any],
        severity: str = "medium",
    ) -> Any:
        """Log security-related events"""
        self.log_event(
            action=action,
            resource_type="security",
            ip_address=ip_address,
            user_agent=user_agent,
            request_data=details,
            status="alert",
            additional_context={"category": "security", "severity": severity},
        )


audit_logger = AuditLogger()


async def audit_middleware(request: Request, call_next):
    """
    Audit logging middleware for FastAPI

    Args:
        request (Request): FastAPI request
        call_next: Next middleware/endpoint

    Returns:
        Response with audit logging
    """
    start_time = datetime.utcnow()
    ip_address = request.client.host
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    user_agent = request.headers.get("user-agent", "")
    method = request.method
    path = request.url.path
    if path in ["/health", "/", "/docs", "/openapi.json"]:
        return await call_next(request)
    user_id = None
    try:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            from auth import verify_token

            token = auth_header.split(" ")[1]
            payload = verify_token(token)
            if payload:
                user_id = payload.get("sub")
    except Exception:
        pass
    response = await call_next(request)
    processing_time = (datetime.utcnow() - start_time).total_seconds()
    if response.status_code < 400:
        status = "success"
    elif response.status_code < 500:
        status = "client_error"
    else:
        status = "server_error"
    audit_logger.log_event(
        action=f"{method} {path}",
        user_id=int(user_id) if user_id else None,
        resource_type="api",
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        additional_context={
            "category": "api_access",
            "status_code": response.status_code,
            "processing_time_seconds": processing_time,
        },
    )
    return response

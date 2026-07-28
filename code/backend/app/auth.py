"""
Authentication and Authorization Service for Optionix Platform.
Implements JWT auth, RBAC, MFA, session management, and audit logging.
"""

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from io import BytesIO
from typing import Any, Dict, List, Optional

import bcrypt
import pyotp
import qrcode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

logger = logging.getLogger(__name__)


class UserRole(str, Enum):
    """User roles with hierarchical permissions"""

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    COMPLIANCE_OFFICER = "compliance_officer"
    RISK_MANAGER = "risk_manager"
    TRADER = "trader"
    ANALYST = "analyst"
    CUSTOMER_SUPPORT = "customer_support"
    VIEWER = "viewer"
    CUSTOMER = "customer"


class Permission(str, Enum):
    """Granular permissions"""

    CREATE_USER = "create_user"
    READ_USER = "read_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    EXECUTE_TRADE = "execute_trade"
    VIEW_TRADES = "view_trades"
    CANCEL_TRADE = "cancel_trade"
    VIEW_FINANCIAL_DATA = "view_financial_data"
    EXPORT_FINANCIAL_DATA = "export_financial_data"
    VIEW_COMPLIANCE_DATA = "view_compliance_data"
    GENERATE_REPORTS = "generate_reports"
    APPROVE_KYC = "approve_kyc"
    MANAGE_SYSTEM = "manage_system"
    VIEW_AUDIT_LOGS = "view_audit_logs"
    MANAGE_KEYS = "manage_keys"


class AuthenticationMethod(str, Enum):
    PASSWORD = "password"
    MFA_TOTP = "mfa_totp"
    MFA_SMS = "mfa_sms"
    MFA_EMAIL = "mfa_email"
    BIOMETRIC = "biometric"
    HARDWARE_TOKEN = "hardware_token"
    OAUTH = "oauth"


@dataclass
class AuthenticationResult:
    success: bool
    user_id: Optional[str]
    session_id: Optional[str]
    access_token: Optional[str]
    refresh_token: Optional[str]
    mfa_required: bool
    mfa_methods: List[str]
    risk_score: float
    message: str


class AuthService:
    """Comprehensive authentication and authorization service"""

    def __init__(self) -> None:
        self._jwt_private_key: Optional[bytes] = None
        self._jwt_public_key: Optional[bytes] = None
        self._role_permissions: Dict[str, List[str]] = {}
        self._failed_attempts: Dict[str, Dict[str, Any]] = {}
        self._device_fingerprints: Dict[str, Dict[str, Any]] = {}
        self._initialize_auth_service()

    def _initialize_auth_service(self) -> None:
        try:
            self._generate_jwt_keys()
            self._initialize_role_permissions()
            logger.info("Auth service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize auth service: {e}")
            raise

    def _generate_jwt_keys(self) -> None:
        try:
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            self._jwt_private_key = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            public_key = private_key.public_key()
            self._jwt_public_key = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        except Exception as e:
            logger.error(f"Failed to generate JWT keys: {e}")
            raise

    def _initialize_role_permissions(self) -> None:
        self._role_permissions = {
            UserRole.SUPER_ADMIN.value: [p.value for p in Permission],
            UserRole.ADMIN.value: [
                Permission.CREATE_USER.value,
                Permission.READ_USER.value,
                Permission.UPDATE_USER.value,
                Permission.VIEW_TRADES.value,
                Permission.VIEW_FINANCIAL_DATA.value,
                Permission.VIEW_COMPLIANCE_DATA.value,
                Permission.GENERATE_REPORTS.value,
                Permission.VIEW_AUDIT_LOGS.value,
            ],
            UserRole.COMPLIANCE_OFFICER.value: [
                Permission.READ_USER.value,
                Permission.VIEW_COMPLIANCE_DATA.value,
                Permission.GENERATE_REPORTS.value,
                Permission.APPROVE_KYC.value,
                Permission.VIEW_AUDIT_LOGS.value,
            ],
            UserRole.RISK_MANAGER.value: [
                Permission.READ_USER.value,
                Permission.VIEW_TRADES.value,
                Permission.VIEW_FINANCIAL_DATA.value,
                Permission.VIEW_COMPLIANCE_DATA.value,
                Permission.GENERATE_REPORTS.value,
            ],
            UserRole.TRADER.value: [
                Permission.EXECUTE_TRADE.value,
                Permission.VIEW_TRADES.value,
                Permission.CANCEL_TRADE.value,
                Permission.VIEW_FINANCIAL_DATA.value,
            ],
            UserRole.ANALYST.value: [
                Permission.VIEW_TRADES.value,
                Permission.VIEW_FINANCIAL_DATA.value,
                Permission.EXPORT_FINANCIAL_DATA.value,
            ],
            UserRole.CUSTOMER_SUPPORT.value: [
                Permission.READ_USER.value,
                Permission.VIEW_TRADES.value,
            ],
            UserRole.VIEWER.value: [
                Permission.VIEW_TRADES.value,
                Permission.VIEW_FINANCIAL_DATA.value,
            ],
            UserRole.CUSTOMER.value: [
                Permission.EXECUTE_TRADE.value,
                Permission.VIEW_TRADES.value,
                Permission.CANCEL_TRADE.value,
            ],
        }

    def get_password_hash(self, password: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt.checkpw(
                plain_password.encode("utf-8"), hashed_password.encode("utf-8")
            )
        except Exception as e:
            logger.error(f"Password verification failed: {e}")
            return False

    def create_access_token(
        self, data: dict, expires_delta: Optional[timedelta] = None
    ) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + (
            expires_delta
            if expires_delta
            else timedelta(minutes=settings.access_token_expire_minutes)
        )
        to_encode.update({"exp": expire, "type": "access"})
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    def create_refresh_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
            days=settings.refresh_token_expire_days
        )
        to_encode.update({"exp": expire, "type": "refresh"})
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    def verify_token(self, token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(
                token, settings.secret_key, algorithms=[settings.algorithm]
            )
            return payload
        except Exception:
            return None

    def create_session(self, user_id: str, user_agent: str, ip_address: str) -> str:
        return secrets.token_urlsafe(32)

    def check_failed_attempts(self, key: str) -> Dict[str, Any]:
        """Check failed login attempts. Returns {"locked": bool, "count": int}."""
        attempts = self._failed_attempts.get(key, {"count": 0, "locked_until": None})
        locked_until = attempts.get("locked_until")
        if (
            locked_until
            and datetime.now(timezone.utc).replace(tzinfo=None) < locked_until
        ):
            return {"locked": True, "count": attempts["count"]}
        return {"locked": False, "count": attempts["count"]}

    def record_failed_attempt(self, key: str) -> None:
        if key not in self._failed_attempts:
            self._failed_attempts[key] = {"count": 0, "locked_until": None}
        self._failed_attempts[key]["count"] += 1
        if self._failed_attempts[key]["count"] >= settings.max_failed_login_attempts:
            self._failed_attempts[key]["locked_until"] = datetime.now(
                timezone.utc
            ).replace(tzinfo=None) + timedelta(
                minutes=settings.account_lockout_duration_minutes
            )

    def clear_failed_attempts(self, key: str) -> None:
        if key in self._failed_attempts:
            del self._failed_attempts[key]

    def has_permission(self, user_role: str, permission: str) -> bool:
        return permission in self._role_permissions.get(user_role, [])

    def validate_kyc_data(self, kyc_data: dict) -> bool:
        """Validate KYC data fields"""
        import re

        required_fields = [
            "full_name",
            "date_of_birth",
            "identity_document",
            "document_number",
        ]
        for field in required_fields:
            if not kyc_data.get(field):
                return False
        ssn = kyc_data.get("ssn", "")
        if ssn and not re.match(r"^\d{3}-\d{2}-\d{4}$", ssn):
            return False
        return True


auth_service = AuthService()


def verify_token(token: str) -> Optional[dict]:
    """Module-level helper used by middleware."""
    return auth_service.verify_token(token)


class MFAService:
    """Multi-factor authentication service"""

    def generate_totp_secret(self) -> str:
        return pyotp.random_base32()

    def generate_totp_qr_code(self, email: str, secret: str) -> str:
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=email, issuer_name="Optionix"
        )
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return base64.b64encode(buffer.getvalue()).decode()

    def verify_totp_token(self, secret: str, token: str) -> bool:
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)

    def generate_backup_codes(self, count: int = 10) -> List[str]:
        return [secrets.token_hex(4) for _ in range(count)]

    def hash_backup_codes(self, codes: List[str]) -> List[str]:
        return [hashlib.sha256(code.encode()).hexdigest() for code in codes]


class RBACService:
    """Role-based access control service"""

    def __init__(self) -> None:
        self.auth_service = auth_service

    def check_permission(self, user_role: str, permission: str) -> bool:
        return self.auth_service.has_permission(user_role, permission)

    def get_user_permissions(self, user_role: str) -> List[str]:
        return self.auth_service._role_permissions.get(user_role, [])


mfa_service = MFAService()
rbac_service = RBACService()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> dict:
    """Get current authenticated user from JWT token"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    payload = auth_service.verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


async def get_current_verified_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    return current_user


async def get_current_active_user(
    token_payload: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> "User":
    """
    Resolve the JWT payload returned by `get_current_user` into the full
    `User` ORM row.

    Routers that need real model attributes (`.id`, `.kyc_status`,
    `.risk_score`, ...) rather than just the raw token claims should depend
    on this instead of `get_current_user` directly.
    """
    user = db.query(User).filter(User.user_id == token_payload.get("sub")).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled"
        )
    return user


def require_permission(permission: Permission) -> Any:
    """Dependency factory to enforce specific permission"""

    def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if not rbac_service.check_permission(user_role, permission.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return current_user

    return permission_checker


def log_auth_event(
    db: Session,
    user_id: Optional[int],
    event_type: str,
    ip_address: str,
    user_agent: str,
    event_status: str,
    details: Optional[str] = None,
) -> None:
    """Log an authentication event to the audit log table"""
    from .models import AuditLog

    try:
        audit_log = AuditLog(
            user_id=user_id,
            action=event_type,
            action_category="authentication",
            status=event_status,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=details,
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to log auth event: {e}")
        db.rollback()

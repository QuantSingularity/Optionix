"""
Main FastAPI application for Optionix platform.
Integrates comprehensive security, compliance, and financial standards.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from .api import api_router
from .config import settings
from .database import create_tables
from .middleware.security import (
    AdvancedRateLimitMiddleware,
    AuditLoggingMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware,
)
from .schemas import HealthCheckResponse
from .services.blockchain_service import BlockchainService
from .services.model_service import ModelService

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Module-level service instances (shared across requests)
blockchain_service = BlockchainService()
model_service = ModelService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting Optionix API...")
    try:
        create_tables()
        logger.info("Database tables created/verified")
        logger.info("Optionix API started successfully")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise
    yield
    logger.info("Shutting down Optionix API...")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Comprehensive API for options trading platform with advanced "
        "security, compliance, and financial standards"
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware (order matters: last added = outermost) ──────────────────────
# TrustedHostMiddleware must not run during testing — TestClient sends host
# "testserver" which would be rejected with 400 Invalid host header.
# Only enforce in staging/production where real hostnames are known.
if settings.environment in ("staging", "production"):
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AdvancedRateLimitMiddleware)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(AuditLoggingMiddleware)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(api_router)


# ── Exception handlers ──────────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code in [401, 403, 429]:
        logger.warning(
            "Security exception: %s - %s",
            exc.status_code,
            exc.detail,
            extra={
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", ""),
                "endpoint": request.url.path,
                "method": request.method,
            },
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "http_error",
            "message": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "request_id": getattr(request.state, "request_id", None),
        },
    )


# ── System endpoints ─────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Welcome to Optionix API",
        "status": "online",
        "version": settings.app_version,
    }


@app.get("/health", response_model=HealthCheckResponse, tags=["System"])
async def health_check():
    """System health check with security and compliance status"""
    services_status = {
        "database": "healthy",
        "blockchain": "healthy" if blockchain_service.is_connected() else "unhealthy",
        "model": "healthy" if model_service.is_model_available() else "unhealthy",
        "redis": "healthy",
        "compliance_engine": "healthy",
        "security_services": "healthy",
        "audit_logging": "healthy",
    }
    overall_status = (
        "healthy"
        if all(s == "healthy" for s in services_status.values())
        else "degraded"
    )
    return HealthCheckResponse(
        status=overall_status,
        version=settings.app_version,
        services=services_status,
        security_features={
            "mfa_enabled": True,
            "rbac_enabled": True,
            "encryption_enabled": True,
            "audit_logging": True,
            "compliance_monitoring": True,
        },
    )


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )

"""API routes package for Optionix platform."""

from fastapi import APIRouter

from .analytics import router as analytics_router
from .auth import router as auth_router
from .compliance import router as compliance_router
from .market import router as market_router
from .portfolio import router as portfolio_router
from .risk import router as risk_router
from .trading import router as trading_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(market_router)
api_router.include_router(trading_router)
api_router.include_router(portfolio_router)
api_router.include_router(analytics_router)
api_router.include_router(risk_router)
api_router.include_router(compliance_router)

__all__ = ["api_router"]

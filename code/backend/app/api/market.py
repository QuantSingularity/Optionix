import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool

from ..auth import get_current_active_user
from ..models import User
from ..schemas import MarketDataRequest, VolatilityResponse
from ..services.model_service import ModelService, get_model_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market", tags=["Market Data"])

HORIZON_BY_TIMEFRAME = {
    "1m": "10m",
    "5m": "50m",
    "15m": "150m",
    "1h": "10h",
    "4h": "40h",
    "1d": "10d",
}


@router.post("/volatility", response_model=VolatilityResponse)
async def get_volatility_prediction(
    market_data: MarketDataRequest,
    current_user: User = Depends(get_current_active_user),
    model_service: ModelService = Depends(get_model_service),
):
    try:
        payload = market_data.model_dump()
        result = await run_in_threadpool(
            model_service.get_volatility_prediction, payload
        )
        return VolatilityResponse(
            symbol=market_data.symbol,
            volatility=Decimal(str(round(result["volatility"], 8))),
            confidence=(
                Decimal(str(round(result["confidence"], 6)))
                if result.get("confidence") is not None
                else None
            ),
            model_version=result.get("model_version"),
            prediction_horizon=HORIZON_BY_TIMEFRAME.get(
                market_data.timeframe, "10 bars"
            ),
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception:
        logger.exception("Volatility prediction failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Volatility prediction failed",
        )


@router.get("/model-info")
async def get_model_info(
    current_user: User = Depends(get_current_active_user),
    model_service: ModelService = Depends(get_model_service),
) -> Dict[str, Any]:
    return model_service.get_model_info()

import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, model_validator

from ..auth import get_current_active_user
from ..models import User
from ..services.pricing_engine import PricingEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])


@lru_cache(maxsize=1)
def get_pricing_engine() -> PricingEngine:
    return PricingEngine()


class HestonParams(BaseModel):
    v0: float = Field(0.04, gt=0, le=2.0)
    kappa: float = Field(2.0, gt=0, le=50.0)
    theta: float = Field(0.04, gt=0, le=2.0)
    sigma: float = Field(0.3, gt=0, le=5.0)
    rho: float = Field(-0.7, gt=-1.0, lt=1.0)


class OptionPricingRequest(BaseModel):
    spot_price: float = Field(..., gt=0)
    strike_price: float = Field(..., gt=0)
    time_to_expiry: float = Field(..., gt=0, le=5.0)
    risk_free_rate: float = Field(0.05, ge=0, le=1.0)
    volatility: float = Field(..., gt=0, le=5.0)
    option_type: str = Field("call", pattern=r"^(call|put)$")
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    option_style: str = Field("european", pattern=r"^(european|american|barrier)$")
    pricing_method: str = Field(
        "black_scholes", pattern=r"^(black_scholes|monte_carlo|heston)$"
    )
    monte_carlo_paths: int = Field(100_000, ge=1_000, le=1_000_000)
    barrier_level: Optional[float] = Field(None, gt=0)
    barrier_type: Optional[str] = Field(
        None, pattern=r"^(up_and_out|up_and_in|down_and_out|down_and_in)$"
    )
    heston: Optional[HestonParams] = None

    @model_validator(mode="after")
    def _check_combination(self) -> "OptionPricingRequest":
        if self.option_style == "barrier":
            if self.barrier_level is None or self.barrier_type is None:
                raise ValueError(
                    "barrier_level and barrier_type are required for barrier options"
                )
            if self.pricing_method == "heston":
                raise ValueError("Heston pricing supports european options only")
        if self.option_style == "american" and self.pricing_method != "black_scholes":
            raise ValueError(
                "american options use the binomial lattice; keep pricing_method black_scholes"
            )
        if self.pricing_method == "heston" and self.option_style != "european":
            raise ValueError("Heston pricing supports european options only")
        return self


class OptionPricingResponse(BaseModel):
    price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: Optional[float] = None
    method: str
    option_style: str = "european"
    std_error: Optional[float] = None
    confidence_interval: Optional[List[float]] = None
    timestamp: str


class SurfaceQuote(BaseModel):
    strike: float = Field(..., gt=0)
    expiry: float = Field(..., gt=0, le=10.0)
    implied_volatility: float = Field(..., gt=0, le=5.0)
    option_type: str = Field("call", pattern=r"^(call|put)$")


class VolatilitySurfaceRequest(BaseModel):
    spot_price: float = Field(..., gt=0)
    strikes: List[float] = Field(..., min_length=2, max_length=50)
    expiries: List[float] = Field(..., min_length=1, max_length=12)
    risk_free_rate: float = Field(0.05, ge=0, le=1.0)
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    base_volatility: float = Field(0.20, gt=0, le=2.0)
    quotes: Optional[List[SurfaceQuote]] = Field(None, min_length=3, max_length=500)
    method: str = Field("svi", pattern=r"^(spline|linear|svi|sabr)$")

    @model_validator(mode="after")
    def _positive_grid(self) -> "VolatilitySurfaceRequest":
        if any(k <= 0 for k in self.strikes) or any(
            t <= 0 or t > 10 for t in self.expiries
        ):
            raise ValueError(
                "strikes must be positive and expiries within (0, 10] years"
            )
        return self


class ImpliedVolRequest(BaseModel):
    market_price: float = Field(..., gt=0)
    spot_price: float = Field(..., gt=0)
    strike_price: float = Field(..., gt=0)
    time_to_expiry: float = Field(..., gt=0, le=30.0)
    risk_free_rate: float = Field(0.05, ge=0, le=1.0)
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    option_type: str = Field("call", pattern=r"^(call|put)$")
    option_style: str = Field("european", pattern=r"^(european|american)$")


class CalibrationQuote(BaseModel):
    strike: float = Field(..., gt=0)
    expiry: float = Field(..., gt=0, le=10.0)
    price: Optional[float] = Field(None, gt=0)
    iv: Optional[float] = Field(None, gt=0, le=5.0)
    option_type: str = Field("call", pattern=r"^(call|put)$")

    @model_validator(mode="after")
    def _needs_price_or_iv(self) -> "CalibrationQuote":
        if self.price is None and self.iv is None:
            raise ValueError("each quote needs a price or an iv")
        return self


class CalibrationRequest(BaseModel):
    model: str = Field(..., pattern=r"^(heston|sabr|cev)$")
    spot_price: float = Field(..., gt=0)
    risk_free_rate: float = Field(0.02, ge=0, le=1.0)
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    options: List[CalibrationQuote] = Field(..., min_length=3, max_length=200)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fail(exc: Exception, context: str) -> HTTPException:
    if isinstance(exc, ValueError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    logger.exception("%s failed", context)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"{context} failed"
    )


@router.post("/price", response_model=OptionPricingResponse)
async def price_option(
    req: OptionPricingRequest,
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
):
    try:
        result = await run_in_threadpool(
            engine.price,
            req.spot_price,
            req.strike_price,
            req.time_to_expiry,
            req.risk_free_rate,
            req.volatility,
            req.dividend_yield,
            req.option_type,
            req.option_style,
            req.pricing_method,
            req.barrier_level,
            req.barrier_type,
            req.monte_carlo_paths,
            42,
            req.heston.model_dump() if req.heston else None,
        )
    except Exception as exc:
        raise _fail(exc, "Pricing")
    greeks = result["greeks"]
    interval = result.get("confidence_interval")
    return OptionPricingResponse(
        price=round(result["price"], 6),
        delta=round(greeks["delta"], 6),
        gamma=round(greeks["gamma"], 6),
        theta=round(greeks["theta"], 6),
        vega=round(greeks["vega"], 6),
        rho=round(greeks["rho"], 6),
        method=result["method"],
        option_style=req.option_style,
        std_error=round(result["std_error"], 6) if "std_error" in result else None,
        confidence_interval=[round(x, 6) for x in interval] if interval else None,
        timestamp=_now(),
    )


@router.post("/implied-volatility")
async def compute_implied_volatility(
    req: ImpliedVolRequest,
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    try:
        iv = await run_in_threadpool(
            engine.implied_volatility,
            req.market_price,
            req.spot_price,
            req.strike_price,
            req.time_to_expiry,
            req.risk_free_rate,
            req.dividend_yield,
            req.option_type,
            req.option_style,
        )
    except Exception as exc:
        raise _fail(exc, "Implied volatility solve")
    return {
        "implied_volatility": round(iv, 6),
        "implied_volatility_pct": round(iv * 100, 4),
        "option_type": req.option_type,
        "option_style": req.option_style,
        "timestamp": _now(),
    }


@router.post("/volatility-surface")
async def compute_volatility_surface(
    req: VolatilitySurfaceRequest,
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    try:
        extra: Dict[str, Any] = {}
        if req.quotes:
            fitted = await run_in_threadpool(
                engine.fitted_surface,
                req.spot_price,
                [q.model_dump() for q in req.quotes],
                req.strikes,
                req.expiries,
                req.risk_free_rate,
                req.dividend_yield,
                req.method,
            )
            points = fitted["points"]
            extra = {
                "source": "fitted",
                "method": req.method,
                "fit_metrics": fitted["metrics"],
                "arbitrage": fitted["arbitrage"],
            }
        else:
            points = engine.parametric_surface(
                req.spot_price,
                req.strikes,
                req.expiries,
                req.risk_free_rate,
                req.dividend_yield,
                req.base_volatility,
            )
            extra = {"source": "parametric"}
        surface = []
        for point in points:
            iv = float(point["iv"])
            call_price = engine.european_price(
                req.spot_price,
                point["strike"],
                point["expiry"],
                req.risk_free_rate,
                iv,
                req.dividend_yield,
                "call",
            )
            surface.append(
                {
                    "strike": point["strike"],
                    "expiry_years": point["expiry"],
                    "implied_vol": round(iv, 6),
                    "call_price": round(call_price, 4),
                }
            )
    except Exception as exc:
        raise _fail(exc, "Volatility surface")
    return {
        "spot_price": req.spot_price,
        "surface_points": len(surface),
        "surface": surface,
        "timestamp": _now(),
        **extra,
    }


@router.post("/calibrate")
async def calibrate_model(
    req: CalibrationRequest,
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    try:
        result = await run_in_threadpool(
            engine.calibrate,
            req.model,
            [o.model_dump(exclude_none=True) for o in req.options],
            req.spot_price,
            req.risk_free_rate,
            req.dividend_yield,
        )
    except Exception as exc:
        raise _fail(exc, "Calibration")
    return {
        "model": req.model,
        "parameters": {k: round(float(v), 6) for k, v in result["parameters"].items()},
        "diagnostics": {
            k: (round(v, 8) if isinstance(v, float) else v)
            for k, v in result.get("diagnostics", {}).items()
        },
        "timestamp": _now(),
    }


@router.get("/greeks/{symbol}")
async def quick_greeks(
    symbol: str,
    spot: float = Query(..., gt=0),
    strike: float = Query(..., gt=0),
    expiry_days: int = Query(..., ge=1, le=3650),
    volatility: float = Query(0.20, gt=0, le=5.0),
    risk_free_rate: float = Query(0.05, ge=0, le=1.0),
    dividend_yield: float = Query(0.0, ge=0, le=1.0),
    option_type: str = Query("call", pattern=r"^(call|put)$"),
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    T = expiry_days / 365.0
    try:
        greeks = engine.calculate_greeks(
            spot, strike, T, risk_free_rate, volatility, dividend_yield, option_type
        )
        price = engine.european_price(
            spot, strike, T, risk_free_rate, volatility, dividend_yield, option_type
        )
    except Exception as exc:
        raise _fail(exc, "Greeks calculation")
    return {
        "symbol": symbol.upper(),
        "spot": spot,
        "strike": strike,
        "expiry_days": expiry_days,
        "volatility": volatility,
        "option_type": option_type,
        "price": round(price, 6),
        "greeks": {k: round(v, 6) for k, v in greeks.items()},
        "timestamp": _now(),
    }

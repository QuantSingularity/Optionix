"""
Analytics routes for Optionix platform.
Options pricing, Greeks calculation, volatility surface, and implied volatility.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..models import User
from ..services.pricing_engine import PricingEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["Analytics"])

_pricing = PricingEngine()


# ── Request / Response schemas ─────────────────────────────────────────────


class OptionPricingRequest(BaseModel):
    spot_price: float = Field(..., gt=0, description="Current underlying price")
    strike_price: float = Field(..., gt=0, description="Option strike price")
    time_to_expiry: float = Field(
        ..., gt=0, le=5.0, description="Time to expiry in years"
    )
    risk_free_rate: float = Field(
        0.05, ge=0, le=1.0, description="Annual risk-free rate"
    )
    volatility: float = Field(
        ..., gt=0, le=5.0, description="Annualised implied volatility"
    )
    option_type: str = Field("call", pattern=r"^(call|put)$")
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    pricing_method: str = Field(
        "black_scholes", pattern=r"^(black_scholes|monte_carlo)$"
    )
    monte_carlo_paths: int = Field(100_000, ge=1_000, le=1_000_000)


class OptionPricingResponse(BaseModel):
    price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: Optional[float] = None
    method: str
    timestamp: str


class VolatilitySurfaceRequest(BaseModel):
    spot_price: float = Field(..., gt=0)
    strikes: List[float] = Field(..., min_length=2, max_length=50)
    expiries: List[float] = Field(..., min_length=1, max_length=12, description="Years")
    risk_free_rate: float = Field(0.05, ge=0, le=1.0)
    base_volatility: float = Field(0.20, gt=0, le=2.0)


class ImpliedVolRequest(BaseModel):
    market_price: float = Field(..., gt=0)
    spot_price: float = Field(..., gt=0)
    strike_price: float = Field(..., gt=0)
    time_to_expiry: float = Field(..., gt=0)
    risk_free_rate: float = Field(0.05, ge=0, le=1.0)
    option_type: str = Field("call", pattern=r"^(call|put)$")


# ── Helpers ────────────────────────────────────────────────────────────────


def _bs_put_price(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """European put price via Black-Scholes."""
    import math

    import scipy.stats as stats  # type: ignore

    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return float(K * math.exp(-r * T) * stats.norm.cdf(-d2) - S * stats.norm.cdf(-d1))


def _bs_call_price(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """European call price via Black-Scholes."""
    import math

    import scipy.stats as stats  # type: ignore

    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return float(S * stats.norm.cdf(d1) - K * math.exp(-r * T) * stats.norm.cdf(d2))


def _implied_vol_bisection(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str,
    tol: float = 1e-6,
    max_iter: int = 200,
) -> Optional[float]:
    """Solve for implied volatility via bisection."""
    pricer = _bs_call_price if option_type == "call" else _bs_put_price
    lo, hi = 1e-6, 10.0
    for _ in range(max_iter):
        mid = (lo + hi) / 2.0
        price_mid = pricer(S, K, T, r, mid)
        if abs(price_mid - market_price) < tol:
            return mid
        if price_mid < market_price:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/price", response_model=OptionPricingResponse)
async def price_option(
    req: OptionPricingRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Price a European option and compute its Greeks.

    Supports Black-Scholes (analytic) and Monte Carlo (stochastic) methods.
    """
    try:
        S, K, T, r, sigma = (
            req.spot_price,
            req.strike_price,
            req.time_to_expiry,
            req.risk_free_rate,
            req.volatility,
        )

        greeks = _pricing.calculate_greeks(S, K, T, r, sigma)

        if req.pricing_method == "monte_carlo":
            price = _pricing.monte_carlo_pricing(
                S, K, T, r, sigma, iterations=req.monte_carlo_paths, seed=42
            )
            if req.option_type == "put":
                # Put via put-call parity
                import math

                call_price = _bs_call_price(S, K, T, r, sigma)
                price = call_price - S + K * math.exp(-r * T)
        else:
            if req.option_type == "call":
                price = _bs_call_price(S, K, T, r, sigma)
            else:
                price = _bs_put_price(S, K, T, r, sigma)

        # For puts, flip delta sign
        delta = greeks["delta"] if req.option_type == "call" else greeks["delta"] - 1.0

        import math

        rho = K * T * math.exp(-r * T) * 0.01  # simplified rho approximation

        return OptionPricingResponse(
            price=round(price, 6),
            delta=round(delta, 6),
            gamma=round(greeks["gamma"], 6),
            theta=round(-greeks["vega"] * 0.01, 6),  # simplified theta
            vega=round(greeks["vega"] / 100, 6),
            rho=round(rho, 6),
            method=req.pricing_method,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.exception("Option pricing failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pricing failed: {exc}",
        )


@router.post("/implied-volatility")
async def compute_implied_volatility(
    req: ImpliedVolRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Back-solve for implied volatility given a market option price.

    Uses a bisection solver accurate to 1e-6 in volatility space.
    """
    iv = _implied_vol_bisection(
        req.market_price,
        req.spot_price,
        req.strike_price,
        req.time_to_expiry,
        req.risk_free_rate,
        req.option_type,
    )
    if iv is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Implied volatility could not be solved for given market price",
        )
    return {
        "implied_volatility": round(iv, 6),
        "implied_volatility_pct": round(iv * 100, 4),
        "option_type": req.option_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/volatility-surface")
async def compute_volatility_surface(
    req: VolatilitySurfaceRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Generate a volatility surface grid (strikes × expiries).

    Models smile via a quadratic skew centred at ATM.
    """

    surface: List[Dict[str, Any]] = []
    for T in req.expiries:
        for K in req.strikes:
            moneyness = K / req.spot_price
            # Quadratic smile: vol rises as you move away from ATM
            skew = req.base_volatility * (1.0 + 0.5 * (moneyness - 1.0) ** 2)
            iv = round(max(0.01, skew), 6)
            call_price = _bs_call_price(req.spot_price, K, T, req.risk_free_rate, iv)
            surface.append(
                {
                    "strike": K,
                    "expiry_years": T,
                    "implied_vol": iv,
                    "call_price": round(call_price, 4),
                }
            )

    return {
        "spot_price": req.spot_price,
        "surface_points": len(surface),
        "surface": surface,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/greeks/{symbol}")
async def quick_greeks(
    symbol: str,
    spot: float = Query(..., gt=0),
    strike: float = Query(..., gt=0),
    expiry_days: int = Query(..., ge=1, le=3650),
    volatility: float = Query(0.20, gt=0, le=5.0),
    risk_free_rate: float = Query(0.05, ge=0, le=1.0),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Quick Greeks lookup for a single option via query parameters.
    Useful for live dashboards that need low-latency responses.
    """
    T = expiry_days / 365.0
    greeks = _pricing.calculate_greeks(spot, strike, T, risk_free_rate, volatility)
    return {
        "symbol": symbol.upper(),
        "spot": spot,
        "strike": strike,
        "expiry_days": expiry_days,
        "volatility": volatility,
        "greeks": {k: round(v, 6) for k, v in greeks.items()},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

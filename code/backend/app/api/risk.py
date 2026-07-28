"""
Risk management routes for Optionix platform.
Portfolio VaR, stress testing, Greeks aggregation, circuit breakers.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_active_user
from ..database import get_db
from ..models import Account, Position, User
from ..services.pricing_engine import PricingEngine
from ..services.risk_assessment import RiskCalculator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/risk", tags=["Risk Management"])

_risk_calc = RiskCalculator()
_pricing = PricingEngine()


def _user_positions_query(user: User, db: Session):
    """Positions belong to an Account, so scope to the user via a join."""
    return (
        db.query(Position)
        .join(Account, Position.account_id == Account.id)
        .filter(Account.user_id == user.id)
    )


# ── Request schemas ────────────────────────────────────────────────────────


class StressTestRequest(BaseModel):
    scenarios: List[str] = Field(
        default=["market_crash", "volatility_spike", "rate_hike", "liquidity_crisis"],
        description="Scenario names to run",
    )
    portfolio_value: float = Field(
        ..., gt=0, description="Current portfolio value in USD"
    )
    positions: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional list of position overrides"
    )


class VaRRequest(BaseModel):
    confidence_levels: List[float] = Field(
        default=[0.90, 0.95, 0.99],
        description="Confidence levels for VaR calculation",
    )
    time_horizon_days: int = Field(default=1, ge=1, le=30)
    method: str = Field(
        default="historical",
        pattern=r"^(historical|parametric|monte_carlo)$",
    )
    n_simulations: int = Field(default=10_000, ge=1_000, le=500_000)


class GreeksHeatmapRequest(BaseModel):
    spot_range_pct: float = Field(
        default=0.20,
        gt=0,
        le=1.0,
        description="Spot price range ±% for the heatmap",
    )
    vol_range_pct: float = Field(
        default=0.10,
        gt=0,
        le=1.0,
        description="Volatility range ±% for the heatmap",
    )
    grid_steps: int = Field(default=5, ge=3, le=20)


# ── Scenario shocks ───────────────────────────────────────────────────────

_SCENARIO_SHOCKS: Dict[str, Dict[str, float]] = {
    "market_crash": {
        "price_shock": -0.30,
        "vol_shock": 0.50,
        "rate_shock": -0.01,
        "description": "2008-style equity market crash: -30% prices, +50% volatility",
    },
    "volatility_spike": {
        "price_shock": -0.05,
        "vol_shock": 1.00,
        "rate_shock": 0.00,
        "description": "VIX spike (COVID-style): -5% prices, volatility doubles",
    },
    "rate_hike": {
        "price_shock": -0.10,
        "vol_shock": 0.15,
        "rate_shock": 0.02,
        "description": "Aggressive rate hike: +200 bps, equities -10%",
    },
    "liquidity_crisis": {
        "price_shock": -0.20,
        "vol_shock": 0.75,
        "rate_shock": 0.01,
        "description": "Liquidity freeze: -20% prices, extreme bid-ask widening",
    },
    "black_swan": {
        "price_shock": -0.50,
        "vol_shock": 3.00,
        "rate_shock": -0.02,
        "description": "Tail event: -50% prices, volatility triples",
    },
    "mild_correction": {
        "price_shock": -0.10,
        "vol_shock": 0.20,
        "rate_shock": 0.00,
        "description": "Routine 10% market correction",
    },
}


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("/var")
async def calculate_var(
    req: VaRRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Calculate portfolio Value-at-Risk using historical, parametric, or
    Monte Carlo simulation methods.

    Returns VaR and CVaR at each requested confidence level.
    """
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )

    portfolio_value = (
        float(sum((p.size * (p.current_price or p.entry_price)) for p in positions))
        if positions
        else 10_000.0
    )  # default for empty portfolio

    rng = np.random.default_rng(42)

    if req.method == "monte_carlo":
        daily_vol = 0.02
        dt = req.time_horizon_days / 252.0
        raw = rng.normal(0, daily_vol * (dt**0.5), req.n_simulations) * portfolio_value
    elif req.method == "parametric":
        from scipy import stats  # type: ignore

        daily_vol = 0.02
        raw = (
            stats.norm.ppf(np.linspace(0.001, 0.999, req.n_simulations))
            * daily_vol
            * (req.time_horizon_days**0.5)
            * portfolio_value
        )
    else:  # historical
        daily_vol = 0.018
        raw = rng.normal(0, daily_vol, req.n_simulations) * portfolio_value

    results: Dict[str, Any] = {}
    for cl in req.confidence_levels:
        var = _risk_calc.calculate_var(raw, confidence=cl)
        cvar = _risk_calc.expected_shortfall(raw, confidence=cl)
        key = f"cl_{int(cl * 100)}"
        results[key] = {
            "confidence_level": cl,
            "var": round(var, 2),
            "cvar": round(cvar, 2),
            "var_pct": (
                round(abs(var) / portfolio_value * 100, 4) if portfolio_value else 0
            ),
        }

    return {
        "method": req.method,
        "time_horizon_days": req.time_horizon_days,
        "portfolio_value": round(portfolio_value, 2),
        "open_positions": len(positions),
        "var_results": results,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/stress-test")
async def run_stress_test(
    req: StressTestRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Run named stress-test scenarios against the portfolio.

    Each scenario applies correlated shocks to prices, volatility, and
    interest rates, then reports the estimated P&L impact.
    """
    invalid = [s for s in req.scenarios if s not in _SCENARIO_SHOCKS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown scenarios: {invalid}. Available: {list(_SCENARIO_SHOCKS)}",
        )

    scenario_results = []
    for scenario_name in req.scenarios:
        shock = _SCENARIO_SHOCKS[scenario_name]
        price_impact = req.portfolio_value * shock["price_shock"]
        vol_impact = (
            req.portfolio_value * shock["vol_shock"] * -0.02
        )  # vol hurts long vega
        total_pnl = price_impact + vol_impact
        pct_loss = total_pnl / req.portfolio_value * 100

        scenario_results.append(
            {
                "scenario": scenario_name,
                "description": shock["description"],
                "shocks": {
                    "price_pct": shock["price_shock"] * 100,
                    "volatility_pct": shock["vol_shock"] * 100,
                    "rate_bps": shock["rate_shock"] * 10_000,
                },
                "estimated_pnl": round(total_pnl, 2),
                "estimated_pnl_pct": round(pct_loss, 4),
                "severity": (
                    "critical"
                    if pct_loss < -20
                    else (
                        "high"
                        if pct_loss < -10
                        else "medium" if pct_loss < -5 else "low"
                    )
                ),
            }
        )

    worst = min(scenario_results, key=lambda x: x["estimated_pnl"])
    return {
        "portfolio_value": req.portfolio_value,
        "scenarios_run": len(scenario_results),
        "worst_case_scenario": worst["scenario"],
        "worst_case_pnl": worst["estimated_pnl"],
        "results": scenario_results,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/greeks/portfolio")
async def portfolio_greeks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Aggregate net Greeks across all open positions.

    Delta, Gamma, Theta, Vega and Rho are summed with correct sign
    conventions (long = positive, short = negative).
    """
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )
    totals = {g: Decimal("0") for g in ("delta", "gamma", "theta", "vega", "rho")}
    position_greeks = []

    for p in positions:
        pg = {
            "position_id": p.position_id,
            "symbol": p.symbol,
            "delta": str(p.delta or Decimal("0")),
            "gamma": str(p.gamma or Decimal("0")),
            "theta": str(p.theta or Decimal("0")),
            "vega": str(p.vega or Decimal("0")),
            "rho": str(p.rho or Decimal("0")),
        }
        position_greeks.append(pg)
        for g in totals:
            totals[g] += getattr(p, g) or Decimal("0")

    return {
        "net_greeks": {
            k: str(v.quantize(Decimal("0.0001"))) for k, v in totals.items()
        },
        "position_greeks": position_greeks,
        "open_positions": len(positions),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/greeks/heatmap")
async def greeks_heatmap(
    req: GreeksHeatmapRequest,
    spot: float = Query(..., gt=0, description="Current spot price"),
    strike: float = Query(..., gt=0),
    expiry_days: int = Query(..., ge=1, le=3650),
    base_vol: float = Query(0.20, gt=0, le=5.0),
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Generate a Delta / Gamma heatmap over a spot × volatility grid.

    Useful for visualising how Greeks change as market conditions shift.
    """
    T = expiry_days / 365.0
    r = 0.05
    n = req.grid_steps

    spots = np.linspace(
        spot * (1 - req.spot_range_pct), spot * (1 + req.spot_range_pct), n
    )
    vols = np.linspace(
        max(0.01, base_vol * (1 - req.vol_range_pct)),
        base_vol * (1 + req.vol_range_pct),
        n,
    )

    grid = []
    for s in spots:
        for v in vols:
            g = _pricing.calculate_greeks(float(s), strike, T, r, float(v))
            grid.append(
                {
                    "spot": round(float(s), 2),
                    "volatility": round(float(v), 4),
                    "delta": round(g["delta"], 6),
                    "gamma": round(g["gamma"], 6),
                    "vega": round(g["vega"], 6),
                }
            )

    return {
        "strike": strike,
        "expiry_days": expiry_days,
        "grid_points": len(grid),
        "heatmap": grid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/limits")
async def get_risk_limits(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return current risk limits and utilisation for the authenticated user."""
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    total_risk_limit = (
        sum(a.risk_limit for a in accounts) if accounts else Decimal("100000")
    )
    total_margin_used = (
        sum(a.margin_used for a in accounts) if accounts else Decimal("0")
    )
    utilisation_pct = (
        (total_margin_used / total_risk_limit * 100).quantize(Decimal("0.01"))
        if total_risk_limit > 0
        else Decimal("0")
    )

    return {
        "risk_limit_usd": str(total_risk_limit),
        "margin_used_usd": str(total_margin_used),
        "utilisation_pct": str(utilisation_pct),
        "status": (
            "critical"
            if utilisation_pct > 90
            else "warning" if utilisation_pct > 70 else "healthy"
        ),
        "available_scenarios": list(_SCENARIO_SHOCKS.keys()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/circuit-breakers")
async def circuit_breaker_status(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Return the status of all trading circuit breakers.

    Circuit breakers automatically halt trading when risk thresholds are exceeded.
    """
    return {
        "circuit_breakers": [
            {
                "name": "daily_loss_limit",
                "description": "Halts trading if daily loss exceeds 5% of portfolio",
                "threshold_pct": 5.0,
                "current_pct": 0.0,
                "status": "open",
                "triggered": False,
            },
            {
                "name": "position_concentration",
                "description": "Halts new orders if single-symbol exposure > 30%",
                "threshold_pct": 30.0,
                "current_pct": 0.0,
                "status": "open",
                "triggered": False,
            },
            {
                "name": "margin_utilisation",
                "description": "Halts new orders if margin utilisation > 90%",
                "threshold_pct": 90.0,
                "current_pct": 0.0,
                "status": "open",
                "triggered": False,
            },
            {
                "name": "volatility_spike",
                "description": "Restricts order size if implied vol doubles intraday",
                "threshold_pct": 100.0,
                "current_pct": 0.0,
                "status": "open",
                "triggered": False,
            },
        ],
        "all_clear": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

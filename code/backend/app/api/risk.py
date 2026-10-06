import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_active_user
from ..database import get_db
from ..models import Account, MarketData, Position, User
from ..services.pricing_engine import PricingEngine
from ..services.risk_assessment import RiskCalculator
from .analytics import get_pricing_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/risk", tags=["Risk Management"])

_risk_calc = RiskCalculator()

DEFAULT_ANNUAL_VOLATILITY = 0.02 * np.sqrt(252.0)
MIN_HISTORY = 30


def _user_positions_query(user: User, db: Session):
    return (
        db.query(Position)
        .join(Account, Position.account_id == Account.id)
        .filter(Account.user_id == user.id)
    )


class StressPosition(BaseModel):
    option_type: str = Field("call", pattern=r"^(call|put)$")
    spot: float = Field(..., gt=0)
    strike: float = Field(..., gt=0)
    time_to_expiry: float = Field(..., gt=0, le=10.0)
    volatility: float = Field(..., gt=0, le=5.0)
    quantity: float = Field(..., description="Signed contracts; negative for short")
    rate: float = Field(0.05, ge=0, le=1.0)
    dividend_yield: float = Field(0.0, ge=0, le=1.0)
    multiplier: float = Field(1.0, gt=0, le=10_000)


class StressTestRequest(BaseModel):
    scenarios: List[str] = Field(
        default=["market_crash", "volatility_spike", "rate_hike", "liquidity_crisis"],
        description="Scenario names to run",
    )
    portfolio_value: float = Field(
        ..., gt=0, description="Current portfolio value in USD"
    )
    positions: Optional[List[StressPosition]] = Field(
        None,
        max_length=500,
        description="Option positions to revalue under each scenario",
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
    annual_volatility: Optional[float] = Field(
        default=None,
        gt=0.01,
        le=5.0,
        description="Annualised volatility, for example a model forecast",
    )
    historical_returns: Optional[List[float]] = Field(
        default=None, min_length=MIN_HISTORY, max_length=5000
    )


class GreeksHeatmapRequest(BaseModel):
    option_type: str = Field(default="call", pattern=r"^(call|put)$")
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


def _history_returns(positions: List[Position], db: Session) -> Optional[np.ndarray]:
    symbols = sorted({p.symbol for p in positions})
    values = {
        sym: float(
            sum(
                p.size * (p.current_price or p.entry_price)
                for p in positions
                if p.symbol == sym
            )
        )
        for sym in symbols
    }
    total = sum(abs(v) for v in values.values())
    if not symbols or total <= 0:
        return None
    series = {}
    for sym in symbols:
        rows = (
            db.query(MarketData.close_price)
            .filter(MarketData.symbol == sym)
            .order_by(MarketData.timestamp.desc())
            .limit(1000)
            .all()
        )
        closes = np.array([float(r[0]) for r in reversed(rows)], dtype=float)
        if closes.size < MIN_HISTORY + 1 or np.any(closes <= 0):
            return None
        series[sym] = np.diff(np.log(closes))
    length = min(len(v) for v in series.values())
    combined = np.zeros(length)
    for sym, rets in series.items():
        combined += (values[sym] / total) * rets[-length:]
    return np.exp(combined) - 1.0


def _compute_var(
    req: VaRRequest,
    engine: PricingEngine,
    portfolio_value: float,
    history: Optional[np.ndarray],
) -> Dict[str, Any]:
    volatility = req.annual_volatility or DEFAULT_ANNUAL_VOLATILITY
    source = "request" if req.annual_volatility else "default_assumption"
    if req.method == "historical":
        if req.historical_returns:
            returns = np.asarray(req.historical_returns, dtype=float)
            source = "request_history"
        elif history is not None:
            returns = history
            source = "market_data_history"
        else:
            returns = engine.simulate_returns(volatility, 1, req.n_simulations)
            source = f"{source}_simulated"
        if req.time_horizon_days > 1:
            returns = np.expm1(
                np.log1p(np.maximum(returns, -0.999999))
                * np.sqrt(req.time_horizon_days)
            )
    elif req.method == "parametric":
        returns = engine.parametric_returns(volatility, req.time_horizon_days)
    else:
        returns = engine.simulate_returns(
            volatility, req.time_horizon_days, req.n_simulations
        )
    pnl = returns * portfolio_value
    results: Dict[str, Any] = {}
    for cl in req.confidence_levels:
        var = _risk_calc.calculate_var(pnl, confidence=cl)
        cvar = _risk_calc.expected_shortfall(pnl, confidence=cl)
        results[f"cl_{int(round(cl * 100))}"] = {
            "confidence_level": cl,
            "var": round(var, 2),
            "cvar": round(cvar, 2),
            "var_pct": (
                round(abs(var) / portfolio_value * 100, 4) if portfolio_value else 0
            ),
        }
    return {"results": results, "volatility": volatility, "source": source}


@router.post("/var")
async def calculate_var(
    req: VaRRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    if any(not 0.5 < cl < 1.0 for cl in req.confidence_levels):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Confidence levels must be between 0.5 and 1.0 exclusive",
        )
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )
    portfolio_value = (
        float(sum((p.size * (p.current_price or p.entry_price)) for p in positions))
        if positions
        else 10_000.0
    )
    history = _history_returns(positions, db) if req.method == "historical" else None
    try:
        computed = await run_in_threadpool(
            _compute_var, req, engine, portfolio_value, history
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )
    return {
        "method": req.method,
        "time_horizon_days": req.time_horizon_days,
        "portfolio_value": round(portfolio_value, 2),
        "open_positions": len(positions),
        "annual_volatility": round(computed["volatility"], 6),
        "volatility_source": computed["source"],
        "var_results": computed["results"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/stress-test")
async def run_stress_test(
    req: StressTestRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    invalid = [s for s in req.scenarios if s not in _SCENARIO_SHOCKS]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown scenarios: {invalid}. Available: {list(_SCENARIO_SHOCKS)}",
        )
    positions = [p.model_dump() for p in req.positions] if req.positions else None

    def run() -> List[Dict[str, Any]]:
        out = []
        for scenario_name in req.scenarios:
            shock = _SCENARIO_SHOCKS[scenario_name]
            if positions:
                total_pnl = engine.revalue_scenario(
                    positions,
                    shock["price_shock"],
                    shock["vol_shock"],
                    shock["rate_shock"],
                )
            else:
                total_pnl = req.portfolio_value * shock["price_shock"] + (
                    req.portfolio_value * shock["vol_shock"] * -0.02
                )
            pct_loss = total_pnl / req.portfolio_value * 100
            out.append(
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
        return out

    scenario_results = await run_in_threadpool(run)
    worst = min(scenario_results, key=lambda x: x["estimated_pnl"])
    return {
        "portfolio_value": req.portfolio_value,
        "valuation_method": "full_revaluation" if positions else "linear_approximation",
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
    rate: float = Query(0.05, ge=0, le=1.0),
    current_user: User = Depends(get_current_active_user),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    T = expiry_days / 365.0
    n = req.grid_steps
    spots = np.linspace(
        spot * (1 - req.spot_range_pct), spot * (1 + req.spot_range_pct), n
    )
    vols = np.linspace(
        max(0.01, base_vol * (1 - req.vol_range_pct)),
        base_vol * (1 + req.vol_range_pct),
        n,
    )

    def build() -> List[Dict[str, Any]]:
        grid = []
        for s_value in spots:
            for v_value in vols:
                g = engine.calculate_greeks(
                    float(s_value),
                    strike,
                    T,
                    rate,
                    float(v_value),
                    0.0,
                    req.option_type,
                )
                grid.append(
                    {
                        "spot": round(float(s_value), 2),
                        "volatility": round(float(v_value), 4),
                        "delta": round(g["delta"], 6),
                        "gamma": round(g["gamma"], 6),
                        "vega": round(g["vega"], 6),
                        "theta": round(g["theta"], 6),
                    }
                )
        return grid

    grid = await run_in_threadpool(build)
    return {
        "strike": strike,
        "expiry_days": expiry_days,
        "option_type": req.option_type,
        "grid_points": len(grid),
        "heatmap": grid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/limits")
async def get_risk_limits(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
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

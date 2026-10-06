import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from ..auth import get_current_active_user
from ..database import get_db
from ..models import Account, Position, Trade, User
from ..services.financial_service import FinancialCalculationService
from ..services.pricing_engine import PricingEngine
from ..services.risk_assessment import RiskCalculator
from .analytics import get_pricing_engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

_financial_svc = FinancialCalculationService()
_risk_calc = RiskCalculator()


def _user_positions_query(user: User, db: Session):
    return (
        db.query(Position)
        .join(Account, Position.account_id == Account.id)
        .filter(Account.user_id == user.id)
    )


@router.get("/overview")
async def portfolio_overview(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    accounts = (
        db.query(Account)
        .filter(Account.user_id == current_user.id, Account.account_status == "active")
        .all()
    )
    if not accounts:
        return {
            "total_equity": "0.00",
            "total_unrealised_pnl": "0.00",
            "margin_utilisation_pct": "0.00",
            "open_positions": 0,
            "accounts": [],
        }

    total_balance = sum(a.balance_usd for a in accounts)
    total_margin_used = sum(a.margin_used for a in accounts)

    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )

    total_unrealised = sum(p.unrealized_pnl or Decimal("0") for p in positions)
    margin_util_pct = (
        (total_margin_used / total_balance * 100).quantize(Decimal("0.01"))
        if total_balance > 0
        else Decimal("0")
    )

    return {
        "total_equity": str(total_balance),
        "total_unrealised_pnl": str(total_unrealised),
        "margin_utilisation_pct": str(margin_util_pct),
        "open_positions": len(positions),
        "accounts": [
            {
                "account_id": a.account_id,
                "account_type": a.account_type,
                "balance_usd": str(a.balance_usd),
                "margin_available": str(a.margin_available),
            }
            for a in accounts
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/allocation")
async def portfolio_allocation(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )

    if not positions:
        return {"allocations": [], "total_exposure": "0.00"}

    symbol_exposure: Dict[str, Decimal] = {}
    for pos in positions:
        price = pos.current_price or pos.entry_price
        exposure = pos.size * price
        symbol_exposure[pos.symbol] = (
            symbol_exposure.get(pos.symbol, Decimal("0")) + exposure
        )

    total_exposure = sum(symbol_exposure.values())
    allocations = [
        {
            "symbol": sym,
            "exposure": str(exp.quantize(Decimal("0.01"))),
            "weight_pct": str(
                (exp / total_exposure * 100).quantize(Decimal("0.01"))
                if total_exposure > 0
                else Decimal("0")
            ),
        }
        for sym, exp in sorted(symbol_exposure.items(), key=lambda x: -x[1])
    ]

    return {
        "allocations": allocations,
        "total_exposure": str(total_exposure.quantize(Decimal("0.01"))),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/performance")
async def portfolio_performance(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    trades = (
        db.query(Trade)
        .filter(
            Trade.user_id == current_user.id,
            Trade.status == "executed",
            Trade.executed_at >= cutoff,
        )
        .all()
    )

    if not trades:
        return {
            "period_days": days,
            "total_trades": 0,
            "total_pnl": "0.00",
            "win_rate_pct": "0.00",
            "avg_trade_value": "0.00",
        }

    total_value = sum(t.total_value for t in trades)
    total_fees = sum(t.fees for t in trades)
    approx_pnl = (-total_fees).quantize(Decimal("0.01"))
    avg_value = (total_value / len(trades)).quantize(Decimal("0.01"))

    return {
        "period_days": days,
        "total_trades": len(trades),
        "total_pnl": str(approx_pnl),
        "total_fees": str(total_fees.quantize(Decimal("0.01"))),
        "win_rate_pct": "N/A",
        "avg_trade_value": str(avg_value),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/risk-metrics")
async def portfolio_risk_metrics(
    annual_volatility: float = Query(0.3175, gt=0.01, le=5.0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    engine: PricingEngine = Depends(get_pricing_engine),
) -> Dict[str, Any]:
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )
    if not positions:
        return {"var_95": "0.00", "cvar_95": "0.00", "positions": 0}

    n_sim = 10_000
    portfolio_value = float(
        sum((p.size * (p.current_price or p.entry_price)) for p in positions)
    )
    returns = await run_in_threadpool(
        engine.simulate_returns, annual_volatility, 1, n_sim
    )
    pnl = returns * portfolio_value
    var_95 = _risk_calc.calculate_var(pnl, confidence=0.95)
    cvar_95 = _risk_calc.expected_shortfall(pnl, confidence=0.95)

    return {
        "positions": len(positions),
        "portfolio_value": f"{portfolio_value:.2f}",
        "var_95": f"{var_95:.2f}",
        "cvar_95": f"{cvar_95:.2f}",
        "annual_volatility": f"{annual_volatility:.4f}",
        "methodology": f"Monte Carlo GBM ({n_sim:,} paths, 1 day)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/positions/greeks-summary")
async def greeks_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    positions = (
        _user_positions_query(current_user, db).filter(Position.status == "open").all()
    )

    net = {
        "delta": Decimal("0"),
        "gamma": Decimal("0"),
        "theta": Decimal("0"),
        "vega": Decimal("0"),
        "rho": Decimal("0"),
    }
    for p in positions:
        net["delta"] += p.delta or Decimal("0")
        net["gamma"] += p.gamma or Decimal("0")
        net["theta"] += p.theta or Decimal("0")
        net["vega"] += p.vega or Decimal("0")
        net["rho"] += p.rho or Decimal("0")

    return {
        "net_greeks": {k: str(v.quantize(Decimal("0.0001"))) for k, v in net.items()},
        "open_positions": len(positions),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

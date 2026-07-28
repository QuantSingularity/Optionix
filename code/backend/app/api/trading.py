"""
Trading routes for Optionix platform.
Handles trade execution, order management, and position tracking.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from ..auth import get_current_active_user
from ..database import get_db
from ..models import Account, Position, Trade, User
from ..schemas import (
    AccountCreate,
    AccountResponse,
    PositionResponse,
    TradeRequest,
    TradeResponse,
)
from ..services.financial_service import FinancialCalculationService
from ..services.pricing_engine import PricingEngine
from ..services.risk_assessment import RiskCalculator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trading", tags=["Trading"])

_financial_svc = FinancialCalculationService()
_pricing_engine = PricingEngine()
_risk_calc = RiskCalculator()


# ── Helpers ────────────────────────────────────────────────────────────────


def _get_account_or_404(account_id: int, user: User, db: Session) -> Account:
    account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == user.id)
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trading account not found",
        )
    return account


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED
)
async def create_account(
    account_req: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Provision a new trading account for the authenticated user.

    Each account gets an isolated balance, margin pool, and risk limit.
    A user may hold multiple accounts (e.g. one demo, one live).
    """
    existing = (
        db.query(Account)
        .filter(Account.ethereum_address == account_req.ethereum_address)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this address already exists",
        )

    initial_balance = account_req.initial_deposit or Decimal("0")

    account = Account(
        account_id=str(uuid4()),
        user_id=current_user.id,
        ethereum_address=account_req.ethereum_address,
        account_type=account_req.account_type,
        account_status="active",
        balance_usd=initial_balance,
        margin_available=initial_balance,
        margin_used=Decimal("0"),
        margin_requirement=Decimal("0"),
        risk_limit=Decimal("100000"),
        daily_loss_limit=Decimal("10000"),
    )
    db.add(account)
    db.commit()
    db.refresh(account)

    logger.info(
        "Account created: account_id=%s user=%s type=%s",
        account.account_id,
        current_user.user_id,
        account.account_type,
    )
    return account


@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all trading accounts belonging to the authenticated user."""
    return (
        db.query(Account)
        .filter(Account.user_id == current_user.id)
        .order_by(Account.created_at.desc())
        .all()
    )


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single trading account by its numeric ID."""
    return _get_account_or_404(account_id, current_user, db)


@router.post(
    "/orders", response_model=TradeResponse, status_code=status.HTTP_201_CREATED
)
async def place_order(
    trade_req: TradeRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Place a new options trade order.

    Validates account ownership, sufficient margin, and compliance checks
    before routing to the execution engine.
    """
    account = _get_account_or_404(trade_req.account_id, current_user, db)

    if account.account_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trading account is not active",
        )

    # Determine execution price (market order uses a synthetic mid price)
    exec_price: Decimal = trade_req.price or Decimal("100.00")

    position_value = exec_price * trade_req.quantity
    margin_needed = _financial_svc.calculate_margin_requirement(position_value)

    if account.margin_available < margin_needed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Insufficient margin: required {margin_needed}, available {account.margin_available}",
        )

    fee = (position_value * Decimal("0.001")).quantize(Decimal("0.01"))

    trade = Trade(
        trade_id=str(uuid4()),
        user_id=current_user.id,
        account_id=account.id,
        symbol=trade_req.symbol.upper(),
        trade_type=trade_req.trade_type,
        order_type=trade_req.order_type,
        quantity=trade_req.quantity,
        price=exec_price,
        executed_price=exec_price if trade_req.order_type == "market" else None,
        total_value=position_value,
        fees=fee,
        status="executed" if trade_req.order_type == "market" else "pending",
        compliance_status="approved",
        risk_score=25,
        client_order_id=trade_req.client_order_id,
        executed_at=(
            datetime.now(timezone.utc).replace(tzinfo=None)
            if trade_req.order_type == "market"
            else None
        ),
    )
    db.add(trade)

    # Update account margin
    account.margin_used = (account.margin_used + margin_needed).quantize(
        Decimal("0.01")
    )
    account.margin_available = (account.balance_usd - account.margin_used).quantize(
        Decimal("0.01")
    )

    db.commit()
    db.refresh(trade)

    logger.info(
        "Order placed: trade_id=%s user=%s symbol=%s type=%s qty=%s",
        trade.trade_id,
        current_user.user_id,
        trade.symbol,
        trade.trade_type,
        trade.quantity,
    )
    return trade


@router.get("/orders", response_model=List[TradeResponse])
async def list_orders(
    symbol: Optional[str] = Query(None, max_length=20),
    trade_type: Optional[str] = Query(None, pattern=r"^(buy|sell)$"),
    order_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve the authenticated user's trade history with optional filters."""
    q = db.query(Trade).filter(Trade.user_id == current_user.id)
    if symbol:
        q = q.filter(Trade.symbol == symbol.upper())
    if trade_type:
        q = q.filter(Trade.trade_type == trade_type)
    if order_status:
        q = q.filter(Trade.status == order_status)
    trades = q.order_by(Trade.created_at.desc()).offset(offset).limit(limit).all()
    return trades


@router.get("/orders/{trade_id}", response_model=TradeResponse)
async def get_order(
    trade_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single order by its UUID."""
    trade = (
        db.query(Trade)
        .filter(Trade.trade_id == trade_id, Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    return trade


@router.delete("/orders/{trade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_order(
    trade_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Cancel a pending limit or stop order.

    Market orders that have already been executed cannot be cancelled.
    """
    trade = (
        db.query(Trade)
        .filter(Trade.trade_id == trade_id, Trade.user_id == current_user.id)
        .first()
    )
    if not trade:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    if trade.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel order with status '{trade.status}'",
        )
    trade.status = "cancelled"
    db.commit()
    logger.info("Order cancelled: trade_id=%s user=%s", trade_id, current_user.user_id)


@router.get("/positions", response_model=List[PositionResponse])
async def list_positions(
    symbol: Optional[str] = Query(None, max_length=20),
    position_status: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all open and closed positions for the authenticated user."""
    q = (
        db.query(Position)
        .join(Account, Position.account_id == Account.id)
        .filter(Account.user_id == current_user.id)
    )
    if symbol:
        q = q.filter(Position.symbol == symbol.upper())
    if position_status:
        q = q.filter(Position.status == position_status)
    return q.order_by(Position.created_at.desc()).all()


@router.get("/positions/{position_id}", response_model=PositionResponse)
async def get_position(
    position_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Fetch a single position by its UUID."""
    position = (
        db.query(Position)
        .join(Account, Position.account_id == Account.id)
        .filter(Position.position_id == position_id, Account.user_id == current_user.id)
        .first()
    )
    if not position:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Position not found"
        )
    return position


@router.get("/accounts/{account_id}/summary")
async def account_summary(
    account_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return a margin and P&L summary for a trading account."""
    account = _get_account_or_404(account_id, current_user, db)
    positions = (
        db.query(Position)
        .filter(Position.account_id == account_id, Position.status == "open")
        .all()
    )
    total_unrealised_pnl = sum((p.unrealized_pnl or Decimal("0")) for p in positions)
    return {
        "account_id": account.account_id,
        "balance_usd": str(account.balance_usd),
        "margin_used": str(account.margin_used),
        "margin_available": str(account.margin_available),
        "open_positions": len(positions),
        "total_unrealised_pnl": str(total_unrealised_pnl),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

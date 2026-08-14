"""
Blockchain routes for Optionix platform.

Exposes read access to the on-chain futures/options contracts and prepares
unsigned transactions for the caller's own wallet to sign. The backend
never accepts or handles a user's private key - see
services/blockchain_service.py for why.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status

from ..auth import get_current_active_user
from ..models import User
from ..schemas import (
    BlockchainStatusResponse,
    MarginTxRequest,
    OnChainOptionResponse,
    OnChainPositionHealthResponse,
    OptionTxRequest,
    TransactionStatusResponse,
    UnsignedTransactionResponse,
    WalletBalanceResponse,
)
from ..services.blockchain_service import BlockchainService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/blockchain", tags=["Blockchain"])

_blockchain_service: Optional[BlockchainService] = None


def get_blockchain_service() -> BlockchainService:
    global _blockchain_service
    if _blockchain_service is None:
        _blockchain_service = BlockchainService()
    return _blockchain_service


ADDRESS_PATH = Path(..., pattern=r"^0x[a-fA-F0-9]{40}$")


@router.get("/status", response_model=BlockchainStatusResponse)
async def get_status(
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Report which parts of the on-chain integration are actually live."""
    return svc.get_integration_status()


@router.get("/wallet/{address}/balance", response_model=WalletBalanceResponse)
async def get_wallet_balance(
    address: str = ADDRESS_PATH,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Get the native ETH balance for a wallet address."""
    try:
        balance = svc.get_account_balance(address)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
    return {"address": address, "balance_eth": balance}


@router.get("/wallet/{address}/positions", response_model=OnChainPositionHealthResponse)
async def get_wallet_positions(
    address: str = ADDRESS_PATH,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Get aggregated on-chain futures position health for a wallet."""
    try:
        return svc.get_position_health(address)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get("/wallet/{address}/options", response_model=list[OnChainOptionResponse])
async def get_wallet_options(
    address: str = ADDRESS_PATH,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """List on-chain options a wallet has written or purchased."""
    try:
        option_ids = svc.get_user_option_ids(address)
        options = [svc.get_option(oid) for oid in option_ids]
        return [o for o in options if o is not None]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )


@router.get("/options/{option_id}", response_model=OnChainOptionResponse)
async def get_option(
    option_id: int,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Fetch a single on-chain option by ID."""
    option = svc.get_option(option_id)
    if option is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Option not found or options contract not configured",
        )
    return option


@router.post("/margin/deposit", response_model=UnsignedTransactionResponse)
async def prepare_deposit_margin(
    req: MarginTxRequest,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """
    Prepare an unsigned depositMargin transaction. Sign and submit it with
    the trader's own wallet - the amount is never custodied by the backend.
    """
    try:
        tx = svc.build_deposit_margin_tx(
            req.user_address,
            req.amount,
            req.asset_address or "0x" + "0" * 40,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
    return {"transaction": tx}


@router.post("/margin/withdraw", response_model=UnsignedTransactionResponse)
async def prepare_withdraw_margin(
    req: MarginTxRequest,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Prepare an unsigned withdrawMargin transaction for the trader to sign."""
    try:
        tx = svc.build_withdraw_margin_tx(
            req.user_address,
            req.amount,
            req.asset_address or "0x" + "0" * 40,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
    return {"transaction": tx}


@router.post("/options/purchase", response_model=UnsignedTransactionResponse)
async def prepare_purchase_option(
    req: OptionTxRequest,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Prepare an unsigned purchaseOption transaction for the buyer to sign."""
    try:
        tx = svc.build_purchase_option_tx(req.wallet_address, req.option_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
    return {"transaction": tx}


@router.post("/options/exercise", response_model=UnsignedTransactionResponse)
async def prepare_exercise_option(
    req: OptionTxRequest,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Prepare an unsigned exerciseOption transaction for the holder to sign."""
    try:
        tx = svc.build_exercise_option_tx(req.wallet_address, req.option_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e)
        )
    return {"transaction": tx}


@router.get("/transactions/{tx_hash}", response_model=TransactionStatusResponse)
async def get_transaction_status(
    tx_hash: str,
    current_user: User = Depends(get_current_active_user),
    svc: BlockchainService = Depends(get_blockchain_service),
):
    """Poll the status of a previously submitted transaction."""
    return svc.get_transaction_status(tx_hash)

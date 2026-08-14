"""
Blockchain service module for Optionix platform.
Handles all blockchain interactions with robust security and error handling.

Integrates with the two contracts in code/blockchain/contracts:
  - EnhancedFuturesContract (margin deposits/withdrawals, positions)
  - EnhancedOptionsContract (collateral, option writing/purchase/exercise)

Write operations (deposit, withdraw, purchase, exercise) are exposed as
*unsigned transaction builders* rather than functions that accept a raw
private key. The backend never holds or transmits user private keys; it
prepares calldata and the caller's own wallet (MetaMask, WalletConnect,
etc.) signs and submits it client-side. `get_transaction_status` can then
be polled with the resulting transaction hash.
"""

import json
import logging
import time
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from web3 import Web3
    from web3.exceptions import ContractLogicError, Web3Exception

    _WEB3_AVAILABLE = True
except ImportError:
    Web3 = None  # type: ignore
    ContractLogicError = Exception  # type: ignore
    Web3Exception = Exception  # type: ignore
    _WEB3_AVAILABLE = False

from ..config import settings

logger = logging.getLogger(__name__)

ZERO_ADDRESS = "0x" + "0" * 40

# This file lives at code/backend/app/services/blockchain_service.py.
# parents[0]=services parents[1]=app parents[2]=backend parents[3]=code
_ABI_DIR = Path(__file__).resolve().parents[3] / "blockchain" / "abi"

# Position/Option status enum values, matching the Solidity enum declaration
# order exactly (see contracts/FuturesContract.sol / OptionsContract.sol).
_POSITION_STATUS = ["active", "closed", "liquidated", "settled"]
_OPTION_STATUS = ["active", "exercised", "expired", "cancelled"]
_OPTION_TYPE = ["call", "put"]
_OPTION_STYLE = ["european", "american"]


class BlockchainService:
    """Service for interacting with the Optionix on-chain contracts and wallets"""

    def __init__(self) -> None:
        """Initialize blockchain service with a Web3 provider and both contracts"""
        self.w3: Optional[Any] = None
        self.futures_contract: Optional[Any] = None
        self.options_contract: Optional[Any] = None

        if not _WEB3_AVAILABLE:
            logger.warning(
                "web3.py is not installed - blockchain integration is disabled. "
                "It's listed in requirements.txt; reinstall dependencies to enable it."
            )
            return

        self._initialize_connection()
        futures_abi = self._load_abi("EnhancedFuturesContract.abi.json")
        options_abi = self._load_abi("EnhancedOptionsContract.abi.json")
        self.futures_contract = self._initialize_contract(
            settings.futures_contract_address, futures_abi, "futures"
        )
        self.options_contract = self._initialize_contract(
            settings.options_contract_address, options_abi, "options"
        )

    def _initialize_connection(self) -> None:
        """Initialize Web3 connection with retry logic"""
        max_retries = 3
        retry_delay = 1
        for attempt in range(max_retries):
            try:
                if "your-project-id" in settings.ethereum_provider_url:
                    logger.warning(
                        "Using placeholder Ethereum URL. Skipping connection attempt."
                    )
                    self.w3 = None
                    return
                self.w3 = Web3(
                    Web3.HTTPProvider(
                        settings.ethereum_provider_url, request_kwargs={"timeout": 30}
                    )
                )
                if self.w3 and self.w3.is_connected():
                    logger.info(
                        f"Connected to Ethereum network (Chain ID: {self.w3.eth.chain_id})"
                    )
                    return
                else:
                    raise ConnectionError("Failed to connect to Ethereum network")
            except Exception as e:
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(
                        "Failed to connect to Ethereum network after all retries"
                    )
                    self.w3 = None
                    return

    def _load_abi(self, filename: str) -> List[Dict[str, Any]]:
        """Load a contract ABI exported from the Hardhat build (blockchain/abi/*.json)"""
        abi_path = _ABI_DIR / filename
        if not abi_path.exists():
            logger.warning(
                f"Contract ABI file not found at {abi_path}; running without it. "
                f"Run `npm run export-abi` in code/blockchain after compiling."
            )
            return []
        try:
            with open(abi_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading ABI {filename}: {e}")
            return []

    def _initialize_contract(
        self, address: str, abi: List[Dict[str, Any]], label: str
    ) -> Optional[Any]:
        """Instantiate a contract binding, or None if not configured/available"""
        if not self.w3 or not abi:
            return None
        if not self.w3.is_address(address) or address.lower() == ZERO_ADDRESS:
            logger.warning(f"Invalid or zero {label} contract address: {address}")
            return None
        try:
            contract = self.w3.eth.contract(
                address=self.w3.to_checksum_address(address), abi=abi
            )
            logger.info(f"{label.capitalize()} contract initialized at {address}")
            return contract
        except Exception as e:
            logger.error(f"Error initializing {label} contract: {e}")
            return None

    def is_connected(self) -> bool:
        """Check if the Web3 connection is active"""
        try:
            return self.w3 is not None and self.w3.is_connected()
        except Exception:
            return False

    def get_integration_status(self) -> Dict[str, Any]:
        """Report exactly which parts of the on-chain integration are live"""
        return {
            "web3_installed": _WEB3_AVAILABLE,
            "rpc_connected": self.is_connected(),
            "futures_contract_configured": self.futures_contract is not None,
            "options_contract_configured": self.options_contract is not None,
        }

    def is_valid_address(self, address: str) -> bool:
        """Validate an Ethereum address's format.

        This is a pure format check and deliberately does not require a
        live RPC connection - callers rely on it (e.g. to decide whether to
        fall back to mock data) even when `self.w3` is None.
        """
        if not _WEB3_AVAILABLE:
            return False
        return Web3.is_address(address)

    def get_account_balance(self, address: str) -> Decimal:
        """Get native ETH balance for an address"""
        if not self.is_valid_address(address):
            raise ValueError("Invalid Ethereum address")
        if not self.is_connected():
            raise Exception("Blockchain connection not available")
        try:
            balance_wei = self.w3.eth.get_balance(address)
            balance_eth = self.w3.from_wei(balance_wei, "ether")
            return Decimal(str(balance_eth))
        except Exception as e:
            logger.error(f"Error fetching balance for {address}: {e}")
            raise Exception(f"Failed to fetch balance: {str(e)}")

    # ── Futures: reads ───────────────────────────────────────────────────

    def get_user_position_ids(self, address: str) -> List[int]:
        """Get all on-chain futures position IDs ever opened by a trader"""
        if not self.is_valid_address(address):
            raise ValueError("Invalid Ethereum address")
        if not self.futures_contract:
            return []
        try:
            checksum = self.w3.to_checksum_address(address)
            return list(
                self.futures_contract.functions.getUserPositions(checksum).call()
            )
        except (ContractLogicError, Web3Exception) as e:
            logger.error(f"Contract error fetching positions for {address}: {e}")
            raise Exception(f"Failed to fetch positions: {str(e)}")

    def get_position_health(self, address: str) -> Dict[str, Any]:
        """
        Aggregate on-chain health metrics across a trader's open futures
        positions. Falls back to representative mock data when the futures
        contract isn't configured, so callers (e.g. the health check) don't
        need to special-case an unconfigured environment.
        """
        if not self.is_valid_address(address):
            raise ValueError("Invalid Ethereum address")
        if not self.futures_contract:
            return self._get_mock_position_health(address)

        try:
            checksum = self.w3.to_checksum_address(address)
            position_ids = self.get_user_position_ids(address)

            open_positions: List[Dict[str, Any]] = []
            total_margin_used = Decimal("0")

            for position_id in position_ids:
                details = self.futures_contract.functions.getPositionDetails(
                    position_id
                ).call()
                (
                    trader,
                    underlying_asset,
                    size,
                    is_long,
                    entry_price,
                    margin,
                    leverage,
                    status,
                ) = details

                if _POSITION_STATUS[status] != "active":
                    continue

                size_dec = Decimal(size) / Decimal(10**18)
                margin_dec = Decimal(margin) / Decimal(10**18)
                entry_price_dec = Decimal(entry_price)
                liquidation_price = self._calculate_liquidation_price(
                    entry_price_dec, is_long, size_dec
                )

                open_positions.append(
                    {
                        "position_id": position_id,
                        "underlying_asset": underlying_asset,
                        "position_type": "long" if is_long else "short",
                        "size": size_dec,
                        "entry_price": entry_price_dec,
                        "margin": margin_dec,
                        "leverage": leverage,
                        "liquidation_price": liquidation_price,
                        "status": "open",
                    }
                )
                total_margin_used += margin_dec

            if not open_positions:
                return {
                    "address": address,
                    "positions": [],
                    "total_margin_used": Decimal("0"),
                    "total_margin_available": Decimal("0"),
                    "health_ratio": float("inf"),
                    "liquidation_risk": "none",
                }

            profile = self.futures_contract.functions.userProfiles(checksum).call()
            # UserProfile field order: isKYCVerified, complianceStatus, riskScore,
            # maxPositionSize, totalMargin, availableMargin, totalExposure, ...
            available_margin = Decimal(profile[5]) / Decimal(10**18)
            health_ratio = (
                float(available_margin / total_margin_used)
                if total_margin_used > 0
                else float("inf")
            )

            return {
                "address": address,
                "positions": open_positions,
                "total_margin_used": total_margin_used,
                "total_margin_available": available_margin,
                "health_ratio": health_ratio,
                "liquidation_risk": self._assess_liquidation_risk(health_ratio),
            }
        except (ContractLogicError, Web3Exception) as e:
            logger.error(f"Contract error fetching position health for {address}: {e}")
            raise Exception(f"Blockchain error: {str(e)}")
        except Exception as e:
            logger.error(
                f"Unexpected error fetching position health for {address}: {e}"
            )
            raise Exception(f"Error fetching position health: {str(e)}")

    def _get_mock_position_health(self, address: str) -> Dict[str, Any]:
        """Representative position health data for when no contract is configured"""
        return {
            "address": address,
            "positions": [
                {
                    "position_id": 0,
                    "underlying_asset": ZERO_ADDRESS,
                    "position_type": "long",
                    "size": Decimal("0.1"),
                    "entry_price": Decimal("30000"),
                    "margin": Decimal("300"),
                    "leverage": 10,
                    "liquidation_price": Decimal("27000"),
                    "status": "open",
                }
            ],
            "total_margin_used": Decimal("300"),
            "total_margin_available": Decimal("700"),
            "health_ratio": 2.33,
            "liquidation_risk": "low",
        }

    def _calculate_liquidation_price(
        self, entry_price: Decimal, is_long: bool, size: Decimal
    ) -> Decimal:
        """Rough liquidation price estimate for display purposes only.

        This mirrors the contract's approximate maintenance-margin buffer;
        it is not a substitute for calling `_isLiquidationEligible` on-chain,
        which is what actually gates liquidation.
        """
        if is_long:
            return entry_price * Decimal("0.9")
        else:
            return entry_price * Decimal("1.1")

    def _assess_liquidation_risk(self, health_ratio: float) -> str:
        """Bucket a margin health ratio into a human-readable risk level"""
        if health_ratio > 3.0:
            return "very_low"
        elif health_ratio > 1.5:
            return "low"
        elif health_ratio > 1.1:
            return "medium"
        else:
            return "high"

    # ── Futures: unsigned transaction builders ──────────────────────────

    def _build_tx(
        self, contract_function: Any, from_address: str, value_wei: int = 0
    ) -> Dict[str, Any]:
        """Build an unsigned transaction dict for the caller's wallet to sign"""
        if not self.w3:
            raise Exception("Blockchain connection not available")
        tx: Dict[str, Any] = {
            "from": from_address,
            "nonce": self.w3.eth.get_transaction_count(from_address),
            "gasPrice": self.w3.eth.gas_price,
            "chainId": settings.ethereum_chain_id,
        }
        if value_wei:
            tx["value"] = value_wei
        built = contract_function.build_transaction(tx)
        try:
            built["gas"] = self.w3.eth.estimate_gas(built)
        except Exception as e:
            logger.warning(f"Gas estimation failed, leaving gas unset: {e}")
        return built

    def build_deposit_margin_tx(
        self, user_address: str, amount: Decimal, asset_address: str = ZERO_ADDRESS
    ) -> Dict[str, Any]:
        """Build an unsigned depositMargin transaction for the trader to sign"""
        if not self.futures_contract:
            raise Exception("Futures contract not configured")
        if not self.is_valid_address(user_address):
            raise ValueError("Invalid user address")
        if amount <= 0:
            raise ValueError("Deposit amount must be positive")

        amount_wei = self.w3.to_wei(amount, "ether")
        checksum_user = self.w3.to_checksum_address(user_address)
        checksum_asset = self.w3.to_checksum_address(asset_address)
        value_wei = amount_wei if asset_address.lower() == ZERO_ADDRESS else 0

        fn = self.futures_contract.functions.depositMargin(checksum_asset, amount_wei)
        return self._build_tx(fn, checksum_user, value_wei)

    def build_withdraw_margin_tx(
        self, user_address: str, amount: Decimal, asset_address: str = ZERO_ADDRESS
    ) -> Dict[str, Any]:
        """Build an unsigned withdrawMargin transaction for the trader to sign"""
        if not self.futures_contract:
            raise Exception("Futures contract not configured")
        if not self.is_valid_address(user_address):
            raise ValueError("Invalid user address")
        if amount <= 0:
            raise ValueError("Withdrawal amount must be positive")

        amount_wei = self.w3.to_wei(amount, "ether")
        checksum_user = self.w3.to_checksum_address(user_address)
        checksum_asset = self.w3.to_checksum_address(asset_address)

        fn = self.futures_contract.functions.withdrawMargin(checksum_asset, amount_wei)
        return self._build_tx(fn, checksum_user)

    # ── Options: reads ───────────────────────────────────────────────────

    def get_user_option_ids(self, address: str) -> List[int]:
        """Get all on-chain option IDs a trader has written or purchased"""
        if not self.is_valid_address(address):
            raise ValueError("Invalid Ethereum address")
        if not self.options_contract:
            return []
        try:
            checksum = self.w3.to_checksum_address(address)
            return list(self.options_contract.functions.getUserOptions(checksum).call())
        except (ContractLogicError, Web3Exception) as e:
            logger.error(f"Contract error fetching options for {address}: {e}")
            raise Exception(f"Failed to fetch options: {str(e)}")

    def get_option(self, option_id: int) -> Optional[Dict[str, Any]]:
        """Fetch a single on-chain option's full details"""
        if not self.options_contract:
            return None
        try:
            opt = self.options_contract.functions.getOption(option_id).call()
            (
                opt_id,
                writer,
                holder,
                opt_type,
                opt_style,
                strike_price,
                premium,
                expiration_time,
                collateral,
                status,
                underlying_asset,
                contract_size,
                creation_time,
                risk_hash,
            ) = opt
            return {
                "option_id": opt_id,
                "writer": writer,
                "holder": holder,
                "option_type": _OPTION_TYPE[opt_type],
                "option_style": _OPTION_STYLE[opt_style],
                "strike_price": strike_price,
                "premium": Decimal(premium) / Decimal(10**18),
                "expiration_time": expiration_time,
                "collateral": Decimal(collateral) / Decimal(10**18),
                "status": _OPTION_STATUS[status],
                "underlying_asset": underlying_asset,
                "contract_size": Decimal(contract_size) / Decimal(10**18),
                "creation_time": creation_time,
            }
        except (ContractLogicError, Web3Exception) as e:
            logger.error(f"Contract error fetching option {option_id}: {e}")
            raise Exception(f"Failed to fetch option: {str(e)}")

    # ── Options: unsigned transaction builders ──────────────────────────

    def build_purchase_option_tx(
        self, buyer_address: str, option_id: int
    ) -> Dict[str, Any]:
        """Build an unsigned purchaseOption transaction for the buyer to sign"""
        if not self.options_contract:
            raise Exception("Options contract not configured")
        if not self.is_valid_address(buyer_address):
            raise ValueError("Invalid buyer address")

        option = self.get_option(option_id)
        if option is None:
            raise ValueError(f"Option {option_id} not found")

        premium_wei = int(option["premium"] * Decimal(10**18))
        is_native = option["underlying_asset"].lower() == ZERO_ADDRESS
        checksum_buyer = self.w3.to_checksum_address(buyer_address)

        fn = self.options_contract.functions.purchaseOption(option_id)
        return self._build_tx(fn, checksum_buyer, premium_wei if is_native else 0)

    def build_exercise_option_tx(
        self, holder_address: str, option_id: int
    ) -> Dict[str, Any]:
        """Build an unsigned exerciseOption transaction for the holder to sign"""
        if not self.options_contract:
            raise Exception("Options contract not configured")
        if not self.is_valid_address(holder_address):
            raise ValueError("Invalid holder address")

        checksum_holder = self.w3.to_checksum_address(holder_address)
        fn = self.options_contract.functions.exerciseOption(option_id)
        return self._build_tx(fn, checksum_holder)

    # ── Shared ────────────────────────────────────────────────────────────

    def get_transaction_status(self, tx_hash: str) -> Dict[str, Any]:
        """Get detailed status of a submitted blockchain transaction"""
        if not self.is_connected():
            return {
                "hash": tx_hash,
                "status": "disconnected",
                "error": "Blockchain connection not available",
            }
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            if receipt is None:
                return {"hash": tx_hash, "status": "pending"}
            transaction = self.w3.eth.get_transaction(tx_hash)
            status = "success" if receipt.status == 1 else "failed"
            return {
                "hash": tx_hash,
                "status": status,
                "block_number": receipt.blockNumber,
                "gas_used": receipt.gasUsed,
                "gas_price": transaction.gasPrice,
                "confirmations": self.w3.eth.block_number - receipt.blockNumber,
            }
        except Exception as e:
            logger.error(f"Error fetching transaction status for {tx_hash}: {e}")
            return {"hash": tx_hash, "status": "error", "error": str(e)}

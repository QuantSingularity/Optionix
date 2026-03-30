"""
Financial calculation service for Optionix platform.
Provides accurate financial calculations meeting industry standards.
"""

import logging
import math
from decimal import ROUND_HALF_UP, Decimal, getcontext
from typing import Any, Dict, Optional
from ..config import settings

getcontext().prec = 28
logger = logging.getLogger(__name__)


class FinancialCalculationService:
    """Service for accurate financial calculations and risk management"""

    def __init__(self) -> None:
        """Initialize financial calculation service"""
        self.risk_free_rate = Decimal("0.02")
        self.trading_days_per_year = 252

    def calculate_liquidation_price(
        self,
        entry_price: Decimal,
        position_size: Decimal,
        is_long: bool,
        initial_margin: Decimal,
        maintenance_margin_ratio: Decimal = Decimal("0.05"),
    ) -> Decimal:
        """
        Calculate liquidation price for a leveraged position

        Args:
            entry_price (Decimal): Entry price of the position
            position_size (Decimal): Size of the position
            is_long (bool): True for long position, False for short
            initial_margin (Decimal): Initial margin posted
            maintenance_margin_ratio (Decimal): Maintenance margin ratio (default 5%)

        Returns:
            Decimal: Liquidation price
        """
        try:
            position_value = entry_price * position_size
            maintenance_margin = position_value * maintenance_margin_ratio
            max_loss = initial_margin - maintenance_margin
            if is_long:
                liquidation_price = entry_price - max_loss / position_size
            else:
                liquidation_price = entry_price + max_loss / position_size
            if liquidation_price <= 0:
                liquidation_price = Decimal("0.01")
            return liquidation_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating liquidation price: {e}")
            raise ValueError(f"Liquidation price calculation failed: {str(e)}")

    def calculate_margin_requirement(
        self,
        position_value: Decimal,
        leverage: Decimal = Decimal("10"),
        margin_rate: Optional[Decimal] = None,
    ) -> Decimal:
        """
        Calculate margin requirement for a position

        Args:
            position_value (Decimal): Total value of the position
            leverage (Decimal): Leverage ratio (default 10x)
            margin_rate (Optional[Decimal]): Custom margin rate

        Returns:
            Decimal: Required margin amount
        """
        try:
            if margin_rate is not None:
                margin_requirement = position_value * margin_rate
            else:
                margin_requirement = position_value / leverage
            return margin_requirement.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating margin requirement: {e}")
            raise ValueError(f"Margin calculation failed: {str(e)}")

    def calculate_unrealized_pnl(
        self,
        entry_price: Decimal,
        current_price: Decimal,
        position_size: Decimal,
        is_long: bool,
    ) -> Decimal:
        """
        Calculate unrealized profit and loss

        Args:
            entry_price (Decimal): Entry price of the position
            current_price (Decimal): Current market price
            position_size (Decimal): Size of the position
            is_long (bool): True for long position, False for short

        Returns:
            Decimal: Unrealized PnL
        """
        try:
            price_diff = current_price - entry_price
            if not is_long:
                price_diff = -price_diff
            unrealized_pnl = price_diff * position_size
            return unrealized_pnl.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating unrealized PnL: {e}")
            raise ValueError(f"PnL calculation failed: {str(e)}")

    def calculate_position_health_ratio(
        self,
        account_balance: Decimal,
        unrealized_pnl: Decimal,
        margin_requirement: Decimal,
    ) -> Decimal:
        """
        Calculate position health ratio

        Args:
            account_balance (Decimal): Account balance
            unrealized_pnl (Decimal): Unrealized profit/loss
            margin_requirement (Decimal): Required margin

        Returns:
            Decimal: Health ratio (higher is better)
        """
        try:
            equity = account_balance + unrealized_pnl
            if margin_requirement <= 0:
                return Decimal("999.99")
            health_ratio = equity / margin_requirement
            return health_ratio.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating health ratio: {e}")
            raise ValueError(f"Health ratio calculation failed: {str(e)}")

    def calculate_trading_fees(
        self,
        trade_value: Decimal,
        fee_rate: Decimal = Decimal("0.001"),
        is_maker: bool = False,
    ) -> Decimal:
        """
        Calculate trading fees

        Args:
            trade_value (Decimal): Total value of the trade
            fee_rate (Decimal): Fee rate (default 0.1%)
            is_maker (bool): True if maker order (may have lower fees)

        Returns:
            Decimal: Trading fee amount
        """
        try:
            if is_maker:
                effective_fee_rate = fee_rate * Decimal("0.5")
            else:
                effective_fee_rate = fee_rate
            fee = trade_value * effective_fee_rate
            return fee.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating trading fees: {e}")
            raise ValueError(f"Fee calculation failed: {str(e)}")

    def calculate_option_greeks(
        self,
        spot_price: Decimal,
        strike_price: Decimal,
        time_to_expiry: Decimal,
        volatility: Decimal,
        risk_free_rate: Optional[Decimal] = None,
        is_call: bool = True,
    ) -> Dict[str, Decimal]:
        """
        Calculate option Greeks using Black-Scholes model

        Args:
            spot_price (Decimal): Current price of underlying
            strike_price (Decimal): Strike price of option
            time_to_expiry (Decimal): Time to expiry in years
            volatility (Decimal): Implied volatility
            risk_free_rate (Optional[Decimal]): Risk-free rate
            is_call (bool): True for call option, False for put

        Returns:
            Dict[str, Decimal]: Dictionary containing Greeks
        """
        try:
            if risk_free_rate is None:
                risk_free_rate = self.risk_free_rate
            S = float(spot_price)
            K = float(strike_price)
            T = float(time_to_expiry)
            sigma = float(volatility)
            r = float(risk_free_rate)
            d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
            d2 = d1 - sigma * math.sqrt(T)
            from scipy.stats import norm

            N_d1 = norm.cdf(d1)
            N_d2 = norm.cdf(d2)
            n_d1 = norm.pdf(d1)
            if is_call:
                delta = N_d1
                theta = (
                    -S * n_d1 * sigma / (2 * math.sqrt(T))
                    - r * K * math.exp(-r * T) * N_d2
                ) / 365
            else:
                delta = N_d1 - 1
                theta = (
                    -S * n_d1 * sigma / (2 * math.sqrt(T))
                    + r * K * math.exp(-r * T) * (1 - N_d2)
                ) / 365
            gamma = n_d1 / (S * sigma * math.sqrt(T))
            vega = S * n_d1 * math.sqrt(T) / 100
            if is_call:
                rho = K * T * math.exp(-r * T) * N_d2 / 100
            else:
                rho = -K * T * math.exp(-r * T) * (1 - N_d2) / 100
            return {
                "delta": Decimal(str(delta)).quantize(Decimal("0.0001")),
                "gamma": Decimal(str(gamma)).quantize(Decimal("0.0001")),
                "theta": Decimal(str(theta)).quantize(Decimal("0.01")),
                "vega": Decimal(str(vega)).quantize(Decimal("0.01")),
                "rho": Decimal(str(rho)).quantize(Decimal("0.01")),
            }
        except Exception as e:
            logger.error(f"Error calculating option Greeks: {e}")
            raise ValueError(f"Greeks calculation failed: {str(e)}")

    def calculate_black_scholes_price(
        self,
        spot_price: Decimal,
        strike_price: Decimal,
        time_to_expiry: Decimal,
        volatility: Decimal,
        risk_free_rate: Optional[Decimal] = None,
        is_call: bool = True,
    ) -> Decimal:
        """
        Calculate option price using Black-Scholes model

        Args:
            spot_price (Decimal): Current price of underlying
            strike_price (Decimal): Strike price of option
            time_to_expiry (Decimal): Time to expiry in years
            volatility (Decimal): Implied volatility
            risk_free_rate (Optional[Decimal]): Risk-free rate
            is_call (bool): True for call option, False for put

        Returns:
            Decimal: Option price
        """
        try:
            if risk_free_rate is None:
                risk_free_rate = self.risk_free_rate
            S = float(spot_price)
            K = float(strike_price)
            T = float(time_to_expiry)
            sigma = float(volatility)
            r = float(risk_free_rate)
            d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
            d2 = d1 - sigma * math.sqrt(T)
            from scipy.stats import norm

            N_d1 = norm.cdf(d1)
            N_d2 = norm.cdf(d2)
            if is_call:
                price = S * N_d1 - K * math.exp(-r * T) * N_d2
            else:
                price = K * math.exp(-r * T) * (1 - N_d2) - S * (1 - N_d1)
            return Decimal(str(price)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating Black-Scholes price: {e}")
            raise ValueError(f"Option pricing failed: {str(e)}")

    def calculate_var(
        self,
        portfolio_value: Decimal,
        volatility: Decimal,
        confidence_level: Decimal = Decimal("0.95"),
        time_horizon: int = 1,
    ) -> Decimal:
        """
        Calculate Value at Risk (VaR)

        Args:
            portfolio_value (Decimal): Total portfolio value
            volatility (Decimal): Portfolio volatility (annual)
            confidence_level (Decimal): Confidence level (default 95%)
            time_horizon (int): Time horizon in days

        Returns:
            Decimal: VaR amount
        """
        try:
            from scipy.stats import norm

            daily_volatility = volatility / Decimal(
                str(math.sqrt(self.trading_days_per_year))
            )
            horizon_volatility = daily_volatility * Decimal(
                str(math.sqrt(time_horizon))
            )
            alpha = 1 - confidence_level
            z_score = Decimal(str(norm.ppf(float(alpha))))
            var = portfolio_value * horizon_volatility * abs(z_score)
            return var.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        except Exception as e:
            logger.error(f"Error calculating VaR: {e}")
            raise ValueError(f"VaR calculation failed: {str(e)}")

    def validate_position_limits(
        self, position_size: Decimal, position_value: Decimal, account_balance: Decimal
    ) -> Dict[str, Any]:
        """
        Validate position against risk limits

        Args:
            position_size (Decimal): Size of the position
            position_value (Decimal): Total value of the position
            account_balance (Decimal): Account balance

        Returns:
            Dict[str, Any]: Validation results
        """
        try:
            violations = []
            if position_value > Decimal(str(settings.max_position_size)):
                violations.append(
                    f"Position value {position_value} exceeds maximum {settings.max_position_size}"
                )
            if position_value < Decimal(str(settings.min_position_size)):
                violations.append(
                    f"Position value {position_value} below minimum {settings.min_position_size}"
                )
            if position_value > account_balance * Decimal("10"):
                violations.append("Position value exceeds 10x account balance")
            required_margin = self.calculate_margin_requirement(position_value)
            if required_margin > account_balance:
                violations.append("Insufficient balance for margin requirement")
            return {
                "valid": len(violations) == 0,
                "violations": violations,
                "required_margin": required_margin,
                "max_position_value": min(
                    Decimal(str(settings.max_position_size)),
                    account_balance * Decimal("10"),
                ),
            }
        except Exception as e:
            logger.error(f"Error validating position limits: {e}")
            return {
                "valid": False,
                "violations": [f"Validation error: {str(e)}"],
                "required_margin": Decimal("0"),
                "max_position_value": Decimal("0"),
            }

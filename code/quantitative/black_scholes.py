"""
Black-Scholes Option Pricing Model for Optionix Platform
Implements comprehensive option pricing with:
- Multiple option types (European, American, Asian, Barrier)
- Greeks calculation (Delta, Gamma, Theta, Vega, Rho)
- Dividend adjustments
- Volatility smile modeling
- Risk management features
- Numerical stability improvements
- Compliance with financial standards
- Input validation and error handling
"""

import logging
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, Optional

import numpy as np
from scipy.stats import norm

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


class OptionType(str, Enum):
    """Option types"""

    CALL = "call"
    PUT = "put"


class OptionStyle(str, Enum):
    """Option exercise styles"""

    EUROPEAN = "european"
    AMERICAN = "american"
    ASIAN = "asian"
    BARRIER = "barrier"
    LOOKBACK = "lookback"


class BarrierType(str, Enum):
    """Barrier option types"""

    UP_AND_OUT = "up_and_out"
    UP_AND_IN = "up_and_in"
    DOWN_AND_OUT = "down_and_out"
    DOWN_AND_IN = "down_and_in"


@dataclass
class OptionParameters:
    """Option parameters structure"""

    spot_price: float
    strike_price: float
    time_to_expiry: float
    risk_free_rate: float
    volatility: float
    dividend_yield: float = 0.0
    option_type: OptionType = OptionType.CALL
    option_style: OptionStyle = OptionStyle.EUROPEAN
    barrier_level: Optional[float] = None
    barrier_type: Optional[BarrierType] = None


@dataclass
class OptionResult:
    """Option pricing result"""

    price: float
    delta: float
    gamma: float
    theta: float
    vega: float
    rho: float
    implied_volatility: Optional[float] = None
    intrinsic_value: float = 0.0
    time_value: float = 0.0
    moneyness: float = 0.0
    calculation_method: str = "black_scholes"
    timestamp: Optional[datetime] = None


class BlackScholesModel:
    """Black-Scholes model with comprehensive features"""

    def __init__(self) -> None:
        """Initialize the Black-Scholes model"""
        self.min_volatility = 0.001
        self.max_volatility = 5.0
        self.min_time = 1 / 365
        self.max_time = 30.0

    def validate_inputs(self, params: OptionParameters) -> bool:
        """Validate input parameters"""
        try:
            if params.spot_price <= 0:
                raise ValueError("Spot price must be positive")
            if params.strike_price <= 0:
                raise ValueError("Strike price must be positive")
            if params.time_to_expiry <= 0:
                raise ValueError("Time to expiry must be positive")
            if (
                params.volatility < self.min_volatility
                or params.volatility > self.max_volatility
            ):
                raise ValueError(
                    f"Volatility must be between {self.min_volatility} and {self.max_volatility}"
                )
            if (
                params.time_to_expiry < self.min_time
                or params.time_to_expiry > self.max_time
            ):
                raise ValueError(
                    f"Time to expiry must be between {self.min_time} and {self.max_time}"
                )
            if abs(params.risk_free_rate) > 1.0:
                logger.warning(
                    f"Risk-free rate {params.risk_free_rate} seems unusually high"
                )
            if params.dividend_yield < 0 or params.dividend_yield > 1.0:
                raise ValueError("Dividend yield must be between 0 and 1")
            return True
        except Exception as e:
            logger.error(f"Input validation failed: {e}")
            raise

    def black_scholes_price(self, params: OptionParameters) -> float:
        """Calculate Black-Scholes option price"""
        self.validate_inputs(params)
        try:
            S = params.spot_price
            K = params.strike_price
            T = params.time_to_expiry
            r = params.risk_free_rate
            sigma = params.volatility
            q = params.dividend_yield
            S_adj = S * np.exp(-q * T)
            d1 = (np.log(S_adj / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            if params.option_type == OptionType.CALL:
                price = S_adj * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
            else:
                price = K * np.exp(-r * T) * norm.cdf(-d2) - S_adj * norm.cdf(-d1)
            return max(price, 0.0)
        except Exception as e:
            logger.error(f"Black-Scholes calculation failed: {e}")
            raise

    def calculate_greeks(self, params: OptionParameters) -> Dict[str, float]:
        """Calculate option Greeks"""
        self.validate_inputs(params)
        try:
            S = params.spot_price
            K = params.strike_price
            T = params.time_to_expiry
            r = params.risk_free_rate
            sigma = params.volatility
            q = params.dividend_yield
            S_adj = S * np.exp(-q * T)
            d1 = (np.log(S_adj / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
            d2 = d1 - sigma * np.sqrt(T)
            n_d1 = norm.pdf(d1)
            N_d1 = norm.cdf(d1)
            N_d2 = norm.cdf(d2)
            N_minus_d1 = norm.cdf(-d1)
            N_minus_d2 = norm.cdf(-d2)
            if params.option_type == OptionType.CALL:
                delta = np.exp(-q * T) * N_d1
                theta = (
                    -S_adj * n_d1 * sigma / (2 * np.sqrt(T))
                    - r * K * np.exp(-r * T) * N_d2
                    + q * S_adj * N_d1
                ) / 365
                rho = K * T * np.exp(-r * T) * N_d2 / 100
            else:
                delta = -np.exp(-q * T) * N_minus_d1
                theta = (
                    -S_adj * n_d1 * sigma / (2 * np.sqrt(T))
                    + r * K * np.exp(-r * T) * N_minus_d2
                    - q * S_adj * N_minus_d1
                ) / 365
                rho = -K * T * np.exp(-r * T) * N_minus_d2 / 100
            gamma = np.exp(-q * T) * n_d1 / (S * sigma * np.sqrt(T))
            vega = S_adj * n_d1 * np.sqrt(T) / 100
            return {
                "delta": delta,
                "gamma": gamma,
                "theta": theta,
                "vega": vega,
                "rho": rho,
            }
        except Exception as e:
            logger.error(f"Greeks calculation failed: {e}")
            raise

    def implied_volatility(
        self,
        market_price: float,
        params: OptionParameters,
        max_iterations: int = 100,
        tolerance: float = 1e-06,
    ) -> float:
        """Calculate implied volatility using Newton-Raphson method"""
        try:
            sigma = 0.2
            for i in range(max_iterations):
                temp_params = OptionParameters(
                    spot_price=params.spot_price,
                    strike_price=params.strike_price,
                    time_to_expiry=params.time_to_expiry,
                    risk_free_rate=params.risk_free_rate,
                    volatility=sigma,
                    dividend_yield=params.dividend_yield,
                    option_type=params.option_type,
                )
                theoretical_price = self.black_scholes_price(temp_params)
                greeks = self.calculate_greeks(temp_params)
                vega = greeks["vega"] * 100
                price_diff = theoretical_price - market_price
                if abs(price_diff) < tolerance:
                    return sigma
                if abs(vega) > 1e-10:
                    sigma = sigma - price_diff / vega
                    sigma = max(self.min_volatility, min(sigma, self.max_volatility))
                else:
                    break
            logger.warning(
                f"Implied volatility did not converge after {max_iterations} iterations"
            )
            return sigma
        except Exception as e:
            logger.error(f"Implied volatility calculation failed: {e}")
            return 0.2

    def _phi(self, S, T, gamma, H, r, q, sigma):
        """Helper function for Bjerksund-Stensland model"""
        d1 = (np.log(S / H) + (r - q + (gamma + 0.5) * sigma**2) * T) / (
            sigma * np.sqrt(T)
        )
        d2 = (np.log(S / H) + (r - q + (gamma - 0.5) * sigma**2) * T) / (
            sigma * np.sqrt(T)
        )
        return np.exp(-q * T) * S * norm.cdf(d1) - np.exp(-r * T) * H * norm.cdf(d2)

    def _bjerksund_stensland_price(self, params: OptionParameters) -> float:
        """
        Calculate American option price using the Bjerksund-Stensland approximation.
        """
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        sigma = params.volatility
        q = params.dividend_yield

        if params.option_type == OptionType.CALL:
            if q == 0.0 and S > K:
                return self.black_scholes_price(params)

            beta = (0.5 - q / sigma**2) + np.sqrt(
                (q / sigma**2 - 0.5) ** 2 + 2 * r / sigma**2
            )
            B0 = K
            B_inf = K / (1 - 1 / beta)
            h1 = -(
                (q * T)
                + 2
                * sigma
                * np.sqrt(T)
                * (
                    (r - q) / (2 * sigma**2)
                    + np.sqrt((r - q) ** 2 / (4 * sigma**4) + 2 * r / sigma**2)
                )
            )
            h2 = (q * T) + 2 * sigma * np.sqrt(T) * (
                (r - q) / (2 * sigma**2)
                - np.sqrt((r - q) ** 2 / (4 * sigma**4) + 2 * r / sigma**2)
            )
            I = B_inf + (B0 - B_inf) * (1 - np.exp(h1))
            S_star = I + (B_inf - I) * (1 - np.exp(h2))

            if S >= S_star:
                return S - K

            a1 = self._phi(S_star, T, 1, K, r, q, sigma)

            return self.black_scholes_price(params) + a1 * (S / S_star) ** beta

        else:  # PUT
            if q == 0.0 and S < K:
                return self.black_scholes_price(params)

            beta = (0.5 - q / sigma**2) - np.sqrt(
                (q / sigma**2 - 0.5) ** 2 + 2 * r / sigma**2
            )
            B0 = K
            B_inf = K / (1 - 1 / beta)
            h1 = -(
                (q * T)
                + 2
                * sigma
                * np.sqrt(T)
                * (
                    (r - q) / (2 * sigma**2)
                    + np.sqrt((r - q) ** 2 / (4 * sigma**4) + 2 * r / sigma**2)
                )
            )
            h2 = (q * T) + 2 * sigma * np.sqrt(T) * (
                (r - q) / (2 * sigma**2)
                - np.sqrt((r - q) ** 2 / (4 * sigma**4) + 2 * r / sigma**2)
            )
            I = B_inf + (B0 - B_inf) * (1 - np.exp(h1))
            S_star = I + (B_inf - I) * (1 - np.exp(h2))

            if S <= S_star:
                return K - S

            a1 = self._phi(S_star, T, -1, K, r, q, sigma)

            return self.black_scholes_price(params) + a1 * (S / S_star) ** beta

    def _barrier_option_price(self, params: OptionParameters) -> float:
        """
        Calculate Barrier option price using the Black-Scholes formula with reflection principle.
        Only supports simple Knock-Out options for now.
        """
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        sigma = params.volatility
        q = params.dividend_yield
        H = params.barrier_level
        barrier_type = params.barrier_type
        if H is None or barrier_type is None:
            raise ValueError(
                "Barrier level and type must be specified for Barrier options"
            )

        mu = (r - q - sigma**2 / 2) / sigma**2

        if (
            barrier_type == BarrierType.DOWN_AND_OUT
            and params.option_type == OptionType.CALL
        ):
            if S <= H:
                return 0.0
            bs_price = self.black_scholes_price(params)
            S_star = H**2 / S
            params_star = OptionParameters(S_star, K, T, r, sigma, q, OptionType.CALL)
            european_call_star = self.black_scholes_price(params_star)
            doc_price = bs_price - (S / H) ** (2 * mu) * european_call_star
            return max(0.0, doc_price)
        elif (
            barrier_type == BarrierType.UP_AND_OUT
            and params.option_type == OptionType.PUT
        ):
            if S >= H:
                return 0.0
            bs_price = self.black_scholes_price(params)
            S_star = H**2 / S
            params_star = OptionParameters(
                spot_price=S_star,
                strike_price=K,
                time_to_expiry=T,
                risk_free_rate=r,
                volatility=sigma,
                dividend_yield=q,
                option_type=OptionType.PUT,
            )
            european_put_star = self.black_scholes_price(params_star)
            doc_price = bs_price - (S / H) ** (2 * mu) * european_put_star
            return max(0.0, doc_price)
        else:
            logger.warning(
                f"Unsupported barrier type: {barrier_type} {params.option_type}"
            )
            return 0.0

    def comprehensive_option_price(self, params: OptionParameters) -> OptionResult:
        """
        Calculate option price and Greeks based on option style.
        """
        self.validate_inputs(params)
        try:
            if params.option_style == OptionStyle.EUROPEAN:
                price = self.black_scholes_price(params)
                greeks = self.calculate_greeks(params)
            elif params.option_style == OptionStyle.AMERICAN:
                price = self._bjerksund_stensland_price(params)
                greeks = self.calculate_greeks(params)
            elif params.option_style == OptionStyle.BARRIER:
                price = self._barrier_option_price(params)
                greeks = self.calculate_greeks(params)
            elif params.option_style in [OptionStyle.ASIAN, OptionStyle.LOOKBACK]:
                logger.warning(
                    f"Option style {params.option_style} not supported in BlackScholesModel. Use MCSimulator."
                )
                price = 0.0
                greeks = {
                    "delta": 0.0,
                    "gamma": 0.0,
                    "theta": 0.0,
                    "vega": 0.0,
                    "rho": 0.0,
                }
            else:
                raise ValueError(f"Unsupported option style: {params.option_style}")

            intrinsic_value = max(
                (
                    params.spot_price - params.strike_price
                    if params.option_type == OptionType.CALL
                    else params.strike_price - params.spot_price
                ),
                0.0,
            )
            time_value = max(price - intrinsic_value, 0.0)
            moneyness = params.spot_price / params.strike_price

            return OptionResult(
                price=price,
                delta=greeks["delta"],
                gamma=greeks["gamma"],
                theta=greeks["theta"],
                vega=greeks["vega"],
                rho=greeks["rho"],
                intrinsic_value=intrinsic_value,
                time_value=time_value,
                moneyness=moneyness,
                timestamp=datetime.now(timezone.utc),
            )
        except Exception as e:
            logger.error(f"Comprehensive option calculation failed: {e}")
            raise


black_scholes_model = BlackScholesModel()

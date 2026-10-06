import logging
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from enum import Enum
from typing import Callable, Dict, Optional, Union

import numpy as np
from scipy.optimize import brentq
from scipy.special import ndtr

logger = logging.getLogger(__name__)

ArrayLike = Union[float, np.ndarray]


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class OptionStyle(str, Enum):
    EUROPEAN = "european"
    AMERICAN = "american"
    ASIAN = "asian"
    BARRIER = "barrier"
    LOOKBACK = "lookback"


class BarrierType(str, Enum):
    UP_AND_OUT = "up_and_out"
    UP_AND_IN = "up_and_in"
    DOWN_AND_OUT = "down_and_out"
    DOWN_AND_IN = "down_and_in"


@dataclass
class OptionParameters:
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


def _as_option_type(option_type: Union[str, OptionType]) -> OptionType:
    return OptionType(str(getattr(option_type, "value", option_type)).lower())


def bs_price(
    spot: ArrayLike,
    strike: ArrayLike,
    time_to_expiry: ArrayLike,
    rate: ArrayLike,
    volatility: ArrayLike,
    dividend: ArrayLike = 0.0,
    option_type: Union[str, OptionType] = OptionType.CALL,
) -> ArrayLike:
    S = np.asarray(spot, dtype=float)
    K = np.asarray(strike, dtype=float)
    T = np.asarray(time_to_expiry, dtype=float)
    r = np.asarray(rate, dtype=float)
    sigma = np.asarray(volatility, dtype=float)
    q = np.asarray(dividend, dtype=float)
    is_call = _as_option_type(option_type) == OptionType.CALL
    forward_disc = S * np.exp(-q * T)
    strike_disc = K * np.exp(-r * T)
    with np.errstate(divide="ignore", invalid="ignore"):
        vol_sqrt_t = sigma * np.sqrt(T)
        d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / vol_sqrt_t
        d2 = d1 - vol_sqrt_t
    if is_call:
        price = forward_disc * ndtr(d1) - strike_disc * ndtr(d2)
        intrinsic = np.maximum(forward_disc - strike_disc, 0.0)
    else:
        price = strike_disc * ndtr(-d2) - forward_disc * ndtr(-d1)
        intrinsic = np.maximum(strike_disc - forward_disc, 0.0)
    degenerate = (vol_sqrt_t <= 0) | ~np.isfinite(vol_sqrt_t)
    price = np.where(degenerate, intrinsic, price)
    price = np.maximum(price, 0.0)
    return float(price) if price.ndim == 0 else price


def bs_vega(
    spot: ArrayLike,
    strike: ArrayLike,
    time_to_expiry: ArrayLike,
    rate: ArrayLike,
    volatility: ArrayLike,
    dividend: ArrayLike = 0.0,
) -> ArrayLike:
    S = np.asarray(spot, dtype=float)
    K = np.asarray(strike, dtype=float)
    T = np.asarray(time_to_expiry, dtype=float)
    sigma = np.asarray(volatility, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        d1 = (
            np.log(S / K)
            + (np.asarray(rate, dtype=float) - np.asarray(dividend, dtype=float)) * T
            + 0.5 * sigma**2 * T
        ) / (sigma * np.sqrt(T))
    pdf = np.exp(-0.5 * d1**2) / np.sqrt(2.0 * np.pi)
    vega = S * np.exp(-np.asarray(dividend, dtype=float) * T) * pdf * np.sqrt(T)
    vega = np.where(np.isfinite(vega), vega, 0.0)
    return float(vega) if vega.ndim == 0 else vega


def implied_volatility_from_price(
    market_price: float,
    spot: float,
    strike: float,
    time_to_expiry: float,
    rate: float,
    dividend: float = 0.0,
    option_type: Union[str, OptionType] = OptionType.CALL,
    min_volatility: float = 1e-4,
    max_volatility: float = 10.0,
    tolerance: float = 1e-10,
) -> float:
    if market_price <= 0 or spot <= 0 or strike <= 0 or time_to_expiry <= 0:
        raise ValueError("Price, spot, strike and time to expiry must be positive")
    lower = bs_price(
        spot, strike, time_to_expiry, rate, min_volatility, dividend, option_type
    )
    upper = bs_price(
        spot, strike, time_to_expiry, rate, max_volatility, dividend, option_type
    )
    if market_price < lower - 1e-12 or market_price > upper + 1e-12:
        raise ValueError(
            "Market price is outside the range attainable by the Black-Scholes model"
        )

    def objective(sigma: float) -> float:
        return (
            bs_price(spot, strike, time_to_expiry, rate, sigma, dividend, option_type)
            - market_price
        )

    if abs(objective(min_volatility)) <= 1e-12:
        return float(min_volatility)
    return float(
        brentq(objective, min_volatility, max_volatility, xtol=tolerance, maxiter=200)
    )


class BlackScholesModel:
    def __init__(self) -> None:
        self.min_volatility = 0.001
        self.max_volatility = 5.0
        self.min_time = 1e-6
        self.max_time = 30.0
        self.binomial_steps = 500

    def validate_inputs(self, params: OptionParameters) -> bool:
        if params.spot_price <= 0:
            raise ValueError("Spot price must be positive")
        if params.strike_price <= 0:
            raise ValueError("Strike price must be positive")
        if params.time_to_expiry <= 0:
            raise ValueError("Time to expiry must be positive")
        if not self.min_volatility <= params.volatility <= self.max_volatility:
            raise ValueError(
                f"Volatility must be between {self.min_volatility} and {self.max_volatility}"
            )
        if not self.min_time <= params.time_to_expiry <= self.max_time:
            raise ValueError(
                f"Time to expiry must be between {self.min_time} and {self.max_time}"
            )
        if abs(params.risk_free_rate) > 1.0:
            logger.warning("Risk-free rate %s is unusually high", params.risk_free_rate)
        if not 0.0 <= params.dividend_yield <= 1.0:
            raise ValueError("Dividend yield must be between 0 and 1")
        return True

    def _d1_d2(self, params: OptionParameters):
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        q = params.dividend_yield
        sigma = params.volatility
        d1 = (np.log(S / K) + (r - q + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
        return d1, d1 - sigma * np.sqrt(T)

    def black_scholes_price(self, params: OptionParameters) -> float:
        self.validate_inputs(params)
        return float(
            bs_price(
                params.spot_price,
                params.strike_price,
                params.time_to_expiry,
                params.risk_free_rate,
                params.volatility,
                params.dividend_yield,
                params.option_type,
            )
        )

    def calculate_greeks(self, params: OptionParameters) -> Dict[str, float]:
        self.validate_inputs(params)
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        q = params.dividend_yield
        sigma = params.volatility
        sqrt_t = np.sqrt(T)
        d1, d2 = self._d1_d2(params)
        pdf_d1 = float(np.exp(-0.5 * d1**2) / np.sqrt(2.0 * np.pi))
        disc_q = np.exp(-q * T)
        disc_r = np.exp(-r * T)
        gamma = disc_q * pdf_d1 / (S * sigma * sqrt_t)
        vega = S * disc_q * pdf_d1 * sqrt_t / 100.0
        decay = -S * disc_q * pdf_d1 * sigma / (2.0 * sqrt_t)
        if _as_option_type(params.option_type) == OptionType.CALL:
            delta = disc_q * ndtr(d1)
            theta = decay - r * K * disc_r * ndtr(d2) + q * S * disc_q * ndtr(d1)
            rho = K * T * disc_r * ndtr(d2) / 100.0
        else:
            delta = -disc_q * ndtr(-d1)
            theta = decay + r * K * disc_r * ndtr(-d2) - q * S * disc_q * ndtr(-d1)
            rho = -K * T * disc_r * ndtr(-d2) / 100.0
        return {
            "delta": float(delta),
            "gamma": float(gamma),
            "theta": float(theta / 365.0),
            "vega": float(vega),
            "rho": float(rho),
        }

    def implied_volatility(
        self,
        market_price: float,
        params: OptionParameters,
        max_iterations: int = 200,
        tolerance: float = 1e-10,
    ) -> float:
        if params.option_style == OptionStyle.AMERICAN:
            return self._american_implied_volatility(market_price, params, tolerance)
        return implied_volatility_from_price(
            market_price,
            params.spot_price,
            params.strike_price,
            params.time_to_expiry,
            params.risk_free_rate,
            params.dividend_yield,
            params.option_type,
            tolerance=tolerance,
        )

    def _american_implied_volatility(
        self, market_price: float, params: OptionParameters, tolerance: float
    ) -> float:
        def objective(sigma: float) -> float:
            return self.binomial_price(replace(params, volatility=sigma)) - market_price

        low, high = self.min_volatility, self.max_volatility
        if objective(low) > 0 or objective(high) < 0:
            raise ValueError("Market price is outside the attainable price range")
        return float(brentq(objective, low, high, xtol=max(tolerance, 1e-8)))

    def binomial_price(
        self, params: OptionParameters, steps: Optional[int] = None
    ) -> float:
        self.validate_inputs(params)
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        q = params.dividend_yield
        sigma = params.volatility
        is_call = _as_option_type(params.option_type) == OptionType.CALL
        n = int(steps or self.binomial_steps)
        drift = r - q
        while True:
            dt = T / n
            u = np.exp(sigma * np.sqrt(dt))
            d = 1.0 / u
            p = (np.exp(drift * dt) - d) / (u - d)
            if 0.0 < p < 1.0 or n >= 20000:
                break
            n = min(n * 2, 20000)
        p = float(np.clip(p, 0.0, 1.0))
        disc = np.exp(-r * dt)
        node_exponent = np.arange(n + 1)
        prices = S * np.exp(sigma * np.sqrt(dt) * (2 * node_exponent - n))
        values = np.maximum(prices - K, 0.0) if is_call else np.maximum(K - prices, 0.0)
        for step in range(n - 1, -1, -1):
            values = disc * (p * values[1 : step + 2] + (1.0 - p) * values[: step + 1])
            node_prices = S * np.exp(
                sigma * np.sqrt(dt) * (2 * node_exponent[: step + 1] - step)
            )
            exercise = (
                np.maximum(node_prices - K, 0.0)
                if is_call
                else np.maximum(K - node_prices, 0.0)
            )
            values = np.maximum(values, exercise)
        return float(values[0])

    def barrier_price(self, params: OptionParameters) -> float:
        self.validate_inputs(params)
        if params.barrier_level is None or params.barrier_type is None:
            raise ValueError(
                "Barrier level and type must be specified for barrier options"
            )
        barrier_type = BarrierType(
            str(getattr(params.barrier_type, "value", params.barrier_type))
        )
        S = params.spot_price
        K = params.strike_price
        T = params.time_to_expiry
        r = params.risk_free_rate
        q = params.dividend_yield
        sigma = params.volatility
        H = params.barrier_level
        if H <= 0:
            raise ValueError("Barrier level must be positive")
        is_call = _as_option_type(params.option_type) == OptionType.CALL
        is_up = barrier_type in (BarrierType.UP_AND_OUT, BarrierType.UP_AND_IN)
        is_out = barrier_type in (BarrierType.UP_AND_OUT, BarrierType.DOWN_AND_OUT)
        vanilla = self.black_scholes_price(params)
        breached = S >= H if is_up else S <= H
        if breached:
            return 0.0 if is_out else vanilla
        b = r - q
        phi = 1.0 if is_call else -1.0
        eta = -1.0 if is_up else 1.0
        sqrt_t = sigma * np.sqrt(T)
        mu = (b - 0.5 * sigma**2) / sigma**2
        x1 = np.log(S / K) / sqrt_t + (1.0 + mu) * sqrt_t
        x2 = np.log(S / H) / sqrt_t + (1.0 + mu) * sqrt_t
        y1 = np.log(H**2 / (S * K)) / sqrt_t + (1.0 + mu) * sqrt_t
        y2 = np.log(H / S) / sqrt_t + (1.0 + mu) * sqrt_t
        carry = np.exp((b - r) * T)
        disc = np.exp(-r * T)
        ratio = H / S
        A = phi * S * carry * ndtr(phi * x1) - phi * K * disc * ndtr(
            phi * x1 - phi * sqrt_t
        )
        B = phi * S * carry * ndtr(phi * x2) - phi * K * disc * ndtr(
            phi * x2 - phi * sqrt_t
        )
        C = phi * S * carry * ratio ** (2 * (mu + 1)) * ndtr(
            eta * y1
        ) - phi * K * disc * ratio ** (2 * mu) * ndtr(eta * y1 - eta * sqrt_t)
        D = phi * S * carry * ratio ** (2 * (mu + 1)) * ndtr(
            eta * y2
        ) - phi * K * disc * ratio ** (2 * mu) * ndtr(eta * y2 - eta * sqrt_t)
        strike_above_barrier = K >= H
        if is_call:
            if is_up:
                knock_in = A if strike_above_barrier else B - C + D
            else:
                knock_in = C if strike_above_barrier else A - B + D
        else:
            if is_up:
                knock_in = A - B + D if strike_above_barrier else C
            else:
                knock_in = B - C + D if strike_above_barrier else A
        if is_up and is_call and strike_above_barrier and is_out:
            return 0.0
        knock_in = float(max(knock_in, 0.0))
        if not is_out:
            return min(knock_in, vanilla)
        return float(max(vanilla - knock_in, 0.0))

    def _price_by_style(self, params: OptionParameters) -> float:
        style = OptionStyle(
            str(getattr(params.option_style, "value", params.option_style))
        )
        if style == OptionStyle.EUROPEAN:
            return self.black_scholes_price(params)
        if style == OptionStyle.AMERICAN:
            return self.binomial_price(params)
        if style == OptionStyle.BARRIER:
            return self.barrier_price(params)
        raise ValueError(
            f"Option style {style.value} is not supported analytically; use MCSimulator"
        )

    def _numerical_greeks(
        self, pricer: Callable[[OptionParameters], float], params: OptionParameters
    ) -> Dict[str, float]:
        S = params.spot_price
        T = params.time_to_expiry
        h = S * 0.01
        base = pricer(params)
        up = pricer(replace(params, spot_price=S + h))
        down = pricer(replace(params, spot_price=S - h))
        delta = (up - down) / (2.0 * h)
        gamma = (up - 2.0 * base + down) / h**2
        vol_step = min(0.01, params.volatility - self.min_volatility)
        vol_step = max(vol_step, 1e-4)
        vol_up = pricer(replace(params, volatility=params.volatility + vol_step))
        vol_down_value = params.volatility - vol_step
        if vol_down_value >= self.min_volatility:
            vol_down = pricer(replace(params, volatility=vol_down_value))
            vega = (vol_up - vol_down) / (2.0 * vol_step) * 0.01
        else:
            vega = (vol_up - base) / vol_step * 0.01
        time_step = min(1.0 / 365.0, T / 2.0)
        shorter = pricer(replace(params, time_to_expiry=T - time_step))
        theta = (shorter - base) / (time_step * 365.0)
        rate_up = pricer(replace(params, risk_free_rate=params.risk_free_rate + 0.005))
        rate_down = pricer(
            replace(params, risk_free_rate=params.risk_free_rate - 0.005)
        )
        rho = (rate_up - rate_down) / 0.01 * 0.01
        return {
            "delta": float(delta),
            "gamma": float(gamma),
            "theta": float(theta),
            "vega": float(vega),
            "rho": float(rho),
        }

    def comprehensive_option_price(self, params: OptionParameters) -> OptionResult:
        self.validate_inputs(params)
        style = OptionStyle(
            str(getattr(params.option_style, "value", params.option_style))
        )
        if style == OptionStyle.EUROPEAN:
            price = self.black_scholes_price(params)
            greeks = self.calculate_greeks(params)
            method = "black_scholes"
        elif style == OptionStyle.AMERICAN:
            price = self.binomial_price(params)
            greeks = self._numerical_greeks(self.binomial_price, params)
            method = "binomial_crr"
        elif style == OptionStyle.BARRIER:
            price = self.barrier_price(params)
            greeks = self._numerical_greeks(self.barrier_price, params)
            method = "barrier_analytic"
        else:
            raise ValueError(
                f"Option style {style.value} is not supported analytically; use MCSimulator"
            )
        if _as_option_type(params.option_type) == OptionType.CALL:
            intrinsic = max(params.spot_price - params.strike_price, 0.0)
        else:
            intrinsic = max(params.strike_price - params.spot_price, 0.0)
        return OptionResult(
            price=price,
            delta=greeks["delta"],
            gamma=greeks["gamma"],
            theta=greeks["theta"],
            vega=greeks["vega"],
            rho=greeks["rho"],
            intrinsic_value=intrinsic,
            time_value=max(price - intrinsic, 0.0),
            moneyness=params.spot_price / params.strike_price,
            calculation_method=method,
            timestamp=datetime.now(timezone.utc),
        )


black_scholes_model = BlackScholesModel()

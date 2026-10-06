import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.optimize import differential_evolution, least_squares

from .stochastic_volatility import SabrModel

logger = logging.getLogger(__name__)

ArrayLike = Union[float, np.ndarray, List[float]]


class InterpolationMethod(str, Enum):
    SPLINE = "spline"
    LINEAR = "linear"
    SVI = "svi"
    SABR = "sabr"


class CalibrationMethod(str, Enum):
    LEAST_SQUARES = "least_squares"
    DIFFERENTIAL_EVOLUTION = "differential_evolution"


@dataclass
class OptionData:
    strike: float
    expiry: float
    implied_volatility: float
    option_type: str = "call"
    bid: Optional[float] = None
    ask: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[int] = None
    underlying_price: Optional[float] = None
    risk_free_rate: Optional[float] = None
    dividend_yield: Optional[float] = None


@dataclass
class SurfaceParameters:
    model_type: InterpolationMethod
    parameters: Dict[str, Any]
    calibration_date: datetime
    underlying_price: float
    risk_free_rate: float
    dividend_yield: float
    rmse: float
    max_error: float
    r_squared: float


@dataclass
class ArbitrageCheck:
    calendar_arbitrage: bool
    butterfly_arbitrage: bool
    call_put_parity: bool
    violations: List[str]
    severity_score: float


@dataclass
class _Slice:
    expiry: float
    forward: float
    log_moneyness: np.ndarray
    total_variance: np.ndarray
    model: str
    params: Dict[str, float] = field(default_factory=dict)
    rmse: float = 0.0
    sabr_beta: float = 0.5

    def evaluate(self, k: np.ndarray) -> np.ndarray:
        k = np.asarray(k, dtype=float)
        if self.model == "svi":
            p = self.params
            w = p["a"] + p["b"] * (
                p["rho"] * (k - p["m"]) + np.sqrt((k - p["m"]) ** 2 + p["sigma"] ** 2)
            )
            return np.maximum(w, 1e-10)
        if self.model == "sabr":
            strikes = self.forward * np.exp(k)
            vols = SabrModel().implied_volatility(
                strikes,
                self.forward,
                self.expiry,
                {**self.params, "beta": self.sabr_beta},
            )
            return np.maximum(np.asarray(vols) ** 2 * self.expiry, 1e-10)
        x, y = self.log_moneyness, self.total_variance
        if x.size == 1:
            return np.full_like(k, y[0], dtype=float)
        if self.model == "linear":
            return np.interp(k, x, y)
        interpolator = PchipInterpolator(x, y, extrapolate=False)
        values = interpolator(k)
        values = np.where(k < x[0], y[0], values)
        values = np.where(k > x[-1], y[-1], values)
        return np.maximum(values, 1e-10)


def svi_parametric_implied_vol(
    log_moneyness: ArrayLike,
    time_to_expiry: float,
    base_volatility: float,
    skew: float = -0.4,
    curvature: float = 0.15,
    width: float = 0.2,
) -> np.ndarray:
    k = np.asarray(log_moneyness, dtype=float)
    total_atm = base_volatility**2 * time_to_expiry
    b = curvature * base_volatility * np.sqrt(time_to_expiry)
    a = total_atm - b * (skew * 0.0 + np.sqrt(width**2))
    w = a + b * (skew * k + np.sqrt(k**2 + width**2))
    return np.sqrt(np.maximum(w, 1e-8) / time_to_expiry)


class VolatilitySurface:
    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = dict(config or {})
        self.method = InterpolationMethod(self.config.get("method", "spline"))
        self.calibration_method = CalibrationMethod(
            self.config.get("calibration_method", "least_squares")
        )
        self.min_volatility = self.config.get("min_volatility", 0.01)
        self.max_volatility = self.config.get("max_volatility", 3.0)
        self.min_time_to_expiry = self.config.get("min_time_to_expiry", 1 / 365)
        self.max_time_to_expiry = self.config.get("max_time_to_expiry", 5.0)
        self.sabr_beta = self.config.get("sabr_beta", 0.5)
        self.surface_data: Optional[Dict[str, Any]] = None
        self.parameters: Optional[SurfaceParameters] = None
        self._slices: List[_Slice] = []
        self._quotes: List[OptionData] = []

    def validate_option_data(self, option_data: List[OptionData]) -> List[OptionData]:
        validated = []
        for option in option_data:
            if (
                option.strike <= 0
                or option.expiry < self.min_time_to_expiry
                or option.expiry > self.max_time_to_expiry
                or option.implied_volatility < self.min_volatility
                or option.implied_volatility > self.max_volatility
                or not np.isfinite(option.implied_volatility)
            ):
                logger.warning(
                    "Skipping invalid option: K=%s T=%s IV=%s",
                    option.strike,
                    option.expiry,
                    option.implied_volatility,
                )
                continue
            if option.bid and option.ask and option.ask > 0:
                spread = (option.ask - option.bid) / ((option.ask + option.bid) / 2.0)
                if spread > 0.5:
                    logger.warning("Wide bid-ask spread detected: %.2f%%", spread * 100)
            validated.append(option)
        return validated

    def fit_surface(
        self,
        option_data: List[OptionData],
        underlying_price: float,
        risk_free_rate: float = 0.0,
        dividend_yield: float = 0.0,
    ) -> SurfaceParameters:
        if underlying_price <= 0:
            raise ValueError("Underlying price must be positive")
        validated = self.validate_option_data(option_data)
        if len(validated) < 3:
            raise ValueError("Insufficient valid option data for surface fitting")
        self._quotes = validated
        grouped: Dict[float, List[OptionData]] = {}
        for option in validated:
            grouped.setdefault(round(float(option.expiry), 8), []).append(option)
        slices = []
        for expiry in sorted(grouped):
            rate = np.mean(
                [
                    o.risk_free_rate if o.risk_free_rate is not None else risk_free_rate
                    for o in grouped[expiry]
                ]
            )
            div = np.mean(
                [
                    o.dividend_yield if o.dividend_yield is not None else dividend_yield
                    for o in grouped[expiry]
                ]
            )
            spot = np.mean(
                [
                    (
                        o.underlying_price
                        if o.underlying_price is not None
                        else underlying_price
                    )
                    for o in grouped[expiry]
                ]
            )
            forward = float(spot * np.exp((rate - div) * expiry))
            by_strike: Dict[float, List[float]] = {}
            for o in grouped[expiry]:
                by_strike.setdefault(float(o.strike), []).append(o.implied_volatility)
            strikes = np.array(sorted(by_strike))
            ivs = np.array([np.mean(by_strike[s]) for s in strikes])
            k = np.log(strikes / forward)
            w = ivs**2 * expiry
            slices.append(self._fit_slice(expiry, forward, k, w))
        self._slices = slices
        self.surface_data = {
            "underlying_price": underlying_price,
            "risk_free_rate": risk_free_rate,
            "dividend_yield": dividend_yield,
            "strikes": np.array([q.strike for q in validated]),
            "expiries": np.array([q.expiry for q in validated]),
            "implied_volatilities": np.array([q.implied_volatility for q in validated]),
        }
        strikes = self.surface_data["strikes"]
        expiries = self.surface_data["expiries"]
        ivs = self.surface_data["implied_volatilities"]
        fitted = np.asarray(self.interpolate_volatility(strikes, expiries)).reshape(-1)
        errors = ivs - fitted
        ss_tot = float(np.sum((ivs - np.mean(ivs)) ** 2))
        r_squared = 1.0 - float(np.sum(errors**2)) / ss_tot if ss_tot > 0 else 1.0
        self.parameters = SurfaceParameters(
            model_type=self.method,
            parameters={
                "method": self.method.value,
                "slices": [
                    {
                        "expiry": s.expiry,
                        "forward": s.forward,
                        "model": s.model,
                        "params": s.params,
                        "rmse": s.rmse,
                        "num_points": int(s.log_moneyness.size),
                    }
                    for s in slices
                ],
            },
            calibration_date=datetime.now(timezone.utc),
            underlying_price=underlying_price,
            risk_free_rate=risk_free_rate,
            dividend_yield=dividend_yield,
            rmse=float(np.sqrt(np.mean(errors**2))),
            max_error=float(np.max(np.abs(errors))),
            r_squared=r_squared,
        )
        return self.parameters

    def _fit_slice(
        self, expiry: float, forward: float, k: np.ndarray, w: np.ndarray
    ) -> _Slice:
        if self.method == InterpolationMethod.SVI and k.size >= 5:
            fitted = self._fit_svi(expiry, forward, k, w)
            if fitted is not None:
                return fitted
        if self.method == InterpolationMethod.SABR and k.size >= 4:
            fitted = self._fit_sabr(expiry, forward, k, w)
            if fitted is not None:
                return fitted
        model = "linear" if self.method == InterpolationMethod.LINEAR else "spline"
        return _Slice(expiry, forward, k, w, model)

    def _fit_svi(
        self, expiry: float, forward: float, k: np.ndarray, w: np.ndarray
    ) -> Optional[_Slice]:
        w_max = float(np.max(w))
        k_lo, k_hi = float(np.min(k)) - 0.5, float(np.max(k)) + 0.5

        def model(x: np.ndarray, kk: np.ndarray) -> np.ndarray:
            a, b, rho, m, s = x
            return a + b * (rho * (kk - m) + np.sqrt((kk - m) ** 2 + s**2))

        def residuals(x: np.ndarray) -> np.ndarray:
            a, b, rho, m, s = x
            floor = a + b * s * np.sqrt(1.0 - rho**2)
            penalty = np.array([max(-floor, 0.0) * 1e3])
            return np.concatenate([(model(x, k) - w) / max(w_max, 1e-8), penalty])

        lower = [-w_max, 1e-6, -0.999, k_lo, 1e-3]
        upper = [w_max * 2.0, 10.0, 0.999, k_hi, 3.0]
        idx = int(np.argmin(w))
        starts = [
            [w[idx] * 0.5, 0.1, -0.3, k[idx], 0.1],
            [w[idx] * 0.8, 0.3, -0.6, 0.0, 0.3],
            [w[idx] * 0.2, 0.05, 0.0, k[idx], 0.05],
        ]
        best = None
        if self.calibration_method == CalibrationMethod.DIFFERENTIAL_EVOLUTION:
            result = differential_evolution(
                lambda x: float(np.sum(residuals(x) ** 2)),
                list(zip(lower, upper)),
                seed=0,
                maxiter=300,
                tol=1e-10,
                polish=False,
            )
            starts = [result.x]
        for start in starts:
            try:
                sol = least_squares(
                    residuals,
                    np.clip(start, lower, upper),
                    bounds=(lower, upper),
                    max_nfev=400,
                )
            except Exception as exc:
                logger.debug("SVI start failed: %s", exc)
                continue
            if best is None or sol.cost < best.cost:
                best = sol
        if best is None:
            return None
        a, b, rho, m, s = (float(v) for v in best.x)
        rmse_w = float(np.sqrt(np.mean((model(best.x, k) - w) ** 2)))
        return _Slice(
            expiry,
            forward,
            k,
            w,
            "svi",
            {"a": a, "b": b, "rho": rho, "m": m, "sigma": s},
            rmse_w,
        )

    def _fit_sabr(
        self, expiry: float, forward: float, k: np.ndarray, w: np.ndarray
    ) -> Optional[_Slice]:
        quotes = [
            {
                "strike": float(forward * np.exp(ki)),
                "forward": forward,
                "time_to_expiry": expiry,
                "market_vol": float(np.sqrt(wi / expiry)),
            }
            for ki, wi in zip(k, w)
        ]
        try:
            model = SabrModel(
                {"alpha": 0.3, "beta": self.sabr_beta, "rho": -0.3, "nu": 0.5}
            )
            params = model.calibrate(quotes, fix_beta=True)
        except Exception as exc:
            logger.warning("SABR slice fit failed for T=%s: %s", expiry, exc)
            return None
        return _Slice(
            expiry,
            forward,
            k,
            w,
            "sabr",
            {key: float(params[key]) for key in ("alpha", "rho", "nu")},
            float(model.calibration_info.get("rmse_volatility", 0.0)),
            sabr_beta=self.sabr_beta,
        )

    def total_variance(self, strikes: ArrayLike, expiries: ArrayLike) -> np.ndarray:
        if not self._slices or self.surface_data is None:
            raise ValueError("Surface must be fitted before interpolation")
        K, T = np.broadcast_arrays(
            np.atleast_1d(np.asarray(strikes, dtype=float)),
            np.atleast_1d(np.asarray(expiries, dtype=float)),
        )
        K = K.reshape(-1)
        T = T.reshape(-1)
        if np.any(K <= 0) or np.any(T <= 0):
            raise ValueError("Strikes and expiries must be positive")
        spot = self.surface_data["underlying_price"]
        rate = self.surface_data["risk_free_rate"]
        div = self.surface_data["dividend_yield"]
        k = np.log(K / (spot * np.exp((rate - div) * T)))
        expiries_fit = np.array([s.expiry for s in self._slices])
        slice_values = np.vstack([s.evaluate(k) for s in self._slices])
        result = np.empty_like(T)
        first, last = expiries_fit[0], expiries_fit[-1]
        before = T <= first
        after = T >= last
        result[before] = slice_values[0, before] * T[before] / first
        result[after] = slice_values[-1, after] * T[after] / last
        middle = ~(before | after)
        if np.any(middle):
            hi = np.searchsorted(expiries_fit, T[middle], side="right")
            hi = np.clip(hi, 1, len(expiries_fit) - 1)
            lo = hi - 1
            idx = np.arange(slice_values.shape[1])[middle]
            t_lo, t_hi = expiries_fit[lo], expiries_fit[hi]
            weight = (T[middle] - t_lo) / (t_hi - t_lo)
            result[middle] = (1.0 - weight) * slice_values[
                lo, idx
            ] + weight * slice_values[hi, idx]
        return result

    def interpolate_volatility(
        self, strikes: ArrayLike, expiries: ArrayLike
    ) -> Union[float, np.ndarray]:
        scalar = np.ndim(strikes) == 0 and np.ndim(expiries) == 0
        T = np.broadcast_arrays(
            np.atleast_1d(np.asarray(strikes, dtype=float)),
            np.atleast_1d(np.asarray(expiries, dtype=float)),
        )[1].reshape(-1)
        w = self.total_variance(strikes, expiries)
        vols = np.clip(
            np.sqrt(np.maximum(w, 0.0) / T), self.min_volatility, self.max_volatility
        )
        return float(vols[0]) if scalar else vols

    def implied_volatility_grid(
        self, strikes: List[float], expiries: List[float]
    ) -> np.ndarray:
        K, T = np.meshgrid(
            np.asarray(strikes, dtype=float), np.asarray(expiries, dtype=float)
        )
        flat = np.asarray(self.interpolate_volatility(K.reshape(-1), T.reshape(-1)))
        return flat.reshape(K.shape)

    def check_arbitrage(self, tolerance: float = 1e-6) -> ArbitrageCheck:
        if not self._slices or self.surface_data is None:
            raise ValueError("Surface must be fitted before arbitrage checks")
        violations: List[str] = []
        severity = 0.0
        calendar_ok = self._calendar_ok(tolerance)
        if not calendar_ok:
            violations.append("Calendar arbitrage detected")
            severity += 0.3
        butterfly_ok = self._butterfly_ok(tolerance)
        if not butterfly_ok:
            violations.append("Butterfly arbitrage detected")
            severity += 0.4
        parity_ok = self._parity_ok()
        if not parity_ok:
            violations.append("Call-put implied volatility mismatch")
            severity += 0.3
        return ArbitrageCheck(
            calendar_ok, butterfly_ok, parity_ok, violations, severity
        )

    def _calendar_ok(self, tolerance: float) -> bool:
        for earlier, later in zip(self._slices[:-1], self._slices[1:]):
            lo = max(earlier.log_moneyness.min(), later.log_moneyness.min())
            hi = min(earlier.log_moneyness.max(), later.log_moneyness.max())
            if hi <= lo:
                continue
            k = np.linspace(lo, hi, 61)
            if np.any(later.evaluate(k) < earlier.evaluate(k) - tolerance):
                return False
        return True

    def _butterfly_ok(self, tolerance: float) -> bool:
        for s in self._slices:
            lo, hi = float(s.log_moneyness.min()), float(s.log_moneyness.max())
            if hi - lo < 1e-6:
                continue
            k = np.linspace(lo, hi, 161)
            h = k[1] - k[0]
            w = s.evaluate(k)
            dw = np.gradient(w, h)
            d2w = np.gradient(dw, h)
            g = (
                (1.0 - k * dw / (2.0 * w)) ** 2
                - dw**2 / 4.0 * (1.0 / w + 0.25)
                + d2w / 2.0
            )
            if np.any(g[3:-3] < -max(tolerance, 1e-3)):
                return False
        return True

    def _parity_ok(self, tolerance: float = 0.02) -> bool:
        seen: Dict[Tuple[float, float], Dict[str, float]] = {}
        for q in self._quotes:
            key = (round(float(q.strike), 8), round(float(q.expiry), 8))
            seen.setdefault(key, {})[q.option_type.lower()] = q.implied_volatility
        for sides in seen.values():
            if "call" in sides and "put" in sides:
                if abs(sides["call"] - sides["put"]) > tolerance:
                    return False
        return True

    def get_surface_metrics(self) -> Dict[str, Any]:
        if self.parameters is None or self.surface_data is None:
            return {}
        return {
            "rmse": self.parameters.rmse,
            "max_error": self.parameters.max_error,
            "r_squared": self.parameters.r_squared,
            "num_data_points": int(len(self.surface_data["strikes"])),
            "num_expiries": len(self._slices),
            "calibration_date": self.parameters.calibration_date.isoformat(),
        }

    def export_surface(self, filepath: str) -> None:
        if self.surface_data is None:
            raise ValueError("Surface must be fitted before export")
        payload = {
            "config": self.config,
            "method": self.method.value,
            "underlying_price": self.surface_data["underlying_price"],
            "risk_free_rate": self.surface_data["risk_free_rate"],
            "dividend_yield": self.surface_data["dividend_yield"],
            "quotes": [asdict(q) for q in self._quotes],
        }
        with open(filepath, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)

    def load_surface(self, filepath: str) -> None:
        with open(filepath, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        self.config = payload.get("config", {})
        self.method = InterpolationMethod(payload["method"])
        quotes = [OptionData(**q) for q in payload["quotes"]]
        self.fit_surface(
            quotes,
            payload["underlying_price"],
            payload.get("risk_free_rate", 0.0),
            payload.get("dividend_yield", 0.0),
        )

    def plot_surface(self, save_path: Optional[str] = None) -> None:
        import matplotlib.pyplot as plt

        if self.surface_data is None:
            raise ValueError("Surface must be fitted before plotting")
        spot = self.surface_data["underlying_price"]
        strikes = np.linspace(0.7 * spot, 1.3 * spot, 30)
        expiries = np.linspace(
            float(np.min(self.surface_data["expiries"])),
            float(np.max(self.surface_data["expiries"])),
            20,
        )
        grid = self.implied_volatility_grid(strikes.tolist(), expiries.tolist())
        X, Y = np.meshgrid(strikes, expiries)
        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111, projection="3d")
        ax.plot_surface(X, Y, grid, cmap="viridis", alpha=0.8)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Time to expiry")
        ax.set_zlabel("Implied volatility")
        if save_path:
            fig.savefig(save_path, dpi=300, bbox_inches="tight")
        else:
            plt.show()

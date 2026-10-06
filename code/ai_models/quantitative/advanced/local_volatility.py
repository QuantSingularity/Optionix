import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.interpolate import RegularGridInterpolator
from scipy.optimize import least_squares
from scipy.stats import ncx2

from ..black_scholes import bs_price, implied_volatility_from_price
from .volatility_surface import OptionData, VolatilitySurface

logger = logging.getLogger(__name__)


def _expiry_to_years(expiry: Any) -> float:
    if isinstance(expiry, str):
        expiry_date = datetime.strptime(expiry, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return (expiry_date - datetime.now(timezone.utc)).total_seconds() / (
            365.0 * 86400.0
        )
    return float(expiry)


class DupireLocalVolModel:
    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = dict(config or {})
        self.default_vol = self.config.get("default_vol", 0.2)
        self.min_vol = self.config.get("min_vol", 0.01)
        self.max_vol = self.config.get("max_vol", 3.0)
        self.local_vol_surface: Optional[np.ndarray] = None
        self.strike_grid: Optional[np.ndarray] = None
        self.time_grid: Optional[np.ndarray] = None
        self.implied_surface: Optional[VolatilitySurface] = None
        self._interpolator: Optional[RegularGridInterpolator] = None
        self.spot: Optional[float] = None

    def calibrate(
        self,
        option_data: List[Dict[str, Any]],
        spot: float,
        rate: float,
        dividend: float = 0.0,
        surface_method: str = "svi",
        grid_strikes: int = 61,
        grid_times: int = 40,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        if spot <= 0:
            raise ValueError("Spot must be positive")
        quotes = []
        for option in option_data:
            T = _expiry_to_years(option["expiry"])
            if T <= 0:
                continue
            option_type = option.get("option_type", "call")
            if "implied_volatility" in option or "iv" in option:
                iv = float(option.get("implied_volatility", option.get("iv")))
            else:
                try:
                    iv = implied_volatility_from_price(
                        float(option["price"]),
                        spot,
                        float(option["strike"]),
                        T,
                        rate,
                        dividend,
                        option_type,
                    )
                except ValueError:
                    continue
            quotes.append(OptionData(float(option["strike"]), T, iv, option_type))
        if len(quotes) < 3:
            raise ValueError("At least three usable option quotes are required")
        surface = VolatilitySurface(
            {
                "method": surface_method,
                "min_volatility": 1e-3,
                "max_volatility": 5.0,
                "min_time_to_expiry": 1e-4,
                "max_time_to_expiry": 30.0,
            }
        )
        surface.fit_surface(quotes, spot, rate, dividend)
        expiries = np.array(sorted({q.expiry for q in quotes}))
        strikes_quoted = np.array([q.strike for q in quotes])
        strike_grid = np.linspace(
            0.5 * strikes_quoted.min() if strikes_quoted.min() > 0 else 1.0,
            1.5 * strikes_quoted.max(),
            grid_strikes,
        )
        strike_grid = np.unique(np.clip(strike_grid, 1e-6, None))
        t_min = max(float(expiries.min()) * 0.5, 1e-3)
        time_grid = np.linspace(t_min, float(expiries.max()), grid_times)
        local = self._dupire_grid(surface, strike_grid, time_grid, spot, rate, dividend)
        self.implied_surface = surface
        self.local_vol_surface = local
        self.strike_grid = strike_grid
        self.time_grid = time_grid
        self.spot = spot
        self._interpolator = RegularGridInterpolator(
            (time_grid, strike_grid),
            local,
            method="linear",
            bounds_error=False,
            fill_value=None,
        )
        return local, strike_grid, time_grid

    def _dupire_grid(
        self,
        surface: VolatilitySurface,
        strikes: np.ndarray,
        times: np.ndarray,
        spot: float,
        rate: float,
        dividend: float,
    ) -> np.ndarray:
        local = np.empty((times.size, strikes.size))
        dt = np.minimum(0.01, 0.25 * times)
        for i, t in enumerate(times):
            forward = spot * np.exp((rate - dividend) * t)
            y = np.log(strikes / forward)
            h = max(float(np.median(np.diff(y))) * 0.5, 1e-3)

            def w_at(yy: np.ndarray, tt: float) -> np.ndarray:
                f = spot * np.exp((rate - dividend) * tt)
                return surface.total_variance(f * np.exp(yy), np.full_like(yy, tt))

            w = w_at(y, t)
            w_up = w_at(y + h, t)
            w_down = w_at(y - h, t)
            dw_dy = (w_up - w_down) / (2.0 * h)
            d2w_dy2 = (w_up - 2.0 * w + w_down) / h**2
            t_lo = max(t - dt[i], 1e-4)
            t_hi = t + dt[i]
            dw_dt = (w_at(y, t_hi) - w_at(y, t_lo)) / (t_hi - t_lo)
            w_safe = np.maximum(w, 1e-8)
            denominator = (
                (1.0 - y * dw_dy / (2.0 * w_safe)) ** 2
                - dw_dy**2 / 4.0 * (1.0 / w_safe + 0.25)
                + d2w_dy2 / 2.0
            )
            with np.errstate(divide="ignore", invalid="ignore"):
                variance = dw_dt / denominator
            fallback = w_safe / t
            variance = np.where(
                np.isfinite(variance) & (denominator > 1e-6) & (variance > 0),
                variance,
                fallback,
            )
            local[i] = np.clip(np.sqrt(variance), self.min_vol, self.max_vol)
        return local

    def local_volatility(self, spot: Any, strike: Any, time_to_expiry: Any) -> Any:
        if self._interpolator is None:
            return self.default_vol
        K = np.atleast_1d(np.asarray(strike, dtype=float))
        T = np.atleast_1d(np.asarray(time_to_expiry, dtype=float))
        K, T = np.broadcast_arrays(K, T)
        K = np.clip(K, self.strike_grid[0], self.strike_grid[-1])
        T = np.clip(T, self.time_grid[0], self.time_grid[-1])
        values = self._interpolator(np.column_stack([T.reshape(-1), K.reshape(-1)]))
        values = np.clip(values, self.min_vol, self.max_vol).reshape(K.shape)
        if np.ndim(strike) == 0 and np.ndim(time_to_expiry) == 0:
            return float(values[0])
        return values

    def price_option(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float = 0.0,
        option_type: str = "call",
        num_paths: int = 20000,
        num_steps: int = 100,
        seed: Optional[int] = None,
    ) -> float:
        if num_paths * num_steps > 40_000_000:
            raise ValueError("Simulation size exceeds the supported limit")
        rng = np.random.default_rng(seed)
        dt = time_to_expiry / num_steps
        log_s = np.full(num_paths, np.log(spot))
        for i in range(num_steps):
            t = max(i * dt, 1e-6)
            vols = np.asarray(
                self.local_volatility(spot, np.exp(log_s), np.full(num_paths, t))
            )
            z = rng.standard_normal(num_paths)
            log_s = (
                log_s + (rate - dividend - 0.5 * vols**2) * dt + vols * np.sqrt(dt) * z
            )
        terminal = np.exp(log_s)
        if option_type.lower() == "call":
            payoffs = np.maximum(terminal - strike, 0.0)
        else:
            payoffs = np.maximum(strike - terminal, 0.0)
        return float(np.exp(-rate * time_to_expiry) * np.mean(payoffs))

    def surface_summary(self) -> Dict[str, Any]:
        if self.local_vol_surface is None:
            raise ValueError("Local volatility surface not calibrated")
        return {
            "strikes": self.strike_grid.tolist(),
            "times": self.time_grid.tolist(),
            "local_volatility": self.local_vol_surface.tolist(),
        }

    def plot_local_volatility_surface(self, title: Optional[str] = None) -> Any:
        import matplotlib.pyplot as plt

        if self.local_vol_surface is None:
            raise ValueError("Local volatility surface not calibrated")
        X, Y = np.meshgrid(self.strike_grid, self.time_grid)
        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111, projection="3d")
        ax.plot_surface(X, Y, self.local_vol_surface, cmap="viridis", alpha=0.8)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Time to expiry")
        ax.set_zlabel("Local volatility")
        ax.set_title(title or "Local volatility surface")
        return fig


class CEVModel:
    def __init__(self, params: Optional[Dict[str, float]] = None) -> None:
        self.params = dict(params or {"sigma": 0.2, "beta": 0.5})
        self._validate(self.params)

    @staticmethod
    def _validate(params: Dict[str, float]) -> None:
        if params["sigma"] <= 0:
            raise ValueError("sigma must be positive")
        if not 0.0 < params["beta"] <= 1.0:
            raise ValueError("beta must be in (0, 1]")

    def local_volatility(
        self, spot: Any, strike: Any = None, time_to_expiry: Any = None
    ) -> Any:
        return self.params["sigma"] * np.asarray(spot, dtype=float) ** (
            self.params["beta"] - 1.0
        )

    def price_option(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float = 0.0,
        option_type: str = "call",
        method: str = "analytical",
        num_paths: int = 20000,
        num_steps: int = 100,
        seed: Optional[int] = None,
    ) -> float:
        if method == "monte_carlo":
            return self._price_monte_carlo(
                spot,
                strike,
                time_to_expiry,
                rate,
                dividend,
                option_type,
                num_paths,
                num_steps,
                seed,
            )
        if method in ("analytical", "analytic"):
            return self._price_analytical(
                spot, strike, time_to_expiry, rate, dividend, option_type
            )
        raise ValueError(f"Unknown pricing method: {method}")

    def _price_monte_carlo(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float,
        option_type: str,
        num_paths: int,
        num_steps: int,
        seed: Optional[int],
    ) -> float:
        sigma, beta = self.params["sigma"], self.params["beta"]
        rng = np.random.default_rng(seed)
        dt = time_to_expiry / num_steps
        s = np.full(num_paths, float(spot))
        for _ in range(num_steps):
            safe = np.maximum(s, 1e-8)
            vol = sigma * safe ** (beta - 1.0)
            z = rng.standard_normal(num_paths)
            s = safe * np.exp(
                (rate - dividend - 0.5 * vol**2) * dt + vol * np.sqrt(dt) * z
            )
        if option_type.lower() == "call":
            payoffs = np.maximum(s - strike, 0.0)
        else:
            payoffs = np.maximum(strike - s, 0.0)
        return float(np.exp(-rate * time_to_expiry) * np.mean(payoffs))

    def _price_analytical(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float,
        option_type: str,
    ) -> float:
        sigma, beta = self.params["sigma"], self.params["beta"]
        T = time_to_expiry
        if T <= 0:
            return float(
                max(spot - strike, 0.0)
                if option_type.lower() == "call"
                else max(strike - spot, 0.0)
            )
        if abs(beta - 1.0) < 1e-9:
            return float(bs_price(spot, strike, T, rate, sigma, dividend, option_type))
        b = rate - dividend
        power = 2.0 - 2.0 * beta
        if abs(b) < 1e-12:
            kappa = 2.0 / (sigma**2 * power**2 * T)
        else:
            kappa = 2.0 * b / (sigma**2 * power * (np.exp(b * power * T) - 1.0))
        x = kappa * spot**power * np.exp(b * power * T)
        y = kappa * strike**power
        shape = 1.0 / power
        call = spot * np.exp(-dividend * T) * (
            1.0 - ncx2.cdf(2.0 * y, 2.0 + 2.0 * shape, 2.0 * x)
        ) - strike * np.exp(-rate * T) * ncx2.cdf(2.0 * x, 2.0 * shape, 2.0 * y)
        if option_type.lower() == "call":
            return float(max(call, 0.0))
        put = call - spot * np.exp(-dividend * T) + strike * np.exp(-rate * T)
        return float(max(put, 0.0))

    def calibrate(
        self,
        option_data: List[Dict[str, Any]],
        spot: float,
        rate: float,
        dividend: float = 0.0,
        fix_beta: bool = False,
    ) -> Dict[str, float]:
        if len(option_data) < (1 if fix_beta else 2):
            raise ValueError("Insufficient option quotes for CEV calibration")
        beta0 = self.params["beta"]

        def unpack(vector: np.ndarray) -> Dict[str, float]:
            return {
                "sigma": float(vector[0]),
                "beta": beta0 if fix_beta else float(vector[1]),
            }

        def residuals(vector: np.ndarray) -> np.ndarray:
            trial = CEVModel(unpack(vector))
            return (
                np.array(
                    [
                        trial._price_analytical(
                            spot,
                            o["strike"],
                            _expiry_to_years(o["expiry"]),
                            rate,
                            dividend,
                            o.get("option_type", "call"),
                        )
                        - o["price"]
                        for o in option_data
                    ]
                )
                / spot
            )

        atm = min(option_data, key=lambda o: abs(o["strike"] - spot))
        try:
            iv0 = implied_volatility_from_price(
                atm["price"],
                spot,
                atm["strike"],
                _expiry_to_years(atm["expiry"]),
                rate,
                dividend,
                atm.get("option_type", "call"),
            )
        except ValueError:
            iv0 = 0.2
        start = [iv0 * spot ** (1.0 - beta0)] + ([] if fix_beta else [beta0])
        lower = [1e-6] + ([] if fix_beta else [0.05])
        upper = [1e3] + ([] if fix_beta else [1.0])
        solution = least_squares(
            residuals, start, bounds=(lower, upper), x_scale="jac", max_nfev=300
        )
        self.params = unpack(solution.x)
        return dict(self.params)

    def plot_volatility_smile(
        self,
        spot: float,
        strikes: Any,
        time_to_expiry: float,
        title: Optional[str] = None,
    ) -> Any:
        import matplotlib.pyplot as plt

        vols = self.local_volatility(np.asarray(strikes, dtype=float))
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(strikes, vols, linewidth=2)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Local volatility")
        ax.set_title(title or f"CEV local volatility (S={spot}, T={time_to_expiry})")
        ax.grid(True)
        return fig

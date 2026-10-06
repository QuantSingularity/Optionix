import logging
from typing import Any, Dict, List, Optional

import numpy as np
from scipy.optimize import least_squares

from ..black_scholes import bs_price, bs_vega

logger = logging.getLogger(__name__)

_GL_NODES, _GL_WEIGHTS = np.polynomial.legendre.leggauss(80)


def _gauss_legendre_panels(upper: float, panels: int):
    edges = np.linspace(0.0, upper, panels + 1)
    nodes, weights = [], []
    for lo, hi in zip(edges[:-1], edges[1:]):
        nodes.append(0.5 * (hi - lo) * _GL_NODES + 0.5 * (hi + lo))
        weights.append(0.5 * (hi - lo) * _GL_WEIGHTS)
    return np.concatenate(nodes), np.concatenate(weights)


_U_NODES, _U_WEIGHTS = _gauss_legendre_panels(250.0, 8)


class HestonModel:
    PARAM_KEYS = ("v0", "kappa", "theta", "sigma", "rho")

    def __init__(self, params: Optional[Dict[str, float]] = None) -> None:
        self.params = dict(
            params
            or {"v0": 0.04, "kappa": 2.0, "theta": 0.04, "sigma": 0.3, "rho": -0.7}
        )
        self._validate(self.params)
        self.calibration_info: Dict[str, Any] = {}

    @staticmethod
    def _validate(params: Dict[str, float]) -> None:
        missing = [k for k in HestonModel.PARAM_KEYS if k not in params]
        if missing:
            raise ValueError(f"Missing Heston parameters: {missing}")
        if params["v0"] <= 0 or params["theta"] <= 0:
            raise ValueError("v0 and theta must be positive")
        if params["kappa"] <= 0 or params["sigma"] <= 0:
            raise ValueError("kappa and sigma must be positive")
        if not -1.0 < params["rho"] < 1.0:
            raise ValueError("rho must be strictly between -1 and 1")

    def feller_satisfied(self) -> bool:
        p = self.params
        return 2.0 * p["kappa"] * p["theta"] >= p["sigma"] ** 2

    def price_option(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float = 0.0,
        option_type: str = "call",
        method: str = "semi_analytical",
        num_paths: int = 20000,
        num_steps: int = 100,
        seed: Optional[int] = None,
    ) -> float:
        if spot <= 0 or strike <= 0:
            raise ValueError("Spot and strike must be positive")
        if time_to_expiry <= 0:
            intrinsic = (
                max(spot - strike, 0.0)
                if option_type.lower() == "call"
                else max(strike - spot, 0.0)
            )
            return float(intrinsic)
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
        if method in ("semi_analytical", "analytical", "fourier"):
            return self._price_semi_analytical(
                spot, strike, time_to_expiry, rate, dividend, option_type
            )
        raise ValueError(f"Unknown pricing method: {method}")

    def _characteristic(
        self, u: np.ndarray, T: float, rate: float, dividend: float, x0: float, j: int
    ) -> np.ndarray:
        p = self.params
        kappa, theta, sigma, rho, v0 = (
            p["kappa"],
            p["theta"],
            p["sigma"],
            p["rho"],
            p["v0"],
        )
        uj = 0.5 if j == 1 else -0.5
        bj = kappa - rho * sigma if j == 1 else kappa
        iu = 1j * u
        shifted = bj - rho * sigma * iu
        d = np.sqrt(shifted**2 - sigma**2 * (2.0 * uj * iu - u**2))
        g = (shifted - d) / (shifted + d)
        exp_neg_dt = np.exp(-d * T)
        log_term = np.log((1.0 - g * exp_neg_dt) / (1.0 - g))
        C = (rate - dividend) * iu * T + kappa * theta / sigma**2 * (
            (shifted - d) * T - 2.0 * log_term
        )
        D = (shifted - d) / sigma**2 * (1.0 - exp_neg_dt) / (1.0 - g * exp_neg_dt)
        return np.exp(C + D * v0 + iu * x0)

    def _price_semi_analytical(
        self,
        spot: float,
        strike: float,
        time_to_expiry: float,
        rate: float,
        dividend: float,
        option_type: str,
    ) -> float:
        T = time_to_expiry
        x0 = np.log(spot)
        log_k = np.log(strike)
        u = _U_NODES
        probabilities = []
        for j in (1, 2):
            phi = self._characteristic(u, T, rate, dividend, x0, j)
            integrand = np.real(np.exp(-1j * u * log_k) * phi / (1j * u))
            probabilities.append(0.5 + np.sum(integrand * _U_WEIGHTS) / np.pi)
        p1, p2 = probabilities
        call = spot * np.exp(-dividend * T) * p1 - strike * np.exp(-rate * T) * p2
        if option_type.lower() == "call":
            price = call
        elif option_type.lower() == "put":
            price = call - spot * np.exp(-dividend * T) + strike * np.exp(-rate * T)
        else:
            raise ValueError(f"Unsupported option type: {option_type}")
        intrinsic_floor = (
            max(spot * np.exp(-dividend * T) - strike * np.exp(-rate * T), 0.0)
            if option_type.lower() == "call"
            else max(strike * np.exp(-rate * T) - spot * np.exp(-dividend * T), 0.0)
        )
        return float(max(price, intrinsic_floor))

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
        terminal = self._terminal_prices(
            spot, time_to_expiry, rate, dividend, num_paths, num_steps, seed
        )
        if option_type.lower() == "call":
            payoffs = np.maximum(terminal - strike, 0.0)
        else:
            payoffs = np.maximum(strike - terminal, 0.0)
        return float(np.exp(-rate * time_to_expiry) * np.mean(payoffs))

    def _terminal_prices(
        self,
        spot: float,
        time_horizon: float,
        rate: float,
        dividend: float,
        num_paths: int,
        num_steps: int,
        seed: Optional[int],
    ) -> np.ndarray:
        p = self.params
        rng = np.random.default_rng(seed)
        dt = time_horizon / num_steps
        sqrt_rho = np.sqrt(1.0 - p["rho"] ** 2)
        log_s = np.full(num_paths, np.log(spot))
        variance = np.full(num_paths, p["v0"])
        for _ in range(num_steps):
            z1 = rng.standard_normal(num_paths)
            z2 = p["rho"] * z1 + sqrt_rho * rng.standard_normal(num_paths)
            v_pos = np.maximum(variance, 0.0)
            root = np.sqrt(v_pos * dt)
            log_s = log_s + (rate - dividend - 0.5 * v_pos) * dt + root * z1
            variance = (
                variance
                + p["kappa"] * (p["theta"] - v_pos) * dt
                + p["sigma"] * root * z2
            )
        return np.exp(log_s)

    def simulate_paths(
        self,
        spot: float,
        time_horizon: float,
        rate: float,
        dividend: float = 0.0,
        num_paths: int = 1,
        num_steps: int = 252,
        seed: Optional[int] = None,
    ):
        if num_paths * (num_steps + 1) > 20_000_000:
            raise ValueError("Simulation size exceeds the supported limit")
        p = self.params
        rng = np.random.default_rng(seed)
        dt = time_horizon / num_steps
        time_grid = np.linspace(0.0, time_horizon, num_steps + 1)
        S = np.empty((num_paths, num_steps + 1))
        v = np.empty((num_paths, num_steps + 1))
        S[:, 0] = spot
        v[:, 0] = p["v0"]
        z1 = rng.standard_normal((num_paths, num_steps))
        z2 = p["rho"] * z1 + np.sqrt(1.0 - p["rho"] ** 2) * rng.standard_normal(
            (num_paths, num_steps)
        )
        log_s = np.full(num_paths, np.log(spot))
        for i in range(num_steps):
            v_pos = np.maximum(v[:, i], 0.0)
            root = np.sqrt(v_pos * dt)
            log_s = log_s + (rate - dividend - 0.5 * v_pos) * dt + root * z1[:, i]
            v[:, i + 1] = (
                v[:, i]
                + p["kappa"] * (p["theta"] - v_pos) * dt
                + p["sigma"] * root * z2[:, i]
            )
            S[:, i + 1] = np.exp(log_s)
        return S, np.maximum(v, 0.0), time_grid

    def implied_volatility_smile(
        self,
        spot: float,
        strikes: np.ndarray,
        time_to_expiry: float,
        rate: float,
        dividend: float = 0.0,
    ) -> np.ndarray:
        from ..black_scholes import implied_volatility_from_price

        result = []
        for strike in np.atleast_1d(strikes):
            option_type = "call" if strike >= spot else "put"
            price = self._price_semi_analytical(
                spot, float(strike), time_to_expiry, rate, dividend, option_type
            )
            try:
                result.append(
                    implied_volatility_from_price(
                        price,
                        spot,
                        float(strike),
                        time_to_expiry,
                        rate,
                        dividend,
                        option_type,
                    )
                )
            except ValueError:
                result.append(float("nan"))
        return np.array(result)

    def calibrate(
        self,
        option_data: List[Dict[str, Any]],
        initial_params: Optional[Dict[str, float]] = None,
        bounds: Optional[Dict[str, Any]] = None,
        max_nfev: int = 200,
    ) -> Dict[str, float]:
        if len(option_data) < len(self.PARAM_KEYS):
            raise ValueError(
                f"At least {len(self.PARAM_KEYS)} option quotes are required for calibration"
            )
        start = dict(initial_params or self.params)
        self._validate(start)
        limits = {
            "v0": (1e-4, 1.5),
            "kappa": (0.01, 25.0),
            "theta": (1e-4, 1.5),
            "sigma": (0.01, 4.0),
            "rho": (-0.995, 0.995),
        }
        if bounds:
            limits.update(bounds)
        lower = [limits[k][0] for k in self.PARAM_KEYS]
        upper = [limits[k][1] for k in self.PARAM_KEYS]
        x0 = np.clip([start[k] for k in self.PARAM_KEYS], lower, upper)

        quotes = []
        for option in option_data:
            vega = float(
                bs_vega(
                    option["spot"],
                    option["strike"],
                    option["time_to_expiry"],
                    option["rate"],
                    np.sqrt(start["v0"]),
                    option.get("dividend", 0.0),
                )
            )
            quotes.append((option, max(vega, 1e-6)))

        def residuals(vector: np.ndarray) -> np.ndarray:
            trial = HestonModel(dict(zip(self.PARAM_KEYS, vector)))
            out = []
            for option, vega in quotes:
                model_price = trial._price_semi_analytical(
                    option["spot"],
                    option["strike"],
                    option["time_to_expiry"],
                    option["rate"],
                    option.get("dividend", 0.0),
                    option["option_type"],
                )
                out.append((model_price - option["market_price"]) / vega)
            return np.array(out)

        solution = least_squares(
            residuals,
            x0,
            bounds=(lower, upper),
            x_scale=np.maximum(np.abs(x0), 0.05),
            max_nfev=max_nfev,
        )
        self.params = {k: float(v) for k, v in zip(self.PARAM_KEYS, solution.x)}
        self.calibration_info = {
            "success": bool(solution.success),
            "rmse_volatility": float(np.sqrt(np.mean(solution.fun**2))),
            "evaluations": int(solution.nfev),
            "num_quotes": len(option_data),
            "feller_satisfied": self.feller_satisfied(),
        }
        return dict(self.params)


class SabrModel:
    def __init__(self, params: Optional[Dict[str, float]] = None) -> None:
        self.params = dict(
            params or {"alpha": 0.3, "beta": 0.7, "rho": -0.5, "nu": 0.4}
        )
        self._validate(self.params)
        self.calibration_info: Dict[str, Any] = {}

    @staticmethod
    def _validate(params: Dict[str, float]) -> None:
        for key in ("alpha", "beta", "rho", "nu"):
            if key not in params:
                raise ValueError(f"Missing SABR parameter: {key}")
        if params["alpha"] <= 0 or params["nu"] < 0:
            raise ValueError("alpha must be positive and nu non-negative")
        if not 0.0 <= params["beta"] <= 1.0:
            raise ValueError("beta must be within [0, 1]")
        if not -1.0 < params["rho"] < 1.0:
            raise ValueError("rho must be strictly between -1 and 1")

    def implied_volatility(
        self,
        strike: Any,
        forward: float,
        time_to_expiry: float,
        params: Optional[Dict[str, float]] = None,
    ) -> Any:
        p = params or self.params
        alpha, beta, rho, nu = p["alpha"], p["beta"], p["rho"], p["nu"]
        K = np.asarray(strike, dtype=float)
        F = float(forward)
        T = float(time_to_expiry)
        if F <= 0 or np.any(K <= 0):
            raise ValueError("Forward and strikes must be positive")
        one_minus_beta = 1.0 - beta
        fk = F * K
        log_fk = np.log(F / K)
        fk_pow = fk ** (0.5 * one_minus_beta)
        with np.errstate(divide="ignore", invalid="ignore"):
            z = nu / alpha * fk_pow * log_fk
            sqrt_term = np.sqrt(1.0 - 2.0 * rho * z + z**2)
            x_z = np.log((sqrt_term + z - rho) / (1.0 - rho))
            z_over_x = np.where(np.abs(z) < 1e-8, 1.0, z / x_z)
        denominator = fk_pow * (
            1.0
            + one_minus_beta**2 / 24.0 * log_fk**2
            + one_minus_beta**4 / 1920.0 * log_fk**4
        )
        correction = (
            1.0
            + (
                one_minus_beta**2 / 24.0 * alpha**2 / fk**one_minus_beta
                + 0.25 * rho * beta * nu * alpha / fk_pow
                + (2.0 - 3.0 * rho**2) / 24.0 * nu**2
            )
            * T
        )
        vol = alpha / denominator * z_over_x * correction
        return float(vol) if vol.ndim == 0 else vol

    def calibrate(
        self,
        option_data: List[Dict[str, Any]],
        initial_params: Optional[Dict[str, float]] = None,
        bounds: Optional[Dict[str, Any]] = None,
        fix_beta: bool = True,
        max_nfev: int = 200,
    ) -> Dict[str, float]:
        free_keys = ["alpha", "rho", "nu"] + ([] if fix_beta else ["beta"])
        if len(option_data) < len(free_keys):
            raise ValueError(
                f"At least {len(free_keys)} option quotes are required for calibration"
            )
        start = dict(initial_params or self.params)
        self._validate(start)
        beta0 = start["beta"]
        nearest = min(
            option_data, key=lambda o: abs(np.log(o["forward"] / o["strike"]))
        )
        alpha0 = nearest["market_vol"] * nearest["forward"] ** (1.0 - beta0)
        if initial_params is None or "alpha" not in initial_params:
            start["alpha"] = alpha0
        limits = {
            "alpha": (alpha0 * 0.05, alpha0 * 10.0),
            "rho": (-0.999, 0.999),
            "nu": (1e-4, 5.0),
            "beta": (0.0, 1.0),
        }
        if bounds:
            limits.update(bounds)
        lower = [limits[k][0] for k in free_keys]
        upper = [limits[k][1] for k in free_keys]
        x0 = np.clip([start[k] for k in free_keys], lower, upper)

        def build(vector: np.ndarray) -> Dict[str, float]:
            params = dict(zip(free_keys, vector))
            if fix_beta:
                params["beta"] = beta0
            return params

        def residuals(vector: np.ndarray) -> np.ndarray:
            params = build(vector)
            out = []
            for option in option_data:
                model_vol = self.implied_volatility(
                    option["strike"],
                    option["forward"],
                    option["time_to_expiry"],
                    params,
                )
                out.append(model_vol - option["market_vol"])
            return np.array(out)

        solution = least_squares(
            residuals,
            x0,
            bounds=(lower, upper),
            x_scale=np.maximum(np.abs(x0), 0.05),
            max_nfev=max_nfev,
        )
        self.params = {k: float(v) for k, v in build(solution.x).items()}
        self.calibration_info = {
            "success": bool(solution.success),
            "rmse_volatility": float(np.sqrt(np.mean(solution.fun**2))),
            "evaluations": int(solution.nfev),
            "num_quotes": len(option_data),
        }
        return dict(self.params)

    def price_option(
        self,
        strike: float,
        forward: float,
        time_to_expiry: float,
        rate: float,
        option_type: str = "call",
    ) -> float:
        if time_to_expiry <= 0:
            intrinsic = (
                max(forward - strike, 0.0)
                if option_type.lower() == "call"
                else max(strike - forward, 0.0)
            )
            return float(intrinsic)
        vol = self.implied_volatility(strike, forward, time_to_expiry)
        discount = np.exp(-rate * time_to_expiry)
        spot_equivalent = forward * discount
        return float(
            bs_price(
                spot_equivalent,
                strike,
                time_to_expiry,
                rate,
                vol,
                0.0,
                option_type,
            )
        )

    def plot_volatility_smile(
        self,
        forward: float,
        strikes: Any,
        time_to_expiry: float,
        title: Optional[str] = None,
    ) -> Any:
        import matplotlib.pyplot as plt

        vols = self.implied_volatility(np.asarray(strikes), forward, time_to_expiry)
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(strikes, vols, linewidth=2)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Implied volatility")
        ax.set_title(title or f"SABR smile (F={forward}, T={time_to_expiry})")
        ax.grid(True)
        return fig

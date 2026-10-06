import math
from typing import Any, Callable, Dict, List, Optional, Sequence

import numpy as np

from .ai_bridge import ai_submodule, load_ai_models

GREEK_KEYS = ("delta", "gamma", "theta", "vega", "rho")
MIN_TIME = 1e-6
MIN_VOL = 1e-3
MAX_VOL = 5.0
DEFAULT_HESTON = {"v0": 0.04, "kappa": 2.0, "theta": 0.04, "sigma": 0.3, "rho": -0.7}
MAX_PATH_ELEMENTS = 15_000_000


def _intrinsic(S: float, K: float, option_type: str) -> float:
    return float(max(S - K, 0.0) if option_type == "call" else max(K - S, 0.0))


def _zero_greeks() -> Dict[str, float]:
    return {k: 0.0 for k in GREEK_KEYS}


class PricingEngine:
    def __init__(self) -> None:
        self._ai = load_ai_models()
        self._bs_module = ai_submodule("quantitative.black_scholes")
        self._mc_module = ai_submodule("quantitative.monte_carlo")
        self._sv_module = ai_submodule("quantitative.advanced.stochastic_volatility")
        self._vs_module = ai_submodule("quantitative.advanced.volatility_surface")
        self._cal_module = ai_submodule("quantitative.advanced.calibration_engine")
        self._model = self._bs_module.BlackScholesModel()

    @staticmethod
    def _check_type(option_type: str) -> str:
        value = str(option_type).lower()
        if value not in ("call", "put"):
            raise ValueError(f"Unsupported option type: {option_type}")
        return value

    def _params(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        q: float,
        option_type: str,
        style: str = "european",
        barrier_level: Optional[float] = None,
        barrier_type: Optional[str] = None,
    ):
        bs = self._bs_module
        return bs.OptionParameters(
            spot_price=float(S),
            strike_price=float(K),
            time_to_expiry=float(T),
            risk_free_rate=float(r),
            volatility=float(min(max(sigma, MIN_VOL), MAX_VOL)),
            dividend_yield=float(q),
            option_type=bs.OptionType(option_type),
            option_style=bs.OptionStyle(style),
            barrier_level=barrier_level,
            barrier_type=bs.BarrierType(barrier_type) if barrier_type else None,
        )

    def calculate_greeks(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        q: float = 0.0,
        option_type: str = "call",
    ) -> Dict[str, float]:
        option_type = self._check_type(option_type)
        if T < MIN_TIME or sigma <= 0 or S <= 0 or K <= 0:
            return _zero_greeks()
        params = self._params(S, K, T, r, sigma, q, option_type)
        return self._model.calculate_greeks(params)

    def european_price(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        q: float = 0.0,
        option_type: str = "call",
    ) -> float:
        option_type = self._check_type(option_type)
        if T < MIN_TIME or sigma <= 0 or S <= 0 or K <= 0:
            return _intrinsic(S, K, option_type)
        return float(
            self._bs_module.bs_price(
                S, K, T, r, min(max(sigma, MIN_VOL), MAX_VOL), q, option_type
            )
        )

    def monte_carlo_pricing(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        iterations: int = 100_000,
        seed: Optional[int] = None,
        option_type: str = "call",
        dividend: float = 0.0,
    ) -> float:
        option_type = self._check_type(option_type)
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return _intrinsic(S, K, option_type)
        mc = self._mc_module
        sim = mc.MCSimulator(
            mc.SimulationParameters(
                initial_price=S,
                risk_free_rate=r,
                volatility=sigma,
                time_horizon=T,
                time_steps=1,
                num_simulations=int(iterations),
                variance_reduction=mc.VarianceReduction.ANTITHETIC,
                random_seed=seed,
                dividend_yield=dividend,
            )
        )
        return float(
            sim.price_option(mc.OptionPayoff("european", option_type, K)).option_price
        )

    def monte_carlo_result(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        q: float,
        option_type: str,
        paths: int,
        seed: Optional[int],
        style: str = "european",
        barrier_level: Optional[float] = None,
        barrier_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        mc = self._mc_module
        if style == "american":
            raise ValueError("Monte Carlo pricing does not support american exercise")
        steps = 1
        if style == "barrier":
            steps = max(50, min(500, int(252 * T) + 1))
            paths = max(1000, min(paths, MAX_PATH_ELEMENTS // (steps + 1)))
        sim = mc.MCSimulator(
            mc.SimulationParameters(
                initial_price=S,
                risk_free_rate=r,
                volatility=sigma,
                time_horizon=T,
                time_steps=steps,
                num_simulations=paths,
                variance_reduction=mc.VarianceReduction.ANTITHETIC,
                random_seed=seed,
                dividend_yield=q,
            )
        )
        payoff = mc.OptionPayoff(
            style,
            option_type,
            K,
            barrier_level=barrier_level,
            barrier_type=barrier_type,
        )
        result = sim.price_option(payoff, compute_greeks=True)
        return {
            "price": result.option_price,
            "greeks": result.greeks,
            "std_error": result.standard_error,
            "confidence_interval": list(result.confidence_interval),
            "paths": paths,
        }

    def heston_greeks(
        self,
        pricer: Callable[..., float],
        S: float,
        K: float,
        T: float,
        r: float,
        q: float,
        option_type: str,
        params: Dict[str, float],
    ) -> Dict[str, float]:
        base = pricer(S, K, T, r, q, option_type, params)
        h = S * 0.01
        up = pricer(S + h, K, T, r, q, option_type, params)
        down = pricer(S - h, K, T, r, q, option_type, params)
        v0 = params["v0"]
        sigma0 = math.sqrt(v0)
        bumped = dict(params, v0=(sigma0 + 0.01) ** 2)
        vega = pricer(S, K, T, r, q, option_type, bumped) - base
        dt = min(1.0 / 365.0, T / 2.0)
        theta = pricer(S, K, T - dt, r, q, option_type, params) - base
        rho = pricer(S, K, T, r + 0.005, q, option_type, params) - pricer(
            S, K, T, r - 0.005, q, option_type, params
        )
        return {
            "delta": (up - down) / (2.0 * h),
            "gamma": (up - 2.0 * base + down) / h**2,
            "theta": theta / (dt * 365.0),
            "vega": vega,
            "rho": rho,
        }

    def heston_price(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        q: float,
        option_type: str,
        params: Optional[Dict[str, float]] = None,
    ) -> float:
        model = self._sv_module.HestonModel(dict(params or DEFAULT_HESTON))
        return model.price_option(S, K, T, r, q, option_type, method="semi_analytical")

    def price(
        self,
        S: float,
        K: float,
        T: float,
        r: float,
        sigma: float,
        q: float = 0.0,
        option_type: str = "call",
        style: str = "european",
        method: str = "black_scholes",
        barrier_level: Optional[float] = None,
        barrier_type: Optional[str] = None,
        paths: int = 100_000,
        seed: Optional[int] = 42,
        heston_params: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        option_type = self._check_type(option_type)
        style = str(style).lower()
        method = str(method).lower()
        if style not in ("european", "american", "barrier"):
            raise ValueError(f"Unsupported option style: {style}")
        if style == "barrier" and (barrier_level is None or not barrier_type):
            raise ValueError("Barrier level and barrier type are required")
        if style == "american" and method != "black_scholes":
            raise ValueError(
                "American options are priced with the binomial lattice only"
            )
        if method == "heston" and style != "european":
            raise ValueError("Heston pricing supports european options only")
        if T < MIN_TIME:
            return {
                "price": _intrinsic(S, K, option_type),
                "greeks": _zero_greeks(),
                "method": "intrinsic",
            }
        if method == "monte_carlo":
            out = self.monte_carlo_result(
                S,
                K,
                T,
                r,
                sigma,
                q,
                option_type,
                paths,
                seed,
                style,
                barrier_level,
                barrier_type,
            )
            out["method"] = "monte_carlo"
            return out
        if method == "heston":
            params = dict(heston_params or DEFAULT_HESTON)
            price = self.heston_price(S, K, T, r, q, option_type, params)
            greeks = self.heston_greeks(
                self.heston_price, S, K, T, r, q, option_type, params
            )
            return {"price": price, "greeks": greeks, "method": "heston"}
        if method != "black_scholes":
            raise ValueError(f"Unsupported pricing method: {method}")
        params_obj = self._params(
            S, K, T, r, sigma, q, option_type, style, barrier_level, barrier_type
        )
        result = self._model.comprehensive_option_price(params_obj)
        names = {
            "european": "black_scholes",
            "american": "binomial_crr",
            "barrier": "barrier_analytic",
        }
        return {
            "price": result.price,
            "greeks": {k: getattr(result, k) for k in GREEK_KEYS},
            "method": names[style],
        }

    def implied_volatility(
        self,
        market_price: float,
        S: float,
        K: float,
        T: float,
        r: float,
        q: float = 0.0,
        option_type: str = "call",
        style: str = "european",
    ) -> float:
        option_type = self._check_type(option_type)
        if style == "american":
            params = self._params(
                S, K, max(T, MIN_TIME), r, 0.2, q, option_type, "american"
            )
            return self._model.implied_volatility(market_price, params)
        return self._bs_module.implied_volatility_from_price(
            market_price, S, K, T, r, q, option_type
        )

    def parametric_surface(
        self,
        spot: float,
        strikes: Sequence[float],
        expiries: Sequence[float],
        r: float,
        q: float,
        base_vol: float,
    ) -> List[Dict[str, float]]:
        vs = self._vs_module
        points = []
        for T in expiries:
            forward = spot * math.exp((r - q) * T)
            k = np.log(np.asarray(strikes, dtype=float) / forward)
            vols = vs.svi_parametric_implied_vol(k, T, base_vol)
            for strike, vol in zip(strikes, vols):
                points.append(
                    {"strike": float(strike), "expiry": float(T), "iv": float(vol)}
                )
        return points

    def fitted_surface(
        self,
        spot: float,
        quotes: List[Dict[str, Any]],
        strikes: Sequence[float],
        expiries: Sequence[float],
        r: float,
        q: float,
        method: str,
    ) -> Dict[str, Any]:
        vs = self._vs_module
        data = [
            vs.OptionData(
                strike=float(x["strike"]),
                expiry=float(x["expiry"]),
                implied_volatility=float(x["implied_volatility"]),
                option_type=x.get("option_type", "call"),
            )
            for x in quotes
        ]
        surface = vs.VolatilitySurface({"method": method})
        surface.fit_surface(data, spot, r, q)
        grid = surface.implied_volatility_grid(list(strikes), list(expiries))
        arbitrage = surface.check_arbitrage()
        points = []
        for i, T in enumerate(expiries):
            for j, K in enumerate(strikes):
                points.append(
                    {"strike": float(K), "expiry": float(T), "iv": float(grid[i, j])}
                )
        return {
            "points": points,
            "metrics": surface.get_surface_metrics(),
            "arbitrage": {
                "calendar_free": arbitrage.calendar_arbitrage,
                "butterfly_free": arbitrage.butterfly_arbitrage,
                "parity_consistent": arbitrage.call_put_parity,
                "violations": arbitrage.violations,
                "severity_score": arbitrage.severity_score,
            },
        }

    def calibrate(
        self,
        model: str,
        options: List[Dict[str, Any]],
        spot: float,
        rate: float,
        dividend: float,
    ) -> Dict[str, Any]:
        engine = self._cal_module.CalibrationEngine(
            spot=spot, rate=rate, dividend=dividend
        )
        model = model.lower()
        if model == "heston":
            return engine.calibrate_heston(options)
        if model == "sabr":
            return engine.calibrate_sabr(options)
        if model == "cev":
            return {"parameters": engine.calibrate_cev(options), "diagnostics": {}}
        raise ValueError(f"Unsupported calibration model: {model}")

    def simulate_returns(
        self,
        annual_volatility: float,
        horizon_days: int,
        simulations: int,
        seed: Optional[int] = 42,
        drift: float = 0.0,
    ) -> np.ndarray:
        mc = self._mc_module
        sim = mc.MCSimulator(
            mc.SimulationParameters(
                initial_price=1.0,
                risk_free_rate=drift,
                volatility=annual_volatility,
                time_horizon=horizon_days / 252.0,
                time_steps=1,
                num_simulations=int(simulations),
                variance_reduction=mc.VarianceReduction.ANTITHETIC,
                random_seed=seed,
            )
        )
        return sim.terminal_returns(1)

    @staticmethod
    def parametric_returns(
        annual_volatility: float, horizon_days: int, samples: int = 100_000
    ) -> np.ndarray:
        from scipy.stats import norm

        t = horizon_days / 252.0
        u = (np.arange(samples) + 0.5) / samples
        z = norm.ppf(u)
        return (
            np.exp(
                -0.5 * annual_volatility**2 * t + annual_volatility * math.sqrt(t) * z
            )
            - 1.0
        )

    def revalue_scenario(
        self,
        positions: List[Dict[str, Any]],
        price_shock: float,
        vol_shock: float,
        rate_shock: float,
    ) -> float:
        total = 0.0
        for p in positions:
            S, K, T = p["spot"], p["strike"], p["time_to_expiry"]
            r, q, sigma = p["rate"], p["dividend_yield"], p["volatility"]
            option_type = p["option_type"]
            base = self.european_price(S, K, T, r, sigma, q, option_type)
            shocked = self.european_price(
                S * (1.0 + price_shock),
                K,
                T,
                max(r + rate_shock, 0.0),
                min(sigma * (1.0 + vol_shock), MAX_VOL),
                q,
                option_type,
            )
            total += p["quantity"] * p["multiplier"] * (shocked - base)
        return total

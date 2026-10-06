import logging
import math
import multiprocessing as mp
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict, dataclass, field, replace
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats
from scipy.stats.qmc import Sobol

logger = logging.getLogger(__name__)

MAX_PATH_ELEMENTS = 20_000_000
BARRIER_SHIFT = 0.5826


class ProcessType(str, Enum):
    GEOMETRIC_BROWNIAN_MOTION = "gbm"
    MEAN_REVERTING = "mean_reverting"
    JUMP_DIFFUSION = "jump_diffusion"
    HESTON = "heston"


class VarianceReduction(str, Enum):
    ANTITHETIC = "antithetic"
    CONTROL_VARIATE = "control_variate"
    QUASI_RANDOM = "quasi_random"


@dataclass
class SimulationParameters:
    initial_price: float
    risk_free_rate: float
    volatility: float
    time_horizon: float
    time_steps: int
    num_simulations: int
    process_type: ProcessType = ProcessType.GEOMETRIC_BROWNIAN_MOTION
    variance_reduction: Optional[VarianceReduction] = None
    random_seed: Optional[int] = None
    parallel: bool = False
    dividend_yield: float = 0.0
    barrier_continuity_correction: bool = True
    mean_reversion_speed: Optional[float] = None
    long_term_mean: Optional[float] = None
    jump_intensity: Optional[float] = None
    jump_mean: Optional[float] = None
    jump_volatility: Optional[float] = None
    initial_variance: Optional[float] = None
    variance_mean_reversion: Optional[float] = None
    long_term_variance: Optional[float] = None
    vol_of_vol: Optional[float] = None
    correlation: Optional[float] = None


@dataclass
class OptionPayoff:
    option_style: str
    option_type: str
    strike_price: float
    barrier_level: Optional[float] = None
    barrier_type: Optional[str] = None
    averaging_start_step: int = 0
    lookback_start_step: int = 0


@dataclass
class SimulationResult:
    option_price: float
    standard_error: float
    confidence_interval: Tuple[float, float]
    paths: Optional[np.ndarray] = field(default=None, repr=False)
    payoffs: Optional[np.ndarray] = field(default=None, repr=False)
    greeks: Dict[str, float] = field(default_factory=dict)
    convergence_data: Dict[str, List[float]] = field(default_factory=dict)
    computation_time: float = 0.0
    method_used: str = ""


def _process_value(process_type: Any) -> str:
    return str(getattr(process_type, "value", process_type))


def _chunk_worker(args: Tuple[Dict[str, Any], int, Any]) -> np.ndarray:
    params_dict, n_simulations, seed_state = args
    params_dict = dict(params_dict)
    params_dict["process_type"] = ProcessType(
        _process_value(params_dict["process_type"])
    )
    vr = params_dict.get("variance_reduction")
    params_dict["variance_reduction"] = (
        VarianceReduction(_process_value(vr)) if vr else None
    )
    params_dict["parallel"] = False
    params_dict["random_seed"] = None
    simulator = MCSimulator(SimulationParameters(**params_dict))
    simulator.rng = np.random.default_rng(seed_state)
    return simulator._generate(n_simulations, simulator.params.time_steps)


class MCSimulator:
    def __init__(self, params: SimulationParameters) -> None:
        self.params = params
        self.validate_parameters()
        self.dt = params.time_horizon / params.time_steps
        self.rng = np.random.default_rng(params.random_seed)

    def validate_parameters(self) -> None:
        p = self.params
        if p.initial_price <= 0:
            raise ValueError("Initial price must be positive")
        if p.volatility < 0:
            raise ValueError("Volatility must be non-negative")
        if p.time_horizon <= 0:
            raise ValueError("Time horizon must be positive")
        if p.time_steps <= 0:
            raise ValueError("Time steps must be positive")
        if p.num_simulations <= 0:
            raise ValueError("Number of simulations must be positive")
        if p.risk_free_rate is None:
            raise ValueError("Risk-free rate must be provided for pricing")
        process = _process_value(p.process_type)
        if process == ProcessType.MEAN_REVERTING.value and (
            p.mean_reversion_speed is None or p.long_term_mean is None
        ):
            raise ValueError("Mean reversion parameters required")
        if process == ProcessType.JUMP_DIFFUSION.value and None in (
            p.jump_intensity,
            p.jump_mean,
            p.jump_volatility,
        ):
            raise ValueError("Jump intensity, mean and volatility are required")
        if process == ProcessType.HESTON.value and None in (
            p.initial_variance,
            p.variance_mean_reversion,
            p.long_term_variance,
            p.vol_of_vol,
            p.correlation,
        ):
            raise ValueError("Heston parameters are required")
        if process == ProcessType.HESTON.value and not -1.0 <= p.correlation <= 1.0:
            raise ValueError("Correlation must be between -1 and 1")

    def _check_size(self, steps: int, n_simulations: int) -> None:
        if (steps + 1) * n_simulations > MAX_PATH_ELEMENTS:
            raise ValueError(
                "Simulation size exceeds the supported limit; reduce paths or time steps"
            )

    def _normals(self, steps: int, n_simulations: int) -> np.ndarray:
        vr = self.params.variance_reduction
        if vr == VarianceReduction.ANTITHETIC:
            n_base = (n_simulations + 1) // 2
            base = self.rng.standard_normal((steps, n_base))
            return np.concatenate([base, -base], axis=1)[:, :n_simulations]
        if vr == VarianceReduction.QUASI_RANDOM:
            m = max(1, math.ceil(math.log2(max(n_simulations, 2))))
            sobol = Sobol(d=steps, scramble=True, seed=self.rng)
            uniforms = sobol.random_base2(m)[:n_simulations]
            uniforms = np.clip(uniforms, 1e-12, 1 - 1e-12)
            return stats.norm.ppf(uniforms).T
        return self.rng.standard_normal((steps, n_simulations))

    def geometric_brownian_motion(
        self, n_simulations: Optional[int] = None, steps: Optional[int] = None
    ) -> np.ndarray:
        p = self.params
        n = n_simulations or p.num_simulations
        n_steps = steps or p.time_steps
        dt = p.time_horizon / n_steps
        z = self._normals(n_steps, n)
        drift = (p.risk_free_rate - p.dividend_yield - 0.5 * p.volatility**2) * dt
        increments = drift + p.volatility * math.sqrt(dt) * z
        paths = np.empty((n_steps + 1, n))
        paths[0] = p.initial_price
        paths[1:] = p.initial_price * np.exp(np.cumsum(increments, axis=0))
        return paths

    def jump_diffusion(
        self, n_simulations: Optional[int] = None, steps: Optional[int] = None
    ) -> np.ndarray:
        p = self.params
        n = n_simulations or p.num_simulations
        n_steps = steps or p.time_steps
        dt = p.time_horizon / n_steps
        compensator = p.jump_intensity * (
            math.exp(p.jump_mean + 0.5 * p.jump_volatility**2) - 1.0
        )
        drift = (
            p.risk_free_rate - p.dividend_yield - compensator - 0.5 * p.volatility**2
        ) * dt
        z = self._normals(n_steps, n)
        jump_counts = self.rng.poisson(p.jump_intensity * dt, size=(n_steps, n))
        jump_normals = self.rng.standard_normal((n_steps, n))
        jumps = (
            jump_counts * p.jump_mean
            + np.sqrt(jump_counts) * p.jump_volatility * jump_normals
        )
        increments = drift + p.volatility * math.sqrt(dt) * z + jumps
        paths = np.empty((n_steps + 1, n))
        paths[0] = p.initial_price
        paths[1:] = p.initial_price * np.exp(np.cumsum(increments, axis=0))
        return paths

    def mean_reverting_process(
        self, n_simulations: Optional[int] = None, steps: Optional[int] = None
    ) -> np.ndarray:
        p = self.params
        n = n_simulations or p.num_simulations
        n_steps = steps or p.time_steps
        dt = p.time_horizon / n_steps
        z = self._normals(n_steps, n)
        paths = np.empty((n_steps + 1, n))
        paths[0] = p.initial_price
        for t in range(1, n_steps + 1):
            drift = p.mean_reversion_speed * (p.long_term_mean - paths[t - 1]) * dt
            shock = p.volatility * math.sqrt(dt) * z[t - 1]
            paths[t] = np.maximum(paths[t - 1] + drift + shock, 1e-3)
        return paths

    def heston_model(
        self, n_simulations: Optional[int] = None, steps: Optional[int] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        p = self.params
        n = n_simulations or p.num_simulations
        n_steps = steps or p.time_steps
        dt = p.time_horizon / n_steps
        z1 = self._normals(n_steps, n)
        z_independent = self.rng.standard_normal((n_steps, n))
        z2 = p.correlation * z1 + math.sqrt(1.0 - p.correlation**2) * z_independent
        prices = np.empty((n_steps + 1, n))
        variances = np.empty((n_steps + 1, n))
        prices[0] = p.initial_price
        variances[0] = p.initial_variance
        log_price = np.full(n, math.log(p.initial_price))
        for t in range(1, n_steps + 1):
            v_pos = np.maximum(variances[t - 1], 0.0)
            sqrt_v = np.sqrt(v_pos * dt)
            log_price = (
                log_price
                + (p.risk_free_rate - p.dividend_yield - 0.5 * v_pos) * dt
                + sqrt_v * z1[t - 1]
            )
            variances[t] = (
                variances[t - 1]
                + p.variance_mean_reversion * (p.long_term_variance - v_pos) * dt
                + p.vol_of_vol * sqrt_v * z2[t - 1]
            )
            prices[t] = np.exp(log_price)
        return prices, np.maximum(variances, 0.0)

    def _generate(self, n_simulations: int, steps: int) -> np.ndarray:
        self._check_size(steps, n_simulations)
        process = _process_value(self.params.process_type)
        if process == ProcessType.GEOMETRIC_BROWNIAN_MOTION.value:
            return self.geometric_brownian_motion(n_simulations, steps)
        if process == ProcessType.JUMP_DIFFUSION.value:
            return self.jump_diffusion(n_simulations, steps)
        if process == ProcessType.MEAN_REVERTING.value:
            return self.mean_reverting_process(n_simulations, steps)
        if process == ProcessType.HESTON.value:
            return self.heston_model(n_simulations, steps)[0]
        raise ValueError(f"Unsupported process type: {process}")

    def generate_paths(self, steps: Optional[int] = None) -> np.ndarray:
        n_steps = steps or self.params.time_steps
        n = self.params.num_simulations
        self._check_size(n_steps, n)
        if not self.params.parallel or n < 20_000:
            return self._generate(n, n_steps)
        workers = max(1, min(mp.cpu_count(), n // 10_000))
        sizes = [n // workers + (1 if i < n % workers else 0) for i in range(workers)]
        seeds = np.random.SeedSequence(self.params.random_seed).spawn(workers)
        params_dict = asdict(replace(self.params, time_steps=n_steps))
        params_dict["process_type"] = _process_value(self.params.process_type)
        vr = self.params.variance_reduction
        params_dict["variance_reduction"] = _process_value(vr) if vr else None
        with ProcessPoolExecutor(max_workers=workers) as executor:
            chunks = list(
                executor.map(
                    _chunk_worker,
                    [(params_dict, sizes[i], seeds[i]) for i in range(workers)],
                )
            )
        return np.concatenate(chunks, axis=1)

    def _is_path_independent(self, payoff_spec: OptionPayoff) -> bool:
        process = _process_value(self.params.process_type)
        return payoff_spec.option_style.lower() == "european" and process in (
            ProcessType.GEOMETRIC_BROWNIAN_MOTION.value,
            ProcessType.JUMP_DIFFUSION.value,
        )

    def _barrier_adjusted_level(self, level: float, is_up: bool) -> float:
        process = _process_value(self.params.process_type)
        if process != ProcessType.GEOMETRIC_BROWNIAN_MOTION.value:
            return level
        if not self.params.barrier_continuity_correction:
            return level
        shift = math.exp(BARRIER_SHIFT * self.params.volatility * math.sqrt(self.dt))
        return level / shift if is_up else level * shift

    def calculate_payoff(
        self, paths: np.ndarray, payoff_spec: OptionPayoff
    ) -> np.ndarray:
        style = payoff_spec.option_style.lower()
        option_type = payoff_spec.option_type.lower()
        strike = payoff_spec.strike_price
        if option_type not in ("call", "put"):
            raise ValueError(f"Unsupported option type: {option_type}")
        sign = 1.0 if option_type == "call" else -1.0

        def vanilla(prices: np.ndarray) -> np.ndarray:
            return np.maximum(sign * (prices - strike), 0.0)

        if style == "european":
            return vanilla(paths[-1])
        if style == "asian":
            start = min(max(payoff_spec.averaging_start_step, 0), paths.shape[0] - 1)
            return vanilla(np.mean(paths[start:], axis=0))
        if style == "barrier":
            if payoff_spec.barrier_level is None or not payoff_spec.barrier_type:
                raise ValueError("Barrier level and type are required")
            barrier_type = payoff_spec.barrier_type.lower()
            if barrier_type not in (
                "up_and_out",
                "up_and_in",
                "down_and_out",
                "down_and_in",
            ):
                raise ValueError(f"Unsupported barrier type: {barrier_type}")
            is_up = barrier_type.startswith("up")
            is_out = barrier_type.endswith("out")
            level = self._barrier_adjusted_level(payoff_spec.barrier_level, is_up)
            hit = (
                np.any(paths >= level, axis=0)
                if is_up
                else np.any(paths <= level, axis=0)
            )
            payoffs = vanilla(paths[-1])
            return np.where(hit, 0.0 if is_out else payoffs, payoffs if is_out else 0.0)
        if style == "lookback":
            start = min(max(payoff_spec.lookback_start_step, 0), paths.shape[0] - 1)
            window = paths[start:]
            if option_type == "call":
                return np.maximum(paths[-1] - np.min(window, axis=0), 0.0)
            return np.maximum(np.max(window, axis=0) - paths[-1], 0.0)
        raise ValueError(f"Unsupported option style: {style}")

    def _discount(self) -> float:
        return math.exp(-self.params.risk_free_rate * self.params.time_horizon)

    def _estimate(
        self, discounted: np.ndarray, terminal: Optional[np.ndarray]
    ) -> Tuple[float, float]:
        vr = self.params.variance_reduction
        n = discounted.shape[0]
        if (
            vr == VarianceReduction.CONTROL_VARIATE
            and terminal is not None
            and n > 2
            and _process_value(self.params.process_type)
            != ProcessType.MEAN_REVERTING.value
        ):
            control = terminal * self._discount()
            control_mean = self.params.initial_price * math.exp(
                -self.params.dividend_yield * self.params.time_horizon
            )
            var_control = np.var(control, ddof=1)
            if var_control > 0:
                beta = np.cov(discounted, control, ddof=1)[0, 1] / var_control
                adjusted = discounted - beta * (control - control_mean)
                return float(np.mean(adjusted)), float(
                    np.std(adjusted, ddof=1) / math.sqrt(n)
                )
        if vr == VarianceReduction.ANTITHETIC and n >= 4:
            half = n // 2
            pair_mean = 0.5 * (discounted[:half] + discounted[half : 2 * half])
            if n % 2:
                pair_mean = np.concatenate([pair_mean, discounted[-1:]])
            return float(np.mean(pair_mean)), float(
                np.std(pair_mean, ddof=1) / math.sqrt(pair_mean.shape[0])
            )
        if n < 2:
            return float(np.mean(discounted)), 0.0
        return float(np.mean(discounted)), float(
            np.std(discounted, ddof=1) / math.sqrt(n)
        )

    def _price_with_paths(
        self, payoff_spec: OptionPayoff, paths: np.ndarray
    ) -> Tuple[float, float, np.ndarray]:
        payoffs = self.calculate_payoff(paths, payoff_spec)
        discounted = payoffs * self._discount()
        price, stderr = self._estimate(discounted, paths[-1])
        return price, stderr, payoffs

    def _price_only(self, payoff_spec: OptionPayoff) -> float:
        steps = 1 if self._is_path_independent(payoff_spec) else None
        paths = self.generate_paths(steps)
        return self._price_with_paths(payoff_spec, paths)[0]

    def price_option(
        self,
        payoff_spec: OptionPayoff,
        paths: Optional[np.ndarray] = None,
        compute_greeks: bool = False,
        keep_paths: bool = False,
    ) -> SimulationResult:
        start = time.perf_counter()
        if paths is None:
            steps = 1 if self._is_path_independent(payoff_spec) else None
            paths = self.generate_paths(steps)
        price, stderr, payoffs = self._price_with_paths(payoff_spec, paths)
        z = float(stats.norm.ppf(0.975))
        greeks = (
            self._greeks_common_random_numbers(payoff_spec) if compute_greeks else {}
        )
        return SimulationResult(
            option_price=price,
            standard_error=stderr,
            confidence_interval=(price - z * stderr, price + z * stderr),
            paths=paths if keep_paths else None,
            payoffs=payoffs if keep_paths else None,
            greeks=greeks,
            computation_time=time.perf_counter() - start,
            method_used=f"MC-{_process_value(self.params.process_type)}",
        )

    def _greeks_common_random_numbers(
        self, payoff_spec: OptionPayoff
    ) -> Dict[str, float]:
        seed = self.params.random_seed
        if seed is None:
            seed = int(self.rng.integers(0, 2**31 - 1))
        base = replace(self.params, random_seed=seed, parallel=False)

        def price_with(**changes: Any) -> float:
            return MCSimulator(replace(base, **changes))._price_only(payoff_spec)

        S = base.initial_price
        h = S * 0.01
        center = price_with()
        up = price_with(initial_price=S + h)
        down = price_with(initial_price=S - h)
        greeks = {
            "delta": (up - down) / (2.0 * h),
            "gamma": (up - 2.0 * center + down) / h**2,
        }
        vol_step = min(0.01, max(base.volatility - 1e-4, 1e-4))
        vol_up = price_with(volatility=base.volatility + vol_step)
        vol_down_value = base.volatility - vol_step
        if vol_down_value > 0:
            vol_down = price_with(volatility=vol_down_value)
            greeks["vega"] = (vol_up - vol_down) / (2.0 * vol_step) * 0.01
        else:
            greeks["vega"] = (vol_up - center) / vol_step * 0.01
        time_step = min(1.0 / 365.0, base.time_horizon / 2.0)
        shorter = price_with(time_horizon=base.time_horizon - time_step)
        greeks["theta"] = (shorter - center) / (time_step * 365.0)
        rate_up = price_with(risk_free_rate=base.risk_free_rate + 0.005)
        rate_down = price_with(risk_free_rate=base.risk_free_rate - 0.005)
        greeks["rho"] = (rate_up - rate_down) / 0.01 * 0.01
        return {k: float(v) for k, v in greeks.items()}

    def terminal_returns(self, steps: int = 1) -> np.ndarray:
        paths = self.generate_paths(steps)
        return paths[-1] / paths[0] - 1.0

    def calculate_risk_metrics(
        self, paths: np.ndarray, confidence_level: float = 0.95
    ) -> Dict[str, float]:
        if not 0.0 < confidence_level < 1.0:
            raise ValueError("Confidence level must be between 0 and 1")
        losses = -(paths[-1] / paths[0] - 1.0)
        var = float(np.quantile(losses, confidence_level))
        tail = losses[losses >= var]
        cvar = float(np.mean(tail)) if tail.size else var
        return {"VaR": var, "CVaR": cvar}

    def run_stress_test(
        self,
        payoff_spec: OptionPayoff,
        stress_scenarios: Dict[str, Dict[str, float]],
    ) -> Dict[str, float]:
        results = {}
        for name, changes in stress_scenarios.items():
            stressed = replace(self.params, **changes)
            results[name] = MCSimulator(stressed).price_option(payoff_spec).option_price
        return results

    def convergence_analysis(
        self, payoff_spec: OptionPayoff, points: int = 12
    ) -> Dict[str, List[float]]:
        sizes = np.unique(
            np.logspace(
                2, np.log10(max(self.params.num_simulations, 200)), points
            ).astype(int)
        )
        prices, errors = [], []
        for size in sizes:
            sim = MCSimulator(
                replace(
                    self.params,
                    num_simulations=int(size),
                    random_seed=self.params.random_seed,
                    parallel=False,
                )
            )
            result = sim.price_option(payoff_spec)
            prices.append(result.option_price)
            errors.append(result.standard_error)
        return {
            "num_simulations": sizes.tolist(),
            "prices": prices,
            "standard_errors": errors,
        }

    def plot_paths(self, paths: np.ndarray, num_paths_to_plot: int = 10) -> None:
        import matplotlib.pyplot as plt

        grid = np.linspace(0, self.params.time_horizon, paths.shape[0])
        plt.figure(figsize=(10, 6))
        for i in range(min(num_paths_to_plot, paths.shape[1])):
            plt.plot(grid, paths[:, i])
        plt.xlabel("Time (years)")
        plt.ylabel("Asset price")
        plt.grid(True)
        plt.show()

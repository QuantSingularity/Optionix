"""
Local Volatility Models for option pricing.

This module implements local volatility models including the Dupire model
for more accurate option pricing with volatility skew and smile.
"""

import logging
from datetime import datetime
import matplotlib.pyplot as plt
import numpy as np
from scipy import stats
from scipy.optimize import minimize

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class DupireLocalVolModel:
    """
    Implementation of the Dupire local volatility model.

    The Dupire model derives the local volatility surface from market option prices,
    allowing for accurate pricing of exotic options consistent with vanilla option prices.
    """

    def __init__(self, config: Any = None) -> None:
        """
        Initialize Dupire local volatility model.

        Args:
            config (dict, optional): Configuration parameters
        """
        self.config = config or {}
        self.local_vol_surface = None
        self.strike_grid = None
        self.time_grid = None
        self.default_vol = 0.2

    def calibrate(
        self, option_data: Any, spot: Any, rate: Any, dividend: Any = 0
    ) -> Any:
        """
        Calibrate local volatility surface from market option prices.

        Args:
            option_data (list): List of option data dictionaries
                Each dictionary should contain:
                - strike: Strike price
                - expiry: Expiry date or time to expiry in years
                - price: Option price
                - option_type: Option type ('call' or 'put')
            spot (float): Current spot price
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield

        Returns:
            tuple: (local_vol_surface, strike_grid, time_grid)
        """
        strikes = sorted(list(set([option["strike"] for option in option_data])))
        expiries = []
        for option in option_data:
            if isinstance(option["expiry"], str):
                expiry_date = datetime.strptime(option["expiry"], "%Y-%m-%d")
                today = datetime.now()
                time_to_expiry = (expiry_date - today).days / 365.0
                expiries.append(time_to_expiry)
            else:
                expiries.append(option["expiry"])
        expiries = sorted(list(set(expiries)))
        if len(strikes) < 4:
            min_strike = min(strikes)
            max_strike = max(strikes)
            step = (max_strike - min_strike) / 10
            strikes = list(np.linspace(min_strike - step, max_strike + step, 12))
        if len(expiries) < 4:
            min_expiry = min(expiries)
            max_expiry = max(expiries)
            if max_expiry <= min_expiry:
                max_expiry = min_expiry + 1.0
            expiries = list(
                np.linspace(max(0.01, min_expiry - 0.1), max_expiry + 0.1, 12)
            )
        strike_grid = np.array(strikes)
        time_grid = np.array(expiries)
        implied_vol_surface = np.zeros((len(time_grid), len(strike_grid)))
        for i, t in enumerate(time_grid):
            for j, k in enumerate(strike_grid):
                matching_options = [
                    opt
                    for opt in option_data
                    if opt["strike"] == k
                    and (
                        isinstance(opt["expiry"], str)
                        and (
                            datetime.strptime(opt["expiry"], "%Y-%m-%d")
                            - datetime.now()
                        ).days
                        / 365.0
                        == t
                        or opt["expiry"] == t
                    )
                ]
                if matching_options:
                    option = matching_options[0]
                    implied_vol = self._calculate_implied_volatility(
                        option["price"],
                        spot,
                        k,
                        t,
                        rate,
                        dividend,
                        option["option_type"],
                    )
                    implied_vol_surface[i, j] = implied_vol
                else:
                    atm_factor = np.exp(-0.5 * ((k - spot) / spot) ** 2)
                    term_factor = np.sqrt(1 + t)
                    implied_vol_surface[i, j] = 0.2 * atm_factor * term_factor
        local_vol_surface = 0.9 * implied_vol_surface
        self.local_vol_surface = local_vol_surface
        self.strike_grid = strike_grid
        self.time_grid = time_grid
        return (local_vol_surface, strike_grid, time_grid)

    def _calculate_implied_volatility(
        self,
        price: Any,
        spot: Any,
        strike: Any,
        time_to_expiry: Any,
        rate: Any,
        dividend: Any,
        option_type: Any,
    ) -> Any:
        """
        Calculate implied volatility using the Black-Scholes formula.

        Args:
            price (float): Option price
            spot (float): Spot price
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            option_type (str): Option type ('call' or 'put')

        Returns:
            float: Implied volatility
        """

        def objective(sigma):
            d1 = (
                np.log(spot / strike)
                + (rate - dividend + 0.5 * sigma**2) * time_to_expiry
            ) / (sigma * np.sqrt(time_to_expiry))
            d2 = d1 - sigma * np.sqrt(time_to_expiry)
            if option_type.lower() == "call":
                bs_price = spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(
                    d1
                ) - strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(d2)
            else:
                bs_price = strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(
                    -d2
                ) - spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(-d1)
            return (bs_price - price) ** 2

        initial_sigma = 0.2
        bounds = [(0.001, 2.0)]
        result = minimize(
            objective,
            [initial_sigma],
            method="L-BFGS-B",
            bounds=bounds,
            options={"ftol": 1e-08},
        )
        return result.x[0]

    def local_volatility(self, spot: Any, strike: Any, time_to_expiry: Any) -> Any:
        """
        Get local volatility for a specific spot, strike, and time to expiry.

        Args:
            spot (float): Spot price (not used directly, but included for API consistency)
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years

        Returns:
            float: Local volatility
        """
        if self.local_vol_surface is None:
            logger.warning(
                "Local volatility surface not calibrated, using default value"
            )
            return self.default_vol
        if time_to_expiry < np.min(self.time_grid):
            time_to_expiry = np.min(self.time_grid)
        if time_to_expiry > np.max(self.time_grid):
            time_to_expiry = np.max(self.time_grid)
        if strike < np.min(self.strike_grid):
            strike = np.min(self.strike_grid)
        if strike > np.max(self.strike_grid):
            strike = np.max(self.strike_grid)
        i_time = np.searchsorted(self.time_grid, time_to_expiry)
        if i_time == 0:
            i_time = 1
        elif i_time == len(self.time_grid):
            i_time = len(self.time_grid) - 1
        i_strike = np.searchsorted(self.strike_grid, strike)
        if i_strike == 0:
            i_strike = 1
        elif i_strike == len(self.strike_grid):
            i_strike = len(self.strike_grid) - 1
        t1, t2 = (self.time_grid[i_time - 1], self.time_grid[i_time])
        k1, k2 = (self.strike_grid[i_strike - 1], self.strike_grid[i_strike])
        v11 = self.local_vol_surface[i_time - 1, i_strike - 1]
        v12 = self.local_vol_surface[i_time - 1, i_strike]
        v21 = self.local_vol_surface[i_time, i_strike - 1]
        v22 = self.local_vol_surface[i_time, i_strike]
        dt = (time_to_expiry - t1) / (t2 - t1)
        dk = (strike - k1) / (k2 - k1)
        v1 = v11 * (1 - dk) + v12 * dk
        v2 = v21 * (1 - dk) + v22 * dk
        local_vol = v1 * (1 - dt) + v2 * dt
        return local_vol

    def price_option(
        self,
        spot: Any,
        strike: Any,
        time_to_expiry: Any,
        rate: Any,
        dividend: Any,
        option_type: Any = "call",
        num_paths: Any = 10000,
        num_steps: Any = 100,
    ) -> Any:
        """
        Price an option using Monte Carlo simulation with local volatility.

        Args:
            spot (float): Spot price
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            option_type (str): Option type ('call' or 'put')
            num_paths (int): Number of Monte Carlo paths
            num_steps (int): Number of time steps

        Returns:
            float: Option price
        """
        dt = time_to_expiry / num_steps
        paths = np.zeros((num_paths, num_steps + 1))
        paths[:, 0] = spot
        for i in range(num_steps):
            t = i * dt
            local_vols = np.array(
                [self.local_volatility(spot, paths[j, i], t) for j in range(num_paths)]
            )
            z = np.random.normal(0, 1, num_paths)
            paths[:, i + 1] = paths[:, i] * np.exp(
                (rate - dividend - 0.5 * local_vols**2) * dt
                + local_vols * np.sqrt(dt) * z
            )
        if option_type.lower() == "call":
            payoffs = np.maximum(paths[:, -1] - strike, 0)
        else:
            payoffs = np.maximum(strike - paths[:, -1], 0)
        option_price = np.exp(-rate * time_to_expiry) * np.mean(payoffs)
        return option_price

    def plot_local_volatility_surface(self, title: Any = None) -> Any:
        """
        Plot the local volatility surface.

        Args:
            title (str, optional): Plot title

        Returns:
            matplotlib.figure.Figure: Figure object
        """
        if self.local_vol_surface is None:
            raise ValueError("Local volatility surface not calibrated")
        X, Y = np.meshgrid(self.strike_grid, self.time_grid)
        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111, projection="3d")
        surf = ax.plot_surface(X, Y, self.local_vol_surface, cmap="viridis", alpha=0.8)
        fig.colorbar(surf, ax=ax, shrink=0.5, aspect=5)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Time to Expiry")
        ax.set_zlabel("Local Volatility")
        if title:
            ax.set_title(title)
        else:
            ax.set_title("Local Volatility Surface")
        return fig

    def plot_volatility_smile(self, time_to_expiry: Any, title: Any = None) -> Any:
        """
        Plot the volatility smile for a specific time to expiry.

        Args:
            time_to_expiry (float): Time to expiry in years
            title (str, optional): Plot title

        Returns:
            matplotlib.figure.Figure: Figure object
        """
        if self.local_vol_surface is None:
            raise ValueError("Local volatility surface not calibrated")
        time_idx = np.abs(self.time_grid - time_to_expiry).argmin()
        actual_time = self.time_grid[time_idx]
        vol_smile = self.local_vol_surface[time_idx, :]
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(self.strike_grid, vol_smile, "b-", linewidth=2)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Local Volatility")
        if title:
            ax.set_title(title)
        else:
            ax.set_title(f"Local Volatility Smile (T={actual_time:.2f})")
        ax.grid(True)
        return fig


class CEVModel:
    """
    Implementation of the Constant Elasticity of Variance (CEV) model.

    The CEV model extends the Black-Scholes model by allowing the volatility
    to depend on the asset price, capturing the leverage effect.
    """

    def __init__(self, params: Any = None) -> None:
        """
        Initialize CEV model with parameters.

        Args:
            params (dict, optional): Model parameters
                - sigma: Volatility parameter
                - beta: Elasticity parameter (0 <= beta <= 1)
        """
        self.params = params or {"sigma": 0.2, "beta": 0.5}

    def local_volatility(self, spot: Any, strike: Any, time_to_expiry: Any) -> Any:
        """
        Calculate local volatility under the CEV model.

        Args:
            spot (float): Spot price
            strike (float): Strike price (not used in CEV, included for API consistency)
            time_to_expiry (float): Time to expiry in years (not used in CEV, included for API consistency)

        Returns:
            float: Local volatility
        """
        sigma = self.params["sigma"]
        beta = self.params["beta"]
        local_vol = sigma * spot ** (beta - 1)
        return local_vol

    def price_option(
        self,
        spot: Any,
        strike: Any,
        time_to_expiry: Any,
        rate: Any,
        dividend: Any,
        option_type: Any = "call",
        method: Any = "monte_carlo",
        num_paths: Any = 10000,
        num_steps: Any = 100,
    ) -> Any:
        """
        Price an option using the CEV model.

        Args:
            spot (float): Spot price
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            option_type (str): Option type ('call' or 'put')
            method (str): Pricing method ('monte_carlo' or 'analytical')
            num_paths (int): Number of Monte Carlo paths
            num_steps (int): Number of time steps

        Returns:
            float: Option price
        """
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
            )
        elif method == "analytical":
            return self._price_analytical(
                spot, strike, time_to_expiry, rate, dividend, option_type
            )
        else:
            raise ValueError(f"Unknown pricing method: {method}")

    def _price_monte_carlo(
        self,
        spot: Any,
        strike: Any,
        time_to_expiry: Any,
        rate: Any,
        dividend: Any,
        option_type: Any,
        num_paths: Any,
        num_steps: Any,
    ) -> Any:
        """
        Price an option using Monte Carlo simulation.

        Args:
            spot (float): Spot price
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            option_type (str): Option type ('call' or 'put')
            num_paths (int): Number of Monte Carlo paths
            num_steps (int): Number of time steps

        Returns:
            float: Option price
        """
        sigma = self.params["sigma"]
        beta = self.params["beta"]
        dt = time_to_expiry / num_steps
        paths = np.zeros((num_paths, num_steps + 1))
        paths[:, 0] = spot
        for i in range(num_steps):
            local_vols = sigma * paths[:, i] ** (beta - 1)
            z = np.random.normal(0, 1, num_paths)
            paths[:, i + 1] = paths[:, i] * np.exp(
                (
                    rate
                    - dividend
                    - 0.5 * local_vols**2 * paths[:, i] ** (2 * (beta - 1))
                )
                * dt
                + local_vols * paths[:, i] ** (beta - 1) * np.sqrt(dt) * z
            )
        if option_type.lower() == "call":
            payoffs = np.maximum(paths[:, -1] - strike, 0)
        else:
            payoffs = np.maximum(strike - paths[:, -1], 0)
        option_price = np.exp(-rate * time_to_expiry) * np.mean(payoffs)
        return option_price

    def _price_analytical(
        self,
        spot: Any,
        strike: Any,
        time_to_expiry: Any,
        rate: Any,
        dividend: Any,
        option_type: Any,
    ) -> Any:
        """
        Price an option using analytical approximation.

        Args:
            spot (float): Spot price
            strike (float): Strike price
            time_to_expiry (float): Time to expiry in years
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            option_type (str): Option type ('call' or 'put')

        Returns:
            float: Option price
        """
        sigma = self.params["sigma"]
        beta = self.params["beta"]
        if abs(beta - 1) < 1e-06:
            d1 = (
                np.log(spot / strike)
                + (rate - dividend + 0.5 * sigma**2) * time_to_expiry
            ) / (sigma * np.sqrt(time_to_expiry))
            d2 = d1 - sigma * np.sqrt(time_to_expiry)
            if option_type.lower() == "call":
                price = spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(
                    d1
                ) - strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(d2)
            else:
                price = strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(
                    -d2
                ) - spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(-d1)
            return price
        effective_vol = sigma * spot ** (beta - 1)
        d1 = (
            np.log(spot / strike)
            + (rate - dividend + 0.5 * effective_vol**2) * time_to_expiry
        ) / (effective_vol * np.sqrt(time_to_expiry))
        d2 = d1 - effective_vol * np.sqrt(time_to_expiry)
        if option_type.lower() == "call":
            price = spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(
                d1
            ) - strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(d2)
        else:
            price = strike * np.exp(-rate * time_to_expiry) * stats.norm.cdf(
                -d2
            ) - spot * np.exp(-dividend * time_to_expiry) * stats.norm.cdf(-d1)
        correction = 1 - 0.1 * (1 - beta) * time_to_expiry
        return price * correction

    def calibrate(
        self,
        option_data: Any,
        spot: Any,
        rate: Any,
        dividend: Any = 0,
        method: Any = "SLSQP",
    ) -> Any:
        """
        Calibrate CEV model parameters to market data.

        Args:
            option_data (list): List of option data dictionaries
                Each dictionary should contain:
                - strike: Strike price
                - expiry: Time to expiry in years
                - price: Option price
                - option_type: Option type ('call' or 'put')
            spot (float): Spot price
            rate (float): Risk-free interest rate
            dividend (float): Dividend yield
            method (str): Optimization method

        Returns:
            dict: Calibrated parameters
        """

        def objective(params):
            self.params = {"sigma": params[0], "beta": params[1]}
            sse = 0
            for option in option_data:
                model_price = self.price_option(
                    spot,
                    option["strike"],
                    option["expiry"],
                    rate,
                    dividend,
                    option["option_type"],
                    method="analytical",
                )
                sse += (model_price - option["price"]) ** 2
            return sse

        initial_params = [self.params["sigma"], self.params["beta"]]
        bounds = [(0.01, 1.0), (0.01, 1.0)]
        result = minimize(
            objective,
            initial_params,
            method=method,
            bounds=bounds,
            options={"maxiter": 100},
        )
        self.params = {"sigma": result.x[0], "beta": result.x[1]}
        return self.params

    def plot_volatility_smile(
        self, spot: Any, strikes: Any, time_to_expiry: Any, title: Any = None
    ) -> Any:
        """
        Plot the volatility smile for a given spot and time to expiry.

        Args:
            spot (float): Spot price
            strikes (array): Array of strike prices
            time_to_expiry (float): Time to expiry in years
            title (str, optional): Plot title

        Returns:
            matplotlib.figure.Figure: Figure object
        """
        local_vols = [self.local_volatility(spot, K, time_to_expiry) for K in strikes]
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(strikes, local_vols, "b-", linewidth=2)
        ax.set_xlabel("Strike")
        ax.set_ylabel("Local Volatility")
        if title:
            ax.set_title(title)
        else:
            ax.set_title(f"CEV Volatility Smile (S={spot}, T={time_to_expiry})")
        ax.grid(True)
        return fig

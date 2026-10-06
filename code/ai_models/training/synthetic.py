import numpy as np
import pandas as pd

from ..config import RANDOM_STATE
from ..quantitative.advanced.stochastic_volatility import HestonModel

SUBSTEPS = 24


def synthetic_ohlc(
    bars: int = 6000, seed: int = RANDOM_STATE, bar_years: float = 1.0 / 365.0
) -> pd.DataFrame:
    model = HestonModel(
        {"v0": 0.25**2, "kappa": 3.0, "theta": 0.30**2, "sigma": 0.8, "rho": -0.6}
    )
    steps = bars * SUBSTEPS
    prices, variances, _ = model.simulate_paths(
        100.0, bars * bar_years, 0.0, 0.0, num_paths=1, num_steps=steps, seed=seed
    )
    path = prices[0, 1:].reshape(bars, SUBSTEPS)
    opens = np.concatenate([[100.0], path[:-1, -1]])
    closes = path[:, -1]
    highs = np.maximum(path.max(axis=1), opens)
    lows = np.minimum(path.min(axis=1), opens)
    rng = np.random.default_rng(seed)
    volume = np.exp(rng.normal(12.0, 0.4, bars)) * (
        1.0 + 5.0 * np.abs(np.log(closes / opens))
    )
    return pd.DataFrame(
        {"open": opens, "high": highs, "low": lows, "close": closes, "volume": volume}
    )

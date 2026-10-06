import logging
from typing import Tuple

import numpy as np
import pandas as pd

from ..config import DEFAULT_HORIZON
from .features import bar_features

logger = logging.getLogger(__name__)


def build_dataset(
    frame: pd.DataFrame, horizon: int = DEFAULT_HORIZON
) -> Tuple[np.ndarray, np.ndarray]:
    missing = [c for c in ("open", "high", "low", "close") if c not in frame.columns]
    if missing:
        raise ValueError(f"Dataset is missing columns: {missing}")
    if horizon < 2:
        raise ValueError("Horizon must be at least 2")
    data = frame[["open", "high", "low", "close"]].astype(float)
    data = data[(data > 0).all(axis=1)].reset_index(drop=True)
    data = data[
        (data["high"] >= data[["open", "close"]].max(axis=1))
        & (data["low"] <= data[["open", "close"]].min(axis=1))
    ].reset_index(drop=True)
    if len(data) < horizon + 50:
        raise ValueError("Not enough clean rows to build a training set")
    log_close = np.log(data["close"].to_numpy())
    returns = pd.Series(np.diff(log_close, prepend=np.nan))
    forward = returns.shift(-1).rolling(horizon).std(ddof=1).shift(-(horizon - 1))
    features = bar_features(
        data["open"].to_numpy(),
        data["high"].to_numpy(),
        data["low"].to_numpy(),
        data["close"].to_numpy(),
    )
    target = forward.to_numpy()
    mask = np.isfinite(target) & np.isfinite(features).all(axis=1)
    return features[mask], target[mask]

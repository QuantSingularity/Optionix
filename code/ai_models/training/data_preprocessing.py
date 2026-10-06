from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

REQUIRED_COLUMNS = ("open", "high", "low", "close", "volume")


def load_market_csv(filepath: str) -> pd.DataFrame:
    frame = pd.read_csv(filepath)
    frame.columns = [str(c).strip().lower() for c in frame.columns]
    missing = [c for c in REQUIRED_COLUMNS if c not in frame.columns]
    if missing:
        raise ValueError(f"Dataset is missing columns: {missing}")
    if "timestamp" in frame.columns:
        frame["timestamp"] = pd.to_datetime(
            frame["timestamp"], utc=True, errors="coerce"
        )
        frame = frame.dropna(subset=["timestamp"]).sort_values("timestamp")
    numeric = list(REQUIRED_COLUMNS)
    frame[numeric] = frame[numeric].apply(pd.to_numeric, errors="coerce")
    frame = frame.dropna(subset=numeric)
    return frame.reset_index(drop=True)


def preprocess_data(
    filepath: str, window: int = 30, periods_per_year: float = 365.0
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    df = load_market_csv(filepath)
    df = df[df["close"] > 0].reset_index(drop=True)
    df["log_returns"] = np.log(df["close"] / df["close"].shift(1))
    df["volatility_30d"] = df["log_returns"].rolling(window).std() * np.sqrt(
        periods_per_year
    )
    df = df.dropna().reset_index(drop=True)
    train, test = train_test_split(df, test_size=0.2, shuffle=False)
    return train, test


def create_sequences(
    data: np.ndarray, window: int = 60
) -> Tuple[np.ndarray, np.ndarray]:
    array = np.asarray(data, dtype=float)
    if array.ndim != 2 or array.shape[1] < 2:
        raise ValueError("Data must be 2-dimensional with at least two columns")
    if len(array) <= window:
        raise ValueError("Not enough rows for the requested window")
    X = np.stack([array[i - window : i, :-1] for i in range(window, len(array))])
    y = array[window:, -1]
    return X, y

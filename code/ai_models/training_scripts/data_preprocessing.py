from typing import Any

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def preprocess_data(filepath: Any) -> Any:
    df = pd.read_csv(filepath)
    df["log_returns"] = np.log(df["close"] / df["close"].shift(1))
    df["volatility_30d"] = df["log_returns"].rolling(30).std() * np.sqrt(365)
    df = df.dropna()
    train, test = train_test_split(df, test_size=0.2, shuffle=False)
    return (train, test)


def create_sequences(data: Any, window: Any = 60) -> Any:
    X, y = ([], [])
    for i in range(window, len(data)):
        X.append(data[i - window : i, :-1])
        y.append(data[i, -1])
    return (np.array(X), np.array(y))

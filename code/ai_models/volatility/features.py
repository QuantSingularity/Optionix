from typing import Dict, Mapping, Sequence

import numpy as np

FEATURE_NAMES = (
    "hl_range",
    "oc_return",
    "abs_oc_return",
    "upper_wick",
    "lower_wick",
)

PERIODS_PER_YEAR: Dict[str, float] = {
    "1m": 365.0 * 24 * 60,
    "5m": 365.0 * 24 * 12,
    "15m": 365.0 * 24 * 4,
    "1h": 365.0 * 24,
    "4h": 365.0 * 6,
    "1d": 365.0,
}

REQUIRED_BAR_FIELDS = ("open", "high", "low", "close")


def periods_per_year(timeframe: str) -> float:
    try:
        return PERIODS_PER_YEAR[timeframe]
    except KeyError:
        raise ValueError(f"Unsupported timeframe: {timeframe}")


def annualization_factor(timeframe: str) -> float:
    return float(np.sqrt(periods_per_year(timeframe)))


def validate_bar(bar: Mapping[str, float]) -> Dict[str, float]:
    cleaned: Dict[str, float] = {}
    for field in ("open", "high", "low"):
        if field not in bar or bar[field] is None:
            raise ValueError(f"Missing required field: {field}")
        value = float(bar[field])
        if not np.isfinite(value) or value <= 0:
            raise ValueError(f"Field {field} must be positive")
        cleaned[field] = value
    close = bar.get("close")
    cleaned["close"] = float(close) if close else cleaned["open"]
    if not np.isfinite(cleaned["close"]) or cleaned["close"] <= 0:
        raise ValueError("Field close must be positive")
    volume = float(bar.get("volume", 0.0) or 0.0)
    if not np.isfinite(volume) or volume < 0:
        raise ValueError("Field volume cannot be negative")
    cleaned["volume"] = volume
    if cleaned["high"] < cleaned["low"]:
        raise ValueError("High price must be >= low price")
    top = max(cleaned["open"], cleaned["close"])
    bottom = min(cleaned["open"], cleaned["close"])
    if cleaned["high"] < top or cleaned["low"] > bottom:
        raise ValueError("Open and close must lie within the high-low range")
    return cleaned


def bar_features(
    open_: np.ndarray,
    high: np.ndarray,
    low: np.ndarray,
    close: np.ndarray,
) -> np.ndarray:
    o = np.asarray(open_, dtype=float)
    h = np.asarray(high, dtype=float)
    l = np.asarray(low, dtype=float)
    c = np.asarray(close, dtype=float)
    top = np.maximum(o, c)
    bottom = np.minimum(o, c)
    oc = np.log(c / o)
    columns = [
        np.log(h / l),
        oc,
        np.abs(oc),
        np.log(h / top),
        np.log(bottom / l),
    ]
    return np.column_stack(columns)


def bar_features_from_mapping(bar: Mapping[str, float]) -> np.ndarray:
    cleaned = validate_bar(bar)
    return bar_features(
        np.array([cleaned["open"]]),
        np.array([cleaned["high"]]),
        np.array([cleaned["low"]]),
        np.array([cleaned["close"]]),
    )


def parkinson_volatility(high: float, low: float) -> float:
    if low <= 0 or high < low:
        raise ValueError("Invalid high/low prices")
    return float(np.sqrt(np.log(high / low) ** 2 / (4.0 * np.log(2.0))))


def garman_klass_volatility(
    open_: float, high: float, low: float, close: float
) -> float:
    hl = np.log(high / low)
    co = np.log(close / open_)
    variance = 0.5 * hl**2 - (2.0 * np.log(2.0) - 1.0) * co**2
    return float(np.sqrt(max(variance, 0.0)))


def realized_volatility(log_returns: Sequence[float], periods: int = 0) -> float:
    arr = np.asarray(log_returns, dtype=float)
    if arr.size < 2:
        raise ValueError("At least two returns are required")
    return float(np.std(arr, ddof=1))

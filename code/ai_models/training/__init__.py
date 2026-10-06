import importlib
from typing import Any, Dict

_LAZY: Dict[str, str] = {
    "create_sequences": ".data_preprocessing",
    "load_market_csv": ".data_preprocessing",
    "preprocess_data": ".data_preprocessing",
    "generate": ".generate_artifacts",
    "synthetic_ohlc": ".synthetic",
    "train_model": ".train_volatility_model",
}

__all__ = list(_LAZY)


def __getattr__(name: str) -> Any:
    module = _LAZY.get(name)
    if module is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(importlib.import_module(module, __name__), name)
    globals()[name] = value
    return value

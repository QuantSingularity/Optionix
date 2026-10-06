import importlib
from typing import Any, Dict

from .config import MODEL_VERSION as __version__

_LAZY: Dict[str, str] = {
    "ModelService": ".models",
    "ModelType": ".models",
    "ModelStatus": ".models",
    "RiskLevel": ".models",
    "VolatilityModel": ".models",
    "FraudDetectionModel": ".models",
    "VolatilityPredictor": ".volatility.inference",
    "BlackScholesModel": ".quantitative",
    "OptionParameters": ".quantitative",
    "OptionType": ".quantitative",
    "OptionStyle": ".quantitative",
    "BarrierType": ".quantitative",
    "MCSimulator": ".quantitative",
    "SimulationParameters": ".quantitative",
    "OptionPayoff": ".quantitative",
    "bs_price": ".quantitative",
    "implied_volatility_from_price": ".quantitative",
}

__all__ = ["__version__", "AIModelService", *_LAZY]


def __getattr__(name: str) -> Any:
    if name == "AIModelService":
        return __getattr__("ModelService")
    module = _LAZY.get(name)
    if module is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(importlib.import_module(module, __name__), name)
    globals()[name] = value
    return value

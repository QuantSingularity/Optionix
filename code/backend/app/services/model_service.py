import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..config import settings
from .ai_bridge import ai_submodule, default_artifact_dir, load_ai_models

logger = logging.getLogger(__name__)


class ModelService:
    def __init__(
        self,
        artifact_dir: Optional[str] = None,
        auto_generate: Optional[bool] = None,
    ) -> None:
        self._lock = threading.Lock()
        self.auto_generate = (
            settings.model_auto_generate if auto_generate is None else auto_generate
        )
        self._predictor: Any = None
        self._artifact_dir: Optional[str] = artifact_dir
        self._init_error: Optional[str] = None
        self._initialize()

    def _initialize(self) -> None:
        try:
            load_ai_models()
            directory = self._artifact_dir or default_artifact_dir()
            self._artifact_dir = directory
            predictor = ai_submodule("volatility.inference").VolatilityPredictor(
                directory
            )
            if not predictor.available and self.auto_generate:
                logger.info("Generating volatility model artifacts in %s", directory)
                ai_submodule("training.generate_artifacts").generate(directory)
                predictor.load(directory)
            self._predictor = predictor
            if not predictor.available:
                logger.warning(
                    "Volatility model unavailable (%s); using statistical fallback",
                    predictor.load_error,
                )
        except Exception as exc:
            self._init_error = str(exc)
            self._predictor = None
            logger.error("AI model initialisation failed: %s", exc)

    def reload(self) -> bool:
        with self._lock:
            self._init_error = None
            self._initialize()
            return self.is_model_available()

    @property
    def artifact_dir(self) -> Optional[str]:
        return self._artifact_dir

    def is_model_available(self) -> bool:
        return bool(self._predictor is not None and self._predictor.available)

    def _validated_bar(self, market_data: Dict[str, Any]) -> Dict[str, float]:
        return ai_submodule("volatility.features").validate_bar(market_data)

    def get_volatility_prediction(
        self, market_data: Dict[str, Any], db: Any = None
    ) -> Dict[str, Any]:
        if self._predictor is None:
            raise ValueError(f"Volatility engine unavailable: {self._init_error}")
        timeframe = str(market_data.get("timeframe") or "1d")
        bar = self._validated_bar(market_data)
        try:
            result = self._predictor.predict(bar, timeframe)
        except ValueError:
            raise
        except Exception as exc:
            logger.error("Prediction error: %s", exc)
            raise ValueError(f"Prediction failed: {exc}")
        return {
            "volatility": result["volatility"],
            "confidence": result["confidence"],
            "model_version": result["model_version"],
            "method": result["method"],
            "timeframe": timeframe,
            "prediction_timestamp": datetime.now(timezone.utc)
            .replace(tzinfo=None)
            .isoformat(),
            "features_used": list(ai_submodule("volatility.features").FEATURE_NAMES),
        }

    def get_model_info(self) -> Dict[str, Any]:
        info: Dict[str, Any] = (
            self._predictor.info()
            if self._predictor is not None
            else {"model_available": False}
        )
        info["artifact_dir"] = self._artifact_dir
        info["engine_error"] = self._init_error
        info["fallback_active"] = not self.is_model_available()
        return info


_service: Optional[ModelService] = None
_service_lock = threading.Lock()


def get_model_service() -> ModelService:
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                _service = ModelService()
    return _service


def reset_model_service() -> None:
    global _service
    with _service_lock:
        _service = None

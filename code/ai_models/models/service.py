import logging
import threading
from dataclasses import asdict
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

import pandas as pd

from .fraud_model import FraudDetectionModel
from .schemas import (
    ModelMetadata,
    ModelPrediction,
    ModelType,
    ModelValidationResult,
    _now,
)
from .volatility_model import VolatilityModel

logger = logging.getLogger(__name__)


class ModelService:
    def __init__(self) -> None:
        self.models: Dict[str, Any] = {}
        self.model_registry: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def register_model(self, model_id: str, model_type: ModelType) -> bool:
        with self._lock:
            try:
                if model_type == ModelType.VOLATILITY_PREDICTION:
                    model: Any = VolatilityModel(model_id)
                elif model_type == ModelType.FRAUD_DETECTION:
                    model = FraudDetectionModel(model_id)
                else:
                    raise ValueError(f"Unsupported model type: {model_type}")
            except ValueError as exc:
                logger.error("Model registration failed: %s", exc)
                return False
            self.models[model_id] = model
            self.model_registry[model_id] = {
                "model_type": model_type,
                "created_at": _now(),
                "status": "registered",
            }
            return True

    def _get(self, model_id: str) -> Any:
        with self._lock:
            if model_id not in self.models:
                raise ValueError(f"Model {model_id} not found")
            return self.models[model_id]

    def train_model(
        self, model_id: str, data: pd.DataFrame, **kwargs: Any
    ) -> ModelValidationResult:
        model = self._get(model_id)
        result = model.train(data, **kwargs)
        with self._lock:
            self.model_registry[model_id]["status"] = (
                "trained" if result.passed else "failed_validation"
            )
        return result

    def predict(self, model_id: str, data: pd.DataFrame) -> ModelPrediction:
        return self._get(model_id).predict(data)

    def get_model_metadata(self, model_id: str) -> Optional[ModelMetadata]:
        with self._lock:
            model = self.models.get(model_id)
        return model.metadata if model else None

    def list_models(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            return {k: dict(v) for k, v in self.model_registry.items()}

    def metadata_as_dict(self, model_id: str) -> Optional[Dict[str, Any]]:
        metadata = self.get_model_metadata(model_id)
        if metadata is None:
            return None
        payload = asdict(metadata)
        for key, value in payload.items():
            if isinstance(value, Enum):
                payload[key] = value.value
            elif isinstance(value, datetime):
                payload[key] = value.isoformat()
        return payload


model_service = ModelService()

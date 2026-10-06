import json
import logging
import os
import threading
from typing import Any, Dict, Mapping, Optional

import joblib
import numpy as np

from ..config import METADATA_FILENAME, MODEL_FILENAME
from .artifacts import sha256_file
from .features import (
    FEATURE_NAMES,
    annualization_factor,
    bar_features_from_mapping,
    garman_klass_volatility,
    parkinson_volatility,
    validate_bar,
)

logger = logging.getLogger(__name__)

MIN_VOLATILITY = 0.001
MAX_VOLATILITY = 5.0


class VolatilityPredictor:
    def __init__(self, artifact_dir: Optional[str] = None) -> None:
        self.artifact_dir = artifact_dir
        self.pipeline: Optional[Any] = None
        self.metadata: Dict[str, Any] = {}
        self.model_hash: Optional[str] = None
        self.load_error: Optional[str] = None
        self._lock = threading.Lock()
        if artifact_dir:
            self.load(artifact_dir)

    @property
    def available(self) -> bool:
        return self.pipeline is not None

    def load(self, artifact_dir: str) -> bool:
        with self._lock:
            self.pipeline = None
            self.metadata = {}
            self.model_hash = None
            self.load_error = None
            self.artifact_dir = artifact_dir
            model_path = os.path.join(artifact_dir, MODEL_FILENAME)
            metadata_path = os.path.join(artifact_dir, METADATA_FILENAME)
            if not os.path.isfile(model_path):
                self.load_error = "model artifact not found"
                return False
            if not os.path.isfile(metadata_path):
                self.load_error = "model metadata not found"
                return False
            try:
                with open(metadata_path, "r", encoding="utf-8") as handle:
                    metadata = json.load(handle)
                expected = metadata.get("artifact_sha256")
                actual = sha256_file(model_path)
                if not expected or expected != actual:
                    self.load_error = "model integrity check failed"
                    logger.error("Volatility model hash mismatch; refusing to load")
                    return False
                if list(metadata.get("features", [])) != list(FEATURE_NAMES):
                    self.load_error = "model feature contract mismatch"
                    logger.error("Volatility model features do not match the code")
                    return False
                self.pipeline = joblib.load(model_path)
                self.metadata = metadata
                self.model_hash = actual
                return True
            except Exception as exc:
                self.pipeline = None
                self.load_error = f"model load failed: {exc}"
                logger.error("Volatility model load failed: %s", exc)
                return False

    def statistical_estimate(self, bar: Mapping[str, float], timeframe: str) -> float:
        cleaned = validate_bar(bar)
        per_bar = 0.5 * (
            parkinson_volatility(cleaned["high"], cleaned["low"])
            + garman_klass_volatility(
                cleaned["open"], cleaned["high"], cleaned["low"], cleaned["close"]
            )
        )
        return self._clip(per_bar * annualization_factor(timeframe))

    @staticmethod
    def _clip(value: float) -> float:
        return float(min(max(value, MIN_VOLATILITY), MAX_VOLATILITY))

    def predict(
        self, bar: Mapping[str, float], timeframe: str = "1d"
    ) -> Dict[str, Any]:
        factor = annualization_factor(timeframe)
        if not self.available:
            return {
                "volatility": self.statistical_estimate(bar, timeframe),
                "confidence": None,
                "model_version": "fallback_statistical",
                "method": "statistical",
            }
        features = bar_features_from_mapping(bar)
        with self._lock:
            pipeline = self.pipeline
        per_bar = float(pipeline.predict(features)[0])
        confidence = self._confidence(pipeline, features, per_bar)
        return {
            "volatility": self._clip(max(per_bar, 0.0) * factor),
            "confidence": confidence,
            "model_version": self.metadata.get("version", "unknown"),
            "method": "model",
        }

    @staticmethod
    def _confidence(
        pipeline: Any, features: np.ndarray, mean_prediction: float
    ) -> Optional[float]:
        try:
            model = pipeline.steps[-1][1]
            estimators = getattr(model, "estimators_", None)
            if not estimators:
                return None
            transformed = features
            for _, step in pipeline.steps[:-1]:
                transformed = step.transform(transformed)
            tree_predictions = np.array([t.predict(transformed)[0] for t in estimators])
            spread = float(np.std(tree_predictions))
            denominator = max(abs(mean_prediction), 1e-8)
            return float(1.0 / (1.0 + spread / denominator))
        except Exception as exc:
            logger.debug("Confidence estimation failed: %s", exc)
            return None

    def info(self) -> Dict[str, Any]:
        return {
            "model_available": self.available,
            "model_version": self.metadata.get("version"),
            "model_type": self.metadata.get("model_type"),
            "model_hash": self.model_hash,
            "metrics": self.metadata.get("metrics"),
            "features": self.metadata.get("features"),
            "load_error": self.load_error,
        }

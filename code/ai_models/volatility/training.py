from typing import Dict, Tuple

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler

from ..config import RANDOM_STATE


def make_pipeline(random_state: int = RANDOM_STATE) -> Pipeline:
    return Pipeline(
        [
            ("scaler", RobustScaler()),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=200,
                    max_depth=8,
                    min_samples_leaf=5,
                    n_jobs=-1,
                    random_state=random_state,
                ),
            ),
        ]
    )


def train_pipeline(
    features: np.ndarray,
    target: np.ndarray,
    test_fraction: float = 0.2,
    random_state: int = RANDOM_STATE,
) -> Tuple[Pipeline, Dict[str, float]]:
    if not 0.05 <= test_fraction <= 0.5:
        raise ValueError("test_fraction must be between 0.05 and 0.5")
    split = int(len(features) * (1.0 - test_fraction))
    if split < 50 or len(features) - split < 10:
        raise ValueError("Not enough samples to train and validate")
    pipeline = make_pipeline(random_state)
    pipeline.fit(features[:split], target[:split])
    predictions = pipeline.predict(features[split:])
    baseline = np.full_like(predictions, np.mean(target[:split]))
    metrics = {
        "test_r2": float(r2_score(target[split:], predictions)),
        "test_mae": float(mean_absolute_error(target[split:], predictions)),
        "baseline_mae": float(mean_absolute_error(target[split:], baseline)),
        "train_samples": int(split),
        "test_samples": int(len(features) - split),
    }
    pipeline.fit(features, target)
    return pipeline, metrics

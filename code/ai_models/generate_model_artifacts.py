"""
Model Artifact Generator for Optionix Platform
===============================================
Run this script once to generate the binary model artifacts that are
excluded from version control (.h5, .pkl).

Usage:
    python generate_model_artifacts.py

This creates:
    - volatility_model.pkl   (lightweight sklearn fallback model)
    - feature_scaler.pkl     (StandardScaler fitted on synthetic data)
    - volatility_model.h5    (Keras model — only if TensorFlow is available)
    - volatility_model_metadata.json
"""

import json
import logging
import os
from datetime import datetime, timezone

import numpy as np

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Synthetic training data
# ---------------------------------------------------------------------------
SEED = 42
N_SAMPLES = 5_000

rng = np.random.default_rng(SEED)

features = {
    "open": rng.uniform(100, 500, N_SAMPLES),
    "high": rng.uniform(100, 500, N_SAMPLES),
    "low": rng.uniform(100, 500, N_SAMPLES),
    "volume": rng.uniform(1_000, 1_000_000, N_SAMPLES),
}
# Enforce OHLC ordering
features["high"] = np.maximum(features["open"], features["high"]) * 1.01
features["low"] = np.minimum(features["open"], features["low"]) * 0.99

X = np.column_stack(
    [features["open"], features["high"], features["low"], features["volume"]]
)

# Target: simulated realised volatility (range / mid-price)
mid = (features["high"] + features["low"]) / 2
y_vol = (features["high"] - features["low"]) / mid + rng.normal(0, 0.005, N_SAMPLES)
y_vol = np.clip(y_vol, 0.001, 0.999)


def generate_sklearn_model() -> None:
    """Train and persist a GradientBoosting volatility model."""
    try:
        import joblib
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler

        logger.info("Training sklearn GradientBoosting volatility model…")
        pipeline = Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "model",
                    GradientBoostingRegressor(
                        n_estimators=200,
                        learning_rate=0.05,
                        max_depth=4,
                        random_state=SEED,
                    ),
                ),
            ]
        )
        pipeline.fit(X, y_vol)

        # Persist full pipeline
        model_path = os.path.join(OUTPUT_DIR, "volatility_model.pkl")
        joblib.dump(pipeline, model_path)
        logger.info("Saved: %s", model_path)

        # Persist standalone scaler (kept for backward compat)
        scaler = StandardScaler().fit(X)
        scaler_path = os.path.join(OUTPUT_DIR, "feature_scaler.pkl")
        joblib.dump(scaler, scaler_path)
        logger.info("Saved: %s", scaler_path)

    except ImportError as exc:
        logger.warning(
            "sklearn/joblib not available — skipping pkl generation: %s", exc
        )


def generate_keras_model() -> None:
    """Train and persist a Keras LSTM volatility model (optional)."""
    try:
        import tensorflow as tf
        from sklearn.preprocessing import StandardScaler

        logger.info("Building Keras LSTM volatility model…")
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_seq = X_scaled.reshape(-1, 1, X_scaled.shape[1])

        model = tf.keras.Sequential(
            [
                tf.keras.layers.LSTM(
                    64, input_shape=(1, X.shape[1]), return_sequences=False
                ),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(32, activation="relu"),
                tf.keras.layers.Dense(1, activation="sigmoid"),
            ]
        )
        model.compile(optimizer="adam", loss="mse", metrics=["mae"])
        model.fit(X_seq, y_vol, epochs=5, batch_size=128, verbose=0)

        keras_path = os.path.join(OUTPUT_DIR, "volatility_model.h5")
        model.save(keras_path)
        logger.info("Saved: %s", keras_path)

    except ImportError:
        logger.info("TensorFlow not installed — skipping .h5 generation (optional).")


def generate_metadata() -> None:
    """Write model metadata JSON."""
    metadata = {
        "model_type": "GradientBoostingRegressor",
        "version": "1.0.0",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "features": ["open", "high", "low", "volume"],
        "target": "volatility",
        "training_samples": N_SAMPLES,
        "description": (
            "Volatility prediction model trained on synthetic OHLCV data. "
            "Replace with real market data for production use."
        ),
    }
    path = os.path.join(OUTPUT_DIR, "volatility_model_metadata.json")
    with open(path, "w") as f:
        json.dump(metadata, f, indent=2)
    logger.info("Saved: %s", path)


if __name__ == "__main__":
    logger.info("=== Optionix Model Artifact Generator ===")
    generate_sklearn_model()
    generate_keras_model()
    generate_metadata()
    logger.info("Done. Artifacts written to: %s", OUTPUT_DIR)

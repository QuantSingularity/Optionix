import hashlib
import logging
from typing import Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import RobustScaler

from ..config import RANDOM_STATE
from .schemas import (
    ModelMetadata,
    ModelPrediction,
    ModelStatus,
    ModelType,
    ModelValidationResult,
    RiskLevel,
    _frame_hash,
    _now,
)

logger = logging.getLogger(__name__)


class VolatilityModel:
    LAGS = (1, 2, 3, 5, 10)
    WINDOW = 20

    def __init__(self, model_id: str = "volatility_v2", horizon: int = 5) -> None:
        self.model_id = model_id
        self.horizon = horizon
        self.model: Optional[RandomForestRegressor] = None
        self.scaler: Optional[RobustScaler] = None
        self.feature_selector: Optional[SelectKBest] = None
        self.metadata: Optional[ModelMetadata] = None
        self.feature_columns: List[str] = []
        self.is_trained = False

    def _base_features(self, data: pd.DataFrame) -> pd.DataFrame:
        required = {"open", "high", "low", "close", "volume"}
        missing = required - set(data.columns)
        if missing:
            raise ValueError(f"Data is missing columns: {sorted(missing)}")
        f = pd.DataFrame(index=data.index)
        close = data["close"].astype(float)
        f["log_returns"] = np.log(close / close.shift(1))
        f["abs_returns"] = f["log_returns"].abs()
        f["hl_range"] = np.log(data["high"].astype(float) / data["low"].astype(float))
        f["oc_return"] = np.log(close / data["open"].astype(float))
        f["realized_volatility"] = f["log_returns"].rolling(self.WINDOW).std()
        f["range_volatility"] = f["hl_range"].rolling(self.WINDOW).mean()
        volume = data["volume"].astype(float)
        volume_ma = volume.rolling(self.WINDOW).mean()
        f["volume_ratio"] = volume / volume_ma.replace(0.0, np.nan)
        if isinstance(data.index, pd.DatetimeIndex):
            f["day_of_week"] = data.index.dayofweek
            f["hour"] = data.index.hour
        for lag in self.LAGS:
            f[f"returns_lag_{lag}"] = f["log_returns"].shift(lag)
            f[f"volatility_lag_{lag}"] = f["realized_volatility"].shift(lag)
        return f.replace([np.inf, -np.inf], np.nan)

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        return self._base_features(data).dropna()

    def _target(self, data: pd.DataFrame) -> pd.Series:
        returns = np.log(
            data["close"].astype(float) / data["close"].astype(float).shift(1)
        )
        forward = (
            returns.shift(-1).rolling(self.horizon).std().shift(-(self.horizon - 1))
        )
        return forward

    def train(
        self, data: pd.DataFrame, target_column: str = "forward_volatility"
    ) -> ModelValidationResult:
        features = self._base_features(data)
        features[target_column] = self._target(data)
        dataset = features.dropna()
        if len(dataset) < 100:
            raise ValueError("At least 100 usable rows are required for training")
        columns = [c for c in dataset.columns if c != target_column]
        X = dataset[columns]
        y = dataset[target_column]
        split = int(len(dataset) * 0.8)
        selector = SelectKBest(score_func=f_regression, k=min(20, len(columns)))
        selector.fit(X.iloc[:split], y.iloc[:split])
        selected = [columns[i] for i in selector.get_support(indices=True)]
        scaler = RobustScaler().fit(X.iloc[:split][selected])
        model = RandomForestRegressor(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            n_jobs=-1,
            random_state=RANDOM_STATE,
        )
        model.fit(scaler.transform(X.iloc[:split][selected]), y.iloc[:split])
        predicted = model.predict(scaler.transform(X.iloc[split:][selected]))
        metrics = {
            "test_mse": float(mean_squared_error(y.iloc[split:], predicted)),
            "test_mae": float(mean_absolute_error(y.iloc[split:], predicted)),
            "test_r2": float(r2_score(y.iloc[split:], predicted)),
        }
        final_scaler = RobustScaler().fit(X[selected])
        final_model = RandomForestRegressor(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=5,
            n_jobs=-1,
            random_state=RANDOM_STATE,
        )
        final_model.fit(final_scaler.transform(X[selected]), y)
        self.feature_selector = selector
        self.scaler = final_scaler
        self.model = final_model
        self.feature_columns = selected
        self.is_trained = True
        passed = metrics["test_r2"] > 0.0
        self.metadata = ModelMetadata(
            model_id=self.model_id,
            model_name="Volatility Prediction Model",
            model_type=ModelType.VOLATILITY_PREDICTION,
            version="2.1.0",
            created_by="system",
            created_at=_now(),
            last_updated=_now(),
            status=ModelStatus.VALIDATION if passed else ModelStatus.FAILED,
            risk_level=RiskLevel.MEDIUM,
            description="Forward realized volatility forecast using a random forest",
            features=selected,
            target_variable=target_column,
            training_data_hash=_frame_hash(data),
            validation_metrics=metrics,
            compliance_checks={
                "data_quality": True,
                "feature_validation": True,
                "out_of_sample_validation": True,
                "bias_testing": False,
            },
            approval_status="pending",
            approved_by=None,
            approval_date=None,
        )
        result = ModelValidationResult(
            model_id=self.model_id,
            validation_type="training_validation",
            metrics=metrics,
            passed=passed,
        )
        if not passed:
            result.issues.append("Out-of-sample R2 is not positive")
            result.recommendations.append("Add more data or revisit the features")
        return result

    def predict(self, data: pd.DataFrame) -> ModelPrediction:
        if not self.is_trained or self.model is None or self.metadata is None:
            raise ValueError("Model must be trained before making predictions")
        features = self.prepare_features(data)
        if features.empty:
            raise ValueError("Not enough history to compute features")
        row = features[self.feature_columns].iloc[[-1]]
        scaled = self.scaler.transform(row)
        prediction = float(self.model.predict(scaled)[0])
        tree_predictions = np.array(
            [t.predict(scaled)[0] for t in self.model.estimators_]
        )
        confidence = float(
            1.0 / (1.0 + np.std(tree_predictions) / max(abs(prediction), 1e-8))
        )
        importance = {
            name: float(value)
            for name, value in zip(
                self.feature_columns, self.model.feature_importances_
            )
        }
        return ModelPrediction(
            model_id=self.model_id,
            prediction=prediction,
            confidence=confidence,
            feature_importance=importance,
            explanation=self._explain(prediction, importance),
            timestamp=_now(),
            input_hash=hashlib.sha256(
                row.to_numpy().astype(float).tobytes()
            ).hexdigest(),
        )

    @staticmethod
    def _explain(prediction: float, importance: Dict[str, float]) -> str:
        top = sorted(importance.items(), key=lambda kv: kv[1], reverse=True)[:3]
        text = f"Predicted per-bar volatility: {prediction:.4f}."
        if top:
            text += " Key factors: " + ", ".join(f"{k} ({v:.3f})" for k, v in top) + "."
        return text

    def save(self, path: str) -> None:
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")
        joblib.dump(
            {
                "model_id": self.model_id,
                "horizon": self.horizon,
                "model": self.model,
                "scaler": self.scaler,
                "selector": self.feature_selector,
                "columns": self.feature_columns,
                "metadata": self.metadata,
            },
            path,
        )

    def load(self, path: str, expected_sha256: Optional[str] = None) -> None:
        if expected_sha256:
            digest = hashlib.sha256()
            with open(path, "rb") as handle:
                digest.update(handle.read())
            if digest.hexdigest() != expected_sha256:
                raise ValueError("Model integrity check failed")
        payload = joblib.load(path)
        self.model_id = payload["model_id"]
        self.horizon = payload["horizon"]
        self.model = payload["model"]
        self.scaler = payload["scaler"]
        self.feature_selector = payload["selector"]
        self.feature_columns = payload["columns"]
        self.metadata = payload["metadata"]
        self.is_trained = True

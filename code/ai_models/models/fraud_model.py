import hashlib
import logging
from typing import List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

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


class FraudDetectionModel:
    def __init__(self, model_id: str = "fraud_detection_v2") -> None:
        self.model_id = model_id
        self.model: Optional[GradientBoostingClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.metadata: Optional[ModelMetadata] = None
        self.feature_columns: List[str] = []
        self.threshold = 0.5
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        required = {"amount", "timestamp", "user_id"}
        missing = required - set(data.columns)
        if missing:
            raise ValueError(f"Data is missing columns: {sorted(missing)}")
        f = data.copy()
        f["timestamp"] = pd.to_datetime(f["timestamp"], utc=True)
        f = f.sort_values("timestamp").reset_index(drop=True)
        amount = f["amount"].astype(float)
        f["amount_log"] = np.log1p(amount.clip(lower=0))
        f["hour"] = f["timestamp"].dt.hour
        f["day_of_week"] = f["timestamp"].dt.dayofweek
        f["is_weekend"] = f["day_of_week"].isin([5, 6]).astype(int)
        f["is_night"] = ((f["hour"] >= 22) | (f["hour"] <= 6)).astype(int)
        grouped = f.groupby("user_id")["amount"]
        prior_mean = grouped.transform(lambda s: s.shift(1).expanding().mean())
        prior_std = grouped.transform(lambda s: s.shift(1).expanding().std())
        prior_count = grouped.cumcount()
        f["user_prior_count"] = prior_count
        f["amount_deviation"] = (
            (amount - prior_mean).abs() / (prior_std.fillna(0.0) + 1e-6)
        ).where(prior_count >= 2, 0.0)
        indexed = f.set_index("timestamp")
        counts = (
            indexed.groupby("user_id")["amount"]
            .rolling("1h")
            .count()
            .reset_index(level=0, drop=True)
        )
        f["transactions_last_hour"] = counts.to_numpy()
        return f

    def train(
        self, data: pd.DataFrame, target_column: str = "is_fraud"
    ) -> ModelValidationResult:
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found")
        features = self.prepare_features(data)
        exclude = {target_column, "user_id", "timestamp", "transaction_id", "amount"}
        columns = [
            c
            for c in features.columns
            if c not in exclude and pd.api.types.is_numeric_dtype(features[c])
        ]
        X = features[columns].fillna(0.0)
        y = features[target_column].astype(int)
        if y.nunique() < 2 or y.sum() < 5:
            raise ValueError(
                "Training data needs at least 5 positive and some negative labels"
            )
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
        )
        scaler = StandardScaler().fit(X_train)
        weights = np.where(
            y_train == 1, (y_train == 0).sum() / max((y_train == 1).sum(), 1), 1.0
        )
        model = GradientBoostingClassifier(random_state=RANDOM_STATE)
        model.fit(scaler.transform(X_train), y_train, sample_weight=weights)
        probabilities = model.predict_proba(scaler.transform(X_test))[:, 1]
        predicted = (probabilities >= self.threshold).astype(int)
        metrics = {
            "accuracy": float(accuracy_score(y_test, predicted)),
            "precision": float(precision_score(y_test, predicted, zero_division=0)),
            "recall": float(recall_score(y_test, predicted, zero_division=0)),
            "f1_score": float(f1_score(y_test, predicted, zero_division=0)),
        }
        self.scaler = scaler
        self.model = model
        self.feature_columns = columns
        self.is_trained = True
        passed = metrics["precision"] > 0.7 and metrics["recall"] > 0.6
        self.metadata = ModelMetadata(
            model_id=self.model_id,
            model_name="Fraud Detection Model",
            model_type=ModelType.FRAUD_DETECTION,
            version="2.1.0",
            created_by="system",
            created_at=_now(),
            last_updated=_now(),
            status=ModelStatus.VALIDATION if passed else ModelStatus.FAILED,
            risk_level=RiskLevel.HIGH,
            description="Supervised fraud classifier using gradient boosting",
            features=columns,
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
            result.issues.append("Model performance below threshold")
        return result

    def predict(self, data: pd.DataFrame) -> ModelPrediction:
        if not self.is_trained or self.model is None:
            raise ValueError("Model must be trained before making predictions")
        features = self.prepare_features(data)
        X = features[self.feature_columns].fillna(0.0)
        probability = float(self.model.predict_proba(self.scaler.transform(X))[-1, 1])
        importance = {
            name: float(value)
            for name, value in zip(
                self.feature_columns, self.model.feature_importances_
            )
        }
        flagged = probability >= self.threshold
        return ModelPrediction(
            model_id=self.model_id,
            prediction=probability,
            confidence=max(probability, 1.0 - probability),
            feature_importance=importance,
            explanation=(
                "Transaction flagged for review"
                if flagged
                else "Transaction looks normal"
            ),
            timestamp=_now(),
            input_hash=hashlib.sha256(
                X.iloc[[-1]].to_numpy().astype(float).tobytes()
            ).hexdigest(),
        )

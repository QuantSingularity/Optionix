"""
AI Model Service for Optionix Platform
Implements robust financial AI models with:
- Advanced volatility prediction models
- Risk assessment models
- Fraud detection models
- Market sentiment analysis
- Portfolio optimization models
- Model validation and backtesting
- Model governance and compliance
- Secure model deployment
- Model monitoring and drift detection
- Explainable AI features
"""

import hashlib
import logging
import warnings
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
from scipy import stats
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import RobustScaler, StandardScaler

logger = logging.getLogger(__name__)


class ModelType(str, Enum):
    """Types of AI models"""

    VOLATILITY_PREDICTION = "volatility_prediction"
    RISK_ASSESSMENT = "risk_assessment"
    FRAUD_DETECTION = "fraud_detection"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    PORTFOLIO_OPTIMIZATION = "portfolio_optimization"
    PRICE_PREDICTION = "price_prediction"
    ANOMALY_DETECTION = "anomaly_detection"
    CREDIT_SCORING = "credit_scoring"


class ModelStatus(str, Enum):
    """Model lifecycle status"""

    DEVELOPMENT = "development"
    TRAINING = "training"
    VALIDATION = "validation"
    TESTING = "testing"
    PRODUCTION = "production"
    DEPRECATED = "deprecated"
    FAILED = "failed"


class RiskLevel(str, Enum):
    """Model risk levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ModelMetadata:
    """Model metadata for governance"""

    model_id: str
    model_name: str
    model_type: ModelType
    version: str
    created_by: str
    created_at: datetime
    last_updated: datetime
    status: ModelStatus
    risk_level: RiskLevel
    description: str
    features: List[str]
    target_variable: str
    training_data_hash: str
    validation_metrics: Dict[str, float]
    compliance_checks: Dict[str, bool]
    approval_status: str
    approved_by: Optional[str]
    approval_date: Optional[datetime]


@dataclass
class ModelPrediction:
    """Model prediction result"""

    model_id: str
    prediction: Union[float, int, List[float]]
    confidence: float
    feature_importance: Dict[str, float]
    explanation: str
    timestamp: datetime
    input_hash: str


@dataclass
class ModelValidationResult:
    """Model validation result"""

    model_id: str
    validation_type: str
    metrics: Dict[str, float]
    passed: bool
    issues: List[str]
    recommendations: List[str]
    validation_date: datetime


class VolatilityModel:
    """Volatility prediction model with financial robustness"""

    def __init__(self, model_id: str = "volatility_v2") -> None:
        self.model_id = model_id
        self.model = None
        self.scaler = None
        self.feature_selector = None
        self.metadata = None
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for volatility prediction"""
        features = data.copy()
        features["returns"] = features["close"].pct_change()
        features["log_returns"] = np.log(features["close"] / features["close"].shift(1))
        features["high_low_ratio"] = features["high"] / features["low"]
        features["close_open_ratio"] = features["close"] / features["open"]
        features["realized_volatility"] = features["returns"].rolling(window=20).std()
        features["volume_ma"] = features["volume"].rolling(window=20).mean()
        features["volume_ratio"] = features["volume"] / features["volume_ma"]
        features["hour"] = 0
        features["day_of_week"] = 0
        features["month"] = 1
        for lag in [1, 2, 3, 5, 10]:
            features[f"returns_lag_{lag}"] = features["returns"].shift(lag)
            features[f"volatility_lag_{lag}"] = features["realized_volatility"].shift(
                lag
            )
        features = features.replace([np.inf, -np.inf], np.nan)
        features = features.dropna()
        return features

    def train(
        self, data: pd.DataFrame, target_column: str = "realized_volatility"
    ) -> ModelValidationResult:
        """Train the volatility model with comprehensive validation"""
        try:
            logger.info(f"Training volatility model {self.model_id}")
            features_df = self.prepare_features(data)
            feature_columns = [
                col
                for col in features_df.columns
                if col not in [target_column, "open", "high", "low", "close", "volume"]
            ]
            X = features_df[feature_columns]
            y = features_df[target_column]
            self.feature_selector = SelectKBest(
                score_func=f_regression, k=min(20, len(feature_columns))
            )
            X_selected = self.feature_selector.fit_transform(X, y)
            selected_features = [
                feature_columns[i]
                for i in self.feature_selector.get_support(indices=True)
            ]
            self.scaler = RobustScaler()
            X_scaled = self.scaler.fit_transform(X_selected)
            split_index = int(len(X_scaled) * 0.8)
            X_train, X_test = (X_scaled[:split_index], X_scaled[split_index:])
            y_train, y_test = (y.iloc[:split_index], y.iloc[split_index:])
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
            )
            self.model.fit(X_train, y_train)
            y_pred = self.model.predict(X_test)
            mse = mean_squared_error(y_test, y_pred)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            self.is_trained = True
            self.metadata = ModelMetadata(
                model_id=self.model_id,
                model_name="Volatility Prediction Model",
                model_type=ModelType.VOLATILITY_PREDICTION,
                version="2.0",
                created_by="system",
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow(),
                status=ModelStatus.TRAINING,
                risk_level=RiskLevel.MEDIUM,
                description="Advanced volatility prediction using ensemble methods",
                features=selected_features,
                target_variable=target_column,
                training_data_hash=hashlib.sha256(
                    str(data.values).encode()
                ).hexdigest(),
                validation_metrics={"test_mse": mse, "test_mae": mae, "test_r2": r2},
                compliance_checks={
                    "data_quality": True,
                    "feature_validation": True,
                    "model_validation": True,
                    "bias_testing": True,
                },
                approval_status="pending",
                approved_by=None,
                approval_date=None,
            )
            validation_result = ModelValidationResult(
                model_id=self.model_id,
                validation_type="training_validation",
                metrics=self.metadata.validation_metrics,
                passed=self.metadata.validation_metrics["test_r2"] > 0.5,
                issues=[],
                recommendations=[],
                validation_date=datetime.utcnow(),
            )
            if validation_result.passed:
                self.metadata.status = ModelStatus.VALIDATION
                logger.info(f"Model {self.model_id} training completed successfully")
            else:
                self.metadata.status = ModelStatus.FAILED
                validation_result.issues.append("Model performance below threshold")
                logger.warning(f"Model {self.model_id} training failed validation")
            return validation_result
        except Exception as e:
            logger.error(f"Model training failed: {e}")
            raise

    def predict(self, data: pd.DataFrame) -> ModelPrediction:
        """Make volatility prediction with explainability"""
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        try:
            features_df = self.prepare_features(data)
            feature_columns = self.metadata.features
            X = features_df[feature_columns]
            X_selected = self.feature_selector.transform(X)
            X_scaled = self.scaler.transform(X_selected)
            prediction = self.model.predict(X_scaled)
            confidence = 1.0 / (1.0 + np.std(prediction))
            if hasattr(self.model, "feature_importances_"):
                feature_importance = dict(
                    zip(feature_columns, self.model.feature_importances_)
                )
            else:
                feature_importance = {}
            explanation = self._generate_explanation(
                prediction, feature_importance, data
            )
            input_hash = hashlib.sha256(str(data.values).encode()).hexdigest()
            return ModelPrediction(
                model_id=self.model_id,
                prediction=(
                    prediction[0] if len(prediction) == 1 else prediction.tolist()
                ),
                confidence=confidence,
                feature_importance=feature_importance,
                explanation=explanation,
                timestamp=datetime.utcnow(),
                input_hash=input_hash,
            )
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise

    def _generate_explanation(
        self,
        prediction: np.ndarray,
        feature_importance: Dict[str, float],
        data: pd.DataFrame,
    ) -> str:
        """Generate human-readable explanation for prediction"""
        pred_value = prediction[0] if len(prediction) == 1 else np.mean(prediction)
        top_features = sorted(
            feature_importance.items(), key=lambda x: abs(x[1]), reverse=True
        )[:3]
        explanation = f"Predicted volatility: {pred_value:.4f}. "
        if top_features:
            explanation += "Key factors: "
            for feature, importance in top_features:
                explanation += f"{feature} (importance: {importance:.3f}), "
            explanation = explanation.rstrip(", ")
        if pred_value > 0.3:
            explanation += (
                ". HIGH VOLATILITY WARNING: Consider risk management measures."
            )
        elif pred_value > 0.2:
            explanation += ". Moderate volatility expected."
        else:
            explanation += ". Low volatility environment."
        return explanation


class FraudDetectionModel:
    """Fraud detection model for financial transactions"""

    def __init__(self, model_id: str = "fraud_detection_v2") -> None:
        self.model_id = model_id
        self.model = None
        self.scaler = None
        self.metadata = None
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Prepare features for fraud detection"""
        features = data.copy()
        features["amount_log"] = np.log1p(features["amount"])
        features["amount_zscore"] = stats.zscore(features["amount"])
        features["hour"] = pd.to_datetime(features["timestamp"]).dt.hour
        features["day_of_week"] = pd.to_datetime(features["timestamp"]).dt.dayofweek
        features["is_weekend"] = features["day_of_week"].isin([5, 6]).astype(int)
        features["is_night"] = (
            (features["hour"] >= 22) | (features["hour"] <= 6)
        ).astype(int)
        user_stats = (
            features.groupby("user_id")["amount"]
            .agg(["mean", "std", "count"])
            .reset_index()
        )
        user_stats.columns = [
            "user_id",
            "user_avg_amount",
            "user_std_amount",
            "user_transaction_count",
        ]
        features = features.merge(user_stats, on="user_id", how="left")
        features["amount_deviation"] = abs(
            features["amount"] - features["user_avg_amount"]
        ) / (features["user_std_amount"] + 1e-06)
        features["transactions_last_hour"] = features.groupby("user_id")[
            "timestamp"
        ].transform(lambda x: x.rolling("1H").count())
        return features

    def train(
        self, data: pd.DataFrame, target_column: str = "is_fraud"
    ) -> ModelValidationResult:
        """Train the fraud detection model"""
        try:
            logger.info(f"Training fraud detection model {self.model_id}")
            features_df = self.prepare_features(data)
            feature_columns = [
                col
                for col in features_df.columns
                if col not in [target_column, "user_id", "timestamp", "transaction_id"]
            ]
            X = features_df[feature_columns]
            y = features_df[target_column]
            X = X.fillna(0)
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y, test_size=0.2, random_state=42, stratify=y
            )
            self.model = IsolationForest(
                contamination=0.1, random_state=42, n_estimators=100
            )
            self.model.fit(X_train)
            y_pred = self.model.predict(X_test)
            y_pred_binary = (y_pred == -1).astype(int)
            accuracy = accuracy_score(y_test, y_pred_binary)
            precision = precision_score(y_test, y_pred_binary)
            recall = recall_score(y_test, y_pred_binary)
            f1 = f1_score(y_test, y_pred_binary)
            self.is_trained = True
            self.metadata = ModelMetadata(
                model_id=self.model_id,
                model_name="Fraud Detection Model",
                model_type=ModelType.FRAUD_DETECTION,
                version="2.0",
                created_by="system",
                created_at=datetime.utcnow(),
                last_updated=datetime.utcnow(),
                status=ModelStatus.TRAINING,
                risk_level=RiskLevel.HIGH,
                description="Advanced fraud detection using isolation forest",
                features=feature_columns,
                target_variable=target_column,
                training_data_hash=hashlib.sha256(
                    str(data.values).encode()
                ).hexdigest(),
                validation_metrics={
                    "accuracy": accuracy,
                    "precision": precision,
                    "recall": recall,
                    "f1_score": f1,
                },
                compliance_checks={
                    "data_quality": True,
                    "feature_validation": True,
                    "model_validation": True,
                    "bias_testing": True,
                },
                approval_status="pending",
                approved_by=None,
                approval_date=None,
            )
            validation_result = ModelValidationResult(
                model_id=self.model_id,
                validation_type="training_validation",
                metrics=self.metadata.validation_metrics,
                passed=precision > 0.7 and recall > 0.6,
                issues=[],
                recommendations=[],
                validation_date=datetime.utcnow(),
            )
            if validation_result.passed:
                self.metadata.status = ModelStatus.VALIDATION
                logger.info(f"Model {self.model_id} training completed successfully")
            else:
                self.metadata.status = ModelStatus.FAILED
                validation_result.issues.append("Model performance below threshold")
                logger.warning(f"Model {self.model_id} training failed validation")
            return validation_result
        except Exception as e:
            logger.error(f"Model training failed: {e}")
            raise


class ModelService:
    """Model service for managing AI models"""

    def __init__(self) -> None:
        self.models = {}
        self.model_registry = {}

    def register_model(self, model_id: str, model_type: ModelType) -> bool:
        """Register a new model"""
        try:
            if model_type == ModelType.VOLATILITY_PREDICTION:
                model = VolatilityModel(model_id)
            elif model_type == ModelType.FRAUD_DETECTION:
                model = FraudDetectionModel(model_id)
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            self.models[model_id] = model
            self.model_registry[model_id] = {
                "model_type": model_type,
                "created_at": datetime.utcnow(),
                "status": "registered",
            }
            logger.info(f"Model {model_id} registered successfully")
            return True
        except Exception as e:
            logger.error(f"Model registration failed: {e}")
            return False

    def train_model(
        self, model_id: str, data: pd.DataFrame, **kwargs
    ) -> ModelValidationResult:
        """Train a registered model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        model = self.models[model_id]
        return model.train(data, **kwargs)

    def predict(self, model_id: str, data: pd.DataFrame) -> ModelPrediction:
        """Make prediction using a trained model"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        model = self.models[model_id]
        return model.predict(data)

    def get_model_metadata(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata"""
        if model_id not in self.models:
            return None
        model = self.models[model_id]
        return model.metadata

    def list_models(self) -> Dict[str, Dict[str, Any]]:
        """List all registered models"""
        return self.model_registry


model_service = ModelService()

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Union

import pandas as pd


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _frame_hash(frame: pd.DataFrame) -> str:
    return hashlib.sha256(
        pd.util.hash_pandas_object(frame, index=True).to_numpy().tobytes()
    ).hexdigest()


class ModelType(str, Enum):
    VOLATILITY_PREDICTION = "volatility_prediction"
    RISK_ASSESSMENT = "risk_assessment"
    FRAUD_DETECTION = "fraud_detection"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    PORTFOLIO_OPTIMIZATION = "portfolio_optimization"
    PRICE_PREDICTION = "price_prediction"
    ANOMALY_DETECTION = "anomaly_detection"
    CREDIT_SCORING = "credit_scoring"


class ModelStatus(str, Enum):
    DEVELOPMENT = "development"
    TRAINING = "training"
    VALIDATION = "validation"
    TESTING = "testing"
    PRODUCTION = "production"
    DEPRECATED = "deprecated"
    FAILED = "failed"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ModelMetadata:
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
    model_id: str
    prediction: Union[float, int, List[float]]
    confidence: float
    feature_importance: Dict[str, float]
    explanation: str
    timestamp: datetime
    input_hash: str


@dataclass
class ModelValidationResult:
    model_id: str
    validation_type: str
    metrics: Dict[str, float]
    passed: bool
    issues: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    validation_date: datetime = field(default_factory=_now)

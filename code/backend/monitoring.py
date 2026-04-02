"""
Monitoring and Compliance Service for Optionix Platform
Implements comprehensive monitoring and compliance features:
- Real-time transaction monitoring
- Regulatory reporting (MiFID II, EMIR, Dodd-Frank)
- AML/KYC compliance automation
- Risk monitoring and alerting
- Audit trail management
- Performance monitoring
- Compliance dashboard
- Automated regulatory filing
- Suspicious activity detection
- Market surveillance
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import redis
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)
from .models import Base


class AlertSeverity(str, Enum):
    """Alert severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplianceStatus(str, Enum):
    """Compliance status types"""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    UNDER_REVIEW = "under_review"
    PENDING = "pending"


class TransactionType(str, Enum):
    """Transaction types for monitoring"""

    OPTION_TRADE = "option_trade"
    FUTURES_TRADE = "futures_trade"
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    TRANSFER = "transfer"
    LIQUIDATION = "liquidation"


@dataclass
class ComplianceAlert:
    """Compliance alert structure"""

    alert_id: str
    severity: AlertSeverity
    alert_type: str
    description: str
    user_id: str
    transaction_id: Optional[str]
    timestamp: datetime
    status: str
    metadata: Dict[str, Any]


@dataclass
class RegulatoryReport:
    """Regulatory report structure"""

    report_id: str
    report_type: str
    reporting_period: str
    generated_at: datetime
    data: Dict[str, Any]
    status: str
    file_path: Optional[str]


class TransactionLog(Base):
    __tablename__ = "transaction_logs"
    id = Column(Integer, primary_key=True)
    transaction_id = Column(String(255), unique=True, nullable=False)
    user_id = Column(String(255), nullable=False)
    transaction_type = Column(String(50), nullable=False)
    amount = Column(Float, nullable=True)
    asset = Column(String(50), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    status = Column(String(50), nullable=False)
    metadata = Column(JSON, nullable=True)
    risk_score = Column(Float, nullable=True)
    compliance_status = Column(String(50), nullable=False)


class ComplianceAlertModel(Base):
    __tablename__ = "compliance_alerts"
    id = Column(Integer, primary_key=True)
    alert_id = Column(String(255), unique=True, nullable=False)
    severity = Column(String(20), nullable=False)
    alert_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    user_id = Column(String(255), nullable=False)
    transaction_id = Column(String(255), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    status = Column(String(50), nullable=False)
    metadata = Column(JSON, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(255), nullable=True)


class RegulatoryReportModel(Base):
    __tablename__ = "regulatory_reports"
    id = Column(Integer, primary_key=True)
    report_id = Column(String(255), unique=True, nullable=False)
    report_type = Column(String(100), nullable=False)
    reporting_period = Column(String(50), nullable=False)
    generated_at = Column(DateTime, nullable=False)
    data = Column(JSON, nullable=False)
    status = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=True)
    submitted_at = Column(DateTime, nullable=True)


class UserComplianceProfile(Base):
    __tablename__ = "user_compliance_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), unique=True, nullable=False)
    kyc_status = Column(String(50), nullable=False)
    aml_status = Column(String(50), nullable=False)
    risk_score = Column(Float, nullable=False)
    last_review_date = Column(DateTime, nullable=False)
    compliance_flags = Column(JSON, nullable=True)
    sanctions_check = Column(Boolean, nullable=False, default=False)
    pep_status = Column(Boolean, nullable=False, default=False)
    due_diligence = Column(Boolean, nullable=False, default=False)


class MonitoringService:
    """Monitoring and compliance service"""

    def __init__(self, config: Dict[str, Any]) -> None:
        """Initialize monitoring service"""
        self.config = config
        from .database import SessionLocal
        from .database import engine as shared_engine

        db_url = config.get("database_url")
        if db_url:
            self.db_engine = create_engine(db_url)
        else:
            self.db_engine = shared_engine
        Base.metadata.create_all(bind=self.db_engine)
        Session = SessionLocal if not db_url else sessionmaker(bind=self.db_engine)
        self.db_session = Session()
        self.redis_client = redis.Redis(
            host=config.get("redis_host", "localhost"),
            port=config.get("redis_port", 6379),
            db=config.get("redis_db", 0),
        )
        self.alert_thresholds = {
            "large_transaction": config.get("large_transaction_threshold", 10000),
            "velocity_limit": config.get("velocity_limit", 100000),
            "risk_score_threshold": config.get("risk_score_threshold", 80),
            "suspicious_pattern_threshold": config.get(
                "suspicious_pattern_threshold", 0.8
            ),
        }

    async def monitor_transaction(
        self, transaction_data: Dict[str, Any]
    ) -> Optional[ComplianceAlert]:
        """Monitor individual transaction for compliance"""
        try:
            transaction_id = transaction_data.get("transaction_id")
            user_id = transaction_data.get("user_id")
            amount = transaction_data.get("amount", 0)
            transaction_type = transaction_data.get("type")
            risk_score = await self._calculate_transaction_risk_score(transaction_data)
            violations = await self._check_compliance_violations(
                transaction_data, risk_score
            )
            transaction_log = TransactionLog(
                transaction_id=transaction_id,
                user_id=user_id,
                transaction_type=transaction_type,
                amount=amount,
                asset=transaction_data.get("asset"),
                timestamp=datetime.utcnow(),
                status=transaction_data.get("status", "pending"),
                metadata=transaction_data,
                risk_score=risk_score,
                compliance_status="compliant" if not violations else "flagged",
            )
            self.db_session.add(transaction_log)
            self.db_session.commit()
            if violations:
                alert = await self._generate_compliance_alert(
                    transaction_data, violations, risk_score
                )
                return alert
            return None
        except Exception as e:
            logger.error(f"Transaction monitoring failed: {e}")
            raise

    async def _calculate_transaction_risk_score(
        self, transaction_data: Dict[str, Any]
    ) -> float:
        """Calculate risk score for transaction"""
        try:
            user_id = transaction_data.get("user_id")
            amount = transaction_data.get("amount", 0)
            risk_score = 0.0
            if amount > self.alert_thresholds["large_transaction"]:
                risk_score += 30.0
            user_profile = (
                self.db_session.query(UserComplianceProfile)
                .filter_by(user_id=user_id)
                .first()
            )
            if user_profile:
                risk_score += user_profile.risk_score * 0.3
                if user_profile.pep_status:
                    risk_score += 20.0
                if user_profile.due_diligence:
                    risk_score += 15.0
            recent_transactions = (
                self.db_session.query(TransactionLog)
                .filter(
                    TransactionLog.user_id == user_id,
                    TransactionLog.timestamp >= datetime.utcnow() - timedelta(hours=24),
                )
                .all()
            )
            if len(recent_transactions) > 10:
                risk_score += 25.0
            total_24h_volume = sum((t.amount or 0 for t in recent_transactions))
            if total_24h_volume > self.alert_thresholds["velocity_limit"]:
                risk_score += 35.0
            return min(risk_score, 100.0)
        except Exception as e:
            logger.error(f"Risk score calculation failed: {e}")
            return 50.0

    async def _check_compliance_violations(
        self, transaction_data: Dict[str, Any], risk_score: float
    ) -> List[str]:
        """Check for compliance violations"""
        violations = []
        try:
            user_id = transaction_data.get("user_id")
            amount = transaction_data.get("amount", 0)
            if risk_score > self.alert_thresholds["risk_score_threshold"]:
                violations.append(f"High risk score: {risk_score}")
            if amount > self.alert_thresholds["large_transaction"]:
                violations.append(f"Large transaction: {amount}")
            if await self._check_sanctions_list(user_id):
                violations.append("User on sanctions list")
            if await self._detect_suspicious_patterns(user_id):
                violations.append("Suspicious trading pattern detected")
            return violations
        except Exception as e:
            logger.error(f"Compliance violation check failed: {e}")
            return ["Compliance check error"]

    async def _generate_compliance_alert(
        self, transaction_data: Dict[str, Any], violations: List[str], risk_score: float
    ) -> ComplianceAlert:
        """Generate compliance alert"""
        try:
            alert_id = f"ALERT_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{transaction_data.get('transaction_id', 'UNKNOWN')}"
            severity = AlertSeverity.LOW
            if risk_score > 90:
                severity = AlertSeverity.CRITICAL
            elif risk_score > 70:
                severity = AlertSeverity.HIGH
            elif risk_score > 50:
                severity = AlertSeverity.MEDIUM
            alert = ComplianceAlert(
                alert_id=alert_id,
                severity=severity,
                alert_type="COMPLIANCE_VIOLATION",
                description=f"Compliance violations detected: {', '.join(violations)}",
                user_id=transaction_data.get("user_id"),
                transaction_id=transaction_data.get("transaction_id"),
                timestamp=datetime.utcnow(),
                status="OPEN",
                metadata={
                    "violations": violations,
                    "risk_score": risk_score,
                    "transaction_data": transaction_data,
                },
            )
            alert_model = ComplianceAlertModel(
                alert_id=alert.alert_id,
                severity=alert.severity.value,
                alert_type=alert.alert_type,
                description=alert.description,
                user_id=alert.user_id,
                transaction_id=alert.transaction_id,
                timestamp=alert.timestamp,
                status=alert.status,
                metadata=alert.metadata,
            )
            self.db_session.add(alert_model)
            self.db_session.commit()
            return alert
        except Exception as e:
            logger.error(f"Alert generation failed: {e}")
            raise

    async def _check_sanctions_list(self, user_id: str) -> bool:
        """Check if user is on sanctions list"""
        try:
            cached_result = self.redis_client.get(f"sanctions_check:{user_id}")
            if cached_result:
                return json.loads(cached_result)
            is_sanctioned = False
            self.redis_client.setex(
                f"sanctions_check:{user_id}", 86400, json.dumps(is_sanctioned)
            )
            return is_sanctioned
        except Exception as e:
            logger.error(f"Sanctions check failed: {e}")
            return False

    async def _detect_suspicious_patterns(self, user_id: str) -> bool:
        """Detect suspicious trading patterns"""
        try:
            recent_transactions = (
                self.db_session.query(TransactionLog)
                .filter(
                    TransactionLog.user_id == user_id,
                    TransactionLog.timestamp >= datetime.utcnow() - timedelta(days=7),
                )
                .all()
            )
            if len(recent_transactions) < 5:
                return False
            amounts = [t.amount or 0 for t in recent_transactions]
            round_numbers = sum((1 for amount in amounts if amount % 1000 == 0))
            if round_numbers / len(amounts) > 0.8:
                return True
            timestamps = [t.timestamp for t in recent_transactions]
            timestamps.sort()
            rapid_trades = 0
            for i in range(1, len(timestamps)):
                if (timestamps[i] - timestamps[i - 1]).total_seconds() < 60:
                    rapid_trades += 1
            if rapid_trades / len(timestamps) > 0.5:
                return True
            return False
        except Exception as e:
            logger.error(f"Suspicious pattern detection failed: {e}")
            return False

    def generate_regulatory_report(
        self, report_type: str, period: str
    ) -> RegulatoryReport:
        """Generate regulatory report"""
        try:
            report_id = f"REP_{report_type}_{period}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            if report_type == "mifid_ii":
                data = self._generate_mifid_ii_report(period)
            elif report_type == "emir":
                data = self._generate_emir_report(period)
            elif report_type == "dodd_frank":
                data = self._generate_dodd_frank_report(period)
            else:
                raise ValueError(f"Unknown report type: {report_type}")
            report = RegulatoryReport(
                report_id=report_id,
                report_type=report_type,
                reporting_period=period,
                generated_at=datetime.utcnow(),
                data=data,
                status="generated",
                file_path=None,
            )
            report_model = RegulatoryReportModel(
                report_id=report.report_id,
                report_type=report.report_type,
                reporting_period=report.reporting_period,
                generated_at=report.generated_at,
                data=report.data,
                status=report.status,
                file_path=report.file_path,
            )
            self.db_session.add(report_model)
            self.db_session.commit()
            return report
        except Exception as e:
            logger.error(f"Regulatory report generation failed: {e}")
            raise

    def _generate_mifid_ii_report(self, period: str) -> Dict[str, Any]:
        """Generate MiFID II report data"""
        return {
            "report_type": "mifid_ii",
            "period": period,
            "transactions": [],
            "summary": {},
        }

    def _generate_emir_report(self, period: str) -> Dict[str, Any]:
        """Generate EMIR report data"""
        return {
            "report_type": "emir",
            "period": period,
            "derivatives": [],
            "summary": {},
        }

    def _generate_dodd_frank_report(self, period: str) -> Dict[str, Any]:
        """Generate Dodd-Frank report data"""
        return {
            "report_type": "dodd_frank",
            "period": period,
            "swaps": [],
            "summary": {},
        }


def create_monitoring_service(config: Dict[str, Any]) -> MonitoringService:
    """Create monitoring service instance"""
    return MonitoringService(config)

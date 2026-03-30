"""
Financial standards compliance module for Optionix.
Implements SOX, Basel III, MiFID II, Dodd-Frank, and other financial regulations.
"""

import hashlib
import json
import logging
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, Optional
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
from .config import settings
from .models import Trade

logger = logging.getLogger(__name__)
Base = declarative_base()


class FinancialRegulation(str, Enum):
    """Financial regulations"""

    SOX = "sox"
    BASEL_III = "basel_iii"
    MIFID_II = "mifid_ii"
    DODD_FRANK = "dodd_frank"
    CFTC = "cftc"
    SEC = "sec"
    FINRA = "finra"
    EMIR = "emir"


class TransactionStatus(str, Enum):
    """Transaction status for audit trail"""

    INITIATED = "initiated"
    VALIDATED = "validated"
    EXECUTED = "executed"
    SETTLED = "settled"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RECONCILED = "reconciled"


class RiskMetricType(str, Enum):
    """Types of risk metrics"""

    VAR = "var"
    EXPECTED_SHORTFALL = "expected_shortfall"
    LEVERAGE_RATIO = "leverage_ratio"
    LIQUIDITY_RATIO = "liquidity_ratio"
    CONCENTRATION_RISK = "concentration_risk"
    COUNTERPARTY_RISK = "counterparty_risk"


class FinancialAuditLog(Base):
    """Comprehensive financial audit log for SOX compliance"""

    __tablename__ = "financial_audit_logs"
    id = Column(Integer, primary_key=True)
    audit_id = Column(String(100), unique=True, nullable=False)
    transaction_id = Column(String(100), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    transaction_type = Column(String(50), nullable=False)
    amount = Column(Numeric(precision=18, scale=8), nullable=False)
    currency = Column(String(10), default="USD")
    previous_state = Column(Text, nullable=True)
    new_state = Column(Text, nullable=False)
    state_hash = Column(String(64), nullable=False)
    regulation_type = Column(String(50), nullable=False)
    compliance_status = Column(String(20), default="compliant")
    control_reference = Column(String(100), nullable=True)
    authorized_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    authorization_level = Column(String(50), nullable=True)
    business_date = Column(DateTime, nullable=False)
    system_timestamp = Column(DateTime, default=datetime.utcnow)
    __table_args__ = (
        Index("idx_financial_audit_transaction", "transaction_id"),
        Index("idx_financial_audit_user", "user_id"),
        Index("idx_financial_audit_date", "business_date"),
        Index("idx_financial_audit_regulation", "regulation_type"),
    )


class DataIntegrityCheck(Base):
    """Data integrity verification records"""

    __tablename__ = "data_integrity_checks"
    id = Column(Integer, primary_key=True)
    check_id = Column(String(100), unique=True, nullable=False)
    check_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    expected_value = Column(Text, nullable=False)
    actual_value = Column(Text, nullable=False)
    variance = Column(Text, nullable=True)
    integrity_status = Column(String(20), nullable=False)
    discrepancy_amount = Column(Numeric(precision=18, scale=8), nullable=True)
    tolerance_threshold = Column(Numeric(precision=18, scale=8), nullable=True)
    resolution_status = Column(String(20), default="pending")
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    check_timestamp = Column(DateTime, default=datetime.utcnow)
    business_date = Column(DateTime, nullable=False)


class ReconciliationRecord(Base):
    """Financial reconciliation records"""

    __tablename__ = "reconciliation_records"
    id = Column(Integer, primary_key=True)
    reconciliation_id = Column(String(100), unique=True, nullable=False)
    reconciliation_type = Column(String(50), nullable=False)
    internal_source = Column(String(100), nullable=False)
    external_source = Column(String(100), nullable=False)
    internal_balance = Column(Numeric(precision=18, scale=8), nullable=False)
    external_balance = Column(Numeric(precision=18, scale=8), nullable=False)
    difference = Column(Numeric(precision=18, scale=8), nullable=False)
    reconciliation_status = Column(String(20), nullable=False)
    tolerance_threshold = Column(
        Numeric(precision=18, scale=8), default=Decimal("0.01")
    )
    investigation_notes = Column(Text, nullable=True)
    investigated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    investigation_date = Column(DateTime, nullable=True)
    business_date = Column(DateTime, nullable=False)
    reconciliation_date = Column(DateTime, default=datetime.utcnow)


class RiskMetric(Base):
    """Risk metrics for Basel III compliance"""

    __tablename__ = "risk_metrics"
    id = Column(Integer, primary_key=True)
    metric_id = Column(String(100), unique=True, nullable=False)
    metric_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    metric_value = Column(Numeric(precision=18, scale=8), nullable=False)
    confidence_level = Column(Numeric(precision=5, scale=4), nullable=True)
    time_horizon = Column(Integer, nullable=True)
    limit_value = Column(Numeric(precision=18, scale=8), nullable=True)
    warning_threshold = Column(Numeric(precision=18, scale=8), nullable=True)
    breach_status = Column(String(20), default="within_limits")
    calculation_method = Column(String(100), nullable=False)
    input_parameters = Column(Text, nullable=True)
    calculation_date = Column(DateTime, default=datetime.utcnow)
    business_date = Column(DateTime, nullable=False)
    __table_args__ = (
        Index("idx_risk_metric_entity", "entity_type", "entity_id"),
        Index("idx_risk_metric_type_date", "metric_type", "business_date"),
    )


class RegulatoryReport(Base):
    """Regulatory reporting records"""

    __tablename__ = "regulatory_reports_financial"
    id = Column(Integer, primary_key=True)
    report_id = Column(String(100), unique=True, nullable=False)
    regulation_type = Column(String(50), nullable=False)
    report_type = Column(String(100), nullable=False)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    report_data = Column(Text, nullable=False)
    data_hash = Column(String(64), nullable=False)
    submission_status = Column(String(20), default="draft")
    submitted_at = Column(DateTime, nullable=True)
    submission_reference = Column(String(100), nullable=True)
    validation_status = Column(String(20), default="pending")
    validation_errors = Column(Text, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=False)


class FinancialStandardsService:
    """Service for financial standards compliance"""

    def __init__(self) -> None:
        self.sox_controls = {
            "segregation_of_duties": True,
            "authorization_levels": {
                "trade_execution": ["trader", "senior_trader"],
                "position_modification": ["risk_manager", "senior_trader"],
                "account_creation": ["admin", "compliance_officer"],
                "large_transactions": ["senior_trader", "risk_manager"],
            },
            "audit_retention_years": 7,
            "control_testing_frequency": 90,
        }
        self.basel_limits = {
            "leverage_ratio_minimum": Decimal("0.03"),
            "liquidity_coverage_ratio": Decimal("1.0"),
            "net_stable_funding_ratio": Decimal("1.0"),
            "capital_adequacy_ratio": Decimal("0.08"),
        }
        self.mifid_thresholds = {
            "equity_threshold": Decimal("15000"),
            "bond_threshold": Decimal("50000"),
            "derivative_threshold": Decimal("25000"),
        }

    def create_financial_audit_log(
        self,
        db: Session,
        transaction_id: str,
        user_id: int,
        account_id: Optional[int],
        transaction_type: str,
        amount: Decimal,
        previous_state: Optional[Dict[str, Any]],
        new_state: Dict[str, Any],
        regulation_type: FinancialRegulation,
        authorized_by: Optional[int] = None,
        authorization_level: Optional[str] = None,
    ) -> FinancialAuditLog:
        """Create comprehensive financial audit log entry"""
        try:
            audit_id = f"FA_{int(datetime.utcnow().timestamp())}_{transaction_id}"
            state_data = json.dumps(new_state, sort_keys=True, default=str)
            state_hash = hashlib.sha256(state_data.encode()).hexdigest()
            audit_log = FinancialAuditLog(
                audit_id=audit_id,
                transaction_id=transaction_id,
                user_id=user_id,
                account_id=account_id,
                transaction_type=transaction_type,
                amount=amount,
                currency="USD",
                previous_state=(
                    json.dumps(previous_state, default=str) if previous_state else None
                ),
                new_state=json.dumps(new_state, default=str),
                state_hash=state_hash,
                regulation_type=regulation_type.value,
                compliance_status="compliant",
                authorized_by=authorized_by,
                authorization_level=authorization_level,
                business_date=datetime.utcnow().date(),
            )
            db.add(audit_log)
            db.commit()
            db.refresh(audit_log)
            return audit_log
        except Exception as e:
            logger.error(f"Failed to create financial audit log: {e}")
            raise ValueError(f"Audit log creation failed: {str(e)}")

    def perform_data_integrity_check(
        self,
        db: Session,
        check_type: str,
        entity_type: str,
        entity_id: str,
        expected_value: Dict[str, Any],
        actual_value: Dict[str, Any],
        tolerance_threshold: Optional[Decimal] = None,
    ) -> DataIntegrityCheck:
        """Perform data integrity verification"""
        try:
            check_id = (
                f"DIC_{int(datetime.utcnow().timestamp())}_{entity_type}_{entity_id}"
            )
            variance = self._calculate_variance(expected_value, actual_value)
            integrity_status = "pass"
            discrepancy_amount = Decimal("0")
            if variance:
                discrepancy_amount = abs(
                    Decimal(str(variance.get("total_difference", 0)))
                )
                if tolerance_threshold and discrepancy_amount > tolerance_threshold:
                    integrity_status = "fail"
                elif discrepancy_amount > Decimal("0"):
                    integrity_status = "warning"
            integrity_check = DataIntegrityCheck(
                check_id=check_id,
                check_type=check_type,
                entity_type=entity_type,
                entity_id=entity_id,
                expected_value=json.dumps(expected_value, default=str),
                actual_value=json.dumps(actual_value, default=str),
                variance=json.dumps(variance, default=str) if variance else None,
                integrity_status=integrity_status,
                discrepancy_amount=discrepancy_amount,
                tolerance_threshold=tolerance_threshold,
                business_date=datetime.utcnow().date(),
            )
            db.add(integrity_check)
            db.commit()
            db.refresh(integrity_check)
            return integrity_check
        except Exception as e:
            logger.error(f"Data integrity check failed: {e}")
            raise ValueError(f"Integrity check failed: {str(e)}")

    def _calculate_variance(
        self, expected: Dict[str, Any], actual: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Calculate variance between expected and actual values"""
        variance = {}
        total_difference = Decimal("0")
        for key in expected:
            if key in actual:
                try:
                    expected_val = Decimal(str(expected[key]))
                    actual_val = Decimal(str(actual[key]))
                    difference = actual_val - expected_val
                    if difference != 0:
                        variance[key] = {
                            "expected": str(expected_val),
                            "actual": str(actual_val),
                            "difference": str(difference),
                            "percentage": str(
                                (difference / expected_val * 100).quantize(
                                    Decimal("0.01")
                                )
                            ),
                        }
                        total_difference += abs(difference)
                except (ValueError, TypeError, ZeroDivisionError):
                    if str(expected[key]) != str(actual[key]):
                        variance[key] = {
                            "expected": str(expected[key]),
                            "actual": str(actual[key]),
                            "difference": "non_numeric_mismatch",
                        }
            else:
                variance[key] = {
                    "expected": str(expected[key]),
                    "actual": "missing",
                    "difference": "missing_field",
                }
        for key in actual:
            if key not in expected:
                variance[key] = {
                    "expected": "not_expected",
                    "actual": str(actual[key]),
                    "difference": "extra_field",
                }
        if variance:
            variance["total_difference"] = str(total_difference)
            return variance
        return None

    def perform_reconciliation(
        self,
        db: Session,
        reconciliation_type: str,
        business_date: datetime,
        internal_balance: Decimal,
        external_balance: Decimal,
        tolerance_threshold: Optional[Decimal] = None,
    ) -> ReconciliationRecord:
        """Perform financial reconciliation"""
        try:
            reconciliation_id = (
                f"RR_{int(datetime.utcnow().timestamp())}_{reconciliation_type}"
            )
            difference = internal_balance - external_balance
            if tolerance_threshold is None:
                tolerance_threshold = self.sox_controls.get(
                    "reconciliation_tolerance", Decimal("0.01")
                )
            if abs(difference) <= tolerance_threshold:
                reconciliation_status = "matched"
            elif abs(difference) > tolerance_threshold:
                reconciliation_status = "unmatched"
            else:
                reconciliation_status = "investigating"
            reconciliation = ReconciliationRecord(
                reconciliation_id=reconciliation_id,
                reconciliation_type=reconciliation_type,
                internal_source="Optionix Internal Ledger",
                external_source="External Custodian/Exchange",
                internal_balance=internal_balance,
                external_balance=external_balance,
                difference=difference,
                reconciliation_status=reconciliation_status,
                tolerance_threshold=tolerance_threshold,
                business_date=business_date.date(),
            )
            db.add(reconciliation)
            db.commit()
            db.refresh(reconciliation)
            return reconciliation
        except Exception as e:
            logger.error(f"Financial reconciliation failed: {e}")
            raise ValueError(f"Reconciliation failed: {str(e)}")

    def check_mifid_ii_reporting(self, trade: Trade) -> bool:
        """Check if a trade is reportable under MiFID II"""
        trade_value = trade.total_value
        if (
            trade.symbol in settings.equity_symbols
            and trade_value >= self.mifid_thresholds["equity_threshold"]
        ):
            return True
        if (
            trade.symbol in settings.bond_symbols
            and trade_value >= self.mifid_thresholds["bond_threshold"]
        ):
            return True
        if (
            trade.symbol in settings.derivative_symbols
            and trade_value >= self.mifid_thresholds["derivative_threshold"]
        ):
            return True
        return False

    def generate_regulatory_report(
        self,
        db: Session,
        regulation_type: FinancialRegulation,
        report_type: str,
        period_start: datetime,
        period_end: datetime,
        generated_by_user_id: int,
    ) -> RegulatoryReport:
        """Generate a regulatory report"""
        try:
            report_id = f"RR_{regulation_type.value}_{report_type}_{period_start.strftime('%Y%m%d')}"
            report_data = {
                "regulation": regulation_type.value,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "summary": f"Mock summary for {regulation_type.value} {report_type} report.",
                "data_points": 1000,
                "compliance_status": "compliant",
            }
            report_data_json = json.dumps(report_data, sort_keys=True, default=str)
            data_hash = hashlib.sha256(report_data_json.encode()).hexdigest()
            report = RegulatoryReport(
                report_id=report_id,
                regulation_type=regulation_type.value,
                report_type=report_type,
                period_start=period_start,
                period_end=period_end,
                report_data=report_data_json,
                data_hash=data_hash,
                submission_status="draft",
                validation_status="pending",
                generated_by_user_id=generated_by_user_id,
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            return report
        except Exception as e:
            logger.error(f"Regulatory report generation failed: {e}")
            raise ValueError(f"Report generation failed: {str(e)}")


financial_standards_service = FinancialStandardsService()

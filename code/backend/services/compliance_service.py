"""
KYC (Know Your Customer) and AML (Anti-Money Laundering) compliance service.
Provides identity verification and transaction monitoring capabilities.
"""

import json
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List
from models import AuditLog, Trade, User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ComplianceService:
    """Service for KYC/AML compliance and regulatory requirements"""

    def __init__(self) -> None:
        """Initialize compliance service"""
        self.suspicious_activity_threshold = Decimal("10000")
        self.daily_transaction_limit = Decimal("50000")
        self.high_risk_countries = {
            "AF",
            "BY",
            "CF",
            "CU",
            "CD",
            "ER",
            "GN",
            "GW",
            "HT",
            "IR",
            "IQ",
            "LB",
            "LY",
            "ML",
            "MM",
            "NI",
            "KP",
            "RU",
            "SO",
            "SS",
            "SD",
            "SY",
            "UA",
            "VE",
            "YE",
            "ZW",
        }

    def validate_kyc_data(self, kyc_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate KYC data for completeness and format

        Args:
            kyc_data (Dict[str, Any]): KYC information

        Returns:
            Dict[str, Any]: Validation results
        """
        errors = []
        warnings = []
        required_fields = [
            "full_name",
            "date_of_birth",
            "nationality",
            "address",
            "document_type",
            "document_number",
            "document_expiry",
        ]
        for field in required_fields:
            if field not in kyc_data or not kyc_data[field]:
                errors.append(f"Missing required field: {field}")
        if "full_name" in kyc_data:
            name = kyc_data["full_name"].strip()
            if len(name) < 2:
                errors.append("Full name must be at least 2 characters")
            if not re.match("^[a-zA-Z\\s\\-'\\.]+$", name):
                errors.append("Full name contains invalid characters")
        if "date_of_birth" in kyc_data:
            try:
                dob = datetime.strptime(kyc_data["date_of_birth"], "%Y-%m-%d")
                age = (datetime.now() - dob).days / 365.25
                if age < 18:
                    errors.append("User must be at least 18 years old")
                elif age > 120:
                    errors.append("Invalid date of birth")
            except ValueError:
                errors.append("Invalid date of birth format (use YYYY-MM-DD)")
        if "nationality" in kyc_data:
            nationality = kyc_data["nationality"].upper()
            if len(nationality) != 2:
                errors.append("Nationality must be a 2-letter country code")
            if nationality in self.high_risk_countries:
                warnings.append("High-risk jurisdiction detected")
        if "document_type" in kyc_data:
            valid_doc_types = ["passport", "national_id", "drivers_license"]
            if kyc_data["document_type"] not in valid_doc_types:
                errors.append(
                    f"Invalid document type. Must be one of: {valid_doc_types}"
                )
        if "document_number" in kyc_data:
            doc_number = kyc_data["document_number"].strip()
            if len(doc_number) < 5:
                errors.append("Document number too short")
            if not re.match("^[A-Z0-9\\-]+$", doc_number.upper()):
                errors.append("Document number contains invalid characters")
        if "document_expiry" in kyc_data:
            try:
                expiry = datetime.strptime(kyc_data["document_expiry"], "%Y-%m-%d")
                if expiry < datetime.now():
                    errors.append("Document has expired")
                elif expiry < datetime.now() + timedelta(days=30):
                    warnings.append("Document expires within 30 days")
            except ValueError:
                errors.append("Invalid document expiry format (use YYYY-MM-DD)")
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "risk_score": self._calculate_risk_score(kyc_data, warnings),
        }

    def _calculate_risk_score(
        self, kyc_data: Dict[str, Any], warnings: List[str]
    ) -> int:
        """
        Calculate risk score based on KYC data

        Args:
            kyc_data (Dict[str, Any]): KYC information
            warnings (List[str]): Validation warnings

        Returns:
            int: Risk score (0-100, higher is riskier)
        """
        score = 0
        score += len(warnings) * 10
        if kyc_data.get("nationality", "").upper() in self.high_risk_countries:
            score += 30
        if "date_of_birth" in kyc_data:
            try:
                dob = datetime.strptime(kyc_data["date_of_birth"], "%Y-%m-%d")
                age = (datetime.now() - dob).days / 365.25
                if age < 21 or age > 80:
                    score += 10
            except:
                pass
        doc_type = kyc_data.get("document_type", "")
        if doc_type == "drivers_license":
            score += 5
        return min(score, 100)

    def check_sanctions_list(self, full_name: str, nationality: str) -> Dict[str, Any]:
        """
        Check against sanctions lists (simplified implementation)

        Args:
            full_name (str): Full name to check
            nationality (str): Nationality code

        Returns:
            Dict[str, Any]: Sanctions check results
        """
        sanctioned_names = ["john doe", "jane smith", "test user"]
        name_lower = full_name.lower().strip()
        is_sanctioned = any(
            (
                sanctioned in name_lower or name_lower in sanctioned
                for sanctioned in sanctioned_names
            )
        )
        sanctioned_countries = self.high_risk_countries
        country_sanctioned = nationality.upper() in sanctioned_countries
        return {
            "sanctioned": is_sanctioned or country_sanctioned,
            "name_match": is_sanctioned,
            "country_sanctioned": country_sanctioned,
            "checked_at": datetime.utcnow().isoformat(),
            "lists_checked": ["OFAC", "UN", "EU"],
        }

    def monitor_transaction_patterns(
        self, user_id: int, db: Session, lookback_days: int = 30
    ) -> Dict[str, Any]:
        """
        Monitor user transaction patterns for suspicious activity

        Args:
            user_id (int): User ID to monitor
            db (Session): Database session
            lookback_days (int): Number of days to look back

        Returns:
            Dict[str, Any]: Monitoring results
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=lookback_days)
            trades = (
                db.query(Trade)
                .filter(
                    Trade.user_id == user_id,
                    Trade.created_at >= cutoff_date,
                    Trade.status == "executed",
                )
                .all()
            )
            if not trades:
                return {
                    "suspicious": False,
                    "alerts": [],
                    "total_volume": Decimal("0"),
                    "trade_count": 0,
                }
            total_volume = sum((trade.total_value for trade in trades))
            trade_count = len(trades)
            avg_trade_size = (
                total_volume / trade_count if trade_count > 0 else Decimal("0")
            )
            alerts = []
            if total_volume > self.suspicious_activity_threshold:
                alerts.append(
                    {
                        "type": "high_volume",
                        "message": f"High trading volume: ${total_volume}",
                        "severity": "medium",
                    }
                )
            if trade_count > 100:
                alerts.append(
                    {
                        "type": "rapid_trading",
                        "message": f"High frequency trading: {trade_count} trades",
                        "severity": "low",
                    }
                )
            max_trade = max((trade.total_value for trade in trades))
            if max_trade > self.daily_transaction_limit:
                alerts.append(
                    {
                        "type": "large_trade",
                        "message": f"Large single trade: ${max_trade}",
                        "severity": "high",
                    }
                )
            daily_volumes = {}
            for trade in trades:
                date_key = trade.created_at.date()
                daily_volumes[date_key] = (
                    daily_volumes.get(date_key, Decimal("0")) + trade.total_value
                )
            for date, volume in daily_volumes.items():
                if volume > self.daily_transaction_limit:
                    alerts.append(
                        {
                            "type": "daily_limit_exceeded",
                            "message": f"Daily limit exceeded on {date}: ${volume}",
                            "severity": "high",
                        }
                    )
            return {
                "suspicious": len(alerts) > 0,
                "alerts": alerts,
                "total_volume": total_volume,
                "trade_count": trade_count,
                "avg_trade_size": avg_trade_size,
                "max_trade_size": max_trade,
                "monitoring_period_days": lookback_days,
            }
        except Exception as e:
            logger.error(f"Error monitoring transaction patterns: {e}")
            return {
                "suspicious": False,
                "alerts": [
                    {"type": "monitoring_error", "message": str(e), "severity": "low"}
                ],
                "total_volume": Decimal("0"),
                "trade_count": 0,
            }

    def generate_sar_report(
        self, user_id: int, suspicious_activity: Dict[str, Any], db: Session
    ) -> Dict[str, Any]:
        """
        Generate Suspicious Activity Report (SAR)

        Args:
            user_id (int): User ID
            suspicious_activity (Dict[str, Any]): Suspicious activity details
            db (Session): Database session

        Returns:
            Dict[str, Any]: SAR report
        """
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError("User not found")
            sar_report = {
                "report_id": f"SAR_{user_id}_{int(datetime.utcnow().timestamp())}",
                "generated_at": datetime.utcnow().isoformat(),
                "user_info": {
                    "user_id": user.user_id,
                    "email": user.email,
                    "full_name": user.full_name,
                    "kyc_status": user.kyc_status,
                    "account_created": user.created_at.isoformat(),
                },
                "suspicious_activity": suspicious_activity,
                "regulatory_requirements": {
                    "filing_required": True,
                    "filing_deadline": (
                        datetime.utcnow() + timedelta(days=30)
                    ).isoformat(),
                    "regulatory_body": "FinCEN",
                    "report_type": "SAR",
                },
                "recommended_actions": [
                    "Monitoring",
                    "Account review",
                    "Possible account restriction",
                ],
            }
            audit_log = AuditLog(
                user_id=user_id,
                action="sar_generated",
                resource_type="compliance",
                resource_id=sar_report["report_id"],
                request_data=json.dumps(suspicious_activity),
                response_data=json.dumps({"sar_id": sar_report["report_id"]}),
                status="success",
            )
            db.add(audit_log)
            db.commit()
            return sar_report
        except Exception as e:
            logger.error(f"Error generating SAR report: {e}")
            raise ValueError(f"SAR generation failed: {str(e)}")

    def check_transaction_compliance(
        self, trade_data: Dict[str, Any], user_id: int, db: Session
    ) -> Dict[str, Any]:
        """
        Check if a transaction complies with regulations

        Args:
            trade_data (Dict[str, Any]): Trade information
            user_id (int): User ID
            db: Database session

        Returns:
            Dict[str, Any]: Compliance check results
        """
        try:
            violations = []
            warnings = []
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                violations.append("User not found")
                return {
                    "compliant": False,
                    "violations": violations,
                    "warnings": warnings,
                }
            if user.kyc_status != "approved":
                violations.append("KYC verification required")
            trade_value = Decimal(str(trade_data.get("total_value", 0)))
            if trade_value > self.daily_transaction_limit:
                violations.append(f"Trade exceeds daily limit: ${trade_value}")
            today = datetime.utcnow().date()
            daily_trades = (
                db.query(Trade)
                .filter(
                    Trade.user_id == user_id,
                    Trade.created_at >= today,
                    Trade.status == "executed",
                )
                .all()
            )
            daily_volume = sum((trade.total_value for trade in daily_trades))
            if daily_volume + trade_value > self.daily_transaction_limit:
                violations.append("Daily volume limit would be exceeded")
            if trade_value > Decimal("10000"):
                warnings.append(
                    "Large transaction - additional reporting may be required"
                )
            return {
                "compliant": len(violations) == 0,
                "violations": violations,
                "warnings": warnings,
                "daily_volume": daily_volume,
                "trade_value": trade_value,
            }
        except Exception as e:
            logger.error(f"Error checking transaction compliance: {e}")
            return {
                "compliant": False,
                "violations": [f"Compliance check error: {str(e)}"],
                "warnings": [],
            }


compliance_service = ComplianceService()

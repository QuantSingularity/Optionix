"""Compliance service unit tests."""

import time

import pytest
from app.services.compliance_service import ComplianceService


@pytest.fixture
def svc():
    return ComplianceService()


class TestKYCValidation:
    VALID_KYC = {
        "full_name": "John Smith",
        "date_of_birth": "1985-06-15",
        "nationality": "US",
        "address": "123 Main St, City, State",
        "document_type": "passport",
        "document_number": "A12345678",
        "document_expiry": "2030-01-01",
    }

    def test_valid_kyc_passes(self, svc):
        result = svc.validate_kyc_data(self.VALID_KYC)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_missing_required_field(self, svc):
        data = self.VALID_KYC.copy()
        del data["full_name"]
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False
        assert any("full_name" in e for e in result["errors"])

    def test_underage_rejected(self, svc):
        data = self.VALID_KYC.copy()
        data["date_of_birth"] = "2015-01-01"
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False
        assert any("18" in e for e in result["errors"])

    def test_expired_document_rejected(self, svc):
        data = self.VALID_KYC.copy()
        data["document_expiry"] = "2020-01-01"
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False
        assert any("expired" in e.lower() for e in result["errors"])

    def test_invalid_document_type(self, svc):
        data = self.VALID_KYC.copy()
        data["document_type"] = "selfie"
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False

    def test_invalid_nationality_code(self, svc):
        data = self.VALID_KYC.copy()
        data["nationality"] = "USA"  # 3 letters instead of 2
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False

    def test_high_risk_country_warning(self, svc):
        data = self.VALID_KYC.copy()
        data["nationality"] = "IR"  # Iran - high-risk
        result = svc.validate_kyc_data(data)
        # Valid but with warning
        assert len(result["warnings"]) > 0

    def test_short_document_number(self, svc):
        data = self.VALID_KYC.copy()
        data["document_number"] = "AB1"
        result = svc.validate_kyc_data(data)
        assert result["valid"] is False

    def test_result_has_risk_score(self, svc):
        result = svc.validate_kyc_data(self.VALID_KYC)
        assert "risk_score" in result
        assert 0 <= result["risk_score"] <= 100


class TestSanctionsCheck:
    def test_clean_user_not_sanctioned(self, svc):
        result = svc.check_sanctions_list("Alice Johnson", "GB")
        assert result["sanctioned"] is False
        assert result["name_match"] is False

    def test_sanctioned_name_detected(self, svc):
        result = svc.check_sanctions_list("John Doe", "US")
        assert result["sanctioned"] is True
        assert result["name_match"] is True

    def test_high_risk_country_sanctioned(self, svc):
        result = svc.check_sanctions_list("Alice Clean", "IR")
        assert result["sanctioned"] is True
        assert result["country_sanctioned"] is True

    def test_returns_lists_checked(self, svc):
        result = svc.check_sanctions_list("Test Person", "US")
        assert "lists_checked" in result
        assert len(result["lists_checked"]) > 0

    def test_returns_timestamp(self, svc):
        result = svc.check_sanctions_list("Test Person", "US")
        assert "checked_at" in result


class TestTransactionCompliance:
    def test_compliant_transaction(self, db, svc):
        from app.auth import auth_service
        from app.models import User

        user = User(
            email=f"comp_{int(time.time()*1000)}@test.com",
            hashed_password=auth_service.get_password_hash("password"),
            full_name="Compliance User",
            kyc_status="approved",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        result = svc.check_transaction_compliance(
            {
                "symbol": "BTC",
                "trade_type": "buy",
                "quantity": 1.0,
                "total_value": 5000.0,
            },
            user.id,
            db,
        )
        assert result["compliant"] is True
        assert result["violations"] == []

    def test_large_transaction_violation(self, db, svc):
        from app.auth import auth_service
        from app.models import User

        user = User(
            email=f"large_{int(time.time()*1000)}@test.com",
            hashed_password=auth_service.get_password_hash("password"),
            full_name="Large Trader",
            kyc_status="approved",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        result = svc.check_transaction_compliance(
            {
                "symbol": "BTC",
                "trade_type": "buy",
                "quantity": 100.0,
                "total_value": 100000.0,
            },
            user.id,
            db,
        )
        assert result["compliant"] is False
        assert len(result["violations"]) > 0

    def test_kyc_not_approved_violation(self, db, svc):
        from app.auth import auth_service
        from app.models import User

        user = User(
            email=f"nokyc_{int(time.time()*1000)}@test.com",
            hashed_password=auth_service.get_password_hash("password"),
            full_name="Pending KYC User",
            kyc_status="pending",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        result = svc.check_transaction_compliance(
            {
                "symbol": "ETH",
                "trade_type": "buy",
                "quantity": 1.0,
                "total_value": 1000.0,
            },
            user.id,
            db,
        )
        assert result["compliant"] is False
        assert any("KYC" in v for v in result["violations"])

    def test_nonexistent_user(self, db, svc):
        result = svc.check_transaction_compliance({"total_value": 100.0}, 999999, db)
        assert result["compliant"] is False

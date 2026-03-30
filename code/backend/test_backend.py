from typing import Any

"""
Comprehensive test suite for Optionix backend.
Tests security, compliance, and financial standards features.
"""

from decimal import Decimal
from unittest.mock import patch
import pytest
from app import app
from auth import auth_service
from compliance import compliance_service
from data_protection import data_protection_service
from database import Base, get_db
from fastapi.testclient import TestClient
from financial_standards import financial_standards_service
from models import Account, Position, User
from security import security_service
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Any:
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="session")
def setup_database() -> Any:
    """Set up test database"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session() -> Any:
    """Create database session for testing"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session: Any) -> Any:
    """Create test user"""
    user = User(
        email="test@example.com",
        hashed_password=auth_service.get_password_hash("TestPassword123!"),
        full_name="Test User",
        is_active=True,
        is_verified=True,
        kyc_status="approved",
        role="trader",
        mfa_enabled=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_account(db_session: Any, test_user: Any) -> Any:
    """Create test account"""
    account = Account(
        user_id=test_user.id,
        ethereum_address="0x742d35Cc6634C0532925a3b8D4C9db96590e4b10",
        account_type="standard",
        balance_usd=Decimal("10000.00"),
        margin_available=Decimal("5000.00"),
        margin_used=Decimal("0.00"),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def auth_headers(test_user: Any) -> Any:
    """Create authentication headers"""
    token = auth_service.create_access_token(data={"sub": test_user.user_id})
    return {"Authorization": f"Bearer {token}"}


class TestAuthentication:
    """Test authentication and authorization features"""

    def test_user_registration_success(self, setup_database: Any) -> Any:
        """Test successful user registration"""
        user_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "full_name": "New User",
            "data_processing_consent": True,
        }
        response = client.post("/auth/register", json=user_data)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == user_data["email"]
        assert data["full_name"] == user_data["full_name"]
        assert data["is_active"] is True
        assert data["is_verified"] is False

    def test_user_registration_weak_password(self, setup_database: Any) -> Any:
        """Test registration with weak password"""
        user_data = {
            "email": "weakpass@example.com",
            "password": "123",
            "full_name": "Weak Password User",
            "data_processing_consent": True,
        }
        response = client.post("/auth/register", json=user_data)
        assert response.status_code == 400
        assert "Password validation failed" in response.json()["detail"]

    def test_user_registration_duplicate_email(
        self, setup_database: Any, test_user: Any
    ) -> Any:
        """Test registration with duplicate email"""
        user_data = {
            "email": test_user.email,
            "password": "SecurePassword123!",
            "full_name": "Duplicate User",
            "data_processing_consent": True,
        }
        response = client.post("/auth/register", json=user_data)
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_user_login_success(self, setup_database: Any, test_user: Any) -> Any:
        """Test successful user login"""
        login_data = {"email": test_user.email, "password": "TestPassword123!"}
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_user_login_invalid_credentials(
        self, setup_database: Any, test_user: Any
    ) -> Any:
        """Test login with invalid credentials"""
        login_data = {"email": test_user.email, "password": "WrongPassword"}
        response = client.post("/auth/login", json=login_data)
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    def test_mfa_setup(
        self, setup_database: Any, test_user: Any, auth_headers: Any
    ) -> Any:
        """Test MFA setup"""
        response = client.post("/auth/mfa/setup", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "secret" in data
        assert "qr_code" in data
        assert "backup_codes" in data
        assert len(data["backup_codes"]) == 10


class TestSecurity:
    """Test security features"""

    def test_password_strength_validation(self) -> Any:
        """Test password strength validation"""
        result = security_service.validate_password_strength("StrongPassword123!")
        assert result["valid"] is True
        assert result["strength"] == "strong"
        result = security_service.validate_password_strength("weak")
        assert result["valid"] is False
        assert len(result["issues"]) > 0

    def test_ethereum_address_validation(self) -> Any:
        """Test Ethereum address validation"""
        valid_address = "0x742d35Cc6634C0532925a3b8D4C9db96590e4b10"
        assert security_service.validate_ethereum_address(valid_address) is True
        invalid_address = "0xinvalid"
        assert security_service.validate_ethereum_address(invalid_address) is False

    def test_input_sanitization(self) -> Any:
        """Test input sanitization"""
        malicious_input = "<script>alert('xss')</script>test"
        sanitized = security_service.sanitize_input(malicious_input)
        assert "<script>" not in sanitized
        assert "test" in sanitized

    def test_api_key_generation(self) -> Any:
        """Test API key generation"""
        plain_key, hashed_key = security_service.generate_api_key()
        assert plain_key.startswith("ok_")
        assert len(plain_key) == 46
        assert security_service.validate_api_key_format(plain_key) is True
        assert security_service.hash_api_key(plain_key) == hashed_key

    def test_data_encryption_decryption(self) -> Any:
        """Test data encryption and decryption"""
        original_data = "sensitive information"
        encrypted = security_service.encrypt_sensitive_data(original_data)
        assert encrypted != original_data
        decrypted = security_service.decrypt_sensitive_data(encrypted)
        assert decrypted == original_data


class TestCompliance:
    """Test compliance features"""

    def test_kyc_verification_success(
        self, setup_database: Any, test_user: Any, db_session: Any
    ) -> Any:
        """Test successful KYC verification"""
        kyc_data = {
            "full_name": "John Doe",
            "date_of_birth": "1990-01-01",
            "nationality": "US",
            "address": {
                "street": "123 Main St",
                "city": "New York",
                "state": "NY",
                "postal_code": "10001",
                "country": "US",
            },
            "document_type": "passport",
            "document_number": "A12345678",
            "document_country": "US",
            "document_expiry": "2030-01-01",
        }
        result = compliance_service.kyc_verification(
            user_id=test_user.id, kyc_data=kyc_data, db=db_session
        )
        assert "verification_id" in result
        assert "overall_status" in result
        assert "risk_level" in result
        assert len(result["checks_performed"]) > 0

    def test_kyc_verification_high_risk_country(
        self, setup_database: Any, test_user: Any, db_session: Any
    ) -> Any:
        """Test KYC verification with high-risk country"""
        kyc_data = {
            "full_name": "John Doe",
            "date_of_birth": "1990-01-01",
            "nationality": "AF",
            "address": {
                "street": "123 Main St",
                "city": "Kabul",
                "postal_code": "1001",
                "country": "AF",
            },
            "document_type": "passport",
            "document_number": "A12345678",
            "document_country": "AF",
            "document_expiry": "2030-01-01",
        }
        result = compliance_service.kyc_verification(
            user_id=test_user.id, kyc_data=kyc_data, db=db_session
        )
        assert result["risk_level"] in ["high", "critical"]
        assert len(result["issues_found"]) > 0

    def test_transaction_monitoring(
        self, setup_database: Any, test_user: Any, db_session: Any
    ) -> Any:
        """Test transaction monitoring"""
        trade_data = {
            "symbol": "BTC-USD",
            "trade_type": "buy",
            "quantity": Decimal("1.0"),
            "price": Decimal("50000.0"),
            "total_value": Decimal("50000.0"),
        }
        result = compliance_service.advanced_transaction_monitoring(
            user_id=test_user.id, trade_data=trade_data, db=db_session
        )
        assert "monitoring_passed" in result
        assert "alerts" in result
        assert "risk_score" in result
        assert "risk_level" in result

    def test_sanctions_screening(
        self, setup_database: Any, test_user: Any, db_session: Any
    ) -> Any:
        """Test sanctions screening"""
        kyc_data = {"full_name": "John Doe", "nationality": "US"}
        result = compliance_service._comprehensive_sanctions_screening(
            kyc_data=kyc_data, db=db_session, user_id=test_user.id
        )
        assert "matches_found" in result
        assert "match_details" in result
        assert "lists_checked" in result
        assert "risk_score" in result


class TestFinancialStandards:
    """Test financial standards compliance"""

    def test_financial_audit_log_creation(
        self, setup_database: Any, test_user: Any, test_account: Any, db_session: Any
    ) -> Any:
        """Test financial audit log creation"""
        audit_log = financial_standards_service.create_financial_audit_log(
            db=db_session,
            transaction_id="TEST_TXN_001",
            user_id=test_user.id,
            account_id=test_account.id,
            transaction_type="trade_execution",
            amount=Decimal("1000.00"),
            previous_state=None,
            new_state={"status": "executed", "amount": "1000.00"},
            regulation_type="sox",
            authorized_by=test_user.id,
            authorization_level="trader",
        )
        assert audit_log.audit_id is not None
        assert audit_log.transaction_id == "TEST_TXN_001"
        assert audit_log.amount == Decimal("1000.00")
        assert audit_log.regulation_type == "sox"

    def test_data_integrity_check(self, setup_database: Any, db_session: Any) -> Any:
        """Test data integrity verification"""
        expected_value = {"balance": "1000.00", "margin": "500.00"}
        actual_value = {"balance": "1000.00", "margin": "500.00"}
        integrity_check = financial_standards_service.perform_data_integrity_check(
            db=db_session,
            check_type="balance_verification",
            entity_type="account",
            entity_id="123",
            expected_value=expected_value,
            actual_value=actual_value,
            tolerance_threshold=Decimal("0.01"),
        )
        assert integrity_check.integrity_status == "pass"
        assert integrity_check.discrepancy_amount == Decimal("0")

    def test_data_integrity_check_with_variance(
        self, setup_database: Any, db_session: Any
    ) -> Any:
        """Test data integrity check with variance"""
        expected_value = {"balance": "1000.00"}
        actual_value = {"balance": "999.50"}
        integrity_check = financial_standards_service.perform_data_integrity_check(
            db=db_session,
            check_type="balance_verification",
            entity_type="account",
            entity_id="123",
            expected_value=expected_value,
            actual_value=actual_value,
            tolerance_threshold=Decimal("0.01"),
        )
        assert integrity_check.integrity_status == "fail"
        assert integrity_check.discrepancy_amount == Decimal("0.50")

    def test_reconciliation(self, setup_database: Any, db_session: Any) -> Any:
        """Test financial reconciliation"""
        reconciliation = financial_standards_service.perform_reconciliation(
            db=db_session,
            reconciliation_type="daily_balance",
            internal_source="account_balance",
            external_source="transaction_sum",
            internal_balance=Decimal("10000.00"),
            external_balance=Decimal("10000.00"),
            tolerance_threshold=Decimal("0.01"),
        )
        assert reconciliation.reconciliation_status == "matched"
        assert reconciliation.difference == Decimal("0.00")

    def test_sox_compliance_check(
        self, setup_database: Any, test_user: Any, db_session: Any
    ) -> Any:
        """Test SOX compliance check"""
        transaction_data = {
            "transaction_type": "trade_execution",
            "amount": Decimal("5000.00"),
            "symbol": "BTC-USD",
        }
        result = financial_standards_service.check_sox_compliance(
            db=db_session, transaction_data=transaction_data, user_id=test_user.id
        )
        assert "compliant" in result
        assert "violations" in result
        assert "controls_checked" in result
        assert "recommendations" in result


class TestDataProtection:
    """Test data protection and GDPR compliance"""

    def test_pii_detection(self) -> Any:
        """Test PII detection"""
        text_with_pii = "Contact John Doe at john.doe@example.com or call 555-123-4567"
        detected_pii = data_protection_service.detect_pii(text_with_pii)
        assert len(detected_pii) >= 2
        pii_types = [pii["type"] for pii in detected_pii]
        assert "email" in pii_types
        assert "phone" in pii_types

    def test_pii_masking(self) -> Any:
        """Test PII masking"""
        email = "john.doe@example.com"
        masked_email = data_protection_service.mask_pii(email, "email")
        assert masked_email != email
        assert "@example.com" in masked_email
        assert "j***e@example.com" == masked_email

    def test_data_sanitization_for_logging(self) -> Any:
        """Test data sanitization for logging"""
        sensitive_data = {
            "user_id": "123",
            "email": "user@example.com",
            "phone": "555-123-4567",
            "message": "Regular message",
        }
        sanitized = data_protection_service.sanitize_for_logging(sensitive_data)
        assert sanitized["user_id"] == "123"
        assert sanitized["email"] != sensitive_data["email"]
        assert sanitized["phone"] != sensitive_data["phone"]
        assert sanitized["message"] == "Regular message"

    def test_field_encryption_decryption(self) -> Any:
        """Test field-level encryption and decryption"""
        sensitive_data = "Social Security Number: 123-45-6789"
        encrypted = data_protection_service.encrypt_field(sensitive_data)
        assert encrypted != sensitive_data
        decrypted = data_protection_service.decrypt_field(encrypted)
        assert decrypted == sensitive_data

    def test_document_encryption_decryption(self) -> Any:
        """Test document-level encryption and decryption"""
        document = {
            "user_id": "123",
            "personal_info": {"name": "John Doe", "ssn": "123-45-6789"},
            "financial_info": {"account_number": "987654321", "balance": "10000.00"},
        }
        encrypted = data_protection_service.encrypt_document(document)
        assert encrypted != str(document)
        decrypted = data_protection_service.decrypt_document(encrypted)
        assert decrypted == document


class TestTrading:
    """Test trading functionality with security"""

    def test_create_trade_success(
        self, setup_database: Any, test_user: Any, test_account: Any, auth_headers: Any
    ) -> Any:
        """Test successful trade creation"""
        trade_data = {
            "account_id": test_account.id,
            "symbol": "BTC-USD",
            "trade_type": "buy",
            "order_type": "market",
            "quantity": "0.1",
            "price": "50000.0",
        }
        with patch.object(
            compliance_service, "advanced_transaction_monitoring"
        ) as mock_monitoring:
            mock_monitoring.return_value = {
                "monitoring_passed": True,
                "alerts": [],
                "risk_score": 10,
                "risk_level": "low",
            }
            with patch.object(
                financial_standards_service, "check_sox_compliance"
            ) as mock_sox:
                mock_sox.return_value = {
                    "compliant": True,
                    "violations": [],
                    "controls_checked": ["authorization_levels"],
                    "recommendations": [],
                }
                response = client.post("/trades", json=trade_data, headers=auth_headers)
                assert response.status_code == 200
                data = response.json()
                assert data["symbol"] == trade_data["symbol"]
                assert data["trade_type"] == trade_data["trade_type"]
                assert data["status"] == "pending"

    def test_create_trade_compliance_failure(
        self, setup_database: Any, test_user: Any, test_account: Any, auth_headers: Any
    ) -> Any:
        """Test trade creation with compliance failure"""
        trade_data = {
            "account_id": test_account.id,
            "symbol": "BTC-USD",
            "trade_type": "buy",
            "order_type": "market",
            "quantity": "10.0",
            "price": "50000.0",
        }
        with patch.object(
            compliance_service, "advanced_transaction_monitoring"
        ) as mock_monitoring:
            mock_monitoring.return_value = {
                "monitoring_passed": False,
                "alerts": [
                    {
                        "type": "large_transaction",
                        "description": "Transaction exceeds limit",
                    }
                ],
                "risk_score": 80,
                "risk_level": "high",
            }
            response = client.post("/trades", json=trade_data, headers=auth_headers)
            assert response.status_code == 403
            assert "compliance" in response.json()["detail"].lower()


class TestRiskManagement:
    """Test risk management features"""

    def test_risk_metrics_calculation(
        self, setup_database: Any, test_user: Any, test_account: Any, db_session: Any
    ) -> Any:
        """Test risk metrics calculation"""
        metrics = financial_standards_service.calculate_risk_metrics(
            db=db_session,
            entity_type="account",
            entity_id=str(test_account.id),
            metric_types=["var", "leverage_ratio", "liquidity_ratio"],
        )
        assert len(metrics) == 3
        metric_types = [metric.metric_type for metric in metrics]
        assert "var" in metric_types
        assert "leverage_ratio" in metric_types
        assert "liquidity_ratio" in metric_types

    def test_position_health_calculation(
        self, setup_database: Any, test_user: Any, test_account: Any, db_session: Any
    ) -> Any:
        """Test position health calculation"""
        position = Position(
            account_id=test_account.id,
            symbol="BTC-USD",
            position_type="long",
            size=Decimal("1.0"),
            entry_price=Decimal("50000.0"),
            current_price=Decimal("48000.0"),
            margin_requirement=Decimal("5000.0"),
            maintenance_margin=Decimal("2500.0"),
            unrealized_pnl=Decimal("-2000.0"),
            status="open",
        )
        db_session.add(position)
        db_session.commit()
        assert position.unrealized_pnl < 0
        assert position.current_price < position.entry_price


class TestAPIEndpoints:
    """Test API endpoints with security"""

    def test_health_check(self, setup_database: Any) -> Any:
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "services" in data
        assert "security_features" in data

    def test_unauthorized_access(self, setup_database: Any) -> Any:
        """Test unauthorized access to protected endpoints"""
        response = client.get("/trades")
        assert response.status_code == 401

    def test_rate_limiting(self, setup_database: Any) -> Any:
        """Test rate limiting functionality"""


class TestPerformance:
    """Test performance and optimization"""

    def test_database_query_performance(
        self, setup_database: Any, db_session: Any
    ) -> Any:
        """Test database query performance"""
        import time

        users = []
        for i in range(100):
            user = User(
                email=f"user{i}@example.com",
                hashed_password="hashed_password",
                full_name=f"User {i}",
                is_active=True,
            )
            users.append(user)
        db_session.add_all(users)
        db_session.commit()
        start_time = time.time()
        result = db_session.query(User).filter(User.is_active).limit(50).all()
        end_time = time.time()
        assert len(result) == 50
        assert end_time - start_time < 1.0

    def test_encryption_performance(self) -> Any:
        """Test encryption/decryption performance"""
        import time

        test_data = "This is a test string for encryption performance" * 100
        start_time = time.time()
        encrypted = data_protection_service.encrypt_field(test_data)
        encryption_time = time.time() - start_time
        start_time = time.time()
        decrypted = data_protection_service.decrypt_field(encrypted)
        decryption_time = time.time() - start_time
        assert decrypted == test_data
        assert encryption_time < 0.1
        assert decryption_time < 0.1


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment() -> Any:
    """Set up test environment"""
    import os

    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL
    yield
    if "TESTING" in os.environ:
        del os.environ["TESTING"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=.", "--cov-report=html"])

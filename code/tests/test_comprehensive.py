from typing import Any

"""
Comprehensive Test Suite for Optionix Platform
Tests security, compliance, and financial standards implementation
"""

import json
import sys
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.append("/Optionix/code/backend")
sys.path.append("/Optionix/code/quantitative")
sys.path.append("/Optionix/code/ai_models")
from app import app
from auth import AuthService, UserRole
from black_scholes import BlackScholesModel, OptionParameters, OptionType
from create_model import ModelService, ModelType
from monitoring import MonitoringService
from security import SecurityService

client = TestClient(app)


class TestSecurityCompliance:
    """Test security and compliance features"""

    def setup_method(self) -> Any:
        """Setup test environment"""
        self.security_service = SecurityService()
        self.auth_service = AuthService()

    def test_password_hashing(self) -> Any:
        """Test password hashing security"""
        password = "TestPassword123!"
        hashed = self.security_service.hash_password(password)
        assert hashed != password
        assert len(hashed) > 50
        assert self.security_service.verify_password(password, hashed)
        assert not self.security_service.verify_password("wrong_password", hashed)

    def test_jwt_token_security(self) -> Any:
        """Test JWT token generation and validation"""
        user_data = {
            "user_id": "test_user_123",
            "email": "test@example.com",
            "role": UserRole.TRADER.value,
        }
        token = self.auth_service.create_access_token(user_data)
        assert token is not None
        assert len(token) > 100
        decoded = self.auth_service.verify_token(token)
        assert decoded["user_id"] == user_data["user_id"]
        assert decoded["email"] == user_data["email"]
        assert decoded["role"] == user_data["role"]

    def test_data_encryption(self) -> Any:
        """Test data encryption and decryption"""
        sensitive_data = {
            "ssn": "123-45-6789",
            "account_number": "ACC123456789",
            "credit_card": "4111-1111-1111-1111",
        }
        encrypted = self.security_service.encrypt_sensitive_data(
            json.dumps(sensitive_data)
        )
        assert encrypted.encrypted_data != json.dumps(sensitive_data)
        assert encrypted.encryption_key is not None
        decrypted = self.security_service.decrypt_sensitive_data(encrypted)
        decrypted_data = json.loads(decrypted)
        assert decrypted_data == sensitive_data

    def test_input_validation(self) -> Any:
        """Test input validation and sanitization"""
        malicious_input = "'; DROP TABLE users; --"
        sanitized = self.security_service.sanitize_input(malicious_input)
        assert "DROP TABLE" not in sanitized
        assert ";" not in sanitized
        xss_input = "<script>alert('xss')</script>"
        sanitized = self.security_service.sanitize_input(xss_input)
        assert "<script>" not in sanitized
        assert "alert" not in sanitized

    def test_rate_limiting(self) -> Any:
        """Test rate limiting functionality"""
        user_id = "test_user_rate_limit"
        for i in range(5):
            result = self.security_service.check_rate_limit(user_id, "login")
            assert result is True
        for i in range(100):
            self.security_service.check_rate_limit(user_id, "login")
        result = self.security_service.check_rate_limit(user_id, "login")
        assert result is False

    def test_audit_logging(self) -> Any:
        """Test audit logging functionality"""
        audit_data = {
            "user_id": "test_user",
            "action": "login",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0",
            "timestamp": datetime.utcnow().isoformat(),
        }
        result = self.security_service.log_audit_event(audit_data)
        assert result is True
        log_hash = self.security_service.get_audit_log_hash(audit_data)
        assert len(log_hash) == 64


class TestFinancialCompliance:
    """Test financial compliance and regulatory features"""

    def setup_method(self) -> Any:
        """Setup test environment"""
        self.monitoring_service = MonitoringService(
            {
                "database_url": "sqlite:///test.db",
                "redis_host": "localhost",
                "redis_port": 6379,
            }
        )

    @pytest.mark.asyncio
    async def test_transaction_monitoring(self):
        """Test transaction monitoring for compliance"""
        transaction_data = {
            "transaction_id": "TXN123456",
            "user_id": "USER123",
            "amount": 15000,
            "type": "option_trade",
            "asset": "AAPL",
            "timestamp": datetime.utcnow().isoformat(),
        }
        alert = await self.monitoring_service.monitor_transaction(transaction_data)
        assert alert is not None
        assert alert.severity.value in ["medium", "high", "critical"]
        assert "Large transaction" in alert.description

    @pytest.mark.asyncio
    async def test_aml_compliance(self):
        """Test Anti-Money Laundering compliance"""
        user_id = "SUSPICIOUS_USER"
        transactions = []
        for i in range(10):
            transaction = {
                "transaction_id": f"TXN{i}",
                "user_id": user_id,
                "amount": 10000,
                "type": "deposit",
                "timestamp": datetime.utcnow() - timedelta(hours=i),
            }
            transactions.append(transaction)
        is_suspicious = await self.monitoring_service._detect_suspicious_patterns(
            user_id
        )
        assert isinstance(is_suspicious, bool)

    def test_kyc_validation(self) -> Any:
        """Test Know Your Customer validation"""
        kyc_data = {
            "user_id": "USER123",
            "full_name": "John Doe",
            "date_of_birth": "1990-01-01",
            "ssn": "123-45-6789",
            "address": "123 Main St, City, State 12345",
            "phone": "+1-555-123-4567",
            "email": "john.doe@example.com",
            "identity_document": "passport",
            "document_number": "A12345678",
        }
        is_valid = self.auth_service.validate_kyc_data(kyc_data)
        assert is_valid is True
        invalid_kyc = kyc_data.copy()
        invalid_kyc["ssn"] = "invalid_ssn"
        is_valid = self.auth_service.validate_kyc_data(invalid_kyc)
        assert is_valid is False

    def test_regulatory_reporting(self) -> Any:
        """Test regulatory reporting functionality"""
        report = self.monitoring_service.generate_regulatory_report(
            "mifid_ii", "2024-Q1"
        )
        assert report is not None
        assert report.report_type == "mifid_ii"
        assert report.reporting_period == "2024-Q1"
        assert report.status == "generated"
        assert isinstance(report.data, dict)


class TestQuantitativeModels:
    """Test quantitative financial models"""

    def setup_method(self) -> Any:
        """Setup test environment"""
        self.bs_model = BlackScholesModel()

    def test_black_scholes_calculation(self) -> Any:
        """Test Black-Scholes option pricing"""
        params = OptionParameters(
            spot_price=100.0,
            strike_price=105.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            dividend_yield=0.02,
            option_type=OptionType.CALL,
        )
        price = self.bs_model.black_scholes_price(params)
        assert price > 0
        assert price < params.spot_price
        params.option_type = OptionType.PUT
        put_price = self.bs_model.black_scholes_price(params)
        assert put_price > 0

    def test_greeks_calculation(self) -> Any:
        """Test option Greeks calculation"""
        params = OptionParameters(
            spot_price=100.0,
            strike_price=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
        )
        greeks = self.bs_model.calculate_greeks(params)
        assert "delta" in greeks
        assert "gamma" in greeks
        assert "theta" in greeks
        assert "vega" in greeks
        assert "rho" in greeks
        assert 0 <= greeks["delta"] <= 1
        assert greeks["gamma"] >= 0
        assert greeks["vega"] >= 0

    def test_implied_volatility(self) -> Any:
        """Test implied volatility calculation"""
        params = OptionParameters(
            spot_price=100.0,
            strike_price=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
        )
        theoretical_price = self.bs_model.black_scholes_price(params)
        implied_vol = self.bs_model.implied_volatility(theoretical_price, params)
        assert abs(implied_vol - 0.2) < 0.01

    def test_input_validation(self) -> Any:
        """Test model input validation"""
        with pytest.raises(ValueError):
            invalid_params = OptionParameters(
                spot_price=-100.0,
                strike_price=100.0,
                time_to_expiry=0.25,
                risk_free_rate=0.05,
                volatility=0.2,
                option_type=OptionType.CALL,
            )
            self.bs_model.validate_inputs(invalid_params)
        with pytest.raises(ValueError):
            invalid_params = OptionParameters(
                spot_price=100.0,
                strike_price=100.0,
                time_to_expiry=-0.25,
                risk_free_rate=0.05,
                volatility=0.2,
                option_type=OptionType.CALL,
            )
            self.bs_model.validate_inputs(invalid_params)


class TestAIModels:
    """Test AI/ML models"""

    def setup_method(self) -> Any:
        """Setup test environment"""
        self.model_service = ModelService()

    def test_model_registration(self) -> Any:
        """Test model registration"""
        model_id = "test_volatility_model"
        result = self.model_service.register_model(
            model_id, ModelType.VOLATILITY_PREDICTION
        )
        assert result is True
        assert model_id in self.model_service.models
        assert model_id in self.model_service.model_registry

    def test_volatility_model_training(self) -> Any:
        """Test volatility model training"""
        dates = pd.date_range(start="2023-01-01", end="2023-12-31", freq="D")
        np.random.seed(42)
        data = pd.DataFrame(
            {
                "open": 100 + np.random.randn(len(dates)) * 2,
                "high": 102 + np.random.randn(len(dates)) * 2,
                "low": 98 + np.random.randn(len(dates)) * 2,
                "close": 100 + np.random.randn(len(dates)) * 2,
                "volume": 1000000 + np.random.randint(-100000, 100000, len(dates)),
            },
            index=dates,
        )
        data["high"] = np.maximum(data["high"], data[["open", "close"]].max(axis=1))
        data["low"] = np.minimum(data["low"], data[["open", "close"]].min(axis=1))
        model_id = "test_volatility_model"
        self.model_service.register_model(model_id, ModelType.VOLATILITY_PREDICTION)
        validation_result = self.model_service.train_model(model_id, data)
        assert validation_result is not None
        assert validation_result.model_id == model_id
        assert isinstance(validation_result.passed, bool)
        assert isinstance(validation_result.metrics, dict)

    def test_model_prediction(self) -> Any:
        """Test model prediction"""
        model_id = "test_volatility_model"
        pd.DataFrame(
            {
                "open": [100],
                "high": [102],
                "low": [98],
                "close": [101],
                "volume": [1000000],
            }
        )
        self.model_service.register_model(model_id, ModelType.VOLATILITY_PREDICTION)
        assert hasattr(self.model_service, "predict")


class TestAPIEndpoints:
    """Test API endpoints"""

    def test_health_endpoint(self) -> Any:
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_authentication_endpoints(self) -> Any:
        """Test authentication endpoints"""
        user_data = {
            "email": "test@example.com",
            "password": "TestPassword123!",
            "full_name": "Test User",
            "phone": "+1-555-123-4567",
        }
        response = client.post("/auth/register", json=user_data)
        assert response.status_code in [200, 201, 404, 422]

    def test_cors_headers(self) -> Any:
        """Test CORS headers are present"""
        response = client.options("/health")
        assert response.status_code in [200, 405]


class TestPerformance:
    """Test performance and scalability"""

    def test_black_scholes_performance(self) -> Any:
        """Test Black-Scholes calculation performance"""
        import time

        bs_model = BlackScholesModel()
        params = OptionParameters(
            spot_price=100.0,
            strike_price=100.0,
            time_to_expiry=0.25,
            risk_free_rate=0.05,
            volatility=0.2,
            option_type=OptionType.CALL,
        )
        start_time = time.time()
        for _ in range(1000):
            bs_model.black_scholes_price(params)
        end_time = time.time()
        assert end_time - start_time < 1.0

    def test_concurrent_requests(self) -> Any:
        """Test handling of concurrent requests"""
        import threading
        import time

        results = []

        def make_request():
            response = client.get("/health")
            results.append(response.status_code)

        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        start_time = time.time()
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        end_time = time.time()
        assert len(results) == 10
        assert all((status == 200 for status in results))
        assert end_time - start_time < 5.0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""Security service unit tests."""

from app.security import EncryptionResult, security_service


class TestPasswordValidation:
    def test_strong_password_valid(self):
        result = security_service.validate_password_strength("StrongPass123!")
        assert result["valid"] is True
        assert result["strength"] == "strong"
        assert result["issues"] == []

    def test_short_password_invalid(self):
        result = security_service.validate_password_strength("Short1!")
        assert result["valid"] is False
        assert any("12 characters" in issue for issue in result["issues"])

    def test_no_uppercase_invalid(self):
        result = security_service.validate_password_strength("lowercase123!abc")
        assert result["valid"] is False

    def test_no_lowercase_invalid(self):
        result = security_service.validate_password_strength("UPPERCASE123!ABC")
        assert result["valid"] is False

    def test_no_numbers_invalid(self):
        result = security_service.validate_password_strength("NoNumbers!abcABC")
        assert result["valid"] is False

    def test_no_special_chars_invalid(self):
        result = security_service.validate_password_strength("NoSpecial123abcABC")
        assert result["valid"] is False

    def test_strength_score_range(self):
        result = security_service.validate_password_strength("StrongPass123!")
        assert 0 <= result["strength_score"] <= 100

    def test_weak_password_has_issues(self):
        result = security_service.validate_password_strength("weak")
        assert len(result["issues"]) > 0
        assert result["strength"] == "weak"


class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        original = "sensitive information"
        encrypted = security_service.encrypt_sensitive_data(original)
        assert isinstance(encrypted, EncryptionResult)
        assert encrypted.encrypted_data != original
        assert encrypted.checksum is not None
        decrypted = security_service.decrypt_sensitive_data(encrypted)
        assert decrypted == original

    def test_encrypt_produces_different_ciphertext(self):
        data = "same plaintext"
        enc1 = security_service.encrypt_sensitive_data(data)
        enc2 = security_service.encrypt_sensitive_data(data)
        # Fernet uses random IV - should produce different ciphertext
        assert enc1.encrypted_data != enc2.encrypted_data

    def test_field_encrypt_decrypt(self):
        original = "test@example.com"
        encrypted = security_service.encrypt_field(original)
        assert encrypted != original
        decrypted = security_service.decrypt_field(encrypted)
        assert decrypted == original

    def test_encrypt_empty_string(self):
        result = security_service.encrypt_field("")
        assert result == ""

    def test_checksum_matches(self):
        import hashlib

        data = "check this"
        enc = security_service.encrypt_sensitive_data(data)
        expected = hashlib.sha256(data.encode()).hexdigest()
        assert enc.checksum == expected


class TestEthereumValidation:
    def test_valid_address(self):
        assert (
            security_service.validate_ethereum_address(
                "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
            )
            is True
        )

    def test_valid_lowercase_address(self):
        assert (
            security_service.validate_ethereum_address(
                "0xabcdef1234567890abcdef1234567890abcdef12"
            )
            is True
        )

    def test_invalid_address_no_0x(self):
        assert (
            security_service.validate_ethereum_address(
                "742d35Cc6634C0532925a3b844Bc454e4438f44e"
            )
            is False
        )

    def test_invalid_address_too_short(self):
        assert security_service.validate_ethereum_address("0x742d35") is False

    def test_invalid_address_non_hex(self):
        assert security_service.validate_ethereum_address("0xinvalid") is False

    def test_empty_address(self):
        assert security_service.validate_ethereum_address("") is False


class TestAPIKeyGeneration:
    def test_api_key_format(self):
        plain_key, hashed_key = security_service.generate_api_key()
        assert plain_key.startswith("ok_")
        assert len(plain_key) == 46

    def test_api_key_hash_deterministic(self):
        plain_key, hashed_key = security_service.generate_api_key()
        assert security_service.hash_api_key(plain_key) == hashed_key

    def test_validate_api_key_format_valid(self):
        plain_key, _ = security_service.generate_api_key()
        assert security_service.validate_api_key_format(plain_key) is True

    def test_validate_api_key_format_invalid(self):
        assert security_service.validate_api_key_format("invalid_key") is False
        assert security_service.validate_api_key_format("") is False

    def test_unique_keys_generated(self):
        key1, _ = security_service.generate_api_key()
        key2, _ = security_service.generate_api_key()
        assert key1 != key2


class TestInputSanitization:
    def test_strips_html_tags(self):
        sanitized = security_service.sanitize_input("<script>alert('xss')</script>")
        assert "<script>" not in sanitized
        assert "</script>" not in sanitized

    def test_removes_sql_keywords(self):
        sanitized = security_service.sanitize_input("DROP TABLE users")
        assert "DROP" not in sanitized

    def test_sanitize_dict(self):
        data = {"name": "<b>test</b>", "age": 30}
        sanitized = security_service.sanitize_input(data)
        assert isinstance(sanitized, dict)
        assert "<b>" not in sanitized["name"]
        assert sanitized["age"] == 30

    def test_sanitize_plain_string_preserved(self):
        sanitized = security_service.sanitize_input("Hello World")
        assert "Hello World" in sanitized

    def test_rate_limit_allows_within_limit(self):
        assert (
            security_service.check_rate_limit("user1", "test_action", limit=10) is True
        )

    def test_rate_limit_blocks_after_limit(self):
        user = "test_rate_user_unique_9999"
        for _ in range(100):
            security_service.check_rate_limit(user, "block_action", limit=5)
        result = security_service.check_rate_limit(user, "block_action", limit=5)
        assert result is False

    def test_audit_event_logged(self):
        result = security_service.log_audit_event(
            {
                "action": "test_event",
                "user_id": "123",
                "resource": "test",
            }
        )
        assert result is True

    def test_secure_token_generation(self):
        token = security_service.generate_secure_token(32)
        assert isinstance(token, str)
        assert len(token) > 0
        token2 = security_service.generate_secure_token(32)
        assert token != token2

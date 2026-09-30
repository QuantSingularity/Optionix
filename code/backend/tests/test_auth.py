"""Authentication endpoint tests for Optionix backend."""

import time


def _unique_email(tag: str = "") -> str:
    return f"test_{tag}_{int(time.time() * 1000)}@example.com"


def _register(
    client, email: str, password: str = "TestPassword123!", full_name: str = "Test User"
):
    return client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )


def _login(client, email: str, password: str = "TestPassword123!"):
    return client.post("/auth/login", json={"email": email, "password": password})


class TestRegistration:
    def test_register_success(self, client):
        email = _unique_email("reg")
        resp = _register(client, email)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["email"] == email
        assert data["is_active"] is True
        assert data["is_verified"] is False
        assert data["kyc_status"] == "pending"
        assert "user_id" in data

    def test_register_duplicate_email(self, client):
        email = _unique_email("dup")
        r1 = _register(client, email)
        assert r1.status_code == 200
        r2 = _register(client, email)
        assert r2.status_code == 400
        assert "already registered" in r2.json()["message"].lower()

    def test_register_weak_password(self, client):
        # Password too short - rejected by Pydantic schema (422)
        resp = _register(client, _unique_email("weak"), password="short")
        assert resp.status_code == 422

    def test_register_password_no_uppercase(self, client):
        # Passes schema (len>=8) but fails business-logic strength check
        resp = _register(client, _unique_email("noup"), password="password123!")
        assert resp.status_code in [400, 422]

    def test_register_invalid_email(self, client):
        resp = client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "TestPassword123!",
                "full_name": "Bad Email",
            },
        )
        assert resp.status_code == 422

    def test_register_missing_fields(self, client):
        resp = client.post("/auth/register", json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_register_returns_expected_fields(self, client):
        resp = _register(client, _unique_email("fields"))
        assert resp.status_code == 200
        data = resp.json()
        for field in (
            "user_id",
            "email",
            "full_name",
            "role",
            "is_active",
            "is_verified",
            "kyc_status",
            "mfa_enabled",
            "risk_score",
        ):
            assert field in data, f"Missing field: {field}"


class TestLogin:
    def test_login_success(self, client):
        email = _unique_email("login")
        _register(client, email)
        resp = _login(client, email)
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    def test_login_wrong_password(self, client):
        email = _unique_email("badpw")
        _register(client, email)
        resp = _login(client, email, password="WrongPassword99!")
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = _login(client, "nobody@nowhere.com", "TestPassword123!")
        assert resp.status_code == 401

    def test_login_missing_fields(self, client):
        resp = client.post("/auth/login", json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_login_invalid_json(self, client):
        resp = client.post(
            "/auth/login",
            content="not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422


class TestProtectedEndpoints:
    def test_me_without_token(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_with_valid_token(self, client, registered_user, auth_headers):
        resp = client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == registered_user["email"]

    def test_me_with_invalid_token(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401

    def test_me_with_malformed_header(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "NotBearer token"})
        assert resp.status_code in [401, 403]


class TestTokenRefresh:
    def test_refresh_token(self, client, registered_user):
        login_resp = _login(
            client, registered_user["email"], registered_user["password"]
        )
        assert login_resp.status_code == 200
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post(
            "/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_with_access_token_fails(self, client, auth_headers):
        access_token = auth_headers["Authorization"].split(" ")[1]
        resp = client.post(
            "/auth/refresh",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert resp.status_code == 401

    def test_refresh_without_token(self, client):
        resp = client.post("/auth/refresh")
        assert resp.status_code == 401

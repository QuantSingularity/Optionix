import time


def _unique_email(tag: str = "") -> str:
    return f"integ_{tag}_{int(time.time() * 1000)}@example.com"


def _register_and_login(client, tag: str = ""):
    email = _unique_email(tag)
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "TestPassword123!",
            "full_name": "Integration User",
        },
    )
    resp = client.post(
        "/auth/login", json={"email": email, "password": "TestPassword123!"}
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return email, resp.json()["access_token"]


class TestFullRegistrationLoginFlow:
    def test_register_login_access_profile(self, client):
        email = _unique_email("flow")
        reg = client.post(
            "/auth/register",
            json={
                "email": email,
                "password": "TestPassword123!",
                "full_name": "Flow User",
            },
        )
        assert reg.status_code == 200

        login = client.post(
            "/auth/login", json={"email": email, "password": "TestPassword123!"}
        )
        assert login.status_code == 200
        token = login.json()["access_token"]

        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_refresh_token_flow(self, client):
        email, _ = _register_and_login(client, "refresh")
        login = client.post(
            "/auth/login", json={"email": email, "password": "TestPassword123!"}
        )
        refresh_token = login.json()["refresh_token"]

        refresh = client.post(
            "/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert refresh.status_code == 200
        new_token = refresh.json()["access_token"]

        me = client.get("/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me.status_code == 200


class TestAPIErrorHandling:
    def test_root_to_volatility_flow(self, client, auth_headers):
        root = client.get("/")
        assert root.status_code == 200
        assert root.json()["status"] in ("online", "healthy")

        vol = client.post(
            "/market/volatility",
            headers=auth_headers,
            json={
                "symbol": "ETH",
                "open": 3000.0,
                "high": 3100.0,
                "low": 2900.0,
                "volume": 500000.0,
            },
        )
        assert vol.status_code == 200, vol.text
        assert float(vol.json()["volatility"]) > 0

    def test_volatility_requires_authentication(self, client):
        resp = client.post(
            "/market/volatility",
            json={
                "symbol": "ETH",
                "open": 3000.0,
                "high": 3100.0,
                "low": 2900.0,
                "volume": 1.0,
            },
        )
        assert resp.status_code == 401

    def test_unauthenticated_access_consistently_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_invalid_endpoints_return_404(self, client):
        for path in ["/nonexistent", "/api/v9/fake", "/admin/secret"]:
            resp = client.get(path)
            assert resp.status_code == 404, f"Expected 404 for {path}"

    def test_invalid_json_body_returns_422(self, client):
        resp = client.post(
            "/auth/login",
            content="invalid json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status_code == 422


class TestRateLimitHeaders:
    def test_rate_limit_headers_on_every_response(self, client):
        for _ in range(3):
            resp = client.get("/health")
            assert resp.status_code == 200
            assert "x-ratelimit-limit" in resp.headers
            assert "x-ratelimit-remaining" in resp.headers

    def test_remaining_decreases_with_requests(self, client):
        r1 = client.get("/")
        r2 = client.get("/")
        remaining1 = int(r1.headers.get("x-ratelimit-remaining", 9999))
        remaining2 = int(r2.headers.get("x-ratelimit-remaining", 9998))
        assert remaining2 <= remaining1 + 1


class TestMultipleUsersIsolation:
    def test_different_users_get_own_profile(self, client):
        email1 = _unique_email("u1")
        email2 = _unique_email("u2")

        client.post(
            "/auth/register",
            json={
                "email": email1,
                "password": "TestPassword123!",
                "full_name": "User One",
            },
        )
        client.post(
            "/auth/register",
            json={
                "email": email2,
                "password": "TestPassword123!",
                "full_name": "User Two",
            },
        )

        token1 = client.post(
            "/auth/login", json={"email": email1, "password": "TestPassword123!"}
        ).json()["access_token"]
        token2 = client.post(
            "/auth/login", json={"email": email2, "password": "TestPassword123!"}
        ).json()["access_token"]

        me1 = client.get("/auth/me", headers={"Authorization": f"Bearer {token1}"})
        me2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token2}"})

        assert me1.json()["email"] == email1
        assert me2.json()["email"] == email2
        assert me1.json()["user_id"] != me2.json()["user_id"]

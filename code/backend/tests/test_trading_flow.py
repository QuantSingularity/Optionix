"""
End-to-end regression tests for the trading, portfolio, risk, compliance and
analytics routers.

These routers previously depended on `get_current_user`, which returns the
raw JWT payload dict rather than a `User` ORM row, and several models were
queried/constructed with attributes that don't exist on them (e.g.
`Position.user_id`, `ComplianceReport.user_id`, `SanctionsCheck.entity_name`).
Every endpoint here is exercised with a real authenticated request to make
sure that class of bug can't silently regress.
"""

import time


def _register_and_auth(client, tag: str = ""):
    email = f"trading_{tag}_{int(time.time() * 1000)}@example.com"
    password = "TestPassword123!"
    reg = client.post(
        "/auth/register",
        json={"email": email, "password": password, "full_name": "Jane Trader"},
    )
    assert reg.status_code == 200, reg.text
    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_account(
    client, headers, address="0x111111111111111111111111111111111111111a"
):
    resp = client.post(
        "/trading/accounts",
        headers=headers,
        json={
            "ethereum_address": address,
            "account_type": "demo",
            "initial_deposit": 100000,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestAccounts:
    def test_create_and_list_accounts(self, client):
        headers = _register_and_auth(client, "acct")
        account = _create_account(client, headers)
        assert account["account_type"] == "demo"
        assert account["balance_usd"] == "100000.00000000"

        listed = client.get("/trading/accounts", headers=headers)
        assert listed.status_code == 200
        assert len(listed.json()) == 1

    def test_duplicate_address_rejected(self, client):
        headers = _register_and_auth(client, "dup")
        addr = "0x222222222222222222222222222222222222222b"
        _create_account(client, headers, addr)
        resp = client.post(
            "/trading/accounts",
            headers=headers,
            json={"ethereum_address": addr, "account_type": "demo"},
        )
        assert resp.status_code == 409


class TestTradingFlow:
    def test_place_order_and_view_positions(self, client):
        headers = _register_and_auth(client, "order")
        _create_account(client, headers, "0x333333333333333333333333333333333333333c")

        order = client.post(
            "/trading/orders",
            headers=headers,
            json={
                "account_id": 1,
                "symbol": "AAPL240119C00190000",
                "trade_type": "buy",
                "order_type": "market",
                "quantity": 1,
            },
        )
        assert order.status_code == 201, order.text
        assert order.json()["status"] == "executed"

        orders = client.get("/trading/orders", headers=headers)
        assert orders.status_code == 200
        assert len(orders.json()) == 1

        positions = client.get("/trading/positions", headers=headers)
        assert positions.status_code == 200

        summary = client.get("/trading/accounts/1/summary", headers=headers)
        assert summary.status_code == 200
        assert "margin_used" in summary.json()


class TestPortfolioFlow:
    def test_overview_allocation_performance_risk(self, client):
        headers = _register_and_auth(client, "pf")
        _create_account(client, headers, "0x444444444444444444444444444444444444444d")

        for path in (
            "/portfolio/overview",
            "/portfolio/allocation",
            "/portfolio/performance",
            "/portfolio/risk-metrics",
            "/portfolio/positions/greeks-summary",
        ):
            resp = client.get(path, headers=headers)
            assert resp.status_code == 200, f"{path} -> {resp.text}"


class TestRiskFlow:
    def test_var_stress_greeks_limits(self, client):
        headers = _register_and_auth(client, "risk")
        _create_account(client, headers, "0x555555555555555555555555555555555555555e")

        var_resp = client.post("/risk/var", headers=headers, json={})
        assert var_resp.status_code == 200

        stress_resp = client.post(
            "/risk/stress-test", headers=headers, json={"portfolio_value": 50000}
        )
        assert stress_resp.status_code == 200
        assert "worst_case_scenario" in stress_resp.json()

        greeks_resp = client.get("/risk/greeks/portfolio", headers=headers)
        assert greeks_resp.status_code == 200

        limits_resp = client.get("/risk/limits", headers=headers)
        assert limits_resp.status_code == 200

        breakers_resp = client.get("/risk/circuit-breakers", headers=headers)
        assert breakers_resp.status_code == 200


class TestComplianceFlow:
    def test_kyc_submit_and_status(self, client):
        headers = _register_and_auth(client, "kyc")

        submit = client.post(
            "/compliance/kyc/submit",
            headers=headers,
            json={
                "full_name": "Jane Trader",
                "date_of_birth": "1990-01-01",
                "nationality": "US",
                "address": {
                    "street": "123 Main St",
                    "city": "NYC",
                    "postal_code": "10001",
                    "country": "US",
                },
                "document_type": "passport",
                "document_number": "X1234567",
                "document_country": "US",
                "document_expiry": "2030-01-01",
            },
        )
        assert submit.status_code == 200, submit.text

        status_resp = client.get("/compliance/kyc/status", headers=headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["documents_submitted"] == 1

    def test_sanctions_aml_reports_audit(self, client):
        headers = _register_and_auth(client, "comp")

        sanctions = client.post("/compliance/sanctions/check", headers=headers)
        assert sanctions.status_code == 200

        alerts = client.get("/compliance/aml/alerts", headers=headers)
        assert alerts.status_code == 200

        report = client.post(
            "/compliance/reports/generate",
            headers=headers,
            json={
                "report_type": "monthly",
                "regulation_type": "sox",
                "period_start": "2026-01-01T00:00:00",
                "period_end": "2026-01-31T00:00:00",
            },
        )
        assert report.status_code == 200, report.text

        reports = client.get("/compliance/reports", headers=headers)
        assert reports.status_code == 200
        assert reports.json()["total"] == 1

        audit = client.get("/compliance/audit-logs", headers=headers)
        assert audit.status_code == 200

        overall = client.get("/compliance/status", headers=headers)
        assert overall.status_code == 200

        gdpr = client.post(
            "/compliance/gdpr/request", headers=headers, json={"request_type": "access"}
        )
        assert gdpr.status_code == 200


class TestAnalyticsFlow:
    def test_pricing_greeks_iv_surface(self, client):
        headers = _register_and_auth(client, "an")

        price = client.post(
            "/analytics/price",
            headers=headers,
            json={
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
                "volatility": 0.2,
            },
        )
        assert price.status_code == 200
        body = price.json()
        assert "delta" in body and "gamma" in body

        greeks = client.get(
            "/analytics/greeks/AAPL",
            headers=headers,
            params={"spot": 190, "strike": 195, "expiry_days": 30},
        )
        assert greeks.status_code == 200

        iv = client.post(
            "/analytics/implied-volatility",
            headers=headers,
            json={
                "market_price": 10,
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
            },
        )
        assert iv.status_code == 200

        surface = client.post(
            "/analytics/volatility-surface",
            headers=headers,
            json={
                "spot_price": 100,
                "strikes": [90, 100, 110],
                "expiries": [0.25, 0.5, 1],
            },
        )
        assert surface.status_code == 200

VALID_MARKET_DATA = {
    "symbol": "BTC",
    "open": 50000.0,
    "high": 52000.0,
    "low": 49000.0,
    "close": 51000.0,
    "volume": 1000000.0,
}


class TestVolatilityEndpoint:
    def test_valid_market_data_accepted(self, client, auth_headers):
        resp = client.post(
            "/market/volatility", headers=auth_headers, json=VALID_MARKET_DATA
        )
        assert resp.status_code == 200, resp.text

    def test_requires_authentication(self, client):
        resp = client.post("/market/volatility", json=VALID_MARKET_DATA)
        assert resp.status_code == 401

    def test_missing_required_fields(self, client, auth_headers):
        resp = client.post(
            "/market/volatility", headers=auth_headers, json={"open": 100.0}
        )
        assert resp.status_code == 422
        assert "detail" in resp.json() or "message" in resp.json()

    def test_missing_symbol(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        del data["symbol"]
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 422

    def test_negative_price_rejected(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        data["open"] = -100.0
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 422

    def test_zero_volume_accepted(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        data["volume"] = 0.0
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 200, resp.text

    def test_invalid_timeframe_rejected(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        data["timeframe"] = "2w"
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 422

    def test_inconsistent_ohlc_rejected(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        data["high"] = 48000.0
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 400

    def test_close_outside_range_rejected(self, client, auth_headers):
        data = VALID_MARKET_DATA.copy()
        data["close"] = 60000.0
        resp = client.post("/market/volatility", headers=auth_headers, json=data)
        assert resp.status_code == 400

    def test_response_structure(self, client, auth_headers):
        resp = client.post(
            "/market/volatility", headers=auth_headers, json=VALID_MARKET_DATA
        )
        assert resp.status_code == 200
        data = resp.json()
        for key in (
            "symbol",
            "volatility",
            "prediction_horizon",
            "timestamp",
            "model_version",
        ):
            assert key in data
        assert float(data["volatility"]) > 0

    def test_timeframe_scales_annualised_volatility(self, client, auth_headers):
        daily = client.post(
            "/market/volatility",
            headers=auth_headers,
            json={**VALID_MARKET_DATA, "timeframe": "1d"},
        )
        hourly = client.post(
            "/market/volatility",
            headers=auth_headers,
            json={**VALID_MARKET_DATA, "timeframe": "1h"},
        )
        assert float(hourly.json()["volatility"]) > float(daily.json()["volatility"])

    def test_empty_body_rejected(self, client, auth_headers):
        resp = client.post("/market/volatility", headers=auth_headers, json={})
        assert resp.status_code == 422

    def test_model_info(self, client, auth_headers):
        resp = client.get("/market/model-info", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "model_available" in body and "fallback_active" in body

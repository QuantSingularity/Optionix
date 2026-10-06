import math

import pytest
from app.services.model_service import ModelService, get_model_service
from app.services.pricing_engine import PricingEngine
from app.services.risk_assessment import RiskCalculator


@pytest.fixture(scope="module")
def engine():
    return PricingEngine()


@pytest.fixture(scope="module")
def trained_dir(tmp_path_factory):
    from app.services.ai_bridge import ai_submodule

    directory = str(tmp_path_factory.mktemp("artifacts"))
    ai_submodule("training.generate_artifacts").generate(directory, bars=2500)
    return directory


BAR = {"open": 100.0, "high": 103.0, "low": 98.0, "close": 101.0, "volume": 1000.0}


class TestModelServiceWithArtifacts:
    def test_trained_model_is_used(self, trained_dir):
        service = ModelService(artifact_dir=trained_dir, auto_generate=False)
        assert service.is_model_available()
        result = service.get_volatility_prediction({**BAR, "timeframe": "1d"})
        assert result["method"] == "model"
        assert result["confidence"] is not None and 0 < result["confidence"] <= 1
        assert 0.001 <= result["volatility"] <= 5.0
        assert result["features_used"]

    def test_wider_range_gives_higher_forecast(self, trained_dir):
        service = ModelService(artifact_dir=trained_dir, auto_generate=False)
        calm = service.get_volatility_prediction(
            {"open": 100, "high": 100.5, "low": 99.6, "close": 100.1, "volume": 1}
        )
        wild = service.get_volatility_prediction(
            {"open": 100, "high": 108, "low": 92, "close": 101, "volume": 1}
        )
        assert wild["volatility"] > calm["volatility"]

    def test_tampered_artifact_is_rejected(self, trained_dir, tmp_path):
        import shutil

        copy = tmp_path / "copy"
        shutil.copytree(trained_dir, copy)
        with open(copy / "volatility_model.pkl", "ab") as handle:
            handle.write(b"tamper")
        service = ModelService(artifact_dir=str(copy), auto_generate=False)
        assert not service.is_model_available()
        assert service.get_model_info()["load_error"] == "model integrity check failed"
        assert service.get_volatility_prediction(BAR)["method"] == "statistical"

    def test_auto_generate_creates_artifacts(self, tmp_path):
        import app.services.model_service as ms

        original = ms.ai_submodule

        class Shim:
            def __init__(self, module):
                self.module = module

            def generate(self, directory):
                return self.module.generate(directory, bars=1500)

        def patched(name):
            module = original(name)
            return Shim(module) if name == "training.generate_artifacts" else module

        ms.ai_submodule = patched
        try:
            service = ModelService(artifact_dir=str(tmp_path), auto_generate=True)
        finally:
            ms.ai_submodule = original
        assert service.is_model_available()

    def test_fallback_when_no_artifacts(self, tmp_path):
        service = ModelService(artifact_dir=str(tmp_path), auto_generate=False)
        assert not service.is_model_available()
        out = service.get_volatility_prediction(BAR)
        assert (
            out["model_version"] == "fallback_statistical" and out["confidence"] is None
        )

    @pytest.mark.parametrize(
        "bad",
        [
            {"open": 100, "high": 90, "low": 95},
            {"open": -5, "high": 10, "low": 1},
            {"open": 100, "high": 101, "low": 99, "close": 120},
            {"open": 100, "high": 101, "low": 99, "volume": -1},
        ],
    )
    def test_invalid_bars_raise(self, tmp_path, bad):
        service = ModelService(artifact_dir=str(tmp_path), auto_generate=False)
        with pytest.raises(ValueError):
            service.get_volatility_prediction(bad)

    def test_unknown_timeframe_raises(self, tmp_path):
        service = ModelService(artifact_dir=str(tmp_path), auto_generate=False)
        with pytest.raises(ValueError):
            service.get_volatility_prediction({**BAR, "timeframe": "2w"})

    def test_singleton(self):
        assert get_model_service() is get_model_service()


class TestPricingEngineAgainstReferences:
    def test_black_scholes_reference_values(self, engine):
        call = engine.price(100, 100, 1, 0.05, 0.2)
        put = engine.price(100, 100, 1, 0.05, 0.2, option_type="put")
        assert call["price"] == pytest.approx(10.4506, abs=1e-3)
        assert put["price"] == pytest.approx(5.5735, abs=1e-3)
        assert call["price"] - put["price"] == pytest.approx(
            100 - 100 * math.exp(-0.05), abs=1e-9
        )

    def test_put_delta_negative_and_greeks_signs(self, engine):
        g = engine.calculate_greeks(100, 100, 1, 0.05, 0.2, 0.0, "put")
        assert (
            -1 < g["delta"] < 0 and g["gamma"] > 0 and g["vega"] > 0 and g["theta"] < 0
        )

    def test_dividend_lowers_call_price(self, engine):
        base = engine.price(100, 100, 1, 0.05, 0.2)["price"]
        with_div = engine.price(100, 100, 1, 0.05, 0.2, q=0.03)["price"]
        assert with_div < base

    def test_american_put_exceeds_european(self, engine):
        eu = engine.price(100, 110, 1, 0.05, 0.25, option_type="put")["price"]
        am = engine.price(100, 110, 1, 0.05, 0.25, option_type="put", style="american")
        assert am["price"] > eu and am["method"] == "binomial_crr"

    def test_american_call_without_dividend_equals_european(self, engine):
        eu = engine.price(100, 100, 1, 0.05, 0.2)["price"]
        am = engine.price(100, 100, 1, 0.05, 0.2, style="american")["price"]
        assert am == pytest.approx(eu, abs=0.02)

    def test_barrier_in_plus_out_equals_vanilla(self, engine):
        kwargs = dict(
            S=100, K=100, T=1, r=0.05, sigma=0.2, barrier_level=120, style="barrier"
        )
        out = engine.price(**kwargs, barrier_type="up_and_out")["price"]
        inn = engine.price(**kwargs, barrier_type="up_and_in")["price"]
        vanilla = engine.price(100, 100, 1, 0.05, 0.2)["price"]
        assert out + inn == pytest.approx(vanilla, abs=1e-6)
        assert out < vanilla

    def test_barrier_requires_level(self, engine):
        with pytest.raises(ValueError):
            engine.price(100, 100, 1, 0.05, 0.2, style="barrier")

    def test_monte_carlo_agrees_with_analytic(self, engine):
        analytic = engine.price(100, 100, 1, 0.05, 0.2)["price"]
        mc = engine.price(
            100, 100, 1, 0.05, 0.2, method="monte_carlo", paths=200_000, seed=3
        )
        low, high = mc["confidence_interval"]
        assert low - 0.05 <= analytic <= high + 0.05
        assert mc["std_error"] > 0
        assert mc["greeks"]["delta"] == pytest.approx(0.6368, abs=0.02)

    def test_monte_carlo_barrier(self, engine):
        analytic = engine.price(
            100,
            100,
            1,
            0.05,
            0.25,
            style="barrier",
            barrier_level=85,
            barrier_type="down_and_out",
        )["price"]
        mc = engine.price(
            100,
            100,
            1,
            0.05,
            0.25,
            method="monte_carlo",
            style="barrier",
            barrier_level=85,
            barrier_type="down_and_out",
            paths=60_000,
            seed=5,
        )
        assert mc["price"] == pytest.approx(analytic, abs=0.2)

    def test_heston_reduces_to_black_scholes_with_tiny_vol_of_vol(self, engine):
        bs = engine.price(100, 100, 1, 0.05, 0.2)["price"]
        heston = engine.price(
            100,
            100,
            1,
            0.05,
            0.2,
            method="heston",
            heston_params={
                "v0": 0.04,
                "kappa": 2.0,
                "theta": 0.04,
                "sigma": 0.01,
                "rho": 0.0,
            },
        )
        assert heston["price"] == pytest.approx(bs, abs=0.01)

    def test_heston_negative_correlation_skews_otm_put(self, engine):
        params = {"v0": 0.04, "kappa": 2.0, "theta": 0.04, "sigma": 0.6, "rho": -0.8}
        put = engine.heston_price(100, 80, 1, 0.03, 0.0, "put", params)
        flat = engine.european_price(100, 80, 1, 0.03, 0.2, 0.0, "put")
        assert put > flat

    def test_implied_volatility_roundtrip(self, engine):
        price = engine.price(100, 105, 0.5, 0.03, 0.37, q=0.01, option_type="put")[
            "price"
        ]
        assert engine.implied_volatility(
            price, 100, 105, 0.5, 0.03, 0.01, "put"
        ) == pytest.approx(0.37, abs=1e-6)

    def test_implied_volatility_rejects_arbitrage_price(self, engine):
        with pytest.raises(ValueError):
            engine.implied_volatility(0.0001, 100, 50, 1, 0.05, 0.0, "call")

    def test_expired_option_returns_intrinsic(self, engine):
        result = engine.price(110, 100, 1e-9, 0.05, 0.2)
        assert result["price"] == 10.0 and result["greeks"]["delta"] == 0.0

    def test_unknown_style_and_method_rejected(self, engine):
        with pytest.raises(ValueError):
            engine.price(100, 100, 1, 0.05, 0.2, style="bermudan")
        with pytest.raises(ValueError):
            engine.price(100, 100, 1, 0.05, 0.2, method="magic")

    def test_calibration_roundtrip(self, engine):
        truth = {"v0": 0.05, "kappa": 1.5, "theta": 0.06, "sigma": 0.6, "rho": -0.65}
        options = []
        for T in (0.25, 0.5, 1.0):
            for K in (85, 95, 100, 105, 115):
                kind = "call" if K >= 100 else "put"
                options.append(
                    {
                        "strike": K,
                        "expiry": T,
                        "option_type": kind,
                        "price": engine.heston_price(100, K, T, 0.02, 0.0, kind, truth),
                    }
                )
        fitted = engine.calibrate("heston", options, 100.0, 0.02, 0.0)
        for key, value in truth.items():
            assert fitted["parameters"][key] == pytest.approx(value, rel=0.02, abs=0.01)

    def test_parametric_and_simulated_returns_consistent(self, engine):
        calc = RiskCalculator()
        sim = engine.simulate_returns(0.3, 1, 200_000, seed=1)
        par = engine.parametric_returns(0.3, 1)
        v_sim = calc.calculate_var(sim, 0.99)
        v_par = calc.calculate_var(par, 0.99)
        assert v_sim == pytest.approx(v_par, abs=0.003)

    def test_stress_revaluation_short_put_loses_in_crash(self, engine):
        position = {
            "option_type": "put",
            "spot": 100.0,
            "strike": 100.0,
            "time_to_expiry": 0.5,
            "volatility": 0.25,
            "quantity": -10.0,
            "rate": 0.03,
            "dividend_yield": 0.0,
            "multiplier": 100.0,
        }
        assert engine.revalue_scenario([position], -0.3, 0.5, 0.0) < 0
        assert (
            engine.revalue_scenario([dict(position, quantity=10.0)], -0.3, 0.5, 0.0) > 0
        )


class TestAnalyticsEndpoints:
    def _post(self, client, headers, path, body):
        return client.post(path, headers=headers, json=body)

    def test_price_requires_auth(self, client):
        assert client.post("/analytics/price", json={}).status_code in (401, 422)

    def test_price_american_put(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 110,
                "time_to_expiry": 1,
                "volatility": 0.25,
                "option_type": "put",
                "option_style": "american",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert (
            body["method"] == "binomial_crr"
            and body["delta"] < 0
            and body["option_style"] == "american"
        )

    def test_price_barrier_and_validation(self, client, auth_headers):
        base = {
            "spot_price": 100,
            "strike_price": 100,
            "time_to_expiry": 1,
            "volatility": 0.2,
            "option_style": "barrier",
        }
        missing = self._post(client, auth_headers, "/analytics/price", base)
        assert missing.status_code == 422
        ok = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {**base, "barrier_level": 120, "barrier_type": "up_and_out"},
        )
        assert ok.status_code == 200 and ok.json()["method"] == "barrier_analytic"

    def test_price_monte_carlo_returns_error_bars(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
                "volatility": 0.2,
                "pricing_method": "monte_carlo",
                "monte_carlo_paths": 20000,
            },
        )
        body = r.json()
        assert (
            r.status_code == 200
            and body["std_error"] > 0
            and len(body["confidence_interval"]) == 2
        )

    def test_put_via_monte_carlo_is_a_put(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
                "volatility": 0.2,
                "option_type": "put",
                "pricing_method": "monte_carlo",
                "monte_carlo_paths": 50000,
            },
        )
        assert r.json()["price"] == pytest.approx(5.57, abs=0.25)
        assert r.json()["delta"] < 0

    def test_price_heston(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
                "volatility": 0.2,
                "pricing_method": "heston",
                "heston": {
                    "v0": 0.04,
                    "kappa": 2,
                    "theta": 0.04,
                    "sigma": 0.5,
                    "rho": -0.7,
                },
            },
        )
        assert r.status_code == 200 and r.json()["method"] == "heston"

    def test_invalid_combinations_rejected(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
                "volatility": 0.2,
                "option_style": "american",
                "pricing_method": "monte_carlo",
            },
        )
        assert r.status_code == 422

    def test_implied_vol_unattainable_price_is_422(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/implied-volatility",
            {
                "market_price": 500,
                "spot_price": 100,
                "strike_price": 100,
                "time_to_expiry": 1,
            },
        )
        assert r.status_code == 422

    def test_implied_vol_roundtrip(self, client, auth_headers):
        p = self._post(
            client,
            auth_headers,
            "/analytics/price",
            {
                "spot_price": 100,
                "strike_price": 95,
                "time_to_expiry": 0.5,
                "volatility": 0.33,
                "dividend_yield": 0.01,
            },
        ).json()["price"]
        r = self._post(
            client,
            auth_headers,
            "/analytics/implied-volatility",
            {
                "market_price": p,
                "spot_price": 100,
                "strike_price": 95,
                "time_to_expiry": 0.5,
                "dividend_yield": 0.01,
            },
        )
        assert r.json()["implied_volatility"] == pytest.approx(0.33, abs=1e-4)

    def test_parametric_surface_has_skew(self, client, auth_headers):
        r = self._post(
            client,
            auth_headers,
            "/analytics/volatility-surface",
            {
                "spot_price": 100,
                "strikes": [80, 100, 120],
                "expiries": [0.5],
                "base_volatility": 0.25,
            },
        )
        body = r.json()
        vols = {p["strike"]: p["implied_vol"] for p in body["surface"]}
        assert (
            body["source"] == "parametric"
            and vols[80] > vols[100]
            and vols[80] > vols[120]
        )

    def test_fitted_surface_with_arbitrage_report(self, client, auth_headers):
        quotes = [
            {
                "strike": k,
                "expiry": t,
                "implied_volatility": 0.2 + 0.0004 * (100 - k) + 0.02 * t,
                "option_type": "call",
            }
            for t in (0.25, 0.5, 1.0)
            for k in (80, 90, 100, 110, 120)
        ]
        r = self._post(
            client,
            auth_headers,
            "/analytics/volatility-surface",
            {
                "spot_price": 100,
                "strikes": [85, 100, 115],
                "expiries": [0.3, 0.75],
                "quotes": quotes,
                "method": "svi",
            },
        )
        body = r.json()
        assert r.status_code == 200 and body["source"] == "fitted"
        assert body["fit_metrics"]["rmse"] < 0.01 and "violations" in body["arbitrage"]

    def test_calibrate_endpoint(self, client, auth_headers, engine):
        truth = {"v0": 0.05, "kappa": 1.5, "theta": 0.06, "sigma": 0.6, "rho": -0.65}
        options = [
            {
                "strike": K,
                "expiry": T,
                "option_type": "call" if K >= 100 else "put",
                "price": engine.heston_price(
                    100, K, T, 0.02, 0.0, "call" if K >= 100 else "put", truth
                ),
            }
            for T in (0.25, 0.5, 1.0)
            for K in (85, 95, 100, 105, 115)
        ]
        r = self._post(
            client,
            auth_headers,
            "/analytics/calibrate",
            {
                "model": "heston",
                "spot_price": 100,
                "risk_free_rate": 0.02,
                "options": options,
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["parameters"]["rho"] == pytest.approx(-0.65, abs=0.05)

    def test_quick_greeks_put(self, client, auth_headers):
        r = client.get(
            "/analytics/greeks/aapl",
            headers=auth_headers,
            params={
                "spot": 190,
                "strike": 195,
                "expiry_days": 30,
                "option_type": "put",
            },
        )
        body = r.json()
        assert (
            r.status_code == 200
            and body["symbol"] == "AAPL"
            and body["greeks"]["delta"] < 0
        )


class TestRiskEndpoints:
    def test_var_methods_and_source(self, client, auth_headers):
        out = {}
        for method in ("historical", "parametric", "monte_carlo"):
            r = client.post(
                "/risk/var",
                headers=auth_headers,
                json={
                    "method": method,
                    "annual_volatility": 0.4,
                    "confidence_levels": [0.95, 0.99],
                },
            )
            assert r.status_code == 200, r.text
            out[method] = r.json()
        assert out["parametric"]["volatility_source"] == "request"
        assert out["historical"]["volatility_source"] == "request_simulated"
        p95 = out["parametric"]["var_results"]["cl_95"]["var"]
        m95 = out["monte_carlo"]["var_results"]["cl_95"]["var"]
        assert p95 < 0 and abs(p95 - m95) / abs(p95) < 0.1
        assert (
            out["parametric"]["var_results"]["cl_99"]["cvar"]
            <= out["parametric"]["var_results"]["cl_99"]["var"]
        )

    def test_higher_vol_means_higher_var(self, client, auth_headers):
        low = client.post(
            "/risk/var",
            headers=auth_headers,
            json={"method": "parametric", "annual_volatility": 0.2},
        ).json()
        high = client.post(
            "/risk/var",
            headers=auth_headers,
            json={"method": "parametric", "annual_volatility": 0.6},
        ).json()
        assert high["var_results"]["cl_95"]["var"] < low["var_results"]["cl_95"]["var"]

    def test_var_uses_supplied_history(self, client, auth_headers):
        returns = [(-1) ** i * 0.01 * (1 + (i % 7) / 7) for i in range(120)]
        r = client.post(
            "/risk/var",
            headers=auth_headers,
            json={"method": "historical", "historical_returns": returns},
        )
        assert r.json()["volatility_source"] == "request_history"

    def test_var_rejects_bad_confidence(self, client, auth_headers):
        r = client.post(
            "/risk/var", headers=auth_headers, json={"confidence_levels": [1.5]}
        )
        assert r.status_code == 422

    def test_stress_full_revaluation(self, client, auth_headers):
        position = {
            "option_type": "put",
            "spot": 100,
            "strike": 100,
            "time_to_expiry": 0.5,
            "volatility": 0.25,
            "quantity": -10,
            "multiplier": 100,
        }
        r = client.post(
            "/risk/stress-test",
            headers=auth_headers,
            json={
                "portfolio_value": 100000,
                "scenarios": ["market_crash"],
                "positions": [position],
            },
        )
        body = r.json()
        assert r.status_code == 200 and body["valuation_method"] == "full_revaluation"
        assert body["results"][0]["estimated_pnl"] < 0

    def test_stress_linear_fallback(self, client, auth_headers):
        r = client.post(
            "/risk/stress-test", headers=auth_headers, json={"portfolio_value": 50000}
        )
        assert r.json()["valuation_method"] == "linear_approximation"

    def test_heatmap_put(self, client, auth_headers):
        r = client.post(
            "/risk/greeks/heatmap",
            headers=auth_headers,
            params={"spot": 100, "strike": 100, "expiry_days": 30},
            json={"option_type": "put", "grid_steps": 3},
        )
        body = r.json()
        assert r.status_code == 200 and body["grid_points"] == 9
        assert all(p["delta"] < 0 for p in body["heatmap"])

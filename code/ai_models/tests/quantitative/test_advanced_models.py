import numpy as np
import pytest
from ai_models.quantitative.advanced import (
    CalibrationEngine,
    CEVModel,
    DupireLocalVolModel,
    HestonModel,
    SabrModel,
    VolatilitySurface,
)
from ai_models.quantitative.advanced.volatility_surface import OptionData
from ai_models.quantitative.black_scholes import bs_price

HESTON = {"v0": 0.04, "kappa": 2.0, "theta": 0.04, "sigma": 0.5, "rho": -0.7}


def test_heston_semi_analytic_matches_monte_carlo():
    h = HestonModel(HESTON)
    for K, T, kind in [(100, 1.0, "call"), (80, 0.5, "put"), (120, 2.0, "call")]:
        exact = h.price_option(100, K, T, 0.03, 0.01, kind)
        mc = np.mean(
            [
                h.price_option(
                    100,
                    K,
                    T,
                    0.03,
                    0.01,
                    kind,
                    method="monte_carlo",
                    num_paths=60_000,
                    num_steps=int(250 * max(T, 0.5)),
                    seed=s,
                )
                for s in (1, 2)
            ]
        )
        assert exact == pytest.approx(mc, rel=0.02, abs=0.05)


def test_heston_limits_and_parity():
    flat = HestonModel(
        {"v0": 0.04, "kappa": 2.0, "theta": 0.04, "sigma": 0.01, "rho": 0.0}
    )
    assert flat.price_option(100, 100, 1, 0.05, 0.0, "call") == pytest.approx(
        bs_price(100, 100, 1, 0.05, 0.2), abs=0.01
    )
    h = HestonModel(HESTON)
    c = h.price_option(100, 95, 1, 0.03, 0.01, "call")
    p = h.price_option(100, 95, 1, 0.03, 0.01, "put")
    assert c - p == pytest.approx(100 * np.exp(-0.01) - 95 * np.exp(-0.03), abs=1e-6)
    assert h.price_option(120, 100, 0, 0.03, 0.0, "call") == 20.0


def test_heston_negative_rho_produces_downward_skew():
    smile = HestonModel(HESTON).implied_volatility_smile(
        100, np.array([80.0, 100.0, 120.0]), 1.0, 0.03
    )
    assert smile[0] > smile[1] > smile[2]


def test_heston_calibration_recovers_parameters():
    truth = {"v0": 0.05, "kappa": 1.5, "theta": 0.06, "sigma": 0.6, "rho": -0.65}
    model = HestonModel(truth)
    quotes = []
    for T in (0.25, 0.5, 1.0, 2.0):
        for K in (80, 90, 100, 110, 120):
            kind = "put" if K < 100 else "call"
            quotes.append(
                dict(
                    spot=100,
                    strike=K,
                    time_to_expiry=T,
                    rate=0.02,
                    dividend=0.01,
                    option_type=kind,
                    market_price=model.price_option(100, K, T, 0.02, 0.01, kind),
                )
            )
    fitted = HestonModel().calibrate(quotes)
    for key, value in truth.items():
        assert fitted[key] == pytest.approx(value, rel=0.02, abs=0.01)


def test_heston_validation():
    for bad in (
        {**HESTON, "rho": 1.0},
        {**HESTON, "v0": 0.0},
        {**HESTON, "kappa": -1},
        {"v0": 0.04},
    ):
        with pytest.raises(ValueError):
            HestonModel(bad)
    with pytest.raises(ValueError):
        HestonModel().calibrate([])


def test_sabr_calibration_roundtrip_and_validation():
    truth = {"alpha": 0.3, "beta": 0.5, "rho": -0.3, "nu": 0.4}
    model = SabrModel(truth)
    strikes = np.array([80.0, 90.0, 100.0, 110.0, 120.0])
    vols = model.implied_volatility(strikes, 100.0, 1.0)
    assert vols[2] == pytest.approx(0.03, rel=0.05)
    quotes = [
        dict(strike=float(k), forward=100.0, time_to_expiry=1.0, market_vol=float(v))
        for k, v in zip(strikes, vols)
    ]
    fitted = SabrModel({"alpha": 0.1, "beta": 0.5, "rho": 0.0, "nu": 0.2}).calibrate(
        quotes
    )
    for key in ("alpha", "rho", "nu"):
        assert fitted[key] == pytest.approx(truth[key], rel=0.02, abs=0.01)
    with pytest.raises(ValueError):
        SabrModel({"alpha": 0.3, "beta": 2.0, "rho": 0.0, "nu": 0.4})


def test_sabr_price_is_consistent_with_black():
    s = SabrModel({"alpha": 0.3, "beta": 0.5, "rho": 0.0, "nu": 1e-6})
    vol = s.implied_volatility(100.0, 100.0, 1.0)
    price = s.price_option(100.0, 100.0, 1.0, 0.03)
    assert price == pytest.approx(
        bs_price(100 * np.exp(-0.03), 100, 1.0, 0.03, vol, 0.0, "call"), abs=1e-9
    )


def _smile_quotes(spot=100.0, r=0.03, q=0.01):
    def iv(K, T):
        F = spot * np.exp((r - q) * T)
        k = np.log(K / F)
        return float(
            np.sqrt(0.04 + 0.04 * np.sqrt(T) * (-0.5 * k + np.sqrt(k**2 + 0.04)))
        )

    return [
        OptionData(K, T, iv(K, T), "call" if K >= 100 else "put")
        for T in (0.1, 0.25, 0.5, 1.0, 2.0)
        for K in (70, 80, 90, 95, 100, 105, 110, 120, 135)
    ], iv


@pytest.mark.parametrize("method", ["spline", "linear", "svi", "sabr"])
def test_surface_fit_and_interpolation(method):
    quotes, iv = _smile_quotes()
    surface = VolatilitySurface({"method": method})
    params = surface.fit_surface(quotes, 100.0, 0.03, 0.01)
    assert params.rmse < 0.005 and params.r_squared > 0.99
    assert surface.interpolate_volatility(97.0, 0.4) == pytest.approx(
        iv(97.0, 0.4), abs=0.005
    )
    assert surface.check_arbitrage().violations == []


def test_surface_grid_scalar_and_extrapolation_shapes():
    quotes, _ = _smile_quotes()
    surface = VolatilitySurface({"method": "svi"})
    surface.fit_surface(quotes, 100.0, 0.03, 0.01)
    assert isinstance(surface.interpolate_volatility(100.0, 1.0), float)
    assert surface.interpolate_volatility([90.0, 100.0, 110.0], 0.5).shape == (3,)
    grid = surface.implied_volatility_grid([80, 100, 120], [0.05, 0.3, 3.0])
    assert grid.shape == (3, 3) and np.isfinite(grid).all() and (grid > 0).all()


def test_surface_detects_arbitrage():
    calendar = [
        OptionData(k, t, v)
        for k in (100, 110)
        for t, v in ((0.5, 0.2), (1.0, 0.2), (2.0, 0.1))
    ]
    s = VolatilitySurface()
    s.fit_surface(calendar, 100.0)
    assert not s.check_arbitrage().calendar_arbitrage
    spiky = [
        OptionData(k, t, v)
        for t in (0.5, 1.0)
        for k, v in ((80, 0.2), (90, 0.2), (100, 0.45), (110, 0.2), (120, 0.2))
    ]
    s2 = VolatilitySurface({"method": "linear"})
    s2.fit_surface(spiky, 100.0)
    assert not s2.check_arbitrage().butterfly_arbitrage


def test_surface_export_roundtrip_and_validation(tmp_path):
    quotes, _ = _smile_quotes()
    s = VolatilitySurface({"method": "svi"})
    s.fit_surface(quotes, 100.0, 0.03, 0.01)
    path = str(tmp_path / "surface.json")
    s.export_surface(path)
    loaded = VolatilitySurface()
    loaded.load_surface(path)
    assert loaded.interpolate_volatility(97.0, 0.4) == pytest.approx(
        s.interpolate_volatility(97.0, 0.4)
    )
    with pytest.raises(ValueError):
        VolatilitySurface().fit_surface([OptionData(100, 0.5, 0.2)], 100.0)
    with pytest.raises(ValueError):
        VolatilitySurface().interpolate_volatility(100, 1)


def test_cev_analytic_vs_monte_carlo_and_calibration():
    cev = CEVModel({"sigma": 2.0, "beta": 0.5})
    for K, T, kind, r, q in [
        (110, 2.0, "call", 0.0, 0.0),
        (90, 0.5, "put", 0.03, 0.0),
        (100, 1.0, "call", 0.03, 0.01),
    ]:
        exact = cev.price_option(100, K, T, r, q, kind)
        mc = cev.price_option(
            100,
            K,
            T,
            r,
            q,
            kind,
            method="monte_carlo",
            num_paths=150_000,
            num_steps=300,
            seed=1,
        )
        assert exact == pytest.approx(mc, rel=0.01, abs=0.05)
    assert CEVModel({"sigma": 0.2, "beta": 1.0}).price_option(
        100, 100, 1, 0.05, 0, "call"
    ) == pytest.approx(bs_price(100, 100, 1, 0.05, 0.2), abs=1e-9)
    data = [
        dict(
            strike=K,
            expiry=T,
            option_type="call" if K >= 100 else "put",
            price=cev.price_option(100, K, T, 0.03, 0.0, "call" if K >= 100 else "put"),
        )
        for T in (0.5, 1.0)
        for K in (80, 90, 100, 110, 120)
    ]
    fitted = CEVModel().calibrate(data, 100, 0.03, 0.0)
    assert fitted["sigma"] == pytest.approx(2.0, rel=0.02) and fitted[
        "beta"
    ] == pytest.approx(0.5, abs=0.02)
    with pytest.raises(ValueError):
        CEVModel({"sigma": 1.0, "beta": 1.5})


def test_dupire_reprices_heston_surface():
    h = HestonModel(
        {"v0": 0.04, "kappa": 2.0, "theta": 0.05, "sigma": 0.5, "rho": -0.7}
    )
    data = []
    for T in (0.25, 0.5, 1.0, 1.5):
        for K in (70, 80, 90, 100, 110, 120, 130):
            kind = "call" if K >= 100 else "put"
            data.append(
                dict(
                    strike=K,
                    expiry=T,
                    option_type=kind,
                    price=h.price_option(100, K, T, 0.02, 0.0, kind),
                )
            )
    model = DupireLocalVolModel()
    local, strikes, times = model.calibrate(data, 100.0, 0.02, 0.0)
    assert local.shape == (len(times), len(strikes)) and np.isfinite(local).all()
    assert model.local_volatility(100, 80, 0.5) > model.local_volatility(100, 120, 0.5)
    for K, T, kind in [(100, 1.0, "call"), (90, 0.5, "put")]:
        lv = model.price_option(
            100, K, T, 0.02, 0.0, kind, num_paths=60_000, num_steps=100, seed=5
        )
        assert lv == pytest.approx(
            h.price_option(100, K, T, 0.02, 0.0, kind), rel=0.04, abs=0.1
        )


def test_calibration_engine_inputs():
    h = HestonModel(
        {"v0": 0.05, "kappa": 1.5, "theta": 0.06, "sigma": 0.6, "rho": -0.65}
    )
    options = {"calls": [], "puts": []}
    for T in (0.25, 0.5, 1.0):
        for K in (85, 95, 100, 105, 115):
            side = "calls" if K >= 100 else "puts"
            options[side].append(
                {
                    "strike": K,
                    "expiry": T,
                    "price": h.price_option(100, K, T, 0.02, 0.01, side[:-1]),
                }
            )
    engine = CalibrationEngine(spot=100, rate=0.02, dividend=0.01)
    result = engine.calibrate_heston(options)
    assert result["parameters"]["rho"] == pytest.approx(-0.65, abs=0.02)
    assert engine.calibrate_sabr(options)["diagnostics"]["success"]
    with pytest.raises(ValueError):
        CalibrationEngine().calibrate_heston(options)
    with pytest.raises(ValueError):
        engine.calibrate_heston({"calls": [], "puts": []})
    iv_only = engine._normalise(
        {"calls": [{"strike": 100, "iv": 0.2, "expiry": 0.5}]}, 100, 0.02, 0.01
    )
    assert iv_only[0]["price"] == pytest.approx(
        bs_price(100, 100, 0.5, 0.02, 0.2, 0.01, "call")
    )

import math

import numpy as np
import pytest
from ai_models.quantitative.black_scholes import (
    BarrierType,
    BlackScholesModel,
    OptionParameters,
    OptionStyle,
    OptionType,
    bs_price,
    bs_vega,
    implied_volatility_from_price,
)

M = BlackScholesModel()


def params(**kw):
    base = dict(
        spot_price=100.0,
        strike_price=100.0,
        time_to_expiry=1.0,
        risk_free_rate=0.05,
        volatility=0.2,
    )
    base.update(kw)
    return OptionParameters(**base)


def test_reference_prices():
    assert M.black_scholes_price(params()) == pytest.approx(10.4506, abs=1e-4)
    assert M.black_scholes_price(params(option_type=OptionType.PUT)) == pytest.approx(
        5.5735, abs=1e-4
    )


@pytest.mark.parametrize("q", [0.0, 0.02, 0.07])
@pytest.mark.parametrize("strike", [80.0, 100.0, 125.0])
def test_put_call_parity(q, strike):
    c = M.black_scholes_price(params(strike_price=strike, dividend_yield=q))
    p = M.black_scholes_price(
        params(strike_price=strike, dividend_yield=q, option_type=OptionType.PUT)
    )
    assert c - p == pytest.approx(
        100 * math.exp(-q) - strike * math.exp(-0.05), abs=1e-9
    )


@pytest.mark.parametrize("option_type", [OptionType.CALL, OptionType.PUT])
def test_greeks_match_finite_differences(option_type):
    p = params(dividend_yield=0.02, option_type=option_type)
    g = M.calculate_greeks(p)
    num = M._numerical_greeks(M.black_scholes_price, p)
    for key in ("delta", "gamma", "vega", "rho"):
        assert g[key] == pytest.approx(num[key], rel=2e-3, abs=1e-5)
    assert g["theta"] == pytest.approx(num["theta"], rel=2e-2, abs=1e-4)


def test_vectorised_pricing_matches_scalar():
    strikes = np.array([80.0, 100.0, 120.0])
    vec = bs_price(100.0, strikes, 1.0, 0.05, 0.2, 0.0, "call")
    scalar = [M.black_scholes_price(params(strike_price=k)) for k in strikes]
    assert np.allclose(vec, scalar)
    assert bs_vega(100.0, strikes, 1.0, 0.05, 0.2).shape == (3,)


@pytest.mark.parametrize("sigma", [0.05, 0.2, 0.9, 2.5])
@pytest.mark.parametrize("option_type", ["call", "put"])
def test_implied_volatility_roundtrip(sigma, option_type):
    price = bs_price(100, 110, 0.75, 0.03, sigma, 0.01, option_type)
    iv = implied_volatility_from_price(price, 100, 110, 0.75, 0.03, 0.01, option_type)
    assert iv == pytest.approx(sigma, abs=1e-5)


def test_implied_volatility_rejects_impossible_price():
    with pytest.raises(ValueError):
        implied_volatility_from_price(0.5, 100, 50, 1.0, 0.0, 0.0, "call")
    with pytest.raises(ValueError):
        implied_volatility_from_price(-1, 100, 100, 1.0, 0.0, 0.0, "call")


@pytest.mark.parametrize(
    "bad",
    [
        dict(spot_price=-1),
        dict(strike_price=0),
        dict(time_to_expiry=0),
        dict(volatility=10),
        dict(dividend_yield=2),
    ],
)
def test_validation(bad):
    with pytest.raises(ValueError):
        M.black_scholes_price(params(**bad))


def test_american_put_known_value_and_early_exercise_premium():
    am = M.binomial_price(
        params(option_type=OptionType.PUT, option_style=OptionStyle.AMERICAN)
    )
    eu = M.black_scholes_price(params(option_type=OptionType.PUT))
    assert am == pytest.approx(6.0896, abs=0.02)
    assert am > eu


def test_american_call_no_dividend_is_european():
    assert M.binomial_price(params()) == pytest.approx(
        M.black_scholes_price(params()), abs=0.02
    )


def test_american_call_with_dividend_has_premium():
    p = params(dividend_yield=0.08)
    assert M.binomial_price(p) > M.black_scholes_price(p)


def test_american_implied_volatility():
    p = params(
        option_type=OptionType.PUT, option_style=OptionStyle.AMERICAN, volatility=0.3
    )
    price = M.binomial_price(p)
    assert M.implied_volatility(price, p) == pytest.approx(0.3, abs=1e-3)


@pytest.mark.parametrize("option_type", [OptionType.CALL, OptionType.PUT])
@pytest.mark.parametrize(
    "pair", [("up_and_out", "up_and_in", 125.0), ("down_and_out", "down_and_in", 80.0)]
)
def test_barrier_in_out_parity(option_type, pair):
    out_t, in_t, level = pair
    kw = dict(
        option_type=option_type,
        option_style=OptionStyle.BARRIER,
        barrier_level=level,
        dividend_yield=0.01,
    )
    out = M.barrier_price(params(barrier_type=BarrierType(out_t), **kw))
    inn = M.barrier_price(params(barrier_type=BarrierType(in_t), **kw))
    vanilla = M.black_scholes_price(
        params(option_type=option_type, dividend_yield=0.01)
    )
    assert out + inn == pytest.approx(vanilla, abs=1e-6)
    assert 0 <= out <= vanilla


def test_barrier_far_barrier_approaches_vanilla():
    p = params(
        option_style=OptionStyle.BARRIER,
        barrier_level=1e4,
        barrier_type=BarrierType.UP_AND_OUT,
    )
    assert M.barrier_price(p) == pytest.approx(
        M.black_scholes_price(params()), abs=1e-4
    )


def test_barrier_already_breached():
    p = params(
        option_style=OptionStyle.BARRIER,
        barrier_level=90.0,
        barrier_type=BarrierType.DOWN_AND_OUT,
        spot_price=85.0,
    )
    assert M.barrier_price(p) == 0.0


def test_barrier_requires_specification():
    with pytest.raises(ValueError):
        M.barrier_price(params(option_style=OptionStyle.BARRIER))


def test_comprehensive_result_fields():
    r = M.comprehensive_option_price(params(strike_price=90.0))
    assert r.intrinsic_value == pytest.approx(10.0)
    assert r.time_value == pytest.approx(r.price - 10.0)
    assert r.moneyness == pytest.approx(100 / 90)
    assert r.calculation_method == "black_scholes"


def test_unsupported_style_raises():
    with pytest.raises(ValueError):
        M.comprehensive_option_price(params(option_style=OptionStyle.ASIAN))

import numpy as np
import pytest
from ai_models.quantitative.black_scholes import (
    BarrierType,
    BlackScholesModel,
    OptionParameters,
    OptionStyle,
    OptionType,
)
from ai_models.quantitative.monte_carlo import (
    MCSimulator,
    OptionPayoff,
    ProcessType,
    SimulationParameters,
    VarianceReduction,
)

BS = BlackScholesModel()
BASE = dict(
    initial_price=100.0,
    risk_free_rate=0.05,
    volatility=0.2,
    time_horizon=1.0,
    time_steps=1,
)


def sim(**kw):
    return MCSimulator(
        SimulationParameters(
            **{**BASE, "num_simulations": 100_000, "random_seed": 7, **kw}
        )
    )


@pytest.mark.parametrize(
    "vr",
    [
        None,
        VarianceReduction.ANTITHETIC,
        VarianceReduction.CONTROL_VARIATE,
        VarianceReduction.QUASI_RANDOM,
    ],
)
def test_european_call_matches_black_scholes(vr):
    result = sim(variance_reduction=vr).price_option(
        OptionPayoff("european", "call", 100.0)
    )
    exact = BS.black_scholes_price(OptionParameters(100, 100, 1, 0.05, 0.2))
    assert abs(result.option_price - exact) < 4 * max(result.standard_error, 0.01)


def test_estimator_is_unbiased_across_seeds():
    exact = BS.black_scholes_price(OptionParameters(100, 100, 1, 0.05, 0.2))
    z = []
    for seed in range(25):
        r = sim(random_seed=seed, num_simulations=40_000).price_option(
            OptionPayoff("european", "call", 100.0)
        )
        z.append((r.option_price - exact) / r.standard_error)
    assert abs(np.mean(z)) < 0.8 and 0.6 < np.std(z) < 1.5


def test_variance_reduction_lowers_standard_error():
    plain = sim().price_option(OptionPayoff("european", "call", 100.0)).standard_error
    cv = (
        sim(variance_reduction=VarianceReduction.CONTROL_VARIATE)
        .price_option(OptionPayoff("european", "call", 100.0))
        .standard_error
    )
    assert cv < plain


def test_dividend_yield_is_applied():
    with_div = (
        sim(dividend_yield=0.04)
        .price_option(OptionPayoff("european", "call", 100.0))
        .option_price
    )
    exact = BS.black_scholes_price(OptionParameters(100, 100, 1, 0.05, 0.2, 0.04))
    assert with_div == pytest.approx(exact, abs=0.12)


def test_seed_reproducibility_and_independence():
    a = sim().price_option(OptionPayoff("european", "call", 100.0)).option_price
    b = sim().price_option(OptionPayoff("european", "call", 100.0)).option_price
    c = (
        sim(random_seed=8)
        .price_option(OptionPayoff("european", "call", 100.0))
        .option_price
    )
    assert a == b and a != c


def test_global_numpy_state_untouched():
    np.random.seed(123)
    expected = np.random.rand()
    np.random.seed(123)
    sim().price_option(OptionPayoff("european", "call", 100.0))
    assert np.random.rand() == expected


def test_greeks_use_common_random_numbers():
    r = sim(num_simulations=200_000).price_option(
        OptionPayoff("european", "call", 100.0), compute_greeks=True
    )
    exact = BS.calculate_greeks(OptionParameters(100, 100, 1, 0.05, 0.2))
    assert r.greeks["delta"] == pytest.approx(exact["delta"], abs=0.01)
    assert r.greeks["vega"] == pytest.approx(exact["vega"], abs=0.02)
    assert r.greeks["rho"] == pytest.approx(exact["rho"], abs=0.03)
    assert r.greeks["gamma"] == pytest.approx(exact["gamma"], abs=0.003)


def test_greeks_not_computed_by_default():
    assert sim().price_option(OptionPayoff("european", "call", 100.0)).greeks == {}


@pytest.mark.parametrize(
    "barrier_type,level",
    [("up_and_out", 125.0), ("down_and_in", 85.0), ("down_and_out", 90.0)],
)
def test_barrier_matches_analytic(barrier_type, level):
    s = MCSimulator(
        SimulationParameters(
            **{
                **BASE,
                "time_steps": 200,
                "num_simulations": 60_000,
                "random_seed": 3,
                "volatility": 0.25,
            },
            variance_reduction=VarianceReduction.ANTITHETIC,
        )
    )
    mc = s.price_option(OptionPayoff("barrier", "call", 100.0, level, barrier_type))
    exact = BS.barrier_price(
        OptionParameters(
            100,
            100,
            1,
            0.05,
            0.25,
            0.0,
            OptionType.CALL,
            OptionStyle.BARRIER,
            level,
            BarrierType(barrier_type),
        )
    )
    assert abs(mc.option_price - exact) < 4 * mc.standard_error + 0.03


def test_asian_cheaper_than_european():
    s = MCSimulator(
        SimulationParameters(
            **{**BASE, "time_steps": 50, "num_simulations": 30_000, "random_seed": 1}
        )
    )
    paths = s.generate_paths()
    asian = s.price_option(OptionPayoff("asian", "call", 100.0), paths).option_price
    euro = s.price_option(OptionPayoff("european", "call", 100.0), paths).option_price
    assert asian < euro


def test_lookback_call_nonnegative_and_valuable():
    s = MCSimulator(
        SimulationParameters(
            **{**BASE, "time_steps": 50, "num_simulations": 20_000, "random_seed": 1}
        )
    )
    result = s.price_option(OptionPayoff("lookback", "call", 0.0))
    assert result.option_price > 5.0


def test_risk_metrics_semantics():
    s = sim(num_simulations=200_000)
    paths = s.generate_paths()
    m95 = s.calculate_risk_metrics(paths, 0.95)
    m99 = s.calculate_risk_metrics(paths, 0.99)
    assert 0 < m95["VaR"] < m99["VaR"]
    assert m95["CVaR"] >= m95["VaR"]
    losses = -(paths[-1] / paths[0] - 1)
    assert (losses > m95["VaR"]).mean() == pytest.approx(0.05, abs=0.005)
    with pytest.raises(ValueError):
        s.calculate_risk_metrics(paths, 1.2)


def test_jump_diffusion_and_heston_and_mean_reverting_run():
    jump = sim(
        process_type=ProcessType.JUMP_DIFFUSION,
        jump_intensity=0.5,
        jump_mean=-0.1,
        jump_volatility=0.15,
    ).price_option(OptionPayoff("european", "call", 100.0))
    exact = BS.black_scholes_price(OptionParameters(100, 100, 1, 0.05, 0.2))
    assert jump.option_price > 0
    heston = MCSimulator(
        SimulationParameters(
            **{**BASE, "time_steps": 100, "num_simulations": 20_000, "random_seed": 2},
            process_type=ProcessType.HESTON,
            initial_variance=0.04,
            variance_mean_reversion=2.0,
            long_term_variance=0.04,
            vol_of_vol=0.3,
            correlation=-0.7,
        )
    ).price_option(OptionPayoff("european", "call", 100.0))
    assert abs(heston.option_price - exact) < 1.0
    ou = MCSimulator(
        SimulationParameters(
            **{**BASE, "time_steps": 50, "num_simulations": 5_000, "volatility": 5.0},
            process_type=ProcessType.MEAN_REVERTING,
            mean_reversion_speed=2.0,
            long_term_mean=100.0,
        )
    ).generate_paths()
    assert (ou > 0).all()


def test_parameter_validation():
    for bad in (
        dict(initial_price=0),
        dict(volatility=-1),
        dict(time_horizon=0),
        dict(time_steps=0),
        dict(num_simulations=0),
        dict(process_type=ProcessType.MEAN_REVERTING),
        dict(process_type=ProcessType.JUMP_DIFFUSION),
        dict(process_type=ProcessType.HESTON),
    ):
        with pytest.raises(ValueError):
            sim(**bad)


def test_size_guard():
    with pytest.raises(ValueError):
        MCSimulator(
            SimulationParameters(
                **{**BASE, "time_steps": 1000, "num_simulations": 100_000}
            )
        ).generate_paths()


def test_invalid_payoffs():
    s = sim(num_simulations=1000)
    paths = s.generate_paths()
    for spec in (
        OptionPayoff("european", "straddle", 100.0),
        OptionPayoff("exotic", "call", 100.0),
        OptionPayoff("barrier", "call", 100.0),
        OptionPayoff("barrier", "call", 100.0, 120.0, "sideways"),
    ):
        with pytest.raises(ValueError):
            s.calculate_payoff(paths, spec)


def test_parallel_matches_serial_statistically():
    kwargs = dict(num_simulations=40_000, random_seed=11)
    serial = sim(**kwargs).price_option(OptionPayoff("european", "call", 100.0))
    parallel = sim(parallel=True, **kwargs).price_option(
        OptionPayoff("european", "call", 100.0)
    )
    assert abs(serial.option_price - parallel.option_price) < 5 * serial.standard_error


def test_stress_test_and_convergence():
    s = sim(num_simulations=20_000)
    out = s.run_stress_test(
        OptionPayoff("european", "call", 100.0),
        {"base": {}, "vol_up": {"volatility": 0.4}},
    )
    assert out["vol_up"] > out["base"]
    conv = s.convergence_analysis(OptionPayoff("european", "call", 100.0), points=5)
    assert (
        len(conv["prices"])
        == len(conv["num_simulations"])
        == len(conv["standard_errors"])
    )

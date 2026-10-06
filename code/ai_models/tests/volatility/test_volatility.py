import json
import shutil

import numpy as np
import pytest
from ai_models.training.synthetic import synthetic_ohlc
from ai_models.volatility.dataset import build_dataset
from ai_models.volatility.features import (
    FEATURE_NAMES,
    annualization_factor,
    bar_features_from_mapping,
    parkinson_volatility,
    validate_bar,
)
from ai_models.volatility.inference import VolatilityPredictor

BAR = {"open": 100.0, "high": 103.0, "low": 98.0, "close": 101.0, "volume": 5.0}


def test_feature_contract():
    f = bar_features_from_mapping(BAR)
    assert f.shape == (1, len(FEATURE_NAMES))
    assert f[0, 0] == pytest.approx(np.log(103 / 98))
    assert np.isfinite(f).all()


def test_validate_bar_rules():
    assert validate_bar({"open": 1, "high": 2, "low": 0.5})["close"] == 1.0
    for bad in (
        {"open": 1, "high": 0.5, "low": 0.9},
        {"open": 0, "high": 2, "low": 1},
        {"open": 1, "high": 2},
        {"open": 1, "high": 2, "low": 0.5, "close": 3},
        {"open": float("nan"), "high": 2, "low": 1},
    ):
        with pytest.raises(ValueError):
            validate_bar(bad)


def test_annualization_and_parkinson():
    assert annualization_factor("1d") == pytest.approx(np.sqrt(365))
    assert annualization_factor("1h") > annualization_factor("1d")
    with pytest.raises(ValueError):
        annualization_factor("3d")
    assert parkinson_volatility(110, 100) == pytest.approx(
        np.log(1.1) / (2 * np.sqrt(np.log(2)))
    )


def test_dataset_target_has_no_lookahead_leak():
    frame = synthetic_ohlc(600, seed=1)
    X, y = build_dataset(frame, horizon=5)
    returns = np.diff(np.log(frame["close"].to_numpy()))
    first_target = np.std(returns[0:5], ddof=1)
    assert any(np.isclose(y, first_target))
    assert len(X) == len(y) and len(y) <= len(frame) - 5


def test_trained_artifact_beats_baseline_and_is_deterministic(artifact_dir):
    with open(f"{artifact_dir}/volatility_model_metadata.json") as handle:
        meta = json.load(handle)
    assert meta["metrics"]["test_mae"] < meta["metrics"]["baseline_mae"]
    assert meta["features"] == list(FEATURE_NAMES)
    p = VolatilityPredictor(artifact_dir)
    assert p.predict(BAR, "1d")["volatility"] == p.predict(BAR, "1d")["volatility"]


def test_predictor_behaviour(artifact_dir, tmp_path):
    p = VolatilityPredictor(artifact_dir)
    out = p.predict(BAR, "1d")
    assert out["method"] == "model" and 0 < out["confidence"] <= 1
    assert p.predict(BAR, "1h")["volatility"] > out["volatility"]
    calm = p.predict({"open": 100, "high": 100.3, "low": 99.8, "close": 100.1}, "1d")[
        "volatility"
    ]
    assert calm < out["volatility"]
    fallback = VolatilityPredictor(str(tmp_path)).predict(BAR, "1d")
    assert fallback["method"] == "statistical" and fallback["volatility"] > 0


def test_predictor_rejects_tampering_and_contract_drift(artifact_dir, tmp_path):
    tampered = tmp_path / "t"
    shutil.copytree(artifact_dir, tampered)
    with open(tampered / "volatility_model.pkl", "ab") as handle:
        handle.write(b"x")
    assert not VolatilityPredictor(str(tampered)).available
    drift = tmp_path / "d"
    shutil.copytree(artifact_dir, drift)
    meta_path = drift / "volatility_model_metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["features"] = ["a", "b"]
    meta_path.write_text(json.dumps(meta))
    p = VolatilityPredictor(str(drift))
    assert not p.available and p.load_error == "model feature contract mismatch"

import numpy as np
import pandas as pd
import pytest
from ai_models.models import ModelService, ModelType, VolatilityModel
from ai_models.training.synthetic import synthetic_ohlc


def test_model_service_end_to_end(tmp_path):
    service = ModelService()
    frame = synthetic_ohlc(1500, seed=2)
    frame.index = pd.date_range("2021-01-01", periods=len(frame), freq="D", tz="UTC")
    assert service.register_model("vol", ModelType.VOLATILITY_PREDICTION)
    assert not service.register_model("x", ModelType.CREDIT_SCORING)
    with pytest.raises(ValueError):
        service.predict("vol", frame)
    result = service.train_model("vol", frame)
    assert result.metrics["test_mae"] > 0
    prediction = service.predict("vol", frame)
    assert prediction.prediction > 0 and 0 < prediction.confidence <= 1
    assert service.metadata_as_dict("vol")["model_type"] == "volatility_prediction"
    with pytest.raises(ValueError):
        service.predict("ghost", frame)
    path = str(tmp_path / "model.pkl")
    service.models["vol"].save(path)
    reloaded = VolatilityModel()
    reloaded.load(path)
    assert reloaded.predict(frame).prediction == pytest.approx(prediction.prediction)
    with pytest.raises(ValueError):
        reloaded.load(path, expected_sha256="0" * 64)


def test_fraud_model():
    rng = np.random.default_rng(0)
    n = 4000
    ts = pd.Timestamp("2024-01-01", tz="UTC") + pd.to_timedelta(
        np.sort(rng.integers(0, 90 * 86400, n)), unit="s"
    )
    amount = rng.lognormal(4, 0.6, n)
    fraud = rng.random(n) < 0.04
    amount[fraud] *= rng.uniform(5, 15, fraud.sum())
    data = pd.DataFrame(
        {
            "user_id": rng.integers(0, 200, n),
            "timestamp": ts,
            "amount": amount,
            "is_fraud": fraud.astype(int),
        }
    )
    service = ModelService()
    service.register_model("fraud", ModelType.FRAUD_DETECTION)
    result = service.train_model("fraud", data)
    assert result.metrics["recall"] > 0.6
    assert 0 <= service.predict("fraud", data.tail(30)).prediction <= 1
    with pytest.raises(ValueError):
        service.train_model("fraud", data.drop(columns=["is_fraud"]))

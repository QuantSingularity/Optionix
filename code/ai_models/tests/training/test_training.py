import numpy as np
import pytest
from ai_models.training.data_preprocessing import create_sequences, preprocess_data
from ai_models.training.synthetic import synthetic_ohlc
from ai_models.training.train_volatility_model import train_model
from ai_models.volatility.inference import VolatilityPredictor


def test_train_from_csv(tmp_path):
    frame = synthetic_ohlc(1500, seed=3)
    csv = tmp_path / "data.csv"
    frame.to_csv(csv, index=False)
    out = tmp_path / "out"
    meta = train_model(str(csv), str(out))
    assert meta["data_source"] == "csv" and VolatilityPredictor(str(out)).available
    train, test = preprocess_data(str(csv))
    assert len(train) > len(test) > 0 and "volatility_30d" in train.columns
    with pytest.raises(FileNotFoundError):
        train_model(str(tmp_path / "missing.csv"), str(out))


def test_create_sequences():
    data = np.random.default_rng(0).normal(size=(100, 4))
    X, y = create_sequences(data, window=10)
    assert X.shape == (90, 10, 3) and y.shape == (90,)
    with pytest.raises(ValueError):
        create_sequences(data[:5], window=10)

# Optionix AI Models

Quantitative pricing, model calibration and volatility forecasting used by the Optionix backend.

## Layout

```
ai_models/
  config.py                    shared paths and constants
  artifacts/                   generated model files (git ignored)
  quantitative/
    black_scholes.py           European, American (CRR lattice) and barrier pricing, Greeks, implied volatility
    monte_carlo.py             GBM, jump diffusion, Heston and mean reverting simulation with variance reduction
    advanced/
      stochastic_volatility.py Heston (characteristic function) and SABR (Hagan)
      volatility_surface.py    SVI, SABR, spline and linear surfaces with arbitrage checks
      local_volatility.py      Dupire local volatility and CEV
      calibration_engine.py    One entry point to calibrate every model from option quotes
  volatility/
    features.py                scale free single bar feature contract and bar validation
    dataset.py                 training set construction without look-ahead
    training.py                scikit-learn pipeline and out of sample validation
    artifacts.py               artifact persistence with SHA-256 integrity metadata
    inference.py               thread safe predictor used by the API
  models/
    schemas.py                 enums and dataclasses
    volatility_model.py        history based volatility forecaster
    fraud_model.py             supervised fraud classifier
    service.py                 model registry
  training/
    synthetic.py               Heston generated OHLC bars
    generate_artifacts.py      builds the default artifact set
    train_volatility_model.py  trains from a CSV of real bars
    data_preprocessing.py      CSV loading and sequence helpers
  tests/                       mirrors the package layout
```

## Setup

```
pip install -r requirements.txt
```

Run commands from the `code` directory so that `ai_models` is importable.

## Generating the volatility model

```
python -m ai_models.training.generate_artifacts
```

This writes `artifacts/volatility_model.pkl` and `artifacts/volatility_model_metadata.json`. The default set is trained on synthetic data. For production, train on real bars:

```
python -m ai_models.training.train_volatility_model --data bars.csv
```

The CSV needs the columns `open`, `high`, `low`, `close`, `volume`, and an optional `timestamp`.

## Feature contract

The model consumes five scale free features computed from one bar: `hl_range`, `oc_return`, `abs_oc_return`, `upper_wick`, `lower_wick`. The target is the standard deviation of the next 10 bar log returns, so output is per bar. `VolatilityPredictor.predict` annualises with the timeframe supplied (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`). The metadata file stores the feature list, and the predictor refuses to load a model whose features differ from the code.

## Artifact integrity

Artifacts are pickles, so the predictor verifies the SHA-256 recorded in the metadata before loading and falls back to a statistical Parkinson and Garman-Klass estimator if the check fails or the model is missing. Only load artifacts you generated yourself.

## Backend integration

The backend locates this package through `app/services/ai_bridge.py` (override with `AI_MODELS_DIR`). `PricingEngine` wraps `quantitative`, and `ModelService` wraps `volatility.inference`. In Docker, artifacts are generated at image build time.

## Tests

```
cd code && python -m pytest ai_models/tests
```

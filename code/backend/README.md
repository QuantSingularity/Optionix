# Optionix Backend

Production-grade FastAPI backend for the Optionix options trading platform.

## Features

| Category          | Details                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| **Auth**          | JWT access + refresh tokens, bcrypt passwords, MFA (TOTP), account lockout    |
| **RBAC**          | 9 roles (super_admin → viewer), granular permissions                          |
| **Security**      | AES-256 field encryption, input sanitisation, security headers, rate limiting |
| **Compliance**    | KYC/AML validation, sanctions screening, SAR generation, GDPR logs            |
| **Financial**     | Black-Scholes pricing, Greeks (Δ Γ Θ ν ρ), VaR, margin/liquidation            |
| **ML**            | Volatility prediction via scikit-learn; Parkinson statistical fallback        |
| **Blockchain**    | Optional Web3/Ethereum contract interaction                                   |
| **Observability** | Structured logging, Prometheus metrics, health endpoint                       |

## Project Structure

```
backend/
├── app/
│   ├── api/                    # Route handlers
│   │   ├── __init__.py         # Central APIRouter aggregator
│   │   ├── auth.py             # /auth/* endpoints
│   │   └── market.py           # /market/* endpoints
│   ├── middleware/
│   │   ├── security.py         # Rate-limit, security headers, audit logging
│   │   ├── audit_logging.py    # Request-level audit middleware
│   │   └── rate_limiting.py    # Re-export shim
│   ├── services/
│   │   ├── financial_service.py    # Black-Scholes, VaR, PnL, fees
│   │   ├── compliance_service.py   # KYC, AML, SAR, sanctions
│   │   ├── ai_bridge.py            # Locates the ai_models package
│   │   ├── model_service.py        # ML volatility prediction
│   │   ├── pricing_engine.py       # Facade over ai_models pricing
│   │   ├── risk_assessment.py      # VaR, ES, margin helpers
│   │   ├── health_service.py       # Aggregated service health
│   │   ├── blockchain_service.py   # Ethereum / Web3 (optional)
│   │   ├── risk_management/        # Advanced risk engine
│   │   └── trade_execution/        # Circuit breaker + execution engine
│   ├── auth.py                 # AuthService, MFAService, RBACService, JWT
│   ├── config.py               # Pydantic settings (env-driven)
│   ├── database.py             # SQLAlchemy engine + session factory
│   ├── models.py               # ORM models (User, Account, Trade, …)
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── security.py             # Encryption, API-key mgmt, sanitisation
│   ├── compliance.py           # Additional compliance utilities
│   ├── data_protection.py      # GDPR field encryption, consent logs
│   ├── financial_standards.py  # SOX / MiFID II / Dodd-Frank helpers
│   ├── data_handler.py         # Data validation & quality service
│   ├── monitoring.py           # Real-time monitoring & alerting
│   └── main.py                 # FastAPI app factory + lifespan
├── tests/                      # 189+ tests across 12 test modules
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_compliance.py
│   ├── test_financial.py
│   ├── test_health.py
│   ├── test_integration.py
│   ├── test_market.py
│   ├── test_models.py
│   ├── test_monitoring.py
│   ├── test_pricing.py
│   ├── test_pricing_engine.py
│   ├── test_security.py
│   └── test_system.py
├── .env.example
├── .gitignore
├── Makefile
├── pyproject.toml
├── pytest.ini
└── requirements.txt
```

## Quick Start

```bash
cd backend
cp .env.example .env          # fill in SECRET_KEY, ENCRYPTION_KEY, DATABASE_URL
pip install -r requirements.txt
make run                      # starts uvicorn with --reload
```

API docs: http://localhost:8000/docs

## Running Tests

```bash
make test           # run the full suite
make test-cov       # with HTML coverage report
```

## Key Environment Variables

| Variable              | Required | Notes                                                |
| --------------------- | -------- | ---------------------------------------------------- |
| `SECRET_KEY`          | Yes      | ≥ 32 random chars                                    |
| `ENCRYPTION_KEY`      | Yes      | Exactly 32 chars                                     |
| `DATABASE_URL`        | Yes      | PostgreSQL in prod; SQLite auto-used in tests        |
| `ENVIRONMENT`         | -        | `development` / `staging` / `production` / `testing` |
| `AI_MODELS_DIR`       | -        | Path to the `ai_models` package if not auto-detected |
| `MODEL_PATH`          | -        | Override for the model artifact location             |
| `MODEL_AUTO_GENERATE` | -        | `true` to build model artifacts on first start       |

See `.env.example` for the full list.

## API Endpoints

| Method | Path                            | Auth | Description                                                              |
| ------ | ------------------------------- | ---- | ------------------------------------------------------------------------ |
| GET    | `/`                             | -    | Welcome / status                                                         |
| GET    | `/health`                       | -    | Full service health                                                      |
| POST   | `/auth/register`                | -    | Create account                                                           |
| POST   | `/auth/login`                   | -    | Login, returns JWT pair                                                  |
| GET    | `/auth/me`                      | Yes  | Current user profile                                                     |
| POST   | `/auth/refresh`                 | -    | Refresh access token                                                     |
| POST   | `/market/volatility`            | Yes  | Volatility forecast from the latest OHLC bar                             |
| GET    | `/market/model-info`            | Yes  | Loaded model version, metrics and fallback status                        |
| POST   | `/analytics/price`              | Yes  | European, American and barrier pricing: analytic, Monte Carlo or Heston  |
| POST   | `/analytics/implied-volatility` | Yes  | Implied volatility, including American exercise                          |
| POST   | `/analytics/volatility-surface` | Yes  | Parametric or fitted (SVI, SABR, spline) surface with arbitrage report   |
| POST   | `/analytics/calibrate`          | Yes  | Calibrate Heston, SABR or CEV to option quotes                           |
| GET    | `/analytics/greeks/{symbol}`    | Yes  | Greeks and price for a call or put                                       |
| POST   | `/risk/var`                     | Yes  | Value at Risk by historical, parametric or Monte Carlo method            |
| POST   | `/risk/stress-test`             | Yes  | Scenario stress tests, with full revaluation when positions are supplied |

## AI Models Integration

The `ai_models` package is located at startup by `app/services/ai_bridge.py`. `PricingEngine` wraps `ai_models.quantitative` and `ModelService` wraps `ai_models.volatility.inference`.

- Generate model artifacts with `python -m ai_models.training.generate_artifacts` from the `code` directory. Docker builds do this automatically.
- When artifacts are missing or fail their SHA-256 check, `/market/volatility` falls back to a statistical range estimator and `/market/model-info` reports `fallback_active`.
- The volatility endpoint returns an annualised figure that scales with the requested timeframe.
- CPU heavy endpoints run in a worker thread so they do not block the event loop.

## Docker

```bash
docker compose up --build
```

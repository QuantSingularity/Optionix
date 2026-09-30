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
│   │   ├── model_service.py        # ML volatility prediction
│   │   ├── pricing_engine.py       # Greeks + Monte Carlo pricing
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
make test           # run all 189 tests
make test-cov       # with HTML coverage report
```

## Key Environment Variables

| Variable         | Required | Notes                                                |
| ---------------- | -------- | ---------------------------------------------------- |
| `SECRET_KEY`     | ✅       | ≥ 32 random chars                                    |
| `ENCRYPTION_KEY` | ✅       | Exactly 32 chars                                     |
| `DATABASE_URL`   | ✅       | PostgreSQL in prod; SQLite auto-used in tests        |
| `ENVIRONMENT`    | -        | `development` / `staging` / `production` / `testing` |

See `.env.example` for the full list.

## API Endpoints

| Method | Path                 | Auth | Description           |
| ------ | -------------------- | ---- | --------------------- |
| GET    | `/`                  | -    | Welcome / status      |
| GET    | `/health`            | -    | Full service health   |
| POST   | `/auth/register`     | -    | Create account        |
| POST   | `/auth/login`        | -    | Login → JWT pair      |
| GET    | `/auth/me`           | 🔒   | Current user profile  |
| POST   | `/auth/refresh`      | -    | Refresh access token  |
| POST   | `/market/volatility` | -    | Volatility prediction |

## Docker

```bash
docker compose up --build
```

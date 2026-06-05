# Optionix Code Directory

This directory contains the core backend systems for the Optionix options trading and analytics platform, organized into three modules: AI/ML models for predictive analytics, a production-grade FastAPI backend, and Ethereum smart contracts for decentralized options settlement.

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [AI Models](#ai-models)
- [Backend](#backend)
- [Blockchain](#blockchain)
- [Getting Started](#getting-started)
- [Technology Stack](#technology-stack)
- [Security and Compliance](#security-and-compliance)

## Overview

| Module        | Language              | Purpose                                                                   |
| ------------- | --------------------- | ------------------------------------------------------------------------- |
| `ai_models/`  | Python                | Volatility prediction, quantitative pricing models, ML training pipelines |
| `backend/`    | Python (FastAPI)      | REST API, authentication, trading engine, risk management, compliance     |
| `blockchain/` | Solidity / JavaScript | Ethereum smart contracts for decentralized options and futures            |

AI models feed volatility predictions and pricing data into the backend API. The backend handles order execution, portfolio management, risk assessment, and regulatory compliance. The blockchain layer enables on-chain options contracts with transparent, immutable settlement.

## Directory Structure

```
code/
├── ai_models/
│   ├── quantitative/
│   │   ├── __init__.py
│   │   ├── black_scholes.py              # Black-Scholes options pricing
│   │   ├── monte_carlo.py                # Monte Carlo simulation engine
│   │   └── advanced/
│   │       ├── __init__.py
│   │       ├── calibration_engine.py     # Model calibration engine
│   │       ├── local_volatility.py       # Local volatility surface models
│   │       ├── stochastic_volatility.py  # Stochastic volatility models
│   │       └── volatility_surface.py     # Volatility surface construction
│   ├── training_scripts/
│   │   ├── __init__.py
│   │   ├── data_preprocessing.py         # Data cleaning and feature engineering
│   │   └── train_volatility_model.py     # Volatility model training pipeline
│   ├── __init__.py
│   ├── create_model.py                   # Model creation orchestrator
│   ├── generate_model_artifacts.py       # Artifact generation and export
│   └── volatility_model_metadata.json    # Model metadata and versioning
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── __init__.py               # Central APIRouter aggregator
│   │   │   ├── analytics.py              # Analytics endpoints
│   │   │   ├── auth.py                   # Authentication endpoints
│   │   │   ├── compliance.py             # Compliance and KYC endpoints
│   │   │   ├── market.py                 # Market data endpoints
│   │   │   ├── portfolio.py              # Portfolio management endpoints
│   │   │   ├── risk.py                   # Risk management endpoints
│   │   │   └── trading.py                # Trade execution endpoints
│   │   ├── middleware/
│   │   │   ├── audit_logging.py          # Request-level audit middleware
│   │   │   ├── rate_limiting.py          # Rate limiting shim
│   │   │   └── security.py              # Security headers and request hardening
│   │   ├── services/
│   │   │   ├── risk_management/
│   │   │   │   └── risk_engine.py        # Advanced risk calculation engine
│   │   │   ├── trade_execution/
│   │   │   │   ├── circuit_breaker.py    # Circuit breaker pattern for execution
│   │   │   │   └── execution_engine.py   # Order execution engine
│   │   │   ├── blockchain_service.py     # Web3/Ethereum contract interaction
│   │   │   ├── compliance_service.py     # KYC, AML, sanctions screening
│   │   │   ├── financial_service.py      # Black-Scholes, VaR, PnL, fees
│   │   │   ├── health_service.py         # Aggregated service health checks
│   │   │   ├── model_service.py          # ML volatility prediction service
│   │   │   ├── pricing_engine.py         # Greeks calculation and Monte Carlo
│   │   │   └── risk_assessment.py        # VaR, ES, margin helpers
│   │   ├── auth.py                       # AuthService, MFAService, RBACService
│   │   ├── config.py                     # Pydantic settings (env-driven)
│   │   ├── data_handler.py               # Data validation and quality
│   │   ├── data_protection.py            # GDPR field encryption, consent logs
│   │   ├── database.py                   # SQLAlchemy engine and session factory
│   │   ├── financial_standards.py        # SOX / MiFID II / Dodd-Frank helpers
│   │   ├── main.py                       # FastAPI app factory and lifespan
│   │   ├── models.py                     # ORM models (User, Account, Trade, ...)
│   │   ├── monitoring.py                 # Real-time monitoring and alerting
│   │   ├── schemas.py                    # Pydantic request/response schemas
│   │   └── security.py                   # AES-256 encryption, API key management
│   ├── database/
│   │   └── init                          # Database initialization scripts
│   ├── scripts/
│   │   ├── generate_dev_certs.sh         # Development certificate generation
│   │   └── start_dev.sh                  # Development server startup
│   ├── tests/                            # 189+ tests across 12 test modules
│   ├── Dockerfile
│   ├── Makefile
│   ├── alembic.ini
│   ├── docker-compose.yml
│   ├── entrypoint.sh
│   ├── pyproject.toml
│   ├── pytest.ini
│   └── requirements.txt
└── blockchain/
    ├── contracts/
    │   ├── FuturesContract.abi.json      # Futures contract ABI
    │   ├── FuturesContract.sol           # Futures smart contract
    │   └── OptionsContract.sol           # Options smart contract
    ├── migrations/
    ├── tests/
    │   └── test_optionscontract.js       # Options contract JavaScript tests
    └── truffle-config.js                 # Truffle framework configuration
```

## AI Models

The `ai_models/` module provides machine learning and quantitative finance capabilities.

### Quantitative Models (`ai_models/quantitative/`)

| File               | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `black_scholes.py` | Black-Scholes closed-form pricing and Greeks (Delta, Gamma, Theta, Vega, Rho) |
| `monte_carlo.py`   | Monte Carlo simulation engine supporting American and exotic options          |

### Advanced Models (`ai_models/quantitative/advanced/`)

| File                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `calibration_engine.py`    | Fits model parameters to market-observed prices      |
| `local_volatility.py`      | Local volatility surface models via Dupire's formula |
| `stochastic_volatility.py` | Heston and SABR stochastic volatility models         |
| `volatility_surface.py`    | Volatility surface construction and interpolation    |

### Training Scripts (`ai_models/training_scripts/`)

| File                        | Description                                                           |
| --------------------------- | --------------------------------------------------------------------- |
| `data_preprocessing.py`     | Data cleaning, feature engineering, and normalization for market data |
| `train_volatility_model.py` | End-to-end scikit-learn training pipeline for volatility prediction   |

### Model Artifacts

| File                             | Description                                                              |
| -------------------------------- | ------------------------------------------------------------------------ |
| `create_model.py`                | Orchestrates model creation combining quantitative and ML approaches     |
| `generate_model_artifacts.py`    | Exports trained models and generates reproducible model packages         |
| `volatility_model_metadata.json` | Version tracking, hyperparameters, training metrics, and feature schemas |

## Backend

The `backend/` module is a production-grade FastAPI application powering the Optionix trading platform.

### Architecture

The backend follows a layered architecture:

1. **Entry Point** (`app/main.py`): App factory with lifespan management, middleware mounting, and route registration
2. **API Layer** (`app/api/`): Route handlers organized by domain (auth, market, trading, portfolio, risk, compliance, analytics)
3. **Middleware** (`app/middleware/`): Audit logging, rate limiting, and security headers
4. **Services** (`app/services/`): Business logic for pricing, risk, compliance, execution, and blockchain
5. **Core Modules** (`app/*.py`): Authentication, database, configuration, encryption, monitoring, and data protection

### Core Application Modules

| File                         | Purpose                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `app/auth.py`                | JWT token management, MFA/TOTP, RBAC with 9 roles (super_admin through viewer), account lockout, bcrypt hashing |
| `app/config.py`              | Pydantic settings driven by environment variables                                                               |
| `app/database.py`            | SQLAlchemy engine and session factory                                                                           |
| `app/models.py`              | ORM models: User, Account, Trade, Position, and related entities                                                |
| `app/schemas.py`             | Pydantic request/response schemas for all API endpoints                                                         |
| `app/security.py`            | AES-256 field encryption, API key management, input sanitization                                                |
| `app/compliance.py`          | KYC/AML validation utilities and sanctions screening                                                            |
| `app/data_protection.py`     | GDPR compliance: field-level encryption, consent logging, data retention                                        |
| `app/financial_standards.py` | Regulatory helpers for SOX, MiFID II, and Dodd-Frank                                                            |
| `app/monitoring.py`          | Real-time monitoring, alerting thresholds, Prometheus metrics                                                   |

### API Endpoints

| File            | Path Prefix   | Description                                                      |
| --------------- | ------------- | ---------------------------------------------------------------- |
| `analytics.py`  | `/analytics`  | Trading analytics, performance metrics, risk/reward calculations |
| `auth.py`       | `/auth`       | Registration, login, JWT refresh, MFA, user profile              |
| `compliance.py` | `/compliance` | KYC submission, AML checks, SAR filing, audit trail              |
| `market.py`     | `/market`     | Options chains, market data, volatility feeds                    |
| `portfolio.py`  | `/portfolio`  | Position tracking, P&L analysis, portfolio Greeks                |
| `risk.py`       | `/risk`       | VaR, Expected Shortfall, margin calculations                     |
| `trading.py`    | `/trading`    | Order submission, multi-leg strategies, execution status         |

Key endpoints:

| Method | Path                 | Auth | Description                       |
| ------ | -------------------- | ---- | --------------------------------- |
| GET    | `/`                  | No   | Welcome and service status        |
| GET    | `/health`            | No   | Full service health check         |
| POST   | `/auth/register`     | No   | Create new user account           |
| POST   | `/auth/login`        | No   | Authenticate and receive JWT pair |
| GET    | `/auth/me`           | Yes  | Current user profile              |
| POST   | `/auth/refresh`      | No   | Refresh access token              |
| POST   | `/market/volatility` | No   | AI-powered volatility prediction  |

### Middleware

| File                          | Purpose                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `middleware/audit_logging.py` | Immutable request/response audit logging for compliance          |
| `middleware/rate_limiting.py` | Token bucket rate limiting per endpoint and user tier            |
| `middleware/security.py`      | Security headers (HSTS, CSP, X-Frame-Options), request filtering |

### Services

| File                                           | Purpose                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `services/financial_service.py`                | Black-Scholes pricing, VaR, P&L tracking, fee computation             |
| `services/compliance_service.py`               | KYC verification, AML monitoring, sanctions screening, SAR generation |
| `services/model_service.py`                    | ML volatility inference with Parkinson statistical fallback           |
| `services/pricing_engine.py`                   | Full Greeks calculation and Monte Carlo pricing                       |
| `services/risk_assessment.py`                  | Portfolio VaR, Expected Shortfall, margin requirements                |
| `services/health_service.py`                   | Health checks for all downstream services                             |
| `services/blockchain_service.py`               | Web3/Ethereum smart contract integration (optional)                   |
| `services/risk_management/risk_engine.py`      | Real-time portfolio stress testing and scenario analysis              |
| `services/trade_execution/circuit_breaker.py`  | Circuit breaker preventing cascading failures during volatility       |
| `services/trade_execution/execution_engine.py` | Order routing, execution strategy, fill tracking                      |

### Database and Testing

PostgreSQL is used in production and SQLite for testing. Schema migrations are managed via Alembic.

The `backend/tests/` directory contains 189+ tests across 12 modules:

| Test File                | Coverage Area                        |
| ------------------------ | ------------------------------------ |
| `test_auth.py`           | Authentication, MFA, JWT, RBAC       |
| `test_compliance.py`     | KYC, AML, sanctions screening        |
| `test_financial.py`      | Black-Scholes, VaR, P&L calculations |
| `test_health.py`         | Service health checks                |
| `test_integration.py`    | End-to-end API integration           |
| `test_market.py`         | Market data endpoints                |
| `test_models.py`         | Database ORM models                  |
| `test_monitoring.py`     | Metrics and alerting                 |
| `test_pricing.py`        | Options pricing accuracy             |
| `test_pricing_engine.py` | Greeks and Monte Carlo               |
| `test_security.py`       | Encryption, sanitization             |
| `test_system.py`         | System-level tests                   |

### Docker Support

| File                 | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `Dockerfile`         | Multi-stage Python container build                 |
| `docker-compose.yml` | Full stack orchestration with PostgreSQL and Redis |
| `entrypoint.sh`      | Container startup with database migration          |
| `Makefile`           | Shortcuts for build, test, run, and lint           |

## Blockchain

The `blockchain/` module implements decentralized options and futures contracts on Ethereum using the Truffle framework.

### Smart Contracts (`blockchain/contracts/`)

| File                       | Description                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `OptionsContract.sol`      | Core options contract: creation, exercise, expiration, and settlement                 |
| `FuturesContract.sol`      | Futures contract: position opening, margin management, daily settlement, and delivery |
| `FuturesContract.abi.json` | Compiled ABI for Web3 interaction from the backend                                    |

### Testing and Deployment

| File                            | Description                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `tests/test_optionscontract.js` | JavaScript tests for OptionsContract: creation, exercise, expiration, and edge cases            |
| `truffle-config.js`             | Network definitions (development, testnet, mainnet), compiler settings, and deployment accounts |
| `migrations/`                   | Truffle migration scripts for deploying contracts to target networks                            |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for blockchain development)
- Truffle Suite (for contract compilation and deployment)
- Docker and Docker Compose (optional)

### Environment Setup

```bash
# Backend setup
cd code/backend
cp .env.example .env
# Set SECRET_KEY (>= 32 chars), ENCRYPTION_KEY (exactly 32 chars),
# and DATABASE_URL (PostgreSQL in production, SQLite for testing)
pip install -r requirements.txt

# AI Models setup (shares backend requirements)
cd code/ai_models
pip install -r ../backend/requirements.txt

# Blockchain setup
cd code/blockchain
npm install -g truffle
npm install
```

### Running the Backend

```bash
cd code/backend
make run
# or directly:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs are available at `http://localhost:8000/docs`.

### Running Tests

```bash
# Backend (189+ tests)
cd code/backend
make test
make test-cov       # With HTML coverage report

# Blockchain
cd code/blockchain
truffle test

# AI models
cd code/ai_models
python -m unittest discover
```

### Docker Deployment

```bash
cd code/backend
docker compose up --build
```

This starts the full stack: FastAPI application, PostgreSQL, and Redis.

## Technology Stack

### AI Models

| Component           | Technology                                                        |
| ------------------- | ----------------------------------------------------------------- |
| Language            | Python                                                            |
| ML Framework        | scikit-learn                                                      |
| Numerical Computing | NumPy, SciPy, Pandas                                              |
| Quantitative Models | Custom Black-Scholes, Monte Carlo, Heston, SABR, Local Volatility |

### Backend

| Component      | Technology                                | Version               |
| -------------- | ----------------------------------------- | --------------------- |
| Language       | Python                                    | 3.10+                 |
| Framework      | FastAPI                                   | 0.115.0               |
| Server         | Uvicorn                                   | 0.30.6                |
| Validation     | Pydantic                                  | 2.9.2                 |
| ORM            | SQLAlchemy                                | 2.0.36                |
| Migrations     | Alembic                                   | 1.13.3                |
| Authentication | python-jose, passlib, bcrypt              | 3.3.0 / 1.7.4 / 4.2.0 |
| MFA            | pyotp, qrcode                             | 2.9.0 / 7.4.2         |
| Encryption     | cryptography (AES-256)                    | 43.0.3                |
| Cache          | Redis                                     | 5.1.1                 |
| Monitoring     | structlog, prometheus-client              | 24.4.0 / 0.21.0       |
| Testing        | pytest, pytest-asyncio, httpx             | 8.3+ / 0.24+ / 0.27+  |
| Database       | PostgreSQL (production), SQLite (testing) |                       |

### Blockchain

| Component        | Technology                               |
| ---------------- | ---------------------------------------- |
| Platform         | Ethereum                                 |
| Language         | Solidity                                 |
| Framework        | Truffle Suite                            |
| Testing          | JavaScript / Truffle Test                |
| Web3 Integration | Web3.py (via backend blockchain_service) |

## Security and Compliance

The Optionix backend implements institutional-grade security:

- **Authentication**: JWT access and refresh tokens, bcrypt password hashing, TOTP-based MFA, account lockout after failed attempts
- **Authorization**: 9-tier RBAC from super_admin to viewer with granular permissions
- **Data Protection**: AES-256 field-level encryption for sensitive data, GDPR-compliant consent logging
- **Transport Security**: Rate limiting, security headers, input sanitization
- **Compliance**: KYC/AML validation, sanctions screening, SAR generation, audit trails
- **Financial Standards**: SOX, MiFID II, and Dodd-Frank regulatory helpers
- **Observability**: Structured logging, Prometheus metrics, health endpoint monitoring

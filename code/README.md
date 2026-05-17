# Optionix / Code Directory

This directory contains the core backend systems for the Optionix options trading and analytics platform. It houses three primary modules: AI/ML models for predictive analytics, a production-grade FastAPI backend for trading operations, and Ethereum smart contracts for decentralized options settlement.

---

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [AI Models](#ai-models)
  - [Quantitative Models](#quantitative-models)
  - [Advanced Models](#advanced-models)
  - [Training Scripts](#training-scripts)
  - [Model Artifacts](#model-artifacts)
- [Backend](#backend)
  - [Architecture](#backend-architecture)
  - [Application Layer](#application-layer)
  - [API Endpoints](#api-endpoints)
  - [Middleware](#middleware)
  - [Services](#services)
  - [Database](#database)
  - [Testing](#backend-testing)
  - [Docker Support](#docker-support)
- [Blockchain](#blockchain)
  - [Smart Contracts](#smart-contracts)
  - [Contract Testing](#contract-testing)
  - [Deployment](#deployment)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Running the Backend](#running-the-backend)
  - [Running Tests](#running-tests)
  - [Docker Deployment](#docker-deployment)
- [Technology Stack](#technology-stack)
- [Security and Compliance](#security-and-compliance)

---

## Overview

The `code/` directory powers the Optionix platform with three integrated modules:

| Module        | Language              | Purpose                                                                   |
| ------------- | --------------------- | ------------------------------------------------------------------------- |
| `ai_models/`  | Python                | Volatility prediction, quantitative pricing models, ML training pipelines |
| `backend/`    | Python (FastAPI)      | REST API, authentication, trading engine, risk management, compliance     |
| `blockchain/` | Solidity / JavaScript | Ethereum smart contracts for decentralized options and futures            |

The AI models feed volatility predictions and pricing calculations into the backend API. The backend handles order execution, portfolio management, risk assessment, and regulatory compliance. The blockchain layer enables on-chain options contracts with transparent, immutable settlement.

---

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
│   │   │   ├── __init__.py
│   │   │   ├── audit_logging.py          # Request-level audit middleware
│   │   │   ├── rate_limiting.py          # Rate limiting shim
│   │   │   └── security.py              # Security headers and request hardening
│   │   ├── services/
│   │   │   ├── risk_management/
│   │   │   │   ├── __init__.py
│   │   │   │   └── risk_engine.py        # Advanced risk calculation engine
│   │   │   ├── trade_execution/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── circuit_breaker.py    # Circuit breaker pattern for execution
│   │   │   │   └── execution_engine.py   # Order execution engine
│   │   │   ├── __init__.py
│   │   │   ├── blockchain_service.py     # Web3/Ethereum contract interaction
│   │   │   ├── compliance_service.py     # KYC, AML, sanctions screening
│   │   │   ├── financial_service.py      # Black-Scholes, VaR, PnL, fees
│   │   │   ├── health_service.py         # Aggregated service health checks
│   │   │   ├── model_service.py          # ML volatility prediction service
│   │   │   ├── pricing_engine.py         # Greeks calculation and Monte Carlo
│   │   │   └── risk_assessment.py        # VaR, ES, margin helpers
│   │   ├── __init__.py
│   │   ├── auth.py                       # AuthService, MFAService, RBACService
│   │   ├── compliance.py                 # Additional compliance utilities
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
│   │   └── start_dev.sh                 # Development server startup
│   ├── tests/                            # 189+ tests across 12 test modules
│   ├── Dockerfile
│   ├── Makefile
│   ├── README.md
│   ├── __init__.py
│   ├── alembic.ini                       # Alembic migration configuration
│   ├── docker-compose.yml
│   ├── entrypoint.sh                     # Docker container entrypoint
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
    └── truffle-config.js                # Truffle framework configuration
```

---

## AI Models

The `ai_models/` module provides machine learning and quantitative finance capabilities for the Optionix platform.

### Quantitative Models

Located in `ai_models/quantitative/`, these modules implement foundational options pricing theory:

| File               | Description                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `black_scholes.py` | Black-Scholes closed-form options pricing, Greeks calculation (Delta, Gamma, Theta, Vega, Rho) |
| `monte_carlo.py`   | Monte Carlo simulation engine for options pricing with support for American and exotic options |

### Advanced Models

Located in `ai_models/quantitative/advanced/`, these modules implement sophisticated volatility modeling:

| File                       | Description                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `calibration_engine.py`    | Calibration engine for fitting model parameters to market observed prices              |
| `local_volatility.py`      | Local volatility surface models derived from implied volatility using Dupire's formula |
| `stochastic_volatility.py` | Stochastic volatility models (Heston, SABR) for more accurate options pricing          |
| `volatility_surface.py`    | Volatility surface construction and interpolation from market data                     |

### Training Scripts

Located in `ai_models/training_scripts/`:

| File                        | Description                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| `data_preprocessing.py`     | Data cleaning, feature engineering, and normalization pipeline for market data   |
| `train_volatility_model.py` | End-to-end training pipeline for volatility prediction models using scikit-learn |

### Model Artifacts

| File                             | Description                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `create_model.py`                | Orchestrates model creation, combining quantitative and ML approaches               |
| `generate_model_artifacts.py`    | Exports trained models, generates metadata, and creates reproducible model packages |
| `volatility_model_metadata.json` | Model version tracking, hyperparameters, training metrics, and feature schemas      |

---

## Backend

The `backend/` module is a production-grade FastAPI application powering the Optionix trading platform.

### Backend Architecture

The backend follows a layered architecture:

1. **Entry Point** (`app/main.py`): FastAPI app factory with lifespan management, middleware mounting, and route registration
2. **API Layer** (`app/api/`): Route handlers organized by domain (auth, market, trading, portfolio, risk, compliance, analytics)
3. **Middleware** (`app/middleware/`): Cross-cutting concerns including audit logging, rate limiting, and security headers
4. **Services** (`app/services/`): Business logic layer with dedicated services for pricing, risk, compliance, execution, and blockchain
5. **Core Modules** (`app/*.py`): Authentication, database, configuration, encryption, monitoring, and data protection

### Application Layer

#### `app/main.py`

The FastAPI application factory that:

- Configures the FastAPI app with lifespan events
- Mounts all middleware components (CORS, security headers, audit logging, rate limiting)
- Registers all API routers from the `api/` module
- Initializes database connections and health check endpoints
- Serves interactive API docs at `/docs`

#### Core Application Modules

| File                         | Purpose                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/auth.py`                | Authentication services: JWT token management, MFA/TOTP, RBAC with 9 roles (super_admin through viewer), account lockout, bcrypt password hashing |
| `app/config.py`              | Pydantic settings management, environment-variable driven configuration                                                                           |
| `app/database.py`            | SQLAlchemy engine and session factory, database connection management                                                                             |
| `app/models.py`              | SQLAlchemy ORM models: User, Account, Trade, Position, and related entities                                                                       |
| `app/schemas.py`             | Pydantic request/response validation schemas for all API endpoints                                                                                |
| `app/security.py`            | AES-256 field encryption, API key management, input sanitization, security headers                                                                |
| `app/compliance.py`          | KYC/AML validation utilities, sanctions screening integration                                                                                     |
| `app/data_protection.py`     | GDPR compliance: field-level encryption, consent logging, data retention                                                                          |
| `app/financial_standards.py` | Regulatory standard helpers for SOX, MiFID II, and Dodd-Frank compliance                                                                          |
| `app/data_handler.py`        | Data validation, quality checks, and cleansing services                                                                                           |
| `app/monitoring.py`          | Real-time system monitoring, alerting thresholds, Prometheus metrics                                                                              |

### API Endpoints

The API layer in `app/api/` provides the following endpoint groups:

| File            | Path Prefix   | Description                                                      |
| --------------- | ------------- | ---------------------------------------------------------------- |
| `analytics.py`  | `/analytics`  | Trading analytics, performance metrics, risk/reward calculations |
| `auth.py`       | `/auth`       | Registration, login, JWT refresh, MFA, user profile              |
| `compliance.py` | `/compliance` | KYC submission, AML checks, SAR filing, audit trail              |
| `market.py`     | `/market`     | Options chains, market data, volatility feeds                    |
| `portfolio.py`  | `/portfolio`  | Position tracking, P&L analysis, portfolio Greeks                |
| `risk.py`       | `/risk`       | Value at Risk (VaR), Expected Shortfall, margin calculations     |
| `trading.py`    | `/trading`    | Order submission, multi-leg strategies, execution status         |

Key endpoints include:

| Method | Path                 | Auth | Description                                      |
| ------ | -------------------- | ---- | ------------------------------------------------ |
| GET    | `/`                  | No   | Welcome and service status                       |
| GET    | `/health`            | No   | Full service health check with dependency status |
| POST   | `/auth/register`     | No   | Create new user account                          |
| POST   | `/auth/login`        | No   | Authenticate and receive JWT pair                |
| GET    | `/auth/me`           | Yes  | Current user profile                             |
| POST   | `/auth/refresh`      | No   | Refresh access token                             |
| POST   | `/market/volatility` | No   | AI-powered volatility prediction                 |

### Middleware

| File                          | Purpose                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `middleware/audit_logging.py` | Immutable request/response audit logging for compliance          |
| `middleware/rate_limiting.py` | Token bucket rate limiting per endpoint and user tier            |
| `middleware/security.py`      | Security headers (HSTS, CSP, X-Frame-Options), request filtering |

### Services

The services layer encapsulates all business logic:

#### Core Services

| File                             | Purpose                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `services/financial_service.py`  | Black-Scholes pricing, VaR calculation, P&L tracking, fee computation                           |
| `services/compliance_service.py` | KYC document verification, AML transaction monitoring, sanctions list screening, SAR generation |
| `services/model_service.py`      | ML model inference for volatility prediction, with Parkinson statistical fallback               |
| `services/pricing_engine.py`     | Full Greeks calculation (Delta, Gamma, Theta, Vega, Rho) and Monte Carlo pricing                |
| `services/risk_assessment.py`    | Portfolio Value at Risk, Expected Shortfall, margin requirement calculations                    |
| `services/health_service.py`     | Aggregated health checks for all downstream services and dependencies                           |
| `services/blockchain_service.py` | Web3/Ethereum integration for smart contract interaction (optional)                             |

#### Risk Management

| File                                      | Purpose                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `services/risk_management/risk_engine.py` | Advanced risk engine with real-time portfolio stress testing and scenario analysis |

#### Trade Execution

| File                                           | Purpose                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `services/trade_execution/circuit_breaker.py`  | Circuit breaker pattern preventing cascading failures during market volatility |
| `services/trade_execution/execution_engine.py` | Order routing, execution strategy selection, fill tracking                     |

### Database

The `database/` directory contains initialization scripts for PostgreSQL (production) and SQLite (testing). Schema migrations are managed via Alembic using `alembic.ini`.

### Backend Testing

Located in `backend/tests/`, with 189+ tests across 12 test modules:

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

| File                 | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `Dockerfile`         | Multi-stage Python container build                  |
| `docker-compose.yml` | Full stack orchestration with PostgreSQL and Redis  |
| `entrypoint.sh`      | Container startup script with database migration    |
| `Makefile`           | Shortcuts for build, test, run, and lint operations |

---

## Blockchain

The `blockchain/` module implements decentralized options and futures contracts on the Ethereum network using the Truffle framework.

### Smart Contracts

Located in `blockchain/contracts/`:

| File                       | Description                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `OptionsContract.sol`      | Core options smart contract: creation, exercise, expiration, and settlement of decentralized options positions |
| `FuturesContract.sol`      | Futures smart contract: position opening, margin management, daily settlement, and delivery                    |
| `FuturesContract.abi.json` | Compiled ABI for the futures contract, enabling Web3 interaction from the backend                              |

### Contract Testing

| File                            | Description                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/test_optionscontract.js` | JavaScript test suite for the OptionsContract: creation, exercise, expiration, and edge cases |

### Deployment

| File                | Description                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `truffle-config.js` | Truffle framework configuration: network definitions (development, testnet, mainnet), compiler settings, and deployment accounts |
| `migrations/`       | Truffle migration scripts for deploying contracts to target networks                                                             |

---

## Getting Started

### Prerequisites

- Python 3.10+
- pip and virtualenv
- Node.js 18+ (for blockchain development)
- Truffle Suite (for contract compilation and deployment)
- Docker and Docker Compose (optional, for containerized deployment)

### Environment Setup

Create a Python virtual environment and install dependencies:

```bash
# AI Models setup
cd code/ai_models
pip install -r ../backend/requirements.txt

# Backend setup
cd code/backend
cp .env.example .env
# Edit .env with your SECRET_KEY (>= 32 chars), ENCRYPTION_KEY (exactly 32 chars),
# and DATABASE_URL (PostgreSQL in production, SQLite for testing)
pip install -r requirements.txt

# Blockchain setup
cd code/blockchain
npm install -g truffle
npm install
```

### Running the Backend

Development mode with hot reload:

```bash
cd code/backend
make run
# or directly:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API documentation is available at `http://localhost:8000/docs`.

### Running Tests

Backend tests:

```bash
cd code/backend
make test           # Run all 189+ tests
make test-cov       # Run with HTML coverage report
```

Blockchain tests:

```bash
cd code/blockchain
truffle test
```

AI model tests:

```bash
cd code/ai_models
python -m unittest discover
```

### Docker Deployment

```bash
cd code/backend
docker compose up --build
```

This starts the full stack: FastAPI application, PostgreSQL database, and Redis cache.

---

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

---

## Security and Compliance

The Optionix backend implements institutional-grade security measures:

- **Authentication**: JWT access and refresh tokens, bcrypt password hashing, TOTP-based MFA, account lockout after failed attempts
- **Authorization**: 9-tier RBAC from super_admin to viewer with granular permissions
- **Data Protection**: AES-256 field-level encryption for sensitive data, GDPR-compliant consent logging
- **Transport Security**: Rate limiting, security headers, input sanitization
- **Compliance**: KYC/AML validation, sanctions screening, SAR generation, audit trails
- **Financial Standards**: SOX, MiFID II, and Dodd-Frank regulatory helpers
- **Observability**: Structured logging, Prometheus metrics, health endpoint monitoring

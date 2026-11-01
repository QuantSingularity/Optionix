# Usage Guide

This guide demonstrates typical usage patterns for the Optionix platform, covering both CLI and library usage.

## Table of Contents

- [Getting Started](#getting-started)
- [Backend Usage](#backend-usage)
- [API Usage](#api-usage)
- [Python Library Usage](#python-library-usage)
- [CLI Usage](#cli-usage)
- [Frontend Usage](#frontend-usage)
- [Common Workflows](#common-workflows)

## Getting Started

Before using Optionix, ensure you have:

1. Completed the [installation](INSTALLATION.md)
2. Configured your [environment](CONFIGURATION.md)
3. Started the backend and frontend services

## Backend Usage

### Starting the Backend Server

```bash
# Method 1: Using the run script
cd code
python run_backend.py

# Method 2: Using uvicorn directly
cd code
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload

# Method 3: Using the shell script
./scripts/run_optionix.sh
```

### Backend Server Options

```bash
# Production mode (no auto-reload)
uvicorn backend.app:app --host 0.0.0.0 --port 8000

# With specific number of workers
uvicorn backend.app:app --workers 4

# With SSL/TLS
uvicorn backend.app:app --ssl-keyfile key.pem --ssl-certfile cert.pem

# Custom log level
uvicorn backend.app:app --log-level debug
```

## API Usage

### Authentication Flow

```bash
# 1. Register a new user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!",
    "full_name": "John Trader",
    "data_processing_consent": true
  }'

# Response:
# {
#   "user_id": "123e4567-e89b-12d3-a456-426614174000",
#   "email": "trader@example.com",
#   "full_name": "John Trader",
#   "role": "trader",
#   "is_active": true,
#   "is_verified": false,
#   "kyc_status": "pending"
# }

# 2. Login and get access token
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!"
  }'

# Response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer",
#   "expires_in": 1800
# }
```

### Options Pricing

```bash
# Calculate option price using Black-Scholes
curl -X POST http://localhost:8000/options/price \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "spot_price": 100.0,
    "strike_price": 105.0,
    "time_to_expiry": 0.5,
    "risk_free_rate": 0.05,
    "volatility": 0.25,
    "option_type": "call"
  }'

# Response:
# {
#   "price": 4.76,
#   "delta": 0.54,
#   "gamma": 0.019,
#   "theta": -0.025,
#   "vega": 0.19,
#   "rho": 0.26,
#   "intrinsic_value": 0.0,
#   "time_value": 4.76
# }
```

### Volatility Prediction

```bash
# Get AI-powered volatility prediction
curl -X POST http://localhost:8000/market/volatility \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "current_price": 150.0,
    "historical_volatility": 0.25,
    "volume": 1000000,
    "market_cap": 2500000000000
  }'

# Response:
# {
#   "symbol": "AAPL",
#   "volatility": 0.28,
#   "confidence": 0.85,
#   "model_version": "1.0.0",
#   "prediction_horizon": "24h",
#   "timestamp": "2025-01-01T12:00:00Z"
# }
```

### Health Check

```bash
# Check system health
curl http://localhost:8000/health

# Response:
# {
#   "status": "healthy",
#   "version": "2.0.0",
#   "services": {
#     "database": "healthy",
#     "blockchain": "healthy",
#     "model": "healthy",
#     "redis": "healthy",
#     "compliance_engine": "healthy",
#     "security_services": "healthy"
#   },
#   "security_features": {
#     "mfa_enabled": true,
#     "rbac_enabled": true,
#     "encryption_enabled": true,
#     "audit_logging": true
#   }
# }
```

## Python Library Usage

### Using the Options Pricing Engine

```python
from code.quantitative.black_scholes import BlackScholesModel, OptionParameters, OptionType

# Initialize the pricing model
bs_model = BlackScholesModel()

# Create option parameters
params = OptionParameters(
    spot_price=100.0,
    strike_price=105.0,
    time_to_expiry=0.5,  # 6 months
    risk_free_rate=0.05,
    volatility=0.25,
    dividend_yield=0.02,
    option_type=OptionType.CALL
)

# Calculate option price and Greeks
result = bs_model.price_option(params)

print(f"Option Price: ${result.price:.2f}")
print(f"Delta: {result.delta:.4f}")
print(f"Gamma: {result.gamma:.4f}")
print(f"Theta: {result.theta:.4f}")
print(f"Vega: {result.vega:.4f}")
print(f"Rho: {result.rho:.4f}")
```

### Using Monte Carlo Simulation

```python
from code.quantitative.monte_carlo import MonteCarloSimulator

# Initialize simulator
simulator = MonteCarloSimulator(
    n_simulations=10000,
    n_steps=252,
    random_seed=42
)

# Run simulation for Asian option
asian_price = simulator.price_asian_option(
    spot_price=100.0,
    strike_price=105.0,
    time_to_expiry=1.0,
    risk_free_rate=0.05,
    volatility=0.25,
    option_type='call'
)

print(f"Asian Option Price: ${asian_price:.2f}")
```

### Using the AI Model Service

```python
from code.backend.services.model_service import ModelService
from sqlalchemy.orm import Session

# Initialize model service
model_service = ModelService()

# Prepare market data
market_data = {
    'symbol': 'AAPL',
    'current_price': 150.0,
    'historical_volatility': 0.25,
    'volume': 1000000,
    'market_cap': 2500000000000
}

# Get volatility prediction
prediction = model_service.get_volatility_prediction(market_data, db_session)

print(f"Predicted Volatility: {prediction['volatility']:.4f}")
print(f"Confidence: {prediction['confidence']:.2%}")
```

### Using the Blockchain Service

```python
from code.backend.services.blockchain_service import BlockchainService

# Initialize blockchain service
blockchain_service = BlockchainService()

# Create option contract on blockchain
contract_params = {
    'option_type': 'call',
    'strike_price': 105.0,
    'expiration': 1672531200,  # Unix timestamp
    'premium': 4.76,
    'collateral': 100.0
}

tx_hash = blockchain_service.create_option_contract(
    writer_address='0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    holder_address='0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    **contract_params
)

print(f"Contract created: {tx_hash}")
```

## CLI Usage

### Database Management

```bash
# Initialize database
cd code/backend
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "Add new table"

# Rollback migration
alembic downgrade -1

# View migration history
alembic history
```

### Running Tests

```bash
# Run all backend tests
cd code/backend
pytest

# Run specific test file
pytest tests/test_pricing.py

# Run with coverage
pytest --cov=backend --cov-report=html

# Run frontend tests
cd web-frontend
npm test

# Run with coverage
npm test -- --coverage
```

### Code Quality Checks

```bash
# Run all linters
./scripts/lint-all.sh

# Run Python linter
cd code/backend
flake8 .

# Run type checker
mypy .

# Format Python code
black .

# Format JavaScript/TypeScript
cd web-frontend
npm run lint
npm run format
```

### Environment Validation

```bash
# Validate environment setup
./scripts/env_validator.sh

# Output:
# ✓ Python 3.11 found
# ✓ Node.js 18.x found
# ✓ PostgreSQL 14 found
# ✓ Redis 7 found
# ✓ Environment variables configured
```

## Frontend Usage

### Development Mode

```bash
cd web-frontend

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Run linter
npm run lint
```

### Mobile App

```bash
cd mobile-frontend

# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Build for production
npm run build:android
npm run build:ios
```

## Common Workflows

### Workflow 1: Price an Option

```python
# Example: Price a European call option
from code.quantitative.black_scholes import BlackScholesModel, OptionParameters, OptionType

bs_model = BlackScholesModel()

# Apple stock at $150, strike $155, 3 months to expiry
params = OptionParameters(
    spot_price=150.0,
    strike_price=155.0,
    time_to_expiry=0.25,
    risk_free_rate=0.05,
    volatility=0.30,
    option_type=OptionType.CALL
)

result = bs_model.price_option(params)
print(f"Call Option Price: ${result.price:.2f}")
print(f"Delta (hedge ratio): {result.delta:.4f}")
```

### Workflow 2: Analyze Strategy Payoff

```python
# Example: Bull call spread strategy
from code.backend.services.pricing_engine import PricingEngine

pricing_engine = PricingEngine()

# Buy lower strike call
long_call = pricing_engine.calculate_option_price(
    spot_price=100.0,
    strike_price=100.0,
    time_to_expiry=0.5,
    volatility=0.25,
    option_type='call'
)

# Sell higher strike call
short_call = pricing_engine.calculate_option_price(
    spot_price=100.0,
    strike_price=110.0,
    time_to_expiry=0.5,
    volatility=0.25,
    option_type='call'
)

net_cost = long_call['price'] - short_call['price']
max_profit = 10.0 - net_cost
max_loss = net_cost

print(f"Net Cost: ${net_cost:.2f}")
print(f"Max Profit: ${max_profit:.2f}")
print(f"Max Loss: ${max_loss:.2f}")
```

### Workflow 3: Get AI Trading Signals

```python
# Example: Get volatility prediction and trading signal
from code.backend.services.model_service import ModelService

model_service = ModelService()

# Market data for Tesla
market_data = {
    'symbol': 'TSLA',
    'current_price': 250.0,
    'historical_volatility': 0.40,
    'volume': 5000000,
    'market_cap': 800000000000
}

# Get prediction
prediction = model_service.get_volatility_prediction(market_data, db_session)

if prediction['volatility'] > market_data['historical_volatility']:
    print(f"Signal: Buy volatility (straddle/strangle)")
    print(f"Predicted IV: {prediction['volatility']:.2%}")
else:
    print(f"Signal: Sell volatility (covered call/cash-secured put)")
    print(f"Predicted IV: {prediction['volatility']:.2%}")
```

### Workflow 4: Execute Trade on Blockchain

```python
# Example: Create and settle option contract on blockchain
from code.backend.services.blockchain_service import BlockchainService

blockchain_service = BlockchainService()

# Create option contract
contract = blockchain_service.create_option_contract(
    writer_address='0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    holder_address='0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    option_type='call',
    strike_price=100.0,
    expiration=1704067200,  # Unix timestamp
    premium=5.0,
    collateral=100.0
)

print(f"Contract ID: {contract['contract_id']}")
print(f"Transaction Hash: {contract['tx_hash']}")

# Exercise option (if in-the-money)
exercise_result = blockchain_service.exercise_option(
    contract_id=contract['contract_id'],
    holder_address='0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
)

print(f"Exercise successful: {exercise_result['success']}")
print(f"Payout: ${exercise_result['payout']:.2f}")
```

### Workflow 5: Monitor Portfolio Risk

```python
# Example: Calculate portfolio Greeks and risk metrics
from code.backend.services.risk_assessment import RiskAssessmentService

risk_service = RiskAssessmentService()

# Portfolio positions
positions = [
    {'option_type': 'call', 'quantity': 10, 'strike': 100, 'expiry': 0.5},
    {'option_type': 'put', 'quantity': -5, 'strike': 95, 'expiry': 0.5},
    {'option_type': 'call', 'quantity': -15, 'strike': 110, 'expiry': 0.5}
]

# Calculate portfolio Greeks
portfolio_greeks = risk_service.calculate_portfolio_greeks(
    positions=positions,
    spot_price=100.0,
    volatility=0.25,
    risk_free_rate=0.05
)

print(f"Portfolio Delta: {portfolio_greeks['delta']:.2f}")
print(f"Portfolio Gamma: {portfolio_greeks['gamma']:.4f}")
print(f"Portfolio Theta: ${portfolio_greeks['theta']:.2f}/day")
print(f"Portfolio Vega: ${portfolio_greeks['vega']:.2f}/1% IV change")

# Calculate VaR
var_95 = risk_service.calculate_var(
    positions=positions,
    confidence_level=0.95,
    time_horizon_days=1
)

print(f"1-day VaR (95%): ${var_95:.2f}")
```

## Need Help?

- Check [Troubleshooting Guide](TROUBLESHOOTING.md)
- Review [Architecture Documentation](architecture.md)
- Open an issue on [GitHub](https://github.com/quantsingularity/Optionix/issues)

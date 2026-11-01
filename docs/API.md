# API Reference

Complete REST API reference for the Optionix platform.

## Table of Contents

- [Authentication](#authentication)
- [System Endpoints](#system-endpoints)
- [Options Pricing](#options-pricing)
- [Market Data](#market-data)
- [User Management](#user-management)
- [Portfolio Management](#portfolio-management)
- [Blockchain Integration](#blockchain-integration)
- [Risk Management](#risk-management)
- [Error Handling](#error-handling)

## Base URL

- **Development**: `http://localhost:8000`
- **Production**: `https://api.optionix.com`

## Authentication

All API endpoints (except `/health`, `/auth/register`, and `/auth/login`) require authentication using JWT Bearer tokens.

### Register User

Create a new user account.

**Endpoint**: `POST /auth/register`

**Request Body**:

| Name                    | Type     | Required? | Default | Description                  | Example                |
| ----------------------- | -------- | :-------: | :-----: | ---------------------------- | ---------------------- |
| email                   | EmailStr |    Yes    |    -    | Valid email address          | `"trader@example.com"` |
| password                | string   |    Yes    |    -    | Password (min 8 chars)       | "SecurePass123!"       |
| full_name               | string   |    Yes    |    -    | Full name (2-255 chars)      | "John Trader"          |
| data_retention_consent  | boolean  |    No     |  false  | Data retention consent       | true                   |
| marketing_consent       | boolean  |    No     |  false  | Marketing emails consent     | false                  |
| data_processing_consent | boolean  |    No     |  true   | Required for GDPR compliance | true                   |

**Example Request**:

```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!",
    "full_name": "John Trader",
    "data_processing_consent": true
  }'
```

**Response (200 OK)**:

```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "trader@example.com",
  "full_name": "John Trader",
  "role": "trader",
  "is_active": true,
  "is_verified": false,
  "kyc_status": "pending",
  "mfa_enabled": false,
  "risk_score": 0,
  "created_at": "2025-01-01T12:00:00Z",
  "last_login": null
}
```

### Login

Authenticate and receive access tokens.

**Endpoint**: `POST /auth/login`

**Request Body**:

| Name        | Type     | Required? | Default | Description        | Example                |
| ----------- | -------- | :-------: | :-----: | ------------------ | ---------------------- |
| email       | EmailStr |    Yes    |    -    | User email address | `"trader@example.com"` |
| password    | string   |    Yes    |    -    | User password      | "SecurePass123!"       |
| mfa_token   | string   |    No     |  null   | 6-digit MFA token  | "123456"               |
| remember_me | boolean  |    No     |  false  | Extended session   | true                   |

**Example Request**:

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK)**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "session_id": "session_abc123",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Refresh Token

Get a new access token using refresh token.

**Endpoint**: `POST /auth/refresh`

**Request Body**:

| Name          | Type   | Required? | Default | Description         | Example      |
| ------------- | ------ | :-------: | :-----: | ------------------- | ------------ |
| refresh_token | string |    Yes    |    -    | Valid refresh token | "eyJhbGc..." |

**Response (200 OK)**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

## System Endpoints

### Health Check

Check system health and service status.

**Endpoint**: `GET /health`

**Authentication**: None required

**Example Request**:

```bash
curl http://localhost:8000/health
```

**Response (200 OK)**:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "services": {
    "database": "healthy",
    "blockchain": "healthy",
    "model": "healthy",
    "redis": "healthy",
    "compliance_engine": "healthy",
    "security_services": "healthy",
    "audit_logging": "healthy"
  },
  "security_features": {
    "mfa_enabled": true,
    "rbac_enabled": true,
    "encryption_enabled": true,
    "audit_logging": true,
    "compliance_monitoring": true
  },
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Options Pricing

### Calculate Option Price

Calculate option price using Black-Scholes model with Greeks.

**Endpoint**: `POST /options/price`

**Authentication**: Required

**Request Body**:

| Name           | Type   | Required? |  Default   | Description                  | Example    |
| -------------- | ------ | :-------: | :--------: | ---------------------------- | ---------- |
| spot_price     | float  |    Yes    |     -      | Current underlying price     | 100.0      |
| strike_price   | float  |    Yes    |     -      | Strike price                 | 105.0      |
| time_to_expiry | float  |    Yes    |     -      | Time to expiry (years)       | 0.5        |
| risk_free_rate | float  |    Yes    |     -      | Risk-free rate (decimal)     | 0.05       |
| volatility     | float  |    Yes    |     -      | Implied volatility (decimal) | 0.25       |
| dividend_yield | float  |    No     |    0.0     | Dividend yield (decimal)     | 0.02       |
| option_type    | string |    Yes    |     -      | "call" or "put"              | "call"     |
| option_style   | string |    No     | "european" | "european" or "american"     | "european" |

**Example Request**:

```bash
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
```

**Response (200 OK)**:

```json
{
  "price": 4.76,
  "delta": 0.5398,
  "gamma": 0.0189,
  "theta": -0.0247,
  "vega": 0.1893,
  "rho": 0.2564,
  "intrinsic_value": 0.0,
  "time_value": 4.76,
  "moneyness": 1.05,
  "calculation_method": "black_scholes",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Calculate Implied Volatility

Calculate implied volatility from market price.

**Endpoint**: `POST /options/implied-volatility`

**Authentication**: Required

**Request Body**:

| Name           | Type   | Required? | Default | Description              | Example |
| -------------- | ------ | :-------: | :-----: | ------------------------ | ------- |
| market_price   | float  |    Yes    |    -    | Observed option price    | 5.0     |
| spot_price     | float  |    Yes    |    -    | Current underlying price | 100.0   |
| strike_price   | float  |    Yes    |    -    | Strike price             | 105.0   |
| time_to_expiry | float  |    Yes    |    -    | Time to expiry (years)   | 0.5     |
| risk_free_rate | float  |    Yes    |    -    | Risk-free rate (decimal) | 0.05    |
| option_type    | string |    Yes    |    -    | "call" or "put"          | "call"  |

**Response (200 OK)**:

```json
{
  "implied_volatility": 0.2654,
  "iterations": 5,
  "error": 0.0001,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Monte Carlo Simulation

Price exotic options using Monte Carlo simulation.

**Endpoint**: `POST /options/monte-carlo`

**Authentication**: Required

**Request Body**:

| Name           | Type    | Required? | Default | Description                    | Example |
| -------------- | ------- | :-------: | :-----: | ------------------------------ | ------- |
| option_type    | string  |    Yes    |    -    | "asian", "barrier", "lookback" | "asian" |
| spot_price     | float   |    Yes    |    -    | Current underlying price       | 100.0   |
| strike_price   | float   |    Yes    |    -    | Strike price                   | 105.0   |
| time_to_expiry | float   |    Yes    |    -    | Time to expiry (years)         | 1.0     |
| risk_free_rate | float   |    Yes    |    -    | Risk-free rate (decimal)       | 0.05    |
| volatility     | float   |    Yes    |    -    | Volatility (decimal)           | 0.25    |
| n_simulations  | integer |    No     |  10000  | Number of simulations          | 50000   |
| call_put       | string  |    Yes    |    -    | "call" or "put"                | "call"  |

**Response (200 OK)**:

```json
{
  "price": 3.45,
  "standard_error": 0.02,
  "confidence_interval": [3.41, 3.49],
  "n_simulations": 10000,
  "computation_time_ms": 245,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Market Data

### Get Volatility Prediction

Get AI-powered volatility prediction for a symbol.

**Endpoint**: `POST /market/volatility`

**Authentication**: Required

**Request Body**:

| Name                  | Type    | Required? | Default | Description           | Example       |
| --------------------- | ------- | :-------: | :-----: | --------------------- | ------------- |
| symbol                | string  |    Yes    |    -    | Stock ticker symbol   | "AAPL"        |
| current_price         | float   |    Yes    |    -    | Current stock price   | 150.0         |
| historical_volatility | float   |    Yes    |    -    | Historical volatility | 0.25          |
| volume                | integer |    Yes    |    -    | Trading volume        | 1000000       |
| market_cap            | float   |    Yes    |    -    | Market capitalization | 2500000000000 |

**Example Request**:

```bash
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
```

**Response (200 OK)**:

```json
{
  "symbol": "AAPL",
  "volatility": 0.2834,
  "confidence": 0.8542,
  "model_version": "1.0.0",
  "prediction_horizon": "24h",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Get Options Chain

Retrieve complete options chain for a symbol.

**Endpoint**: `GET /market/options-chain/{symbol}`

**Authentication**: Required

**Query Parameters**:

| Name            | Type   | Required? | Default | Description                       | Example      |
| --------------- | ------ | :-------: | :-----: | --------------------------------- | ------------ |
| expiration_date | string |    No     |  null   | Filter by expiration (YYYY-MM-DD) | "2025-06-20" |
| min_strike      | float  |    No     |  null   | Minimum strike price              | 90.0         |
| max_strike      | float  |    No     |  null   | Maximum strike price              | 110.0        |

**Example Request**:

```bash
curl -X GET "http://localhost:8000/market/options-chain/AAPL?expiration_date=2025-06-20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (200 OK)**:

```json
{
  "symbol": "AAPL",
  "underlying_price": 150.0,
  "expiration_dates": ["2025-03-21", "2025-06-20", "2025-09-19"],
  "options": [
    {
      "strike": 145.0,
      "expiration": "2025-06-20",
      "call": {
        "bid": 8.5,
        "ask": 8.7,
        "last": 8.6,
        "volume": 1250,
        "open_interest": 5430,
        "implied_volatility": 0.28
      },
      "put": {
        "bid": 2.3,
        "ask": 2.5,
        "last": 2.4,
        "volume": 890,
        "open_interest": 3210,
        "implied_volatility": 0.27
      }
    }
  ],
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## User Management

### Get User Profile

Retrieve authenticated user's profile.

**Endpoint**: `GET /users/me`

**Authentication**: Required

**Response (200 OK)**:

```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "trader@example.com",
  "full_name": "John Trader",
  "role": "trader",
  "is_active": true,
  "is_verified": true,
  "kyc_status": "approved",
  "mfa_enabled": true,
  "risk_score": 45,
  "created_at": "2024-01-01T12:00:00Z",
  "last_login": "2025-01-01T11:30:00Z"
}
```

### Update User Profile

Update user profile information.

**Endpoint**: `PATCH /users/me`

**Authentication**: Required

**Request Body**:

| Name         | Type   | Required? | Default | Description       | Example            |
| ------------ | ------ | :-------: | :-----: | ----------------- | ------------------ |
| full_name    | string |    No     |    -    | Updated full name | "John A. Trader"   |
| phone_number | string |    No     |    -    | Phone number      | "+1-555-123-4567"  |
| timezone     | string |    No     |    -    | User timezone     | "America/New_York" |

**Response (200 OK)**:

```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "trader@example.com",
  "full_name": "John A. Trader",
  "phone_number": "+1-555-123-4567",
  "timezone": "America/New_York",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

### Enable MFA

Enable multi-factor authentication.

**Endpoint**: `POST /users/mfa/setup`

**Authentication**: Required

**Response (200 OK)**:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGg...",
  "backup_codes": ["12345678", "87654321", "11223344", "44332211", "55667788"],
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Portfolio Management

### Get Portfolio Summary

Retrieve user's portfolio summary.

**Endpoint**: `GET /portfolio/summary`

**Authentication**: Required

**Response (200 OK)**:

```json
{
  "total_value": 125000.5,
  "cash_balance": 25000.0,
  "positions_value": 100000.5,
  "total_pnl": 12000.5,
  "total_pnl_percent": 10.62,
  "day_pnl": 450.25,
  "greeks": {
    "delta": 125.45,
    "gamma": 3.21,
    "theta": -45.67,
    "vega": 234.56,
    "rho": 12.34
  },
  "risk_metrics": {
    "var_95": 2500.0,
    "sharpe_ratio": 1.85,
    "max_drawdown": 0.08
  },
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Get Positions

Retrieve all open positions.

**Endpoint**: `GET /portfolio/positions`

**Authentication**: Required

**Response (200 OK)**:

```json
{
  "positions": [
    {
      "position_id": "pos_abc123",
      "symbol": "AAPL",
      "option_type": "call",
      "strike": 150.0,
      "expiration": "2025-06-20",
      "quantity": 10,
      "entry_price": 5.5,
      "current_price": 6.25,
      "pnl": 750.0,
      "pnl_percent": 13.64,
      "greeks": {
        "delta": 5.4,
        "gamma": 0.19,
        "theta": -2.5,
        "vega": 19.2
      }
    }
  ],
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Blockchain Integration

### Create Option Contract

Create a decentralized option contract on blockchain.

**Endpoint**: `POST /blockchain/contract/create`

**Authentication**: Required

**Request Body**:

| Name           | Type    | Required? | Default | Description             | Example       |
| -------------- | ------- | :-------: | :-----: | ----------------------- | ------------- |
| writer_address | string  |    Yes    |    -    | Contract writer address | "0x742d35..." |
| holder_address | string  |    Yes    |    -    | Contract holder address | "0x5aAeb6..." |
| option_type    | string  |    Yes    |    -    | "call" or "put"         | "call"        |
| strike_price   | float   |    Yes    |    -    | Strike price            | 100.0         |
| expiration     | integer |    Yes    |    -    | Unix timestamp          | 1704067200    |
| premium        | float   |    Yes    |    -    | Option premium          | 5.0           |
| collateral     | float   |    Yes    |    -    | Required collateral     | 100.0         |

**Response (200 OK)**:

```json
{
  "contract_id": "0x123abc...",
  "transaction_hash": "0xdef456...",
  "gas_used": 125000,
  "block_number": 15234567,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Exercise Option

Exercise an option contract.

**Endpoint**: `POST /blockchain/contract/exercise`

**Authentication**: Required

**Request Body**:

| Name           | Type   | Required? | Default | Description    | Example       |
| -------------- | ------ | :-------: | :-----: | -------------- | ------------- |
| contract_id    | string |    Yes    |    -    | Contract ID    | "0x123abc..." |
| holder_address | string |    Yes    |    -    | Holder address | "0x5aAeb6..." |

**Response (200 OK)**:

```json
{
  "success": true,
  "payout": 15.5,
  "transaction_hash": "0x789ghi...",
  "gas_used": 85000,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Risk Management

### Calculate VaR

Calculate Value at Risk for a portfolio.

**Endpoint**: `POST /risk/var`

**Authentication**: Required

**Request Body**:

| Name              | Type    | Required? | Default | Description            | Example |
| ----------------- | ------- | :-------: | :-----: | ---------------------- | ------- |
| positions         | array   |    Yes    |    -    | Array of positions     | [...]   |
| confidence_level  | float   |    No     |  0.95   | Confidence level (0-1) | 0.99    |
| time_horizon_days | integer |    No     |    1    | Time horizon in days   | 10      |

**Response (200 OK)**:

```json
{
  "var_amount": 2500.0,
  "confidence_level": 0.95,
  "time_horizon_days": 1,
  "calculation_method": "historical",
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Stress Test

Run stress test scenarios on portfolio.

**Endpoint**: `POST /risk/stress-test`

**Authentication**: Required

**Request Body**:

| Name      | Type  | Required? | Default | Description        | Example |
| --------- | ----- | :-------: | :-----: | ------------------ | ------- |
| positions | array |    Yes    |    -    | Array of positions | [...]   |
| scenarios | array |    Yes    |    -    | Stress scenarios   | [...]   |

**Response (200 OK)**:

```json
{
  "scenarios": [
    {
      "name": "Market Crash -20%",
      "portfolio_impact": -12500.0,
      "impact_percent": -10.0
    },
    {
      "name": "Volatility Spike +50%",
      "portfolio_impact": 3450.0,
      "impact_percent": 2.76
    }
  ],
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## Error Handling

All error responses follow a consistent format:

**Error Response Structure**:

```json
{
  "error": "error_type",
  "message": "Human-readable error message",
  "status_code": 400,
  "timestamp": "2025-01-01T12:00:00Z",
  "request_id": "req_abc123",
  "details": {
    "field": "error_detail"
  }
}
```

### Common Error Codes

| Status Code | Error Type            | Description                       |
| ----------- | --------------------- | --------------------------------- |
| 400         | bad_request           | Invalid request parameters        |
| 401         | unauthorized          | Missing or invalid authentication |
| 403         | forbidden             | Insufficient permissions          |
| 404         | not_found             | Resource not found                |
| 429         | rate_limit_exceeded   | Too many requests                 |
| 500         | internal_server_error | Server error                      |
| 503         | service_unavailable   | Service temporarily unavailable   |

### Example Error Response

```json
{
  "error": "validation_error",
  "message": "Invalid option parameters",
  "status_code": 400,
  "timestamp": "2025-01-01T12:00:00Z",
  "request_id": "req_abc123",
  "details": {
    "spot_price": "Must be greater than 0",
    "volatility": "Must be between 0 and 5"
  }
}
```

## Rate Limiting

API requests are rate-limited per user:

- **Standard Tier**: 100 requests per minute
- **Premium Tier**: 1000 requests per minute
- **Enterprise Tier**: 10000 requests per minute

Rate limit headers are included in all responses:

```text
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

## Pagination

List endpoints support pagination:

**Query Parameters**:

| Name      | Type    | Default | Description              |
| --------- | ------- | ------- | ------------------------ |
| page      | integer | 1       | Page number              |
| page_size | integer | 50      | Items per page (max 100) |

**Response Headers**:

```text
X-Total-Count: 250
X-Page: 1
X-Page-Size: 50
X-Total-Pages: 5
```

## WebSocket API

For real-time market data:

**Endpoint**: `ws://localhost:8000/ws`

**Subscribe to Market Data**:

```json
{
  "action": "subscribe",
  "channel": "market_data",
  "symbol": "AAPL"
}
```

**Market Data Update**:

```json
{
  "channel": "market_data",
  "symbol": "AAPL",
  "price": 150.25,
  "volume": 1250000,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

## API Versioning

The API supports versioning via URL path:

- Current: `/api/v2/`
- Legacy: `/api/v1/` (deprecated)

Example: `http://localhost:8000/api/v2/options/price`

## Next Steps

- [CLI Reference](CLI.md) - Command-line interface
- [Examples](examples/) - Practical examples
- [Usage Guide](USAGE.md) - Common workflows

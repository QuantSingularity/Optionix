# Configuration Guide

Complete configuration reference for the Optionix platform.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Configuration Files](#configuration-files)
- [Backend Configuration](#backend-configuration)
- [Frontend Configuration](#frontend-configuration)
- [Database Configuration](#database-configuration)
- [Security Configuration](#security-configuration)
- [Blockchain Configuration](#blockchain-configuration)
- [Monitoring Configuration](#monitoring-configuration)

## Environment Variables

Optionix uses environment variables for configuration. Create a `.env` file in the project root based on `.env.example`.

### Core Application Settings

| Option        | Type    | Default                     | Description                                  | Where to set (env/file) |
| ------------- | ------- | --------------------------- | -------------------------------------------- | ----------------------- |
| `APP_NAME`    | string  | "Optionix Trading Platform" | Application name                             | env                     |
| `APP_VERSION` | string  | "2.0.0"                     | Application version                          | env                     |
| `DEBUG`       | boolean | false                       | Enable debug mode                            | env                     |
| `TESTING`     | boolean | false                       | Enable testing mode                          | env                     |
| `ENVIRONMENT` | string  | "production"                | Environment (development/staging/production) | env                     |
| `HOST`        | string  | "0.0.0.0"                   | Server host                                  | env                     |
| `PORT`        | integer | 8000                        | Server port                                  | env                     |
| `WORKERS`     | integer | 4                           | Number of worker processes                   | env                     |

**Example**:

```bash
APP_NAME="Optionix Trading Platform"
APP_VERSION="2.0.0"
DEBUG=false
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000
WORKERS=4
```

### Database Configuration

| Option                  | Type    | Default                                         | Description                       | Where to set (env/file) |
| ----------------------- | ------- | ----------------------------------------------- | --------------------------------- | ----------------------- |
| `DATABASE_URL`          | string  | "postgresql://user:password@localhost/optionix" | PostgreSQL connection string      | env                     |
| `DATABASE_POOL_SIZE`    | integer | 20                                              | Connection pool size              | env                     |
| `DATABASE_MAX_OVERFLOW` | integer | 30                                              | Max overflow connections          | env                     |
| `DATABASE_POOL_TIMEOUT` | integer | 30                                              | Pool timeout (seconds)            | env                     |
| `DATABASE_POOL_RECYCLE` | integer | 3600                                            | Connection recycle time (seconds) | env                     |

**Example**:

```bash
DATABASE_URL=postgresql://optionix_user:secure_password@localhost:5432/optionix_db
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=3600
```

### Redis Configuration

| Option                | Type    | Default                    | Description                      | Where to set (env/file) |
| --------------------- | ------- | -------------------------- | -------------------------------- | ----------------------- |
| `REDIS_URL`           | string  | "redis://localhost:6379/0" | Redis connection URL             | env                     |
| `REDIS_SESSION_DB`    | integer | 1                          | Redis database for sessions      | env                     |
| `REDIS_CACHE_DB`      | integer | 2                          | Redis database for cache         | env                     |
| `REDIS_RATE_LIMIT_DB` | integer | 3                          | Redis database for rate limiting | env                     |
| `REDIS_PASSWORD`      | string  | null                       | Redis password (if required)     | env                     |

**Example**:

```bash
REDIS_URL=redis://localhost:6379/0
REDIS_SESSION_DB=1
REDIS_CACHE_DB=2
REDIS_RATE_LIMIT_DB=3
REDIS_PASSWORD=your_redis_password
```

### Security Configuration

| Option                        | Type    | Default | Description                                     | Where to set (env/file) |
| ----------------------------- | ------- | ------- | ----------------------------------------------- | ----------------------- |
| `SECRET_KEY`                  | string  | -       | JWT secret key (required, change in production) | env                     |
| `ENCRYPTION_KEY`              | string  | -       | Encryption key (32 characters)                  | env                     |
| `ALGORITHM`                   | string  | "HS256" | JWT algorithm                                   | env                     |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | integer | 30      | Access token expiration                         | env                     |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | integer | 7       | Refresh token expiration                        | env                     |
| `SESSION_EXPIRE_HOURS`        | integer | 24      | Session expiration                              | env                     |

**Example**:

```bash
SECRET_KEY=your-super-secret-key-min-32-chars-please-change-this-in-production
ENCRYPTION_KEY=your-32-character-encryption-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
SESSION_EXPIRE_HOURS=24
```

### Password Policy

| Option                       | Type    | Default | Description               | Where to set (env/file) |
| ---------------------------- | ------- | ------- | ------------------------- | ----------------------- |
| `PASSWORD_MIN_LENGTH`        | integer | 8       | Minimum password length   | env                     |
| `PASSWORD_REQUIRE_UPPERCASE` | boolean | true    | Require uppercase letter  | env                     |
| `PASSWORD_REQUIRE_LOWERCASE` | boolean | true    | Require lowercase letter  | env                     |
| `PASSWORD_REQUIRE_NUMBERS`   | boolean | true    | Require number            | env                     |
| `PASSWORD_REQUIRE_SPECIAL`   | boolean | true    | Require special character | env                     |
| `PASSWORD_MAX_AGE_DAYS`      | integer | 90      | Password expiration days  | env                     |
| `PASSWORD_HISTORY_COUNT`     | integer | 5       | Password history to check | env                     |

### Authentication & Authorization

| Option                             | Type    | Default | Description                     | Where to set (env/file) |
| ---------------------------------- | ------- | ------- | ------------------------------- | ----------------------- |
| `MAX_FAILED_LOGIN_ATTEMPTS`        | integer | 5       | Max failed login attempts       | env                     |
| `ACCOUNT_LOCKOUT_DURATION_MINUTES` | integer | 30      | Account lockout duration        | env                     |
| `FAILED_ATTEMPT_WINDOW_MINUTES`    | integer | 15      | Time window for failed attempts | env                     |
| `API_KEY_LENGTH`                   | integer | 43      | API key length                  | env                     |
| `API_KEY_PREFIX`                   | string  | "ok\_"  | API key prefix                  | env                     |
| `API_RATE_LIMIT_PER_HOUR`          | integer | 10000   | API rate limit per hour         | env                     |

### CORS Configuration

| Option                   | Type    | Default                                 | Description                            | Where to set (env/file) |
| ------------------------ | ------- | --------------------------------------- | -------------------------------------- | ----------------------- |
| `CORS_ORIGINS`           | list    | ["http://localhost:3000"]               | Allowed CORS origins (comma-separated) | env                     |
| `CORS_ALLOW_CREDENTIALS` | boolean | true                                    | Allow credentials                      | env                     |
| `CORS_ALLOW_METHODS`     | list    | ["GET","POST","PUT","DELETE","OPTIONS"] | Allowed HTTP methods                   | env                     |
| `CORS_ALLOW_HEADERS`     | list    | ["*"]                                   | Allowed headers                        | env                     |

**Example**:

```bash
CORS_ORIGINS=http://localhost:3000,https://app.optionix.com,https://optionix.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=*
```

### Logging Configuration

| Option                      | Type    | Default          | Description                                   | Where to set (env/file) |
| --------------------------- | ------- | ---------------- | --------------------------------------------- | ----------------------- |
| `LOG_LEVEL`                 | string  | "INFO"           | Log level (DEBUG/INFO/WARNING/ERROR/CRITICAL) | env                     |
| `LOG_FORMAT`                | string  | "%(asctime)s..." | Log format                                    | env                     |
| `LOG_FILE`                  | string  | null             | Log file path (null for stdout)               | env                     |
| `LOG_MAX_SIZE`              | integer | 10485760         | Max log file size (bytes)                     | env                     |
| `LOG_BACKUP_COUNT`          | integer | 5                | Number of backup log files                    | env                     |
| `AUDIT_LOG_RETENTION_DAYS`  | integer | 2555             | Audit log retention (7 years)                 | env                     |
| `AUDIT_LOG_ENCRYPTION`      | boolean | true             | Encrypt audit logs                            | env                     |
| `AUDIT_LOG_INTEGRITY_CHECK` | boolean | true             | Check audit log integrity                     | env                     |

### Compliance Configuration

| Option                           | Type    | Default | Description                  | Where to set (env/file) |
| -------------------------------- | ------- | ------- | ---------------------------- | ----------------------- |
| `KYC_REQUIRED`                   | boolean | true    | Require KYC verification     | env                     |
| `KYC_DOCUMENT_RETENTION_YEARS`   | integer | 7       | KYC document retention       | env                     |
| `AML_MONITORING_ENABLED`         | boolean | true    | Enable AML monitoring        | env                     |
| `SANCTIONS_SCREENING_ENABLED`    | boolean | true    | Enable sanctions screening   | env                     |
| `SANCTIONS_CHECK_FREQUENCY_DAYS` | integer | 30      | Sanctions check frequency    | env                     |
| `SOX_COMPLIANCE_ENABLED`         | boolean | true    | Enable SOX compliance        | env                     |
| `MIFID_II_REPORTING_ENABLED`     | boolean | true    | Enable MiFID II reporting    | env                     |
| `BASEL_III_MONITORING_ENABLED`   | boolean | true    | Enable Basel III monitoring  | env                     |
| `DODD_FRANK_COMPLIANCE_ENABLED`  | boolean | true    | Enable Dodd-Frank compliance | env                     |

### AI/ML Model Configuration

| Option          | Type   | Default                       | Description         | Where to set (env/file) |
| --------------- | ------ | ----------------------------- | ------------------- | ----------------------- |
| `MODEL_PATH`    | string | "models/volatility_model.pkl" | ML model file path  | env                     |
| `SCALER_PATH`   | string | "models/feature_scaler.pkl"   | Feature scaler path | env                     |
| `MODEL_VERSION` | string | "1.0.0"                       | Model version       | env                     |

### Trading Configuration

| Option                   | Type    | Default  | Description               | Where to set (env/file) |
| ------------------------ | ------- | -------- | ------------------------- | ----------------------- |
| `DEFAULT_LEVERAGE_LIMIT` | decimal | 10.0     | Default leverage limit    | env                     |
| `MAX_LEVERAGE_LIMIT`     | decimal | 100.0    | Maximum leverage limit    | env                     |
| `DEFAULT_RISK_LIMIT`     | decimal | 100000.0 | Default risk limit ($)    | env                     |
| `VAR_CONFIDENCE_LEVEL`   | decimal | 0.95     | VaR confidence level      | env                     |
| `VAR_TIME_HORIZON_DAYS`  | integer | 1        | VaR time horizon          | env                     |
| `TRADING_ENABLED`        | boolean | true     | Enable trading            | env                     |
| `TRADING_HOURS_START`    | string  | "00:00"  | Trading hours start (UTC) | env                     |
| `TRADING_HOURS_END`      | string  | "23:59"  | Trading hours end (UTC)   | env                     |
| `TRADING_TIMEZONE`       | string  | "UTC"    | Trading timezone          | env                     |

### Position Limits

| Option              | Type    | Default   | Description           | Where to set (env/file) |
| ------------------- | ------- | --------- | --------------------- | ----------------------- |
| `MAX_ORDER_SIZE`    | decimal | 1000000.0 | Maximum order size    | env                     |
| `MAX_POSITION_SIZE` | decimal | 1000000.0 | Maximum position size | env                     |
| `MIN_POSITION_SIZE` | decimal | 0.001     | Minimum position size | env                     |
| `MIN_ORDER_SIZE`    | decimal | 0.001     | Minimum order size    | env                     |

### Fee Configuration

| Option                   | Type    | Default | Description        | Where to set (env/file) |
| ------------------------ | ------- | ------- | ------------------ | ----------------------- |
| `TRADING_FEE_PERCENTAGE` | decimal | 0.001   | Trading fee (0.1%) | env                     |
| `WITHDRAWAL_FEE_FLAT`    | decimal | 5.0     | Withdrawal fee ($) | env                     |
| `DEPOSIT_FEE_PERCENTAGE` | decimal | 0.0     | Deposit fee (0%)   | env                     |

### Blockchain Configuration

| Option                     | Type    | Default                                        | Description                             | Where to set (env/file) |
| -------------------------- | ------- | ---------------------------------------------- | --------------------------------------- | ----------------------- |
| `ETHEREUM_RPC_URL`         | string  | `https://mainnet.infura.io/v3/YOUR_PROJECT_ID` | Ethereum RPC URL                        | env                     |
| `ETHEREUM_PROVIDER_URL`    | string  | `https://mainnet.infura.io/v3/YOUR_PROJECT_ID` | Ethereum provider URL                   | env                     |
| `ETHEREUM_CHAIN_ID`        | integer | 1                                              | Ethereum chain ID (1=mainnet, 5=goerli) | env                     |
| `GAS_PRICE_GWEI`           | integer | 20                                             | Gas price in Gwei                       | env                     |
| `GAS_LIMIT`                | integer | 21000                                          | Gas limit                               | env                     |
| `OPTIONS_CONTRACT_ADDRESS` | string  | "0x0000..."                                    | Options contract address                | env                     |
| `FUTURES_CONTRACT_ADDRESS` | string  | "0x0000..."                                    | Futures contract address                | env                     |
| `PRIVATE_KEY`              | string  | -                                              | Wallet private key (secure!)            | env                     |

**Example**:

```bash
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id_here
ETHEREUM_PROVIDER_URL=https://mainnet.infura.io/v3/your_project_id_here
ETHEREUM_CHAIN_ID=1
GAS_PRICE_GWEI=20
GAS_LIMIT=300000
OPTIONS_CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

### Rate Limiting

| Option                           | Type    | Default | Description                | Where to set (env/file) |
| -------------------------------- | ------- | ------- | -------------------------- | ----------------------- |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | integer | 100     | Requests per minute        | env                     |
| `RATE_LIMIT_BURST_SIZE`          | integer | 200     | Burst size                 | env                     |
| `RATE_LIMIT_WINDOW_MINUTES`      | integer | 1       | Time window for rate limit | env                     |

## Configuration Files

### Backend Configuration File

Location: `code/backend/config.py`

The backend uses Pydantic Settings for configuration management. All environment variables are automatically loaded and validated.

**Usage in Code**:

```python
from backend.config import settings

# Access configuration
print(settings.app_name)
print(settings.database_url)
print(settings.secret_key)
```

### Frontend Configuration

Location: `web-frontend/.env.local`

**Environment Variables**:

```bash
# API Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_API_TIMEOUT=30000

# Feature Flags
REACT_APP_ENABLE_BLOCKCHAIN=true
REACT_APP_ENABLE_AI_PREDICTIONS=true

# Analytics
REACT_APP_GOOGLE_ANALYTICS_ID=UA-XXXXXXXXX-X
REACT_APP_SENTRY_DSN=https://xxx@sentry.io/xxx

# Environment
REACT_APP_ENVIRONMENT=production
```

### Docker Configuration

Location: `code/docker-compose.yml`

**Key Services**:

```yaml
version: "3.8"

services:
  backend:
    build: ./code
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://optionix:password@postgres:5432/optionix
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: optionix
      POSTGRES_USER: optionix
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## Backend Configuration

### Application Settings

```python
# code/backend/config.py

class Settings(BaseSettings):
    # Core settings
    app_name: str = "Optionix Trading Platform"
    app_version: str = "2.0.0"
    debug: bool = False

    # Security
    secret_key: str
    encryption_key: str

    # Database
    database_url: str

    # Model config
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
```

### Middleware Configuration

Middleware is configured in `code/backend/app.py`:

```python
# Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# Rate Limiting
app.add_middleware(AdvancedRateLimitMiddleware)

# Request Validation
app.add_middleware(RequestValidationMiddleware)

# Audit Logging
app.add_middleware(AuditLoggingMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Frontend Configuration

### Build Configuration

Location: `web-frontend/package.json`

**Scripts**:

```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### API Configuration

Location: `web-frontend/src/config/api.ts`

```typescript
export const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || "30000"),
  headers: {
    "Content-Type": "application/json",
  },
};
```

## Database Configuration

### PostgreSQL Configuration

**Connection String Format**:

```text
postgresql://username:password@host:port/database?options
```

**Example**:

```bash
DATABASE_URL=postgresql://optionix_user:secure_password@localhost:5432/optionix_db?sslmode=require
```

### TimescaleDB Extensions

For time-series data optimization:

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create hypertable for market data
SELECT create_hypertable('market_data', 'timestamp');
```

### Migration Configuration

Location: `code/backend/alembic.ini`

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://user:password@localhost/optionix

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic
```

## Security Configuration

### TLS/SSL Configuration

For production deployment:

```bash
# Generate SSL certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Configure uvicorn with SSL
uvicorn backend.app:app \
  --ssl-keyfile key.pem \
  --ssl-certfile cert.pem \
  --host 0.0.0.0 \
  --port 443
```

### Firewall Rules

```bash
# Allow only necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

## Blockchain Configuration

### Network Configuration

**Mainnet**:

```bash
ETHEREUM_CHAIN_ID=1
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
```

**Goerli Testnet**:

```bash
ETHEREUM_CHAIN_ID=5
ETHEREUM_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
```

**Local Development (Ganache)**:

```bash
ETHEREUM_CHAIN_ID=1337
ETHEREUM_RPC_URL=http://localhost:8545
```

### Smart Contract Configuration

Location: `code/blockchain/truffle-config.js`

```javascript
module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    goerli: {
      provider: () =>
        new HDWalletProvider(
          process.env.MNEMONIC,
          `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
        ),
      network_id: 5,
      gas: 5500000,
    },
  },
  compilers: {
    solc: {
      version: "0.8.19",
    },
  },
};
```

## Monitoring Configuration

### Prometheus Configuration

Location: `infrastructure/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "optionix-backend"
    static_configs:
      - targets: ["localhost:8000"]
    metrics_path: "/metrics"
```

### Grafana Configuration

```bash
# Grafana environment variables
GF_SERVER_ROOT_URL=https://grafana.optionix.com
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=secure_password
GF_AUTH_ANONYMOUS_ENABLED=false
```

## Environment-Specific Configuration

### Development

```bash
DEBUG=true
ENVIRONMENT=development
LOG_LEVEL=DEBUG
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://optionix:dev@localhost:5432/optionix_dev
ETHEREUM_RPC_URL=http://localhost:8545
```

### Staging

```bash
DEBUG=false
ENVIRONMENT=staging
LOG_LEVEL=INFO
CORS_ORIGINS=https://staging.optionix.com
DATABASE_URL=postgresql://optionix:staging_pass@staging-db:5432/optionix_staging
ETHEREUM_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
```

### Production

```bash
DEBUG=false
ENVIRONMENT=production
LOG_LEVEL=WARNING
CORS_ORIGINS=https://app.optionix.com,https://optionix.com
DATABASE_URL=postgresql://optionix:prod_secure_pass@prod-db:5432/optionix_prod?sslmode=require
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
```

## Configuration Validation

Validate your configuration:

```bash
# Using the validation script
./scripts/env_validator.sh

# Manual validation
python -c "from backend.config import settings; print('Config valid!')"
```

## Best Practices

1. **Never commit sensitive data** - Use `.env` files (gitignored)
2. **Use strong secrets** - Generate with `openssl rand -hex 32`
3. **Different configs per environment** - Use separate `.env` files
4. **Validate on startup** - Use Pydantic for validation
5. **Document all settings** - Maintain this configuration guide
6. **Use environment variables** - Not hardcoded values
7. **Secure credential storage** - Use secrets management systems in production

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for configuration-related issues.

## Next Steps

- [Installation Guide](INSTALLATION.md) - Setup instructions
- [Usage Guide](USAGE.md) - Using the configured system
- [Security Best Practices](CONTRIBUTING.md#security) - Secure configuration

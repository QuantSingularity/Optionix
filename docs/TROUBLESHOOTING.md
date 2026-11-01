# Troubleshooting Guide

Common issues and solutions for the Optionix platform.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Backend Issues](#backend-issues)
- [Frontend Issues](#frontend-issues)
- [Database Issues](#database-issues)
- [Blockchain Issues](#blockchain-issues)
- [Performance Issues](#performance-issues)
- [Security & Authentication](#security--authentication)

## Installation Issues

### Python Virtual Environment Issues

**Problem**: `venv` creation fails

```bash
Error: No module named 'venv'
```

**Solution**:

```bash
# Ubuntu/Debian
sudo apt-install python3-venv

# macOS
brew install python@3.11

# Windows
py -m pip install virtualenv
```

### Dependency Installation Fails

**Problem**: `pip install` errors

**Solution**:

```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install with verbose output
pip install -r code/requirements.txt -v

# If specific package fails, install separately
pip install package-name --no-cache-dir
```

### Node.js Version Mismatch

**Problem**: `npm install` fails with version error

**Solution**:

```bash
# Check Node version
node --version  # Should be 16.x or higher

# Use nvm to install correct version
nvm install 18
nvm use 18

# Retry installation
rm -rf node_modules package-lock.json
npm install
```

## Backend Issues

### Server Won't Start

**Problem**: `python run_backend.py` fails

**Symptoms**:

```text
ImportError: No module named 'fastapi'
```

**Solution**:

```bash
# Activate virtual environment
source venv/bin/activate

# Verify installation
pip list | grep fastapi

# Reinstall if missing
pip install fastapi uvicorn
```

### Database Connection Error

**Problem**: Cannot connect to PostgreSQL

**Symptoms**:

```text
sqlalchemy.exc.OperationalError: could not connect to server
```

**Solution**:

```bash
# Check if PostgreSQL is running
sudo service postgresql status
# or
pg_isready

# Start PostgreSQL
sudo service postgresql start

# Verify connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/optionix

# Test connection
psql -h localhost -U user -d optionix
```

### Redis Connection Error

**Problem**: Cannot connect to Redis

**Solution**:

```bash
# Check Redis status
redis-cli ping  # Should return PONG

# Start Redis
sudo service redis-server start

# Check configuration
redis-cli CONFIG GET bind
redis-cli CONFIG GET port
```

### Import Errors

**Problem**: Module import fails

**Solution**:

```bash
# Check PYTHONPATH
echo $PYTHONPATH

# Add code directory to path
export PYTHONPATH=$PYTHONPATH:/path/to/Optionix/code

# Or add to run script
cd code
python run_backend.py
```

### Port Already in Use

**Problem**: Port 8000 already occupied

**Solution**:

```bash
# Find process using port
lsof -i :8000
# or
netstat -tulpn | grep 8000

# Kill process
kill -9 PID  # replace PID with the process ID found above

# Or use different port
uvicorn backend.app:app --port 8001
```

## Frontend Issues

### npm start Fails

**Problem**: Development server won't start

**Solution**:

```bash
# Clear cache
npm cache clean --force

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for port conflicts
lsof -i :3000
kill -9 PID  # replace PID with the process ID found above
```

### Build Errors

**Problem**: `npm run build` fails

**Solution**:

```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Check for TypeScript errors
npm run type-check

# Check for ESLint errors
npm run lint
```

### API Connection Issues

**Problem**: Frontend can't reach backend API

**Solution**:

```bash
# Check .env.local
REACT_APP_API_URL=http://localhost:8000

# Verify backend is running
curl http://localhost:8000/health

# Check CORS settings in backend
# code/backend/config.py
cors_origins = ["http://localhost:3000"]
```

### Environment Variables Not Loading

**Problem**: `process.env.REACT_APP_*` is undefined

**Solution**:

```bash
# Restart development server after .env changes
# React only loads env vars on start

# Verify variable name starts with REACT_APP_
REACT_APP_API_URL=http://localhost:8000  # ✓
API_URL=http://localhost:8000           # ✗ Won't work
```

## Database Issues

### Migration Fails

**Problem**: Alembic migration error

**Solution**:

```bash
# Check current version
cd code/backend
alembic current

# View migration history
alembic history

# Rollback and retry
alembic downgrade -1
alembic upgrade head

# If stuck, stamp database
alembic stamp head
```

### Database Performance

**Problem**: Slow queries

**Solution**:

```sql
-- Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM positions WHERE user_id = 'xxx';

-- Create missing indexes
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_trades_timestamp ON trades(timestamp);
```

### Connection Pool Exhausted

**Problem**: Too many database connections

**Solution**:

```python
# Increase pool size in config.py
database_pool_size = 30  # Increase from 20
database_max_overflow = 50  # Increase from 30

# Or close connections properly
db.close()
```

## Blockchain Issues

### Cannot Connect to Ethereum Node

**Problem**: Blockchain service fails to connect

**Solution**:

```bash
# Check RPC URL
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Verify environment variable
echo $ETHEREUM_RPC_URL

# Try different network
ETHEREUM_CHAIN_ID=5  # Goerli testnet
ETHEREUM_RPC_URL=https://goerli.infura.io/v3/YOUR_PROJECT_ID
```

### Smart Contract Deployment Fails

**Problem**: Truffle migration error

**Solution**:

```bash
# Compile contracts first
cd code/blockchain
npx truffle compile

# Check gas price
npx truffle networks

# Deploy with more gas
truffle migrate --network development --gas 5000000

# Reset deployment
truffle migrate --reset
```

### Transaction Reverts

**Problem**: Smart contract transaction fails

**Solution**:

```solidity
// Check require statements
require(strikePrice > 0, "Invalid strike");  // Add descriptive messages

// Check gas limit
{gas: 300000}  // Increase if needed

// Check sender has enough funds
web3.eth.getBalance(account)
```

## Performance Issues

### Slow API Response

**Problem**: API endpoints respond slowly

**Solution**:

```bash
# Enable query logging
LOG_LEVEL=DEBUG
```

```python
# Profile specific endpoint
import cProfile
cProfile.run('my_function()')

# Add caching
from functools import lru_cache

@lru_cache(maxsize=128)
def expensive_calculation():
    pass

# Use Redis cache
redis_client.setex(key, 300, value)  # 5 min TTL
```

### High Memory Usage

**Problem**: Backend consumes too much memory

**Solution**:

```bash
# Monitor memory
pip install memory_profiler
python -m memory_profiler script.py
```

```python
# Reduce batch sizes
# Instead of loading all data at once
for batch in query.yield_per(1000):
    process(batch)

# Close database sessions
db.close()
```

### Frontend Lag

**Problem**: UI is slow or unresponsive

**Solution**:

```typescript
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  // Component logic
});

// Debounce expensive operations
import { debounce } from "lodash";

const debouncedSearch = debounce((query) => {
  searchAPI(query);
}, 300);

// Lazy load components
const HeavyComponent = React.lazy(() => import("./HeavyComponent"));
```

## Security & Authentication

### JWT Token Expired

**Problem**: 401 Unauthorized error

**Solution**:

```javascript
// Implement token refresh
async function refreshToken() {
  const response = await fetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: storedRefreshToken }),
  });
  const { access_token } = await response.json();
  localStorage.setItem("access_token", access_token);
}

// Intercept 401 responses
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response.status === 401) {
      await refreshToken();
      return axios.request(error.config);
    }
    return Promise.reject(error);
  },
);
```

### MFA Setup Issues

**Problem**: Cannot scan QR code

**Solution**:

```python
# Manually enter secret key in authenticator app
# Backend returns both QR code and secret

# Verify MFA code
import pyotp
totp = pyotp.TOTP(secret)
valid = totp.verify(user_code, valid_window=1)
```

### Rate Limit Exceeded

**Problem**: 429 Too Many Requests

**Solution**:

```python
# Implement exponential backoff
import time

def api_call_with_retry(func, max_retries=3):
    for i in range(max_retries):
        try:
            return func()
        except RateLimitError:
            wait_time = 2 ** i
            time.sleep(wait_time)
    raise Exception("Max retries exceeded")
```

## Common Error Messages

### "Module not found"

```bash
# Backend
source venv/bin/activate
pip install -r code/requirements.txt

# Frontend
npm install
```

### "Port already in use"

```bash
lsof -i :8000
kill -9 PID  # replace PID with the process ID found above
```

### "Permission denied"

```bash
chmod +x scripts/setup_optionix_env.sh
```

### "Database does not exist"

```bash
createdb optionix
alembic upgrade head
```

### "Connection refused"

```bash
# Check service status
sudo service postgresql status
sudo service redis-server status

# Start services
sudo service postgresql start
sudo service redis-server start
```

## Getting Help

If these solutions don't work:

1. **Check Logs**:

   ```bash
   # Backend logs
   tail -f logs/optionix.log

   # Docker logs
   docker-compose logs -f
   ```

2. **Search Issues**: [GitHub Issues](https://github.com/quantsingularity/Optionix/issues)

3. **Ask Community**: [GitHub Discussions](https://github.com/quantsingularity/Optionix/discussions)

4. **Report Bug**: Include:
   - Error message
   - Steps to reproduce
   - Environment (OS, Python version, etc.)
   - Relevant logs

## Useful Commands

```bash
# Check system status
./scripts/env_validator.sh

# Run comprehensive tests
./scripts/comprehensive_test.sh

# View logs
tail -f logs/*.log

# Reset environment
./scripts/clean_project.sh
./scripts/setup_optionix_env.sh
```

---

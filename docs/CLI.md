# CLI Reference

Command-line interface and scripts reference for Optionix.

## Table of Contents

- [Overview](#overview)
- [Setup Scripts](#setup-scripts)
- [Runtime Scripts](#runtime-scripts)
- [Database Management](#database-management)
- [Testing Scripts](#testing-scripts)
- [Code Quality](#code-quality)
- [Deployment Scripts](#deployment-scripts)
- [Monitoring](#monitoring)

## Overview

Optionix provides a comprehensive set of command-line tools for development, testing, deployment, and operations. All scripts are located in the `scripts/` directory.

## Setup Scripts

### setup_optionix_env.sh

Automated environment setup script that installs all dependencies.

**Location**: `scripts/setup_optionix_env.sh`

**Usage**:

```bash
chmod +x scripts/setup_optionix_env.sh
./scripts/setup_optionix_env.sh
```

**What it does**:

- Checks for required tools (Python, Node.js, npm)
- Creates Python virtual environment
- Installs backend dependencies
- Installs frontend dependencies
- Sets up blockchain environment

**Options**:

| Flag              | Description                      | Example                                   |
| ----------------- | -------------------------------- | ----------------------------------------- |
| `--skip-backend`  | Skip backend setup               | `./setup_optionix_env.sh --skip-backend`  |
| `--skip-frontend` | Skip frontend setup              | `./setup_optionix_env.sh --skip-frontend` |
| `--dev`           | Install development dependencies | `./setup_optionix_env.sh --dev`           |

**Example Output**:

```text
Starting Optionix project setup...
✓ All required tools found.
Setting up Optionix Backend...
✓ Backend dependencies installed.
Setting up Optionix Web Frontend...
✓ Frontend dependencies installed.
Optionix project setup script finished.
```

## Runtime Scripts

### run_optionix.sh

Main script to start the entire Optionix platform.

**Location**: `scripts/run_optionix.sh`

**Usage**:

```bash
chmod +x scripts/run_optionix.sh
./scripts/run_optionix.sh
```

**What it does**:

- Starts backend API server
- Starts frontend development server
- Optionally starts blockchain node

**Options**:

| Flag              | Description         | Example                             |
| ----------------- | ------------------- | ----------------------------------- |
| `--backend-only`  | Start only backend  | `./run_optionix.sh --backend-only`  |
| `--frontend-only` | Start only frontend | `./run_optionix.sh --frontend-only` |
| `--production`    | Production mode     | `./run_optionix.sh --production`    |
| `--port PORT`     | Custom port         | `./run_optionix.sh --port 8080`     |

### run_backend.py

Python script to start the backend API server.

**Location**: `code/run_backend.py`

**Usage**:

```bash
cd code
python run_backend.py
```

**Environment Variables**:

| Variable | Default | Description                 |
| -------- | ------- | --------------------------- |
| `HOST`   | 0.0.0.0 | Server host                 |
| `PORT`   | 8000    | Server port                 |
| `DEBUG`  | False   | Debug mode                  |
| `RELOAD` | False   | Auto-reload on code changes |

**Example**:

```bash
# Development mode with auto-reload
DEBUG=true RELOAD=true python run_backend.py

# Production mode with 4 workers
uvicorn backend.app:app --workers 4 --host 0.0.0.0 --port 8000
```

## Database Management

### db_manager.sh

Comprehensive database management script.

**Location**: `scripts/db_manager.sh`

**Commands**:

| Command    | Description                  | Example                              |
| ---------- | ---------------------------- | ------------------------------------ |
| `init`     | Initialize database          | `./db_manager.sh init`               |
| `migrate`  | Run migrations               | `./db_manager.sh migrate`            |
| `rollback` | Rollback last migration      | `./db_manager.sh rollback`           |
| `seed`     | Seed database with test data | `./db_manager.sh seed`               |
| `backup`   | Create database backup       | `./db_manager.sh backup`             |
| `restore`  | Restore from backup          | `./db_manager.sh restore backup.sql` |
| `reset`    | Reset database (destructive) | `./db_manager.sh reset`              |

**Usage Examples**:

```bash
# Initialize database
./scripts/db_manager.sh init

# Create new migration
./scripts/db_manager.sh migrate --message "Add user preferences table"

# Backup database
./scripts/db_manager.sh backup
# Output: Database backed up to: backups/optionix_2025-01-01_120000.sql

# Restore database
./scripts/db_manager.sh restore backups/optionix_2025-01-01_120000.sql

# Reset database (WARNING: Destructive)
./scripts/db_manager.sh reset --confirm
```

### Alembic Commands

Direct database migration management using Alembic.

**Usage**:

```bash
cd code/backend

# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Show migration history
alembic history

# Show current version
alembic current

# Upgrade to specific revision
alembic upgrade REVISION_ID  # revision IDs: alembic history

# Downgrade to specific revision
alembic downgrade REVISION_ID  # revision IDs: alembic history
```

## Testing Scripts

### comprehensive_test.sh

Run all tests across the project.

**Location**: `scripts/comprehensive_test.sh`

**Usage**:

```bash
./scripts/comprehensive_test.sh
```

**Options**:

| Flag         | Description              | Example                              |
| ------------ | ------------------------ | ------------------------------------ |
| `--backend`  | Test only backend        | `./comprehensive_test.sh --backend`  |
| `--frontend` | Test only frontend       | `./comprehensive_test.sh --frontend` |
| `--coverage` | Generate coverage report | `./comprehensive_test.sh --coverage` |
| `--verbose`  | Verbose output           | `./comprehensive_test.sh --verbose`  |

**Example Output**:

```text
Running Optionix Comprehensive Tests...
========================================
Backend Tests:
✓ test_option_pricing.py::test_black_scholes_call PASSED
✓ test_option_pricing.py::test_black_scholes_put PASSED
...
Backend: 154/154 tests passed (100%)
Coverage: 81%

Frontend Tests:
✓ Dashboard.test.tsx PASSED
...
Frontend: 89/89 tests passed (100%)

Overall: 243/243 tests passed ✓
```

### test_backend.sh

Start the backend and smoke-test its API endpoints.

**Location**: `scripts/test_backend.sh`

**Usage**:

```bash
./scripts/test_backend.sh
```

The script takes no options. It requires the virtual environment created by `setup_optionix_env.sh`, then:

1. Starts the backend with `uvicorn` on port 8000
2. Waits up to 30 seconds for the server to become ready
3. Checks `GET /` and `POST /market/volatility`
4. Stops the server and exits non-zero if any check failed

### Backend Testing

```bash
cd code/backend

# Run all tests
pytest

# Run specific test file
pytest tests/test_pricing.py

# Run specific test
pytest tests/test_pricing.py::test_black_scholes_call

# Run with coverage
pytest --cov=backend --cov-report=html

# Run with verbose output
pytest -v

# Run in parallel
pytest -n auto

# Stop on first failure
pytest -x

# Run only failed tests from last run
pytest --lf
```

### Frontend Testing

```bash
cd web-frontend

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Update snapshots
npm test -- --updateSnapshot

# Run specific test file
npm test -- Dashboard.test.tsx
```

## Code Quality

### lint-all.sh

Run all linters and code quality checks.

**Location**: `scripts/lint-all.sh`

**Usage**:

```bash
./scripts/lint-all.sh
```

**Options**:

| Flag         | Description        | Example                    |
| ------------ | ------------------ | -------------------------- |
| `--fix`      | Auto-fix issues    | `./lint-all.sh --fix`      |
| `--backend`  | Lint only backend  | `./lint-all.sh --backend`  |
| `--frontend` | Lint only frontend | `./lint-all.sh --frontend` |

**Checks Performed**:

- Python: flake8, black, isort, mypy, bandit
- JavaScript/TypeScript: ESLint, Prettier
- Security: bandit (Python), npm audit (Node)
- Code complexity analysis

**Example Output**:

```text
Running Code Quality Checks...
==============================
✓ flake8: No issues found
✓ black: All files formatted correctly
✓ isort: Import order correct
✓ mypy: Type checking passed
✓ ESLint: No errors
✓ Prettier: All files formatted
✓ bandit: No security issues

Overall: All checks passed ✓
```

### Individual Linters

**Backend**:

```bash
cd code/backend

# Flake8 (style)
flake8 .

# Black (formatter)
black . --check  # Check only
black .          # Format

# isort (import sorting)
isort . --check-only  # Check only
isort .               # Sort

# mypy (type checking)
mypy .

# bandit (security)
bandit -r . -f json -o security_report.json
```

**Frontend**:

```bash
cd web-frontend

# ESLint
npm run lint

# Fix lint issues
npm run lint:fix

# Prettier
npm run format:check  # Check only
npm run format        # Format

# Type check
npm run type-check
```

## Deployment Scripts

### build_production.sh

Build production-ready artifacts.

**Location**: `scripts/build_production.sh`

**Usage**:

```bash
./scripts/build_production.sh
```

**What it does**:

- Builds optimized backend Docker image
- Builds optimized frontend bundle
- Compiles smart contracts
- Creates deployment artifacts

**Options**:

| Flag         | Description         | Example                              |
| ------------ | ------------------- | ------------------------------------ |
| `--tag TAG`  | Docker image tag    | `./build_production.sh --tag v2.0.0` |
| `--push`     | Push to registry    | `./build_production.sh --push`       |
| `--no-cache` | Build without cache | `./build_production.sh --no-cache`   |

**Example**:

```bash
# Build with specific tag
./scripts/build_production.sh --tag v2.0.0

# Build and push to Docker registry
./scripts/build_production.sh --tag v2.0.0 --push

# Output:
# Building backend Docker image...
# ✓ Backend image built: optionix-backend:v2.0.0
# Building frontend bundle...
# ✓ Frontend bundle created: web-frontend/build/
# Compiling smart contracts...
# ✓ Contracts compiled: code/blockchain/build/
```

### ci_cd_pipeline.sh

CI/CD pipeline script.

**Location**: `scripts/ci_cd_pipeline.sh`

**Usage**:

```bash
./scripts/ci_cd_pipeline.sh
```

**Stages**:

1. Environment validation
2. Dependency installation
3. Code quality checks
4. Unit tests
5. Integration tests
6. Build artifacts
7. Deploy to staging

**Options**:

| Flag            | Description          | Example                             |
| --------------- | -------------------- | ----------------------------------- |
| `--stage STAGE` | Run specific stage   | `./ci_cd_pipeline.sh --stage test`  |
| `--skip-tests`  | Skip test stage      | `./ci_cd_pipeline.sh --skip-tests`  |
| `--deploy-prod` | Deploy to production | `./ci_cd_pipeline.sh --deploy-prod` |

## Monitoring

### performance_monitor.sh

Monitor system performance and health.

**Location**: `scripts/performance_monitor.sh`

**Usage**:

```bash
./scripts/performance_monitor.sh
```

**Options**:

| Flag                 | Description         | Example                                        |
| -------------------- | ------------------- | ---------------------------------------------- |
| `--interval SECONDS` | Monitoring interval | `./performance_monitor.sh --interval 5`        |
| `--duration MINUTES` | Monitoring duration | `./performance_monitor.sh --duration 60`       |
| `--output FILE`      | Save report to file | `./performance_monitor.sh --output report.txt` |

**Metrics Monitored**:

- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- API response times
- Database connections
- Redis cache hit rate

**Example Output**:

```text
Optionix Performance Monitor
============================
Timestamp: 2025-01-01 12:00:00
CPU Usage: 35%
Memory Usage: 2.4GB / 8GB (30%)
Disk I/O: Read 15MB/s, Write 5MB/s
Network: In 10Mbps, Out 5Mbps

API Metrics:
  Requests/sec: 145
  Avg Response Time: 45ms
  P95 Response Time: 120ms
  P99 Response Time: 250ms

Database:
  Active Connections: 12/20
  Query Time (avg): 12ms

Redis:
  Cache Hit Rate: 94%
  Memory: 512MB
```

### env_validator.sh

Validate environment configuration.

**Location**: `scripts/env_validator.sh`

**Usage**:

```bash
./scripts/env_validator.sh
```

**Checks**:

- Required tools installed (Python, Node.js, PostgreSQL, Redis)
- Environment variables configured
- Database connectivity
- API endpoints reachable
- Blockchain node connectivity

**Example Output**:

```text
Validating Optionix Environment...
===================================
✓ Python 3.11 found
✓ Node.js 18.x found
✓ npm 9.x found
✓ PostgreSQL 14 found
✓ Redis 7 found
✓ Environment variables configured
✓ Database connection successful
✓ Redis connection successful
✗ Blockchain node not reachable (Warning)

Environment validation: 8/9 checks passed
```

## Utility Commands

### Clean Project

```bash
# Remove build artifacts and cache
./scripts/clean_project.sh

# What it removes:
# - Python __pycache__ directories
# - Node modules (with --deep flag)
# - Build directories
# - Coverage reports
# - Log files
```

### Generate Documentation

```bash
# Generate API documentation
./scripts/doc_generator.sh

# Options:
# --api     Generate API docs only
# --code    Generate code docs only
# --all     Generate all documentation
```

## Docker Commands

```bash
# Build Docker image
docker build -t optionix-backend -f infrastructure/Dockerfile .

# Run container
docker run -d -p 8000:8000 optionix-backend

# Docker Compose
docker-compose up -d        # Start all services
docker-compose down         # Stop all services
docker-compose logs -f      # View logs
docker-compose ps           # View status
docker-compose restart      # Restart services
```

## Kubernetes Commands

```bash
# Apply configurations
kubectl apply -f infrastructure/kubernetes/

# Check status
kubectl get pods -n optionix
kubectl get services -n optionix

# View logs
kubectl logs -f deployment/optionix-backend -n optionix

# Scale deployment
kubectl scale deployment/optionix-backend --replicas=5 -n optionix

# Port forward
kubectl port-forward service/optionix-backend 8000:8000 -n optionix
```

## Terraform Commands

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy infrastructure
terraform destroy

# Output values
terraform output
```

## Ansible Commands

```bash
cd infrastructure/ansible

# Run playbook
ansible-playbook -i inventory/production.ini playbooks/deploy.yml

# Check syntax
ansible-playbook playbooks/deploy.yml --syntax-check

# Dry run
ansible-playbook -i inventory/production.ini playbooks/deploy.yml --check

# Run specific tasks
ansible-playbook -i inventory/production.ini playbooks/deploy.yml --tags "backend"
```

## Command Summary Table

| Command                  | Arguments                                         | Description          | Example                                 |
| ------------------------ | ------------------------------------------------- | -------------------- | --------------------------------------- |
| `setup_optionix_env.sh`  | `[--skip-backend\|--skip-frontend\|--dev]`        | Setup environment    | `./setup_optionix_env.sh`               |
| `run_optionix.sh`        | `[--backend-only\|--frontend-only\|--production]` | Start platform       | `./run_optionix.sh --production`        |
| `db_manager.sh`          | `<init\|migrate\|backup\|restore\|reset>`         | Manage database      | `./db_manager.sh backup`                |
| `comprehensive_test.sh`  | `[--backend\|--frontend\|--coverage]`             | Run tests            | `./comprehensive_test.sh --coverage`    |
| `test_backend.sh`        | None                                              | Smoke-test API       | `./test_backend.sh`                     |
| `lint-all.sh`            | `[--fix\|--backend\|--frontend]`                  | Code quality         | `./lint-all.sh --fix`                   |
| `build_production.sh`    | `[--tag TAG\|--push]`                             | Build artifacts      | `./build_production.sh --tag v2.0`      |
| `performance_monitor.sh` | `[--interval N\|--duration N]`                    | Monitor system       | `./performance_monitor.sh --interval 5` |
| `env_validator.sh`       | None                                              | Validate environment | `./env_validator.sh`                    |

## Best Practices

1. **Always activate virtual environment** before running Python commands:

   ```bash
   source venv/bin/activate
   ```

2. **Run tests before committing**:

   ```bash
   ./scripts/comprehensive_test.sh
   ```

3. **Check code quality**:

   ```bash
   ./scripts/lint-all.sh --fix
   ```

4. **Backup database before migrations**:

   ```bash
   ./scripts/db_manager.sh backup
   alembic upgrade head
   ```

5. **Monitor logs during deployment**:

   ```bash
   docker-compose logs -f
   ```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common CLI issues and solutions.

## Next Steps

- [API Reference](API.md) - REST API documentation
- [Configuration](CONFIGURATION.md) - Environment configuration
- [Examples](examples/) - Practical examples

#!/bin/bash

# Entrypoint Script for Optionix Platform
# Implements comprehensive startup procedures with security and compliance checks

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Environment validation
validate_environment() {
    log "Validating environment variables..."

    required_vars=(
        "DATABASE_URL"
        "REDIS_URL"
        "SECRET_KEY"
        "ENCRYPTION_KEY"
    )

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    log_success "Environment validation completed"
}

# Database connectivity check
check_database() {
    log "Checking database connectivity..."

    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if python3 -c "
import os
from sqlalchemy import create_engine, text
try:
    engine = create_engine(os.environ['DATABASE_URL'])
    with engine.connect() as conn:
        conn.execute(text('SELECT 1'))
    exit(0)
except Exception as e:
    print(f'Database connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            log_success "Database connection established"
            return 0
        fi

        log_warning "Database connection attempt $attempt/$max_attempts failed. Retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done

    log_error "Failed to connect to database after $max_attempts attempts"
    exit 1
}

# Redis connectivity check
check_redis() {
    log "Checking Redis connectivity..."

    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if python3 -c "
import redis
import os
try:
    r = redis.from_url(os.environ['REDIS_URL'])
    r.ping()
    print('Redis connection successful')
    exit(0)
except Exception as e:
    print(f'Redis connection failed: {e}')
    exit(1)
" 2>/dev/null; then
            log_success "Redis connection established"
            return 0
        fi

        log_warning "Redis connection attempt $attempt/$max_attempts failed. Retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done

    log_error "Failed to connect to Redis after $max_attempts attempts"
    exit 1
}

# Database migration
run_migrations() {
    log "Running database migrations..."

    if python3 -c "
import alembic.config
import alembic.command
import os

try:
    alembic_cfg = alembic.config.Config(os.path.join(os.getcwd(), "alembic.ini"))
    alembic.command.upgrade(alembic_cfg, 'head')
    print('Migrations completed successfully')
    exit(0)
except Exception as e:
    print(f'Migration failed: {e}')
    exit(1)
"; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        exit 1
    fi
}

# Security checks
security_checks() {
    log "Performing security checks..."

    # Check file permissions
    if [[ $(stat -c "%a" /app) != "755" ]]; then
        log_warning "Application directory permissions are not optimal"
    fi

    # Check for sensitive files
    if [[ -f "/app/.env" ]]; then
        log_warning "Environment file found in application directory"
    fi

    # Validate SSL/TLS configuration
    if [[ "${ENVIRONMENT:-}" == "production" ]]; then
        if [[ -z "${SSL_CERT_PATH:-}" ]] || [[ -z "${SSL_KEY_PATH:-}" ]]; then
            log_warning "SSL certificates not configured for production environment"
        fi
    fi

    log_success "Security checks completed"
}

# Compliance checks
compliance_checks() {
    log "Performing compliance checks..."

    # Check audit logging configuration
    if [[ -z "${AUDIT_LOG_ENABLED:-}" ]]; then
        log_warning "Audit logging not explicitly configured"
    fi

    # Check data retention policies
    if [[ -z "${DATA_RETENTION_DAYS:-}" ]]; then
        log_warning "Data retention policy not configured"
    fi

    # Check encryption settings
    if [[ "${ENCRYPTION_AT_REST:-}" != "true" ]]; then
        log_warning "Encryption at rest not enabled"
    fi

    log_success "Compliance checks completed"
}

# Health check endpoint setup
setup_health_check() {
    log "Setting up health check endpoint..."

    # Create health check script
    cat > /tmp/health_check.py << 'EOF'
#!/usr/bin/env python3
import sys
import requests
import os

def health_check():
    try:
        response = requests.get('http://localhost:8000/health', timeout=5)
        if response.status_code == 200:
            print("Health check passed")
            return 0
        else:
            print(f"Health check failed with status {response.status_code}")
            return 1
    except Exception as e:
        print(f"Health check error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(health_check())
EOF

    chmod +x /tmp/health_check.py
    log_success "Health check endpoint configured"
}

# Performance optimization
optimize_performance() {
    log "Applying performance optimizations..."

    # Set Python optimizations
    export PYTHONOPTIMIZE=1
    export PYTHONHASHSEED=random

    # Configure garbage collection
    export PYTHONGC=1

    # Set worker processes based on CPU cores
    if [[ -z "${WORKERS:-}" ]]; then
        WORKERS=$(($(nproc) * 2 + 1))
        export WORKERS
        log "Set worker processes to $WORKERS"
    fi

    log_success "Performance optimizations applied"
}

# Monitoring setup
setup_monitoring() {
    log "Setting up monitoring..."

    # Create monitoring directories
    mkdir -p /app/logs/access
    mkdir -p /app/logs/error
    mkdir -p /app/logs/audit

    # Set up log rotation
    if command -v logrotate >/dev/null 2>&1; then
        cat > /tmp/logrotate.conf << 'EOF'
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 optionix optionix
}
EOF
    fi

    log_success "Monitoring setup completed"
}

# Cleanup function
cleanup() {
    log "Performing cleanup on exit..."
    # Add any cleanup tasks here
}

# Signal handlers
trap cleanup EXIT
trap 'log_error "Received SIGTERM, shutting down gracefully..."; exit 0' TERM
trap 'log_error "Received SIGINT, shutting down gracefully..."; exit 0' INT

# Main execution
main() {
    log "Starting Optionix Platform initialization..."

    # Validate environment
    validate_environment

    # Check dependencies
    check_database
    check_redis

    # Run migrations
    run_migrations

    # Security and compliance
    security_checks
    compliance_checks

    # Setup components
    setup_health_check
    optimize_performance
    setup_monitoring

    log_success "Initialization completed successfully"

    # Execute the main command
    log "Starting application with command: $*"
    exec "$@"
}

# Run main function with all arguments
main "$@"

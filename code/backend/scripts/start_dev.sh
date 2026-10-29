#!/bin/bash
# Start Optionix in development mode
set -e

cd "$(dirname "$0")/.."

if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env with your configuration before continuing."
    exit 1
fi

# Generate dev SSL certs if needed
bash scripts/generate_dev_certs.sh

# Set build args
export BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
export VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export ENVIRONMENT=development

docker compose up --build "$@"

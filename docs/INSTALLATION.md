# Installation Guide

This guide covers all installation methods for the Optionix platform, from quick setup to production deployment.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Docker Installation](#docker-installation)
- [Production Deployment](#production-deployment)
- [Verification](#verification)

## System Requirements

### Minimum Requirements

| Component            | Requirement                                          |
| -------------------- | ---------------------------------------------------- |
| **Operating System** | Linux (Ubuntu 20.04+), macOS 11+, Windows 10+ (WSL2) |
| **Python**           | 3.11 or higher                                       |
| **Node.js**          | 16.x or higher                                       |
| **npm**              | 8.x or higher                                        |
| **Memory**           | 4 GB RAM (8 GB recommended)                          |
| **Storage**          | 10 GB available disk space                           |
| **Database**         | PostgreSQL 13+ (optional for development)            |
| **Redis**            | 6.0+ (optional for development)                      |

### Optional Requirements

| Component          | Purpose                       | Version |
| ------------------ | ----------------------------- | ------- |
| **Docker**         | Container deployment          | 20.10+  |
| **Docker Compose** | Multi-container orchestration | 2.0+    |
| **Kubernetes**     | Production orchestration      | 1.24+   |
| **Terraform**      | Infrastructure as Code        | 1.3+    |
| **Ansible**        | Configuration management      | 2.12+   |

## Quick Installation

The fastest way to get started is using the automated setup script:

### Step 1: Clone Repository

```bash
git clone https://github.com/quantsingularity/Optionix.git
cd Optionix
```

### Step 2: Run Setup Script

```bash
chmod +x scripts/setup_optionix_env.sh
./scripts/setup_optionix_env.sh
```

This script will:

- Check for required dependencies
- Create Python virtual environment
- Install backend dependencies
- Install frontend dependencies
- Set up basic configuration

### Step 3: Configure Environment

```bash
# Create environment file from template
cp .env.example .env

# Edit with your preferred editor
nano .env  # or vim, code, etc.
```

### Step 4: Start the Platform

```bash
chmod +x scripts/run_optionix.sh
./scripts/run_optionix.sh
```

The platform will be available at:

- **Web Frontend**: <http://localhost:3000>
- **Backend API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/docs>

## Manual Installation

For more control over the installation process, follow these steps:

### Backend Installation

```bash
# Navigate to project root
cd Optionix

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install backend dependencies
cd code
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
nano .env  # Configure your settings

# Initialize database (if using PostgreSQL)
cd backend
alembic upgrade head

# Start backend server
python run_backend.py
```

The backend API will be available at <http://localhost:8000>.

### Frontend Installation

```bash
# Navigate to frontend directory
cd web-frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
nano .env.local  # Set REACT_APP_API_URL=http://localhost:8000

# Start development server
npm start
```

The web frontend will be available at <http://localhost:3000>.

### Mobile Frontend Installation

```bash
# Navigate to mobile directory
cd mobile-frontend

# Install dependencies
npm install

# Start Expo development server
npm start

# Or run on specific platform
npm run android  # For Android
npm run ios      # For iOS
```

### Blockchain Setup

```bash
# Navigate to blockchain directory
cd code/blockchain

# Install Truffle/Hardhat dependencies
npm install

# Compile smart contracts
npx truffle compile

# Deploy to local network (Ganache)
npx truffle migrate --network development
```

## Docker Installation

Docker provides an isolated, reproducible environment:

### Using Docker Compose (Recommended)

```bash
# Clone and navigate to project
git clone https://github.com/quantsingularity/Optionix.git
cd Optionix

# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Individual Docker Images

```bash
# Build backend image
docker build -t optionix-backend -f infrastructure/Dockerfile .

# Run backend container
docker run -d -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:pass@localhost/optionix \
  optionix-backend

# Build frontend image
docker build -t optionix-frontend -f web-frontend/Dockerfile ./web-frontend

# Run frontend container
docker run -d -p 3000:3000 optionix-frontend
```

## Production Deployment

### Using Kubernetes

```bash
# Apply Kubernetes configurations
kubectl apply -f infrastructure/kubernetes/

# Check deployment status
kubectl get pods -n optionix

# Access services
kubectl get services -n optionix
```

### Using Terraform

```bash
# Navigate to Terraform directory
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply configuration
terraform apply
```

### Using Ansible

```bash
# Navigate to Ansible directory
cd infrastructure/ansible

# Update inventory
nano inventory/production.ini

# Run playbook
ansible-playbook -i inventory/production.ini playbooks/deploy.yml
```

## Platform-Specific Installation

### macOS

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python@3.11 node postgresql redis

# Follow Quick Installation steps above
```

### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install dependencies
sudo apt install -y python3.11 python3-pip nodejs npm postgresql redis-server

# Follow Quick Installation steps above
```

### Windows (WSL2)

```bash
# Install WSL2 with Ubuntu
wsl --install -d Ubuntu-22.04

# Inside WSL, install dependencies
sudo apt update
sudo apt install -y python3.11 python3-pip nodejs npm

# Follow Quick Installation steps above
```

### CentOS/RHEL

```bash
# Install EPEL repository
sudo yum install -y epel-release

# Install dependencies
sudo yum install -y python3.11 nodejs postgresql redis

# Follow Quick Installation steps above
```

## Installation Options Summary

| OS / Platform     | Recommended Install Command                                        | Notes                              |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------- |
| **Ubuntu 20.04+** | `./scripts/setup_optionix_env.sh`                                  | Full support, recommended platform |
| **macOS 11+**     | `brew install python@3.11 node && ./scripts/setup_optionix_env.sh` | Full support                       |
| **Windows 10/11** | Use WSL2 with Ubuntu, then `./scripts/setup_optionix_env.sh`       | WSL2 required                      |
| **Docker**        | `docker-compose up -d`                                             | Platform-independent, isolated     |
| **Kubernetes**    | `kubectl apply -f infrastructure/kubernetes/`                      | Production-ready                   |

## Verification

After installation, verify the setup:

```bash
# Check backend health
curl http://localhost:8000/health

# Expected response:
# {
#   "status": "healthy",
#   "version": "2.0.0",
#   "services": {
#     "database": "healthy",
#     "blockchain": "healthy",
#     "model": "healthy",
#     "redis": "healthy"
#   }
# }

# Check frontend
curl http://localhost:3000

# Run backend tests
cd code/backend
pytest

# Run frontend tests
cd web-frontend
npm test
```

## Next Steps

- [Configuration Guide](CONFIGURATION.md) - Configure environment variables and settings
- [Usage Guide](USAGE.md) - Learn basic usage patterns
- [API Reference](API.md) - Explore API endpoints

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common installation issues and solutions.

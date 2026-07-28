#!/bin/bash
# CI/CD Pipeline Script for Optionix
# This script automates the continuous integration and deployment process

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to display section headers
section_header() {
  echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Function to display step information
step_info() {
  echo -e "${BLUE}$1${NC}"
}

# Function to display success messages
step_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to display error messages
step_error() {
  echo -e "${RED}✗ $1${NC}"
  if [ "$2" = "exit" ]; then
    exit 1
  fi
}

# Check for required tools
check_requirements() {
  section_header "Checking Requirements"

  local missing_tools=0

  for tool in git docker npm python3; do
    if command_exists "$tool"; then
      step_success "$tool is installed"
    else
      step_error "$tool is not installed"
      missing_tools=$((missing_tools + 1))
    fi
  done

  if [ $missing_tools -gt 0 ]; then
    step_error "Please install the missing tools before proceeding" "exit"
  fi

  step_success "All required tools are installed"
}

# Parse command line arguments
parse_args() {
  # Default values
  ENVIRONMENT="development"
  SKIP_TESTS=false
  SKIP_LINT=false
  SKIP_BUILD=false
  SKIP_DEPLOY=false

  while [[ $# -gt 0 ]]; do
    case $1 in
      --environment=*)
        ENVIRONMENT="${1#*=}"
        shift
        ;;
      --skip-tests)
        SKIP_TESTS=true
        shift
        ;;
      --skip-lint)
        SKIP_LINT=true
        shift
        ;;
      --skip-build)
        SKIP_BUILD=true
        shift
        ;;
      --skip-deploy)
        SKIP_DEPLOY=true
        shift
        ;;
      --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --environment=ENV    Set deployment environment (development, staging, production)"
        echo "  --skip-tests         Skip running tests"
        echo "  --skip-lint          Skip linting"
        echo "  --skip-build         Skip build process"
        echo "  --skip-deploy        Skip deployment"
        echo "  --help               Show this help message"
        exit 0
        ;;
      *)
        step_error "Unknown option: $1" "exit"
        ;;
    esac
  done

  step_info "Environment: $ENVIRONMENT"
  [ "$SKIP_TESTS" = true ] && step_info "Tests will be skipped"
  [ "$SKIP_LINT" = true ] && step_info "Linting will be skipped"
  [ "$SKIP_BUILD" = true ] && step_info "Build will be skipped"
  [ "$SKIP_DEPLOY" = true ] && step_info "Deployment will be skipped"
}

# Checkout and update code
checkout_code() {
  section_header "Checking out code"

  if [ -d ".git" ]; then
    step_info "Git repository already exists, pulling latest changes"
    git pull
  else
    step_info "Cloning repository"
    git clone https://github.com/quantsingularity/Optionix.git .
  fi

  step_info "Current branch: $(git branch --show-current)"
  step_info "Latest commit: $(git log -1 --pretty=%B)"

  step_success "Code checkout complete"
}

# Run linting
run_lint() {
  if [ "$SKIP_LINT" = true ]; then
    step_info "Skipping linting as requested"
    return 0
  fi

  section_header "Running Linters"

  # Backend linting
  if [ -d "code/backend" ]; then
    step_info "Linting backend code"
    cd code/backend
    if command_exists flake8; then
      flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
    else
      step_info "flake8 not installed, skipping Python linting"
    fi
    cd - > /dev/null
  fi

  # Frontend linting
  if [ -d "web-frontend" ]; then
    step_info "Linting frontend code"
    cd web-frontend
    if [ -f "package.json" ] && grep -q '"lint"' package.json; then
      npm run lint || step_error "Frontend linting failed"
    else
      step_info "No lint script defined in web-frontend/package.json, skipping frontend linting"
    fi
    cd - > /dev/null
  fi

  # Mobile linting
  if [ -d "mobile-frontend" ]; then
    step_info "Linting mobile code"
    cd mobile-frontend
    if [ -f "package.json" ] && grep -q '"lint"' package.json; then
      npm run lint || step_error "Mobile linting failed"
    else
      step_info "No lint script defined in mobile-frontend/package.json, skipping mobile linting"
    fi
    cd - > /dev/null
  fi

  step_success "Linting complete"
}

# Run tests
run_tests() {
  if [ "$SKIP_TESTS" = true ]; then
    step_info "Skipping tests as requested"
    return 0
  fi

  section_header "Running Tests"

  # Run the comprehensive test script if it exists
  if [ -f "./scripts/comprehensive_test.sh" ]; then
    step_info "Running comprehensive test suite"
    bash ./scripts/comprehensive_test.sh
  else
    # Backend tests
    if [ -d "code/backend" ]; then
      step_info "Running backend tests"
      cd code/backend
      python -m pytest || step_error "Backend tests failed"
      cd - > /dev/null
    fi

    # Frontend tests
    if [ -d "web-frontend" ]; then
      step_info "Running frontend tests"
      cd web-frontend
      if [ -f "package.json" ]; then
        npm test || step_error "Frontend tests failed"
      else
        step_info "No package.json found, skipping frontend tests"
      fi
      cd - > /dev/null
    fi
  fi

  step_success "Tests complete"
}

# Build application
build_app() {
  if [ "$SKIP_BUILD" = true ]; then
    step_info "Skipping build as requested"
    return 0
  fi

  section_header "Building Application"

  # Backend build (if needed)
  if [ -d "code/backend" ]; then
    step_info "Preparing backend"
    cd code/backend
    if [ -f "requirements.txt" ]; then
      # Modern Debian/Ubuntu (PEP 668) refuses `pip install` outside a venv
      # unless --break-system-packages is passed; fall back without it for
      # older pip versions that don't recognize the flag.
      python -m pip install -r requirements.txt --break-system-packages 2>/dev/null || \
        python -m pip install -r requirements.txt
    fi
    cd - > /dev/null
  fi

  # Frontend build
  if [ -d "web-frontend" ]; then
    step_info "Building frontend"
    cd web-frontend
    if [ -f "package.json" ]; then
      npm ci
      npm run build
    else
      step_info "No package.json found, skipping frontend build"
    fi
    cd - > /dev/null
  fi

  # Mobile build
  if [ -d "mobile-frontend" ] && [ "$ENVIRONMENT" = "production" ]; then
    step_info "Building mobile app"
    cd mobile-frontend
    if [ -f "package.json" ]; then
      npm ci
      # Expo/React Native projects don't have a "build" script the way CRA
      # apps do — `expo export` produces a static bundle, which is the
      # closest equivalent to a production "build" step in CI.
      npx expo export --platform web --output-dir dist || \
        step_error "Mobile build failed"
    else
      step_info "No package.json found, skipping mobile build"
    fi
    cd - > /dev/null
  fi

  step_success "Build complete"
}

# Create Docker containers
create_containers() {
  if [ "$SKIP_BUILD" = true ]; then
    step_info "Skipping container creation as build is skipped"
    return 0
  fi

  section_header "Creating Docker Containers"

  if command_exists docker; then
    # Backend container
    if [ -f "code/backend/Dockerfile" ]; then
      step_info "Building backend container"
      docker build -t optionix-backend:latest code/backend
    else
      step_info "Creating default backend Dockerfile"
      cat > code/backend/Dockerfile << EOF
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
      docker build -t optionix-backend:latest code/backend
    fi

    # Frontend container
    # webpack.config.js outputs to dist/, not build/ (that's the
    # create-react-app convention, which this project doesn't use).
    if [ -d "web-frontend/dist" ]; then
      if [ -f "web-frontend/Dockerfile" ]; then
        step_info "Building frontend container"
        docker build -t optionix-frontend:latest web-frontend
      else
        step_info "Creating default frontend Dockerfile"
        cat > web-frontend/Dockerfile << EOF
FROM nginx:alpine

COPY dist/ /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF
        docker build -t optionix-frontend:latest web-frontend
      fi
    else
      step_info "Frontend build directory not found, skipping container creation"
    fi

    step_success "Container creation complete"
  else
    step_info "Docker not installed, skipping container creation"
  fi
}

# Deploy application
deploy_app() {
  if [ "$SKIP_DEPLOY" = true ]; then
    step_info "Skipping deployment as requested"
    return 0
  fi

  section_header "Deploying Application to $ENVIRONMENT"

  case $ENVIRONMENT in
    development)
      step_info "Deploying to development environment"
      # For development, we might just start the containers locally
      if command_exists docker-compose; then
        if [ -f "docker-compose.yml" ]; then
          docker-compose up -d
        else
          step_info "Creating docker-compose.yml"
          cat > docker-compose.yml << EOF
version: '3'

services:
  backend:
    image: optionix-backend:latest
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=development

  frontend:
    image: optionix-frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
EOF
          docker-compose up -d
        fi
      else
        step_info "docker-compose not installed, starting containers manually"
        docker run -d -p 8000:8000 --name optionix-backend optionix-backend:latest
        docker run -d -p 80:80 --name optionix-frontend optionix-frontend:latest
      fi
      ;;

    staging)
      step_info "Deploying to staging environment"
      # For staging, we might push to a staging server or Kubernetes cluster
      if [ -f "infrastructure/kubernetes/staging.yml" ]; then
        kubectl apply -f infrastructure/kubernetes/staging.yml
      else
        step_info "No Kubernetes configuration found for staging"
      fi
      ;;

    production)
      step_info "Deploying to production environment"
      # For production, we might use a more robust deployment strategy
      if [ -f "infrastructure/kubernetes/production.yml" ]; then
        kubectl apply -f infrastructure/kubernetes/production.yml
      else
        step_info "No Kubernetes configuration found for production"
      fi
      ;;

    *)
      step_error "Unknown environment: $ENVIRONMENT" "exit"
      ;;
  esac

  step_success "Deployment complete"
}

# Main function
main() {
  echo -e "${YELLOW}=== Optionix CI/CD Pipeline ===${NC}"
  echo -e "${BLUE}$(date)${NC}"

  # Parse command line arguments
  parse_args "$@"

  # Check requirements
  check_requirements

  # Start timer
  START_TIME=$(date +%s)

  # Run pipeline steps
  checkout_code
  run_lint
  run_tests
  build_app
  create_containers
  deploy_app

  # Calculate duration
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  # Print summary
  section_header "Pipeline Summary"
  echo -e "Environment: ${BLUE}${ENVIRONMENT}${NC}"
  echo -e "Duration: ${BLUE}${MINUTES}m ${SECONDS}s${NC}"
  echo -e "${GREEN}CI/CD pipeline completed successfully!${NC}"
}

# Run the main function with all arguments
main "$@"

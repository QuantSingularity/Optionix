#!/bin/bash
# Environment Setup Validator for Optionix
# This script validates and fixes the development environment setup

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
}

# Function to check and install Python dependencies
check_python_deps() {
  section_header "Checking Python Environment"

  # Check Python version
  if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    step_success "Python installed: $PYTHON_VERSION"

    # Check pip
    if command_exists pip3; then
      PIP_VERSION=$(pip3 --version)
      step_success "pip installed: $PIP_VERSION"
    else
      step_error "pip not found. Installing..."
      if command_exists apt; then
        sudo apt update && sudo apt install -y python3-pip
      elif command_exists brew; then
        brew install python3-pip
      else
        step_error "Could not install pip. Please install manually."
      fi
    fi

    # Check virtual environment
    if command_exists python3 && python3 -c "import venv" &>/dev/null; then
      step_success "Python venv module is available"
    else
      step_error "Python venv module not found. Installing..."
      if command_exists apt; then
        sudo apt update && sudo apt install -y python3-venv
      elif command_exists brew; then
        brew install python3-venv
      else
        step_error "Could not install venv. Please install manually."
      fi
    fi

    # Check if we're in a virtual environment
    if [ -n "$VIRTUAL_ENV" ]; then
      step_success "Currently in a virtual environment: $VIRTUAL_ENV"
    else
      step_info "Not currently in a virtual environment"

      # Check if venv directory exists
      if [ -d "venv" ]; then
        step_info "Virtual environment directory exists, activating..."
        source venv/bin/activate || source venv/Scripts/activate
        step_success "Virtual environment activated"
      else
        step_info "Creating new virtual environment..."
        python3 -m venv venv
        source venv/bin/activate || source venv/Scripts/activate
        step_success "Virtual environment created and activated"
      fi
    fi

    # Install backend dependencies if requirements.txt exists
    if [ -f "code/backend/requirements.txt" ]; then
      step_info "Installing backend dependencies..."
      pip3 install -r code/backend/requirements.txt
      step_success "Backend dependencies installed"
    else
      step_error "Backend requirements.txt not found"
    fi

    # Install AI model dependencies if requirements.txt exists
    if [ -f "code/ai_models/requirements.txt" ]; then
      step_info "Installing AI model dependencies..."
      pip3 install -r code/ai_models/requirements.txt
      step_success "AI model dependencies installed"
    fi
  else
    step_error "Python 3 not found. Please install Python 3.6 or higher."
  fi
}

# Function to check and install Node.js dependencies
check_node_deps() {
  section_header "Checking Node.js Environment"

  # Check Node.js
  if command_exists node; then
    NODE_VERSION=$(node --version)
    step_success "Node.js installed: $NODE_VERSION"

    # Check npm
    if command_exists npm; then
      NPM_VERSION=$(npm --version)
      step_success "npm installed: $NPM_VERSION"

      # Install frontend dependencies
      if [ -f "web-frontend/package.json" ]; then
        step_info "Installing frontend dependencies..."
        cd web-frontend
        npm install
        cd - > /dev/null
        step_success "Frontend dependencies installed"
      else
        step_error "Frontend package.json not found"
      fi

      # Install mobile dependencies
      if [ -f "mobile-frontend/package.json" ]; then
        step_info "Installing mobile dependencies..."
        cd mobile-frontend
        npm install
        cd - > /dev/null
        step_success "Mobile dependencies installed"
      else
        step_error "Mobile package.json not found"
      fi

      # Install blockchain dependencies
      if [ -f "code/blockchain/package.json" ]; then
        step_info "Installing blockchain dependencies..."
        cd code/blockchain
        npm install
        cd - > /dev/null
        step_success "Blockchain dependencies installed"
      fi
    else
      step_error "npm not found. Please install npm."
    fi
  else
    step_error "Node.js not found. Please install Node.js 14 or higher."
  fi
}

# Function to check and install Docker
check_docker() {
  section_header "Checking Docker Environment"

  # Check Docker
  if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    step_success "Docker installed: $DOCKER_VERSION"

    # Check Docker Compose
    if command_exists docker-compose; then
      COMPOSE_VERSION=$(docker-compose --version)
      step_success "Docker Compose installed: $COMPOSE_VERSION"
    else
      step_error "Docker Compose not found. Installing..."
      if command_exists apt; then
        sudo apt update && sudo apt install -y docker-compose
      elif command_exists brew; then
        brew install docker-compose
      else
        step_error "Could not install Docker Compose. Please install manually."
      fi
    fi

    # Check if Docker daemon is running
    if docker info &>/dev/null; then
      step_success "Docker daemon is running"
    else
      step_error "Docker daemon is not running. Please start Docker."
    fi
  else
    step_error "Docker not found. Please install Docker."
  fi
}

# Function to check and install database
check_database() {
  section_header "Checking Database Environment"

  # Check PostgreSQL
  if command_exists psql; then
    PSQL_VERSION=$(psql --version)
    step_success "PostgreSQL client installed: $PSQL_VERSION"
  else
    step_error "PostgreSQL client not found. Installing..."
    if command_exists apt; then
      sudo apt update && sudo apt install -y postgresql-client
    elif command_exists brew; then
      brew install postgresql
    else
      step_error "Could not install PostgreSQL client. Please install manually."
    fi
  fi

  # Check if PostgreSQL server is running
  if command_exists pg_isready && pg_isready &>/dev/null; then
    step_success "PostgreSQL server is running"
  else
    step_info "PostgreSQL server is not running or not installed locally"
    step_info "Checking for Docker PostgreSQL container..."

    if command_exists docker && docker ps | grep -q postgres; then
      step_success "PostgreSQL Docker container is running"
    else
      step_info "Starting PostgreSQL Docker container..."
      if command_exists docker; then
        docker run -d --name optionix-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:13
        step_success "PostgreSQL Docker container started"
      else
        step_error "Could not start PostgreSQL. Please install PostgreSQL or Docker."
      fi
    fi
  fi

  # Check Redis
  if command_exists redis-cli; then
    REDIS_VERSION=$(redis-cli --version)
    step_success "Redis client installed: $REDIS_VERSION"
  else
    step_error "Redis client not found. Installing..."
    if command_exists apt; then
      sudo apt update && sudo apt install -y redis-tools
    elif command_exists brew; then
      brew install redis
    else
      step_error "Could not install Redis client. Please install manually."
    fi
  fi

  # Check if Redis server is running
  if command_exists redis-cli && redis-cli ping &>/dev/null; then
    step_success "Redis server is running"
  else
    step_info "Redis server is not running or not installed locally"
    step_info "Checking for Docker Redis container..."

    if command_exists docker && docker ps | grep -q redis; then
      step_success "Redis Docker container is running"
    else
      step_info "Starting Redis Docker container..."
      if command_exists docker; then
        docker run -d --name optionix-redis -p 6379:6379 redis:6
        step_success "Redis Docker container started"
      else
        step_error "Could not start Redis. Please install Redis or Docker."
      fi
    fi
  fi
}

# Function to check and configure Git
check_git() {
  section_header "Checking Git Configuration"

  # Check Git
  if command_exists git; then
    GIT_VERSION=$(git --version)
    step_success "Git installed: $GIT_VERSION"

    # Check Git configuration
    if git config --get user.name &>/dev/null && git config --get user.email &>/dev/null; then
      GIT_USER=$(git config --get user.name)
      GIT_EMAIL=$(git config --get user.email)
      step_success "Git configured for user: $GIT_USER <$GIT_EMAIL>"
    else
      step_error "Git user not configured. Please configure with:"
      echo "  git config --global user.name \"Your Name\""
      echo "  git config --global user.email \"your.email@example.com\""
    fi

    # Check if this is a Git repository
    if [ -d ".git" ]; then
      step_success "Current directory is a Git repository"

      # Check remote
      if git remote -v | grep -q origin; then
        REMOTE_URL=$(git remote get-url origin)
        step_success "Git remote configured: $REMOTE_URL"
      else
        step_error "Git remote not configured. Please add a remote with:"
        echo "  git remote add origin https://github.com/quantsingularity/Optionix.git"
      fi
    else
      step_error "Current directory is not a Git repository. Initialize with:"
      echo "  git init"
      echo "  git remote add origin https://github.com/quantsingularity/Optionix.git"
    fi
  else
    step_error "Git not found. Please install Git."
  fi
}

# Function to validate project structure
validate_project_structure() {
  section_header "Validating Project Structure"

  # Check if we're in the project root
  if [ -f "README.md" ] && [ -d "code" ]; then
    step_success "Current directory appears to be the project root"
  else
    step_error "Current directory does not appear to be the project root"

    # Try to find the project root
    if [ -d "../Optionix" ]; then
      step_info "Project root found at ../Optionix, changing directory..."
      cd ../Optionix
    elif [ -d "Optionix" ]; then
      step_info "Project root found at ./Optionix, changing directory..."
      cd Optionix
    else
      step_error "Could not locate project root. Please navigate to the project root directory."
      return 1
    fi
  fi

  # Check required directories
  for dir in code code/backend web-frontend; do
    if [ -d "$dir" ]; then
      step_success "Required directory exists: $dir"
    else
      step_error "Required directory missing: $dir"
      mkdir -p "$dir"
      step_info "Created directory: $dir"
    fi
  done

  # Check optional directories
  for dir in code/ai_models code/blockchain mobile-frontend docs infrastructure resources; do
    if [ -d "$dir" ]; then
      step_success "Optional directory exists: $dir"
    else
      step_info "Optional directory missing: $dir"
      mkdir -p "$dir"
      step_info "Created directory: $dir"
    fi
  done

  # Check required files
  for file in README.md .gitignore; do
    if [ -f "$file" ]; then
      step_success "Required file exists: $file"
    else
      step_error "Required file missing: $file"
      touch "$file"
      step_info "Created empty file: $file"
    fi
  done

  return 0
}

# Function to create missing scripts
create_missing_scripts() {
  section_header "Creating Missing Scripts"

  # Check and create setup script
  if [ ! -f "setup_optionix_env.sh" ]; then
    step_info "Creating setup_optionix_env.sh..."
    cat > setup_optionix_env.sh << 'EOF'
#!/bin/bash
# Optionix Project Setup Script

set -e

echo "Starting Optionix project setup..."

# Create Python virtual environment
if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate || source venv/Scripts/activate

# Install backend dependencies
if [ -d "code/backend" ]; then
  echo "Installing backend dependencies..."
  cd code/backend
  pip install -r requirements.txt
  cd ../..
fi

# Install frontend dependencies
if [ -d "web-frontend" ]; then
  echo "Installing frontend dependencies..."
  cd web-frontend
  npm install
  cd ..
fi

# Install mobile dependencies
if [ -d "mobile-frontend" ]; then
  echo "Installing mobile dependencies..."
  cd mobile-frontend
  npm install
  cd ..
fi

echo "Setup completed successfully!"
EOF
    chmod +x setup_optionix_env.sh
    step_success "Created setup_optionix_env.sh"
  else
    step_success "setup_optionix_env.sh already exists"
  fi

  # Check and create run script
  if [ ! -f "run_optionix.sh" ]; then
    step_info "Creating run_optionix.sh..."
    cat > run_optionix.sh << 'EOF'
#!/bin/bash
# Run script for Optionix project

set -e

echo "Starting Optionix application..."

# Activate virtual environment
source venv/bin/activate || source venv/Scripts/activate

# Start backend server
echo "Starting backend server..."
cd code/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ../..

# Wait for backend to initialize
echo "Waiting for backend to initialize..."
sleep 5

# Start frontend development server
echo "Starting frontend server..."
cd web-frontend
npm start
cd ..

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT

echo "Application started successfully!"
EOF
    chmod +x run_optionix.sh
    step_success "Created run_optionix.sh"
  else
    step_success "run_optionix.sh already exists"
  fi

  # Check and create lint script
  if [ ! -f "lint-all.sh" ]; then
    step_info "Creating lint-all.sh..."
    cat > lint-all.sh << 'EOF'
#!/bin/bash
# Linting and Fixing Script for Optionix Project

set -e

echo "Starting linting and fixing process for Optionix..."

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for Python linting tools
if command_exists flake8; then
  echo "Running Python linting..."
  find code/backend code/ai_models -name "*.py" -exec flake8 {} \;
else
  echo "flake8 not found. Install with: pip install flake8"
fi

# Check for JavaScript/TypeScript linting tools
if [ -d "web-frontend" ]; then
  cd web-frontend
  if [ -f "package.json" ]; then
    echo "Running frontend linting..."
    npm run lint
  fi
  cd ..
fi

if [ -d "mobile-frontend" ]; then
  cd mobile-frontend
  if [ -f "package.json" ]; then
    echo "Running mobile app linting..."
    npm run lint
  fi
  cd ..
fi

echo "Linting process completed!"
EOF
    chmod +x lint-all.sh
    step_success "Created lint-all.sh"
  else
    step_success "lint-all.sh already exists"
  fi

  # Check and create test script
  if [ ! -f "test_backend.sh" ]; then
    step_info "Creating test_backend.sh..."
    cat > test_backend.sh << 'EOF'
#!/bin/bash
# Start the backend server

echo "Starting backend server..."
cd code/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Test backend endpoints
echo "Testing backend endpoints..."
echo "1. Testing root endpoint"
curl -s http://localhost:8000/ | grep "Welcome to Optionix API"

echo "2. Testing volatility prediction endpoint"
curl -s -X POST http://localhost:8000/market/volatility \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTC-USD", "open": 42500, "high": 43000, "low": 42000, "volume": 1000000}'

# Kill the backend process when done
echo "Stopping backend server..."
kill $BACKEND_PID

echo "Backend API tests completed."
EOF
    chmod +x test_backend.sh
    step_success "Created test_backend.sh"
  else
    step_success "test_backend.sh already exists"
  fi
}

# Function to check for Docker Compose configuration
check_docker_compose() {
  section_header "Checking Docker Compose Configuration"

  if [ ! -f "docker-compose.yml" ]; then
    step_info "Creating docker-compose.yml..."
    cat > docker-compose.yml << 'EOF'
version: '3'

services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_USER: postgres
      POSTGRES_DB: optionix
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6
    ports:
      - "6379:6379"

  backend:
    build: ./code/backend
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/optionix
      - REDIS_URL=redis://redis:6379/0

  frontend:
    build: ./web-frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
EOF
    step_success "Created docker-compose.yml"
  else
    step_success "docker-compose.yml already exists"
  fi
}

# Main function
main() {
  echo -e "${YELLOW}=== Optionix Environment Validator ===${NC}"
  echo -e "${BLUE}$(date)${NC}"

  # Resolve the project root relative to this script's location (not the
  # caller's CWD) so this works whether invoked as `./scripts/env_validator.sh`
  # from the repo root or as `./env_validator.sh` from within scripts/ itself.
  # Every path check in this script (code/backend, web-frontend, etc.) is
  # relative to the project root.
  PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$PROJECT_ROOT"
  step_info "Working from project root: $PROJECT_ROOT"

  # Validate project structure first
  validate_project_structure || exit 1

  # Check all components
  check_git
  check_python_deps
  check_node_deps
  check_docker
  check_database

  # Create missing scripts and configurations
  create_missing_scripts
  check_docker_compose

  # Print summary
  section_header "Environment Validation Summary"
  echo -e "${GREEN}Environment validation completed!${NC}"
  echo -e "The development environment has been checked and configured for Optionix."
  echo -e "You can now proceed with development."
}

# Run the main function
main

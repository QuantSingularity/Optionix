#!/bin/bash

# Optionix Project Setup Script (Comprehensive)

# Set up robust error handling
# -e: Exit immediately if a command exits with a non-zero status.
# -u: Treat unset variables as an error.
# -o pipefail: Causes a pipeline to return the exit status of the last command in the pipe that returned a non-zero exit code.
set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Optionix project setup...${NC}"

# Determine the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"
echo -e "${BLUE}Changed directory to $(pwd)${NC}"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# --- Prerequisites Check ---
echo -e "\n${BLUE}Checking prerequisites...${NC}"
if ! command_exists python3; then
  echo -e "${RED}Error: python3 is required but not installed. Please install Python 3.${NC}"
  exit 1
fi
if ! command_exists pip3; then
  echo -e "${RED}Error: pip3 is required but not installed. Please install pip3.${NC}"
  exit 1
fi
if ! command_exists node; then
  echo -e "${RED}Error: node is required but not installed. Please install Node.js.${NC}"
  exit 1
fi
if ! command_exists npm; then
  echo -e "${RED}Error: npm is required but not installed. Please install npm.${NC}"
  exit 1
fi
echo -e "${GREEN}All required tools found.${NC}"

# --- Backend Setup (FastAPI/Python) ---
echo -e "\n${BLUE}Setting up Optionix Backend...${NC}"
BACKEND_DIR="code/backend"
VENV_DIR="venv"

if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory $BACKEND_DIR not found. Skipping backend setup.${NC}"
else
    echo -e "${BLUE}Creating Python virtual environment at $VENV_DIR...${NC}"
    # Use the system's python3 to create the venv in the project root
    python3 -m venv "$VENV_DIR"
    
    # Activate venv and install dependencies
    source "$VENV_DIR/bin/activate"
    echo -e "${GREEN}Python virtual environment created and activated.${NC}"

    REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"
    if [ ! -f "$REQUIREMENTS_FILE" ]; then
        echo -e "${RED}Error: requirements.txt not found in $BACKEND_DIR. Cannot install backend dependencies.${NC}"
    else
        echo -e "${BLUE}Installing backend Python dependencies from $REQUIREMENTS_FILE...${NC}"
        pip3 install -r "$REQUIREMENTS_FILE"
        echo -e "${GREEN}Backend dependencies installed.${NC}"
    fi
    
    deactivate
    echo -e "${GREEN}Python virtual environment deactivated.${NC}"
    echo -e "${BLUE}To activate the backend virtual environment later, run: source $VENV_DIR/bin/activate${NC}"
fi

# --- Frontend Setup (React/Node.js) ---
echo -e "\n${BLUE}Setting up Optionix Web Frontend...${NC}"
FRONTEND_DIR="web-frontend" # Using web-frontend as per ls output

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: Frontend directory $FRONTEND_DIR not found. Skipping frontend setup.${NC}"
else
    cd "$FRONTEND_DIR"
    echo -e "${BLUE}Changed directory to $(pwd) for frontend setup.${NC}"

    PACKAGE_FILE="package.json"
    if [ ! -f "$PACKAGE_FILE" ]; then
        echo -e "${RED}Error: $PACKAGE_FILE not found in $FRONTEND_DIR. Cannot install frontend dependencies.${NC}"
    else
        echo -e "${BLUE}Installing frontend Node.js dependencies using npm...${NC}"
        # Using npm as it was in the original script, but pnpm/yarn is often faster
        npm install
        echo -e "${GREEN}Frontend dependencies installed.${NC}"
    fi
    
    cd "$PROJECT_ROOT" # Return to the main project directory
fi

# --- Mobile Frontend Setup (React Native/Expo) ---
echo -e "\n${BLUE}Setting up Optionix Mobile Frontend...${NC}"
MOBILE_DIR="mobile-frontend"

if [ ! -d "$MOBILE_DIR" ]; then
    echo -e "${RED}Error: Mobile frontend directory $MOBILE_DIR not found. Skipping mobile setup.${NC}"
else
    cd "$MOBILE_DIR"
    echo -e "${BLUE}Changed directory to $(pwd) for mobile setup.${NC}"

    MOBILE_PACKAGE_FILE="package.json"
    if [ ! -f "$MOBILE_PACKAGE_FILE" ]; then
        echo -e "${RED}Error: $MOBILE_PACKAGE_FILE not found in $MOBILE_DIR. Cannot install mobile dependencies.${NC}"
    else
        echo -e "${BLUE}Installing mobile Node.js dependencies using npm...${NC}"
        npm install
        echo -e "${GREEN}Mobile dependencies installed.${NC}"
    fi

    cd "$PROJECT_ROOT" # Return to the main project directory
fi

# --- AI Models & Blockchain components (Placeholder) ---
echo -e "\n${BLUE}Notes on other components (AI Models, Blockchain):${NC}"
AI_MODELS_DIR="code/ai_models"
BLOCKCHAIN_DIR="code/blockchain"

if [ -d "$AI_MODELS_DIR" ]; then
    echo -e "- Quantitative/AI Models directory exists at $AI_MODELS_DIR. Dependencies should be installed in the main venv."
fi

if [ -d "$BLOCKCHAIN_DIR" ]; then
    echo -e "- Blockchain directory exists at $BLOCKCHAIN_DIR. Check for specific setup instructions (e.g., Hardhat/Truffle) within it."
    if [ -f "$BLOCKCHAIN_DIR/package.json" ]; then
        echo -e "  ${BLUE}Installing Blockchain Node.js dependencies...${NC}"
        cd "$BLOCKCHAIN_DIR"
        npm install
        cd "$PROJECT_ROOT"
        echo -e "  ${GREEN}Blockchain dependencies installed.${NC}"
    fi
fi

echo -e "\n${GREEN}Optionix project setup script finished.${NC}"
echo "To run the application, use: ./scripts/run_optionix.sh"

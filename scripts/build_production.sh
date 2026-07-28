#!/bin/bash

# Build script for Optionix project (Production)
# This script builds the frontend, blockchain contracts, and prepares the backend for deployment.

# Set up robust error handling
set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${BLUE}Starting Optionix production build process...${NC}"

# Change to project root
cd "$PROJECT_ROOT"

# --- 1. Frontend Build ---
echo -e "\n${BLUE}1. Building Web Frontend for production...${NC}"
FRONTEND_DIR="web-frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}Error: Frontend directory $FRONTEND_DIR not found. Skipping frontend build.${NC}"
else
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}Error: Frontend dependencies not installed. Please run ./scripts/setup_optionix_env.sh first.${NC}"
        cd "$PROJECT_ROOT"
        exit 1
    fi
    
    # Assuming 'npm run build' is the standard build command
    npm run build
    echo -e "${GREEN}Web Frontend build completed successfully.${NC}"
    cd "$PROJECT_ROOT"
fi

# --- 2. Blockchain Contracts Compilation ---
echo -e "\n${BLUE}2. Compiling Blockchain Contracts...${NC}"
BLOCKCHAIN_DIR="code/blockchain"

if [ ! -d "$BLOCKCHAIN_DIR" ]; then
    echo -e "${RED}Warning: Blockchain directory $BLOCKCHAIN_DIR not found. Skipping contract compilation.${NC}"
else
    cd "$BLOCKCHAIN_DIR"
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}Warning: Blockchain dependencies not installed. Please run ./scripts/setup_optionix_env.sh first.${NC}"
    else
        # Assuming a standard Hardhat/Truffle compile command
        # Check for hardhat.config.js or truffle-config.js to decide
        if [ -f "hardhat.config.js" ] || [ -f "hardhat.config.ts" ]; then
            npx hardhat compile
            echo -e "${GREEN}Hardhat contracts compiled successfully.${NC}"
        elif [ -f "truffle-config.js" ]; then
            npx truffle compile
            echo -e "${GREEN}Truffle contracts compiled successfully.${NC}"
        else
            echo -e "${RED}Warning: No standard Hardhat or Truffle config found. Skipping contract compilation.${NC}"
        fi
    fi
    cd "$PROJECT_ROOT"
fi

# --- 3. Backend Docker Image Build ---
echo -e "\n${BLUE}3. Building Backend Docker Image...${NC}"
BACKEND_DIR="code/backend"

if [ ! -f "$BACKEND_DIR/Dockerfile" ]; then
    echo -e "${RED}Warning: Dockerfile not found in $BACKEND_DIR. Skipping Docker image build.${NC}"
else
    # Use the current date/time as a tag
    TAG="optionix-backend:$(date +%Y%m%d%H%M%S)"
    
    # Build the Docker image
    docker build -t "$TAG" "$BACKEND_DIR"
    
    echo -e "${GREEN}Backend Docker image built successfully with tag: $TAG${NC}"
fi

echo -e "\n${GREEN}Optionix production build process finished.${NC}"
echo "The production assets are ready for deployment."

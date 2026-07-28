#!/bin/bash

# Clean script for Optionix project
# This script removes generated files, build artifacts, and installed dependencies.

# Set up robust error handling
set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${BLUE}Starting Optionix project cleanup...${NC}"

# Report failures in red instead of bash's raw error output if any step below
# fails unexpectedly (e.g. permission-denied on rm -rf).
on_error() {
  echo -e "${RED}Cleanup failed while removing something above. Check permissions and try again.${NC}"
}
trap on_error ERR

# Change to project root
cd "$PROJECT_ROOT"

# --- 1. Remove Python Virtual Environment ---
echo -e "\n${BLUE}1. Removing Python Virtual Environment (venv)...${NC}"
if [ -d "venv" ]; then
    rm -rf venv
    echo -e "${GREEN}Removed venv directory.${NC}"
else
    echo -e "${BLUE}venv directory not found. Skipping.${NC}"
fi

# --- 2. Remove Node.js Dependencies (node_modules) ---
echo -e "\n${BLUE}2. Removing Node.js Dependencies (node_modules)...${NC}"

# Web frontend
FRONTEND_DIR="web-frontend"
if [ -d "$FRONTEND_DIR/node_modules" ]; then
    rm -rf "$FRONTEND_DIR/node_modules"
    echo -e "${GREEN}Removed $FRONTEND_DIR/node_modules.${NC}"
else
    echo -e "${BLUE}$FRONTEND_DIR/node_modules not found. Skipping.${NC}"
fi

# Mobile frontend
MOBILE_DIR="mobile-frontend"
if [ -d "$MOBILE_DIR/node_modules" ]; then
    rm -rf "$MOBILE_DIR/node_modules"
    echo -e "${GREEN}Removed $MOBILE_DIR/node_modules.${NC}"
else
    echo -e "${BLUE}$MOBILE_DIR/node_modules not found. Skipping.${NC}"
fi

# Blockchain
BLOCKCHAIN_DIR="code/blockchain"
if [ -d "$BLOCKCHAIN_DIR/node_modules" ]; then
    rm -rf "$BLOCKCHAIN_DIR/node_modules"
    echo -e "${GREEN}Removed $BLOCKCHAIN_DIR/node_modules.${NC}"
else
    echo -e "${BLUE}$BLOCKCHAIN_DIR/node_modules not found. Skipping.${NC}"
fi

# --- 3. Remove Build Artifacts ---
echo -e "\n${BLUE}3. Removing Build Artifacts...${NC}"

# Web frontend build output (assuming 'dist' or 'build')
if [ -d "$FRONTEND_DIR/dist" ]; then
    rm -rf "$FRONTEND_DIR/dist"
    echo -e "${GREEN}Removed $FRONTEND_DIR/dist.${NC}"
fi
if [ -d "$FRONTEND_DIR/build" ]; then
    rm -rf "$FRONTEND_DIR/build"
    echo -e "${GREEN}Removed $FRONTEND_DIR/build.${NC}"
fi

# Mobile frontend build/cache output (Expo)
if [ -d "$MOBILE_DIR/.expo" ]; then
    rm -rf "$MOBILE_DIR/.expo"
    echo -e "${GREEN}Removed $MOBILE_DIR/.expo.${NC}"
fi
if [ -d "$MOBILE_DIR/dist" ]; then
    rm -rf "$MOBILE_DIR/dist"
    echo -e "${GREEN}Removed $MOBILE_DIR/dist.${NC}"
fi

# Blockchain artifacts (e.g., Hardhat/Truffle artifacts)
if [ -d "$BLOCKCHAIN_DIR/artifacts" ]; then
    rm -rf "$BLOCKCHAIN_DIR/artifacts"
    echo -e "${GREEN}Removed $BLOCKCHAIN_DIR/artifacts.${NC}"
fi
if [ -d "$BLOCKCHAIN_DIR/cache" ]; then
    rm -rf "$BLOCKCHAIN_DIR/cache"
    echo -e "${GREEN}Removed $BLOCKCHAIN_DIR/cache.${NC}"
fi

# --- 4. Remove Python bytecode/test caches ---
echo -e "\n${BLUE}4. Removing Python bytecode and test caches...${NC}"
find code/backend -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -prune -exec rm -rf {} + 2>/dev/null || true
echo -e "${GREEN}Removed __pycache__/.pytest_cache directories under code/backend.${NC}"

# --- 5. Remove Configuration Files Created by Linting Script ---
echo -e "\n${BLUE}5. Removing generated configuration files...${NC}"
CONFIG_FILES=(".eslintrc.js" ".prettierrc.json" ".solhint.json")
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo -e "${GREEN}Removed $file.${NC}"
    fi
done

echo -e "\n${GREEN}Optionix project cleanup finished.${NC}"
echo "The project is now clean of build artifacts and dependencies."

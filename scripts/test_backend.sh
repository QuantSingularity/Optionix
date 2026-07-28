#!/bin/bash

# Backend API Test Script for Optionix

# Set up robust error handling
set -euo pipefail

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/code/backend"
VENV_DIR="$PROJECT_ROOT/venv"
BACKEND_PORT=8000
BACKEND_URL="http://localhost:$BACKEND_PORT"

echo -e "${BLUE}Starting backend server for testing...${NC}"

# Check for venv
if [ ! -d "$VENV_DIR" ]; then
  echo -e "${RED}Error: Python virtual environment not found at $VENV_DIR.${NC}"
  echo -e "${RED}Please run the setup script first: ./scripts/setup_optionix_env.sh${NC}"
  exit 1
fi

# Activate venv and start server
cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

# Start the backend server in the background
# Use uvicorn directly
uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID: ${BACKEND_PID}${NC}"

# Make sure the backend is always stopped, even if a test below fails and
# `set -e` exits the script early — otherwise BACKEND_PID leaks as an
# orphaned background process.
cleanup() {
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "\n${BLUE}Stopping backend server (PID: $BACKEND_PID)...${NC}"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Wait for the backend to actually be ready instead of guessing a fixed
# sleep duration (which can flake on slower first-boot imports).
echo -e "${BLUE}Waiting for backend to initialize...${NC}"
READY=false
for _attempt in $(seq 1 30); do
  if curl -s -o /dev/null "$BACKEND_URL/health"; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" != true ]; then
  echo -e "${RED}Error: Backend did not become ready within 30 seconds.${NC}"
  exit 1
fi

# --- Test backend endpoints ---
echo -e "\n${BLUE}Testing backend endpoints...${NC}"
TEST_FAILURES=0

# 1. Testing root endpoint
echo -e "${BLUE}1. Testing root endpoint ($BACKEND_URL/)...${NC}"
RESPONSE=$(curl -s "$BACKEND_URL/" || true)
if echo "$RESPONSE" | grep -q "Welcome to Optionix API"; then
  echo -e "${GREEN}PASS: Root endpoint returned expected welcome message.${NC}"
else
  echo -e "${RED}FAIL: Root endpoint test failed. Response: $RESPONSE${NC}"
  TEST_FAILURES=$((TEST_FAILURES + 1))
fi

# 2. Testing volatility prediction endpoint
# Real route is POST /market/volatility (not /predict_volatility) and
# requires a "symbol" field.
echo -e "${BLUE}2. Testing volatility prediction endpoint ($BACKEND_URL/market/volatility)...${NC}"
PREDICTION_DATA='{"symbol": "BTC-USD", "open": 42500, "high": 43000, "low": 42000, "volume": 1000000}'
RESPONSE=$(curl -s -X POST "$BACKEND_URL/market/volatility" \
  -H "Content-Type: application/json" \
  -d "$PREDICTION_DATA" || true)

# The response contains a "volatility" field with the predicted value.
if echo "$RESPONSE" | grep -q "volatility"; then
  echo -e "${GREEN}PASS: Volatility prediction endpoint returned a prediction.${NC}"
  echo "Response: $RESPONSE"
else
  echo -e "${RED}FAIL: Volatility prediction endpoint test failed. Response: $RESPONSE${NC}"
  TEST_FAILURES=$((TEST_FAILURES + 1))
fi

# --- Final Result ---
if [ "$TEST_FAILURES" -eq 0 ]; then
  echo -e "\n${GREEN}Backend API tests completed successfully! (0 failures)${NC}"
else
  echo -e "\n${RED}Backend API tests completed with $TEST_FAILURES failure(s).${NC}"
  exit 1
fi

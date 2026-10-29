#!/bin/bash

# Run script for Optionix project
# This script starts both the backend and frontend components

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

# Determine the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${BLUE}Starting Optionix application...${NC}"

# --- Configuration Check ---
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo -e "${RED}Warning: .env file not found! Copy env.example to .env and configure it.${NC}"
  # Continue, but warn the user
fi

# --- Backend Setup and Start ---
BACKEND_DIR="$PROJECT_ROOT/code/backend"
VENV_DIR="$PROJECT_ROOT/venv"

if [ ! -d "$VENV_DIR" ]; then
  echo -e "${RED}Error: Python virtual environment not found at $VENV_DIR.${NC}"
  echo -e "${RED}Please run the setup script first: ./scripts/setup_optionix_env.sh${NC}"
  exit 1
fi

echo -e "${BLUE}Starting backend server...${NC}"
# Change to backend directory and activate venv
cd "$BACKEND_DIR"
source "$VENV_DIR/bin/activate"

# Run the backend server in the background
# Use uvicorn directly as it's a standard practice for FastAPI
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}Backend started with PID: ${BACKEND_PID}${NC}"

# Wait for backend to initialize (simple check)
echo -e "${BLUE}Waiting for backend to initialize...${NC}"
sleep 5

# --- Frontend Setup and Start ---
FRONTEND_DIR="$PROJECT_ROOT/web-frontend" # Using web-frontend as per ls output
FRONTEND_PID="" # Default to empty; only set if the frontend actually starts,
                 # so cleanup() below doesn't fail on an unbound variable
                 # under `set -u` if this branch is skipped entirely.

if [ ! -d "$FRONTEND_DIR" ]; then
  echo -e "${RED}Error: Frontend directory not found at $FRONTEND_DIR.${NC}"
  # Continue, but warn the user
else
  echo -e "${BLUE}Starting frontend...${NC}"
  cd "$FRONTEND_DIR"
  
  # Check if node_modules exists, if not, prompt user to run setup
  if [ ! -d "node_modules" ]; then
    echo -e "${RED}Error: Frontend dependencies not installed.${NC}"
    echo -e "${RED}Please run the setup script first: ./scripts/setup_optionix_env.sh${NC}"
    # Change back to project root before exiting
    cd "$PROJECT_ROOT"
    exit 1
  fi

  # Use pnpm for starting the frontend (assuming pnpm is used for install)
  # The original used 'npm start', we'll stick to that but recommend pnpm in setup
  npm start &
  FRONTEND_PID=$!
  echo -e "${GREEN}Frontend started with PID: ${FRONTEND_PID}${NC}"
fi

# Change back to project root
cd "$PROJECT_ROOT"

echo -e "${GREEN}Optionix application is running!${NC}"
echo -e "${GREEN}Access the application at: http://localhost:3000${NC}"
echo -e "${BLUE}Press Ctrl+C to stop all services${NC}"

# Handle graceful shutdown
cleanup() {
  echo -e "\n${BLUE}Stopping services...${NC}"
  
  # Kill frontend process if it exists
  if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID"
    echo -e "${GREEN}Frontend service (PID: $FRONTEND_PID) stopped.${NC}"
  fi
  
  # Kill backend process if it exists
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID"
    echo -e "${GREEN}Backend service (PID: $BACKEND_PID) stopped.${NC}"
  fi
  
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM for cleanup
trap cleanup SIGINT SIGTERM

# Keep script running
wait

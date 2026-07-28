#!/bin/bash
# Comprehensive Testing Script for Optionix
# This script runs all tests across backend, frontend, mobile, and performs end-to-end testing

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

# Function to run tests with proper formatting and error handling
run_test() {
  local test_name="$1"
  local test_command="$2"

  echo -e "${BLUE}Running ${test_name}...${NC}"

  # Run in a subshell (the parens) so that any `cd` inside test_command is
  # local to this invocation and can't leak into the parent script's CWD —
  # without this, every subsequent test that also does `cd code/backend`
  # (etc.) would compound and fail once CWD has already moved.
  if (eval "$test_command"); then
    echo -e "${GREEN}✓ ${test_name} passed${NC}"
    return 0
  else
    echo -e "${RED}✗ ${test_name} failed${NC}"
    return 1
  fi
}

# Create test results directory
RESULTS_DIR="./test_results"
mkdir -p "$RESULTS_DIR"
echo -e "${BLUE}Test results will be saved to ${RESULTS_DIR}${NC}"

# Start test suite
echo -e "${YELLOW}=== Starting Optionix Comprehensive Test Suite ===${NC}"
echo -e "${BLUE}$(date)${NC}"
echo

# Record test start time
TEST_START_TIME=$(date +%s)

# Initialize test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Backend Tests
echo -e "${YELLOW}=== Backend Tests ===${NC}"

# Check if we're in the project root, if not try to find it
if [ ! -d "./code/backend" ]; then
  if [ -d "../code/backend" ]; then
    cd ..
  elif [ -d "../../code/backend" ]; then
    cd ../..
  else
    echo -e "${RED}Error: Could not locate project root directory${NC}"
    exit 1
  fi
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Run backend tests. The real test suite is a flat tests/*.py layout (no
# tests/unit, tests/integration, tests/api subdirectories), so run it as a
# single pass rather than three invocations against nonexistent paths.
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if run_test "Backend Tests" "cd code/backend && python -m pytest tests/ -v --junitxml=$RESULTS_DIR/backend_tests.xml"; then
  PASSED_TESTS=$((PASSED_TESTS + 1))
else
  FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Frontend Tests
echo -e "${YELLOW}=== Frontend Tests ===${NC}"

# Check if Node.js is installed
if command_exists node && [ -d "web-frontend" ]; then
  # Run frontend unit tests. --passWithNoTests keeps this from hard-failing
  # while the suite is still being built out; jest-junit / test:components
  # are not installed/defined in this project, so don't reference them.
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "Frontend Unit Tests" "cd web-frontend && npm test -- --ci --passWithNoTests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
else
  echo -e "${YELLOW}Skipping frontend tests: Node.js not installed or web-frontend/ not found${NC}"
fi

# Mobile Tests
echo -e "${YELLOW}=== Mobile Tests ===${NC}"

# Check if React Native testing tools are available
if [ -d "mobile-frontend" ] && command_exists npm; then
  # Run mobile unit tests
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "Mobile Unit Tests" "cd mobile-frontend && npm test -- --ci --passWithNoTests"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
else
  echo -e "${YELLOW}Skipping mobile tests: React Native environment not set up${NC}"
fi

# Blockchain Tests
echo -e "${YELLOW}=== Blockchain Tests ===${NC}"

if [ -d "code/blockchain" ]; then
  # Run blockchain contract tests
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "Blockchain Contract Tests" "cd code/blockchain && npm test"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
else
  echo -e "${YELLOW}Skipping blockchain tests: Blockchain directory not found${NC}"
fi

# AI Model Tests
echo -e "${YELLOW}=== AI Model Tests ===${NC}"

if [ -d "code/ai_models" ]; then
  # Run AI model tests
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "AI Model Tests" "cd code/ai_models && python -m pytest -v"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
else
  echo -e "${YELLOW}Skipping AI model tests: AI models directory not found${NC}"
fi

# End-to-End Tests
echo -e "${YELLOW}=== End-to-End Tests ===${NC}"

# Check if Cypress is installed
if command_exists npx && [ -d "web-frontend" ]; then
  # Run E2E tests with Cypress
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "End-to-End Tests" "cd web-frontend && npx cypress run --reporter junit --reporter-options 'mochaFile=$RESULTS_DIR/e2e_tests.xml'"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
else
  echo -e "${YELLOW}Skipping E2E tests: Cypress not installed or frontend directory not found${NC}"
fi

# Calculate test duration
TEST_END_TIME=$(date +%s)
TEST_DURATION=$((TEST_END_TIME - TEST_START_TIME))
MINUTES=$((TEST_DURATION / 60))
SECONDS=$((TEST_DURATION % 60))

# Generate test summary
echo
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "Total tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo -e "Duration: ${MINUTES}m ${SECONDS}s"
echo

# Generate HTML report
cat > "$RESULTS_DIR/test_report.html" << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Optionix Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { margin: 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px; }
    .passed { color: green; }
    .failed { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
  </style>
</head>
<body>
  <h1>Optionix Test Report</h1>
  <div class="summary">
    <p><strong>Date:</strong> $(date)</p>
    <p><strong>Total Tests:</strong> ${TOTAL_TESTS}</p>
    <p><strong>Passed:</strong> <span class="passed">${PASSED_TESTS}</span></p>
    <p><strong>Failed:</strong> <span class="failed">${FAILED_TESTS}</span></p>
    <p><strong>Duration:</strong> ${MINUTES}m ${SECONDS}s</p>
  </div>
</body>
</html>
EOF

echo -e "${BLUE}Test report generated at ${RESULTS_DIR}/test_report.html${NC}"

# Exit with status code based on test results
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please check the test report for details.${NC}"
  exit 1
fi

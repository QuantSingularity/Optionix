#!/bin/bash

# Linting and Fixing Script for Optionix Project (Python, JavaScript, Solidity, YAML)

# Set up robust error handling
# -e: Exit immediately if a command exits with a non-zero status.
# -u: Treat unset variables as an error.
# -o pipefail: Causes a pipeline to return the exit status of the last command in the pipe that returned a non-zero exit code.
set -euo pipefail

echo "----------------------------------------"
echo "Starting linting and fixing process for Optionix..."
echo "----------------------------------------"

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required tools
echo "Checking for required tools..."

# Check for Python
if ! command_exists python3; then
  echo "Error: python3 is required but not installed. Please install Python 3."
  exit 1
else
  echo "python3 is installed."
fi

# Check for pip
if ! command_exists pip3; then
  echo "Error: pip3 is required but not installed. Please install pip3."
  exit 1
else
  echo "pip3 is installed."
fi

# Check for Node.js and npm
if ! command_exists node; then
  echo "Error: node is required but not installed. Please install Node.js."
  exit 1
else
  echo "node is installed."
fi

if ! command_exists npm; then
  echo "Error: npm is required but not installed. Please install npm."
  exit 1
else
  echo "npm is installed."
fi

# Check for solc (Solidity compiler)
if ! command_exists solc; then
  echo "Warning: solc is not installed. Solidity linting will be limited."
  SOLC_AVAILABLE=false
else
  echo "solc is installed."
  SOLC_AVAILABLE=true
fi

# Check for yamllint
if ! command_exists yamllint; then
  echo "Warning: yamllint is not installed. YAML validation will be limited."
  YAMLLINT_AVAILABLE=false
else
  echo "yamllint is installed."
  YAMLLINT_AVAILABLE=true
fi

# Install required Python linting tools if not already installed
# Using --user to install to the user's home directory to avoid permission issues.
# Modern Debian/Ubuntu (PEP 668) refuses `pip install` outside a venv unless
# --break-system-packages is passed; fall back without it for older pip
# versions that don't recognize the flag. Treated as non-fatal so a tooling
# install hiccup doesn't abort the whole lint run before any linting happens.
echo "----------------------------------------"
echo "Installing/Updating Python linting tools (user-level install)..."
if ! pip3 install --user --upgrade --break-system-packages black isort flake8 pylint pyyaml 2>/dev/null; then
  pip3 install --user --upgrade black isort flake8 pylint pyyaml || \
    echo "Warning: could not install Python linting tools; Python linting steps below may be skipped."
fi

# Install global npm packages for JavaScript/TypeScript and Solidity linting
# Note: Global install is used here for simplicity, but project-local installs are generally preferred.
# Non-fatal: some environments don't allow global npm installs without sudo.
echo "----------------------------------------"
echo "Installing/Updating JavaScript and Solidity linting tools (global install)..."
npm install -g eslint prettier solhint || \
  echo "Warning: could not install JS/Solidity linting tools globally; related steps below may be skipped."

# Define directories to process relative to the project root (one level up from the script)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PYTHON_DIRECTORIES=(
  "code/backend"
  "code/ai_models"
)

JS_DIRECTORIES=(
  "web-frontend"
  "mobile-frontend"
  "code/blockchain"
)

SOLIDITY_DIRECTORIES=(
  "code/blockchain/contracts"
)

YAML_DIRECTORIES=(
  "infrastructure/kubernetes"
  "infrastructure/ansible"
  ".github/workflows"
)

# Change to project root for relative path operations
cd "$PROJECT_ROOT"

# 1. Python Linting
echo "----------------------------------------"
echo "Running Python linting tools..."

# 1.1 Run Black (code formatter)
echo "Running Black code formatter..."
for dir in "${PYTHON_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Formatting Python files in $dir..."
    # Use python3 -m to ensure the correct package is used
    python3 -m black "$dir" || echo "Black encountered issues in $dir. Please review the above errors."
  else
    echo "Directory $dir not found. Skipping Black formatting for this directory."
  fi
done
echo "Black formatting completed."

# 1.2 Run isort (import sorter)
echo "Running isort to sort imports..."
for dir in "${PYTHON_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Sorting imports in Python files in $dir..."
    python3 -m isort "$dir" || echo "isort encountered issues in $dir. Please review the above errors."
  else
    echo "Directory $dir not found. Skipping isort for this directory."
  fi
done
echo "Import sorting completed."

# 1.3 Run flake8 (linter)
echo "Running flake8 linter..."
for dir in "${PYTHON_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Linting Python files in $dir with flake8..."
    python3 -m flake8 "$dir" || echo "Flake8 found issues in $dir. Please review the above warnings/errors."
  else
    echo "Directory $dir not found. Skipping flake8 for this directory."
  fi
done
echo "Flake8 linting completed."

# 1.4 Run pylint (more comprehensive linter)
echo "Running pylint for more comprehensive linting..."
for dir in "${PYTHON_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Linting Python files in $dir with pylint..."
    # Simplified pylint command, relying on a potential .pylintrc or project configuration
    find "$dir" -type f -name "*.py" -not -path "*/venv/*" -not -path "*/.venv/*" -not -path "*/__pycache__/*" -print0 | xargs -r -0 python3 -m pylint || echo "Pylint found issues in $dir. Please review the above warnings/errors."
  else
    echo "Directory $dir not found. Skipping pylint for this directory."
  fi
done
echo "Pylint linting completed."

# 2. JavaScript/TypeScript Linting
echo "----------------------------------------"
echo "Running JavaScript/TypeScript linting tools..."

# 2.1 Run ESLint
echo "Running ESLint for JavaScript/TypeScript files..."
for dir in "${JS_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Linting JavaScript/TypeScript files in $dir with ESLint..."
    # Using npx to execute locally installed or globally available eslint
    npx eslint "$dir" --ext .js,.jsx,.ts,.tsx --fix || echo "ESLint found issues in $dir. Please review the above warnings/errors."
  else
    echo "Directory $dir not found. Skipping ESLint for this directory."
  fi
done
echo "ESLint linting completed."

# 2.2 Run Prettier
echo "Running Prettier for JavaScript/TypeScript files..."
for dir in "${JS_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Formatting JavaScript/TypeScript files in $dir with Prettier..."
    npx prettier --write "$dir/**/*.{js,jsx,ts,tsx}" || echo "Prettier encountered issues in $dir. Please review the above errors."
  else
    echo "Directory $dir not found. Skipping Prettier for this directory."
  fi
done
echo "Prettier formatting completed."

# 3. Solidity Linting
echo "----------------------------------------"
echo "Running Solidity linting tools..."
if [ "$SOLC_AVAILABLE" != true ]; then
  echo "Note: solc was not found, so solhint/prettier will run in syntax-only mode (no compiler-backed checks)."
fi

# 3.1 Run solhint
echo "Running solhint for Solidity files..."
for dir in "${SOLIDITY_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Linting Solidity files in $dir with solhint..."
    npx solhint "$dir/**/*.sol" || echo "solhint found issues in $dir. Please review the above warnings/errors."
  else
    echo "Directory $dir not found. Skipping solhint for this directory."
  fi
done
echo "solhint linting completed."

# 3.2 Run Prettier on Solidity files
echo "Running Prettier for Solidity files..."
for dir in "${SOLIDITY_DIRECTORIES[@]}"; do
  if [ -d "$dir" ]; then
    echo "Formatting Solidity files in $dir with Prettier..."
    npx prettier --write "$dir/**/*.sol" || echo "Prettier encountered issues in $dir. Please review the above errors."
  else
    echo "Directory $dir not found. Skipping Prettier for this directory."
  fi
done
echo "Prettier formatting for Solidity completed."

# 4. YAML Linting
echo "----------------------------------------"
echo "Running YAML linting tools..."

# 4.1 Run yamllint if available
if [ "$YAMLLINT_AVAILABLE" = true ]; then
  echo "Running yamllint for YAML files..."
  for dir in "${YAML_DIRECTORIES[@]}"; do
    if [ -d "$dir" ]; then
      echo "Linting YAML files in $dir with yamllint..."
      yamllint "$dir" || echo "yamllint found issues in $dir. Please review the above warnings/errors."
    else
      echo "Directory $dir not found. Skipping yamllint for this directory."
    fi
  done
  echo "yamllint completed."
else
  # 4.2 Basic YAML validation using Python
  echo "Performing basic YAML validation using Python..."
  for dir in "${YAML_DIRECTORIES[@]}"; do
    if [ -d "$dir" ]; then
      echo "Validating YAML files in $dir..."
      # Use python3 -c with the installed pyyaml
      find "$dir" -type f \( -name "*.yaml" -o -name "*.yml" \) -exec python3 -c "import yaml, sys; [yaml.safe_load(open(f, 'r')) for f in sys.argv[1:]]" {} + || echo "YAML validation found issues in $dir. Please review the above errors."
    else
      echo "Directory $dir not found. Skipping YAML validation for this directory."
    fi
  done
  echo "Basic YAML validation completed."
fi

# 5. Common Fixes for All File Types
echo "----------------------------------------"
echo "Applying common fixes to all file types..."

# 5.1 Fix trailing whitespace
echo "Fixing trailing whitespace..."
# Use a more robust find command to exclude common build/dependency directories
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sol" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./dist/*" -not -path "./build/*" \
  -exec sed -i 's/[ \t]*$//' {} +
echo "Fixed trailing whitespace."

# 5.2 Ensure newline at end of file
echo "Ensuring newline at end of files..."
find . -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.sol" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "./node_modules/*" -not -path "./venv/*" -not -path "./dist/*" -not -path "./build/*" \
  -exec sh -c '[ -n "$(tail -c1 "$1")" ] && echo "" >> "$1"' sh {} +
echo "Ensured newline at end of files."

echo "----------------------------------------"
echo "Linting and fixing process for Optionix completed!"
echo "----------------------------------------"

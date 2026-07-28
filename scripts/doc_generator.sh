#!/bin/bash
# Documentation Generator Script for Optionix
# This script automates the generation of documentation from code and project structure

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
OUTPUT_DIR="./docs/generated"
CODE_DIR="./code"
# web-frontend and mobile-frontend live at the project root, as siblings of
# code/ (which only contains backend/ai_models/blockchain) — NOT under code/.
WEB_FRONTEND_DIR="./web-frontend"
MOBILE_FRONTEND_DIR="./mobile-frontend"
INCLUDE_PRIVATE=false

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

# Parse command line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --output-dir=*)
        OUTPUT_DIR="${1#*=}"
        shift
        ;;
      --code-dir=*)
        CODE_DIR="${1#*=}"
        shift
        ;;
      --web-frontend-dir=*)
        WEB_FRONTEND_DIR="${1#*=}"
        shift
        ;;
      --mobile-frontend-dir=*)
        MOBILE_FRONTEND_DIR="${1#*=}"
        shift
        ;;
      --include-private)
        INCLUDE_PRIVATE=true
        shift
        ;;
      --help)
        echo "Usage: $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  api         Generate API documentation"
        echo "  components  Generate component documentation"
        echo "  project     Generate project structure documentation"
        echo "  changelog   Generate changelog from git history"
        echo "  all         Generate all documentation"
        echo
        echo "Options:"
        echo "  --output-dir=DIR         Output directory for documentation (default: ./docs/generated)"
        echo "  --code-dir=DIR           Backend/AI/blockchain source directory (default: ./code)"
        echo "  --web-frontend-dir=DIR   Web frontend source directory (default: ./web-frontend)"
        echo "  --mobile-frontend-dir=DIR Mobile frontend source directory (default: ./mobile-frontend)"
        echo "  --include-private        Include private methods and properties (default: false)"
        echo "  --help                   Show this help message"
        exit 0
        ;;
      api|components|project|changelog|all)
        COMMAND=$1
        shift
        ;;
      *)
        step_error "Unknown option or command: $1" "exit"
        ;;
    esac
  done

  if [ -z "$COMMAND" ]; then
    step_error "No command specified. Use --help for usage information." "exit"
  fi
}

# Check requirements
check_requirements() {
  section_header "Checking Requirements"

  # Create output directory if it doesn't exist
  if [ ! -d "$OUTPUT_DIR" ]; then
    mkdir -p "$OUTPUT_DIR"
    step_success "Created output directory: $OUTPUT_DIR"
  else
    step_success "Output directory exists: $OUTPUT_DIR"
  fi

  # Check required tools based on command
  case $COMMAND in
    api)
      if [ -d "$CODE_DIR/backend" ]; then
        # Python API docs below are generated via plain grep/sed docstring
        # parsing, not pydoc, so this only needs python3 itself to exist
        # (and even that isn't strictly required by the parsing logic) —
        # it's a lightweight sanity check, not a hard blocker.
        if command_exists python3; then
          step_success "python3 is installed"
        else
          step_info "python3 not found; Python API docs will still be generated via text parsing"
        fi
      fi

      if [ -d "$WEB_FRONTEND_DIR" ]; then
        if command_exists jsdoc; then
          step_success "jsdoc is installed"
        else
          step_error "jsdoc is not installed"
          step_info "Installing jsdoc..."
          if command_exists npm; then
            if npm install -g jsdoc; then
              step_success "jsdoc installed"
            else
              step_error "Could not install jsdoc (permission issue?); JS API docs will be skipped"
            fi
          else
            step_error "npm is required to install jsdoc" "exit"
          fi
        fi
      fi
      ;;
    components)
      if [ -d "$WEB_FRONTEND_DIR" ]; then
        if command_exists react-docgen; then
          step_success "react-docgen is installed"
        else
          step_error "react-docgen is not installed"
          step_info "Installing react-docgen..."
          if command_exists npm; then
            if npm install -g react-docgen; then
              step_success "react-docgen installed"
            else
              step_error "Could not install react-docgen (permission issue?); component docs will use fallback extraction"
            fi
          else
            step_error "npm is required to install react-docgen" "exit"
          fi
        fi
      fi
      if [ -d "$MOBILE_FRONTEND_DIR" ]; then
        step_success "Mobile frontend found at $MOBILE_FRONTEND_DIR (screens documented via fallback extraction)"
      fi
      ;;
    project|all)
      if command_exists find; then
        step_success "find is installed"
      else
        step_error "find is required but not installed" "exit"
      fi
      ;;
    changelog)
      if command_exists git; then
        step_success "git is installed"
      else
        step_error "git is required but not installed" "exit"
      fi
      ;;
  esac
}

# Generate API documentation
generate_api_docs() {
  section_header "Generating API Documentation"

  API_DOCS_DIR="$OUTPUT_DIR/api"
  mkdir -p "$API_DOCS_DIR"

  # Generate Python API docs
  if [ -d "$CODE_DIR/backend" ]; then
    step_info "Generating Python API documentation..."

    PYTHON_API_DIR="$API_DOCS_DIR/python"
    mkdir -p "$PYTHON_API_DIR"

    # Find all Python files
    find "$CODE_DIR/backend" -type f -name "*.py" -not -path "*/venv/*" -not -path "*/.venv/*" -not -path "*/__pycache__/*" | while read -r py_file; do
      rel_path=${py_file#"$CODE_DIR/backend/"}
      module_name=${rel_path%.py}
      module_name=${module_name//\//.}

      # Skip __init__.py files
      if [[ "$module_name" == *__init__ ]]; then
        continue
      fi

      # Skip private modules if not including private
      if [[ "$INCLUDE_PRIVATE" = false && "$module_name" == _* ]]; then
        continue
      fi

      step_info "Processing module: $module_name"

      # Create output file
      output_file="$PYTHON_API_DIR/${module_name}.md"

      # Generate documentation
      echo "# Module: $module_name" > "$output_file"
      echo "" >> "$output_file"
      echo "## Description" >> "$output_file"
      echo "" >> "$output_file"

      # Extract module docstring
      module_doc=$(grep -A 20 '"""' "$py_file" | sed -n '/"""/,/"""/p' | sed 's/"""//' | sed 's/^[ \t]*//')
      if [ -n "$module_doc" ]; then
        echo "$module_doc" >> "$output_file"
      else
        echo "No module documentation available." >> "$output_file"
      fi

      echo "" >> "$output_file"
      echo "## Functions and Classes" >> "$output_file"
      echo "" >> "$output_file"

      # Extract functions and classes
      grep -n "^def " "$py_file" | while IFS=: read -r line_num line_content; do
        func_name=$(echo "$line_content" | sed -n 's/def \([a-zA-Z0-9_]*\).*/\1/p')

        # Skip private functions if not including private
        if [[ "$INCLUDE_PRIVATE" = false && "$func_name" == _* ]]; then
          continue
        fi

        echo "### Function: $func_name" >> "$output_file"
        echo "" >> "$output_file"

        # Extract function signature
        echo '```python' >> "$output_file"
        echo "$line_content" >> "$output_file"
        echo '```' >> "$output_file"
        echo "" >> "$output_file"

        # Extract function docstring
        func_doc=$(tail -n +$((line_num + 1)) "$py_file" | grep -A 20 '"""' | sed -n '/"""/,/"""/p' | sed 's/"""//' | sed 's/^[ \t]*//')
        if [ -n "$func_doc" ]; then
          echo "$func_doc" >> "$output_file"
        else
          echo "No function documentation available." >> "$output_file"
        fi

        echo "" >> "$output_file"
      done

      grep -n "^class " "$py_file" | while IFS=: read -r line_num line_content; do
        class_name=$(echo "$line_content" | sed -n 's/class \([a-zA-Z0-9_]*\).*/\1/p')

        # Skip private classes if not including private
        if [[ "$INCLUDE_PRIVATE" = false && "$class_name" == _* ]]; then
          continue
        fi

        echo "### Class: $class_name" >> "$output_file"
        echo "" >> "$output_file"

        # Extract class signature
        echo '```python' >> "$output_file"
        echo "$line_content" >> "$output_file"
        echo '```' >> "$output_file"
        echo "" >> "$output_file"

        # Extract class docstring
        class_doc=$(tail -n +$((line_num + 1)) "$py_file" | grep -A 20 '"""' | sed -n '/"""/,/"""/p' | sed 's/"""//' | sed 's/^[ \t]*//')
        if [ -n "$class_doc" ]; then
          echo "$class_doc" >> "$output_file"
        else
          echo "No class documentation available." >> "$output_file"
        fi

        echo "" >> "$output_file"
      done
    done

    step_success "Python API documentation generated: $PYTHON_API_DIR"
  fi

  # Generate JavaScript API docs
  if [ -d "$WEB_FRONTEND_DIR" ]; then
    step_info "Generating JavaScript API documentation..."

    JS_API_DIR="$API_DOCS_DIR/javascript"
    mkdir -p "$JS_API_DIR"

    # Create JSDoc configuration
    cat > "$JS_API_DIR/jsdoc.json" << EOF
{
  "source": {
    "include": ["$WEB_FRONTEND_DIR/src"],
    "includePattern": ".+\\\\.js(x)?\$",
    "excludePattern": "(node_modules/|docs)"
  },
  "plugins": ["plugins/markdown"],
  "opts": {
    "destination": "$JS_API_DIR",
    "recurse": true,
    "template": "templates/default"
  }
}
EOF

    # Run JSDoc
    if command_exists jsdoc; then
      jsdoc -c "$JS_API_DIR/jsdoc.json" -r
      step_success "JavaScript API documentation generated: $JS_API_DIR"
    else
      step_error "jsdoc not installed, skipping JavaScript API documentation"
    fi
  fi

  # Create API documentation index
  cat > "$API_DOCS_DIR/index.md" << EOF
# Optionix API Documentation

This documentation provides details about the Optionix API.

## Python API

The Python API documentation covers the backend services and utilities.

- [Python API Documentation](./python/)

## JavaScript API

The JavaScript API documentation covers the frontend services and components.

- [JavaScript API Documentation](./javascript/)

## API Endpoints

The following REST API endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/options | GET | Get options data |
| /api/options/{id} | GET | Get specific option details |
| /api/strategies | GET | Get available strategies |
| /api/strategies/{id} | GET | Get specific strategy details |
| /api/volatility | POST | Calculate implied volatility |
| /api/portfolio | GET | Get user portfolio |
| /api/portfolio/{id} | GET | Get specific portfolio details |

EOF

  step_success "API documentation index created: $API_DOCS_DIR/index.md"
}

# Generate component documentation
generate_component_docs() {
  section_header "Generating Component Documentation"

  COMPONENT_DOCS_DIR="$OUTPUT_DIR/components"
  mkdir -p "$COMPONENT_DOCS_DIR"

  # Generate React component docs
  if [ -d "$WEB_FRONTEND_DIR" ]; then
    step_info "Generating React component documentation..."

    REACT_COMPONENT_DIR="$COMPONENT_DOCS_DIR/react"
    mkdir -p "$REACT_COMPONENT_DIR"

    # Find all React component files (this project uses .js for JSX as well
    # as .jsx/.tsx, and node_modules must never be walked if present)
    find "$WEB_FRONTEND_DIR/src" -type f \( -name "*.jsx" -o -name "*.tsx" -o -name "*.js" \) -not -path "*/node_modules/*" | while read -r component_file; do
      rel_path=${component_file#"$WEB_FRONTEND_DIR/"}
      component_name=$(basename "$component_file" | sed 's/\.[^.]*$//')

      # Skip private components if not including private
      if [[ "$INCLUDE_PRIVATE" = false && "$component_name" == _* ]]; then
        continue
      fi

      step_info "Processing component: $component_name"

      # Create output file
      output_file="$REACT_COMPONENT_DIR/${component_name}.md"

      # Generate documentation
      echo "# Component: $component_name" > "$output_file"
      echo "" >> "$output_file"
      echo "**File:** \`$rel_path\`" >> "$output_file"
      echo "" >> "$output_file"

      # Extract component description from comments
      component_doc=$(grep -A 20 '/\*\*' "$component_file" | sed -n '/\/\*\*/,/\*\//p' | sed 's/\/\*\*//' | sed 's/\*\///' | sed 's/^[ \t*]*//')
      if [ -n "$component_doc" ]; then
        echo "## Description" >> "$output_file"
        echo "" >> "$output_file"
        echo "$component_doc" >> "$output_file"
        echo "" >> "$output_file"
      fi

      # Extract props
      echo "## Props" >> "$output_file"
      echo "" >> "$output_file"

      props_found=false

      # Look for PropTypes
      if grep -q "PropTypes" "$component_file"; then
        props_found=true
        echo "| Prop | Type | Required | Default | Description |" >> "$output_file"
        echo "|------|------|----------|---------|-------------|" >> "$output_file"

        grep -A 50 "PropTypes" "$component_file" | grep -B 50 "}" | grep -v "PropTypes" | grep -v "}" | while read -r prop_line; do
          if [[ "$prop_line" =~ ([a-zA-Z0-9_]+):\ *PropTypes\.([a-zA-Z0-9_]+)(\.isRequired)? ]]; then
            prop_name=${BASH_REMATCH[1]}
            prop_type=${BASH_REMATCH[2]}
            is_required=$([ -n "${BASH_REMATCH[3]}" ] && echo "Yes" || echo "No")

            # Try to find default value
            default_value=$(grep -A 5 "defaultProps" "$component_file" | grep "$prop_name" | sed -n "s/.*$prop_name: \(.*\),/\1/p" | tr -d ' ')
            if [ -z "$default_value" ]; then
              default_value="-"
            fi

            # Try to find description from comments
            prop_desc=$(grep -B 5 "$prop_name:" "$component_file" | grep -o "\/\*\*.*\*\/" | sed 's/\/\*\*//' | sed 's/\*\///' | tr -d '*' | tr -d ' ')
            if [ -z "$prop_desc" ]; then
              prop_desc="-"
            fi

            echo "| $prop_name | $prop_type | $is_required | $default_value | $prop_desc |" >> "$output_file"
          fi
        done
      fi

      # Look for TypeScript interface
      if grep -q "interface.*Props" "$component_file"; then
        props_found=true
        echo "| Prop | Type | Required | Description |" >> "$output_file"
        echo "|------|------|----------|-------------|" >> "$output_file"

        in_interface=false
        while IFS= read -r line; do
          if [[ "$line" =~ interface.*Props ]]; then
            in_interface=true
            continue
          fi

          if [ "$in_interface" = true ]; then
            if [[ "$line" =~ \} ]]; then
              in_interface=false
              continue
            fi

            if [[ "$line" =~ ([a-zA-Z0-9_]+)(\?)?:\ *([a-zA-Z0-9_<>|]+) ]]; then
              prop_name=${BASH_REMATCH[1]}
              is_required=$([ -z "${BASH_REMATCH[2]}" ] && echo "Yes" || echo "No")
              prop_type=${BASH_REMATCH[3]}

              # Try to find description from comments
              # shellcheck disable=SC1087  # "[?]" here is a grep BRE character class, not bash array indexing
            prop_desc=$(grep -B 1 "$prop_name[?]\?:" "$component_file" | grep -o "\/\*\*.*\*\/" | sed 's/\/\*\*//' | sed 's/\*\///' | tr -d '*' | tr -d ' ')
              if [ -z "$prop_desc" ]; then
                prop_desc="-"
              fi

              echo "| $prop_name | $prop_type | $is_required | $prop_desc |" >> "$output_file"
            fi
          fi
        done < "$component_file"
      fi

      if [ "$props_found" = false ]; then
        echo "No props documentation found." >> "$output_file"
      fi

      echo "" >> "$output_file"
      echo "## Example Usage" >> "$output_file"
      echo "" >> "$output_file"
      echo '```jsx' >> "$output_file"
      echo "import $component_name from '$rel_path';" >> "$output_file"
      echo "" >> "$output_file"
      echo "function Example() {" >> "$output_file"
      echo "  return <$component_name />;" >> "$output_file"
      echo "}" >> "$output_file"
      echo '```' >> "$output_file"
    done

    step_success "React component documentation generated: $REACT_COMPONENT_DIR"
  fi

  # Generate React Native screen docs
  if [ -d "$MOBILE_FRONTEND_DIR" ]; then
    step_info "Generating React Native screen documentation..."

    RN_SCREEN_DIR="$COMPONENT_DOCS_DIR/mobile"
    mkdir -p "$RN_SCREEN_DIR"

    find "$MOBILE_FRONTEND_DIR/src" -type f -name "*.js" -not -path "*/node_modules/*" | while read -r screen_file; do
      rel_path=${screen_file#"$MOBILE_FRONTEND_DIR/"}
      screen_name=$(basename "$screen_file" | sed 's/\.[^.]*$//')

      if [[ "$INCLUDE_PRIVATE" = false && "$screen_name" == _* ]]; then
        continue
      fi

      step_info "Processing mobile screen/component: $screen_name"

      output_file="$RN_SCREEN_DIR/${screen_name}.md"
      echo "# $screen_name" > "$output_file"
      echo "" >> "$output_file"
      echo "**File:** \`$rel_path\`" >> "$output_file"
      echo "" >> "$output_file"

      # Extract a leading /** ... */ or // comment block as the description
      screen_doc=$(grep -A 10 '/\*\*' "$screen_file" 2>/dev/null | sed -n '/\/\*\*/,/\*\//p' | sed 's/\/\*\*//' | sed 's/\*\///' | sed 's/^[ \t*]*//')
      if [ -n "$screen_doc" ]; then
        echo "## Description" >> "$output_file"
        echo "" >> "$output_file"
        echo "$screen_doc" >> "$output_file"
        echo "" >> "$output_file"
      fi
    done

    step_success "React Native screen documentation generated: $RN_SCREEN_DIR"
  fi

  # Create component documentation index
  cat > "$COMPONENT_DOCS_DIR/index.md" << EOF
# Optionix Component Documentation

This documentation provides details about the Optionix UI components.

## Web (React)

The React component documentation covers the web frontend, rooted at
$WEB_FRONTEND_DIR/src.

- [React Component Documentation](./react/)

## Mobile (React Native / Expo)

The React Native documentation covers screens and shared components in
$MOBILE_FRONTEND_DIR/src.

- [Mobile Screen Documentation](./mobile/)

## Web App Structure

\`\`\`
App
├── AuthProvider (session/token state)
└── Routes
    ├── Home                  (public landing page)
    ├── SignIn / SignUp       (public auth pages)
    └── DashboardLayout       (protected, wraps Navbar + Sidebar)
        ├── Dashboard
        ├── Trading
        ├── Portfolio
        ├── Analytics
        ├── Risk
        ├── Compliance
        └── Settings
\`\`\`

EOF

  step_success "Component documentation index created: $COMPONENT_DOCS_DIR/index.md"
}

# Generate project structure documentation
generate_project_docs() {
  section_header "Generating Project Structure Documentation"

  PROJECT_DOCS_DIR="$OUTPUT_DIR/project"
  mkdir -p "$PROJECT_DOCS_DIR"

  # Generate project structure
  step_info "Generating project structure documentation..."

  # Create project structure file
  STRUCTURE_FILE="$PROJECT_DOCS_DIR/structure.md"

  echo "# Optionix Project Structure" > "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"
  echo "This document provides an overview of the Optionix project structure." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"
  echo "## Directory Structure" >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"
  echo '```' >> "$STRUCTURE_FILE"

  # Generate directory tree
  find . -type d -not -path "*/\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/__pycache__/*" -not -path "*/dist/*" -not -path "*/build/*" | sort | while read -r dir; do
    # Calculate directory depth
    depth=$(echo "$dir" | tr -cd '/' | wc -c)

    # Skip root directory
    if [ "$dir" = "." ]; then
      continue
    fi

    # Add indentation based on depth. 'tr' cannot be used to repeat a
    # multi-byte UTF-8 character like the box-drawing pipe (it maps
    # byte-for-byte and mangles it), so build the indent with a loop instead.
    indent=""
    for ((_i = 0; _i < depth - 1; _i++)); do
      indent="${indent}│   "
    done
    if [ "$depth" -gt 1 ]; then
      echo "$indent├── $(basename "$dir")" >> "$STRUCTURE_FILE"
    else
      echo "├── $(basename "$dir")" >> "$STRUCTURE_FILE"
    fi
  done

  echo '```' >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  # Add descriptions for main directories
  echo "## Directory Descriptions" >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### code/" >> "$STRUCTURE_FILE"
  echo "Contains the backend, AI models, and blockchain source code for the Optionix project." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### code/backend/" >> "$STRUCTURE_FILE"
  echo "Contains the Python FastAPI backend server code." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### web-frontend/" >> "$STRUCTURE_FILE"
  echo "Contains the React web frontend code (lives at the project root, alongside code/)." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### mobile-frontend/" >> "$STRUCTURE_FILE"
  echo "Contains the React Native / Expo mobile app code (lives at the project root, alongside code/)." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### code/blockchain/" >> "$STRUCTURE_FILE"
  echo "Contains the Solidity smart contracts and blockchain integration code." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### code/ai_models/" >> "$STRUCTURE_FILE"
  echo "Contains the machine learning models for volatility prediction and trading signals." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### docs/" >> "$STRUCTURE_FILE"
  echo "Contains project documentation." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### infrastructure/" >> "$STRUCTURE_FILE"
  echo "Contains infrastructure as code, deployment configurations, and CI/CD pipelines." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  echo "### resources/" >> "$STRUCTURE_FILE"
  echo "Contains static resources such as datasets, images, and other assets." >> "$STRUCTURE_FILE"
  echo "" >> "$STRUCTURE_FILE"

  step_success "Project structure documentation generated: $STRUCTURE_FILE"

  # Generate architecture documentation
  ARCHITECTURE_FILE="$PROJECT_DOCS_DIR/architecture.md"

  echo "# Optionix Architecture" > "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"
  echo "This document provides an overview of the Optionix architecture." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"
  echo "## System Architecture" >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"
  echo "Optionix follows a microservices architecture with the following components:" >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"
  echo '```' >> "$ARCHITECTURE_FILE"
  echo "                                 ┌─────────────────┐" >> "$ARCHITECTURE_FILE"
  echo "                                 │    Frontend     │" >> "$ARCHITECTURE_FILE"
  echo "                                 │  (React/Redux)  │" >> "$ARCHITECTURE_FILE"
  echo "                                 └────────┬────────┘" >> "$ARCHITECTURE_FILE"
  echo "                                          │" >> "$ARCHITECTURE_FILE"
  echo "                                          ▼" >> "$ARCHITECTURE_FILE"
  echo "┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐" >> "$ARCHITECTURE_FILE"
  echo "│   Mobile App    │◄────REST────►│   API Gateway   │◄────REST────►│  Authentication  │" >> "$ARCHITECTURE_FILE"
  echo "│  (React Native) │              │    (FastAPI)    │              │    Service       │" >> "$ARCHITECTURE_FILE"
  echo "└─────────────────┘              └────────┬────────┘              └─────────────────┘" >> "$ARCHITECTURE_FILE"
  echo "                                          │" >> "$ARCHITECTURE_FILE"
  echo "                 ┌─────────────────┬──────┴───────┬─────────────────┐" >> "$ARCHITECTURE_FILE"
  echo "                 │                 │              │                 │" >> "$ARCHITECTURE_FILE"
  echo "                 ▼                 ▼              ▼                 ▼" >> "$ARCHITECTURE_FILE"
  echo "┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐" >> "$ARCHITECTURE_FILE"
  echo "│  Options Data   │    │  Trading Engine │    │ Analytics Engine │    │ Blockchain Node │" >> "$ARCHITECTURE_FILE"
  echo "│    Service      │    │    Service      │    │    Service       │    │    Service      │" >> "$ARCHITECTURE_FILE"
  echo "└────────┬────────┘    └────────┬────────┘    └────────┬────────┘    └────────┬────────┘" >> "$ARCHITECTURE_FILE"
  echo "         │                      │                      │                      │" >> "$ARCHITECTURE_FILE"
  echo "         ▼                      ▼                      ▼                      ▼" >> "$ARCHITECTURE_FILE"
  echo "┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐" >> "$ARCHITECTURE_FILE"
  echo "│   Market Data   │    │    Portfolio    │    │   Time Series   │    │    Ethereum     │" >> "$ARCHITECTURE_FILE"
  echo "│    Database     │    │    Database     │    │    Database     │    │    Blockchain   │" >> "$ARCHITECTURE_FILE"
  echo "└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘" >> "$ARCHITECTURE_FILE"
  echo '```' >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "## Component Descriptions" >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Frontend (React/Redux)" >> "$ARCHITECTURE_FILE"
  echo "The web frontend is built with React and Redux for state management. It provides the user interface for trading, analytics, and portfolio management." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Mobile App (React Native)" >> "$ARCHITECTURE_FILE"
  echo "The mobile app is built with React Native, providing a native mobile experience for iOS and Android devices." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### API Gateway (FastAPI)" >> "$ARCHITECTURE_FILE"
  echo "The API gateway serves as the entry point for all client requests, routing them to the appropriate microservices." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Authentication Service" >> "$ARCHITECTURE_FILE"
  echo "Handles user authentication, authorization, and session management." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Options Data Service" >> "$ARCHITECTURE_FILE"
  echo "Provides real-time and historical options data, including prices, Greeks, and implied volatility." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Trading Engine Service" >> "$ARCHITECTURE_FILE"
  echo "Handles order placement, execution, and portfolio management." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Analytics Engine Service" >> "$ARCHITECTURE_FILE"
  echo "Provides options analytics, strategy analysis, and risk assessment." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "### Blockchain Node Service" >> "$ARCHITECTURE_FILE"
  echo "Interfaces with the Ethereum blockchain for decentralized options trading and settlement." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  echo "## Data Flow" >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"
  echo "1. Users interact with the frontend or mobile app." >> "$ARCHITECTURE_FILE"
  echo "2. Client requests are sent to the API gateway." >> "$ARCHITECTURE_FILE"
  echo "3. The API gateway authenticates the request and routes it to the appropriate service." >> "$ARCHITECTURE_FILE"
  echo "4. Services process the request, interact with databases or external systems, and return the response." >> "$ARCHITECTURE_FILE"
  echo "5. The API gateway aggregates responses and returns them to the client." >> "$ARCHITECTURE_FILE"
  echo "" >> "$ARCHITECTURE_FILE"

  step_success "Architecture documentation generated: $ARCHITECTURE_FILE"

  # Create project documentation index
  cat > "$PROJECT_DOCS_DIR/index.md" << EOF
# Optionix Project Documentation

This documentation provides details about the Optionix project structure and architecture.

## Project Structure

The project structure documentation provides an overview of the directory structure and file organization.

- [Project Structure](./structure.md)

## Architecture

The architecture documentation provides an overview of the system architecture and component interactions.

- [Architecture](./architecture.md)

## Development Workflow

The development workflow follows these steps:

1. Clone the repository
2. Set up the development environment using \`setup_optionix_env.sh\`
3. Make changes to the codebase
4. Run tests using \`test_backend.sh\` and frontend test commands
5. Lint code using \`lint-all.sh\`
6. Submit a pull request

## Deployment

The application can be deployed using the following methods:

1. Docker containers with \`docker-compose up\`
2. Kubernetes using the configuration in \`infrastructure/kubernetes/\`
3. Manual deployment using the \`run_optionix.sh\` script

EOF

  step_success "Project documentation index created: $PROJECT_DOCS_DIR/index.md"
}

# Generate changelog
generate_changelog() {
  section_header "Generating Changelog"

  CHANGELOG_FILE="$OUTPUT_DIR/CHANGELOG.md"

  step_info "Generating changelog from git history..."

  # Check if git repository exists
  if [ ! -d ".git" ]; then
    step_error "Not a git repository. Please run this script from the root of a git repository."
    return 1
  fi

  # Create changelog file
  echo "# Changelog" > "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
  echo "All notable changes to the Optionix project will be documented in this file." >> "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"

  # Get all tags sorted by date
  tags=$(git tag --sort=-creatordate)

  if [ -z "$tags" ]; then
    # No tags, use commit history
    step_info "No tags found, generating changelog from commit history..."

    echo "## Unreleased" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"

    # Group commits by type
    echo "### Features" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    git log --pretty=format:"- %s (%h)" | grep -i "feat\|feature\|add" >> "$CHANGELOG_FILE" || echo "No features found." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"

    echo "### Bug Fixes" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    git log --pretty=format:"- %s (%h)" | grep -i "fix\|bug\|issue" >> "$CHANGELOG_FILE" || echo "No bug fixes found." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"

    echo "### Improvements" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    git log --pretty=format:"- %s (%h)" | grep -i "improve\|enhance\|refactor\|perf" >> "$CHANGELOG_FILE" || echo "No improvements found." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"

    echo "### Other Changes" >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
    git log --pretty=format:"- %s (%h)" | grep -v -i "feat\|feature\|add\|fix\|bug\|issue\|improve\|enhance\|refactor\|perf" >> "$CHANGELOG_FILE" || echo "No other changes found." >> "$CHANGELOG_FILE"
    echo "" >> "$CHANGELOG_FILE"
  else
    # Generate changelog from tags
    step_info "Generating changelog from tags..."

    # Check if there are unreleased changes
    latest_tag=$(echo "$tags" | head -n 1)
    unreleased_commits=$(git log "$latest_tag"..HEAD --oneline)

    if [ -n "$unreleased_commits" ]; then
      echo "## Unreleased" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      # Group commits by type
      echo "### Features" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$latest_tag"..HEAD --pretty=format:"- %s (%h)" | grep -i "feat\|feature\|add" >> "$CHANGELOG_FILE" || echo "No features found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      echo "### Bug Fixes" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$latest_tag"..HEAD --pretty=format:"- %s (%h)" | grep -i "fix\|bug\|issue" >> "$CHANGELOG_FILE" || echo "No bug fixes found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      echo "### Improvements" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$latest_tag"..HEAD --pretty=format:"- %s (%h)" | grep -i "improve\|enhance\|refactor\|perf" >> "$CHANGELOG_FILE" || echo "No improvements found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
    fi

    # Generate changelog for each tag
    prev_tag=""
    for tag in $tags; do
      # Get tag date
      tag_date=$(git log -1 --format=%ad --date=short "$tag")

      echo "## [$tag] - $tag_date" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      if [ -z "$prev_tag" ]; then
        # First tag
        range="$tag"
      else
        # Between tags
        range="$tag..$prev_tag"
      fi

      # Group commits by type
      echo "### Features" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$range" --pretty=format:"- %s (%h)" | grep -i "feat\|feature\|add" >> "$CHANGELOG_FILE" || echo "No features found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      echo "### Bug Fixes" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$range" --pretty=format:"- %s (%h)" | grep -i "fix\|bug\|issue" >> "$CHANGELOG_FILE" || echo "No bug fixes found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      echo "### Improvements" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      git log "$range" --pretty=format:"- %s (%h)" | grep -i "improve\|enhance\|refactor\|perf" >> "$CHANGELOG_FILE" || echo "No improvements found." >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"
      echo "" >> "$CHANGELOG_FILE"

      prev_tag="$tag"
    done
  fi

  step_success "Changelog generated: $CHANGELOG_FILE"
}

# Generate all documentation
generate_all_docs() {
  section_header "Generating All Documentation"

  generate_api_docs
  generate_component_docs
  generate_project_docs
  generate_changelog

  # Create main index file
  MAIN_INDEX="$OUTPUT_DIR/index.md"

  echo "# Optionix Documentation" > "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "Welcome to the Optionix documentation. This documentation provides comprehensive information about the Optionix platform." >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "## Table of Contents" >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "- [API Documentation](./api/index.md)" >> "$MAIN_INDEX"
  echo "- [Component Documentation](./components/index.md)" >> "$MAIN_INDEX"
  echo "- [Project Documentation](./project/index.md)" >> "$MAIN_INDEX"
  echo "- [Changelog](./CHANGELOG.md)" >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "## Getting Started" >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "To get started with Optionix, follow these steps:" >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "1. Clone the repository: \`git clone https://github.com/quantsingularity/Optionix.git\`" >> "$MAIN_INDEX"
  echo "2. Set up the development environment: \`./setup_optionix_env.sh\`" >> "$MAIN_INDEX"
  echo "3. Start the application: \`./run_optionix.sh\`" >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"
  echo "For more detailed instructions, see the [Project Documentation](./project/index.md)." >> "$MAIN_INDEX"
  echo "" >> "$MAIN_INDEX"

  step_success "Main documentation index created: $MAIN_INDEX"
  step_success "All documentation generated successfully"
}

# Main function
main() {
  echo -e "${YELLOW}=== Optionix Documentation Generator ===${NC}"
  echo -e "${BLUE}$(date)${NC}"

  # Parse command line arguments
  parse_args "$@"

  # Check requirements
  check_requirements

  # Execute command
  case $COMMAND in
    api)
      generate_api_docs
      ;;
    components)
      generate_component_docs
      ;;
    project)
      generate_project_docs
      ;;
    changelog)
      generate_changelog
      ;;
    all)
      generate_all_docs
      ;;
  esac

  echo -e "\n${GREEN}Documentation generation completed successfully!${NC}"
}

# Run the main function with all arguments
main "$@"

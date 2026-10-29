#!/bin/bash
# Database Management Script for Optionix
# This script automates database operations including setup, migration, backup, and restoration

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="optionix"
DB_USER="postgres"
DB_PASSWORD="postgres"
BACKUP_DIR="./database_backups"

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
      --host=*)
        DB_HOST="${1#*=}"
        shift
        ;;
      --port=*)
        DB_PORT="${1#*=}"
        shift
        ;;
      --name=*)
        DB_NAME="${1#*=}"
        shift
        ;;
      --user=*)
        DB_USER="${1#*=}"
        shift
        ;;
      --password=*)
        DB_PASSWORD="${1#*=}"
        shift
        ;;
      --backup-dir=*)
        BACKUP_DIR="${1#*=}"
        shift
        ;;
      --help)
        echo "Usage: $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  setup       Create database and initialize schema"
        echo "  migrate     Run database migrations"
        echo "  seed        Seed database with test data"
        echo "  backup      Backup database"
        echo "  restore     Restore database from backup"
        echo "  reset       Reset database (drop and recreate)"
        echo
        echo "Options:"
        echo "  --host=HOST           Database host (default: localhost)"
        echo "  --port=PORT           Database port (default: 5432)"
        echo "  --name=NAME           Database name (default: optionix)"
        echo "  --user=USER           Database user (default: postgres)"
        echo "  --password=PASSWORD   Database password (default: postgres)"
        echo "  --backup-dir=DIR      Backup directory (default: ./database_backups)"
        echo "  --help                Show this help message"
        exit 0
        ;;
      setup|migrate|seed|backup|restore|reset)
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

  # Check PostgreSQL client
  if command_exists psql; then
    PSQL_VERSION=$(psql --version)
    step_success "PostgreSQL client installed: $PSQL_VERSION"
  else
    step_error "PostgreSQL client not found. Please install PostgreSQL client." "exit"
  fi

  # Check if we can connect to the database
  if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" &>/dev/null; then
    step_success "Successfully connected to PostgreSQL server"
  else
    step_error "Could not connect to PostgreSQL server at $DB_HOST:$DB_PORT. Please check connection settings."

    # Try with Docker: inspect the actual container's published port rather
    # than assuming localhost:5432 (which may just repeat the connection we
    # already know failed, or silently override a host/port the caller
    # explicitly asked for).
    if command_exists docker; then
      CONTAINER_ID=$(docker ps --filter "name=postgres" --format "{{.ID}}" | head -n 1)
      if [ -z "$CONTAINER_ID" ]; then
        CONTAINER_ID=$(docker ps --filter "ancestor=postgres" --format "{{.ID}}" | head -n 1)
      fi

      if [ -n "$CONTAINER_ID" ]; then
        step_info "PostgreSQL Docker container found ($CONTAINER_ID). Inspecting its published port..."
        MAPPED_PORT=$(docker port "$CONTAINER_ID" 5432/tcp 2>/dev/null | head -n 1 | sed -E 's/.*:([0-9]+)$/\1/')

        if [ -n "$MAPPED_PORT" ]; then
          DB_HOST="localhost"
          DB_PORT="$MAPPED_PORT"
          step_info "Updated connection settings from container: $DB_HOST:$DB_PORT"

          if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" &>/dev/null; then
            step_success "Successfully connected to PostgreSQL Docker container"
          else
            step_error "Could not connect to PostgreSQL Docker container at $DB_HOST:$DB_PORT. Please check connection settings." "exit"
          fi
        else
          step_error "Found a PostgreSQL container but could not determine its published port. Please check connection settings." "exit"
        fi
      else
        step_error "Could not find a running PostgreSQL container. Please start PostgreSQL server." "exit"
      fi
    else
      step_error "Could not find PostgreSQL server. Please start PostgreSQL server." "exit"
    fi
  fi

  # Create backup directory if it doesn't exist
  if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    step_success "Created backup directory: $BACKUP_DIR"
  else
    step_success "Backup directory exists: $BACKUP_DIR"
  fi
}

# Setup database
setup_database() {
  section_header "Setting Up Database"

  # Check if database exists
  if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    step_info "Database '$DB_NAME' already exists"
  else
    step_info "Creating database '$DB_NAME'..."
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
    step_success "Database '$DB_NAME' created"
  fi

  # Initialize schema
  step_info "Initializing database schema..."

  # Check if schema files exist
  SCHEMA_DIR="./code/backend/database/schema"
  if [ -d "$SCHEMA_DIR" ]; then
    for schema_file in "$SCHEMA_DIR"/*.sql; do
      if [ -f "$schema_file" ]; then
        step_info "Applying schema: $(basename "$schema_file")"
        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$schema_file"
        step_success "Schema applied: $(basename "$schema_file")"
      fi
    done
  else
    step_info "Schema directory not found. Creating default schema..."

    # Create schema directory
    mkdir -p "$SCHEMA_DIR"

    # Create default schema file
    cat > "$SCHEMA_DIR/01_initial_schema.sql" << 'EOF'
-- Initial schema for Optionix database

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Options table
CREATE TABLE IF NOT EXISTS options (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    expiration_date DATE NOT NULL,
    strike_price DECIMAL(10, 2) NOT NULL,
    option_type VARCHAR(4) NOT NULL CHECK (option_type IN ('CALL', 'PUT')),
    last_price DECIMAL(10, 2),
    bid DECIMAL(10, 2),
    ask DECIMAL(10, 2),
    volume INTEGER,
    open_interest INTEGER,
    implied_volatility DECIMAL(10, 4),
    delta DECIMAL(10, 4),
    gamma DECIMAL(10, 4),
    theta DECIMAL(10, 4),
    vega DECIMAL(10, 4),
    rho DECIMAL(10, 4),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(id),
    option_id INTEGER REFERENCES options(id),
    quantity INTEGER NOT NULL,
    entry_price DECIMAL(10, 2) NOT NULL,
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    exit_price DECIMAL(10, 2),
    exit_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(10) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Strategies table
CREATE TABLE IF NOT EXISTS strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Strategy_positions table
CREATE TABLE IF NOT EXISTS strategy_positions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id),
    option_id INTEGER REFERENCES options(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_options_symbol ON options(symbol);
CREATE INDEX idx_options_expiration ON options(expiration_date);
CREATE INDEX idx_positions_portfolio ON positions(portfolio_id);
CREATE INDEX idx_strategy_positions_strategy ON strategy_positions(strategy_id);
EOF

    # Apply default schema
    step_info "Applying default schema..."
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_DIR/01_initial_schema.sql"
    step_success "Default schema applied"
  fi

  step_success "Database schema initialized"
}

# Run migrations
run_migrations() {
  section_header "Running Database Migrations"

  # Check if migration files exist
  MIGRATION_DIR="./code/backend/database/migrations"
  if [ -d "$MIGRATION_DIR" ]; then
    # Get list of applied migrations
    APPLIED_MIGRATIONS=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT migration_name FROM migrations ORDER BY id" 2>/dev/null || echo "")

    # Create migrations table if it doesn't exist
    if ! PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations'" | grep -q 1; then
      step_info "Creating migrations table..."
      PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        CREATE TABLE migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      "
      step_success "Migrations table created"
    fi

    # Apply migrations
    for migration_file in "$MIGRATION_DIR"/*.sql; do
      if [ -f "$migration_file" ]; then
        MIGRATION_NAME=$(basename "$migration_file")

        # Check if migration has already been applied
        if echo "$APPLIED_MIGRATIONS" | grep -q "$MIGRATION_NAME"; then
          step_info "Migration already applied: $MIGRATION_NAME"
        else
          step_info "Applying migration: $MIGRATION_NAME"
          PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"

          # Record migration
          PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            INSERT INTO migrations (migration_name) VALUES ('$MIGRATION_NAME')
          "

          step_success "Migration applied: $MIGRATION_NAME"
        fi
      fi
    done
  else
    step_info "Migration directory not found. Creating directory..."
    mkdir -p "$MIGRATION_DIR"
    step_success "Migration directory created: $MIGRATION_DIR"
    step_info "No migrations to apply"
  fi

  step_success "Database migrations completed"
}

# Seed database
seed_database() {
  section_header "Seeding Database"

  # Check if seed files exist
  SEED_DIR="./code/backend/database/seeds"
  if [ -d "$SEED_DIR" ]; then
    for seed_file in "$SEED_DIR"/*.sql; do
      if [ -f "$seed_file" ]; then
        step_info "Applying seed: $(basename "$seed_file")"
        PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$seed_file"
        step_success "Seed applied: $(basename "$seed_file")"
      fi
    done
  else
    step_info "Seed directory not found. Creating directory and default seed data..."

    # Create seed directory
    mkdir -p "$SEED_DIR"

    # Create default seed file
    cat > "$SEED_DIR/01_test_data.sql" << 'EOF'
-- Test data for Optionix database

-- Insert test users
INSERT INTO users (username, email, password_hash)
VALUES
  ('testuser1', 'test1@example.com', 'pbkdf2:sha256:150000$abc123$1234567890abcdef1234567890abcdef'),
  ('testuser2', 'test2@example.com', 'pbkdf2:sha256:150000$def456$6789012345abcdef6789012345abcdef')
ON CONFLICT (username) DO NOTHING;

-- Insert test options data
INSERT INTO options (symbol, expiration_date, strike_price, option_type, last_price, bid, ask, volume, open_interest, implied_volatility, delta, gamma, theta, vega, rho)
VALUES
  ('AAPL', '2025-06-20', 150.00, 'CALL', 12.35, 12.30, 12.40, 1500, 5000, 0.32, 0.65, 0.03, -0.15, 0.30, 0.05),
  ('AAPL', '2025-06-20', 150.00, 'PUT', 8.20, 8.15, 8.25, 1200, 4500, 0.31, -0.35, 0.03, -0.14, 0.28, -0.04),
  ('AAPL', '2025-06-20', 160.00, 'CALL', 7.50, 7.45, 7.55, 1000, 3800, 0.30, 0.48, 0.04, -0.16, 0.32, 0.04),
  ('AAPL', '2025-06-20', 160.00, 'PUT', 13.10, 13.05, 13.15, 950, 3600, 0.33, -0.52, 0.04, -0.17, 0.33, -0.05),
  ('MSFT', '2025-06-20', 300.00, 'CALL', 25.40, 25.35, 25.45, 800, 3000, 0.28, 0.60, 0.02, -0.18, 0.35, 0.06),
  ('MSFT', '2025-06-20', 300.00, 'PUT', 18.75, 18.70, 18.80, 750, 2800, 0.29, -0.40, 0.02, -0.16, 0.32, -0.05)
ON CONFLICT DO NOTHING;

-- Insert test portfolios
INSERT INTO portfolios (user_id, name, description)
VALUES
  (1, 'Tech Portfolio', 'Technology sector options portfolio'),
  (1, 'Hedged Portfolio', 'Market-neutral hedged positions'),
  (2, 'Income Strategy', 'Focus on generating premium income')
ON CONFLICT DO NOTHING;

-- Insert test positions
INSERT INTO positions (portfolio_id, option_id, quantity, entry_price)
VALUES
  (1, 1, 10, 10.50),
  (1, 3, 5, 6.80),
  (2, 2, 8, 7.90),
  (2, 4, 8, 12.40),
  (3, 5, 3, 24.60),
  (3, 6, 3, 17.80)
ON CONFLICT DO NOTHING;

-- Insert test strategies
INSERT INTO strategies (user_id, name, description)
VALUES
  (1, 'AAPL Bull Spread', 'Bullish call spread on Apple'),
  (1, 'MSFT Iron Condor', 'Range-bound strategy on Microsoft'),
  (2, 'Tech Sector Straddle', 'Volatility play on tech sector')
ON CONFLICT DO NOTHING;

-- Insert test strategy positions
INSERT INTO strategy_positions (strategy_id, option_id, quantity)
VALUES
  (1, 1, 1),
  (1, 3, -1),
  (2, 5, -1),
  (2, 6, -1),
  (3, 1, 1),
  (3, 2, 1)
ON CONFLICT DO NOTHING;
EOF

    # Apply default seed
    step_info "Applying default seed data..."
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_DIR/01_test_data.sql"
    step_success "Default seed data applied"
  fi

  step_success "Database seeding completed"
}

# Backup database
backup_database() {
  section_header "Backing Up Database"

  # Create timestamp for backup file
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

  step_info "Creating backup: $BACKUP_FILE"
  PGPASSWORD=$DB_PASSWORD pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"

  # Compress backup
  step_info "Compressing backup..."
  gzip "$BACKUP_FILE"

  step_success "Database backup completed: ${BACKUP_FILE}.gz"

  # List recent backups
  step_info "Recent backups:"
  ls -lh "$BACKUP_DIR" | tail -n 5
}

# Restore database
restore_database() {
  section_header "Restoring Database"

  # List available backups
  step_info "Available backups:"
  for backup_file in "$BACKUP_DIR"/*; do
    [ -f "$backup_file" ] && ls -lh "$backup_file"
  done

  # Prompt for backup file
  step_info "Please specify the backup file to restore:"
  read -r -p "Backup file: " BACKUP_FILE

  # Check if file exists
  if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ] && [ ! -f "$BACKUP_FILE" ]; then
    step_error "Backup file not found: $BACKUP_FILE" "exit"
  fi

  # Use full path if provided, otherwise use backup directory
  if [ -f "$BACKUP_FILE" ]; then
    FULL_BACKUP_PATH="$BACKUP_FILE"
  else
    FULL_BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
  fi

  # Check if file is compressed
  if [[ "$FULL_BACKUP_PATH" == *.gz ]]; then
    step_info "Decompressing backup file..."
    gunzip -c "$FULL_BACKUP_PATH" > "${FULL_BACKUP_PATH%.gz}.tmp"
    FULL_BACKUP_PATH="${FULL_BACKUP_PATH%.gz}.tmp"
    step_success "Backup file decompressed"
  fi

  # Restore database
  step_info "Restoring database from backup..."

  # Drop and recreate database
  PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
    DROP DATABASE IF EXISTS $DB_NAME;
    CREATE DATABASE $DB_NAME;
  "

  # Restore from backup
  PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$FULL_BACKUP_PATH"

  # Clean up temporary file if created
  if [[ "$FULL_BACKUP_PATH" == *.tmp ]]; then
    rm "$FULL_BACKUP_PATH"
  fi

  step_success "Database restored from backup"
}

# Reset database
reset_database() {
  section_header "Resetting Database"

  step_info "This will drop and recreate the database. All data will be lost."
  read -r -p "Are you sure you want to continue? (y/n): " CONFIRM

  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    step_info "Database reset cancelled"
    return
  fi

  # Drop and recreate database
  step_info "Dropping database '$DB_NAME'..."
  PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
    DROP DATABASE IF EXISTS $DB_NAME;
    CREATE DATABASE $DB_NAME;
  "
  step_success "Database '$DB_NAME' reset"

  # Initialize schema
  setup_database

  # Ask if user wants to seed the database
  read -r -p "Do you want to seed the database with test data? (y/n): " SEED_CONFIRM

  if [ "$SEED_CONFIRM" = "y" ] || [ "$SEED_CONFIRM" = "Y" ]; then
    seed_database
  fi

  step_success "Database reset completed"
}

# Main function
main() {
  echo -e "${YELLOW}=== Optionix Database Management Tool ===${NC}"
  echo -e "${BLUE}$(date)${NC}"

  # Parse command line arguments
  parse_args "$@"

  # Check requirements
  check_requirements

  # Execute command
  case $COMMAND in
    setup)
      setup_database
      ;;
    migrate)
      run_migrations
      ;;
    seed)
      seed_database
      ;;
    backup)
      backup_database
      ;;
    restore)
      restore_database
      ;;
    reset)
      reset_database
      ;;
  esac

  echo -e "\n${GREEN}Database operation completed successfully!${NC}"
}

# Run the main function with all arguments
main "$@"

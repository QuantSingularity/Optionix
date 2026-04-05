#!/bin/bash

# Optionix Backup and Disaster Recovery Script
# Financial Grade Data Protection and Recovery

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/optionix/backup.log"
BACKUP_BASE_DIR="/opt/optionix/backups"
S3_BUCKET="${BACKUP_S3_BUCKET:-optionix-backups}"
ENVIRONMENT="${ENVIRONMENT:-production}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
ENCRYPTION_KEY_FILE="/etc/optionix/backup.key"

# Database configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-optionix}"
DB_USER="${DB_USER:-backup_user}"
DB_PASSWORD_FILE="/etc/optionix/db_backup_password"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check required commands
    for cmd in mysqldump aws gpg tar gzip; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error_exit "Required command not found: $cmd"
        fi
    done

    # Check backup directory
    if [ ! -d "$BACKUP_BASE_DIR" ]; then
        mkdir -p "$BACKUP_BASE_DIR" || error_exit "Cannot create backup directory: $BACKUP_BASE_DIR"
    fi

    # Check encryption key
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        log "Generating new encryption key..."
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
    fi

    # Check database password file
    if [ ! -f "$DB_PASSWORD_FILE" ]; then
        error_exit "Database password file not found: $DB_PASSWORD_FILE"
    fi

    log "Prerequisites check completed"
}

# Database backup
backup_database() {
    log "Starting database backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_BASE_DIR/database_${timestamp}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.gpg"

    # Read database password
    local db_password=$(cat "$DB_PASSWORD_FILE")

    # Create database dump
    log "Creating database dump..."
    mysqldump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$db_password" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        --add-drop-database \
        --databases "$DB_NAME" \
        > "$backup_file" || error_exit "Database dump failed"

    # Compress the dump
    log "Compressing database dump..."
    gzip "$backup_file" || error_exit "Database compression failed"

    # Encrypt the compressed dump
    log "Encrypting database dump..."
    gpg --cipher-algo AES256 --no-symkey-cache \
        --compress-algo 1 \
        --symmetric \
        --batch \
        --yes \
        --passphrase-file "$ENCRYPTION_KEY_FILE" \
        --output "$encrypted_file" \
        "$compressed_file" || error_exit "Database encryption failed"

    # Remove unencrypted file
    rm -f "$compressed_file"

    # Upload to S3
    log "Uploading database backup to S3..."
    aws s3 cp "$encrypted_file" "s3://$S3_BUCKET/database/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 || error_exit "S3 upload failed"

    # Verify backup integrity
    log "Verifying backup integrity..."
    local local_checksum=$(sha256sum "$encrypted_file" | awk '{print $1}')
    local s3_checksum=$(aws s3api head-object --bucket "$S3_BUCKET" --key "database/$(basename "$encrypted_file")" --query 'Metadata.sha256' --output text 2>/dev/null || echo "")

    if [ "$local_checksum" != "$s3_checksum" ]; then
        log "WARNING: Backup checksum verification failed"
    else
        log "Backup integrity verified"
    fi

    log "Database backup completed: $encrypted_file"
    echo "$encrypted_file"
}

# Application data backup
backup_application_data() {
    log "Starting application data backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_BASE_DIR/app_data_${timestamp}.tar.gz"
    local encrypted_file="${backup_file}.gpg"

    # Application directories to backup
    local app_dirs=(
        "/opt/optionix/data"
        "/opt/optionix/config"
        "/opt/optionix/logs"
        "/etc/optionix"
    )

    # Create tar archive
    log "Creating application data archive..."
    tar -czf "$backup_file" \
        --exclude="*.tmp" \
        --exclude="*.log" \
        --exclude="cache/*" \
        "${app_dirs[@]}" 2>/dev/null || {
        log "WARNING: Some files may not have been backed up"
    }

    # Encrypt the archive
    log "Encrypting application data..."
    gpg --cipher-algo AES256 --no-symkey-cache \
        --compress-algo 1 \
        --symmetric \
        --batch \
        --yes \
        --passphrase-file "$ENCRYPTION_KEY_FILE" \
        --output "$encrypted_file" \
        "$backup_file" || error_exit "Application data encryption failed"

    # Remove unencrypted file
    rm -f "$backup_file"

    # Upload to S3
    log "Uploading application data to S3..."
    aws s3 cp "$encrypted_file" "s3://$S3_BUCKET/application/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 || error_exit "S3 upload failed"

    log "Application data backup completed: $encrypted_file"
    echo "$encrypted_file"
}

# Configuration backup
backup_configuration() {
    log "Starting configuration backup..."

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_BASE_DIR/config_${timestamp}.tar.gz"
    local encrypted_file="${backup_file}.gpg"

    # Configuration files and directories
    local config_items=(
        "/etc/nginx"
        "/etc/mysql"
        "/etc/ssl"
        "/etc/optionix"
        "/etc/fail2ban"
        "/etc/audit"
        "/etc/ssh/sshd_config"
        "/etc/ufw"
        "/etc/crontab"
        "/etc/logrotate.d"
    )

    # Create configuration archive
    log "Creating configuration archive..."
    tar -czf "$backup_file" \
        --exclude="*.key" \
        --exclude="*.pem" \
        "${config_items[@]}" 2>/dev/null || {
        log "WARNING: Some configuration files may not have been backed up"
    }

    # Encrypt the archive
    log "Encrypting configuration data..."
    gpg --cipher-algo AES256 --no-symkey-cache \
        --compress-algo 1 \
        --symmetric \
        --batch \
        --yes \
        --passphrase-file "$ENCRYPTION_KEY_FILE" \
        --output "$encrypted_file" \
        "$backup_file" || error_exit "Configuration encryption failed"

    # Remove unencrypted file
    rm -f "$backup_file"

    # Upload to S3
    log "Uploading configuration backup to S3..."
    aws s3 cp "$encrypted_file" "s3://$S3_BUCKET/configuration/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 || error_exit "S3 upload failed"

    log "Configuration backup completed: $encrypted_file"
    echo "$encrypted_file"
}

# Kubernetes backup
backup_kubernetes() {
    log "Starting Kubernetes backup..."

    if ! command -v kubectl >/dev/null 2>&1; then
        log "kubectl not found, skipping Kubernetes backup"
        return 0
    fi

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_BASE_DIR/k8s_${timestamp}"
    local backup_file="${backup_dir}.tar.gz"
    local encrypted_file="${backup_file}.gpg"

    mkdir -p "$backup_dir"

    # Backup all Kubernetes resources
    log "Backing up Kubernetes resources..."

    # Get all namespaces
    kubectl get namespaces -o name | while read -r ns; do
        ns_name=$(echo "$ns" | cut -d'/' -f2)
        mkdir -p "$backup_dir/namespaces/$ns_name"

        # Backup all resources in namespace
        for resource in deployments services configmaps secrets persistentvolumeclaims; do
            kubectl get "$resource" -n "$ns_name" -o yaml > "$backup_dir/namespaces/$ns_name/$resource.yaml" 2>/dev/null || true
        done
    done

    # Backup cluster-wide resources
    mkdir -p "$backup_dir/cluster"
    for resource in nodes persistentvolumes storageclasses; do
        kubectl get "$resource" -o yaml > "$backup_dir/cluster/$resource.yaml" 2>/dev/null || true
    done

    # Create archive
    log "Creating Kubernetes archive..."
    tar -czf "$backup_file" -C "$BACKUP_BASE_DIR" "$(basename "$backup_dir")"

    # Clean up temporary directory
    rm -rf "$backup_dir"

    # Encrypt the archive
    log "Encrypting Kubernetes backup..."
    gpg --cipher-algo AES256 --no-symkey-cache \
        --compress-algo 1 \
        --symmetric \
        --batch \
        --yes \
        --passphrase-file "$ENCRYPTION_KEY_FILE" \
        --output "$encrypted_file" \
        "$backup_file" || error_exit "Kubernetes backup encryption failed"

    # Remove unencrypted file
    rm -f "$backup_file"

    # Upload to S3
    log "Uploading Kubernetes backup to S3..."
    aws s3 cp "$encrypted_file" "s3://$S3_BUCKET/kubernetes/" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256 || error_exit "S3 upload failed"

    log "Kubernetes backup completed: $encrypted_file"
    echo "$encrypted_file"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."

    # Local cleanup
    find "$BACKUP_BASE_DIR" -name "*.gpg" -mtime +7 -delete

    # S3 cleanup (older than retention period)
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)

    for prefix in database application configuration kubernetes; do
        aws s3api list-objects-v2 \
            --bucket "$S3_BUCKET" \
            --prefix "$prefix/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | while read -r key; do
            if [ -n "$key" ] && [ "$key" != "None" ]; then
                log "Deleting old backup: s3://$S3_BUCKET/$key"
                aws s3 rm "s3://$S3_BUCKET/$key"
            fi
        done
    done

    log "Cleanup completed"
}

# Restore database
restore_database() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        error_exit "Backup file not specified for database restore"
    fi

    log "Starting database restore from: $backup_file"

    # Download from S3 if it's an S3 path
    if [[ "$backup_file" == s3://* ]]; then
        local local_file="$BACKUP_BASE_DIR/restore_$(basename "$backup_file")"
        aws s3 cp "$backup_file" "$local_file" || error_exit "Failed to download backup from S3"
        backup_file="$local_file"
    fi

    # Decrypt the backup
    local decrypted_file="${backup_file%.gpg}"
    log "Decrypting backup..."
    gpg --batch \
        --yes \
        --passphrase-file "$ENCRYPTION_KEY_FILE" \
        --output "$decrypted_file" \
        --decrypt "$backup_file" || error_exit "Failed to decrypt backup"

    # Decompress if needed
    if [[ "$decrypted_file" == *.gz ]]; then
        log "Decompressing backup..."
        gunzip "$decrypted_file"
        decrypted_file="${decrypted_file%.gz}"
    fi

    # Read database password
    local db_password=$(cat "$DB_PASSWORD_FILE")

    # Restore database
    log "Restoring database..."
    mysql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$db_password" \
        < "$decrypted_file" || error_exit "Database restore failed"

    # Cleanup temporary files
    rm -f "$decrypted_file"

    log "Database restore completed successfully"
}

# Test backup integrity
test_backup_integrity() {
    log "Testing backup integrity..."

    # Test latest database backup
    local latest_db_backup=$(aws s3 ls "s3://$S3_BUCKET/database/" | sort | tail -1 | awk '{print $4}')
    if [ -n "$latest_db_backup" ]; then
        log "Testing database backup: $latest_db_backup"
        local test_file="$BACKUP_BASE_DIR/test_$(basename "$latest_db_backup")"

        # Download and decrypt
        aws s3 cp "s3://$S3_BUCKET/database/$latest_db_backup" "$test_file"

        # Test decryption
        if gpg --batch --yes --passphrase-file "$ENCRYPTION_KEY_FILE" --decrypt "$test_file" >/dev/null 2>&1; then
            log "Database backup integrity test: PASSED"
        else
            log "Database backup integrity test: FAILED"
        fi

        rm -f "$test_file"
    fi

    log "Backup integrity test completed"
}

# Generate backup report
generate_backup_report() {
    log "Generating backup report..."

    local report_file="/var/log/optionix/backup_report_$(date +%Y%m%d).txt"

    {
        echo "Optionix Backup Report"
        echo "Generated: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo "========================"
        echo

        echo "Backup Status:"
        echo "- Database: $(aws s3 ls "s3://$S3_BUCKET/database/" | wc -l) backups"
        echo "- Application: $(aws s3 ls "s3://$S3_BUCKET/application/" | wc -l) backups"
        echo "- Configuration: $(aws s3 ls "s3://$S3_BUCKET/configuration/" | wc -l) backups"
        echo "- Kubernetes: $(aws s3 ls "s3://$S3_BUCKET/kubernetes/" | wc -l) backups"
        echo

        echo "Latest Backups:"
        echo "- Database: $(aws s3 ls "s3://$S3_BUCKET/database/" | sort | tail -1 | awk '{print $1, $2}')"
        echo "- Application: $(aws s3 ls "s3://$S3_BUCKET/application/" | sort | tail -1 | awk '{print $1, $2}')"
        echo "- Configuration: $(aws s3 ls "s3://$S3_BUCKET/configuration/" | sort | tail -1 | awk '{print $1, $2}')"
        echo "- Kubernetes: $(aws s3 ls "s3://$S3_BUCKET/kubernetes/" | sort | tail -1 | awk '{print $1, $2}')"
        echo

        echo "Storage Usage:"
        aws s3 ls "s3://$S3_BUCKET/" --recursive --human-readable --summarize | tail -2

    } > "$report_file"

    log "Backup report generated: $report_file"
}

# Main backup function
run_backup() {
    log "Starting backup process..."

    check_prerequisites

    local backup_files=()

    # Perform backups
    backup_files+=($(backup_database))
    backup_files+=($(backup_application_data))
    backup_files+=($(backup_configuration))
    backup_files+=($(backup_kubernetes))

    # Test backup integrity
    test_backup_integrity

    # Cleanup old backups
    cleanup_old_backups

    # Generate report
    generate_backup_report

    log "Backup process completed successfully"
    log "Backup files created: ${backup_files[*]}"
}

# Main function
main() {
    case "${1:-backup}" in
        backup)
            run_backup
            ;;
        restore-db)
            [ -n "${2:-}" ] || { echo "Usage: $0 restore-db <backup_file>"; exit 1; }; restore_database "$2"
            ;;
        test)
            test_backup_integrity
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        report)
            generate_backup_report
            ;;
        *)
            echo "Usage: $0 {backup|restore-db <file>|test|cleanup|report}"
            exit 1
            ;;
    esac
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"

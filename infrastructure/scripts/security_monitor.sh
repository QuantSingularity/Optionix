#!/bin/bash

# Optionix Security Monitoring and Compliance Script
# Financial Grade Security Monitoring and Alerting

set -euo pipefail

# Configuration
LOG_FILE="/var/log/optionix/security_monitor.log"
ALERT_EMAIL="security@optionix.com"
METRICS_ENDPOINT="http://localhost:9091/metrics/job/security_monitor"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Alert function
send_alert() {
    local severity=$1
    local message=$2
    local subject="[OPTIONIX-${ENVIRONMENT}] Security Alert - ${severity}"

    log "ALERT [$severity]: $message"

    # Send email alert. `mail` is frequently unavailable (esp. in
    # containers/minimal images) - since this IS the alerting mechanism,
    # it must never let a missing/failing `mail` command kill the whole
    # monitoring run (which `set -e` would otherwise do here).
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL" || log "WARN: failed to send email alert"
    else
        log "WARN: 'mail' command not found - skipping email alert"
    fi

    # Send to monitoring system
    curl -X POST "$METRICS_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "{\"alert\":\"$severity\",\"message\":\"$message\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
        2>/dev/null || true
}

# Resolve the system auth log path. /var/log/auth.log is Debian/Ubuntu-
# specific; RHEL/CentOS-family systems use /var/log/secure instead, and
# some minimal or containerized systems have neither. Echoes the path if
# found, or nothing (with a warning to the log) if not.
detect_auth_log() {
    if [ -f /var/log/auth.log ]; then
        echo "/var/log/auth.log"
    elif [ -f /var/log/secure ]; then
        echo "/var/log/secure"
    fi
}

# Check system integrity
check_system_integrity() {
    log "Checking system integrity..."

    # AIDE integrity check
    if command -v aide >/dev/null 2>&1; then
        if ! aide --check --config=/etc/aide/aide.conf 2>/dev/null; then
            send_alert "HIGH" "File integrity violation detected by AIDE"
        fi
    fi

    # Check for rootkits
    if command -v rkhunter >/dev/null 2>&1; then
        if ! rkhunter --check --skip-keypress --report-warnings-only 2>/dev/null; then
            send_alert "CRITICAL" "Rootkit detection alert from rkhunter"
        fi
    fi

    # Check for malware
    if command -v clamscan >/dev/null 2>&1; then
        if ! clamscan -r /opt/optionix --quiet --infected 2>/dev/null; then
            send_alert "CRITICAL" "Malware detected in application directory"
        fi
    fi
}

# Monitor authentication events
check_authentication() {
    log "Monitoring authentication events..."

    # /var/log/auth.log is Debian/Ubuntu-specific; RHEL/CentOS-family
    # systems log this to /var/log/secure instead, and some minimal or
    # containerized systems have neither. Guard against both, consistent
    # with how every other log file below is checked before use.
    local auth_log
    auth_log=$(detect_auth_log)
    if [ -z "$auth_log" ]; then
        log "WARN: no auth log found at /var/log/auth.log or /var/log/secure - skipping authentication checks"
        return 0
    fi

    # Check for failed SSH attempts
    local failed_ssh
    failed_ssh=$(grep "Failed password" "$auth_log" | grep -c "$(date '+%b %d')" || true)
    if [ "$failed_ssh" -gt 50 ]; then
        send_alert "HIGH" "Excessive SSH login failures detected: $failed_ssh attempts today"
    fi

    # Check for successful root logins
    local root_logins
    root_logins=$(grep "Accepted.*root" "$auth_log" | grep -c "$(date '+%b %d')" || true)
    if [ "$root_logins" -gt 0 ]; then
        send_alert "CRITICAL" "Root login detected: $root_logins successful root logins today"
    fi

    # Check for privilege escalation
    local sudo_usage
    sudo_usage=$(grep "sudo:" "$auth_log" | grep -c "$(date '+%b %d')" || true)
    if [ "$sudo_usage" -gt 100 ]; then
        send_alert "MEDIUM" "High sudo usage detected: $sudo_usage sudo commands today"
    fi
}

# Monitor network activity
check_network_security() {
    log "Checking network security..."

    if command -v netstat >/dev/null 2>&1; then
        # Check for unusual network connections
        local external_connections
        external_connections=$(netstat -tn | grep ESTABLISHED | grep -vc "127.0.0.1\|10\.\|192\.168\." || true)
        if [ "$external_connections" -gt 100 ]; then
            send_alert "MEDIUM" "High number of external connections: $external_connections"
        fi

        # Check for listening services
        local listening_ports
        listening_ports=$(netstat -tln | grep -c LISTEN || true)
        if [ "$listening_ports" -gt 20 ]; then
            send_alert "LOW" "Many listening ports detected: $listening_ports ports"
        fi
    elif command -v ss >/dev/null 2>&1; then
        # netstat (net-tools) isn't installed by default on many modern
        # distributions anymore - ss (iproute2) is the standard
        # replacement and ships with virtually every current system.
        local external_connections
        external_connections=$(ss -tn state established | grep -vc "127.0.0.1\|10\.\|192\.168\." || true)
        if [ "$external_connections" -gt 100 ]; then
            send_alert "MEDIUM" "High number of external connections: $external_connections"
        fi

        local listening_ports
        listening_ports=$(ss -tln | grep -c LISTEN || true)
        if [ "$listening_ports" -gt 20 ]; then
            send_alert "LOW" "Many listening ports detected: $listening_ports ports"
        fi
    else
        log "WARN: neither netstat nor ss found - skipping connection checks"
    fi

    # Check firewall status
    if command -v ufw >/dev/null 2>&1; then
        if ! ufw status | grep -q "Status: active"; then
            send_alert "CRITICAL" "UFW firewall is not active"
        fi
    fi
}

# Monitor application security
check_application_security() {
    log "Checking application security..."

    # Check application logs for security events
    local app_log="/var/log/optionix/application.log"
    if [ -f "$app_log" ]; then
        # Check for SQL injection attempts
        local sql_injection
        sql_injection=$(grep -i "union\|select\|drop\|insert\|update\|delete" "$app_log" | grep -c "$(date '+%Y-%m-%d')" || true)
        if [ "$sql_injection" -gt 10 ]; then
            send_alert "HIGH" "Potential SQL injection attempts detected: $sql_injection events"
        fi

        # Check for XSS attempts
        local xss_attempts
        xss_attempts=$(grep -i "script\|javascript\|onerror\|onload" "$app_log" | grep -c "$(date '+%Y-%m-%d')" || true)
        if [ "$xss_attempts" -gt 5 ]; then
            send_alert "HIGH" "Potential XSS attempts detected: $xss_attempts events"
        fi

        # Check for authentication failures
        local auth_failures
        auth_failures=$(grep -i "authentication failed\|invalid credentials\|login failed" "$app_log" | grep -c "$(date '+%Y-%m-%d')" || true)
        if [ "$auth_failures" -gt 100 ]; then
            send_alert "MEDIUM" "High authentication failure rate: $auth_failures failures today"
        fi
    fi
}

# Monitor database security
check_database_security() {
    log "Checking database security..."

    # Check MySQL error log for security events
    local mysql_error_log="/var/log/mysql/error.log"
    if [ -f "$mysql_error_log" ]; then
        # Check for access denied events
        local access_denied
        access_denied=$(grep "Access denied" "$mysql_error_log" | grep -c "$(date '+%Y-%m-%d')" || true)
        if [ "$access_denied" -gt 50 ]; then
            send_alert "MEDIUM" "High database access denial rate: $access_denied denials today"
        fi

        # Check for connection errors
        local conn_errors
        conn_errors=$(grep "connection.*error" "$mysql_error_log" | grep -c "$(date '+%Y-%m-%d')" || true)
        if [ "$conn_errors" -gt 20 ]; then
            send_alert "MEDIUM" "High database connection error rate: $conn_errors errors today"
        fi
    fi

    # Check database binary log for suspicious activity
    if command -v mysql >/dev/null 2>&1; then
        # This would require database credentials - implement based on your setup
        log "Database binary log check would be implemented with proper credentials"
    fi
}

# Check compliance requirements
check_compliance() {
    log "Checking compliance requirements..."

    # Check audit log retention
    local audit_log="/var/log/audit/audit.log"
    if [ -f "$audit_log" ]; then
        local log_age=$(find "$audit_log" -mtime +30 | wc -l)
        if [ "$log_age" -eq 0 ]; then
            send_alert "LOW" "Audit logs may not be properly rotated (no logs older than 30 days)"
        fi
    fi

    # Check SSL certificate expiration
    if command -v openssl >/dev/null 2>&1; then
        local cert_file="/etc/ssl/certs/optionix.crt"
        if [ -f "$cert_file" ]; then
            local cert_expiry=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
            local expiry_epoch=$(date -d "$cert_expiry" +%s)
            local current_epoch=$(date +%s)
            local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))

            if [ "$days_until_expiry" -lt 30 ]; then
                send_alert "HIGH" "SSL certificate expires in $days_until_expiry days"
            fi
        fi
    fi

    # Check backup status
    local backup_log="/var/log/optionix/backup.log"
    if [ -f "$backup_log" ]; then
        local last_backup
        last_backup=$(grep "Backup completed" "$backup_log" | tail -1 | awk '{print $1, $2}' || true)
        if [ -n "$last_backup" ]; then
            local backup_epoch=$(date -d "$last_backup" +%s)
            local current_epoch=$(date +%s)
            local hours_since_backup=$(( (current_epoch - backup_epoch) / 3600 ))

            if [ "$hours_since_backup" -gt 48 ]; then
                send_alert "HIGH" "Last successful backup was $hours_since_backup hours ago"
            fi
        fi
    fi
}

# Monitor system resources
check_system_resources() {
    log "Checking system resources..."

    # Check disk usage
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        send_alert "HIGH" "High disk usage: ${disk_usage}%"
    fi

    # Check memory usage
    local mem_usage=$(free | awk 'NR==2{printf "%.2f", $3*100/$2}')
    if (( $(echo "$mem_usage > 90" | bc -l) )); then
        send_alert "HIGH" "High memory usage: ${mem_usage}%"
    fi

    # Check CPU load
    local cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local cpu_cores=$(nproc)
    if (( $(echo "$cpu_load > $cpu_cores * 2" | bc -l) )); then
        send_alert "MEDIUM" "High CPU load: $cpu_load (cores: $cpu_cores)"
    fi
}

# Generate compliance report
generate_compliance_report() {
    log "Generating compliance report..."

    local report_file="/var/log/optionix/compliance_report_$(date +%Y%m%d).txt"

    {
        echo "Optionix Security and Compliance Report"
        echo "Generated: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo "========================================"
        echo

        echo "System Information:"
        echo "- Hostname: $(hostname)"
        echo "- OS: $(command -v lsb_release >/dev/null 2>&1 && lsb_release -d | cut -f2 || echo 'Unknown')"
        echo "- Kernel: $(uname -r)"
        echo "- Uptime: $(uptime -p)"
        echo

        echo "Security Services Status:"
        systemctl is-active fail2ban 2>/dev/null && echo "- Fail2ban: Active" || echo "- Fail2ban: Inactive"
        systemctl is-active auditd 2>/dev/null && echo "- Auditd: Active" || echo "- Auditd: Inactive"
        systemctl is-active clamav-daemon 2>/dev/null && echo "- ClamAV: Active" || echo "- ClamAV: Inactive"
        ufw status 2>/dev/null | grep -q "Status: active" && echo "- UFW: Active" || echo "- UFW: Inactive"
        echo

        echo "Recent Security Events:"
        local report_auth_log
        report_auth_log=$(detect_auth_log)
        if [ -n "$report_auth_log" ]; then
            echo "- Failed SSH attempts (last 24h): $(grep "Failed password" "$report_auth_log" | grep -c "$(date '+%b %d')" || true)"
            echo "- Successful logins (last 24h): $(grep "Accepted" "$report_auth_log" | grep -c "$(date '+%b %d')" || true)"
            echo "- Sudo usage (last 24h): $(grep "sudo:" "$report_auth_log" | grep -c "$(date '+%b %d')" || true)"
        else
            echo "- No auth log found at /var/log/auth.log or /var/log/secure"
        fi
        echo

        echo "File Integrity:"
        if command -v aide >/dev/null 2>&1; then
            echo "- AIDE last run: $(stat -c %y /var/lib/aide/aide.db 2>/dev/null || echo 'Never')"
        fi
        echo

        echo "Backup Status:"
        if [ -f "/var/log/optionix/backup.log" ]; then
            echo "- Last backup: $(grep "Backup completed" /var/log/optionix/backup.log | tail -1 | awk '{print $1, $2}' || echo 'Unknown')"
        fi
        echo

        echo "Certificate Status:"
        if [ -f "/etc/ssl/certs/optionix.crt" ]; then
            echo "- SSL certificate expires: $(openssl x509 -in /etc/ssl/certs/optionix.crt -noout -enddate | cut -d= -f2)"
        fi

    } > "$report_file"

    log "Compliance report generated: $report_file"

    # Email the report
    if command -v mail >/dev/null 2>&1; then
        mail -s "[OPTIONIX-${ENVIRONMENT}] Daily Compliance Report" "$ALERT_EMAIL" < "$report_file" \
            || log "WARN: failed to email compliance report"
    else
        log "WARN: 'mail' command not found - compliance report saved to $report_file but not emailed"
    fi
}

# Main execution
main() {
    log "Starting security monitoring cycle..."

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"

    # Run all security checks
    check_system_integrity
    check_authentication
    check_network_security
    check_application_security
    check_database_security
    check_compliance
    check_system_resources

    # Generate daily compliance report (only at midnight)
    if [ "$(date +%H%M)" = "0000" ]; then
        generate_compliance_report
    fi

    log "Security monitoring cycle completed"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"

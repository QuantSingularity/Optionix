#!/bin/bash

# Optionix Infrastructure Validation Script
# Comprehensive testing for financial-grade infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/optionix/validation.log"
REPORT_FILE="/var/log/optionix/validation_report_$(date +%Y%m%d_%H%M%S).txt"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Test result functions
test_start() {
    local test_name="$1"
    echo -e "${BLUE}[TEST]${NC} Starting: $test_name"
    ((TOTAL_TESTS++))
}

test_pass() {
    local test_name="$1"
    echo -e "${GREEN}[PASS]${NC} $test_name"
    ((PASSED_TESTS++))
    log "PASS: $test_name"
}

test_fail() {
    local test_name="$1"
    local reason="$2"
    echo -e "${RED}[FAIL]${NC} $test_name - $reason"
    ((FAILED_TESTS++))
    log "FAIL: $test_name - $reason"
}

test_warn() {
    local test_name="$1"
    local reason="$2"
    echo -e "${YELLOW}[WARN]${NC} $test_name - $reason"
    ((WARNINGS++))
    log "WARN: $test_name - $reason"
}

# Ansible validation
validate_ansible() {
    echo -e "\n${BLUE}=== Ansible Configuration Validation ===${NC}"

    # Check Ansible installation
    test_start "Ansible Installation"
    if command -v ansible >/dev/null 2>&1; then
        test_pass "Ansible Installation"
    else
        test_fail "Ansible Installation" "Ansible not found"
        return 1
    fi

    # Check playbook syntax
    test_start "Ansible Playbook Syntax"
    local ansible_dir="$(dirname "$SCRIPT_DIR")/ansible"
    if [ -d "$ansible_dir" ]; then
        local syntax_errors=0
        find "$ansible_dir" -name "*.yml" -o -name "*.yaml" | while read -r playbook; do
            if ! ansible-playbook --syntax-check "$playbook" >/dev/null 2>&1; then
                ((syntax_errors++))
                echo "Syntax error in: $playbook"
            fi
        done

        if [ $syntax_errors -eq 0 ]; then
            test_pass "Ansible Playbook Syntax"
        else
            test_fail "Ansible Playbook Syntax" "$syntax_errors syntax errors found"
        fi
    else
        test_fail "Ansible Playbook Syntax" "Ansible directory not found"
    fi

    # Validate role structure
    test_start "Ansible Role Structure"
    local roles_dir="$ansible_dir/roles"
    if [ -d "$roles_dir" ]; then
        local role_errors=0
        for role in "$roles_dir"/*; do
            if [ -d "$role" ]; then
                local role_name=$(basename "$role")

                # Check required directories
                for req_dir in tasks handlers templates vars; do
                    if [ ! -d "$role/$req_dir" ]; then
                        echo "Missing directory in role $role_name: $req_dir"
                        ((role_errors++))
                    fi
                done

                # Check main.yml files
                if [ ! -f "$role/tasks/main.yml" ]; then
                    echo "Missing main.yml in role $role_name/tasks"
                    ((role_errors++))
                fi
            fi
        done

        if [ $role_errors -eq 0 ]; then
            test_pass "Ansible Role Structure"
        else
            test_fail "Ansible Role Structure" "$role_errors structure issues found"
        fi
    else
        test_fail "Ansible Role Structure" "Roles directory not found"
    fi
}

# Kubernetes validation
validate_kubernetes() {
    echo -e "\n${BLUE}=== Kubernetes Configuration Validation ===${NC}"

    # Check kubectl installation
    test_start "kubectl Installation"
    if command -v kubectl >/dev/null 2>&1; then
        test_pass "kubectl Installation"
    else
        test_warn "kubectl Installation" "kubectl not found - skipping K8s tests"
        return 0
    fi

    # Validate YAML syntax
    test_start "Kubernetes YAML Syntax"
    local k8s_dir="/Optionix/infrastructure/kubernetes"
    if [ -d "$k8s_dir" ]; then
        local yaml_errors=0
        find "$k8s_dir" -name "*.yaml" -o -name "*.yml" | while read -r yaml_file; do
            if ! kubectl apply --dry-run=client -f "$yaml_file" >/dev/null 2>&1; then
                ((yaml_errors++))
                echo "YAML validation error in: $yaml_file"
            fi
        done

        if [ $yaml_errors -eq 0 ]; then
            test_pass "Kubernetes YAML Syntax"
        else
            test_fail "Kubernetes YAML Syntax" "$yaml_errors validation errors found"
        fi
    else
        test_fail "Kubernetes YAML Syntax" "Kubernetes directory not found"
    fi

    # Check security policies
    test_start "Kubernetes Security Policies"
    local security_files=(
        "$k8s_dir/base/pod-security-policy.yaml"
        "$k8s_dir/base/network-policies.yaml"
    )

    local missing_security=0
    for file in "${security_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo "Missing security file: $file"
            ((missing_security++))
        fi
    done

    if [ $missing_security -eq 0 ]; then
        test_pass "Kubernetes Security Policies"
    else
        test_fail "Kubernetes Security Policies" "$missing_security security files missing"
    fi

    # Validate resource limits
    test_start "Kubernetes Resource Limits"
    local deployments_without_limits=0
    find "$k8s_dir" -name "*deployment*.yaml" | while read -r deployment; do
        if ! grep -q "resources:" "$deployment" || ! grep -q "limits:" "$deployment"; then
            echo "Deployment without resource limits: $deployment"
            ((deployments_without_limits++))
        fi
    done

    if [ $deployments_without_limits -eq 0 ]; then
        test_pass "Kubernetes Resource Limits"
    else
        test_warn "Kubernetes Resource Limits" "$deployments_without_limits deployments without resource limits"
    fi
}

# Terraform validation
validate_terraform() {
    echo -e "\n${BLUE}=== Terraform Configuration Validation ===${NC}"

    # Check Terraform installation
    test_start "Terraform Installation"
    if command -v terraform >/dev/null 2>&1; then
        test_pass "Terraform Installation"
    else
        test_warn "Terraform Installation" "Terraform not found - skipping TF tests"
        return 0
    fi

    # Validate Terraform syntax
    test_start "Terraform Syntax Validation"
    local tf_dir="/Optionix/infrastructure/terraform"
    if [ -d "$tf_dir" ]; then
        cd "$tf_dir"
        if terraform validate >/dev/null 2>&1; then
            test_pass "Terraform Syntax Validation"
        else
            test_fail "Terraform Syntax Validation" "Terraform validation failed"
        fi
        cd - >/dev/null
    else
        test_fail "Terraform Syntax Validation" "Terraform directory not found"
    fi

    # Check Terraform formatting
    test_start "Terraform Code Formatting"
    if [ -d "$tf_dir" ]; then
        cd "$tf_dir"
        if terraform fmt -check >/dev/null 2>&1; then
            test_pass "Terraform Code Formatting"
        else
            test_warn "Terraform Code Formatting" "Code formatting issues found"
        fi
        cd - >/dev/null
    else
        test_fail "Terraform Code Formatting" "Terraform directory not found"
    fi

    # Validate module structure
    test_start "Terraform Module Structure"
    local modules_dir="$tf_dir/modules"
    if [ -d "$modules_dir" ]; then
        local module_errors=0
        for module in "$modules_dir"/*; do
            if [ -d "$module" ]; then
                local module_name=$(basename "$module")

                # Check required files
                for req_file in main.tf variables.tf outputs.tf; do
                    if [ ! -f "$module/$req_file" ]; then
                        echo "Missing file in module $module_name: $req_file"
                        ((module_errors++))
                    fi
                done
            fi
        done

        if [ $module_errors -eq 0 ]; then
            test_pass "Terraform Module Structure"
        else
            test_fail "Terraform Module Structure" "$module_errors structure issues found"
        fi
    else
        test_fail "Terraform Module Structure" "Modules directory not found"
    fi
}

# Security validation
validate_security() {
    echo -e "\n${BLUE}=== Security Configuration Validation ===${NC}"

    # Check security scripts
    test_start "Security Scripts Presence"
    local security_scripts=(
        "/Optionix/infrastructure/scripts/security_monitor.sh"
        "/Optionix/infrastructure/scripts/backup_recovery.sh"
    )

    local missing_scripts=0
    for script in "${security_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            echo "Missing security script: $script"
            ((missing_scripts++))
        elif [ ! -x "$script" ]; then
            echo "Security script not executable: $script"
            ((missing_scripts++))
        fi
    done

    if [ $missing_scripts -eq 0 ]; then
        test_pass "Security Scripts Presence"
    else
        test_fail "Security Scripts Presence" "$missing_scripts script issues found"
    fi

    # Validate Ansible security templates
    test_start "Security Configuration Templates"
    local security_templates=(
        "$(dirname "$SCRIPT_DIR")/ansible/roles/common/templates/sshd_config.j2"
        "$(dirname "$SCRIPT_DIR")/ansible/roles/common/templates/jail.local.j2"
        "$(dirname "$SCRIPT_DIR")/ansible/roles/common/templates/audit.rules.j2"
    )

    local missing_templates=0
    for template in "${security_templates[@]}"; do
        if [ ! -f "$template" ]; then
            echo "Missing security template: $template"
            ((missing_templates++))
        fi
    done

    if [ $missing_templates -eq 0 ]; then
        test_pass "Security Configuration Templates"
    else
        test_fail "Security Configuration Templates" "$missing_templates templates missing"
    fi

    # Check for hardcoded secrets
    test_start "Hardcoded Secrets Check"
    local secret_patterns=(
        "password.*="
        "secret.*="
        "key.*="
        "token.*="
        "api_key.*="
    )

    local secrets_found=0
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -i "$pattern" /Optionix/infrastructure/ --include="*.yml" --include="*.yaml" --include="*.tf" | grep -v "password_file\|secret_name\|key_name" >/dev/null 2>&1; then
            ((secrets_found++))
        fi
    done

    if [ $secrets_found -eq 0 ]; then
        test_pass "Hardcoded Secrets Check"
    else
        test_warn "Hardcoded Secrets Check" "Potential hardcoded secrets found"
    fi
}

# Compliance validation
validate_compliance() {
    echo -e "\n${BLUE}=== Compliance Validation ===${NC}"

    # Check audit logging configuration
    test_start "Audit Logging Configuration"
    local audit_config="$(dirname "$SCRIPT_DIR")/ansible/roles/common/templates/audit.rules.j2"
    if [ -f "$audit_config" ]; then
        # Check for required audit rules
        local required_rules=(
            "authentication"
            "file_access"
            "privilege_escalation"
            "network_config"
            "system_calls"
        )

        local missing_rules=0
        for rule in "${required_rules[@]}"; do
            if ! grep -q "$rule" "$audit_config"; then
                echo "Missing audit rule category: $rule"
                ((missing_rules++))
            fi
        done

        if [ $missing_rules -eq 0 ]; then
            test_pass "Audit Logging Configuration"
        else
            test_warn "Audit Logging Configuration" "$missing_rules rule categories missing"
        fi
    else
        test_fail "Audit Logging Configuration" "Audit configuration file not found"
    fi

    # Check encryption configuration
    test_start "Encryption Configuration"
    local encryption_configs=0

    # Check Terraform encryption
    if grep -r "encryption" /Optionix/infrastructure/terraform/ >/dev/null 2>&1; then
        ((encryption_configs++))
    fi

    # Check Kubernetes secrets
    if grep -r "kind: Secret" /Optionix/infrastructure/kubernetes/ >/dev/null 2>&1; then
        ((encryption_configs++))
    fi

    # Check database encryption
    if grep -r "ssl\|tls\|encryption" $(dirname "$SCRIPT_DIR")/ansible/roles/database/ >/dev/null 2>&1; then
        ((encryption_configs++))
    fi

    if [ $encryption_configs -ge 2 ]; then
        test_pass "Encryption Configuration"
    else
        test_warn "Encryption Configuration" "Limited encryption configuration found"
    fi

    # Check backup and recovery
    test_start "Backup and Recovery Configuration"
    local backup_script="/Optionix/infrastructure/scripts/backup_recovery.sh"
    if [ -f "$backup_script" ] && [ -x "$backup_script" ]; then
        # Check for encryption in backup script
        if grep -q "gpg\|encryption" "$backup_script"; then
            test_pass "Backup and Recovery Configuration"
        else
            test_warn "Backup and Recovery Configuration" "Backup encryption not configured"
        fi
    else
        test_fail "Backup and Recovery Configuration" "Backup script missing or not executable"
    fi

    # Check monitoring configuration
    test_start "Monitoring Configuration"
    local monitoring_files=(
        "/Optionix/infrastructure/kubernetes/base/monitoring-stack.yaml"
        "/Optionix/infrastructure/scripts/security_monitor.sh"
    )

    local monitoring_configured=0
    for file in "${monitoring_files[@]}"; do
        if [ -f "$file" ]; then
            ((monitoring_configured++))
        fi
    done

    if [ $monitoring_configured -eq ${#monitoring_files[@]} ]; then
        test_pass "Monitoring Configuration"
    else
        test_warn "Monitoring Configuration" "Some monitoring components missing"
    fi
}

# Network security validation
validate_network_security() {
    echo -e "\n${BLUE}=== Network Security Validation ===${NC}"

    # Check network policies
    test_start "Kubernetes Network Policies"
    local network_policies="/Optionix/infrastructure/kubernetes/base/network-policies.yaml"
    if [ -f "$network_policies" ]; then
        # Check for default deny policy
        if grep -q "default-deny-all" "$network_policies"; then
            test_pass "Kubernetes Network Policies"
        else
            test_warn "Kubernetes Network Policies" "Default deny policy not found"
        fi
    else
        test_fail "Kubernetes Network Policies" "Network policies file not found"
    fi

    # Check firewall configuration
    test_start "Firewall Configuration"
    local firewall_configs=0

    # Check Ansible firewall tasks
    if grep -r "ufw\|firewall" $(dirname "$SCRIPT_DIR")/ansible/ >/dev/null 2>&1; then
        ((firewall_configs++))
    fi

    # Check Terraform security groups
    if grep -r "security_group" /Optionix/infrastructure/terraform/ >/dev/null 2>&1; then
        ((firewall_configs++))
    fi

    if [ $firewall_configs -ge 2 ]; then
        test_pass "Firewall Configuration"
    else
        test_warn "Firewall Configuration" "Limited firewall configuration found"
    fi

    # Check SSL/TLS configuration
    test_start "SSL/TLS Configuration"
    local ssl_configs=0

    # Check Nginx SSL configuration
    if grep -r "ssl\|tls" $(dirname "$SCRIPT_DIR")/ansible/roles/webserver/ >/dev/null 2>&1; then
        ((ssl_configs++))
    fi

    # Check database SSL
    if grep -r "ssl\|tls" $(dirname "$SCRIPT_DIR")/ansible/roles/database/ >/dev/null 2>&1; then
        ((ssl_configs++))
    fi

    if [ $ssl_configs -ge 2 ]; then
        test_pass "SSL/TLS Configuration"
    else
        test_warn "SSL/TLS Configuration" "Limited SSL/TLS configuration found"
    fi
}

# Generate validation report
generate_report() {
    echo -e "\n${BLUE}=== Generating Validation Report ===${NC}"

    {
        echo "Optionix Infrastructure Validation Report"
        echo "Generated: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo "=========================================="
        echo

        echo "Test Summary:"
        echo "- Total Tests: $TOTAL_TESTS"
        echo "- Passed: $PASSED_TESTS"
        echo "- Failed: $FAILED_TESTS"
        echo "- Warnings: $WARNINGS"
        echo

        local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
        echo "Success Rate: ${success_rate}%"
        echo

        if [ $FAILED_TESTS -eq 0 ]; then
            echo "Overall Status: PASSED"
        else
            echo "Overall Status: FAILED"
        fi
        echo

        echo "Recommendations:"
        if [ $FAILED_TESTS -gt 0 ]; then
            echo "- Address all failed tests before deployment"
        fi
        if [ $WARNINGS -gt 0 ]; then
            echo "- Review and address warning items"
        fi
        echo "- Regularly run validation tests"
        echo "- Monitor security configurations"
        echo "- Keep infrastructure code updated"

    } > "$REPORT_FILE"

    echo "Validation report generated: $REPORT_FILE"
}

# Main validation function
main() {
    echo -e "${BLUE}Optionix Infrastructure Validation${NC}"
    echo -e "${BLUE}===================================${NC}"

    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"

    log "Starting infrastructure validation..."

    # Run all validations
    validate_ansible
    validate_kubernetes
    validate_terraform
    validate_security
    validate_compliance
    validate_network_security

    # Generate report
    generate_report

    # Final summary
    echo -e "\n${BLUE}=== Validation Summary ===${NC}"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"

    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Success Rate: ${success_rate}%"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}✓ Infrastructure validation PASSED${NC}"
        log "Infrastructure validation completed successfully"
        exit 0
    else
        echo -e "\n${RED}✗ Infrastructure validation FAILED${NC}"
        log "Infrastructure validation failed with $FAILED_TESTS failures"
        exit 1
    fi
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"

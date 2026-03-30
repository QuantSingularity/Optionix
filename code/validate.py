"""
Validation Script for Optionix Platform
Validates security, compliance, and financial standards implementation
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from core.logging import get_logger

logger = get_logger(__name__)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ValidationResult:
    """Validation result container"""

    def __init__(
        self,
        category: str,
        test_name: str,
        passed: bool,
        message: str,
        details: Dict[str, Any] = None,
    ) -> None:
        self.category = category
        self.test_name = test_name
        self.passed = passed
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.utcnow()


class Validator:
    """validation for Optionix platform"""

    def __init__(self, code_directory: str) -> None:
        self.code_directory = Path(code_directory)
        self.results: List[ValidationResult] = []

    def validate_all(self) -> Dict[str, Any]:
        """Run all validation checks"""
        logger.info("Starting comprehensive validation...")
        self.validate_file_structure()
        self.validate_security_features()
        self.validate_compliance_features()
        self.validate_code_quality()
        self.validate_financial_standards()
        self.validate_infrastructure()
        return self.generate_report()

    def validate_file_structure(self) -> Any:
        """Validate file structure and organization"""
        logger.info("Validating file structure...")
        required_files = [
            "backend/app.py",
            "backend/auth.py",
            "backend/security.py",
            "backend/monitoring.py",
            "quantitative/black_scholes.py",
            "ai_models/create_model.py",
            "blockchain/contracts/OptionsContract.sol",
            "requirements.txt",
            "Dockerfile",
            "docker-compose.yml",
            "entrypoint.sh",
        ]
        for file_path in required_files:
            full_path = self.code_directory / file_path
            if full_path.exists():
                self.results.append(
                    ValidationResult(
                        "File Structure",
                        f"Required file: {file_path}",
                        True,
                        f"File {file_path} exists",
                    )
                )
            else:
                self.results.append(
                    ValidationResult(
                        "File Structure",
                        f"Required file: {file_path}",
                        False,
                        f"Missing required file: {file_path}",
                    )
                )
        required_dirs = [
            "backend",
            "quantitative",
            "ai_models",
            "blockchain/contracts",
            "tests",
        ]
        for dir_path in required_dirs:
            full_path = self.code_directory / dir_path
            if full_path.is_dir():
                self.results.append(
                    ValidationResult(
                        "File Structure",
                        f"Required directory: {dir_path}",
                        True,
                        f"Directory {dir_path} exists",
                    )
                )
            else:
                self.results.append(
                    ValidationResult(
                        "File Structure",
                        f"Required directory: {dir_path}",
                        False,
                        f"Missing required directory: {dir_path}",
                    )
                )

    def validate_security_features(self) -> Any:
        """Validate security implementation"""
        logger.info("Validating security features...")
        security_file = self.code_directory / "backend" / "security.py"
        if security_file.exists():
            content = security_file.read_text()
            security_features = [
                ("Password Hashing", "bcrypt" in content or "hash_password" in content),
                ("Data Encryption", "encrypt" in content and "decrypt" in content),
                ("Input Sanitization", "sanitize" in content),
                ("Rate Limiting", "rate_limit" in content),
                ("Audit Logging", "audit" in content and "log" in content),
                ("CSRF Protection", "csrf" in content.lower()),
                (
                    "SQL Injection Prevention",
                    "sanitize" in content or "escape" in content,
                ),
            ]
            for feature_name, has_feature in security_features:
                self.results.append(
                    ValidationResult(
                        "Security",
                        feature_name,
                        has_feature,
                        f"{feature_name} {('implemented' if has_feature else 'missing')}",
                    )
                )
        else:
            self.results.append(
                ValidationResult(
                    "Security", "Security Module", False, "Security module not found"
                )
            )

    def validate_compliance_features(self) -> Any:
        """Validate compliance implementation"""
        logger.info("Validating compliance features...")
        monitoring_file = self.code_directory / "backend" / "monitoring.py"
        if monitoring_file.exists():
            content = monitoring_file.read_text()
            compliance_features = [
                ("Transaction Monitoring", "monitor_transaction" in content),
                (
                    "AML Compliance",
                    "aml" in content.lower() or "anti_money_laundering" in content,
                ),
                (
                    "KYC Validation",
                    "kyc" in content.lower() or "know_your_customer" in content,
                ),
                ("Regulatory Reporting", "regulatory_report" in content),
                ("Audit Trail", "audit" in content and "trail" in content),
                ("Risk Assessment", "risk" in content and "assess" in content),
                ("Sanctions Screening", "sanctions" in content),
                ("Suspicious Activity Detection", "suspicious" in content),
            ]
            for feature_name, has_feature in compliance_features:
                self.results.append(
                    ValidationResult(
                        "Compliance",
                        feature_name,
                        has_feature,
                        f"{feature_name} {('implemented' if has_feature else 'missing')}",
                    )
                )
        else:
            self.results.append(
                ValidationResult(
                    "Compliance",
                    "Monitoring Module",
                    False,
                    "Monitoring module not found",
                )
            )

    def validate_code_quality(self) -> Any:
        """Validate code quality standards"""
        logger.info("Validating code quality...")
        python_files = list(self.code_directory.rglob("*.py"))
        quality_checks = {
            "Type Hints": 0,
            "Docstrings": 0,
            "Error Handling": 0,
            "Logging": 0,
            "Input Validation": 0,
        }
        total_files = len(python_files)
        for py_file in python_files:
            try:
                content = py_file.read_text()
                if "typing" in content or ":" in content:
                    quality_checks["Type Hints"] += 1
                if '"""' in content or "'''" in content:
                    quality_checks["Docstrings"] += 1
                if "try:" in content and "except" in content:
                    quality_checks["Error Handling"] += 1
                if "logging" in content or "logger" in content:
                    quality_checks["Logging"] += 1
                if "validate" in content or "ValueError" in content:
                    quality_checks["Input Validation"] += 1
            except Exception as e:
                logger.warning(f"Could not analyze {py_file}: {e}")
        for check_name, count in quality_checks.items():
            percentage = count / total_files * 100 if total_files > 0 else 0
            passed = percentage >= 50
            self.results.append(
                ValidationResult(
                    "Code Quality",
                    check_name,
                    passed,
                    f"{check_name}: {count}/{total_files} files ({percentage:.1f}%)",
                )
            )

    def validate_financial_standards(self) -> Any:
        """Validate financial standards implementation"""
        logger.info("Validating financial standards...")
        bs_file = self.code_directory / "quantitative" / "black_scholes.py"
        if bs_file.exists():
            content = bs_file.read_text()
            financial_features = [
                ("Option Pricing", "black_scholes" in content.lower()),
                ("Greeks Calculation", "delta" in content and "gamma" in content),
                ("Risk Management", "risk" in content.lower()),
                ("Input Validation", "validate" in content),
                (
                    "Multiple Option Types",
                    "call" in content.lower() and "put" in content.lower(),
                ),
                ("Dividend Adjustment", "dividend" in content.lower()),
                ("Volatility Modeling", "volatility" in content.lower()),
            ]
            for feature_name, has_feature in financial_features:
                self.results.append(
                    ValidationResult(
                        "Financial Standards",
                        feature_name,
                        has_feature,
                        f"{feature_name} {('implemented' if has_feature else 'missing')}",
                    )
                )
        else:
            self.results.append(
                ValidationResult(
                    "Financial Standards",
                    "Black-Scholes Model",
                    False,
                    "Black-Scholes implementation not found",
                )
            )
        ai_file = self.code_directory / "ai_models" / "create_model.py"
        if ai_file.exists():
            content = ai_file.read_text()
            ai_features = [
                ("Volatility Prediction", "volatility" in content.lower()),
                ("Fraud Detection", "fraud" in content.lower()),
                ("Model Validation", "validation" in content.lower()),
                ("Feature Engineering", "feature" in content.lower()),
                (
                    "Model Governance",
                    "governance" in content.lower() or "metadata" in content.lower(),
                ),
            ]
            for feature_name, has_feature in ai_features:
                self.results.append(
                    ValidationResult(
                        "Financial Standards",
                        f"AI: {feature_name}",
                        has_feature,
                        f"AI {feature_name} {('implemented' if has_feature else 'missing')}",
                    )
                )

    def validate_infrastructure(self) -> Any:
        """Validate infrastructure configuration"""
        logger.info("Validating infrastructure...")
        dockerfile = self.code_directory / "Dockerfile"
        if dockerfile.exists():
            content = dockerfile.read_text()
            docker_features = [
                ("Multi-stage Build", "FROM" in content and "as" in content),
                (
                    "Security Hardening",
                    "USER" in content and "non-root" in content.lower(),
                ),
                ("Health Check", "HEALTHCHECK" in content),
                ("Environment Variables", "ENV" in content),
                ("Proper Labeling", "LABEL" in content),
            ]
            for feature_name, has_feature in docker_features:
                self.results.append(
                    ValidationResult(
                        "Infrastructure",
                        f"Docker: {feature_name}",
                        has_feature,
                        f"Docker {feature_name} {('configured' if has_feature else 'missing')}",
                    )
                )
        compose_file = self.code_directory / "docker-compose.yml"
        if compose_file.exists():
            content = compose_file.read_text()
            compose_features = [
                ("Database Service", "postgres" in content.lower()),
                ("Cache Service", "redis" in content.lower()),
                (
                    "Monitoring",
                    "prometheus" in content.lower() or "grafana" in content.lower(),
                ),
                (
                    "Logging",
                    "elasticsearch" in content.lower() or "kibana" in content.lower(),
                ),
                ("Health Checks", "healthcheck" in content.lower()),
                ("Security Options", "security_opt" in content),
                ("Networks", "networks:" in content),
                ("Volumes", "volumes:" in content),
            ]
            for feature_name, has_feature in compose_features:
                self.results.append(
                    ValidationResult(
                        "Infrastructure",
                        f"Compose: {feature_name}",
                        has_feature,
                        f"Compose {feature_name} {('configured' if has_feature else 'missing')}",
                    )
                )
        terraform_file = (
            self.code_directory.parent / "infrastructure" / "terraform" / "main.tf"
        )
        if terraform_file.exists():
            content = terraform_file.read_text()
            terraform_features = [
                ("VPC Configuration", "aws_vpc" in content),
                ("Security Groups", "aws_security_group" in content),
                ("Database", "aws_db_instance" in content or "aws_rds" in content),
                ("Load Balancer", "aws_lb" in content or "aws_alb" in content),
                ("Encryption", "encryption" in content.lower()),
                ("Monitoring", "cloudwatch" in content.lower()),
                ("Backup", "backup" in content.lower()),
            ]
            for feature_name, has_feature in terraform_features:
                self.results.append(
                    ValidationResult(
                        "Infrastructure",
                        f"Terraform: {feature_name}",
                        has_feature,
                        f"Terraform {feature_name} {('configured' if has_feature else 'missing')}",
                    )
                )

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive validation report"""
        logger.info("Generating validation report...")
        categories = {}
        for result in self.results:
            if result.category not in categories:
                categories[result.category] = {
                    "passed": 0,
                    "failed": 0,
                    "total": 0,
                    "tests": [],
                }
            categories[result.category]["total"] += 1
            if result.passed:
                categories[result.category]["passed"] += 1
            else:
                categories[result.category]["failed"] += 1
            categories[result.category]["tests"].append(
                {
                    "name": result.test_name,
                    "passed": result.passed,
                    "message": result.message,
                    "details": result.details,
                }
            )
        total_tests = len(self.results)
        total_passed = sum((1 for r in self.results if r.passed))
        total_failed = total_tests - total_passed
        success_rate = total_passed / total_tests * 100 if total_tests > 0 else 0
        if success_rate >= 90:
            overall_status = "EXCELLENT"
        elif success_rate >= 80:
            overall_status = "GOOD"
        elif success_rate >= 70:
            overall_status = "ACCEPTABLE"
        elif success_rate >= 60:
            overall_status = "NEEDS_IMPROVEMENT"
        else:
            overall_status = "CRITICAL"
        report = {
            "validation_timestamp": datetime.utcnow().isoformat(),
            "overall_status": overall_status,
            "summary": {
                "total_tests": total_tests,
                "passed": total_passed,
                "failed": total_failed,
                "success_rate": round(success_rate, 2),
            },
            "categories": categories,
            "recommendations": self.generate_recommendations(categories),
        }
        return report

    def generate_recommendations(self, categories: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on validation results"""
        recommendations = []
        for category, data in categories.items():
            success_rate = (
                data["passed"] / data["total"] * 100 if data["total"] > 0 else 0
            )
            if success_rate < 80:
                recommendations.append(
                    f"Improve {category}: {data['failed']} out of {data['total']} tests failed"
                )
        if any(("Security" in cat for cat in categories)):
            security_data = categories.get("Security", {})
            if security_data.get("failed", 0) > 0:
                recommendations.append(
                    "Security features: Implement missing authentication, encryption, and input validation"
                )
        if any(("Compliance" in cat for cat in categories)):
            compliance_data = categories.get("Compliance", {})
            if compliance_data.get("failed", 0) > 0:
                recommendations.append(
                    "Strengthen compliance: Add missing AML, KYC, and regulatory reporting features"
                )
        if any(("Financial Standards" in cat for cat in categories)):
            financial_data = categories.get("Financial Standards", {})
            if financial_data.get("failed", 0) > 0:
                recommendations.append(
                    "Financial models: Improve option pricing, risk management, and AI models"
                )
        return recommendations


def main() -> Any:
    """Main validation function"""
    if len(sys.argv) != 2:
        logger.info("Usage: python validate.py <code_directory>")
        sys.exit(1)
    code_directory = sys.argv[1]
    if not os.path.exists(code_directory):
        logger.info(f"Error: Directory {code_directory} does not exist")
        sys.exit(1)
    validator = Validator(code_directory)
    report = validator.validate_all()
    logger.info("\n" + "=" * 80)
    logger.info("OPTIONIX PLATFORM VALIDATION REPORT")
    logger.info("=" * 80)
    logger.info(f"Validation Time: {report['validation_timestamp']}")
    logger.info(f"Overall Status: {report['overall_status']}")
    logger.info(f"Success Rate: {report['summary']['success_rate']}%")
    logger.info(
        f"Tests: {report['summary']['passed']}/{report['summary']['total_tests']} passed"
    )
    logger.info("\nCATEGORY BREAKDOWN:")
    logger.info("-" * 40)
    for category, data in report["categories"].items():
        success_rate = data["passed"] / data["total"] * 100 if data["total"] > 0 else 0
        logger.info(
            f"{category}: {data['passed']}/{data['total']} ({success_rate:.1f}%)"
        )
    if report["recommendations"]:
        logger.info("\nRECOMMENDATIONS:")
        logger.info("-" * 40)
        for i, rec in enumerate(report["recommendations"], 1):
            logger.info(f"{i}. {rec}")
    report_file = Path(code_directory) / "validation_report.json"
    with open(report_file, "w") as f:
        json.dump(report, f, indent=2)
    logger.info(f"\nDetailed report saved to: {report_file}")
    if report["summary"]["success_rate"] >= 80:
        logger.info("\n✅ Validation PASSED - Platform meets standards")
        sys.exit(0)
    else:
        logger.info("\n❌ Validation FAILED - Platform needs improvements")
        sys.exit(1)


if __name__ == "__main__":
    main()

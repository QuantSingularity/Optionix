variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "optionix"
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access web servers"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "kms_key_id" {
  description = "KMS key ARN for encryption"
  type        = string
  default     = null
}

variable "enable_waf" {
  description = "Enable WAF v2"
  type        = bool
  default     = true
}

variable "waf_rules" {
  description = "List of AWS Managed WAF rule group names"
  type        = list(string)
  default = [
    "AWSManagedRulesCommonRuleSet",
    "AWSManagedRulesKnownBadInputsRuleSet",
    "AWSManagedRulesSQLiRuleSet"
  ]
}

variable "enable_guardduty" {
  description = "Enable AWS GuardDuty"
  type        = bool
  default     = true
}

variable "enable_config" {
  description = "Enable AWS Config"
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = true
}

variable "cloudtrail_s3_bucket_name" {
  description = "S3 bucket name for CloudTrail logs"
  type        = string
  default     = ""
}

variable "db_username" {
  description = "Database username for Secrets Manager"
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_password" {
  description = "Database password for Secrets Manager"
  type        = string
  sensitive   = true
  default     = ""
}

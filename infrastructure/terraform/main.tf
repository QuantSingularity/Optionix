# Optionix Infrastructure - Main Terraform Configuration
# Financial Grade Security and Compliance

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # For production, use S3 backend (configure via backend.hcl):
  # terraform init -backend-config=backend.hcl
}

provider "aws" {
  region = var.aws_region

  skip_credentials_validation = false
  skip_metadata_api_check     = false
  skip_region_validation      = false

  default_tags {
    tags = {
      Project     = "Optionix"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner
      CostCenter  = var.cost_center
      Compliance  = "Financial"
      DataClass   = "Sensitive"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
  upper            = true
  lower            = true
  numeric          = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
  upper   = true
  lower   = true
  numeric = true
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_kms_key" "optionix_key" {
  description             = "Optionix encryption key for ${var.environment}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name = "optionix-${var.environment}-key"
  }
}

resource "aws_kms_alias" "optionix_key_alias" {
  name          = "alias/optionix-${var.environment}"
  target_key_id = aws_kms_key.optionix_key.key_id
}

# Network Module
module "network" {
  source = "./modules/network"

  environment           = var.environment
  vpc_cidr              = var.vpc_cidr
  availability_zones    = var.availability_zones
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  database_subnet_cidrs = var.database_subnet_cidrs
}

# Security Module
module "security" {
  source = "./modules/security"

  environment             = var.environment
  vpc_id                  = module.network.vpc_id
  app_name                = var.app_name
  allowed_cidr_blocks     = var.allowed_cidr_blocks
  kms_key_id              = aws_kms_key.optionix_key.arn
  enable_waf              = var.enable_waf
  waf_rules               = var.waf_rules
  enable_guardduty        = var.enable_guardduty
  enable_config           = var.enable_config
  enable_cloudtrail       = var.enable_cloudtrail
  cloudtrail_s3_bucket_name = "${var.app_name}-${var.environment}-cloudtrail-${random_id.bucket_suffix.hex}"
  db_username             = var.db_username
  db_password             = random_password.db_password.result
  tags = {
    Project = "Optionix"
  }
}

# Compute Module
module "compute" {
  source = "./modules/compute"

  environment            = var.environment
  vpc_id                 = module.network.vpc_id
  public_subnet_ids      = module.network.public_subnet_ids
  private_subnet_ids     = module.network.private_subnet_ids
  app_name               = var.app_name
  security_group_ids     = [module.security.compute_security_group_id]
  alb_security_group_ids = [module.security.web_security_group_id]
  certificate_arn        = var.certificate_arn
}

# Database Module
module "database" {
  source = "./modules/database"

  environment           = var.environment
  vpc_id                = module.network.vpc_id
  subnet_ids            = module.network.database_subnet_ids
  db_name               = var.db_name
  db_username           = var.db_username
  db_password           = random_password.db_password.result
  security_group_ids    = [module.security.db_security_group_id]
  kms_key_id            = aws_kms_key.optionix_key.arn
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
}

# Storage Module
module "storage" {
  source = "./modules/storage"

  environment = var.environment
  app_name    = var.app_name
}

aws_region  = "us-west-2"
environment = "staging"
app_name    = "optionix"

vpc_cidr              = "10.1.0.0/16"
availability_zones    = ["us-west-2a", "us-west-2b", "us-west-2c"]
public_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
private_subnet_cidrs  = ["10.1.4.0/24", "10.1.5.0/24", "10.1.6.0/24"]
database_subnet_cidrs = ["10.1.7.0/24", "10.1.8.0/24", "10.1.9.0/24"]

instance_type = "t3.medium"
key_name      = "staging-key"

db_instance_class        = "db.t3.medium"
db_name                  = "optionix"
db_username              = "optionix_admin"
db_allocated_storage     = 30
db_max_allocated_storage = 150

owner       = "engineering"
cost_center = "staging-001"

enable_waf        = true
enable_guardduty  = true
enable_config     = true
enable_cloudtrail = true

allowed_cidr_blocks = ["0.0.0.0/0"]

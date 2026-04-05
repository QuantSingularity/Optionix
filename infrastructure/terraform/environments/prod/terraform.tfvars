aws_region  = "us-west-2"
environment = "prod"
app_name    = "optionix"

vpc_cidr              = "10.2.0.0/16"
availability_zones    = ["us-west-2a", "us-west-2b", "us-west-2c"]
public_subnet_cidrs   = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
private_subnet_cidrs  = ["10.2.4.0/24", "10.2.5.0/24", "10.2.6.0/24"]
database_subnet_cidrs = ["10.2.7.0/24", "10.2.8.0/24", "10.2.9.0/24"]

instance_type = "t3.large"
key_name      = "prod-key"

db_instance_class        = "db.r6g.large"
db_name                  = "optionix"
db_username              = "optionix_admin"
db_allocated_storage     = 100
db_max_allocated_storage = 500

owner       = "engineering"
cost_center = "prod-001"

enable_waf        = true
enable_guardduty  = true
enable_config     = true
enable_cloudtrail = true

allowed_cidr_blocks = ["0.0.0.0/0"]

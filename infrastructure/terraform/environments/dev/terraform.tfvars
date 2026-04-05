aws_region  = "us-west-2"
environment = "dev"
app_name    = "optionix"

vpc_cidr              = "10.0.0.0/16"
availability_zones    = ["us-west-2a", "us-west-2b", "us-west-2c"]
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs  = ["10.0.4.0/24", "10.0.5.0/24", "10.0.6.0/24"]
database_subnet_cidrs = ["10.0.7.0/24", "10.0.8.0/24", "10.0.9.0/24"]

instance_type = "t3.medium"
key_name      = "dev-key"

db_instance_class     = "db.t3.micro"
db_name               = "optionix"
db_username           = "optionix_admin"
db_allocated_storage  = 20
db_max_allocated_storage = 100

owner       = "engineering"
cost_center = "dev-001"

enable_waf        = false
enable_guardduty  = false
enable_config     = false
enable_cloudtrail = false

allowed_cidr_blocks = ["10.0.0.0/8"]

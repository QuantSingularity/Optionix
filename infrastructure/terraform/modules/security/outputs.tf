output "app_security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
}

output "db_security_group_id" {
  description = "ID of the database security group"
  value       = aws_security_group.database.id
}

output "web_security_group_id" {
  description = "ID of the web/ALB security group"
  value       = aws_security_group.web.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "compute_security_group_id" {
  description = "Alias for app security group ID (used by compute module)"
  value       = aws_security_group.app.id
}

output "optionix_iam_role_arn" {
  description = "ARN of the Optionix IAM role"
  value       = aws_iam_role.optionix_role.arn
}

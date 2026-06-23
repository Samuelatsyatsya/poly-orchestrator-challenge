output "alb_dns_name" {
  description = "Application Load Balancer DNS — the app URL"
  value       = module.ecs.alb_dns_name
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "frontend_ecr_url" {
  value = module.ecr.frontend_repository_url
}

output "backend_ecr_url" {
  value = module.ecr.backend_repository_url
}

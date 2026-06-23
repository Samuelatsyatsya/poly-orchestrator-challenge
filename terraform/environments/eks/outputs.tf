output "cluster_name" {
  description = "EKS cluster name — use with: aws eks update-kubeconfig --name <value>"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "alb_controller_role_arn" {
  description = "IAM role ARN for the AWS Load Balancer Controller service account"
  value       = module.eks.alb_controller_role_arn
}

output "frontend_ecr_url" {
  value = module.ecr.frontend_repository_url
}

output "backend_ecr_url" {
  value = module.ecr.backend_repository_url
}

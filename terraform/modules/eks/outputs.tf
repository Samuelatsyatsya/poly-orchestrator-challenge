output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority" {
  value = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_oidc_issuer" {
  value = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "alb_controller_role_arn" {
  value = aws_iam_role.alb_controller.arn
}

output "node_group_name" {
  value = aws_eks_node_group.main.node_group_name
}

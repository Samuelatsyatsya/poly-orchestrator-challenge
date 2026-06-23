terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket  = "shopnow-terraform-state-eu"
    key     = "eks/terraform.tfstate"
    region  = "eu-central-1"
    profile = "CostDetective"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = "CostDetective"
  default_tags {
    tags = local.common_tags
  }
}

locals {
  common_tags = {
    Project     = "ShopNow"
    Environment = "eks"
    ManagedBy   = "Terraform"
  }
}

module "vpc" {
  source   = "../../modules/vpc"
  name     = "${var.name}-eks"
  vpc_cidr = var.vpc_cidr
  tags     = local.common_tags
}

module "ecr" {
  source = "../../modules/ecr"
  name   = "${var.name}-eks"
  tags   = local.common_tags
}

module "eks" {
  source = "../../modules/eks"

  name               = var.name
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids

  kubernetes_version  = var.kubernetes_version
  node_instance_types = var.node_instance_types
  node_desired_size   = var.node_desired_size
  node_min_size       = var.node_min_size
  node_max_size       = var.node_max_size

  tags = local.common_tags
}

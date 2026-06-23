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
    key     = "ecs/terraform.tfstate"
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
    Environment = "ecs"
    ManagedBy   = "Terraform"
  }
}

module "vpc" {
  source   = "../../modules/vpc"
  name     = "${var.name}-ecs"
  vpc_cidr = var.vpc_cidr
  tags     = local.common_tags
}

module "ecr" {
  source = "../../modules/ecr"
  name   = var.name
  tags   = local.common_tags
}

module "security_groups" {
  source = "../../modules/security-groups"
  name   = "${var.name}-ecs"
  vpc_id = module.vpc.vpc_id
  tags   = local.common_tags
}

module "ecs" {
  source = "../../modules/ecs"

  name               = var.name
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  alb_sg_id          = module.security_groups.alb_sg_id
  frontend_sg_id     = module.security_groups.frontend_sg_id
  backend_sg_id      = module.security_groups.backend_sg_id

  frontend_image         = "${module.ecr.frontend_repository_url}:latest"
  backend_image          = "${module.ecr.backend_repository_url}:latest"
  frontend_desired_count = var.frontend_desired_count
  backend_desired_count  = var.backend_desired_count

  db_host     = var.db_host
  db_name     = var.db_name
  db_user     = var.db_user
  db_password = var.db_password
  redis_host  = var.redis_host
  jwt_secret  = var.jwt_secret

  tags = local.common_tags
}

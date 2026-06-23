variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "name" {
  type    = string
  default = "shopnow"
}

variable "vpc_cidr" {
  type    = string
  default = "10.1.0.0/16"
}

variable "kubernetes_version" {
  type    = string
  default = "1.29"
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium"]
}

variable "node_desired_size" { type = number; default = 2 }
variable "node_min_size" { type = number; default = 1 }
variable "node_max_size" { type = number; default = 5 }

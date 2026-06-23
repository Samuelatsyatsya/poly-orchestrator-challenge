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
  default = "10.0.0.0/16"
}

variable "frontend_desired_count" {
  type    = number
  default = 2
}

variable "backend_desired_count" {
  type    = number
  default = 2
}

variable "db_name" {
  type    = string
  default = "shopnow"
}

variable "db_user" {
  type    = string
  default = "shopnow"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

################################
# ECS Cluster
################################
resource "aws_ecs_cluster" "main" {
  name = "${var.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

################################
# IAM — Task Execution Role
################################
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

################################
# CloudWatch Log Groups
################################
resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.name}/frontend"
  retention_in_days = 7
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.name}/backend"
  retention_in_days = 7
  tags              = var.tags
}

################################
# ALB
################################
resource "aws_lb" "main" {
  name               = "${var.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_sg_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false
  tags                       = var.tags
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.name}-frontend-tg"
  port        = 80
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name}-backend-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

################################
# Task Definitions
################################
resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = var.frontend_image
    essential = true
    portMappings = [{ containerPort = 80, protocol = "tcp" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.frontend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:80/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = var.tags
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = var.backend_image
    essential = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV",       value = "production" },
      { name = "PORT",           value = "3000" },
      { name = "DB_HOST",        value = "postgres.${aws_service_discovery_private_dns_namespace.main.name}" },
      { name = "DB_PORT",        value = "5432" },
      { name = "DB_NAME",        value = var.db_name },
      { name = "DB_USER",        value = var.db_user },
      { name = "DB_PASSWORD",    value = var.db_password },
      { name = "REDIS_HOST",     value = "redis.${aws_service_discovery_private_dns_namespace.main.name}" },
      { name = "REDIS_PORT",     value = "6379" },
      { name = "JWT_SECRET",     value = var.jwt_secret },
      { name = "JWT_EXPIRES_IN", value = "7d" },
      { name = "FRONTEND_URL",   value = "http://${aws_lb.main.dns_name}" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3000/api/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = var.tags
}

################################
# ECS Services
################################
resource "aws_ecs_service" "frontend" {
  name            = "${var.name}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.frontend_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener.http]
  tags       = var.tags
}

resource "aws_ecs_service" "backend" {
  name            = "${var.name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.backend_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  depends_on = [aws_lb_listener_rule.api, aws_ecs_service.postgres, aws_ecs_service.redis]
  tags       = var.tags
}

################################
# Service Discovery (Cloud Map)
# Gives postgres.shopnow.local and redis.shopnow.local DNS resolution inside the VPC
################################
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "shopnow.local"
  vpc         = var.vpc_id
  description = "Private DNS namespace for ECS service-to-service discovery"
  tags        = var.tags
}

resource "aws_service_discovery_service" "postgres" {
  name = "postgres"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}

resource "aws_service_discovery_service" "redis" {
  name = "redis"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.main.id
    routing_policy = "MULTIVALUE"
    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}

################################
# EFS — Postgres data persistence
# Without this, all data is lost when the Postgres task restarts
################################
resource "aws_efs_file_system" "postgres" {
  encrypted        = true
  performance_mode = "generalPurpose"
  throughput_mode  = "bursting"
  tags             = merge(var.tags, { Name = "${var.name}-postgres-efs" })
}

resource "aws_efs_mount_target" "postgres" {
  for_each = toset(var.private_subnet_ids)

  file_system_id  = aws_efs_file_system.postgres.id
  subnet_id       = each.value
  security_groups = [var.postgres_sg_id]
}

resource "aws_efs_access_point" "postgres" {
  file_system_id = aws_efs_file_system.postgres.id

  posix_user {
    gid = 999
    uid = 999
  }

  root_directory {
    path = "/pgdata"
    creation_info {
      owner_gid   = 999
      owner_uid   = 999
      permissions = "755"
    }
  }

  tags = var.tags
}

################################
# EFS Security Group — allow NFS from Postgres SG
# EFS mount targets need port 2049 inbound
################################
resource "aws_vpc_security_group_ingress_rule" "efs_from_postgres" {
  security_group_id            = var.postgres_sg_id
  referenced_security_group_id = var.postgres_sg_id
  from_port                    = 2049
  to_port                      = 2049
  ip_protocol                  = "tcp"
  description                  = "NFS from Postgres tasks to EFS"
}

################################
# CloudWatch Log Groups — Postgres & Redis
################################
resource "aws_cloudwatch_log_group" "postgres" {
  name              = "/ecs/${var.name}/postgres"
  retention_in_days = 7
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/ecs/${var.name}/redis"
  retention_in_days = 7
  tags              = var.tags
}

################################
# IAM — allow execution role to use EFS
################################
resource "aws_iam_role_policy" "execution_efs" {
  name = "${var.name}-ecs-execution-efs"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["elasticfilesystem:ClientMount", "elasticfilesystem:ClientWrite"]
      Resource = aws_efs_file_system.postgres.arn
    }]
  })
}

################################
# Task Definitions — Postgres & Redis
################################
resource "aws_ecs_task_definition" "postgres" {
  family                   = "${var.name}-postgres"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  volume {
    name = "pgdata"
    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.postgres.id
      transit_encryption      = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.postgres.id
        iam             = "ENABLED"
      }
    }
  }

  container_definitions = jsonencode([{
    name      = "postgres"
    image     = "postgres:16-alpine"
    essential = true
    portMappings = [{ containerPort = 5432, protocol = "tcp" }]
    environment = [
      { name = "POSTGRES_DB",       value = var.db_name },
      { name = "POSTGRES_USER",     value = var.db_user },
      { name = "POSTGRES_PASSWORD", value = var.db_password },
      { name = "PGDATA",            value = "/var/lib/postgresql/data/pgdata" },
    ]
    mountPoints = [{
      sourceVolume  = "pgdata"
      containerPath = "/var/lib/postgresql/data"
      readOnly      = false
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.postgres.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "pg_isready -U ${var.db_user} -d ${var.db_name} || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 5
      startPeriod = 60
    }
  }])

  tags = var.tags
}

resource "aws_ecs_task_definition" "redis" {
  family                   = "${var.name}-redis"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "redis"
    image     = "redis:7-alpine"
    essential = true
    portMappings = [{ containerPort = 6379, protocol = "tcp" }]
    command   = ["redis-server", "--appendonly", "yes", "--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.redis.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "redis-cli ping || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
  }])

  tags = var.tags
}

################################
# ECS Services — Postgres & Redis
# desired_count = 1: stateful services shouldn't have >1 replica writing the same EFS path
################################
resource "aws_ecs_service" "postgres" {
  name            = "${var.name}-postgres"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.postgres.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.postgres_sg_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.postgres.arn
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  depends_on = [aws_efs_mount_target.postgres]
  tags       = var.tags
}

resource "aws_ecs_service" "redis" {
  name            = "${var.name}-redis"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.redis.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.redis_sg_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.redis.arn
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  tags = var.tags
}

################################
# Auto Scaling
################################
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 6
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.name}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

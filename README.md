# ShopNow — Poly-Orchestrator Challenge

A 3-tier e-commerce application deployed to both **Amazon ECS (Fargate)** and **Amazon EKS** to benchmark orchestration platforms.

| Tier | Technology |
|------|------------|
| Frontend | React 18 + Tailwind CSS, served by Nginx |
| Backend API | Node.js + Express, JWT auth |
| Cache | Redis 7 (cart & sessions) |
| Database | PostgreSQL 16 (products, orders, users) |

---

## Architecture

```
Internet
    │
    ▼
  ALB  (single entry point — path-based routing)
  ├─ /*      → Frontend (Nginx serving React SPA)
  └─ /api/*  → Backend (Node.js REST API)
                    │
              ┌─────┴─────┐
           Postgres     Redis
```

Traffic always flows through one ALB, eliminating CORS issues and reducing cost vs. two separate load balancers.

---

## Repository Structure

```
poly-orchestrator-challenge/
├── frontend/               # React + Tailwind (Vite)
│   ├── src/
│   ├── Dockerfile          # Multi-stage: build → nginx
│   └── nginx.conf
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── config/         # DB, Redis, migrate, seed
│   │   ├── controllers/    # auth, products, cart, orders
│   │   ├── middleware/     # auth (JWT), validate, errorHandler
│   │   └── routes/
│   └── Dockerfile
├── docker-compose.yml      # Local development
├── terraform/
│   ├── modules/
│   │   ├── vpc/            # VPC, subnets, NAT gateways
│   │   ├── ecr/            # Container registries
│   │   ├── security-groups/
│   │   ├── ecs/            # Cluster, task defs, services, ALB
│   │   └── eks/            # Cluster, node group, OIDC, ALB controller IAM
│   └── environments/
│       ├── ecs/            # ECS deployment root
│       └── eks/            # EKS deployment root
└── k8s/
    ├── namespace/
    ├── postgres/
    ├── redis/
    ├── backend/
    ├── frontend/
    └── ingress/            # AWS Load Balancer Controller ingress
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| AWS CLI | v2 | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| Terraform | 1.6+ | [terraform.io](https://developer.hashicorp.com/terraform/install) |
| kubectl | 1.29+ | [kubernetes.io](https://kubernetes.io/docs/tasks/tools/) |
| Helm | 3.x | [helm.sh](https://helm.sh/docs/intro/install/) |

### AWS Profile

This project uses the `CostDetective` AWS profile:

```bash
aws configure --profile CostDetective
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output (json)

# Verify
aws sts get-caller-identity --profile CostDetective
```

---

## Step 1 — Run Locally with Docker Compose

```bash
# 1. Build and start all services
docker compose up --build -d

# 2. Run database migration (creates tables)
docker compose run --rm migrate

# 3. Seed 10 sample products
docker compose run --rm seed

# 4. Open the app
open http://localhost        # Frontend
curl http://localhost:3000/api/health  # Backend health check
```

To stop:
```bash
docker compose down -v   # -v removes volumes (resets database)
```

---

## Step 2 — Create S3 Bucket for Terraform State

```bash
aws s3 mb s3://shopnow-terraform-state --region us-east-1 --profile CostDetective
aws s3api put-bucket-versioning \
  --bucket shopnow-terraform-state \
  --versioning-configuration Status=Enabled \
  --profile CostDetective
```

---

## Step 3 — Push Docker Images to ECR

```bash
export AWS_PROFILE=CostDetective
export AWS_REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push frontend
docker build -t shopnow-frontend ./frontend
docker tag shopnow-frontend:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow-frontend:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow-frontend:latest

# Build and push backend
docker build -t shopnow-backend ./backend
docker tag shopnow-backend:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow-backend:latest
docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow-backend:latest
```

> **Note:** Run `terraform apply` in `terraform/environments/ecs` first to create the ECR repositories before pushing.

---

## Step 4 — Deploy to ECS (Fargate)

```bash
cd terraform/environments/ecs

# Copy and fill in secrets
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars — set db_password, jwt_secret, db_host, redis_host

terraform init
terraform plan
terraform apply
```

After apply, the ALB DNS is printed:
```
alb_dns_name = "shopnow-alb-XXXXXXXX.us-east-1.elb.amazonaws.com"
```

Visit that URL in your browser — ShopNow is live on ECS.

### ECS Resiliency Test

```bash
# List running tasks
aws ecs list-tasks --cluster shopnow-cluster --profile CostDetective

# Stop (kill) one task
aws ecs stop-task \
  --cluster shopnow-cluster \
  --task <TASK_ARN> \
  --profile CostDetective

# Watch ECS automatically restart it (within ~30s)
aws ecs describe-services \
  --cluster shopnow-cluster \
  --services shopnow-backend \
  --query 'services[0].{Running:runningCount,Desired:desiredCount}' \
  --profile CostDetective
```

---

## Step 5 — Deploy to EKS

### 5.1 Provision the Cluster

```bash
cd terraform/environments/eks
terraform init
terraform plan
terraform apply
```

### 5.2 Configure kubectl

```bash
aws eks update-kubeconfig \
  --name shopnow-cluster \
  --region us-east-1 \
  --profile CostDetective

kubectl get nodes   # Should show 2 ready nodes
```

### 5.3 Install AWS Load Balancer Controller

```bash
# Get the ALB controller role ARN from Terraform output
ALB_ROLE_ARN=$(terraform output -raw alb_controller_role_arn)

# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=shopnow-cluster \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=$ALB_ROLE_ARN

# Verify
kubectl get deployment aws-load-balancer-controller -n kube-system
```

### 5.4 Deploy the Application

```bash
# Get ECR URLs
FRONTEND_IMAGE=$(terraform output -raw frontend_ecr_url):latest
BACKEND_IMAGE=$(terraform output -raw backend_ecr_url):latest

# Create namespace
kubectl apply -f k8s/namespace/

# Create secrets (edit base64 values first)
kubectl apply -f k8s/backend/secrets.yaml

# Deploy data tier
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/

# Wait for databases
kubectl wait --for=condition=ready pod -l app=postgres -n shopnow --timeout=90s
kubectl wait --for=condition=ready pod -l app=redis -n shopnow --timeout=90s

# Run migration and seed
kubectl run migrate --image=$BACKEND_IMAGE --restart=Never -n shopnow \
  --env="DB_HOST=postgres" --env="DB_PORT=5432" \
  --env="DB_NAME=shopnow" --env="DB_USER=shopnow" \
  --env="DB_PASSWORD=<your_password>" \
  -- node src/config/migrate.js

kubectl run seed --image=$BACKEND_IMAGE --restart=Never -n shopnow \
  --env="DB_HOST=postgres" --env="DB_PORT=5432" \
  --env="DB_NAME=shopnow" --env="DB_USER=shopnow" \
  --env="DB_PASSWORD=<your_password>" \
  -- node src/config/seed.js

# Deploy app (replace image placeholders)
sed "s|BACKEND_ECR_IMAGE|$BACKEND_IMAGE|g" k8s/backend/backend.yaml | kubectl apply -f -
sed "s|FRONTEND_ECR_IMAGE|$FRONTEND_IMAGE|g" k8s/frontend/frontend.yaml | kubectl apply -f -

# Deploy ingress (ALB)
kubectl apply -f k8s/ingress/

# Get the ALB DNS (takes ~2 minutes to provision)
kubectl get ingress -n shopnow
```

### EKS Resiliency Test

```bash
# List pods
kubectl get pods -n shopnow

# Kill a backend pod
kubectl delete pod <BACKEND_POD_NAME> -n shopnow

# Watch Kubernetes immediately schedule a replacement
kubectl get pods -n shopnow -w
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/products` | — | List products (paginated, filterable) |
| GET | `/api/products/:id` | — | Single product |
| GET | `/api/products/categories` | — | List categories |
| GET | `/api/cart` | JWT | Get cart |
| POST | `/api/cart/add` | JWT | Add item |
| PUT | `/api/cart/update` | JWT | Update quantity |
| DELETE | `/api/cart/item/:id` | JWT | Remove item |
| DELETE | `/api/cart/clear` | JWT | Clear cart |
| POST | `/api/orders/checkout` | JWT | Place order |
| GET | `/api/orders` | JWT | My orders |
| GET | `/api/orders/:id` | JWT | Order detail |

---

## Teardown

```bash
# ECS
cd terraform/environments/ecs && terraform destroy

# EKS
kubectl delete namespace shopnow
cd terraform/environments/eks && terraform destroy
```

---

## ECS vs EKS — Benchmark Notes

| | ECS (Fargate) | EKS (Node Groups) |
|---|---|---|
| Setup time | ~5 min | ~15 min |
| Operational overhead | Low | High |
| Cost | Pay per task | Pay per node |
| Scaling | Per-service auto scaling | HPA + Cluster Autoscaler |
| Self-healing | ECS replaces failed tasks | K8s replaces failed pods |
| Ecosystem | AWS-native | CNCF / portable |
| Best for | Simple workloads, AWS-only | Complex workloads, multi-cloud |

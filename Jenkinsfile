pipeline {
    agent any

    environment {
        AWS_REGION        = 'eu-central-1'
        BACKEND_REPO      = 'shopnow-backend'
        FRONTEND_REPO     = 'shopnow-frontend'
        EKS_BACKEND_REPO  = 'shopnow-eks-backend'
        EKS_FRONTEND_REPO = 'shopnow-eks-frontend'
        ECS_CLUSTER       = 'shopnow-cluster'
        EKS_CLUSTER       = 'shopnow-cluster'
        IMAGE_TAG         = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Resolve AWS Account') {
            // Derive the account ID from the IAM credentials at runtime — never hardcode it
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    script {
                        env.AWS_ACCOUNT_ID = sh(
                            script: "aws sts get-caller-identity --query Account --output text --region ${AWS_REGION}",
                            returnStdout: true
                        ).trim()
                        env.ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
                    }
                }
            }
        }

        stage('Build Images') {
            // Build both images in parallel to reduce pipeline wall-clock time
            parallel {
                stage('Build Backend') {
                    steps {
                        sh """
                            docker build \
                              -t ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG} \
                              -t ${ECR_REGISTRY}/${BACKEND_REPO}:latest \
                              -t ${ECR_REGISTRY}/${EKS_BACKEND_REPO}:${IMAGE_TAG} \
                              -t ${ECR_REGISTRY}/${EKS_BACKEND_REPO}:latest \
                              ./backend
                        """
                    }
                }
                stage('Build Frontend') {
                    steps {
                        sh """
                            docker build \
                              -t ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG} \
                              -t ${ECR_REGISTRY}/${FRONTEND_REPO}:latest \
                              -t ${ECR_REGISTRY}/${EKS_FRONTEND_REPO}:${IMAGE_TAG} \
                              -t ${ECR_REGISTRY}/${EKS_FRONTEND_REPO}:latest \
                              ./frontend
                        """
                    }
                }
            }
        }

        stage('Security Scan (Trivy)') {
            // --exit-code 1 fails the build on HIGH or CRITICAL findings
            // Images never reach ECR if this stage fails
            parallel {
                stage('Scan Backend') {
                    steps {
                        sh """
                            trivy image \
                              --exit-code 1 \
                              --severity HIGH,CRITICAL \
                              --ignorefile .trivyignore \
                              --no-progress \
                              --format table \
                              --cache-dir /tmp/trivy-cache-backend \
                              ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}
                        """
                    }
                }
                stage('Scan Frontend') {
                    steps {
                        sh """
                            trivy image \
                              --exit-code 1 \
                              --severity HIGH,CRITICAL \
                              --ignorefile .trivyignore \
                              --no-progress \
                              --format table \
                              --cache-dir /tmp/trivy-cache-frontend \
                              ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}
                        """
                    }
                }
            }
        }

        stage('Push to ECR') {
            // Uses short-lived ECR token (12h) — no long-lived Docker credentials stored
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    sh """
                        aws ecr get-login-password --region ${AWS_REGION} | \
                          docker login --username AWS --password-stdin ${ECR_REGISTRY}

                        docker push ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${BACKEND_REPO}:latest
                        docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:latest

                        docker push ${ECR_REGISTRY}/${EKS_BACKEND_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${EKS_BACKEND_REPO}:latest
                        docker push ${ECR_REGISTRY}/${EKS_FRONTEND_REPO}:${IMAGE_TAG}
                        docker push ${ECR_REGISTRY}/${EKS_FRONTEND_REPO}:latest
                    """
                }
            }
        }

        stage('Run DB Migration') {
            // Runs migration as a one-off ECS task before deploying new containers
            // Ensures schema is up to date before the new backend version starts
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    script {
                        def subnets = sh(
                            script: """aws ec2 describe-subnets \
                              --filters 'Name=tag:Name,Values=shopnow-ecs-private-*' \
                              --query 'Subnets[*].SubnetId' \
                              --output text --region ${AWS_REGION} | tr '\\t' ','""",
                            returnStdout: true
                        ).trim()
                        def backendSg = sh(
                            script: """aws ec2 describe-security-groups \
                              --filters 'Name=tag:Name,Values=shopnow-ecs-backend-sg' \
                              --query 'SecurityGroups[0].GroupId' \
                              --output text --region ${AWS_REGION}""",
                            returnStdout: true
                        ).trim()
                        sh """
                            aws ecs run-task \
                              --cluster ${ECS_CLUSTER} \
                              --task-definition shopnow-backend \
                              --launch-type FARGATE \
                              --overrides '{"containerOverrides":[{"name":"backend","command":["node","src/config/migrate.js"]}]}' \
                              --network-configuration 'awsvpcConfiguration={subnets=[${subnets}],securityGroups=[${backendSg}],assignPublicIp=DISABLED}' \
                              --region ${AWS_REGION}
                        """
                    }
                }
            }
        }

        stage('Deploy Backend') {
            // Backend first — must be backward compatible with old frontend during rollout
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    sh """
                        aws ecs update-service \
                          --cluster ${ECS_CLUSTER} \
                          --service shopnow-backend \
                          --force-new-deployment \
                          --region ${AWS_REGION}

                        aws ecs wait services-stable \
                          --cluster ${ECS_CLUSTER} \
                          --services shopnow-backend \
                          --region ${AWS_REGION}
                    """
                }
            }
        }

        stage('Deploy Frontend') {
            // Frontend second — only after backend is fully stable
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    sh """
                        aws ecs update-service \
                          --cluster ${ECS_CLUSTER} \
                          --service shopnow-frontend \
                          --force-new-deployment \
                          --region ${AWS_REGION}

                        aws ecs wait services-stable \
                          --cluster ${ECS_CLUSTER} \
                          --services shopnow-frontend \
                          --region ${AWS_REGION}
                    """
                }
            }
        }

        stage('Deploy to EKS') {
            // Rolling restart picks up the new :latest image pushed above
            steps {
                withCredentials([[
                    $class: 'AmazonWebServicesCredentialsBinding',
                    credentialsId: 'indestructible-creds'
                ]]) {
                    sh """
                        # Install kubectl if not present
                        if ! command -v kubectl &> /dev/null; then
                            echo "kubectl not found — installing..."
                            curl -sLO "https://dl.k8s.io/release/\$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                            chmod +x kubectl
                            mv kubectl /usr/local/bin/kubectl
                            echo "kubectl installed: \$(kubectl version --client --short)"
                        else
                            echo "kubectl already installed: \$(kubectl version --client --short 2>/dev/null || kubectl version --client)"
                        fi

                        aws eks update-kubeconfig \
                          --name ${EKS_CLUSTER} \
                          --region ${AWS_REGION}

                        kubectl rollout restart deployment/backend -n shopnow
                        kubectl rollout restart deployment/frontend -n shopnow

                        kubectl rollout status deployment/backend -n shopnow --timeout=300s
                        kubectl rollout status deployment/frontend -n shopnow --timeout=300s
                    """
                }
            }
        }
    }

    post {
        // Always clean up local images to keep Jenkins agent disk free
        always {
            sh """
                docker rmi ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REGISTRY}/${EKS_BACKEND_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REGISTRY}/${EKS_FRONTEND_REPO}:${IMAGE_TAG} || true
            """
        }
        success {
            echo "Pipeline succeeded. Images deployed with tag: ${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline FAILED. Check logs above — Trivy HIGH/CRITICAL findings block the push."
        }
    }
}

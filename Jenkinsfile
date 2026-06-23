pipeline {
    agent any

    environment {
        AWS_REGION     = 'us-east-1'
        AWS_ACCOUNT_ID = 'REDACTED_ACCOUNT_ID'
        ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        BACKEND_REPO   = 'shopnow-backend'
        FRONTEND_REPO  = 'shopnow-frontend'
        ECS_CLUSTER    = 'shopnow-cluster'
        // Tag combines build number + short commit SHA for full traceability
        IMAGE_TAG      = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'local'}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
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
                    sh """
                        aws ecs run-task \
                          --cluster ${ECS_CLUSTER} \
                          --task-definition shopnow-backend \
                          --launch-type FARGATE \
                          --overrides '{"containerOverrides":[{"name":"backend","command":["node","src/config/migrate.js"]}]}' \
                          --network-configuration 'awsvpcConfiguration={subnets=[],securityGroups=[],assignPublicIp=DISABLED}' \
                          --region ${AWS_REGION}
                    """
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
    }

    post {
        // Always clean up local images to keep Jenkins agent disk free
        always {
            sh """
                docker rmi ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG} || true
                docker rmi ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG} || true
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

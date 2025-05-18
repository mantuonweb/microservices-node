pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = "your-registry.com"
        DOCKER_NAMESPACE = "microservices"
        VERSION = "${env.BUILD_NUMBER}"
    }
    
    stages {
        stage('Build') {
            steps {
                sh 'npm install'
                sh 'npm run build'
            }
        }
        
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        
        stage('Docker Build') {
            parallel {
                stage('Product Service') {
                    steps {
                        dir('product-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/product-service:${VERSION} .'
                        }
                    }
                }
                stage('Order Service') {
                    steps {
                        dir('order-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/order-service:${VERSION} .'
                        }
                    }
                }
                stage('Customer Service') {
                    steps {
                        dir('customer-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/customer-service:${VERSION} .'
                        }
                    }
                }
                stage('Payment Service') {
                    steps {
                        dir('payment-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/payment-service:${VERSION} .'
                        }
                    }
                }
                stage('Inventory Service') {
                    steps {
                        dir('inventory-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/inventory-service:${VERSION} .'
                        }
                    }
                }
                stage('Auth Service') {
                    steps {
                        dir('auth-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/auth-service:${VERSION} .'
                        }
                    }
                }
                stage('Config Service') {
                    steps {
                        dir('config-service') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/config-service:${VERSION} .'
                        }
                    }
                }
                stage('API Gateway') {
                    steps {
                        dir('api-gateway') {
                            sh 'docker build -t ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/api-gateway:${VERSION} .'
                        }
                    }
                }
            }
        }
        
        stage('Docker Push') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-registry-credentials', passwordVariable: 'DOCKER_PASSWORD', usernameVariable: 'DOCKER_USERNAME')]) {
                    sh 'echo $DOCKER_PASSWORD | docker login $DOCKER_REGISTRY -u $DOCKER_USERNAME --password-stdin'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/product-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/order-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/customer-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/payment-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/inventory-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/auth-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/config-service:${VERSION}'
                    sh 'docker push ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/api-gateway:${VERSION}'
                }
            }
        }
        
        stage('Update Kubernetes Manifests') {
            steps {
                sh '''
                    for service in product-service order-service customer-service payment-service inventory-service auth-service config-service api-gateway; do
                        sed -i "s|image: .*${service}:.*|image: ${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}:${VERSION}|g" k8s/${service}-deployment.yaml
                    done
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                sh 'kubectl apply -f k8s/namespace.yaml || true'
                sh 'kubectl apply -f k8s/consul-deployment.yaml'
                sh 'kubectl apply -f k8s/rabbitmq-deployment.yaml'
                sh 'kubectl apply -f k8s/mongodb-deployment.yaml'
                sh 'kubectl apply -f k8s/config-service-deployment.yaml'
                sh 'kubectl apply -f k8s/product-service-deployment.yaml'
                sh 'kubectl apply -f k8s/order-service-deployment.yaml'
                sh 'kubectl apply -f k8s/customer-service-deployment.yaml'
                sh 'kubectl apply -f k8s/payment-service-deployment.yaml'
                sh 'kubectl apply -f k8s/inventory-service-deployment.yaml'
                sh 'kubectl apply -f k8s/auth-service-deployment.yaml'
                sh 'kubectl apply -f k8s/api-gateway-deployment.yaml'
                sh 'kubectl apply -f k8s/loki-deployment.yaml'
                sh 'kubectl apply -f k8s/grafana-deployment.yaml'
            }
        }
        
        stage('Verify Deployment') {
            steps {
                sh 'kubectl get pods -n default'
                sh 'kubectl get services -n default'
            }
        }
    }
    
    post {
        success {
            echo 'Deployment completed successfully!'
        }
        failure {
            echo 'Deployment failed!'
        }
        always {
            cleanWs()ß
        }
    }
}

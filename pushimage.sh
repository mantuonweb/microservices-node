#!/bin/bash

USERNAME="mantuonweb"

# Array of image names
IMAGES=(
  "microservices-query-service"
  "microservices-api-gateway"
  "microservices-product-service"
  "microservices-notification-service"
  "microservices-customer-service"
  "microservices-inventory-service"
  "microservices-payment-service"
  "microservices-auth-service"
  "microservices-order-service"
  "microservices-config-service"
  "microservices-ms-frontend"
)

# Login to Docker Hub
echo "Logging in to Docker Hub..."
docker login

# Tag and push each image
for IMAGE in "${IMAGES[@]}"
do
  # Extract service name from image name
  SERVICE=$(echo $IMAGE | sed 's/microservices-//g')
  
  echo "Tagging $IMAGE as $USERNAME/$SERVICE:latest"
  docker tag $IMAGE $USERNAME/$SERVICE:latest
  
  echo "Pushing $USERNAME/$SERVICE:latest to Docker Hub"
  docker push $USERNAME/$SERVICE:latest
  
  echo "Successfully pushed $SERVICE"
  echo "-----------------------------------"
done

echo "All images have been pushed to Docker Hub"

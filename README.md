# Microservices-Node

A Node.js-based microservices architecture demonstrating separation of concerns across multiple business domains.

## Services Overview


### Authentication Service
The Authentication Service handles user authentication and authorization. It provides:
- User registration and account management
- Token-based authentication
- Role-based access control

### Product Service
The Product Service manages the product catalog. It is responsible for:
- Storing and retrieving product information (name, description, price, etc.)
- Managing product categories
- Handling product search and filtering
- Providing product availability information

### Inventory Service
The Inventory Service tracks product stock levels and availability. It handles:
- Real-time inventory tracking
- Stock level updates

### Customer Service
The Customer Service manages customer data and accounts. Features include:
- Customer registration and profile management
- Authentication and authorization
- Customer preferences and settings
- Address management
- Order history access

### Order Service
The Order Service handles the order lifecycle. It is responsible for:
- Order creation and processing
- Order status tracking
- Payment coordination
- Order fulfillment tracking
- Order history and reporting
- Integration with inventory and shipping services

### Query Service
The Query Service provides a unified interface for querying data from various microservices. It handles:
- Aggregating data from multiple services
- Enforcing consistency and data integrity
- Providing a consistent query interface

### API Gateway
The API Gateway serves as the entry point for all client requests. It provides:
- A unified API interface for frontend applications
- Request routing to appropriate microservices
- Rate limiting and request throttling
- Response caching
- API documentation
- Load balancing
- Circuit breaking for fault tolerance

### Notification Service
The Notification Service handles sending notifications to customers. It supports:
- In-app notifications
- Integration with communication channels

## Monitoring & Observability

### Zipkin
Distributed tracing system accessible at:
- http://localhost:9411/zipkin

### Logs

#### MongoDB Logs
1. Access Grafana at http://localhost:4002 (login with admin/password)
2. Add MongoDB as a data source:
   - Go to Configuration > Data Sources > Add data source
   - Select "MongoDB" (installed via plugin)
   - Set URL to: `mongodb://root:example@ms-mongodb:27017/ecom-logs?authSource=admin`
   - Database: `ecom-logs`
   - Collection: `microservices_logs`

#### Using Loki in Grafana
When querying logs in Grafana with Loki:

1. **Access the Explore View**
   - Log in to Grafana (http://localhost:3000 by default)
   - Click on the "Explore" icon in the left sidebar (compass icon)
   - Select "Loki" in the top data source selector

2. **Create a Dashboard Panel**
   - Go to Dashboards in the left sidebar
   - Click "New Dashboard" or open an existing one
   - Click "Add panel"
   - Select "Loki" as the data source
   - Enter your Loki queries in the query editor

## Architecture

The services communicate with each other using RESTful APIs or message queues, ensuring loose coupling and independent scalability.

## Frontend
Access the frontend application at:
- http://localhost:8000/products

## Running the Application

### Standard Deployment
```
npm run install-all
docker-compose up -d
```

### Scaled Deployment
To run multiple instances of specific services:
```
docker-compose -f docker-compose-scaled.yml up -d --scale product-service=2 --scale customer-service=2
```

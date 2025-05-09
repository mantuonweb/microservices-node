# microservices-node

A Node.js-based microservices architecture demonstrating separation of concerns across multiple business domains.

## Services Overview

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

### API Gateway
The API Gateway serves as the entry point for all client requests. It provides:
- A unified API interface for frontend applications
- Request routing to appropriate microservices
- Authentication and authorization validation
- Rate limiting and request throttling
- Response caching
- API documentation
- Load balancing
- Circuit breaking for fault tolerance


### Logs

Connecting to MongoDB Logs
Access Grafana at http://localhost:4002 (login with admin/password)
Add your MongoDB as a data source:
Go to Configuration > Data Sources > Add data source
Select "MongoDB" (installed via plugin)
Set URL to: mongodb://root:example@ms-mongodb:27017/ecom-logs?authSource=admin
Database: ecom-logs
Collection: microservices_logs

Finding Where to Place Loki Queries in Grafana
When you're trying to query your logs in Grafana with Loki, you need to navigate to the right place in the Grafana UI. Here's a step-by-step guide:

1. Access the Explore View
The easiest way to start querying your logs:

Log in to Grafana (http://localhost:3000 by default)
Click on the "Explore" icon in the left sidebar (it looks like a compass)
In the top data source selector, make sure "Loki" is selected
2. Create a Dashboard Panel
If you want to add queries to a dashboard:

Go to Dashboards in the left sidebar
Click "New Dashboard" or open an existing one
Click "Add panel"
In the new panel, select "Loki" as the data source
You'll see a query editor where you can enter your Loki queries

## Architecture

The services communicate with each other using RESTful APIs or message queues, ensuring loose coupling and independent scalability.


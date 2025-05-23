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

https://medium.com/trabe/tracing-express-services-with-zipkin-js-6e5c5680467e#id_token=eyJhbGciOiJSUzI1NiIsImtpZCI6IjY2MGVmM2I5Nzg0YmRmNTZlYmU4NTlmNTc3ZjdmYjJlOGMxY2VmZmIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIyMTYyOTYwMzU4MzQtazFrNnFlMDYwczJ0cDJhMmphbTRsamRjbXMwMHN0dGcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIyMTYyOTYwMzU4MzQtazFrNnFlMDYwczJ0cDJhMmphbTRsamRjbXMwMHN0dGcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTAzODg5ODUwMTA0MTQ2Mjg1MTEiLCJlbWFpbCI6Im1hbnR1b253ZWJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5iZiI6MTc0NzY3NDUwMSwibmFtZSI6Ik1hbnR1IE5pZ2FtIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0xVZDJYNmtGYUFPaTRDbGhwamI0b01ORWZwVHFOUktDMUdJal9lVlpQdWxJZE9PMEQ0UFE9czk2LWMiLCJnaXZlbl9uYW1lIjoiTWFudHUiLCJmYW1pbHlfbmFtZSI6Ik5pZ2FtIiwiaWF0IjoxNzQ3Njc0ODAxLCJleHAiOjE3NDc2Nzg0MDEsImp0aSI6IjEyNDllMGVhMDhlZTI1MGI0YTg5ODRiOTY1ZDhhNDFhYTY5ZjA5ODYifQ.BTI4A3vKTp9mpCSnlqx66NYTA0BE0d4wLXcDHtNKZsvi8ZOVkv2QSyDkSiSzf9E2jprC70fUZx1osqAFWGW_Eu-pBvV16wTCND2Yz62770sEpgQl3IqXuhS94MK8uc7n3wbBxw9-v6HUUzQUzk_jeFIJ3uMuDn5tc3-qAtccqz3B1rbb_F_xMhwM59RjSPe3RB81KNb0gvMC4C2NWr55HhGRx0oxGbVWle4mDjm63Mtv4FLYMAzUOBUbqdwes3l_MvD8fQDxAM4fGiPO16Z636_tUEIySbxNXgQvUQbrUc_kwR9FA_Lji77vaFJNMRmRTAhVf6RyfAAllfWUxSJnIgß
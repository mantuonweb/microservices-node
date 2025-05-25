const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const customerRoutes = require('../routes/customer.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');

const SERVICE_NAME = 'customer-service';

const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3006;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    app.use(actuator('/management'));
    app.use(new AuthMiddleware().authenticate());
    // Initialize MongoDB connection    // Initialize Zipkin using the helper class
    const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
    zipkinHelper.initialize(app);
    mongoClient.getInstance().connect();
    // Configure routes
    app.use('/api/customers', customerRoutes);

    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Customer Service' });
    });

    return { app, PORT };
};
module.exports = configureApp;
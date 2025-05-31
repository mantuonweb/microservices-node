const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const paymentRoutes = require('../routes/payment.routes');
const paymentTransactionRoutes = require('../routes/payment-transaction.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const { startScheduler } = require('../schedulers/transaction-scheduler');
const SERVICE_NAME = 'payment-service';

const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3007;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    app.use(actuator('/management'));
    app.use(new AuthMiddleware().authenticate());
    // Initialize MongoDB connection
    mongoClient.getInstance().connect();
    startScheduler();
    // Initialize Zipkin using the helper class
    const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
    zipkinHelper.initialize(app);
    // Configure routes
    app.use('/api/payments', paymentRoutes);
    app.use('/api/payments/transactions', paymentTransactionRoutes);

    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Payment Service' });
    });
    return { app, PORT };
};

module.exports = configureApp;
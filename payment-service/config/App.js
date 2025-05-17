const express = require('express');
const cors = require('cors');
const paymentRoutes = require('../routes/payment.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');

const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3007;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    app.use(new AuthMiddleware.authenticate());
    // Initialize MongoDB connection
    mongoClient.getInstance().connect();
    // Configure routes
    app.use('/api/payments', paymentRoutes);

    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Payment Service' });
    });

    return { app, PORT };
};
module.exports = configureApp;
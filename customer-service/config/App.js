const express = require('express');
const cors = require('cors');
const customerRoutes = require('../routes/customer.routes');
const logger = require('../utils/logger');
const mongoClient = require('../utils/MongoConnectionClient');

const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3006;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    // Initialize MongoDB connection
    mongoClient.connect();
    // Configure routes
    app.use('/api/customers', customerRoutes);

    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Customer Service' });
    });

    return { app, PORT };
};
module.exports = configureApp;
const express = require('express');
const cors = require('cors');
const authRoutes = require('../routes/auth.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const ZipkinHelper = require('../utils/ZipkinHelper');
const actuator = require('express-actuator');

const SERVICE_NAME = 'auth-service';

const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3005;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    app.use(actuator('/management'));
    // Initialize Zipkin using the helper class
    const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
    zipkinHelper.initialize(app);

    // Initialize MongoDB connection
    mongoClient.getInstance().connect();
    // Configure routes
    app.use('/api/auth', authRoutes);

    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Auth Service' });
    });

    return { app, PORT };
};
module.exports = configureApp;
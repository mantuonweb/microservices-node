const express = require('express');
const cors = require('cors');
const notificationRoutes = require('../routes/notification.routes');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const SERVICE_NAME = 'notification-service';
const configureApp = () => {
    const app = express();
    const PORT = process.env.PORT || 3030;
    // Configure middleware
    app.use(express.json());
    app.use(cors());
    app.use(new AuthMiddleware().authenticate());
    // Configure routes
    // Initialize Zipkin using the helper class
    const zipkinHelper = new ZipkinHelper(SERVICE_NAME);
    zipkinHelper.initialize(app);
    app.use('/api/notifications', notificationRoutes);
    
    // Health Check
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'Notification Service' });
    });

    return { app, PORT };
};
module.exports = configureApp;
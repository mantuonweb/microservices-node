const express = require('express');
const cors = require('cors');
const actuator = require('express-actuator');
const paymentRoutes = require('../routes/payment.routes');
const paymentTransactionRoutes = require('../routes/payment-transaction.routes');
const mongoClient = require('../utils/MongoConnectionClient');
const AuthMiddleware = require('../middleware/auth.middleware');
const ZipkinHelper = require('../utils/ZipkinHelper');
const PaymentScheduler = require('../utils/PaymentScheduler');
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

    // Initialize payment schedulers after MongoDB connection is established
    mongoClient.mongooseIntance.connection.once('open', () => {
        console.log(`Processing records from ${process.env.MONGODB_URL}`);
        // Example: Process pending payments every 15 minutes
        const pendingPaymentProcessor = new PaymentScheduler({
            collectionName: 'paymenttransactions',
            cronExpression: '*/1 * * * *',
            processorFunction: async (document) => {
                // Process the payment document
                // This is where you'd implement your payment processing logic
                console.log(`Processing payment: ${document._id}`);
                // Example: Call payment gateway, update status, etc.
                return Promise.resolve(true);
            }
        });
        pendingPaymentProcessor.start();
    });

    return { app, PORT };
};

module.exports = configureApp;
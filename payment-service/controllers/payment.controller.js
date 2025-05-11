const Payment = require('../models/payment.model');
const logger = require('../utils/logger');
const createCircuitBreaker = require('../middleware/circuitBreaker');
const withCircuitBreaker = require('../lib/CircuitBreaker');
class PaymentController {
  static async processPayment(req, res) {
    logger.info(`Payment processing initiated for order: ${req.body.orderId}`);
    try {
      const { orderId, customerId, amount, paymentMethod } = req.body;
      
      // Validate request
      if (!orderId || !customerId || !amount || !paymentMethod) {
        logger.warn('Payment validation failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Create payment record
      const payment = new Payment({
        orderId,
        customerId,
        amount,
        paymentMethod,
        status: 'PENDING'
      });
      
      logger.info(`Created pending payment for order: ${orderId}, amount: ${amount}`);
      
      // Simulate payment processing
      setTimeout(async () => {
        try {
          // Simulate success (in real app, this would integrate with payment gateway)
          const success = Math.random() > 0.2; // 80% success rate
          
          if (success) {
            payment.status = 'COMPLETED';
            payment.transactionId = `tx_${Date.now()}`;
            logger.info(`Payment ${payment._id} completed successfully with transaction ID: ${payment.transactionId}`);
          } else {
            payment.status = 'FAILED';
            logger.error(`Payment ${payment._id} failed during processing`);
          }
          
          payment.updatedAt = Date.now();
          await payment.save();
          
          logger.info(`Payment ${payment._id} processed with status: ${payment.status}`);
        } catch (error) {
          logger.error(`Error updating payment status for ${payment._id}:`, error);
        }
      }, 2000); // Simulate processing delay
      
      await payment.save();
      logger.info(`Payment ${payment._id} saved with PENDING status`);
      res.status(202).json({ 
        message: 'Payment processing initiated',
        paymentId: payment._id
      });
    } catch (error) {
      logger.error('Payment processing error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getPayment(req, res) {
    const paymentId = req.params.id;
    logger.info(`Fetching payment details for ID: ${paymentId}`);
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        logger.warn(`Payment not found for ID: ${paymentId}`);
        return res.status(404).json({ message: 'Payment not found' });
      }
      logger.info(`Successfully retrieved payment: ${paymentId}`);
      res.status(200).json(payment);
    } catch (error) {
      logger.error(`Error fetching payment ${paymentId}:`, error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getPaymentsByOrder(req, res) {
    const orderId = req.params.orderId;
    logger.info(`Fetching payments for order: ${orderId}`);
    try {
      const payments = await Payment.find({ orderId: orderId });
      logger.info(`Found ${payments.length} payments for order: ${orderId}`);
      res.status(200).json(payments);
    } catch (error) {
      logger.error(`Error fetching payments for order ${orderId}:`, error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async getAllPayments(req, res) {
    logger.info('Fetching all payments');
    try {
      const payments = await Payment.find({});
      logger.info(`Successfully retrieved ${payments.length} payments`);
      res.status(200).json(payments);
    } catch (error) {
      logger.error('Error fetching all payments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async refundPayment(req, res) {
    const paymentId = req.params.id;
    logger.info(`Refund requested for payment: ${paymentId}`);
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        logger.warn(`Refund failed: Payment not found for ID: ${paymentId}`);
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      if (payment.status !== 'COMPLETED') {
        logger.warn(`Refund rejected: Payment ${paymentId} has status ${payment.status}, not COMPLETED`);
        return res.status(400).json({ message: 'Only completed payments can be refunded' });
      }
      
      // Update payment status
      payment.status = 'REFUNDED';
      payment.updatedAt = Date.now();
      await payment.save();
      
      logger.info(`Payment ${payment._id} refunded successfully for order ${payment.orderId}, amount: ${payment.amount}`);
      
      res.status(200).json({ message: 'Payment refunded successfully', payment });
    } catch (error) {
      logger.error(`Refund error for payment ${paymentId}:`, error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

// Export the class directly (no instantiation needed)
module.exports = withCircuitBreaker(PaymentController,createCircuitBreaker);

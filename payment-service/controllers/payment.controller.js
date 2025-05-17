const Payment = require('../models/payment.model');
const logger = require('../utils/logger');
const { withCircuitBreaker, createCircuitBreaker } = require('../lib/CircuitBreaker');

class PaymentController {
  async processPayment(req, res) {
    logger.info(`Payment processing initiated for order: ${req.body.orderId || 'unknown'}`);
    try {
      const { orderId, customerId, amount, paymentMethod } = req.body || {};
      
      // Validate request
      if (!orderId || !customerId || !amount || !paymentMethod) {
        logger.warn('Payment validation failed: Missing required fields');
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Validate amount is a number
      if (isNaN(parseFloat(amount)) || !isFinite(amount)) {
        logger.warn(`Payment validation failed: Invalid amount format: ${amount}`);
        return res.status(400).json({ message: 'Amount must be a valid number' });
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
          await payment.save().catch(err => {
            logger.error(`Failed to save updated payment status for ${payment._id}:`, err);
          });
          
          logger.info(`Payment ${payment._id} processed with status: ${payment.status}`);
        } catch (error) {
          logger.error(`Error updating payment status for ${payment._id}:`, error);
        }
      }, 2000); // Simulate processing delay
      
      try {
        await payment.save();
        logger.info(`Payment ${payment._id} saved with PENDING status`);
        res.status(202).json({ 
          message: 'Payment processing initiated',
          paymentId: payment._id
        });
      } catch (saveError) {
        logger.error('Error saving initial payment record:', saveError);
        return res.status(500).json({ message: 'Failed to create payment record' });
      }
    } catch (error) {
      logger.error('Payment processing error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async getPayment(req, res) {
    if (!req.params || !req.params.id) {
      logger.warn('Missing payment ID in request');
      return res.status(400).json({ message: 'Payment ID is required' });
    }
    
    const paymentId = req.params.id;
    logger.info(`Fetching payment details for ID: ${paymentId}`);
    
    try {
      if (!paymentId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.warn(`Invalid payment ID format: ${paymentId}`);
        return res.status(400).json({ message: 'Invalid payment ID format' });
      }
      
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

  async getPaymentsByOrder(req, res) {
    if (!req.params || !req.params.orderId) {
      logger.warn('Missing order ID in request');
      return res.status(400).json({ message: 'Order ID is required' });
    }
    
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

  async getAllPayments(req, res) {
    logger.info('Fetching all payments');
    try {
      // Add pagination to avoid potential memory issues with large datasets
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const skip = (page - 1) * limit;
      
      if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1 || limit > 500) {
        return res.status(400).json({ message: 'Invalid pagination parameters' });
      }
      
      const payments = await Payment.find({}).skip(skip).limit(limit);
      const total = await Payment.countDocuments();
      
      logger.info(`Successfully retrieved ${payments.length} payments (page ${page}/${Math.ceil(total/limit)})`);
      res.status(200).json({
        payments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching all payments:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async refundPayment(req, res) {
    if (!req.params || !req.params.id) {
      logger.warn('Missing payment ID in refund request');
      return res.status(400).json({ message: 'Payment ID is required' });
    }
    
    const paymentId = req.params.id;
    logger.info(`Refund requested for payment: ${paymentId}`);
    
    try {
      if (!paymentId.match(/^[0-9a-fA-F]{24}$/)) {
        logger.warn(`Invalid payment ID format for refund: ${paymentId}`);
        return res.status(400).json({ message: 'Invalid payment ID format' });
      }
      
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        logger.warn(`Refund failed: Payment not found for ID: ${paymentId}`);
        return res.status(404).json({ message: 'Payment not found' });
      }
      
      if (payment.status !== 'COMPLETED') {
        logger.warn(`Refund rejected: Payment ${paymentId} has status ${payment.status}, not COMPLETED`);
        return res.status(400).json({ message: 'Only completed payments can be refunded' });
      }
      
      // Check if already refunded
      if (payment.status === 'REFUNDED') {
        logger.warn(`Payment ${paymentId} is already refunded`);
        return res.status(400).json({ message: 'Payment is already refunded' });
      }
      
      // Update payment status
      payment.status = 'REFUNDED';
      payment.updatedAt = Date.now();
      
      try {
        await payment.save();
        logger.info(`Payment ${payment._id} refunded successfully for order ${payment.orderId}, amount: ${payment.amount}`);
        res.status(200).json({ message: 'Payment refunded successfully', payment });
      } catch (saveError) {
        logger.error(`Failed to save refund status for payment ${paymentId}:`, saveError);
        res.status(500).json({ message: 'Failed to process refund' });
      }
    } catch (error) {
      logger.error(`Refund error for payment ${paymentId}:`, error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}


module.exports = withCircuitBreaker(PaymentController, createCircuitBreaker);
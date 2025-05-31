const PaymentTransaction = require('../models/payment-transaction.model');

class PaymentTransactionController {
  /**
   * Create a new payment transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTransaction(req, res) {
    try {
      const {
        orderId,
        txId,
        status,
        retry,
        metadata,
        paymentId,
        hasDataSyncIssue
      } = req.body;

      const newTransaction = new PaymentTransaction({
        orderId,
        txId,
        status,
        retry,
        metadata,
        paymentId,
        hasDataSyncIssue
      });
      const savedTransaction = await newTransaction.save();
      
      return res.status(201).json({
        success: true,
        data: savedTransaction,
        message: 'Payment transaction created successfully'
      });
    } catch (error) {
      console.error('Error creating payment transaction:', error);
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Transaction with this txId already exists'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment transaction',
        error: error.message
      });
    }
  }

  /**
   * Get a payment transaction by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTransactionById(req, res) {
    try {
      const transaction = await PaymentTransaction.findById(req.params.id);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: transaction
      });
    } catch (error) {
      console.error('Error fetching payment transaction:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment transaction',
        error: error.message
      });
    }
  }

  /**
   * Get payment transactions by orderId
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTransactionsByOrderId(req, res) {
    try {
      const { orderId } = req.params;
      
      const transactions = await PaymentTransaction.find({ orderId });
      
      return res.status(200).json({
        success: true,
        count: transactions.length,
        data: transactions
      });
    } catch (error) {
      console.error('Error fetching payment transactions by orderId:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment transactions',
        error: error.message
      });
    }
  }

  /**
   * Update a payment transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTransaction(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Prevent updating these fields directly
      delete updateData.createdAt;
      delete updateData.txId; // txId should be immutable
      
      const updatedTransaction = await PaymentTransaction.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: updatedTransaction,
        message: 'Payment transaction updated successfully'
      });
    } catch (error) {
      console.error('Error updating payment transaction:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update payment transaction',
        error: error.message
      });
    }
  }

  /**
   * Update transaction status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTransactionStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }
      
      const updatedTransaction = await PaymentTransaction.findByIdAndUpdate(
        id,
        { 
          status,
          updatedAt: Date.now()
        },
        { new: true, runValidators: true }
      );
      
      if (!updatedTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: updatedTransaction,
        message: `Payment transaction status updated to ${status}`
      });
    } catch (error) {
      console.error('Error updating transaction status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update transaction status',
        error: error.message
      });
    }
  }

  /**
   * Increment retry count
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async incrementRetry(req, res) {
    try {
      const { id } = req.params;
      
      const transaction = await PaymentTransaction.findById(id);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found'
        });
      }
      
      // Increment retry count and update lastAttemptAt
      transaction.retry.count += 1;
      transaction.retry.lastAttemptAt = Date.now();
      
      await transaction.save();
      
      return res.status(200).json({
        success: true,
        data: transaction,
        message: `Retry count incremented to ${transaction.retry.count}`
      });
    } catch (error) {
      console.error('Error incrementing retry count:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to increment retry count',
        error: error.message
      });
    }
  }

  /**
   * Delete a payment transaction
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteTransaction(req, res) {
    try {
      const { id } = req.params;
      
      const deletedTransaction = await PaymentTransaction.findByIdAndDelete(id);
      
      if (!deletedTransaction) {
        return res.status(404).json({
          success: false,
          message: 'Payment transaction not found'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Payment transaction deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting payment transaction:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete payment transaction',
        error: error.message
      });
    }
  }

  /**
   * Get all payment transactions with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllTransactions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const transactions = await PaymentTransaction.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await PaymentTransaction.countDocuments();
      
      return res.status(200).json({
        success: true,
        count: transactions.length,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        data: transactions
      });
    } catch (error) {
      console.error('Error fetching all payment transactions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment transactions',
        error: error.message
      });
    }
  }
}

module.exports = new PaymentTransactionController();
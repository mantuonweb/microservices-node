const PaymentTransaction = require('../models/payment-transaction.model');
const NotificationService = require('../lib/notification-manager');
class TransactionProcessor {
  constructor() {
    // Ensure this constructor is only used once
    if (TransactionProcessor.instance) {
      return TransactionProcessor.instance;
    }

    TransactionProcessor.instance = this;
  }

  /**
   * Process pending transactions
   * @returns {Promise<{processed: number, completed: number, failed: number}>}
   */
  async processPendingTransactions() {
    // Find pending transactions
    const pendingTransactions = await PaymentTransaction.find({
      $or: [
        { status: 'PROCESSING' },
        { hasDataSyncIssue: true }
      ]
    }).sort({ createdAt: 1 }); // Process oldest transactions first

    const stats = {
      processed: pendingTransactions.length,
      completed: 0,
      failed: 0
    };

    // Process each transaction
    for (const tx of pendingTransactions) {
      try {
        const result = await this.processTransaction(tx);

        // Update transaction status based on result
        tx.retry.count += 1;
        tx.retry.lastAttemptAt = new Date();

        if (result.success) {
          tx.status = 'COMPLETED';
          tx.completedAt = new Date();
          tx.hasDataSyncIssue = false;
          tx.responseData = result.data;
          stats.completed++;
        } else {
          // Check if max retries reached
          if (tx.retry.count >= tx.retry.maxAttempts) {
            tx.status = 'FAILED';
            tx.failureReason = result.error || 'Max retry attempts reached';
            stats.failed++;
          } else {
            tx.status = 'RETRY';
          }
        }

        await tx.save();
      } catch (err) {
        // Increment retry count and save failure info
        tx.retry.count += 1;
        tx.retry.lastAttemptAt = new Date();
        tx.lastError = {
          message: err.message,
          stack: err.stack,
          timestamp: new Date()
        };

        // Check if max retries reached
        if (tx.retry.count >= tx.retry.maxAttempts) {
          tx.status = 'FAILED';
          tx.failureReason = 'Max retry attempts reached';
          stats.failed++;
        }

        await tx.save();
      }
    }

    return stats;
  }

  /**
   * Process a payment transaction
   * @param {Object} transaction - The transaction to process
   * @returns {Promise<Object>} - Result with success flag and data/error
   */
  async processTransaction(transaction) {
    try {
      // Implement your payment processing logic here
      // This could involve interacting with payment gateways, APIs, etc.
      // Return success flag and data/error as needed
      console.log('Processing transaction:', transaction);
      await NotificationService.getInstance().connect();
      await NotificationService.getInstance().publishNotification('order.reprocess', transaction);
      return {
        success: true,
        data: { message: 'Payment processed successfully' }
      };

    } catch (error) {
       console.log('Processing transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the singleton instance
   * @returns {TransactionProcessor}
   */
  static getInstance() {
    if (!TransactionProcessor.instance) {
      TransactionProcessor.instance = new TransactionProcessor();
    }
    return TransactionProcessor.instance;
  }
}

// Initialize the singleton instance
TransactionProcessor.instance = null;

// Export the singleton instance
module.exports = TransactionProcessor;
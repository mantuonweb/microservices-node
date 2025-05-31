const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  txId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'INITIATED'
  },
  retry: {
    count: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    lastAttemptAt: {
      type: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  paymentId: {
    type: String,
    index: true
  }
});

// Create compound index for efficient querying
PaymentTransactionSchema.index({ orderId: 1, status: 1 });

// Update the updatedAt timestamp before saving
PaymentTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
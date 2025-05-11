const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);


const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;

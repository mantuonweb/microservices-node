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
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    warehouseLocation: {
      type: String,
      required: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Virtual for available quantity
inventorySchema.virtual('availableQuantity').get(function () {
  return this.quantity - this.reservedQuantity;
});

// Method to check if enough stock is available
inventorySchema.methods.hasAvailableStock = function (requestedQuantity) {
  return this.availableQuantity >= requestedQuantity;
};

// Method to reserve stock
inventorySchema.methods.reserveStock = function (quantity) {
  if (!this.hasAvailableStock(quantity)) {
    return false;
  }
  this.reservedQuantity += quantity;
  return true;
};

// Method to release reserved stock
inventorySchema.methods.releaseReservedStock = function (quantity) {
  this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
  return true;
};

// Method to commit reserved stock (decrease actual quantity)
inventorySchema.methods.commitReservedStock = function (quantity) {
  if (this.reservedQuantity < quantity) {
    return false;
  }
  this.quantity -= quantity;
  this.reservedQuantity -= quantity;
  return true;
};

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;

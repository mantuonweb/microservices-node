const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
  },
  products: [
    {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
      quantity: { type: Number, required: true, default: 1 },
    },
  ],
  totalAmount: { type: Number },
  paymentId: { type: String },
  address: { type: String },
  mode: { type: String, required: true },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

orderSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

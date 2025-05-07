const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: String,
  name: String,
  price: Number,
  description: String,
  stock: Number,
});

module.exports = mongoose.model('Product', productSchema);

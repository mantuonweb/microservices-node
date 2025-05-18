const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Optional: automatically delete tokens after 30 days
    }
});
const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
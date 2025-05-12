const express = require('express');
const eventController = require('../controllers/events.controller');

const router = express.Router();

// Event routes
router.post('/sync', eventController.dispatchSync);

module.exports = router;

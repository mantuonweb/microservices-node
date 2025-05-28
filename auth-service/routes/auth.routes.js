const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify', authController.verifyToken);
router.get('/profile', authController.getProfile);
router.post('/logout', authController.logout);

module.exports = router;
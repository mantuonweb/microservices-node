const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');
const logger = require('../utils/logger');

class AuthController {
  // Register a new user
  static async register(req, res) {
    try {
      logger.info('Registration attempt', { username: req.body.username, email: req.body.email });
      const { username, email, password, roles } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        logger.warn('Registration failed: User already exists', {
          username,
          email,
          existingUsername: existingUser.username
        });
        return res.status(409).json({
          message: 'User already exists with that email or username'
        });
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        roles
      });

      await user.save();
      logger.info('User registered successfully', {
        userId: user._id,
        username
      });

      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.password;

      res.status(201).json({
        message: 'User registered successfully',
        user: userResponse
      });
    } catch (error) {
      logger.error('Registration error', { error: error.message, stack: error.stack });
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error registering user' });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      logger.info('Login attempt', { username: req.body.username });
      const { username, password } = req.body;

      // Find user by username
      const user = await User.findOne({ username });

      if (!user) {
        logger.warn('Login failed: User not found', { username });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.password !== password) {
        logger.warn('Login failed: Invalid password', { username, userId: user._id });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          roles: user.roles
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRATION }
      );

      // Store token in database
      await Token.create({
        userId: user._id,
        token,
        status: 'active'
      });

      logger.info('Login successful', {
        userId: user._id,
        username,
        roles: user.roles,
      });
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 * 60// 24 hours
      });
      res.status(200).json({
        message: 'Login successful',
        user: {
          id: user._id,
          username,
          token
        }
      });
    } catch (error) {
      logger.error('Login error', { error: error.message, stack: error.stack });
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error during login' });
    }
  }

  // Verify token
  static async verifyToken(req, res) {
    try {
      const token = req.body.token || req.query.token || req.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Token verification failed: No token provided');
        return res.status(401).json({ valid: false, message: 'No token provided' });
      }

      logger.info('Verifying token');

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.debug('Token decoded', { userId: decoded.id, username: decoded.username });

      // Check if user still exists
      const user = await User.findById(decoded.id);

      if (!user) {
        logger.warn('Token verification failed: User not found', { userId: decoded.id });
        return res.status(401).json({ valid: false, message: 'User not found' });
      }

      logger.info('Token verified successfully', { userId: user._id, username: user.username });

      // Return user info
      res.status(200).json({
        valid: true,
        user: {
          id: user._id,
          username: user.username,
          roles: user.roles
        }
      });
    } catch (error) {
      logger.error('Token verification error', { error: error.message, stack: error.stack });
      console.error('Token verification error:', error);
      res.status(401).json({ valid: false, message: 'Invalid token' });
    }
  }

  // Get user profile
  static async getProfile(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Profile access denied: No token provided');
        return res.status(401).json({ message: 'Authentication required' });
      }

      logger.info('Retrieving user profile');

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      logger.debug('Token decoded for profile access', { userId: decoded.id });

      // Get user without password
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        logger.warn('Profile access failed: User not found', { userId: decoded.id });
        return res.status(404).json({ message: 'User not found' });
      }

      logger.info('Profile retrieved successfully', { userId: user._id, username: user.username });

      res.status(200).json({ user });
    } catch (error) {
      logger.error('Profile access error', { error: error.message, stack: error.stack });
      console.error('Profile error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  }

  // Logout user - fixed to be static and include logging
  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Logout failed: No token provided');
        return res.status(400).json({ message: 'No token provided' });
      }

      logger.info('Logout attempt');

      try {
        // Verify the token is valid before invalidating
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        logger.debug('Token decoded for logout', { userId: decoded.id, username: decoded.username });

        // Mark token as inactive
        await Token.findOneAndUpdate(
          { token },
          { status: 'inactive' },
          { upsert: true } // Create if doesn't exist
        );

        // Clear the auth cookie
        res.clearCookie('auth_token');

        logger.info('Logout successful', { userId: decoded.id, username: decoded.username });
        res.status(200).json({ message: 'Logout successful' });
      } catch (jwtError) {
        logger.warn('Logout with invalid token', { error: jwtError.message });
        // Even if token is invalid, clear the cookie and return success
        res.clearCookie('auth_token');
        res.status(200).json({ message: 'Logout successful' });
      }
    } catch (error) {
      logger.error('Logout error', { error: error.message, stack: error.stack });
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
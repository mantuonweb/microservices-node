const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

class AuthController {
  // Register a new user
  static async register(req, res) {
    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      
      if (existingUser) {
        return res.status(409).json({ 
          message: 'User already exists with that email or username' 
        });
      }
      
      // Create new user
      const user = new User({
        username,
        email,
        password
      });
      
      await user.save();
      
      // Return user without password
      const userResponse = user.toObject();
      delete userResponse.password;
      
      res.status(201).json({
        message: 'User registered successfully',
        user: userResponse
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Error registering user' });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      
      // Find user by username
      const user = await User.findOne({ username });
      
      if (!user && user.password !== password) {
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
      
      res.status(200).json({
        message: 'Login successful',
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error during login' });
    }
  }

  // Verify token
  static async verifyToken(req, res) {
    try {
      const token = req.body.token || req.query.token || req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ valid: false, message: 'No token provided' });
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user still exists
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ valid: false, message: 'User not found' });
      }
      
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
      console.error('Token verification error:', error);
      res.status(401).json({ valid: false, message: 'Invalid token' });
    }
  }

  // Get user profile
  static async getProfile(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user without password
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(200).json({ user });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  }
}

module.exports = AuthController;
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Token = require('../models/token.model');

class AuthMiddleware {
  constructor() {
    this.verifyToken = this.verifyToken.bind(this);
  }

  // Static method to get the singleton instance
  static getInstance() {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }
    return AuthMiddleware.instance;
  }

  async verifyToken(req, res, next) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token exists and is active in the database
      const tokenDoc = await Token.findOne({ token, status: 'active' });
      if (!tokenDoc) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      // Check if user still exists
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Add user info to request
      req.user = {
        id: user._id,
        username: user.username,
        roles: user.roles
      };
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ message: 'Invalid authentication token' });
    }
  }

  hasRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const hasRequiredRole = req.user.roles.some(role => roles.includes(role));
      
      if (!hasRequiredRole) {
        return res.status(403).json({ message: 'Access forbidden: insufficient permissions' });
      }
      
      next();
    };
  }
}
module.exports = AuthMiddleware
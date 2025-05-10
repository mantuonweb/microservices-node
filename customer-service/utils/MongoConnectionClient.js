const mongoose = require('mongoose');
const logger = require('./logger');

class MongoConnectionClient {
  constructor() {
    this.mongoURI = process.env.MONGODB_URL;
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
  }

  connect() {
    mongoose.set('strictQuery', false);

    mongoose.connect(this.mongoURI, this.options);

    // Set up event listeners for the MongoDB connection
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return mongoose.connection;
  }
}

module.exports = new MongoConnectionClient();

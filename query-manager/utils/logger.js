const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
require('winston-mongodb');
const LokiTransport = require('winston-loki');

const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Environment check
const isMongoLogging = (process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'dev');

const logger = createLogger({
  format: combine(timestamp(), customFormat),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: '../../monitor-logs/logs/error_order.log',
      level: 'error',
    }),
    new transports.File({ filename: '../../monitor-logs/logs/combined.log' }),
  ],
});

// Add MongoDB transport for production or local development that mimics production
if (isMongoLogging) {
  logger.add(
    new transports.MongoDB({
      level: 'info',
      db: process.env.MONGO_LOG_URL || 'mongodb://root:example@ms-mongodb:27017/ecom-logs?authSource=admin',
      options: {
        useUnifiedTopology: true,
      },
      collection: 'microservices_logs',
      format: format.metadata()
    })
  );
}

// Add Loki transport for visualization
if (process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'dev') {
  logger.add(new LokiTransport({
    host: process.env.LOKI_URL || 'http://ms-loki:3100',
    labels: { job: 'query-service' },
    json: true,
    format: format.json(),
    replaceTimestamp: true,
    onConnectionError: (err) => console.error(err)
  }));
}

module.exports = logger;

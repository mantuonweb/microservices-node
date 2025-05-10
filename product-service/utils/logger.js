const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

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

module.exports = logger;

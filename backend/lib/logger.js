/**
 * Centralized Logger — replaces scattered console.error/log calls.
 * Uses pino for structured JSON logging in production,
 * pino-pretty for human-readable output in development.
 */
const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    ...(isProduction
        ? {} // JSON output in production (machine-readable)
        : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } } }
    ),
});

// Helper: create a child logger scoped to a controller
logger.child = logger.child.bind(logger);

module.exports = logger;

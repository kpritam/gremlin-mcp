/**
 * Logging configuration using Winston.
 */

import winston from 'winston';
import { config } from './config.js';

/**
 * Create a Winston logger with appropriate formatting and transports.
 *
 * @param logLevel - The log level to use
 * @returns Configured Winston logger
 */
function createLogger(logLevel: string): winston.Logger {
  const isVerbose = ['debug', 'info', 'warn'].includes(logLevel);

  const baseFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  );

  const consoleFormat = isVerbose
    ? winston.format.combine(
        baseFormat,
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta, null, 2)}`;
          }
          return log;
        })
      )
    : winston.format.combine(winston.format.colorize(), winston.format.simple());

  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(baseFormat, winston.format.json()),
    defaultMeta: { service: 'gremlin-mcp' },
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'debug'],
        format: consoleFormat,
      }),
    ],
  });
}

/**
 * Configure winston logger with appropriate formatting and transports.
 */
export const logger = createLogger(config.logLevel);

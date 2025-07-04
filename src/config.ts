/**
 * Enhanced configuration module for Gremlin MCP Server using Effect Config.
 * Implements nested configuration patterns with comprehensive validation.
 */

import { Config, Effect, pipe } from 'effect';
import { DEFAULTS } from './constants.js';

/**
 * Parse a boolean value from a string.
 * Accepts various formats: 'true', 'false', '1', '0', 't', 'f' (case insensitive)
 */
function parseBooleanValue(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 't';
}

/**
 * Parse the Gremlin endpoint string.
 * Format: host:port or host:port/traversal_source
 */
function parseEndpoint(endpoint: string): { host: string; port: number; traversalSource: string } {
  const parts = endpoint.split('/');
  const hostPort = parts[0];
  const traversalSource = parts[1] ?? DEFAULTS.TRAVERSAL_SOURCE;

  if (!hostPort) {
    throw new Error('Invalid endpoint format. Expected host:port or host:port/traversal_source');
  }

  const hostPortParts = hostPort.split(':');
  if (hostPortParts.length !== 2) {
    throw new Error('Invalid endpoint format. Expected host:port or host:port/traversal_source');
  }

  const host = hostPortParts[0];
  const portStr = hostPortParts[1];

  if (!host || !portStr) {
    throw new Error('Invalid endpoint format. Host and port are required');
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port <= 0) {
    throw new Error('Port must be a positive integer');
  }

  return { host, port, traversalSource };
}

/**
 * Effect Config definitions for all configuration values
 */
const GremlinEndpointConfig = pipe(Config.string('GREMLIN_ENDPOINT'), Config.map(parseEndpoint));

const GremlinUseSslConfig = pipe(
  Config.string('GREMLIN_USE_SSL'),
  Config.withDefault(String(DEFAULTS.USE_SSL)),
  Config.map(parseBooleanValue)
);

const GremlinUsernameConfig = Config.option(Config.string('GREMLIN_USERNAME'));
const GremlinPasswordConfig = Config.option(Config.redacted('GREMLIN_PASSWORD'));

const LogLevelConfig = pipe(
  Config.literal('error', 'warn', 'info', 'debug')('LOG_LEVEL'),
  Config.withDefault(DEFAULTS.LOG_LEVEL)
);

const GremlinIdleTimeoutConfig = pipe(
  Config.string('GREMLIN_IDLE_TIMEOUT'),
  Config.withDefault('300'),
  Config.map(val => parseInt(val, 10))
);

const GremlinEnumDiscoveryEnabledConfig = pipe(
  Config.string('GREMLIN_ENUM_DISCOVERY_ENABLED'),
  Config.withDefault('true'),
  Config.map(parseBooleanValue)
);

const GremlinEnumCardinalityThresholdConfig = pipe(
  Config.string('GREMLIN_ENUM_CARDINALITY_THRESHOLD'),
  Config.withDefault('10'),
  Config.map(val => parseInt(val, 10))
);

const GremlinEnumPropertyBlacklistConfig = pipe(
  Config.string('GREMLIN_ENUM_PROPERTY_BLACKLIST'),
  Config.withDefault(
    'id,pk,name,description,startDate,endDate,arrival,departure,timestamp,createdAt,updatedAt'
  ),
  Config.map(val => val.split(',').map(s => s.trim()))
);

const GremlinSchemaIncludeSampleValuesConfig = pipe(
  Config.string('GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES'),
  Config.withDefault('false'),
  Config.map(parseBooleanValue)
);

const GremlinSchemaMaxEnumValuesConfig = pipe(
  Config.string('GREMLIN_SCHEMA_MAX_ENUM_VALUES'),
  Config.withDefault('10'),
  Config.map(val => parseInt(val, 10))
);

const GremlinSchemaIncludeCountsConfig = pipe(
  Config.string('GREMLIN_SCHEMA_INCLUDE_COUNTS'),
  Config.withDefault('true'),
  Config.map(parseBooleanValue)
);

/**
 * Nested Gremlin connection configuration
 */
const GremlinConnectionConfig = Config.all({
  endpoint: GremlinEndpointConfig,
  useSSL: GremlinUseSslConfig,
  username: GremlinUsernameConfig,
  password: GremlinPasswordConfig,
  idleTimeout: GremlinIdleTimeoutConfig,
}).pipe(
  Config.map(config => ({
    host: config.endpoint.host,
    port: config.endpoint.port,
    traversalSource: config.endpoint.traversalSource,
    useSSL: config.useSSL,
    username: config.username,
    password: config.password,
    idleTimeout: config.idleTimeout,
  }))
);

/**
 * Schema discovery configuration with validation
 */
const SchemaDiscoveryConfig = Config.all({
  enumDiscoveryEnabled: GremlinEnumDiscoveryEnabledConfig,
  enumCardinalityThreshold: GremlinEnumCardinalityThresholdConfig,
  enumPropertyBlacklist: GremlinEnumPropertyBlacklistConfig,
  includeSampleValues: GremlinSchemaIncludeSampleValuesConfig,
  maxEnumValues: GremlinSchemaMaxEnumValuesConfig,
  includeCounts: GremlinSchemaIncludeCountsConfig,
}).pipe(
  Config.validate({
    message: 'Schema configuration validation failed',
    validation: config =>
      config.enumCardinalityThreshold > 0 &&
      config.maxEnumValues > 0 &&
      config.enumPropertyBlacklist.length > 0,
  })
);

/**
 * Server configuration with defaults
 */
const ServerConfig = Config.succeed({
  name: DEFAULTS.SERVER_NAME,
  version: DEFAULTS.SERVER_VERSION,
});

/**
 * Logging configuration with enhanced validation
 */
const LoggingConfig = Config.all({
  level: LogLevelConfig,
}).pipe(
  Config.map(config => ({
    level: config.level,
    structured: true, // Always use structured logging
  }))
);

/**
 * Complete application configuration with clean nested structure
 */
export const AppConfig = Config.all({
  gremlin: GremlinConnectionConfig,
  schema: SchemaDiscoveryConfig,
  server: ServerConfig,
  logging: LoggingConfig,
}).pipe(
  Config.validate({
    message: 'Application configuration validation failed',
    validation: config =>
      config.gremlin.host.length > 0 &&
      config.gremlin.port > 0 &&
      config.gremlin.port < 65536 &&
      config.schema.maxEnumValues <= 100, // Reasonable limit
  })
);

export type AppConfigType = Effect.Effect.Success<typeof AppConfig>;

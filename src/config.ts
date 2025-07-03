/**
 * Configuration module for Gremlin MCP Server using Effect Config.
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
 * Complete configuration combining all individual configs
 */
export const AppConfig = Config.all({
  endpoint: GremlinEndpointConfig,
  gremlinUseSSL: GremlinUseSslConfig,
  gremlinUsername: GremlinUsernameConfig,
  gremlinPassword: GremlinPasswordConfig,
  logLevel: LogLevelConfig,
  gremlinIdleTimeout: GremlinIdleTimeoutConfig,
  gremlinEnumDiscoveryEnabled: GremlinEnumDiscoveryEnabledConfig,
  gremlinEnumCardinalityThreshold: GremlinEnumCardinalityThresholdConfig,
  gremlinEnumPropertyBlacklist: GremlinEnumPropertyBlacklistConfig,
  gremlinSchemaIncludeSampleValues: GremlinSchemaIncludeSampleValuesConfig,
  gremlinSchemaMaxEnumValues: GremlinSchemaMaxEnumValuesConfig,
  gremlinSchemaIncludeCounts: GremlinSchemaIncludeCountsConfig,
}).pipe(
  Config.map(config => ({
    // Gremlin connection config
    gremlinHost: config.endpoint.host,
    gremlinPort: config.endpoint.port,
    gremlinTraversalSource: config.endpoint.traversalSource,
    gremlinUseSSL: config.gremlinUseSSL,
    gremlinUsername: config.gremlinUsername,
    gremlinPassword: config.gremlinPassword,
    gremlinIdleTimeout: config.gremlinIdleTimeout,
    gremlinEnumDiscoveryEnabled: config.gremlinEnumDiscoveryEnabled,
    gremlinEnumCardinalityThreshold: config.gremlinEnumCardinalityThreshold,
    gremlinEnumPropertyBlacklist: config.gremlinEnumPropertyBlacklist,
    gremlinSchemaIncludeSampleValues: config.gremlinSchemaIncludeSampleValues,
    gremlinSchemaMaxEnumValues: config.gremlinSchemaMaxEnumValues,
    gremlinSchemaIncludeCounts: config.gremlinSchemaIncludeCounts,

    // Server config
    serverName: DEFAULTS.SERVER_NAME,
    serverVersion: DEFAULTS.SERVER_VERSION,

    // Logging config
    logLevel: config.logLevel,
  }))
);

export type AppConfigType = Effect.Effect.Success<typeof AppConfig>;

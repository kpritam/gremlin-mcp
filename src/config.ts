/**
 * Configuration module for Gremlin MCP Server using Effect Config.
 */

import { Config, Effect, pipe } from 'effect';
import { z } from 'zod';
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

/**
 * Backward compatibility: Zod schema for runtime validation (kept for compatibility)
 */
const configSchema = z
  .object({
    GREMLIN_ENDPOINT: z.string().min(1, 'GREMLIN_ENDPOINT is required'),
    GREMLIN_USE_SSL: z.string().default(String(DEFAULTS.USE_SSL)).transform(parseBooleanValue),
    GREMLIN_USERNAME: z.string().optional(),
    GREMLIN_PASSWORD: z.string().optional(),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default(DEFAULTS.LOG_LEVEL),
    GREMLIN_IDLE_TIMEOUT: z
      .string()
      .default('300')
      .transform(val => parseInt(val, 10)),
    GREMLIN_ENUM_DISCOVERY_ENABLED: z.string().default('true').transform(parseBooleanValue),
    GREMLIN_ENUM_CARDINALITY_THRESHOLD: z
      .string()
      .default('10')
      .transform(val => parseInt(val, 10)),
    GREMLIN_ENUM_PROPERTY_BLACKLIST: z
      .string()
      .default(
        'id,pk,name,description,startDate,endDate,arrival,departure,timestamp,createdAt,updatedAt'
      )
      .transform(val => val.split(',').map(s => s.trim())),
    GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES: z.string().default('false').transform(parseBooleanValue),
    GREMLIN_SCHEMA_MAX_ENUM_VALUES: z
      .string()
      .default('10')
      .transform(val => parseInt(val, 10)),
    GREMLIN_SCHEMA_INCLUDE_COUNTS: z.string().default('true').transform(parseBooleanValue),
  })
  .transform(env => {
    const { host, port, traversalSource } = parseEndpoint(env.GREMLIN_ENDPOINT);

    return {
      // Gremlin connection config
      gremlinHost: host,
      gremlinPort: port,
      gremlinTraversalSource: traversalSource,
      gremlinUseSSL: env.GREMLIN_USE_SSL,
      gremlinUsername: env.GREMLIN_USERNAME,
      gremlinPassword: env.GREMLIN_PASSWORD,
      gremlinIdleTimeout: env.GREMLIN_IDLE_TIMEOUT,
      gremlinEnumDiscoveryEnabled: env.GREMLIN_ENUM_DISCOVERY_ENABLED,
      gremlinEnumCardinalityThreshold: env.GREMLIN_ENUM_CARDINALITY_THRESHOLD,
      gremlinEnumPropertyBlacklist: env.GREMLIN_ENUM_PROPERTY_BLACKLIST,
      gremlinSchemaIncludeSampleValues: env.GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES,
      gremlinSchemaMaxEnumValues: env.GREMLIN_SCHEMA_MAX_ENUM_VALUES,
      gremlinSchemaIncludeCounts: env.GREMLIN_SCHEMA_INCLUDE_COUNTS,

      // Server config
      serverName: DEFAULTS.SERVER_NAME,
      serverVersion: DEFAULTS.SERVER_VERSION,

      // Logging config
      logLevel: env.LOG_LEVEL,
    };
  });

export type AppConfigType = Effect.Effect.Success<typeof AppConfig>;

/**
 * Backward compatibility config export
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Validated and transformed configuration object (backward compatibility).
 * Parsed once during module initialization for efficiency.
 */
export const config = configSchema.parse(process.env);

/**
 * Effect for getting the configuration
 */
export const getConfig = Effect.succeed(config);

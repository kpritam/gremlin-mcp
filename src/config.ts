/**
 * Configuration module for Gremlin MCP Server.
 */

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
 * Comprehensive configuration schema with flattened structure.
 * Validates environment variables and transforms them into a clean config object.
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

export type Config = z.infer<typeof configSchema>;

/**
 * Validated and transformed configuration object.
 * Parsed once during module initialization for efficiency.
 */
export const config = configSchema.parse(process.env);

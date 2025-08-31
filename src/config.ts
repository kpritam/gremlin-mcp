/**
 * @fileoverview Application configuration with type-safe environment variable loading.
 *
 * Provides comprehensive configuration management for the Gremlin MCP server using
 * Effect.Config for validation and error handling. All configuration is loaded from
 * environment variables with sensible defaults and detailed validation.
 *
 * @example Environment Variables
 * ```bash
 * GREMLIN_ENDPOINT=localhost:8182
 * GREMLIN_USE_SSL=false
 * LOG_LEVEL=info
 * GREMLIN_ENUM_DISCOVERY_ENABLED=true
 * ```
 */

import { Config, ConfigError, Data, Effect, Either, pipe } from 'effect';
import { DEFAULTS } from './constants.js';

/**
 * Configuration Error ADTs
 *
 * Custom error types for structured config parsing and validation failures.
 * Used for fine-grained error reporting in config.ts.
 */

/**
 * Error thrown when a config field fails to parse.
 * @property field - Name of the config field
 * @property value - Raw value received
 * @property reason - Description of the parse failure
 */
export class ConfigParseError extends Data.TaggedError('ConfigParseError')<{
  readonly field: string;
  readonly value: string;
  readonly reason: string;
}> {}

/**
 * Error thrown when a Gremlin endpoint string fails to parse.
 * @property endpoint - Raw endpoint string
 * @property reason - Description of the parse failure
 */
export class EndpointParseError extends Data.TaggedError('EndpointParseError')<{
  readonly endpoint: string;
  readonly reason: string;
}> {}

/**
 * Error thrown when a config value fails a validation constraint.
 * @property field - Name of the config field
 * @property value - Value that failed validation
 * @property constraint - Description of the failed constraint
 */
export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly field: string;
  readonly value: unknown;
  readonly constraint: string;
}> {}

/**
 * Parses a string into a boolean value with comprehensive format support.
 * Accepts: 'true', 'false', '1', '0', 't', 'f', 'yes', 'no', 'y', 'n' (case insensitive)
 * Returns Either.right(boolean) on success, Either.left(ConfigError) on failure.
 * @param value - Raw string value to parse
 */
const parseBooleanValue = (value: string): Either.Either<boolean, ConfigError.ConfigError> => {
  const normalized = value.toLowerCase().trim();
  const truthyValues = ['true', '1', 't', 'yes', 'y'];
  const falsyValues = ['false', '0', 'f', 'no', 'n'];

  if (truthyValues.includes(normalized)) {
    return Either.right(true);
  }

  if (falsyValues.includes(normalized)) {
    return Either.right(false);
  }

  return Either.left(
    ConfigError.InvalidData(
      [],
      `Invalid boolean value '${value}'. Expected one of: ${[...truthyValues, ...falsyValues].join(', ')}`
    )
  );
};

/**
 * Parses and validates a Gremlin endpoint string.
 * Format: host:port or host:port/traversal_source
 * Returns Either.right({host, port, traversalSource}) on success, Either.left(ConfigError) on failure.
 * @param endpoint - Raw endpoint string
 */
const parseEndpoint = (
  endpoint: string
): Either.Either<
  { host: string; port: number; traversalSource: string },
  ConfigError.ConfigError
> => {
  const trimmedEndpoint = endpoint.trim();

  if (!trimmedEndpoint) {
    return Either.left(ConfigError.InvalidData([], 'Endpoint cannot be empty'));
  }

  const parts = trimmedEndpoint.split('/');
  const hostPort = parts[0];
  const traversalSource = parts[1] ?? DEFAULTS.TRAVERSAL_SOURCE;

  if (!hostPort) {
    return Either.left(
      ConfigError.InvalidData(
        [],
        'Invalid endpoint format. Expected host:port or host:port/traversal_source'
      )
    );
  }

  const hostPortParts = hostPort.split(':');
  if (hostPortParts.length !== 2) {
    return Either.left(
      ConfigError.InvalidData([], 'Invalid host:port format. Expected exactly one colon separator')
    );
  }

  const [host, portStr] = hostPortParts;

  if (!host?.trim() || !portStr?.trim()) {
    return Either.left(
      ConfigError.InvalidData([], 'Host and port are required and cannot be empty')
    );
  }

  const port = parseInt(portStr.trim(), 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return Either.left(
      ConfigError.InvalidData([], 'Port must be a positive integer between 1 and 65535')
    );
  }

  return Either.right({
    host: host.trim(),
    port,
    traversalSource: traversalSource.trim(),
  });
};

/**
 * Parses a string into a positive integer, with validation.
 * Returns Either.right(number) on success, Either.left(ConfigError) on failure.
 * @param field - Name of the config field (for error reporting)
 * @param value - Raw string value to parse
 */
const parsePositiveInteger =
  (field: string) =>
  (value: string): Either.Either<number, ConfigError.ConfigError> => {
    const parsed = parseInt(value.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) {
      return Either.left(
        ConfigError.InvalidData(
          [],
          `Invalid value for ${field}: '${value}'. Must be a positive integer`
        )
      );
    }
    return Either.right(parsed);
  };

/**
 * Parses a comma-separated string into a string array, trimming whitespace and removing empty entries.
 * @param value - Raw comma-separated string
 * @returns string[]
 */
const parseCommaSeparatedList = (value: string): string[] =>
  value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

/**
 * Effect Config definitions for all environment variables.
 * Each config object documents its environment variable, type, default, and validation logic.
 */
/**
 * GREMLIN_ENDPOINT: string, required. Format: host:port or host:port/traversal_source
 */
const GremlinEndpointConfig = pipe(
  Config.string('GREMLIN_ENDPOINT'),
  Config.mapOrFail(parseEndpoint)
);

/**
 * GREMLIN_USE_SSL: boolean, default: false. Accepts: true/false/1/0/t/f/yes/no/y/n
 */
const GremlinUseSslConfig = pipe(
  Config.string('GREMLIN_USE_SSL'),
  Config.withDefault(String(DEFAULTS.USE_SSL)),
  Config.mapOrFail(parseBooleanValue)
);

/**
 * GREMLIN_USERNAME: string, optional. Gremlin DB username
 */
const GremlinUsernameConfig = Config.option(Config.string('GREMLIN_USERNAME'));

/**
 * GREMLIN_PASSWORD: string, optional, redacted. Gremlin DB password
 */
const GremlinPasswordConfig = Config.option(Config.redacted('GREMLIN_PASSWORD'));

/**
 * LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug', default: info. Logging verbosity
 */
const LogLevelConfig = pipe(
  Config.literal('error', 'warn', 'info', 'debug')('LOG_LEVEL'),
  Config.withDefault(DEFAULTS.LOG_LEVEL)
);

/**
 * GREMLIN_IDLE_TIMEOUT: number, default: 300. Connection idle timeout (seconds)
 */
const GremlinIdleTimeoutConfig = pipe(
  Config.string('GREMLIN_IDLE_TIMEOUT'),
  Config.withDefault('300'),
  Config.mapOrFail(parsePositiveInteger('GREMLIN_IDLE_TIMEOUT'))
);

/**
 * GREMLIN_ENUM_DISCOVERY_ENABLED: boolean, default: true. Enable enum property discovery
 */
const GremlinEnumDiscoveryEnabledConfig = pipe(
  Config.string('GREMLIN_ENUM_DISCOVERY_ENABLED'),
  Config.withDefault('true'),
  Config.mapOrFail(parseBooleanValue)
);

/**
 * GREMLIN_ENUM_CARDINALITY_THRESHOLD: number, default: 10. Max cardinality for enum detection
 */
const GremlinEnumCardinalityThresholdConfig = pipe(
  Config.string('GREMLIN_ENUM_CARDINALITY_THRESHOLD'),
  Config.withDefault('10'),
  Config.mapOrFail(parsePositiveInteger('GREMLIN_ENUM_CARDINALITY_THRESHOLD'))
);

/**
 * GREMLIN_ENUM_PROPERTY_BLACKLIST: string, default: id,pk,name,description,...
 * Comma-separated list of properties to exclude from enum detection
 */
const GremlinEnumPropertyBlacklistConfig = pipe(
  Config.string('GREMLIN_ENUM_PROPERTY_BLACKLIST'),
  Config.withDefault(
    'id,pk,name,description,startDate,endDate,arrival,departure,timestamp,createdAt,updatedAt'
  ),
  Config.map(parseCommaSeparatedList),
  Config.validate({
    message: 'Enum property blacklist cannot be empty',
    validation: list => list.length > 0,
  })
);

/**
 * GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES: boolean, default: false. Include sample values in schema output
 */
const GremlinSchemaIncludeSampleValuesConfig = pipe(
  Config.string('GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES'),
  Config.withDefault('false'),
  Config.mapOrFail(parseBooleanValue)
);

/**
 * GREMLIN_SCHEMA_MAX_ENUM_VALUES: number, default: 10. Max enum values per property (≤ 100)
 */
const GremlinSchemaMaxEnumValuesConfig = pipe(
  Config.string('GREMLIN_SCHEMA_MAX_ENUM_VALUES'),
  Config.withDefault('10'),
  Config.mapOrFail(parsePositiveInteger('GREMLIN_SCHEMA_MAX_ENUM_VALUES')),
  Config.validate({
    message: 'Max enum values must be reasonable (≤ 100)',
    validation: value => value <= 100,
  })
);

/**
 * GREMLIN_SCHEMA_INCLUDE_COUNTS: boolean, default: true. Include property counts in schema output
 */
const GremlinSchemaIncludeCountsConfig = pipe(
  Config.string('GREMLIN_SCHEMA_INCLUDE_COUNTS'),
  Config.withDefault('true'),
  Config.mapOrFail(parseBooleanValue)
);

/**
 * GremlinConnectionConfig: Aggregates and validates all Gremlin connection-related environment variables.
 * Ensures host, port, traversalSource, useSSL, username, password, and idleTimeout are present and valid.
 * Returns a validated config object or throws ConfigError on failure.
 */
const GremlinConnectionConfig = pipe(
  Config.all({
    endpoint: GremlinEndpointConfig,
    useSSL: GremlinUseSslConfig,
    username: GremlinUsernameConfig,
    password: GremlinPasswordConfig,
    idleTimeout: GremlinIdleTimeoutConfig,
  }),
  Config.map(config => ({
    host: config.endpoint.host,
    port: config.endpoint.port,
    traversalSource: config.endpoint.traversalSource,
    useSSL: config.useSSL,
    username: config.username,
    password: config.password,
    idleTimeout: config.idleTimeout,
  })),
  Config.validate({
    message: 'Gremlin connection configuration validation failed',
    validation: config =>
      config.host.length > 0 &&
      config.port > 0 &&
      config.port <= 65535 &&
      config.idleTimeout > 0 &&
      config.traversalSource.length > 0,
  })
);

/**
 * SchemaDiscoveryConfig: Aggregates and validates all schema discovery-related environment variables.
 * Ensures enum discovery, cardinality, blacklist, sample values, max enum values, and counts are present and valid.
 * Returns a validated config object or throws ConfigError on failure.
 */
const SchemaDiscoveryConfig = pipe(
  Config.all({
    enumDiscoveryEnabled: GremlinEnumDiscoveryEnabledConfig,
    enumCardinalityThreshold: GremlinEnumCardinalityThresholdConfig,
    enumPropertyBlacklist: GremlinEnumPropertyBlacklistConfig,
    includeSampleValues: GremlinSchemaIncludeSampleValuesConfig,
    maxEnumValues: GremlinSchemaMaxEnumValuesConfig,
    includeCounts: GremlinSchemaIncludeCountsConfig,
  }),
  Config.validate({
    message: 'Schema discovery configuration validation failed',
    validation: config =>
      config.enumCardinalityThreshold > 0 &&
      config.maxEnumValues > 0 &&
      config.maxEnumValues <= 100 &&
      config.enumPropertyBlacklist.length > 0,
  })
);

/**
 * ServerConfig: Immutable server name and version from constants.ts
 */
const ServerConfig = Config.succeed({
  name: DEFAULTS.SERVER_NAME,
  version: DEFAULTS.SERVER_VERSION,
} as const);

/**
 * LoggingConfig: Aggregates and validates logging configuration.
 * Always uses structured logging output.
 */
const LoggingConfig = pipe(
  Config.all({
    level: LogLevelConfig,
  }),
  Config.map(config => ({
    level: config.level,
    structured: true as const, // Always use structured logging
  }))
);

/**
 * AppConfig: Complete validated application configuration object.
 * Aggregates gremlin, schema, server, and logging configs.
 * Performs final cross-cutting validation for sanity checks.
 * Throws ConfigError on any validation failure.
 */
export const AppConfig = pipe(
  Config.all({
    gremlin: GremlinConnectionConfig,
    schema: SchemaDiscoveryConfig,
    server: ServerConfig,
    logging: LoggingConfig,
  }),
  Config.validate({
    message: 'Application configuration validation failed',
    validation: config => {
      // All individual validations are already handled by nested configs
      // This is a final sanity check for cross-cutting concerns
      const hasValidGremlin = config.gremlin.host.length > 0 && config.gremlin.port > 0;
      const hasValidSchema = config.schema.maxEnumValues > 0;
      const hasValidLogging = ['error', 'warn', 'info', 'debug'].includes(config.logging.level);

      return hasValidGremlin && hasValidSchema && hasValidLogging;
    },
  })
);

/**
 * Type alias for the resolved, validated application configuration object.
 */
export type AppConfigType = Effect.Effect.Success<typeof AppConfig>;

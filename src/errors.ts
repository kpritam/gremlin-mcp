/**
 * Effect-based error handling architecture for Gremlin MCP Server.
 * Provides typed error handling with Effect's error management system.
 */

import { Data } from 'effect';

/**
 * Standardized error message prefixes for consistency
 */
export const ERROR_PREFIXES = {
  CONNECTION: 'Connection error',
  QUERY: 'Query failed',
  SCHEMA: 'Schema error',
  RESOURCE: 'Resource error',
  IMPORT: 'Import failed',
  EXPORT: 'Export failed',
  CONFIG: 'Configuration error',
  TIMEOUT: 'Operation timed out',
  PARSE: 'Parse error',
  AUTH: 'Authentication error',
} as const;

/**
 * Operation context constants for consistent error messaging
 */
export const OPERATION_CONTEXTS = {
  SCHEMA_GENERATION: 'schema_generation',
  QUERY_EXECUTION: 'query_execution',
  CONNECTION_SETUP: 'connection_setup',
  DATA_IMPORT: 'data_import',
  DATA_EXPORT: 'data_export',
  RESOURCE_ACCESS: 'resource_access',
  TOOL_EXECUTION: 'tool_execution',
} as const;

/**
 * Configuration-related errors
 */
export class ConfigError extends Data.TaggedError('ConfigError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

/**
 * Gremlin connection errors
 */
export class GremlinConnectionError extends Data.TaggedError('GremlinConnectionError')<{
  readonly message: string;
  readonly details?: unknown;
  readonly host?: string;
  readonly port?: number;
}> {}

/**
 * Gremlin query execution errors
 */
export class GremlinQueryError extends Data.TaggedError('GremlinQueryError')<{
  readonly message: string;
  readonly query?: string;
  readonly details?: unknown;
}> {}

/**
 * Schema-related errors
 */
export class SchemaError extends Data.TaggedError('SchemaError')<{
  readonly message: string;
  readonly details?: unknown;
  readonly operation?: string;
}> {}

/**
 * Network timeout errors
 */
export class TimeoutError extends Data.TaggedError('TimeoutError')<{
  readonly message: string;
  readonly timeoutMs?: number;
  readonly operation?: string;
}> {}

/**
 * Resource management errors
 */
export class ResourceError extends Data.TaggedError('ResourceError')<{
  readonly message: string;
  readonly resource?: string;
  readonly details?: unknown;
}> {}

/**
 * Data parsing/validation errors
 */
export class ParseError extends Data.TaggedError('ParseError')<{
  readonly message: string;
  readonly input?: unknown;
  readonly details?: unknown;
}> {}

/**
 * Authentication/authorization errors
 */
export class AuthError extends Data.TaggedError('AuthError')<{
  readonly message: string;
  readonly details?: unknown;
}> {}

/**
 * Union type for all possible Gremlin MCP errors
 */
export type GremlinMcpError =
  | ConfigError
  | GremlinConnectionError
  | GremlinQueryError
  | SchemaError
  | TimeoutError
  | ResourceError
  | ParseError
  | AuthError;

/**
 * Helper functions for creating common errors with standardized messaging
 */
export const Errors = {
  config: (message: string, details?: unknown) =>
    new ConfigError({
      message: `${ERROR_PREFIXES.CONFIG}: ${message}`,
      details,
    }),

  connection: (message: string, details?: unknown, host?: string, port?: number) =>
    new GremlinConnectionError({
      message: `${ERROR_PREFIXES.CONNECTION}: ${message}`,
      details,
      host,
      port,
    }),

  query: (message: string, query?: string, details?: unknown) =>
    new GremlinQueryError({
      message: `${ERROR_PREFIXES.QUERY}: ${message}`,
      query,
      details,
    }),

  schema: (message: string, operation?: string, details?: unknown) =>
    new SchemaError({
      message: `${ERROR_PREFIXES.SCHEMA}: ${message}`,
      operation,
      details,
    }),

  timeout: (message: string, timeoutMs?: number, operation?: string) =>
    new TimeoutError({
      message: `${ERROR_PREFIXES.TIMEOUT}: ${message}`,
      timeoutMs,
      operation,
    }),

  resource: (message: string, resource?: string, details?: unknown) =>
    new ResourceError({
      message: `${ERROR_PREFIXES.RESOURCE}: ${message}`,
      resource,
      details,
    }),

  parse: (message: string, input?: unknown, details?: unknown) =>
    new ParseError({
      message: `${ERROR_PREFIXES.PARSE}: ${message}`,
      input,
      details,
    }),

  auth: (message: string, details?: unknown) =>
    new AuthError({
      message: `${ERROR_PREFIXES.AUTH}: ${message}`,
      details,
    }),
} as const;

/**
 * Helper function to convert Error objects to GremlinMcpError with consistent formatting
 */
export const fromError = (error: Error | unknown, context?: string): GremlinMcpError => {
  if (error instanceof Error) {
    const message = context ? `${context}: ${error.message}` : error.message;
    return new ResourceError({
      message: `${ERROR_PREFIXES.RESOURCE}: ${message}`,
      details: {
        stack: error.stack,
        name: error.name,
        cause: error.cause,
      },
    });
  }

  const message = context ? `${context}: ${String(error)}` : String(error);
  return new ResourceError({
    message: `${ERROR_PREFIXES.RESOURCE}: ${message}`,
    details: { originalError: error },
  });
};

/**
 * Create contextual error with standardized operation context
 */
export const createContextualError = (
  errorType: keyof typeof ERROR_PREFIXES,
  operation: string,
  error: unknown
): GremlinMcpError => {
  const context = `${operation} operation`;

  if (error instanceof Error) {
    const message = `${ERROR_PREFIXES[errorType]}: ${context} - ${error.message}`;
    return new ResourceError({
      message,
      resource: operation,
      details: {
        stack: error.stack,
        name: error.name,
        originalError: error,
      },
    });
  }

  const message = `${ERROR_PREFIXES[errorType]}: ${context} - ${String(error)}`;
  return new ResourceError({
    message,
    resource: operation,
    details: { originalError: error },
  });
};

/**
 * Create standardized error with operation context
 */
export const withOperationContext = <T extends GremlinMcpError>(
  errorFactory: () => T,
  operation: string
): T => {
  const error = errorFactory();
  return {
    ...error,
    message: `${error.message} (operation: ${operation})`,
  } as T;
};

/**
 * Type guard to check if an error is a GremlinMcpError
 */
export const isGremlinMcpError = (error: unknown): error is GremlinMcpError => {
  return (
    error instanceof ConfigError ||
    error instanceof GremlinConnectionError ||
    error instanceof GremlinQueryError ||
    error instanceof SchemaError ||
    error instanceof TimeoutError ||
    error instanceof ResourceError ||
    error instanceof ParseError ||
    error instanceof AuthError
  );
};

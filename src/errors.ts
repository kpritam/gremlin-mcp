/**
 * Effect-based error handling architecture for Gremlin MCP Server.
 * Provides typed error handling with Effect's error management system.
 */

import { Data } from 'effect';

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
 * Helper functions for creating common errors
 */
export const Errors = {
  config: (message: string, details?: unknown) => new ConfigError({ message, details }),

  connection: (message: string, details?: unknown, host?: string, port?: number) =>
    new GremlinConnectionError({ message, details, host, port }),

  query: (message: string, query?: string, details?: unknown) =>
    new GremlinQueryError({ message, query, details }),

  schema: (message: string, operation?: string, details?: unknown) =>
    new SchemaError({ message, operation, details }),

  timeout: (message: string, timeoutMs?: number, operation?: string) =>
    new TimeoutError({ message, timeoutMs, operation }),

  resource: (message: string, resource?: string, details?: unknown) =>
    new ResourceError({ message, resource, details }),

  parse: (message: string, input?: unknown, details?: unknown) =>
    new ParseError({ message, input, details }),

  auth: (message: string, details?: unknown) => new AuthError({ message, details }),
} as const;

/**
 * Helper function to convert Error objects to GremlinMcpError
 */
export const fromError = (error: Error | unknown, context?: string): GremlinMcpError => {
  if (error instanceof Error) {
    const message = context ? `${context}: ${error.message}` : error.message;
    return new ResourceError({ message, details: error.stack });
  }

  const message = context ? `${context}: ${String(error)}` : String(error);
  return new ResourceError({ message, details: error });
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

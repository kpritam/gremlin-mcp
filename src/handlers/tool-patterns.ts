/**
 * @fileoverview Reusable patterns for MCP tool handler implementation.
 *
 * Provides standardized Effect-based patterns for creating MCP tool handlers
 * with consistent error handling, response formatting, and runtime execution.
 * Eliminates boilerplate and ensures uniform behavior across all tools.
 */

import { Effect, pipe, Runtime } from 'effect';
import { z } from 'zod';
import { GremlinService } from '../gremlin/service.js';

/**
 * Standard MCP tool response structure following the protocol specification.
 */
export interface McpToolResponse {
  [x: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Creates standardized success response with JSON formatting.
 *
 * @param data - Data to include in response
 * @returns MCP tool response with formatted content
 */
export const createSuccessResponse = (data: unknown): McpToolResponse => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

/**
 * Creates a success response for simple string values (no JSON encoding)
 */
export const createStringResponse = (text: string): McpToolResponse => ({
  content: [{ type: 'text', text }],
});

/**
 * Creates a standardized error response
 */
export const createErrorResponse = (message: string): McpToolResponse => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/**
 * Simple tool handler that executes an Effect and returns proper MCP response
 */
export const createToolEffect = <A>(
  runtime: Runtime.Runtime<GremlinService>,
  effect: Effect.Effect<A, unknown, GremlinService>,
  operationName: string
): Promise<McpToolResponse> =>
  pipe(
    effect,
    Effect.map(createSuccessResponse),
    Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`))),
    Runtime.runPromise(runtime)
  );

/**
 * Simple string response tool handler
 */
export const createStringToolEffect = <A>(
  runtime: Runtime.Runtime<GremlinService>,
  effect: Effect.Effect<A, unknown, GremlinService>,
  operationName: string
): Promise<McpToolResponse> =>
  pipe(
    effect,
    Effect.map(result => createStringResponse(String(result))),
    Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`))),
    Runtime.runPromise(runtime)
  );

/**
 * Query result handler with structured error responses
 */
export const createQueryEffect = (
  runtime: Runtime.Runtime<GremlinService>,
  query: string
): Promise<McpToolResponse> =>
  pipe(
    GremlinService,
    Effect.andThen(service => service.executeQuery(query)),
    Effect.map(createSuccessResponse),
    Effect.catchAll(error => {
      // For query errors, return structured JSON with empty results and error message
      const errorResponse = {
        results: [],
        message: `Query failed: ${error}`,
      };
      return Effect.succeed(createSuccessResponse(errorResponse));
    }),
    Runtime.runPromise(runtime)
  );

/**
 * Validated input tool handler
 */
export const createValidatedToolEffect =
  <T, A>(
    runtime: Runtime.Runtime<GremlinService>,
    schema: z.ZodSchema<T>,
    handler: (input: T) => Effect.Effect<A, unknown, GremlinService>,
    operationName: string
  ) =>
  (args: unknown): Promise<McpToolResponse> =>
    pipe(
      Effect.try(() => schema.parse(args)),
      Effect.andThen(handler),
      Effect.map(createSuccessResponse),
      Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`))),
      Runtime.runPromise(runtime)
    );

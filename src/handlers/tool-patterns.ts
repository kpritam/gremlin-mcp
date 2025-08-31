/**
 * @fileoverview Reusable patterns for MCP tool handler implementation.
 *
 * Provides standardized Effect-based patterns for creating MCP tool handlers
 * with consistent error handling, response formatting, and runtime execution.
 * Eliminates boilerplate and ensures uniform behavior across all tools.
 */

import { Effect, pipe } from 'effect';
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
export const createToolEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operationName: string
): Effect.Effect<McpToolResponse, never, R> =>
  pipe(
    effect,
    Effect.map(createSuccessResponse),
    Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`)))
  );

/**
 * Simple string response tool handler
 */
export const createStringToolEffect = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operationName: string
): Effect.Effect<McpToolResponse, never, R> =>
  pipe(
    effect,
    Effect.map(result => createStringResponse(String(result))),
    Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`)))
  );

/**
 * Query result handler with structured error responses
 */
export const createQueryEffect = (
  query: string
): Effect.Effect<McpToolResponse, never, GremlinService> =>
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
    })
  );

/**
 * Validated input tool handler
 */
export const createValidatedToolEffect =
  <T, A, E, R>(
    schema: z.ZodSchema<T>,
    handler: (input: T) => Effect.Effect<A, E, R>,
    operationName: string
  ) =>
  (args: unknown): Effect.Effect<McpToolResponse, never, R> =>
    pipe(
      Effect.try(() => schema.parse(args)),
      Effect.andThen(handler),
      Effect.map(createSuccessResponse),
      Effect.catchAll(error => Effect.succeed(createErrorResponse(`${operationName}: ${error}`)))
    );

/**
 * Common patterns and utilities for MCP tool handlers.
 * Reduces code duplication and provides consistent error handling.
 */

import { Effect, pipe } from 'effect';
import { z } from 'zod';
import { type EffectMcpBridge } from './effect-runtime-bridge.js';
import { GremlinService } from '../gremlin/service.js';

/**
 * Standard MCP tool response structure
 */
export interface McpToolResponse {
  [x: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Handler function type for tool operations
 */
export type ToolHandler<T, R> = (
  service: typeof GremlinService.Service,
  input: T
) => Effect.Effect<R, unknown>;

/**
 * Creates a standardized success response
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
 * Formats error response with standardized messaging
 */
export const formatErrorResponse = (error: unknown, operation: string): McpToolResponse => {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResponse(`${operation}: ${message}`);
};

/**
 * Formats operation result error with consistent messaging
 */
export const formatOperationError = (
  result: { left: { message: string } },
  operation: string
): McpToolResponse => {
  return createErrorResponse(`${operation}: ${result.left.message}`);
};

/**
 * Generic tool handler factory that handles common patterns
 */
export const createToolHandler = <TInput, TOutput>(
  inputSchema: z.ZodSchema<TInput>,
  handler: ToolHandler<TInput, TOutput>,
  operationName: string
) => {
  return async (
    bridge: EffectMcpBridge<GremlinService>,
    args: unknown
  ): Promise<McpToolResponse> => {
    try {
      // Validate input
      const validatedInput = inputSchema.parse(args);

      // Execute handler with Effect
      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(service => handler(service, validatedInput)),
          Effect.either
        )
      );

      // Handle result
      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return formatOperationError(errorResult, operationName);
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, operationName);
    }
  };
};

/**
 * Common handler execution logic to reduce code duplication
 */
const executeHandler = async <TInput, TOutput>(
  bridge: EffectMcpBridge<GremlinService>,
  handler: ToolHandler<TInput, TOutput>,
  input: TInput,
  operationName: string,
  useStringResponse = false
): Promise<McpToolResponse> => {
  const result = await bridge.runEffect(
    pipe(
      GremlinService,
      Effect.flatMap(service => handler(service, input)),
      Effect.either
    )
  );

  if (result._tag === 'Left') {
    const errorResult = result as { left: { message: string } };
    return createErrorResponse(`${operationName}: ${errorResult.left.message}`);
  }

  // Use string response for simple string results to avoid double JSON encoding
  if (useStringResponse && typeof result.right === 'string') {
    return createStringResponse(result.right);
  }

  return createSuccessResponse(result.right);
};

/**
 * Simple tool handler for operations that don't need input validation
 */
export const createSimpleToolHandler = <TOutput>(
  handler: (service: typeof GremlinService.Service) => Effect.Effect<TOutput, unknown>,
  errorMessage: string,
  useStringResponse = false
) => {
  return async (bridge: EffectMcpBridge<GremlinService>): Promise<McpToolResponse> => {
    try {
      return await executeHandler(
        bridge,
        service => handler(service),
        null as never,
        errorMessage,
        useStringResponse
      );
    } catch (error) {
      return formatErrorResponse(error, errorMessage);
    }
  };
};

/**
 * Schema tool handler with JSON response formatting
 */
export const createSchemaToolHandler = (
  handler: (service: typeof GremlinService.Service) => Effect.Effect<unknown, unknown>,
  errorMessage: string
) => createSimpleToolHandler(handler, errorMessage);

/**
 * Query result handler for Gremlin queries
 */
export const createQueryResultHandler = (
  handler: (
    service: typeof GremlinService.Service,
    query: string
  ) => Effect.Effect<unknown, unknown>
) => {
  return async (
    bridge: EffectMcpBridge<GremlinService>,
    args: unknown
  ): Promise<McpToolResponse> => {
    try {
      const { query } = z.object({ query: z.string() }).parse(args);

      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(service => handler(service, query)),
          Effect.either
        )
      );

      if (result._tag === 'Left') {
        // For query errors, return structured JSON with empty results and error message
        const errorResult = result as { left: { message: string } };
        const errorResponse = {
          results: [],
          message: `Query failed: ${errorResult.left.message}`,
        };
        return createSuccessResponse(errorResponse);
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      // For parsing errors, return structured JSON response
      const errorResponse = {
        results: [],
        message: `Query failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      return createSuccessResponse(errorResponse);
    }
  };
};

/**
 * Data operation tool handler
 */
export const createDataOperationHandler = <TInput>(
  inputSchema: z.ZodSchema<TInput>,
  handler: ToolHandler<TInput, string>,
  operationName: string
) => {
  return async (
    bridge: EffectMcpBridge<GremlinService>,
    args: unknown
  ): Promise<McpToolResponse> => {
    try {
      const validatedInput = inputSchema.parse(args);
      return await executeHandler(bridge, handler, validatedInput, operationName);
    } catch (error) {
      return formatErrorResponse(error, operationName);
    }
  };
};

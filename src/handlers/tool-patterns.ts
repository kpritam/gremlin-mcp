/**
 * Common patterns and utilities for MCP tool handlers.
 * Reduces code duplication and provides consistent error handling.
 */

import { Effect, pipe } from 'effect';
import { z } from 'zod';
import { type EffectMcpBridge } from './effect-runtime-bridge.js';
import { GremlinService } from '../gremlin/service.js';
import type { GremlinService as GremlinServiceType } from '../gremlin/service.js';
import { createContextualError, OPERATION_CONTEXTS } from '../errors.js';

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
  service: GremlinServiceType,
  input: T
) => Effect.Effect<R, unknown>;

/**
 * Creates a standardized success response
 */
export const createSuccessResponse = (data: unknown): McpToolResponse => ({
  content: [
    { type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) },
  ],
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
  const mcpError = createContextualError('RESOURCE', operation, error);
  return createErrorResponse(mcpError.message);
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
 * Enhanced with comprehensive error handling and logging
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

      // Execute handler with enhanced error handling
      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(service => handler(service, validatedInput)),
          Effect.tapError((error: any) =>
            Effect.logError(`Tool execution failed: ${operationName}`, {
              error: error?.message || String(error),
              inputArgs: JSON.stringify(args).substring(0, 200),
            })
          ),
          Effect.either
        )
      );

      // Handle result with improved error information
      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return createErrorResponse(errorResult.left.message);
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, operationName);
    }
  };
};

/**
 * Simple tool handler for operations that don't need input validation
 * Enhanced with comprehensive error handling patterns
 */
export const createSimpleToolHandler = <TOutput>(
  handler: (service: GremlinServiceType) => Effect.Effect<TOutput, unknown>,
  errorMessage: string
) => {
  return async (bridge: EffectMcpBridge<GremlinService>): Promise<McpToolResponse> => {
    try {
      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(handler),
          Effect.tapError((error: any) =>
            Effect.logError(`Simple tool execution failed: ${errorMessage}`, {
              error: error?.message || String(error),
              handlerType: 'simple',
            })
          ),
          Effect.either
        )
      );

      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return createErrorResponse(`${errorMessage}: ${errorResult.left.message}`);
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, OPERATION_CONTEXTS.TOOL_EXECUTION);
    }
  };
};

/**
 * Query tool handler with standardized query validation and error handling
 * Enhanced with query-specific error recovery patterns
 */
export const createQueryToolHandler = (
  handler: (service: GremlinServiceType, query: string) => Effect.Effect<unknown, unknown>
) => {
  const querySchema = z.object({ query: z.string() });

  return createToolHandler(
    querySchema,
    (service, input) =>
      pipe(
        handler(service, input.query),
        Effect.catchTags({
          GremlinQueryError: (error: any) =>
            Effect.logWarning(`Query execution failed: ${error.message}`, {
              query: input.query,
              error: error.message,
            }).pipe(Effect.flatMap(() => Effect.fail(error))),
        })
      ),
    'Query execution'
  );
};

/**
 * Data operation tool handler with custom error formatting
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

      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(service => handler(service, validatedInput)),
          Effect.either
        )
      );

      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return createErrorResponse(`${operationName} failed: ${errorResult.left.message}`);
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, operationName);
    }
  };
};

/**
 * Schema tool handler with JSON response formatting
 */
export const createSchemaToolHandler = (
  handler: (service: GremlinServiceType) => Effect.Effect<unknown, unknown>,
  errorMessage: string
) => {
  return async (bridge: EffectMcpBridge<GremlinService>): Promise<McpToolResponse> => {
    try {
      const result = await bridge.runEffect(
        pipe(GremlinService, Effect.flatMap(handler), Effect.either)
      );

      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { error: `${errorMessage}: ${errorResult.left.message}` },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, OPERATION_CONTEXTS.TOOL_EXECUTION);
    }
  };
};

/**
 * Query result handler with special error formatting
 */
export const createQueryResultHandler = (
  handler: (service: GremlinServiceType, query: string) => Effect.Effect<unknown, unknown>
) => {
  return async (
    bridge: EffectMcpBridge<GremlinService>,
    args: unknown
  ): Promise<McpToolResponse> => {
    try {
      const validatedInput = z.object({ query: z.string() }).parse(args);
      const { query } = validatedInput;

      const result = await bridge.runEffect(
        pipe(
          GremlinService,
          Effect.flatMap(service => handler(service, query)),
          Effect.either
        )
      );

      if (result._tag === 'Left') {
        const errorResult = result as { left: { message: string } };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: `Query failed: ${errorResult.left.message}`,
                  results: [],
                  metadata: { error: true, query },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return createSuccessResponse(result.right);
    } catch (error) {
      return formatErrorResponse(error, OPERATION_CONTEXTS.QUERY_EXECUTION);
    }
  };
};

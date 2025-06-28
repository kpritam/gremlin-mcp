/**
 * Utility functions for MCP tool registration and handling.
 * Eliminates code duplication and provides consistent error handling.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GremlinClient } from '../gremlin/client.js';
import { logger } from '../logger.js';
import { z } from 'zod';

/**
 * Configuration for creating a tool handler.
 */
export interface ToolConfig {
  name: string;
  title: string;
  description: string;
  inputSchema?: Record<string, z.ZodType> | Record<string, never>;
}

/**
 * Handler function type for tools.
 */
export type ToolHandler<T = Record<string, unknown>> = (
  args: T,
  client: GremlinClient
) => Promise<unknown>;

/**
 * Standard response format for tool results.
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

/**
 * Creates a standardized text response for tools.
 */
export function createTextResponse(data: unknown): ToolResponse {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Wraps a tool handler with consistent error handling and logging.
 */
export function withErrorHandling<T>(
  toolName: string,
  handler: ToolHandler<T>
): (args: T, client: GremlinClient) => Promise<ToolResponse> {
  return async (args: T, client: GremlinClient): Promise<ToolResponse> => {
    try {
      logger.debug(`Executing tool: ${toolName}`, { args });
      const result = await handler(args, client);
      logger.debug(`Tool ${toolName} completed successfully`);
      return createTextResponse(result);
    } catch (error) {
      logger.error(`Tool ${toolName} failed`, { error, args });

      // Return error information in a structured format
      const errorResponse = {
        success: false,
        message: `Tool ${toolName} failed`,
        error: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined,
      };

      return createTextResponse(errorResponse);
    }
  };
}

/**
 * Creates and registers a tool with standardized configuration.
 */
export function createTool<T extends Record<string, unknown>>(
  server: McpServer,
  getGraphClient: () => Promise<GremlinClient>,
  config: ToolConfig,
  handler: ToolHandler<T>
): void {
  const wrappedHandler = withErrorHandling(config.name, handler);

  server.registerTool(
    config.name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema || {},
    },
    async (args: unknown) => {
      const graphClient = await getGraphClient();
      return wrappedHandler(args as T, graphClient);
    }
  );

  logger.info(`Registered tool: ${config.name}`);
}

/**
 * Validates input against a schema and returns parsed result.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, toolName: string): T {
  try {
    return schema.parse(input);
  } catch (error) {
    logger.error(`Input validation failed for tool ${toolName}`, { error, input });
    throw new Error(
      `Invalid input for tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Common error types for tools.
 */
export class ToolError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

/**
 * Helper for creating simple tools that don't require input validation.
 */
export function createSimpleTool(
  server: McpServer,
  getGraphClient: () => Promise<GremlinClient>,
  name: string,
  title: string,
  description: string,
  handler: (client: GremlinClient) => Promise<unknown>
): void {
  createTool<Record<string, unknown>>(
    server,
    getGraphClient,
    { name, title, description },
    async (_, client) => handler(client)
  );
}

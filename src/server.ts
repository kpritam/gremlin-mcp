#!/usr/bin/env node

/**
 * Gremlin MCP Server implementation using TypeScript.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from './logger.js';
import { GremlinClient } from './gremlin/client.js';
import { config } from './config.js';
import { registerAllHandlers } from './handlers/index.js';

/**
 * Main function to run the MCP server.
 */
async function main(): Promise<void> {
  // Initialize the server
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  // Gremlin client factory function
  let gremlinClient: GremlinClient | undefined;
  async function getGremlinClient(): Promise<GremlinClient> {
    if (!gremlinClient) {
      gremlinClient = new GremlinClient({
        host: config.gremlinHost,
        port: config.gremlinPort,
        traversalSource: config.gremlinTraversalSource,
        useSSL: config.gremlinUseSSL,
        username: config.gremlinUsername,
        password: config.gremlinPassword,
        idleTimeoutSeconds: config.gremlinIdleTimeout,
        enumDiscoveryEnabled: config.gremlinEnumDiscoveryEnabled,
        enumCardinalityThreshold: config.gremlinEnumCardinalityThreshold,
        enumPropertyBlacklist: config.gremlinEnumPropertyBlacklist,
        includeSampleValues: config.gremlinSchemaIncludeSampleValues,
        maxEnumValues: config.gremlinSchemaMaxEnumValues,
        includeCounts: config.gremlinSchemaIncludeCounts,
      });
      await gremlinClient.initialize();
      logger.info('Gremlin client initialized successfully');
    }
    return gremlinClient;
  }

  // Register all handlers
  registerAllHandlers(server, getGremlinClient);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down...`);
    if (gremlinClient) {
      await gremlinClient.close();
    }
    process.exit(0);
  };

  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    await shutdown('SIGINT');
  });

  process.on('SIGTERM', async () => {
    await shutdown('SIGTERM');
  });

  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Gremlin MCP Server started successfully');
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Unhandled error in main', { error });
    process.exit(1);
  });
}

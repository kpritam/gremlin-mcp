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
  logger.info('🚀 Starting Gremlin MCP Server...', {
    service: 'gremlin-mcp',
    version: config.serverVersion,
    gremlinEndpoint: `${config.gremlinHost}:${config.gremlinPort}`,
    logLevel: config.logLevel,
  });

  // Initialize the server
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  logger.info('✅ MCP Server instance created', { service: 'gremlin-mcp' });

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
    logger.info('🔌 Creating STDIO transport...', { service: 'gremlin-mcp' });
    const transport = new StdioServerTransport();

    logger.info('🔗 Connecting server to transport...', { service: 'gremlin-mcp' });
    await server.connect(transport);

    logger.info('✅ Gremlin MCP Server started successfully', {
      service: 'gremlin-mcp',
      pid: process.pid,
      ready: true,
    });
  } catch (error) {
    logger.error('❌ Failed to start server', {
      service: 'gremlin-mcp',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Add startup logging before anything else
console.info('🎬 Gremlin MCP Server executable started');
console.info('📋 Process info:', {
  pid: process.pid,
  nodeVersion: process.versions.node,
  platform: process.platform,
  argv: process.argv,
  cwd: process.cwd(),
});

main().catch(error => {
  logger.error('❌ Unhandled error in main', {
    service: 'gremlin-mcp',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

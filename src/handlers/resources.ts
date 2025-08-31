/**
 * @fileoverview MCP resource handlers for graph database information.
 *
 * Provides MCP resources that expose real-time graph database status and schema
 * information. Resources are automatically updated and can be subscribed to by
 * MCP clients for live monitoring.
 */

import { Effect, pipe, Runtime } from 'effect';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_URIS, MIME_TYPES } from '../constants.js';
import { ERROR_PREFIXES } from '../errors.js';
import { GremlinService } from '../gremlin/service.js';

/**
 * Registers MCP resource handlers with the server.
 *
 * @param server - MCP server instance
 * @param runtime - Effect runtime with Gremlin service
 *
 * Registers resources for:
 * - Graph connection status monitoring
 * - Live schema information access
 */
export function registerEffectResourceHandlers(
  server: McpServer,
  runtime: Runtime.Runtime<GremlinService>
): void {
  // Register status resource
  server.resource(
    'Gremlin Graph Status',
    RESOURCE_URIS.STATUS,
    {
      description: 'Real-time connection status of the Gremlin graph database',
      mimeType: MIME_TYPES.TEXT_PLAIN,
    },
    async () => {
      const result = await pipe(
        GremlinService,
        Effect.andThen(service => service.getStatus),
        Effect.map(statusObj => statusObj.status),
        Effect.catchAll(error => Effect.succeed(`${ERROR_PREFIXES.CONNECTION}: ${error}`)),
        Runtime.runPromise(runtime)
      );

      return {
        contents: [
          {
            uri: RESOURCE_URIS.STATUS,
            mimeType: MIME_TYPES.TEXT_PLAIN,
            text: result,
          },
        ],
      };
    }
  );

  // Register schema resource
  server.resource(
    'Gremlin Graph Schema',
    RESOURCE_URIS.SCHEMA,
    {
      description:
        'Complete schema of the graph including vertex labels, edge labels, and relationship patterns',
      mimeType: MIME_TYPES.APPLICATION_JSON,
    },
    async () => {
      const result = await pipe(
        GremlinService,
        Effect.andThen(service => service.getSchema),
        Effect.catchAll(error => Effect.succeed({ error: String(error) })),
        Runtime.runPromise(runtime)
      );

      return {
        contents: [
          {
            uri: RESOURCE_URIS.SCHEMA,
            mimeType: MIME_TYPES.APPLICATION_JSON,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}

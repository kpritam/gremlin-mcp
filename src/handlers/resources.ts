/**
 * Effect-based MCP Resource handlers for Gremlin server.
 * Uses proper dependency injection instead of global runtime container.
 */

import { Effect, pipe } from 'effect';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_URIS, MIME_TYPES } from '../constants.js';
import { GremlinService } from '../gremlin/service.js';
import { ERROR_PREFIXES } from '../errors.js';
import { type EffectMcpBridge } from './effect-runtime-bridge.js';

/**
 * Register Effect-based resource handlers with the MCP server.
 * Uses dependency-injected runtime instead of global container.
 */
export function registerEffectResourceHandlers(
  server: McpServer,
  bridge: EffectMcpBridge<GremlinService>
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
      try {
        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.getStatus),
            Effect.map(statusObj => statusObj.status),
            Effect.catchAll(error =>
              Effect.succeed(`${ERROR_PREFIXES.CONNECTION}: ${error.message}`)
            )
          )
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: RESOURCE_URIS.STATUS,
              mimeType: MIME_TYPES.TEXT_PLAIN,
              text: `${ERROR_PREFIXES.CONNECTION}: ${message}`,
            },
          ],
        };
      }
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
      try {
        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.getSchema),
            Effect.catchAll(error => Effect.succeed({ error: error.message }))
          )
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: RESOURCE_URIS.SCHEMA,
              mimeType: MIME_TYPES.APPLICATION_JSON,
              text: JSON.stringify({ error: `${ERROR_PREFIXES.SCHEMA}: ${message}` }, null, 2),
            },
          ],
        };
      }
    }
  );
}

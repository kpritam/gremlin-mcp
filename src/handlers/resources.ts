/**
 * MCP Resource handlers for Gremlin server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RESOURCE_URIS, MIME_TYPES } from '../constants.js';
import { logger } from '../logger.js';
import type { GremlinClient } from '../gremlin/client.js';

/**
 * Register resource handlers with the MCP server.
 *
 * @param server - The MCP server instance
 * @param getGraphClient - Function to get the Gremlin client instance
 */
export function registerResourceHandlers(
  server: McpServer,
  getGraphClient: () => Promise<GremlinClient>
): void {
  // Register graph status resource
  server.registerResource(
    'graph-status',
    RESOURCE_URIS.STATUS,
    {
      title: 'Graph Status',
      description: 'Get the status of the currently configured Gremlin graph',
      mimeType: MIME_TYPES.TEXT_PLAIN,
    },
    async (uri: URL) => {
      try {
        const graphClient = await getGraphClient();
        const status = await graphClient.getStatus();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: MIME_TYPES.TEXT_PLAIN,
              text: status,
            },
          ],
        };
      } catch (error) {
        logger.error('Error reading graph status resource', { uri: uri.href, error });
        throw error;
      }
    }
  );

  // Register graph schema resource
  server.registerResource(
    'graph-schema',
    RESOURCE_URIS.SCHEMA,
    {
      title: 'Graph Schema',
      description:
        'Get the schema for the graph including the vertex and edge labels as well as the (vertex)-[edge]->(vertex) combinations',
      mimeType: MIME_TYPES.APPLICATION_JSON,
    },
    async (uri: URL) => {
      try {
        const graphClient = await getGraphClient();
        const schema = await graphClient.getSchema();
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: MIME_TYPES.APPLICATION_JSON,
              text: JSON.stringify(schema, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Error reading graph schema resource', { uri: uri.href, error });
        throw error;
      }
    }
  );
}

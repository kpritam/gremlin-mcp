/**
 * Combined handler registration for MCP server.
 * Simplifies server setup by providing a single registration function.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GremlinClient } from '../gremlin/client.js';
import { registerResourceHandlers } from './resources.js';
import { registerToolHandlers } from './tools.js';

/**
 * Register all MCP handlers (resources and tools) with the server.
 *
 * @param server - The MCP server instance
 * @param getGraphClient - Function to get the Gremlin client instance
 */
export function registerAllHandlers(
  server: McpServer,
  getGraphClient: () => Promise<GremlinClient>
): void {
  registerResourceHandlers(server, getGraphClient);
  registerToolHandlers(server, getGraphClient);
}

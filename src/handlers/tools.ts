/**
 * MCP Tool handlers for Gremlin server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_NAMES } from '../constants.js';
import type { GremlinClient } from '../gremlin/client.js';
import { type ImportDataInput, type ExportSubgraphInput } from '../gremlin/models.js';
import { z } from 'zod';
import { createSimpleTool, createTool } from '../utils/tool-helpers.js';
import { importGraphData, exportSubgraph } from '../utils/data-operations.js';

/**
 * Register tool handlers with the MCP server.
 *
 * @param server - The MCP server instance
 * @param getGraphClient - Function to get the Gremlin client instance
 */
export function registerToolHandlers(
  server: McpServer,
  getGraphClient: () => Promise<GremlinClient>
): void {
  // Register simple tools using the helper
  createSimpleTool(
    server,
    getGraphClient,
    TOOL_NAMES.GET_GRAPH_STATUS,
    'Get Graph Status',
    'Get the connection status of the Gremlin graph database',
    client => client.getStatus()
  );

  createSimpleTool(
    server,
    getGraphClient,
    TOOL_NAMES.GET_GRAPH_SCHEMA,
    'Get Graph Schema',
    'Get the complete schema of the graph including vertex labels, edge labels, and relationship patterns',
    client => client.getSchema()
  );

  createSimpleTool(
    server,
    getGraphClient,
    TOOL_NAMES.REFRESH_SCHEMA_CACHE,
    'Refresh Schema Cache',
    'Force an immediate refresh of the graph schema cache',
    async client => {
      await client.refreshSchemaCache();
      return 'Schema cache refreshed successfully.';
    }
  );

  // Register run Gremlin query tool
  createTool<{ query: string }>(
    server,
    getGraphClient,
    {
      name: TOOL_NAMES.RUN_GREMLIN_QUERY,
      title: 'Run Gremlin Query',
      description:
        'Execute a Gremlin traversal query against the graph database. Supports all Gremlin query syntax including g.V(), g.E(), valueMap(), path(), etc.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            'The Gremlin query to execute (e.g., "g.V().hasLabel(\'person\').limit(10).valueMap()")'
          ),
      },
    },
    async ({ query }, client) => client.executeGremlinQuery(query)
  );

  // Register import graph data tool
  createTool<ImportDataInput>(
    server,
    getGraphClient,
    {
      name: TOOL_NAMES.IMPORT_GRAPH_DATA,
      title: 'Import Graph Data',
      description: 'Import graph data from various formats including GraphSON and CSV',
      inputSchema: {
        format: z.enum(['graphson', 'csv']).describe('The format of the data to import'),
        data: z.string().min(1).describe('The data content to import'),
        options: z
          .object({
            clear_graph: z
              .boolean()
              .optional()
              .describe('Whether to clear the graph before importing'),
            batch_size: z.number().optional().describe('Number of operations per batch'),
            validate_schema: z
              .boolean()
              .optional()
              .describe('Whether to validate against existing schema'),
          })
          .optional(),
      },
    },
    async (input, client) => importGraphData(client, input)
  );

  // Register export subgraph tool
  createTool<ExportSubgraphInput>(
    server,
    getGraphClient,
    {
      name: TOOL_NAMES.EXPORT_SUBGRAPH,
      title: 'Export Subgraph',
      description: 'Export a subgraph based on a traversal query to various formats',
      inputSchema: {
        traversal_query: z
          .string()
          .min(1)
          .describe('Gremlin traversal query to define the subgraph'),
        format: z
          .enum(['graphson', 'json', 'csv'])
          .describe('The output format for the exported data'),
        include_properties: z
          .array(z.string())
          .optional()
          .describe('Properties to include in the export'),
        exclude_properties: z
          .array(z.string())
          .optional()
          .describe('Properties to exclude from the export'),
        max_depth: z.number().optional().describe('Maximum traversal depth for the subgraph'),
      },
    },
    async (input, client) => exportSubgraph(client, input)
  );
}

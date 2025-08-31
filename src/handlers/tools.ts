/**
 * Effect-based MCP Tool handlers for Gremlin server.
 * Uses proper dependency injection instead of global runtime container.
 */

import { Effect } from 'effect';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOL_NAMES } from '../constants.js';
import { GremlinService } from '../gremlin/service.js';
import { type EffectMcpBridge } from './effect-runtime-bridge.js';
import { importGraphData, exportSubgraph } from '../utils/data-operations.js';
import {
  createSimpleToolHandler,
  createSchemaToolHandler,
  createQueryResultHandler,
  createDataOperationHandler,
} from './tool-patterns.js';

/**
 * Input validation schemas
 */
const importInputSchema = z.object({
  format: z.enum(['graphson', 'csv']),
  data: z.string(),
  options: z
    .object({
      batch_size: z.number().optional(),
      clear_graph: z.boolean().optional(),
      validate_schema: z.boolean().optional(),
    })
    .optional(),
});

const exportInputSchema = z.object({
  traversal_query: z.string(),
  format: z.enum(['graphson', 'json', 'csv']),
  max_depth: z.number().optional(),
  include_properties: z.array(z.string()).optional(),
  exclude_properties: z.array(z.string()).optional(),
});

/**
 * Register Effect-based tool handlers with the MCP server.
 * Uses dependency-injected runtime instead of global container.
 */
export function registerEffectToolHandlers(
  server: McpServer,
  bridge: EffectMcpBridge<GremlinService>
): void {
  // Get Graph Status
  server.registerTool(
    TOOL_NAMES.GET_GRAPH_STATUS,
    {
      title: 'Get Graph Status',
      description: 'Get the connection status of the Gremlin graph database',
      inputSchema: {},
    },
    createSimpleToolHandler(
      service => Effect.map(service.getStatus, statusObj => statusObj.status),
      'Connection status check failed',
      true
    ).bind(null, bridge)
  );

  // Get Graph Schema
  server.registerTool(
    TOOL_NAMES.GET_GRAPH_SCHEMA,
    {
      title: 'Get Graph Schema',
      description:
        'Get the complete schema of the graph including vertex labels, edge labels, and relationship patterns',
      inputSchema: {},
    },
    createSchemaToolHandler(service => service.getSchema, 'Schema retrieval failed').bind(
      null,
      bridge
    )
  );

  // Refresh Schema Cache
  server.registerTool(
    TOOL_NAMES.REFRESH_SCHEMA_CACHE,
    {
      title: 'Refresh Schema Cache',
      description: 'Force an immediate refresh of the graph schema cache',
      inputSchema: {},
    },
    createSimpleToolHandler(
      service =>
        Effect.map(service.refreshSchemaCache, () => 'Schema cache refreshed successfully.'),
      'Failed to refresh schema',
      true
    ).bind(null, bridge)
  );

  // Run Gremlin Query
  server.registerTool(
    TOOL_NAMES.RUN_GREMLIN_QUERY,
    {
      title: 'Run Gremlin Query',
      description: 'Execute a Gremlin traversal query against the graph database',
      inputSchema: {
        query: z.string().describe('The Gremlin query to execute'),
      },
    },
    createQueryResultHandler((service, query) => service.executeQuery(query)).bind(null, bridge)
  );

  // Import Graph Data
  server.registerTool(
    TOOL_NAMES.IMPORT_GRAPH_DATA,
    {
      title: 'Import Graph Data',
      description: 'Import graph data from various formats including GraphSON and CSV',
      inputSchema: {
        format: z.enum(['graphson', 'csv']).describe('The format of the data to import'),
        data: z.string().describe('The data content to import'),
        options: z
          .object({
            batch_size: z.number().optional().describe('Number of operations per batch'),
            clear_graph: z
              .boolean()
              .optional()
              .describe('Whether to clear the graph before importing'),
            validate_schema: z
              .boolean()
              .optional()
              .describe('Whether to validate against existing schema'),
          })
          .optional()
          .describe('Import options'),
      },
    },
    createDataOperationHandler(
      importInputSchema,
      (service, input) => importGraphData(service, input),
      'Import Graph Data'
    ).bind(null, bridge)
  );

  // Export Subgraph
  server.registerTool(
    TOOL_NAMES.EXPORT_SUBGRAPH,
    {
      title: 'Export Subgraph',
      description: 'Export a subgraph based on a traversal query to various formats',
      inputSchema: {
        traversal_query: z.string().describe('Gremlin traversal query to define the subgraph'),
        format: z
          .enum(['graphson', 'json', 'csv'])
          .describe('The output format for the exported data'),
        max_depth: z.number().optional().describe('Maximum traversal depth for the subgraph'),
        include_properties: z
          .array(z.string())
          .optional()
          .describe('Properties to include in the export'),
        exclude_properties: z
          .array(z.string())
          .optional()
          .describe('Properties to exclude from the export'),
      },
    },
    createDataOperationHandler(
      exportInputSchema,
      (service, input) => exportSubgraph(service, input),
      'Export Subgraph'
    ).bind(null, bridge)
  );
}

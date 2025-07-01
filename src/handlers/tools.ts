/**
 * Effect-based MCP Tool handlers for Gremlin server.
 * Uses proper dependency injection instead of global runtime container.
 */

import { Effect, pipe } from 'effect';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOL_NAMES } from '../constants.js';
import { GremlinService } from '../gremlin/service.js';
import { type ImportDataInput, type ExportSubgraphInput } from '../gremlin/models.js';
import { type EffectMcpBridge } from './effect-runtime-bridge.js';
import { fromError } from '../errors.js';
import { importGraphData, exportSubgraph } from '../utils/data-operations.js';

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
    async () => {
      try {
        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.getStatus),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [{ type: 'text' as const, text: `Connection error: ${result.left.message}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: result.right }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Get Graph Status');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
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
    async () => {
      try {
        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.getSchema),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  { error: `Failed to get schema: ${result.left.message}` },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.right, null, 2) }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Get Graph Schema');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
  );

  // Refresh Schema Cache
  server.registerTool(
    TOOL_NAMES.REFRESH_SCHEMA_CACHE,
    {
      title: 'Refresh Schema Cache',
      description: 'Force an immediate refresh of the graph schema cache',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.refreshSchemaCache),
            Effect.map(() => 'Schema cache refreshed successfully.'),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [
              { type: 'text' as const, text: `Failed to refresh schema: ${result.left.message}` },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: result.right }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Refresh Schema Cache');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
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
    async (args: unknown) => {
      try {
        const validatedInput = z.object({ query: z.string() }).parse(args);
        const { query } = validatedInput;

        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => service.executeQuery(query)),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    message: `Query failed: ${result.left.message}`,
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

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.right, null, 2) }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Run Gremlin Query');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
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
    async (args: unknown) => {
      try {
        const inputSchema = z.object({
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
        const validatedInput = inputSchema.parse(args) as ImportDataInput;

        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => importGraphData(service, validatedInput)),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [{ type: 'text' as const, text: `Import failed: ${result.left.message}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.right, null, 2) }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Import Graph Data');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
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
    async (args: unknown) => {
      try {
        const inputSchema = z.object({
          traversal_query: z.string(),
          format: z.enum(['graphson', 'json', 'csv']),
          max_depth: z.number().optional(),
          include_properties: z.array(z.string()).optional(),
          exclude_properties: z.array(z.string()).optional(),
        });
        const validatedInput = inputSchema.parse(args) as ExportSubgraphInput;

        const result = await bridge.runEffect(
          pipe(
            GremlinService,
            Effect.flatMap(service => exportSubgraph(service, validatedInput)),
            Effect.either
          )
        );

        if (result._tag === 'Left') {
          return {
            content: [{ type: 'text' as const, text: `Export failed: ${result.left.message}` }],
            isError: true,
          };
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result.right, null, 2) }],
        };
      } catch (error) {
        const mcpError = fromError(error, 'Export Subgraph');
        return {
          content: [{ type: 'text' as const, text: `Unexpected error: ${mcpError.message}` }],
          isError: true,
        };
      }
    }
  );
}

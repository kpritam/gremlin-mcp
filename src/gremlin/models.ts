/**
 * Data Models Module for Gremlin Graph Database.
 *
 * This module defines the core data structures and types used throughout the Gremlin
 * graph database interface. It includes models for graph schema definitions and
 * knowledge graph components. Compatible with any Gremlin-enabled database including
 * Apache TinkerPop, Amazon Neptune, Azure Cosmos DB, etc.
 *
 * The models use Zod for clean, type-safe data structures that represent
 * both the graph structure and its contents with runtime validation.
 */

import { z } from 'zod';

/**
 * Represents a property definition for nodes and relationships in the graph.
 *
 * Properties are key-value pairs that can be attached to both nodes and
 * relationships, storing additional metadata about these graph elements.
 */
export const PropertySchema = z.object({
  /** The name of the property */
  name: z.string(),
  /** The data type(s) of the property */
  type: z.array(z.string()),
  /** A list of sample values for the property (optional for schema size optimization) */
  sample_values: z.array(z.unknown()).optional(),
  /** Cardinality information (single, list, set) */
  cardinality: z.string().optional(),
  /** A list of all possible values, if the property is determined to be an enum */
  enum: z.array(z.unknown()).optional(),
});

export type Property = z.infer<typeof PropertySchema>;

/**
 * Defines a node type in the graph schema.
 *
 * Nodes represent entities in the graph database and can have labels
 * and properties that describe their characteristics.
 */
export const NodeSchema = z.object({
  /** The label(s) that categorize this node type */
  labels: z.string(),
  /** List of properties that can be assigned to this node type */
  properties: z.array(PropertySchema).default([]),
  /** Count of vertices with this label */
  count: z.number().optional(),
});

export type Node = z.infer<typeof NodeSchema>;

/**
 * Defines a relationship type in the graph schema.
 *
 * Relationships represent connections between nodes in the graph and can
 * have their own properties to describe the nature of the connection.
 */
export const RelationshipSchema = z.object({
  /** The type/category of the relationship */
  type: z.string(),
  /** List of properties that can be assigned to this relationship type */
  properties: z.array(PropertySchema).default([]),
  /** Count of edges with this label */
  count: z.number().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

/**
 * Defines a valid relationship pattern between nodes in the graph.
 *
 * Relationship patterns describe the allowed connections between different
 * types of nodes in the graph schema.
 */
export const RelationshipPatternSchema = z.object({
  /** The label of the source/starting node */
  left_node: z.string(),
  /** The label of the target/ending node */
  right_node: z.string(),
  /** The type of relationship connecting the nodes */
  relation: z.string(),
});

export type RelationshipPattern = z.infer<typeof RelationshipPatternSchema>;

/**
 * Schema metadata for optimization information
 */
export const SchemaMetadataSchema = z.object({
  /** Total size of the schema in bytes */
  schema_size_bytes: z.number().optional(),
  /** Number of node types */
  node_count: z.number(),
  /** Number of relationship types */
  relationship_count: z.number(),
  /** Number of relationship patterns */
  pattern_count: z.number(),
  /** Time taken to generate the schema in milliseconds */
  generation_time_ms: z.number().optional(),
  /** Optimization settings used */
  optimization_settings: z.object({
    sample_values_included: z.boolean(),
    max_enum_values: z.number(),
    counts_included: z.boolean(),
    enum_cardinality_threshold: z.number(),
    timeout_ms: z.number().optional(),
    batch_size: z.number().optional(),
  }),
  /** When the schema was generated */
  generated_at: z.string(),
});

export type SchemaMetadata = z.infer<typeof SchemaMetadataSchema>;

/**
 * Represents the complete schema definition for the graph database.
 *
 * The graph schema defines all possible node types, relationship types,
 * and valid patterns of connections between nodes.
 */
export const GraphSchemaSchema = z.object({
  /** List of all node types defined in the schema */
  nodes: z.array(NodeSchema),
  /** List of all relationship types defined in the schema */
  relationships: z.array(RelationshipSchema),
  /** List of valid relationship patterns between nodes */
  relationship_patterns: z.array(RelationshipPatternSchema),
  /** Schema metadata and optimization information */
  metadata: SchemaMetadataSchema.optional(),
});

export type GraphSchema = z.infer<typeof GraphSchemaSchema>;

/**
 * Gremlin configuration schema
 */
export const GremlinConfigSchema = z.object({
  /** Host address of the Gremlin server */
  host: z.string(),
  /** Port number of the Gremlin server */
  port: z.number().int().positive(),
  /** Traversal source name */
  traversalSource: z.string(),
  /** Whether to use SSL/TLS connection */
  useSSL: z.boolean(),
  /** Optional username for authentication */
  username: z.string().optional(),
  /** Optional password for authentication */
  password: z.string().optional(),
  /** Idle timeout in seconds */
  idleTimeoutSeconds: z.number().positive(),
  /** Whether enum discovery is enabled */
  enumDiscoveryEnabled: z.boolean().optional().default(true),
  /** Cardinality threshold for enum discovery */
  enumCardinalityThreshold: z.number().positive().optional().default(10),
  /** List of property names to exclude from enum discovery */
  enumPropertyBlacklist: z.array(z.string()).optional().default([]),
  /** Whether to include sample values in schema (for size optimization) */
  includeSampleValues: z.boolean().optional().default(false),
  /** Maximum number of enum values to include (for size optimization) */
  maxEnumValues: z.number().positive().optional().default(10),
  /** Whether to include vertex/edge counts in schema */
  includeCounts: z.boolean().optional().default(true),
});

export type GremlinConfig = z.infer<typeof GremlinConfigSchema>;

/**
 * Gremlin vertex with full structure
 */
export const GremlinVertexSchema = z.object({
  id: z.union([z.string(), z.number(), z.object({})]),
  label: z.string().min(1, 'Vertex label cannot be empty'),
  properties: z.record(z.string(), z.array(z.unknown())).optional(),
  type: z.literal('vertex'),
});

export type GremlinVertex = z.infer<typeof GremlinVertexSchema>;

/**
 * Gremlin edge with full structure
 */
export const GremlinEdgeSchema = z.object({
  id: z.union([z.string(), z.number(), z.object({})]),
  label: z.string().min(1, 'Edge label cannot be empty'),
  inV: z.union([z.string(), z.number(), z.object({})]),
  outV: z.union([z.string(), z.number(), z.object({})]),
  properties: z.record(z.string(), z.array(z.unknown())).optional(),
  type: z.literal('edge'),
});

export type GremlinEdge = z.infer<typeof GremlinEdgeSchema>;

/**
 * Gremlin property map (from valueMap() queries)
 */
export const GremlinPropertyMapSchema = z.record(z.array(z.unknown()));
export type GremlinPropertyMap = z.infer<typeof GremlinPropertyMapSchema>;

/**
 * Gremlin path result (from path() queries)
 */
export const GremlinPathSchema = z.object({
  labels: z.array(z.string()),
  objects: z.array(z.unknown()),
  type: z.literal('path'),
});

export type GremlinPath = z.infer<typeof GremlinPathSchema>;

/**
 * Gremlin property result (individual Property/VertexProperty instances)
 */
export const GremlinPropertySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  type: z.literal('property'),
});

export type GremlinProperty = z.infer<typeof GremlinPropertySchema>;

/**
 * Discriminated union for structured Gremlin result types
 */
export const GremlinStructuredResultSchema = z.discriminatedUnion('type', [
  GremlinVertexSchema,
  GremlinEdgeSchema,
  GremlinPathSchema,
  GremlinPropertySchema,
]);

/**
 * Union type for all possible Gremlin result types (including primitives)
 */
export const GremlinResultItemSchema = z.union([
  GremlinStructuredResultSchema,
  GremlinPropertyMapSchema,
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

export type GremlinStructuredResult = z.infer<typeof GremlinStructuredResultSchema>;
export type GremlinResultItem = z.infer<typeof GremlinResultItemSchema>;

/**
 * Gremlin query result structure with properly typed results
 */
export const GremlinQueryResultSchema = z.object({
  /** Query results array with typed items */
  results: z.array(GremlinResultItemSchema),
  /** Status message about the query execution */
  message: z.string(),
});

export type GremlinQueryResult = z.infer<typeof GremlinQueryResultSchema>;

/**
 * Input schema for Gremlin query tool
 */
export const GremlinQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .describe('The Gremlin query to execute against the graph database'),
});

export type GremlinQueryInput = z.infer<typeof GremlinQueryInputSchema>;

/**
 * Input schema for import operations with enhanced validation
 */
export const ImportDataInputSchema = z
  .object({
    format: z.enum(['graphson', 'csv'], {
      errorMap: () => ({ message: 'Format must be either "graphson" or "csv"' }),
    }),
    data: z
      .string()
      .min(1, 'Data cannot be empty')
      .max(50 * 1024 * 1024, 'Data size cannot exceed 50MB'), // 50MB limit
    options: z
      .object({
        clear_graph: z.boolean().optional(),
        batch_size: z
          .number()
          .positive('Batch size must be positive')
          .max(10000, 'Batch size cannot exceed 10,000')
          .optional(),
        validate_schema: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    data => {
      // Additional validation for GraphSON format
      if (data.format === 'graphson') {
        try {
          JSON.parse(data.data);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    {
      message: 'GraphSON data must be valid JSON',
      path: ['data'],
    }
  );

export type ImportDataInput = z.infer<typeof ImportDataInputSchema>;

/**
 * Input schema for export operations with enhanced validation
 */
export const ExportSubgraphInputSchema = z
  .object({
    traversal_query: z
      .string()
      .min(1, 'Traversal query cannot be empty')
      .max(10000, 'Traversal query cannot exceed 10,000 characters')
      .refine(
        query => {
          // Basic Gremlin syntax validation
          const invalidPatterns = [';', '--', '/*', '*/', 'DROP', 'DELETE'];
          return !invalidPatterns.some(pattern =>
            query.toUpperCase().includes(pattern.toUpperCase())
          );
        },
        {
          message: 'Query contains potentially unsafe operations',
        }
      ),
    format: z.enum(['graphson', 'json', 'csv'], {
      errorMap: () => ({ message: 'Format must be "graphson", "json", or "csv"' }),
    }),
    include_properties: z
      .array(z.string().min(1, 'Property name cannot be empty'))
      .max(100, 'Cannot include more than 100 properties')
      .optional(),
    exclude_properties: z
      .array(z.string().min(1, 'Property name cannot be empty'))
      .max(100, 'Cannot exclude more than 100 properties')
      .optional(),
    max_depth: z
      .number()
      .positive('Max depth must be positive')
      .max(10, 'Max depth cannot exceed 10 levels')
      .optional(),
  })
  .refine(
    data => {
      // Cannot have both include and exclude properties
      return !(data.include_properties && data.exclude_properties);
    },
    {
      message: 'Cannot specify both include_properties and exclude_properties',
      path: ['include_properties'],
    }
  );

export type ExportSubgraphInput = z.infer<typeof ExportSubgraphInputSchema>;

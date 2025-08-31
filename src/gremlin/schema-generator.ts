/**
 * Graph schema generation with comprehensive analysis and optimizations
 */

import { Effect, Duration } from 'effect';
import gremlin from 'gremlin';
import {
  GraphSchemaSchema,
  type GraphSchema,
  type Node,
  type Relationship,
  type RelationshipPattern,
  type Property,
} from './models.js';
import { Errors, type GremlinConnectionError } from '../errors.js';
import type { ConnectionState, SchemaConfig } from './types.js';

// Import proper types from gremlin package
import type { process } from 'gremlin';
type GraphTraversalSource = process.GraphTraversalSource;

/**
 * Schema generation count data structure
 */
interface SchemaCountData {
  /** Mapping of labels to their counts */
  value?: Record<string, number>;
  /** Total count */
  total?: number;
}

const { inV, outV, label } = gremlin.process.statics;

/**
 * Process items in batches with controlled concurrency
 */
const processBatched = <T, R, E>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Effect.Effect<R, E>
): Effect.Effect<R[], E> =>
  Effect.gen(function* () {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results: R[] = [];
    for (const batch of batches) {
      const batchResults = yield* Effect.all(batch.map(processor), {
        concurrency: Math.min(batchSize, 10),
      });
      results.push(...batchResults);
    }

    return results;
  });

// Constants
const DEFAULT_MAX_ENUM_VALUES = 10;
const DEFAULT_ENUM_CARDINALITY_THRESHOLD = 10;
const DEFAULT_SCHEMA_TIMEOUT_MS = 30000; // 30 seconds
const DEFAULT_BATCH_SIZE = 10; // Process 10 labels at a time

/**
 * Default schema configuration
 */
export const DEFAULT_SCHEMA_CONFIG: SchemaConfig = {
  includeSampleValues: false,
  maxEnumValues: DEFAULT_MAX_ENUM_VALUES,
  includeCounts: true,
  enumCardinalityThreshold: DEFAULT_ENUM_CARDINALITY_THRESHOLD,
  enumPropertyBlacklist: ['id', 'label', 'lastUpdatedByUI'],
  timeoutMs: DEFAULT_SCHEMA_TIMEOUT_MS,
  batchSize: DEFAULT_BATCH_SIZE,
};

/**
 * Execute the core schema generation logic
 */
const executeSchemaGeneration = (
  g: GraphTraversalSource,
  config: SchemaConfig,
  startTime: number
): Effect.Effect<GraphSchema, GremlinConnectionError> =>
  Effect.gen(function* () {
    const graphLabels = yield* getGraphLabels(g);
    const counts = yield* getCounts(g, graphLabels, config);

    // Use parallel streams for vertex and edge analysis
    const [nodes, relationships, patterns] = yield* Effect.all(
      [
        analyzeAllVertexProperties(g, graphLabels.vertexLabels, config, counts.vertexCounts),
        analyzeAllEdgeProperties(g, graphLabels.edgeLabels, config, counts.edgeCounts),
        generateRelationshipPatterns(g, graphLabels.edgeLabels),
      ],
      { concurrency: 3 }
    ); // Allow up to 3 concurrent operations

    return yield* buildSchemaData(nodes, relationships, patterns, config, startTime);
  });

/**
 * Apply timeout to schema generation with proper error handling
 */
const applySchemaTimeout = (
  schemaGeneration: Effect.Effect<GraphSchema, GremlinConnectionError>,
  config: SchemaConfig
): Effect.Effect<GraphSchema, GremlinConnectionError> => {
  const timeoutEffect = Effect.timeout(
    schemaGeneration,
    Duration.millis(config.timeoutMs || DEFAULT_SCHEMA_TIMEOUT_MS)
  );

  return Effect.catchTag(timeoutEffect, 'TimeoutException', () =>
    Effect.fail(
      Errors.connection(
        `Schema generation timed out after ${config.timeoutMs || DEFAULT_SCHEMA_TIMEOUT_MS}ms`
      )
    )
  );
};

/**
 * Generate comprehensive graph schema with optimizations
 */
export const generateGraphSchema = (
  connectionState: ConnectionState,
  config: SchemaConfig = DEFAULT_SCHEMA_CONFIG
): Effect.Effect<GraphSchema, GremlinConnectionError> =>
  Effect.gen(function* () {
    if (!connectionState.g) {
      return yield* Effect.fail(Errors.connection('Graph traversal source not available'));
    }

    const g = connectionState.g;
    const startTime = Date.now();

    const schemaGeneration = executeSchemaGeneration(g, config, startTime);
    return yield* applySchemaTimeout(schemaGeneration, config);
  });

/**
 * Get graph labels (vertices and edges)
 */
const getGraphLabels = (g: GraphTraversalSource) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Starting to fetch graph labels (vertices and edges)');

    const [vertexLabels, edgeLabels] = yield* Effect.all([
      Effect.tryPromise({
        try: () => g.V().label().dedup().toList(),
        catch: (error: unknown) => Errors.connection('Failed to get vertex labels', { error }),
      }),
      Effect.tryPromise({
        try: () => g.E().label().dedup().toList(),
        catch: (error: unknown) => Errors.connection('Failed to get edge labels', { error }),
      }),
    ]);

    yield* Effect.logInfo(
      `Found ${(vertexLabels as string[]).length} vertex labels: ${JSON.stringify(vertexLabels)}`
    );
    yield* Effect.logInfo(
      `Found ${(edgeLabels as string[]).length} edge labels: ${JSON.stringify(edgeLabels)}`
    );

    return {
      vertexLabels: vertexLabels as string[],
      edgeLabels: edgeLabels as string[],
    };
  });

/**
 * Get counts for vertices and edges if requested
 */
const getCounts = (
  g: GraphTraversalSource,
  _labels: { vertexLabels: string[]; edgeLabels: string[] },
  config: SchemaConfig
) =>
  Effect.gen(function* () {
    if (!config.includeCounts) {
      return { vertexCounts: {}, edgeCounts: {} };
    }

    const [vertexCounts, edgeCounts] = yield* Effect.all([
      Effect.tryPromise({
        try: () => g.V().groupCount().by(label()).next(),
        catch: (error: unknown) => Errors.connection('Failed to get vertex counts', { error }),
      }),
      Effect.tryPromise({
        try: () => g.E().groupCount().by(label()).next(),
        catch: (error: unknown) => Errors.connection('Failed to get edge counts', { error }),
      }),
    ]);

    return { vertexCounts, edgeCounts };
  });

/**
 * Build final schema data structure
 */
const buildSchemaData = (
  nodes: Node[],
  relationships: Relationship[],
  patterns: RelationshipPattern[],
  config: SchemaConfig,
  startTime: number
) => {
  const schemaData = {
    nodes,
    relationships,
    relationship_patterns: patterns,
    metadata: {
      generated_at: new Date().toISOString(),
      generation_time_ms: Date.now() - startTime,
      node_count: nodes.length,
      relationship_count: relationships.length,
      pattern_count: patterns.length,
      optimization_settings: {
        sample_values_included: config.includeSampleValues,
        max_enum_values: config.maxEnumValues,
        counts_included: config.includeCounts,
        enum_cardinality_threshold: config.enumCardinalityThreshold,
        timeout_ms: config.timeoutMs || DEFAULT_SCHEMA_TIMEOUT_MS,
        batch_size: config.batchSize || DEFAULT_BATCH_SIZE,
      },
    },
  };

  return Effect.try({
    try: () => GraphSchemaSchema.parse(schemaData),
    catch: (error: unknown) => {
      console.error('Schema validation error:', error);
      console.error('Schema data that failed:', JSON.stringify(schemaData, null, 2));
      return Errors.connection('Schema validation failed', { error });
    },
  });
};

/**
 * Analyze all vertex properties with batched processing
 */
const analyzeAllVertexProperties = (
  g: GraphTraversalSource,
  vertexLabels: string[],
  config: SchemaConfig,
  vertexCounts: SchemaCountData | null
): Effect.Effect<Node[], GremlinConnectionError> =>
  Effect.gen(function* () {
    const batchSize = config.batchSize || DEFAULT_BATCH_SIZE;

    yield* Effect.logInfo(
      `Analyzing ${vertexLabels.length} vertex labels with batch size ${batchSize}`
    );

    return yield* processBatched(vertexLabels, batchSize, (vertexLabel: string) =>
      analyzeVertexPropertiesBatched(g, vertexLabel, config, vertexCounts)
    );
  });

/**
 * Analyze vertex properties for a given label using batched queries
 */
const analyzeVertexPropertiesBatched = (
  g: GraphTraversalSource,
  vertexLabel: string,
  config: SchemaConfig,
  vertexCounts: SchemaCountData | null
): Effect.Effect<Node, GremlinConnectionError> =>
  Effect.gen(function* () {
    const propertyAnalysis = yield* batchAnalyzeVertexProperties(g, vertexLabel, config);
    const count = config.includeCounts
      ? (vertexCounts as SchemaCountData)?.value?.[vertexLabel] || 0
      : undefined;

    return {
      labels: vertexLabel,
      properties: propertyAnalysis,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Analyze all edge properties with batched processing
 */
const analyzeAllEdgeProperties = (
  g: GraphTraversalSource,
  edgeLabels: string[],
  config: SchemaConfig,
  edgeCounts: SchemaCountData | null
): Effect.Effect<Relationship[], GremlinConnectionError> =>
  Effect.gen(function* () {
    const batchSize = config.batchSize || DEFAULT_BATCH_SIZE;

    yield* Effect.logInfo(
      `Analyzing ${edgeLabels.length} edge labels with batch size ${batchSize}`
    );

    return yield* processBatched(edgeLabels, batchSize, (edgeLabel: string) =>
      analyzeEdgePropertiesBatched(g, edgeLabel, config, edgeCounts)
    );
  });

/**
 * Analyze edge properties for a given label using batched queries
 */
const analyzeEdgePropertiesBatched = (
  g: GraphTraversalSource,
  edgeLabel: string,
  config: SchemaConfig,
  edgeCounts: SchemaCountData | null
): Effect.Effect<Relationship, GremlinConnectionError> =>
  Effect.gen(function* () {
    const propertyAnalysis = yield* batchAnalyzeEdgeProperties(g, edgeLabel, config);
    const count = config.includeCounts
      ? (edgeCounts as SchemaCountData)?.value?.[edgeLabel] || 0
      : undefined;

    return {
      type: edgeLabel,
      properties: propertyAnalysis,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Batch analyze vertex properties using streams for property processing
 */
const batchAnalyzeVertexProperties = (
  g: GraphTraversalSource,
  vertexLabel: string,
  config: SchemaConfig
): Effect.Effect<Property[], GremlinConnectionError> =>
  Effect.gen(function* () {
    // Get all property keys first
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.V().hasLabel(vertexLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for vertex ${vertexLabel}`, { error }),
    });

    const keyList = propertyKeys as string[];

    // Process properties with controlled concurrency
    return yield* Effect.all(
      keyList.map(key => batchAnalyzeSingleProperty(g, vertexLabel, key, config, true)),
      { concurrency: 5 }
    );
  });

/**
 * Batch analyze edge properties using streams for property processing
 */
const batchAnalyzeEdgeProperties = (
  g: GraphTraversalSource,
  edgeLabel: string,
  config: SchemaConfig
): Effect.Effect<Property[], GremlinConnectionError> =>
  Effect.gen(function* () {
    // Get all property keys first
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.E().hasLabel(edgeLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for edge ${edgeLabel}`, { error }),
    });

    const keyList = propertyKeys as string[];

    // Process properties with controlled concurrency
    return yield* Effect.all(
      keyList.map(key => batchAnalyzeSingleProperty(g, edgeLabel, key, config, false)),
      { concurrency: 5 }
    );
  });

/**
 * Batch analyze a single property with optimized queries
 */
const batchAnalyzeSingleProperty = (
  g: GraphTraversalSource,
  elementLabel: string,
  propertyKey: string,
  config: SchemaConfig,
  isVertex: boolean
): Effect.Effect<Property, GremlinConnectionError> =>
  Effect.gen(function* () {
    // Skip blacklisted properties
    if (config.enumPropertyBlacklist.includes(propertyKey)) {
      return {
        name: propertyKey,
        type: ['unknown'],
      };
    }

    const traversal = isVertex ? g.V().hasLabel(elementLabel) : g.E().hasLabel(elementLabel);

    // Get sample values to determine types
    const sampleValues = yield* Effect.tryPromise({
      try: () =>
        traversal
          .limit(50)
          .values(propertyKey)
          .dedup()
          .limit(config.maxEnumValues + 1)
          .toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get values for property ${propertyKey}`, { error }),
    });

    const valueList = sampleValues as unknown[];
    return analyzePropertyFromValues(propertyKey, valueList, config);
  });

/**
 * Analyze property from collected values
 */
const analyzePropertyFromValues = (
  propertyKey: string,
  values: unknown[],
  config: SchemaConfig
) => {
  // Skip blacklisted properties
  if (config.enumPropertyBlacklist.includes(propertyKey)) {
    return {
      name: propertyKey,
      type: ['unknown'],
    };
  }

  // Deduplicate and limit values
  const uniqueValues = Array.from(new Set(values)).slice(0, config.maxEnumValues + 1);

  // Determine types from sample values
  const types = Array.from(new Set(uniqueValues.map((val: unknown) => typeof val).filter(Boolean)));

  const property: Property = {
    name: propertyKey,
    type: types.length > 0 ? types : ['unknown'],
  };

  // Add sample values if requested
  if (config.includeSampleValues && uniqueValues.length > 0) {
    property.sample_values = uniqueValues.slice(0, 5);
  }

  // Determine if this should be treated as an enum
  if (uniqueValues.length <= config.enumCardinalityThreshold && uniqueValues.length > 0) {
    property.enum = uniqueValues;
    property.cardinality = 'single';
  }

  return property;
};

/**
 * Generate relationship patterns with batched approach
 */
const generateRelationshipPatterns = (g: GraphTraversalSource, edgeLabels: string[]) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Generating relationship patterns for ${edgeLabels.length} edge labels`);

    // Don't depend on edgeLabels parameter - generate directly from database
    if (edgeLabels.length === 0) {
      yield* Effect.logWarning(
        'No edge labels provided, but generating relationship patterns directly from database'
      );
    }

    // Get all patterns in a single query instead of per-label queries
    const allPatterns = yield* Effect.tryPromise({
      try: () =>
        g
          .E()
          .project('from', 'to', 'label')
          .by(outV().label())
          .by(inV().label())
          .by(label())
          .dedup()
          .limit(1000) // Increased limit since we're doing one query
          .toList(),
      catch: (error: unknown) =>
        Errors.connection('Failed to get relationship patterns', { error }),
    });

    // Gremlin project() returns a Map-like object, need to extract properly
    const resultList = (allPatterns as unknown[]).map((item: unknown) => {
      // Handle both Map and plain object formats
      if (item instanceof Map) {
        return {
          from: item.get('from'),
          to: item.get('to'),
          label: item.get('label'),
        };
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        return {
          from: obj['from'],
          to: obj['to'],
          label: obj['label'],
        };
      }
      return { from: null, to: null, label: null };
    });

    yield* Effect.logInfo(`Retrieved ${resultList.length} raw patterns from database`);

    const filteredPatterns = resultList
      .filter(
        (result: { from: unknown; to: unknown; label: unknown }) =>
          result.from &&
          result.to &&
          result.label &&
          typeof result.from === 'string' &&
          typeof result.to === 'string' &&
          typeof result.label === 'string'
      )
      .map((result: { from: string; to: string; label: string }) => ({
        left_node: result.from,
        right_node: result.to,
        relation: result.label,
      }));

    yield* Effect.logInfo(`Filtered to ${filteredPatterns.length} valid patterns`);

    return filteredPatterns;
  });

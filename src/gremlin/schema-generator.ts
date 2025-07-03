/**
 * Graph schema generation with comprehensive analysis and optimizations
 */

import { Effect, Duration, Stream, Chunk } from 'effect';
import gremlin from 'gremlin';
import { GraphSchemaSchema, type GraphSchema } from './models.js';
import { Errors, type GremlinConnectionError } from '../errors.js';
import type { ConnectionState, SchemaConfig } from './types.js';

const { inV, outV, label } = gremlin.process.statics;

/**
 * Create a resourceful stream for processing database operations with backpressure and resource management
 */
const createBatchedStream = <T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Effect.Effect<R, any>
): Stream.Stream<R, any> =>
  Stream.fromIterable(items).pipe(
    Stream.grouped(batchSize),
    Stream.mapEffect(chunk =>
      // Use acquireUseRelease for resource management around batch processing
      Effect.acquireUseRelease(
        // Acquire: Log start of batch processing
        Effect.gen(function* () {
          yield* Effect.logDebug(`Starting batch processing with ${Chunk.size(chunk)} items`);
          return { batchSize: Chunk.size(chunk), startTime: Date.now() };
        }),
        // Use: Process the batch with controlled concurrency
        _resource =>
          Effect.gen(function* () {
            return yield* Effect.all(
              Chunk.toReadonlyArray(Chunk.map(chunk, processor)),
              { concurrency: Math.min(batchSize, 10) } // Limit concurrency to prevent DB overload
            );
          }),
        // Release: Log completion and cleanup
        resource =>
          Effect.gen(function* () {
            const duration = Date.now() - resource.startTime;
            yield* Effect.logDebug(
              `Completed batch of ${resource.batchSize} items in ${duration}ms`
            );
          })
      )
    ),
    Stream.flatMap(results => Stream.fromIterable(results))
  );

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
  g: any,
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
const getGraphLabels = (g: any) =>
  Effect.gen(function* () {
    const [vertexLabels, edgeLabels] = yield* Effect.all([
      Effect.tryPromise({
        try: () => g.V().label().dedup().toList(),
        catch: (error: unknown) => Errors.connection('Failed to get vertex labels', error),
      }),
      Effect.tryPromise({
        try: () => g.E().label().dedup().toList(),
        catch: (error: unknown) => Errors.connection('Failed to get edge labels', error),
      }),
    ]);

    yield* Effect.logDebug(
      `Found ${(vertexLabels as string[]).length} vertex labels and ${(edgeLabels as string[]).length} edge labels`
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
  g: any,
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
        catch: (error: unknown) => Errors.connection('Failed to get vertex counts', error),
      }),
      Effect.tryPromise({
        try: () => g.E().groupCount().by(label()).next(),
        catch: (error: unknown) => Errors.connection('Failed to get edge counts', error),
      }),
    ]);

    return { vertexCounts, edgeCounts };
  });

/**
 * Build final schema data structure
 */
const buildSchemaData = (
  nodes: any[],
  relationships: any[],
  patterns: any[],
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

  return Effect.tryPromise({
    try: () => Promise.resolve(GraphSchemaSchema.parse(schemaData)),
    catch: (error: unknown) => {
      console.error('Schema validation error:', error);
      console.error('Schema data that failed:', JSON.stringify(schemaData, null, 2));
      return Errors.connection('Schema validation failed', error);
    },
  });
};

/**
 * Analyze all vertex properties using resourceful streams
 */
const analyzeAllVertexProperties = (
  g: any,
  vertexLabels: string[],
  config: SchemaConfig,
  vertexCounts: any
): Effect.Effect<any[], any> =>
  Effect.gen(function* () {
    const batchSize = config.batchSize || DEFAULT_BATCH_SIZE;

    yield* Effect.logInfo(
      `Analyzing ${vertexLabels.length} vertex labels using streams with batch size ${batchSize}`
    );

    return yield* createBatchedStream(vertexLabels, batchSize, (vertexLabel: string) =>
      analyzeVertexPropertiesBatched(g, vertexLabel, config, vertexCounts)
    ).pipe(
      Stream.runCollect,
      Effect.map(chunk => [...Chunk.toReadonlyArray(chunk)]) // Convert to mutable array
    );
  });

/**
 * Analyze vertex properties for a given label using batched queries
 */
const analyzeVertexPropertiesBatched = (
  g: any,
  vertexLabel: string,
  config: SchemaConfig,
  vertexCounts: any
) =>
  Effect.gen(function* () {
    const propertyAnalysis = yield* batchAnalyzeVertexProperties(g, vertexLabel, config);
    const count = config.includeCounts
      ? (vertexCounts as any)?.value?.[vertexLabel] || 0
      : undefined;

    return {
      labels: vertexLabel,
      properties: propertyAnalysis,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Analyze all edge properties using resourceful streams
 */
const analyzeAllEdgeProperties = (
  g: any,
  edgeLabels: string[],
  config: SchemaConfig,
  edgeCounts: any
): Effect.Effect<any[], any> =>
  Effect.gen(function* () {
    const batchSize = config.batchSize || DEFAULT_BATCH_SIZE;

    yield* Effect.logInfo(
      `Analyzing ${edgeLabels.length} edge labels using streams with batch size ${batchSize}`
    );

    return yield* createBatchedStream(edgeLabels, batchSize, (edgeLabel: string) =>
      analyzeEdgePropertiesBatched(g, edgeLabel, config, edgeCounts)
    ).pipe(
      Stream.runCollect,
      Effect.map(chunk => [...Chunk.toReadonlyArray(chunk)]) // Convert to mutable array
    );
  });

/**
 * Analyze edge properties for a given label using batched queries
 */
const analyzeEdgePropertiesBatched = (
  g: any,
  edgeLabel: string,
  config: SchemaConfig,
  edgeCounts: any
) =>
  Effect.gen(function* () {
    const propertyAnalysis = yield* batchAnalyzeEdgeProperties(g, edgeLabel, config);
    const count = config.includeCounts ? (edgeCounts as any)?.value?.[edgeLabel] || 0 : undefined;

    return {
      type: edgeLabel,
      properties: propertyAnalysis,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Batch analyze vertex properties using streams for property processing
 */
const batchAnalyzeVertexProperties = (g: any, vertexLabel: string, config: SchemaConfig) =>
  Effect.gen(function* () {
    // Get all property keys first
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.V().hasLabel(vertexLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for vertex ${vertexLabel}`, error),
    });

    const keyList = propertyKeys as string[];

    // Use streams to process properties with controlled concurrency
    return yield* Stream.fromIterable(keyList).pipe(
      Stream.mapEffect(key => batchAnalyzeSingleProperty(g, vertexLabel, key, config, true)),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    );
  });

/**
 * Batch analyze edge properties using streams for property processing
 */
const batchAnalyzeEdgeProperties = (g: any, edgeLabel: string, config: SchemaConfig) =>
  Effect.gen(function* () {
    // Get all property keys first
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.E().hasLabel(edgeLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for edge ${edgeLabel}`, error),
    });

    const keyList = propertyKeys as string[];

    // Use streams to process properties with controlled concurrency
    return yield* Stream.fromIterable(keyList).pipe(
      Stream.mapEffect(key => batchAnalyzeSingleProperty(g, edgeLabel, key, config, false)),
      Stream.runCollect,
      Effect.map(Chunk.toReadonlyArray)
    );
  });

/**
 * Batch analyze a single property with optimized queries
 */
const batchAnalyzeSingleProperty = (
  g: any,
  elementLabel: string,
  propertyKey: string,
  config: SchemaConfig,
  isVertex: boolean
) =>
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
      catch: () => [],
    });

    const valueList = sampleValues as any[];
    return analyzePropertyFromValues(propertyKey, valueList, config);
  });

/**
 * Analyze property from collected values
 */
const analyzePropertyFromValues = (propertyKey: string, values: any[], config: SchemaConfig) => {
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
  const types = Array.from(new Set(uniqueValues.map((val: any) => typeof val).filter(Boolean)));

  const property: any = {
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
const generateRelationshipPatterns = (g: any, edgeLabels: string[]) =>
  Effect.gen(function* () {
    if (edgeLabels.length === 0) {
      return [];
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
      catch: (error: unknown) => Errors.connection('Failed to get relationship patterns', error),
    });

    const resultList = allPatterns as any[];
    return resultList
      .map((result: any) => ({
        left_node: result.from,
        right_node: result.to,
        relation: result.label,
      }))
      .filter(pattern => pattern.left_node && pattern.right_node && pattern.relation);
  });

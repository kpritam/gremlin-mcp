/**
 * Graph schema generation with comprehensive analysis
 */

import { Effect } from 'effect';
import gremlin from 'gremlin';
import { GraphSchemaSchema, type GraphSchema } from './models.js';
import { Errors, type GremlinConnectionError } from '../errors.js';
import type { ConnectionState, SchemaConfig } from './types.js';

const { inV, outV, label } = gremlin.process.statics;

// Constants
const DEFAULT_MAX_ENUM_VALUES = 10;
const DEFAULT_ENUM_CARDINALITY_THRESHOLD = 10;

/**
 * Default schema configuration
 */
export const DEFAULT_SCHEMA_CONFIG: SchemaConfig = {
  includeSampleValues: false,
  maxEnumValues: DEFAULT_MAX_ENUM_VALUES,
  includeCounts: true,
  enumCardinalityThreshold: DEFAULT_ENUM_CARDINALITY_THRESHOLD,
  enumPropertyBlacklist: ['id', 'label', 'lastUpdatedByUI'],
};

/**
 * Generate comprehensive graph schema
 */
export const generateGraphSchema = (
  connectionState: ConnectionState,
  config: SchemaConfig = DEFAULT_SCHEMA_CONFIG
): Effect.Effect<GraphSchema, GremlinConnectionError | never[]> =>
  Effect.gen(function* () {
    if (!connectionState.g) {
      return yield* Effect.fail(Errors.connection('Graph traversal source not available'));
    }

    const g = connectionState.g;

    // Get all vertex labels
    const vertexLabels = yield* Effect.tryPromise({
      try: () => g.V().label().dedup().toList(),
      catch: (error: unknown) => Errors.connection('Failed to get vertex labels', error),
    });

    const vertexLabelList = vertexLabels as string[];
    yield* Effect.logDebug(`Found ${vertexLabelList.length} vertex labels`);

    // Get all edge labels
    const edgeLabels = yield* Effect.tryPromise({
      try: () => g.E().label().dedup().toList(),
      catch: (error: unknown) => Errors.connection('Failed to get edge labels', error),
    });

    const edgeLabelList = edgeLabels as string[];
    yield* Effect.logDebug(`Found ${edgeLabelList.length} edge labels`);

    // Get vertex and edge counts if requested
    let vertexCounts: unknown = {};
    let edgeCounts: unknown = {};

    if (config.includeCounts) {
      vertexCounts = yield* Effect.tryPromise({
        try: () => g.V().groupCount().by(label()).next(),
        catch: (error: unknown) => Errors.connection('Failed to get vertex counts', error),
      });

      edgeCounts = yield* Effect.tryPromise({
        try: () => g.E().groupCount().by(label()).next(),
        catch: (error: unknown) => Errors.connection('Failed to get edge counts', error),
      });
    }

    // Analyze vertex properties
    const nodes = yield* Effect.all(
      vertexLabelList.map(vertexLabel =>
        analyzeVertexProperties(g, vertexLabel, config, vertexCounts)
      )
    );

    // Analyze edge properties
    const relationships = yield* Effect.all(
      edgeLabelList.map(edgeLabel => analyzeEdgeProperties(g, edgeLabel, config, edgeCounts))
    );

    // Generate relationship patterns
    const patterns = yield* generateRelationshipPatterns(g, edgeLabelList);

    const schemaData = {
      nodes,
      relationships,
      relationship_patterns: patterns,
      metadata: {
        generated_at: new Date().toISOString(),
        node_count: nodes.length,
        relationship_count: relationships.length,
        pattern_count: patterns.length,
        optimization_settings: {
          sample_values_included: config.includeSampleValues,
          max_enum_values: config.maxEnumValues,
          counts_included: config.includeCounts,
          enum_cardinality_threshold: config.enumCardinalityThreshold,
        },
      },
    };

    // Parse and validate the schema
    const parsedSchema = yield* Effect.tryPromise({
      try: () => Promise.resolve(GraphSchemaSchema.parse(schemaData)),
      catch: (error: unknown) => {
        console.error('Schema validation error:', error);
        console.error('Schema data that failed:', JSON.stringify(schemaData, null, 2));
        return Errors.connection('Schema validation failed', error);
      },
    });

    return parsedSchema;
  });

/**
 * Analyze vertex properties for a given label
 */
const analyzeVertexProperties = (
  g: any,
  vertexLabel: string,
  config: SchemaConfig,
  vertexCounts: any
) =>
  Effect.gen(function* () {
    // Get all property keys for this vertex label
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.V().hasLabel(vertexLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for vertex ${vertexLabel}`, error),
    });

    const keyList = propertyKeys as string[];

    // Analyze each property
    const properties = yield* Effect.all(
      keyList.map((key: string) => analyzeProperty(g, vertexLabel, key, config, true))
    );

    const count = config.includeCounts
      ? (vertexCounts as any)?.value?.[vertexLabel] || 0
      : undefined;

    return {
      labels: vertexLabel,
      properties,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Analyze edge properties for a given label
 */
const analyzeEdgeProperties = (g: any, edgeLabel: string, config: SchemaConfig, edgeCounts: any) =>
  Effect.gen(function* () {
    // Get all property keys for this edge label
    const propertyKeys = yield* Effect.tryPromise({
      try: () => g.E().hasLabel(edgeLabel).limit(100).properties().key().dedup().toList(),
      catch: (error: unknown) =>
        Errors.connection(`Failed to get properties for edge ${edgeLabel}`, error),
    });

    const keyList = propertyKeys as string[];

    // Analyze each property
    const properties = yield* Effect.all(
      keyList.map((key: string) => analyzeProperty(g, edgeLabel, key, config, false))
    );

    const count = config.includeCounts ? (edgeCounts as any)?.value?.[edgeLabel] || 0 : undefined;

    return {
      type: edgeLabel,
      properties,
      ...(count !== undefined && { count }),
    };
  });

/**
 * Analyze a specific property
 */
const analyzeProperty = (
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

    // Determine types from sample values
    const types = Array.from(new Set(valueList.map((val: any) => typeof val).filter(Boolean)));

    const property: any = {
      name: propertyKey,
      type: types.length > 0 ? types : ['unknown'],
    };

    // Add sample values if requested
    if (config.includeSampleValues && valueList.length > 0) {
      property.sample_values = valueList.slice(0, 5);
    }

    // Determine if this should be treated as an enum
    if (valueList.length <= config.enumCardinalityThreshold && valueList.length > 0) {
      property.enum = valueList;
      property.cardinality = 'single';
    }

    return property;
  });

/**
 * Generate relationship patterns
 */
const generateRelationshipPatterns = (g: any, edgeLabels: string[]) =>
  Effect.gen(function* () {
    const patterns = yield* Effect.all(
      edgeLabels.map(edgeLabel =>
        Effect.tryPromise({
          try: () =>
            g
              .E()
              .hasLabel(edgeLabel)
              .project('from', 'to', 'label')
              .by(outV().label())
              .by(inV().label())
              .by(label())
              .dedup()
              .limit(100)
              .toList(),
          catch: (error: unknown) =>
            Errors.connection(`Failed to get patterns for edge ${edgeLabel}`, error),
        }).pipe(
          Effect.map(results => {
            const resultList = results as any[];
            return resultList.map((result: any) => ({
              left_node: result.from,
              right_node: result.to,
              relation: result.label,
            }));
          }),
          Effect.catchAll(_error => Effect.succeed([]))
        )
      )
    );

    return patterns
      .flat()
      .filter(pattern => pattern.left_node && pattern.right_node && pattern.relation);
  });

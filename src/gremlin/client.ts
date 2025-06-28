import gremlin from 'gremlin';
const { Client, DriverRemoteConnection } = gremlin.driver;
import type { driver, process } from 'gremlin';
import { logger } from '../logger.js';
import { STATUS_MESSAGES } from '../constants.js';
import { isGremlinResult } from '../utils/type-guards.js';
import {
  type GraphSchema,
  type Node,
  type Relationship,
  type RelationshipPattern,
  type Property,
  type GremlinQueryResult,
  type GremlinConfig,
  type SchemaMetadata,
  GraphSchemaSchema,
  GremlinQueryResultSchema,
} from './models.js';
import { parseGremlinResultsWithMetadata } from '../utils/result-parser.js';

// Gremlin type aliases
type GremlinClientType = driver.Client;
type GremlinConnection = driver.DriverRemoteConnection;
type GraphTraversalSource = process.GraphTraversalSource;
const __ = gremlin.process.statics;

/**
 * Exception class for Gremlin-related errors.
 */
export interface GremlinExceptionOptions {
  message: string;
  details?: unknown;
  cause?: Error;
}

export class GremlinException extends Error {
  public readonly details: unknown;

  constructor(options: string | GremlinExceptionOptions) {
    if (typeof options === 'string') {
      super(options);
      this.details = undefined;
    } else {
      super(options.message, { cause: options.cause });
      this.details = options.details;
    }

    this.name = 'GremlinException';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GremlinException);
    }
  }

  toJSON(): { message: string; details: unknown; stack?: string } {
    return {
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Gremlin client for graph operations.
 * Compatible with any Gremlin-enabled graph database.
 */
export class GremlinClient {
  private readonly host: string;
  private readonly port: number;
  private readonly traversalSource: string;
  private readonly useSSL: boolean;
  private readonly connectionUrl: string;
  private readonly username: string | undefined;
  private readonly password: string | undefined;
  private readonly idleTimeoutMs: number;
  private readonly enumDiscoveryEnabled: boolean;
  private readonly enumCardinalityThreshold: number;
  private readonly enumPropertyBlacklist: string[];
  private readonly includeSampleValues: boolean;
  private readonly maxEnumValues: number;
  private readonly includeCounts: boolean;
  private idleTimeout: NodeJS.Timeout | undefined;

  private client?: GremlinClientType;
  private connection?: GremlinConnection;
  private g?: GraphTraversalSource;
  private schema?: GraphSchema;
  private schemaLastUpdated?: Date;
  private readonly schemaCacheTimeoutMs: number; // 5 minutes

  /**
   * Create a new Gremlin client instance.
   */
  constructor(config: GremlinConfig) {
    this.host = config.host;
    this.port = config.port;
    this.traversalSource = config.traversalSource;
    this.useSSL = config.useSSL;
    this.username = config.username;
    this.password = config.password;
    this.idleTimeoutMs = config.idleTimeoutSeconds * 1000;
    this.enumDiscoveryEnabled = config.enumDiscoveryEnabled ?? true;
    this.enumCardinalityThreshold = config.enumCardinalityThreshold ?? 10;
    this.enumPropertyBlacklist = config.enumPropertyBlacklist ?? [];
    this.includeSampleValues = config.includeSampleValues ?? false;
    this.maxEnumValues = config.maxEnumValues ?? 10;
    this.includeCounts = config.includeCounts ?? true;
    this.schemaCacheTimeoutMs = 5 * 60 * 1000; // 5 minutes

    const protocol = this.useSSL ? 'wss' : 'ws';
    this.connectionUrl = `${protocol}://${this.host}:${this.port}/gremlin`;
  }

  /**
   * Initialize the client connections and schema.
   */
  async initialize(): Promise<void> {
    try {
      await this.initConnection();
      await this.refreshSchema();
    } catch (error) {
      logger.error('Could not initialize Gremlin connection', { error });
      await this.close();
      throw new GremlinException({
        message: 'Could not initialize Gremlin connection',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Ensure the connection is active before performing an operation.
   * Re-initializes the connection if it has been closed due to inactivity.
   */
  private async ensureConnection(): Promise<void> {
    if (!this.client || !this.connection || !this.g) {
      logger.info('Connection is not active. Re-initializing...');
      await this.initialize();
    }
    this.resetIdleTimeout();
  }

  /**
   * Resets the idle timeout timer.
   */
  private resetIdleTimeout(): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      logger.info(
        `Gremlin connection has been idle for ${this.idleTimeoutMs / 1000} seconds. Closing.`
      );
      this.close();
    }, this.idleTimeoutMs);
  }

  /**
   * Initialize the connection with retry logic.
   */
  private async initConnection(): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create authentication config if credentials are provided
        const authConfig =
          this.username && this.password
            ? { auth: { username: this.username, password: this.password } }
            : {};

        // Create both client (for string queries) and remote connection (for traversals)
        this.client = new Client(this.connectionUrl, {
          traversalSource: this.traversalSource,
          ...authConfig,
        });

        this.connection = new DriverRemoteConnection(this.connectionUrl, {
          traversalSource: this.traversalSource,
          ...authConfig,
        });

        this.g = gremlin.process.AnonymousTraversalSource.traversal().withRemote(this.connection);

        // Test the connection
        await this.g.V().limit(1).count().next();

        logger.debug(`Gremlin connection established to ${this.connectionUrl}`);
        this.resetIdleTimeout();
        return;
      } catch (error) {
        logger.warn(`Connection attempt ${attempt}/${maxRetries} failed`, { error });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Refresh the graph schema with detailed property information.
   */
  private async refreshSchema(): Promise<void> {
    try {
      logger.debug('Refreshing Gremlin schema with optimization settings', {
        includeSampleValues: this.includeSampleValues,
        maxEnumValues: this.maxEnumValues,
        includeCounts: this.includeCounts,
      });
      await this.ensureConnection();

      // Get labels and their counts
      const [vertexLabels, edgeLabels] = await Promise.all([
        this.g!.V().label().dedup().toList(),
        this.g!.E().label().dedup().toList(),
      ]);

      // Get vertex and edge counts by label (if enabled)
      let vertexCountMap = new Map<string, number>();
      let edgeCountMap = new Map<string, number>();

      if (this.includeCounts) {
        const [vertexCounts, edgeCounts] = await Promise.all([
          this.g!.V().groupCount().by(__.label()).next(),
          this.g!.E().groupCount().by(__.label()).next(),
        ]);
        vertexCountMap = new Map(Object.entries(vertexCounts.value || {}));
        edgeCountMap = new Map(Object.entries(edgeCounts.value || {}));
      }

      // Build detailed node schema with properties
      const nodes: Node[] = [];
      for (const label of vertexLabels as string[]) {
        try {
          const properties = await this.getVertexProperties(label);
          nodes.push({
            labels: label,
            properties,
            count: this.includeCounts ? (vertexCountMap.get(label) as number) || 0 : undefined,
          });
        } catch (error) {
          logger.warn(`Could not get properties for vertex label ${label}`, { error });
          nodes.push({
            labels: label,
            properties: [],
            count: this.includeCounts ? (vertexCountMap.get(label) as number) || 0 : undefined,
          });
        }
      }

      // Build detailed relationship schema with properties
      const relationships: Relationship[] = [];
      for (const label of edgeLabels as string[]) {
        try {
          const properties = await this.getEdgeProperties(label);
          relationships.push({
            type: label,
            properties,
            count: this.includeCounts ? (edgeCountMap.get(label) as number) || 0 : undefined,
          });
        } catch (error) {
          logger.warn(`Could not get properties for edge label ${label}`, { error });
          relationships.push({
            type: label,
            properties: [],
            count: this.includeCounts ? (edgeCountMap.get(label) as number) || 0 : undefined,
          });
        }
      }

      // Get relationship patterns
      const patterns: RelationshipPattern[] = [];
      const patternCountMap = new Map<string, number>();

      for (const edgeLabel of edgeLabels as string[]) {
        try {
          // First, get all unique patterns for this edge label by using project and dedup
          // without limiting first, to ensure we discover all possible connection patterns
          const results = await this.g!.E()
            .hasLabel(edgeLabel)
            .project('from_label', 'edge_label', 'to_label')
            .by(__.outV().label())
            .by(__.label())
            .by(__.inV().label())
            .dedup()
            .limit(100) // Apply limit after dedup to get up to 100 unique patterns per edge label
            .toList();

          for (const result of results) {
            if (isGremlinResult(result)) {
              const pattern = {
                left_node: result.get('from_label') as string,
                relation: result.get('edge_label') as string,
                right_node: result.get('to_label') as string,
              };
              patterns.push(pattern);

              // Count pattern occurrences if counts are enabled
              if (this.includeCounts) {
                const patternKey = `${pattern.left_node}-${pattern.relation}-${pattern.right_node}`;
                patternCountMap.set(patternKey, (patternCountMap.get(patternKey) || 0) + 1);
              }
            }
          }
        } catch (error) {
          logger.warn(`Could not get patterns for ${edgeLabel}`, { error });
        }
      }

      // Generate schema metadata
      const metadata: SchemaMetadata = {
        node_count: nodes.length,
        relationship_count: relationships.length,
        pattern_count: patterns.length,
        optimization_settings: {
          sample_values_included: this.includeSampleValues,
          max_enum_values: this.maxEnumValues,
          counts_included: this.includeCounts,
          enum_cardinality_threshold: this.enumCardinalityThreshold,
        },
        generated_at: new Date().toISOString(),
      };

      const schemaData = {
        nodes,
        relationships,
        relationship_patterns: patterns,
        metadata,
      };

      // Calculate schema size after generation
      const schemaJson = JSON.stringify(schemaData);
      metadata.schema_size_bytes = Buffer.byteLength(schemaJson, 'utf8');

      // Validate schema with Zod
      this.schema = GraphSchemaSchema.parse(schemaData);
      this.schemaLastUpdated = new Date();

      logger.debug(
        `Schema refreshed: ${nodes.length} node types, ${relationships.length} relationship types, ${patterns.length} patterns`,
        {
          sizeBytes: metadata.schema_size_bytes,
          optimizationSettings: metadata.optimization_settings,
        }
      );
    } catch (error) {
      throw new GremlinException({
        message: 'Failed to refresh Gremlin schema',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get detailed property information for a vertex label.
   */
  private async getVertexProperties(label: string): Promise<Property[]> {
    try {
      // Get a sample of vertices to analyze properties
      const sampleVertices = await this.g!.V().hasLabel(label).limit(10).valueMap(true).toList();

      const propertyMap = new Map<
        string,
        {
          types: Set<string>;
          sampleValues: unknown[];
          cardinality: 'single' | 'list' | 'set';
          enumValues?: unknown[];
        }
      >();

      // Analyze sample vertices to determine property schema
      for (const vertex of sampleVertices) {
        if (isGremlinResult(vertex)) {
          const props = vertex as Map<string, unknown>;
          for (const [key, value] of props.entries()) {
            // Convert key to string if it's not already
            const keyString = typeof key === 'string' ? key : String(key);
            if (keyString === 'id' || keyString === 'label') continue; // Skip system properties

            if (!propertyMap.has(keyString)) {
              propertyMap.set(keyString, {
                types: new Set(),
                sampleValues: [],
                cardinality: 'single',
              });
            }

            const propInfo = propertyMap.get(keyString)!;

            // Determine type and cardinality
            if (Array.isArray(value)) {
              propInfo.cardinality = 'list';
              for (const item of value) {
                propInfo.types.add(typeof item);
                propInfo.sampleValues.push(item);
              }
            } else {
              propInfo.types.add(typeof value);
              propInfo.sampleValues.push(value);
            }
          }
        }
      }

      // If enum discovery is enabled, check for low cardinality properties
      if (this.enumDiscoveryEnabled) {
        for (const [propName, propInfo] of propertyMap.entries()) {
          if (!this.enumPropertyBlacklist.includes(propName)) {
            try {
              const distinctValues = await this.g!.V()
                .hasLabel(label)
                .values(propName)
                .dedup()
                .limit(this.enumCardinalityThreshold + 1)
                .toList();

              if (distinctValues.length <= this.enumCardinalityThreshold) {
                propInfo.enumValues = distinctValues;
              }
            } catch (error) {
              // If we can't get distinct values, just skip enum discovery for this property
              logger.debug(`Could not get distinct values for property ${propName}`, { error });
            }
          }
        }
      }

      // Convert to Property objects
      const properties: Property[] = [];
      for (const [name, info] of propertyMap.entries()) {
        const property: Property = {
          name,
          type: Array.from(info.types),
          cardinality: info.cardinality,
        };

        // Include sample values only if enabled
        if (this.includeSampleValues) {
          property.sample_values = info.sampleValues.slice(0, 3); // Keep only first 3 samples
        }

        // Include enum values if available, limited by maxEnumValues
        if (info.enumValues) {
          property.enum = info.enumValues.slice(0, this.maxEnumValues);
        }

        properties.push(property);
      }

      return properties;
    } catch (error) {
      logger.warn(`Failed to get properties for vertex label ${label}`, { error });
      return [];
    }
  }

  /**
   * Get detailed property information for an edge label.
   */
  private async getEdgeProperties(label: string): Promise<Property[]> {
    try {
      // Get a sample of edges to analyze properties
      const sampleEdges = await this.g!.E().hasLabel(label).limit(10).valueMap(true).toList();

      const propertyMap = new Map<
        string,
        {
          types: Set<string>;
          sampleValues: unknown[];
          cardinality: 'single' | 'list' | 'set';
          enumValues?: unknown[];
        }
      >();

      // Analyze sample edges to determine property schema
      for (const edge of sampleEdges) {
        if (isGremlinResult(edge)) {
          const props = edge as Map<string, unknown>;
          for (const [key, value] of props.entries()) {
            // Convert key to string if it's not already
            const keyString = typeof key === 'string' ? key : String(key);
            if (keyString === 'id' || keyString === 'label') continue; // Skip system properties

            if (!propertyMap.has(keyString)) {
              propertyMap.set(keyString, {
                types: new Set(),
                sampleValues: [],
                cardinality: 'single',
              });
            }

            const propInfo = propertyMap.get(keyString)!;

            // Determine type and cardinality
            if (Array.isArray(value)) {
              propInfo.cardinality = 'list';
              for (const item of value) {
                propInfo.types.add(typeof item);
                propInfo.sampleValues.push(item);
              }
            } else {
              propInfo.types.add(typeof value);
              propInfo.sampleValues.push(value);
            }
          }
        }
      }

      // If enum discovery is enabled, check for low cardinality properties
      if (this.enumDiscoveryEnabled) {
        for (const [propName, propInfo] of propertyMap.entries()) {
          if (!this.enumPropertyBlacklist.includes(propName)) {
            try {
              const distinctValues = await this.g!.E()
                .hasLabel(label)
                .values(propName)
                .dedup()
                .limit(this.enumCardinalityThreshold + 1)
                .toList();

              if (distinctValues.length <= this.enumCardinalityThreshold) {
                propInfo.enumValues = distinctValues;
              }
            } catch (error) {
              // If we can't get distinct values, just skip enum discovery for this property
              logger.debug(`Could not get distinct values for property ${propName}`, { error });
            }
          }
        }
      }

      // Convert to Property objects
      const properties: Property[] = [];
      for (const [name, info] of propertyMap.entries()) {
        const property: Property = {
          name,
          type: Array.from(info.types),
          cardinality: info.cardinality,
        };

        // Include sample values only if enabled
        if (this.includeSampleValues) {
          property.sample_values = info.sampleValues.slice(0, 3); // Keep only first 3 samples
        }

        // Include enum values if available, limited by maxEnumValues
        if (info.enumValues) {
          property.enum = info.enumValues.slice(0, this.maxEnumValues);
        }

        properties.push(property);
      }

      return properties;
    } catch (error) {
      logger.warn(`Failed to get properties for edge label ${label}`, { error });
      return [];
    }
  }

  /**
   * Check if schema cache is still valid.
   */
  private isSchemaFresh(): boolean {
    if (!this.schema || !this.schemaLastUpdated) {
      return false;
    }

    const now = new Date();
    const timeSinceUpdate = now.getTime() - this.schemaLastUpdated.getTime();
    return timeSinceUpdate < this.schemaCacheTimeoutMs;
  }

  /**
   * Return the cached graph schema, refreshing if necessary.
   */
  async getSchema(): Promise<GraphSchema> {
    await this.ensureConnection();
    // Check if we need to refresh the schema
    if (!this.isSchemaFresh()) {
      try {
        await this.refreshSchema();
      } catch (error) {
        // If refresh fails but we have a cached schema, use it
        if (this.schema) {
          logger.warn('Schema refresh failed, using cached schema', { error });
          return this.schema;
        }

        throw new GremlinException({
          message: 'Schema not available',
          details: `Could not load schema: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return this.schema!;
  }

  /**
   * Force refresh the schema cache.
   */
  async refreshSchemaCache(): Promise<void> {
    await this.refreshSchema();
  }

  /**
   * Check the status of the Gremlin connection.
   */
  async getStatus(): Promise<string> {
    try {
      if (this.g) {
        await this.ensureConnection();
        await this.g.V().limit(1).count().next();
        return STATUS_MESSAGES.AVAILABLE;
      } else {
        return STATUS_MESSAGES.NOT_CONNECTED;
      }
    } catch (error) {
      logger.warn('Gremlin status check failed', { error });
      return STATUS_MESSAGES.CONNECTION_ERROR;
    }
  }

  /**
   * Perform a comprehensive health check of the connection.
   */
  async healthCheck(): Promise<{ healthy: boolean; details: string }> {
    try {
      await this.ensureConnection();
      if (!this.g || !this.client) {
        return { healthy: false, details: 'Client not initialized' };
      }

      // Test traversal connection
      await this.g.V().limit(1).count().next();

      // Test client connection
      await this.client.submit('g.V().limit(1).count()');

      return { healthy: true, details: 'All connections healthy' };
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      return { healthy: false, details };
    }
  }

  /**
   * Execute a Gremlin query string.
   */
  async executeGremlinQuery(query: string): Promise<GremlinQueryResult> {
    try {
      logger.debug('Executing Gremlin query', { query });
      await this.ensureConnection();

      if (!this.client) {
        throw new GremlinException({
          message: 'Client not initialized',
          details: 'Gremlin client must be initialized before executing queries',
        });
      }

      const resultSet = await this.client.submit(query);
      const rawResults: unknown[] = [];

      // Convert result set to array
      for await (const result of resultSet) {
        rawResults.push(result);
      }

      // Log raw results for debugging
      logger.debug('Raw Gremlin query results', {
        query,
        rawResultsCount: rawResults.length,
        rawResults: rawResults.slice(0, 3), // Log first 3 raw results for debugging
      });

      // Parse results using idiomatic result parser
      const { results: processedResults, metadata } = parseGremlinResultsWithMetadata(rawResults);

      // Log processed results and metadata for debugging
      logger.debug('Processed Gremlin query results', {
        query,
        metadata,
        processedResults: processedResults.slice(0, 3), // Log first 3 processed results
      });

      const resultData = {
        results: processedResults,
        message: `Query executed successfully. Returned ${processedResults.length} results.`,
      };

      // Validate result with Zod
      return GremlinQueryResultSchema.parse(resultData);
    } catch (error) {
      logger.error('Gremlin query failed', { query, error });

      const errorMessage = error instanceof Error ? error.message : String(error);
      const failureResult = {
        results: [],
        message: `Query failed: ${errorMessage}`,
      };

      return GremlinQueryResultSchema.parse(failureResult);
    }
  }

  /**
   * Close the connection.
   */
  async close(): Promise<void> {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = undefined;
    }
    try {
      if (this.client) {
        await this.client.close();
        this.client = undefined;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = undefined;
      }
      this.g = undefined;
      logger.info('Gremlin connections closed');
    } catch (error) {
      logger.warn('Error closing Gremlin connections', { error });
    }
  }
}

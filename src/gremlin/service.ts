/**
 * Effect-based Gremlin Service for graph operations.
 * Uses modern Effect.ts patterns for service definition and dependency injection.
 * Refactored into modular components for better maintainability.
 */

import { Effect, Ref, Option, Context, Layer } from 'effect';
import { type GraphSchema, type GremlinQueryResult, GremlinQueryResultSchema } from './models.js';
import { parseGremlinResultsWithMetadata } from '../utils/result-parser.js';
import { isGremlinResult } from '../utils/type-guards.js';
import { GremlinConnectionError, GremlinQueryError, Errors } from '../errors.js';
import type { AppConfigType } from '../config.js';

// Import proper types from gremlin package
import type { driver } from 'gremlin';
type GremlinClient = driver.Client;
type GremlinResultSet = driver.ResultSet;
import type { ConnectionState } from './types.js';
import { ensureConnection, getConnectionStatus } from './connection.js';
import {
  createSchemaCache,
  getCachedSchema,
  peekCachedSchema,
  refreshSchemaCache,
} from './schema-cache.js';
import { generateGraphSchema, DEFAULT_SCHEMA_CONFIG } from './schema-generator.js';

/**
 * Gremlin Service interface using modern Effect.Service pattern
 */
export interface GremlinService {
  readonly getStatus: Effect.Effect<string, GremlinConnectionError>;
  readonly getSchema: Effect.Effect<GraphSchema, GremlinConnectionError>;
  readonly getCachedSchema: Effect.Effect<GraphSchema | null, never>;
  readonly refreshSchemaCache: Effect.Effect<void, GremlinConnectionError>;
  readonly executeQuery: (
    query: string
  ) => Effect.Effect<GremlinQueryResult, GremlinQueryError | GremlinConnectionError>;
  readonly healthCheck: Effect.Effect<
    { healthy: boolean; details: string },
    GremlinConnectionError
  >;
}

/**
 * Gremlin Service tag using Context.GenericTag for better type inference
 */
export const GremlinService = Context.GenericTag<GremlinService>('GremlinService');

/**
 * Implementation of the Gremlin Service using extracted modules
 */
const makeGremlinService = (config: AppConfigType): Effect.Effect<GremlinService> =>
  Effect.gen(function* () {
    // Initialize connection state
    const connectionRef = yield* Ref.make<Option.Option<ConnectionState>>(Option.none());

    // Initialize schema cache
    const schemaCacheRef = yield* createSchemaCache();

    // Create schema generation effect with connection dependency
    const generateSchema = Effect.gen(function* () {
      const connectionState = yield* ensureConnection(connectionRef, config);
      return yield* generateGraphSchema(connectionState, DEFAULT_SCHEMA_CONFIG);
    });

    /**
     * Execute raw query against Gremlin client
     */
    const executeRawQuery = (
      query: string,
      client: GremlinClient
    ): Effect.Effect<unknown, GremlinQueryError> =>
      Effect.tryPromise({
        try: () => client.submit(query),
        catch: (error: unknown) => Errors.query('Query execution failed', query, error),
      });

    /**
     * Process ResultSet into array format
     */
    const processResultSet = (resultSet: unknown): unknown[] => {
      // Handle ResultSet objects (with _items property)
      if (resultSet && typeof resultSet === 'object' && '_items' in resultSet) {
        return (resultSet as unknown as GremlinResultSet).toArray();
      }
      // Handle objects with toArray method
      if (resultSet && typeof resultSet === 'object' && 'toArray' in resultSet) {
        return (resultSet as GremlinResultSet).toArray();
      }
      // Handle direct arrays
      if (Array.isArray(resultSet)) {
        return resultSet;
      }
      // Handle single values
      return resultSet !== undefined ? [resultSet] : [];
    };

    /**
     * Transform raw result set into parsed format
     */
    const transformGremlinResult = (
      query: string,
      resultSet: unknown
    ): Effect.Effect<{ results: unknown[]; message: string }, GremlinQueryError> =>
      Effect.tryPromise({
        try: () => {
          const dataArray = processResultSet(resultSet);
          const parsed = parseGremlinResultsWithMetadata(dataArray);
          return Promise.resolve({
            results: parsed.results,
            message: 'Query executed successfully',
          });
        },
        catch: (error: unknown) => Errors.query('Result parsing failed', query, error),
      });

    /**
     * Validate query result against schema
     */
    const validateQueryResult = (
      query: string,
      result: unknown
    ): Effect.Effect<GremlinQueryResult, GremlinQueryError> =>
      Effect.tryPromise({
        try: () => Promise.resolve(GremlinQueryResultSchema.parse(result)),
        catch: (error: unknown) => Errors.query('Result validation failed', query, error),
      });

    /**
     * Execute Gremlin query with enhanced error handling and recovery
     */
    const executeQuery = (
      query: string
    ): Effect.Effect<GremlinQueryResult, GremlinQueryError | GremlinConnectionError> =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Executing Gremlin query: ${query}`);
        const state = yield* ensureConnection(connectionRef, config);

        if (!state.client) {
          return yield* Effect.fail(Errors.query('Client not initialized', query));
        }

        const resultSet = yield* executeRawQuery(query, state.client);

        if (!isGremlinResult(resultSet)) {
          return yield* Effect.fail(
            Errors.query('Invalid result format received', query, resultSet)
          );
        }

        const parsedResults = yield* transformGremlinResult(query, resultSet);
        const validatedResult = yield* validateQueryResult(query, parsedResults);

        return validatedResult;
      }).pipe(
        // Add error logging for debugging
        Effect.tapError((error: any) =>
          Effect.logError(`Query execution failed: ${error?.message || String(error)}`, {
            query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
            errorType: error?._tag || 'Unknown',
          })
        )
      );

    /**
     * Health check with proper Effect error handling
     */
    const healthCheck = getConnectionStatus(connectionRef, config).pipe(
      Effect.map(status => ({
        healthy: status === 'Available',
        details: status,
      })),
      Effect.catchAll(() =>
        Effect.succeed({
          healthy: false,
          details: 'Health check failed',
        })
      )
    );

    return {
      getStatus: getConnectionStatus(connectionRef, config).pipe(
        Effect.tapError((error: any) =>
          Effect.logError(`Connection status check failed: ${error?.message || String(error)}`, {
            endpoint: config.gremlin.host + ':' + config.gremlin.port,
          })
        )
      ),
      getSchema: getCachedSchema(schemaCacheRef, generateSchema).pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            nodes: [],
            relationships: [],
            relationship_patterns: [],
            metadata: {
              node_count: 0,
              relationship_count: 0,
              pattern_count: 0,
              optimization_settings: {
                sample_values_included: false,
                max_enum_values: 0,
                counts_included: false,
                enum_cardinality_threshold: 0,
              },
              generated_at: new Date().toISOString(),
            },
          })
        )
      ),
      getCachedSchema: peekCachedSchema(schemaCacheRef),
      refreshSchemaCache: refreshSchemaCache(schemaCacheRef, generateSchema).pipe(
        Effect.tapError((error: any) =>
          Effect.logError(`Schema cache refresh failed: ${error?.message || String(error)}`)
        )
      ),
      executeQuery,
      healthCheck,
    } as const;
  });

/**
 * Layer for creating the Gremlin Service using modern Effect.Service pattern
 */
export const GremlinServiceLive = (config: AppConfigType) =>
  Layer.effect(GremlinService, makeGremlinService(config));

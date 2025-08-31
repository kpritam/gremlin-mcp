import { Effect, Context, Layer } from 'effect';
import { generateGraphSchema, DEFAULT_SCHEMA_CONFIG } from './schema-generator.js';
import {
  createSchemaCache,
  getCachedSchema,
  invalidateSchemaCache,
  peekCachedSchema,
  refreshSchemaCache,
} from './schema-cache.js';
import type { GraphSchema } from './models/index.js';
import { GremlinClient } from './client.js';
import { AppConfig } from '../config.js';
import type { GremlinConnectionError, GremlinQueryError } from '../errors.js';

// Define the service interface and create a tag
export class SchemaService extends Context.Tag('SchemaService')<
  SchemaService,
  {
    readonly getSchema: Effect.Effect<GraphSchema, GremlinConnectionError | GremlinQueryError>;
    readonly peekSchema: Effect.Effect<GraphSchema | null, never>;
    readonly invalidateSchema: Effect.Effect<void, never>;
    readonly refreshSchema: Effect.Effect<void, GremlinConnectionError | GremlinQueryError>;
  }
>() {}

// Implement the live layer
export const SchemaServiceLive = Layer.effect(
  SchemaService,
  Effect.gen(function* () {
    const gremlinClient = yield* GremlinClient;
    const config = yield* AppConfig;
    const cacheRef = yield* createSchemaCache();

    const generateSchemaEffect = generateGraphSchema(gremlinClient, {
      ...DEFAULT_SCHEMA_CONFIG,
      includeCounts: config.schema.includeCounts,
      includeSampleValues: config.schema.includeSampleValues,
    });

    const getSchema = getCachedSchema(cacheRef, generateSchemaEffect);
    const peekSchema = peekCachedSchema(cacheRef);
    const invalidateSchema = invalidateSchemaCache(cacheRef);
    const refreshSchema = Effect.asVoid(refreshSchemaCache(cacheRef, generateSchemaEffect));

    return SchemaService.of({
      getSchema,
      peekSchema,
      invalidateSchema,
      refreshSchema,
    });
  })
);

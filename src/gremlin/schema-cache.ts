/**
 * Schema caching with Effect.ts patterns and intelligent TTL management
 */

import { Effect, Ref, Option, Duration } from 'effect';
import type { GraphSchema } from './models.js';
import type { SchemaCacheEntry } from './types.js';

// Constants
const SCHEMA_CACHE_TTL = Duration.minutes(5);

/**
 * Create schema cache with manual invalidation support
 */
export const createSchemaCache = () => Ref.make<Option.Option<SchemaCacheEntry>>(Option.none());

/**
 * Helper to check if cache entry is still valid
 */
export const isCacheValid = (cacheEntry: SchemaCacheEntry): boolean => {
  const now = Date.now();
  const ttlMs = Duration.toMillis(SCHEMA_CACHE_TTL);
  return now - cacheEntry.timestamp < ttlMs;
};

/**
 * Get schema from cache with intelligent cache validation
 */
export const getCachedSchema = (
  cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>,
  generateSchema: Effect.Effect<GraphSchema, any>
) =>
  Effect.gen(function* () {
    const cacheEntry = yield* Ref.get(cacheRef);

    // Check if we have a valid cached schema
    const validCachedSchema = Option.flatMap(cacheEntry, entry =>
      isCacheValid(entry) ? Option.some(entry.schema) : Option.none()
    );

    if (Option.isSome(validCachedSchema)) {
      yield* Effect.logDebug('Using cached schema');
      return Option.getOrThrow(validCachedSchema);
    }

    // Generate fresh schema and cache it
    yield* Effect.logInfo('Generating fresh schema');
    const schema = yield* generateSchema;

    yield* Ref.set(
      cacheRef,
      Option.some({
        schema,
        timestamp: Date.now(),
      })
    );

    return schema;
  });

/**
 * Get cached schema without generating new one
 */
export const peekCachedSchema = (cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>) =>
  Effect.gen(function* () {
    const cacheEntry = yield* Ref.get(cacheRef);
    return Option.match(cacheEntry, {
      onNone: () => null,
      onSome: entry => entry.schema,
    });
  });

/**
 * Invalidate schema cache
 */
export const invalidateSchemaCache = (cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Invalidating schema cache');
    yield* Ref.set(cacheRef, Option.none());
  });

/**
 * Refresh schema cache by invalidating and regenerating
 */
export const refreshSchemaCache = (
  cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>,
  generateSchema: Effect.Effect<GraphSchema, any>
) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Refreshing schema cache');
    yield* invalidateSchemaCache(cacheRef);
    yield* getCachedSchema(cacheRef, generateSchema);
  });

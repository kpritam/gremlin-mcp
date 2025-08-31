/**
 * @fileoverview Schema caching with Effect.ts patterns and intelligent TTL management.
 *
 * This module provides a set of functions for creating and managing a schema cache.
 * It uses `Effect.Ref` for concurrent state management and `Effect.Duration` for
 * time-to-live (TTL) based cache validation. The cache can be manually invalidated
 * or automatically refreshed.
 */

import { Effect, Ref, Option, Duration } from 'effect';
import type { GraphSchema } from './models/index.js';
import type { SchemaCacheEntry } from './types.js';
import type { GremlinConnectionError, GremlinQueryError } from '../errors.js';

const SCHEMA_CACHE_TTL = Duration.minutes(5);

/**
 * Creates a new schema cache as a `Ref`.
 *
 * The cache is initialized as `Option.none()`, indicating that it is empty.
 *
 * @returns An `Effect` that resolves to a `Ref` containing an `Option<SchemaCacheEntry>`.
 */
export const createSchemaCache = () => Ref.make<Option.Option<SchemaCacheEntry>>(Option.none());

/**
 * Internal helper to check if cache entry is valid (not exported)
 */
const isCacheValid = (cacheEntry: SchemaCacheEntry): boolean => {
  const now = Date.now();
  const ttlMs = Duration.toMillis(SCHEMA_CACHE_TTL);
  return now - cacheEntry.timestamp < ttlMs;
};

/**
 * Retrieves the schema from the cache.
 *
 * If the cache contains a valid entry, it is returned. Otherwise, a new schema
 * is generated using the provided `generateSchema` effect, and the cache is updated.
 *
 * @param cacheRef A `Ref` to the schema cache.
 * @param generateSchema An `Effect` that generates a new `GraphSchema`.
 * @returns An `Effect` that resolves to the `GraphSchema` or fails with an error.
 */
export const getCachedSchema = (
  cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>,
  generateSchema: Effect.Effect<GraphSchema, GremlinConnectionError | GremlinQueryError>
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
 * Retrieves the cached schema without generating a new one if it's missing or invalid.
 *
 * @param cacheRef A `Ref` to the schema cache.
 * @returns An `Effect` that resolves to the `GraphSchema` or `null` if the cache is empty.
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
 * Invalidates the schema cache by setting it to `Option.none()`.
 *
 * @param cacheRef A `Ref` to the schema cache.
 * @returns An `Effect` that completes when the cache is invalidated.
 */
export const invalidateSchemaCache = (cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Invalidating schema cache');
    yield* Ref.set(cacheRef, Option.none());
  });

/**
 * Refreshes the schema cache by invalidating it and then regenerating the schema.
 *
 * @param cacheRef A `Ref` to the schema cache.
 * @param generateSchema An `Effect` that generates a new `GraphSchema`.
 * @returns An `Effect` that completes when the cache is refreshed.
 */
export const refreshSchemaCache = (
  cacheRef: Ref.Ref<Option.Option<SchemaCacheEntry>>,
  generateSchema: Effect.Effect<GraphSchema, GremlinConnectionError | GremlinQueryError>
) =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Refreshing schema cache');
    yield* invalidateSchemaCache(cacheRef);
    yield* getCachedSchema(cacheRef, generateSchema);
  });

/**
 * Enhanced Gremlin connection management with Effect.ts resource patterns.
 * Uses Effect.acquireUseRelease and Scope for proper resource lifecycle management.
 */

import { Effect, Ref, Option, Scope } from 'effect';
import gremlin from 'gremlin';
import { GremlinConnectionError, Errors } from '../errors.js';
import type { AppConfigType } from '../config.js';
import type { ConnectionState } from './types.js';

const { Client, DriverRemoteConnection } = gremlin.driver;

/**
 * Create Gremlin connection as a scoped resource with automatic cleanup
 */
export const createScopedConnection = (
  config: AppConfigType
): Effect.Effect<ConnectionState, GremlinConnectionError, Scope.Scope> =>
  Effect.acquireUseRelease(
    // Acquire: Create the connection
    Effect.gen(function* () {
      yield* Effect.logInfo('Acquiring Gremlin connection', {
        host: config.gremlin.host,
        port: config.gremlin.port,
        ssl: config.gremlin.useSSL,
      });

      const protocol = config.gremlin.useSSL ? 'wss' : 'ws';
      const connectionUrl = `${protocol}://${config.gremlin.host}:${config.gremlin.port}/gremlin`;

      // Create authentication config if credentials are provided
      const authConfig =
        Option.isSome(config.gremlin.username) && Option.isSome(config.gremlin.password)
          ? {
              auth: {
                username: Option.getOrThrow(config.gremlin.username),
                password: Option.getOrThrow(config.gremlin.password),
              },
            }
          : {};

      // Configure client with logging to stderr
      const clientConfig = {
        traversalSource: config.gremlin.traversalSource,
        headers: {},
        ...authConfig,
        log: {
          level: config.logging?.level || 'info',
          stream: process.stderr,
        },
      };

      const client = yield* Effect.tryPromise({
        try: () => Promise.resolve(new Client(connectionUrl, clientConfig)),
        catch: error => Errors.connection('Failed to create Gremlin client', { error }),
      });

      // Configure remote connection with logging to stderr
      const connectionConfig = {
        traversalSource: config.gremlin.traversalSource,
        headers: {},
        ...authConfig,
        log: {
          level: config.logging?.level || 'info',
          stream: process.stderr,
        },
      };

      const connection = yield* Effect.tryPromise({
        try: () => Promise.resolve(new DriverRemoteConnection(connectionUrl, connectionConfig)),
        catch: error => Errors.connection('Failed to create remote connection', { error }),
      });

      const g = gremlin.process.AnonymousTraversalSource.traversal().withRemote(connection);

      // Test the connection
      yield* Effect.tryPromise({
        try: () => g.V().limit(1).count().next(),
        catch: (error: unknown) => Errors.connection('Connection test failed', { error }),
      });

      const state: ConnectionState = {
        client,
        connection,
        g,
        lastUsed: Date.now(),
      };

      yield* Effect.logInfo('✅ Gremlin connection acquired successfully');
      return state;
    }),

    // Use: Return the connection state
    state => Effect.succeed(state),

    // Release: Clean up the connection
    state =>
      Effect.gen(function* () {
        yield* Effect.logInfo('Releasing Gremlin connection');

        if (state.connection) {
          yield* Effect.tryPromise({
            try: () => state.connection!.close(),
            catch: error =>
              Errors.connection('Failed to close Gremlin connection during release', {
                error,
              }),
          }).pipe(
            Effect.catchAll(error =>
              Effect.logWarning(`Error during connection release: ${error.message}`)
            )
          );
        }

        yield* Effect.logInfo('Gremlin connection released successfully');
      })
  );

/**
 * Create connection with automatic resource management
 */
export const createConnection = (
  config: AppConfigType
): Effect.Effect<ConnectionState, GremlinConnectionError> =>
  Effect.scoped(createScopedConnection(config));

/**
 * Connection pool manager with scoped resource management
 */
export const createConnectionPool = (): Effect.Effect<
  Ref.Ref<Option.Option<ConnectionState>>,
  never,
  Scope.Scope
> =>
  Effect.gen(function* () {
    const connectionRef = yield* Ref.make<Option.Option<ConnectionState>>(Option.none());

    // Add cleanup finalizer to the scope
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        yield* Effect.logInfo('Cleaning up connection pool');
        const optionalState = yield* Ref.get(connectionRef);

        yield* Option.match(optionalState, {
          onNone: () => Effect.logDebug('No connection to close in pool cleanup'),
          onSome: state =>
            Effect.gen(function* () {
              if (state.connection) {
                yield* Effect.tryPromise({
                  try: () => state.connection!.close(),
                  catch: error =>
                    Errors.connection('Failed to close Gremlin connection during pool cleanup', {
                      error,
                    }),
                }).pipe(
                  Effect.catchAll(error =>
                    Effect.logWarning(`Error during pool cleanup: ${error.message}`)
                  )
                );
              }
              yield* Effect.logInfo('Connection pool cleaned up successfully');
            }),
        });

        yield* Ref.set(connectionRef, Option.none());
      })
    );

    return connectionRef;
  });

/**
 * Close connections immediately (for manual cleanup when needed)
 */
const closeConnections = (connectionRef: Ref.Ref<Option.Option<ConnectionState>>) =>
  Effect.gen(function* () {
    const optionalState = yield* Ref.get(connectionRef);

    yield* Option.match(optionalState, {
      onNone: () => Effect.logDebug('No connection to close'),
      onSome: state =>
        Effect.gen(function* () {
          if (state.connection) {
            yield* Effect.tryPromise({
              try: () => state.connection!.close(),
              catch: error => Errors.connection('Failed to close Gremlin connection', { error }),
            }).pipe(
              Effect.catchAll(error =>
                Effect.logWarning(`Error closing Gremlin connections: ${error.message}`)
              )
            );
          }
          yield* Effect.logInfo('Gremlin connections closed');
        }),
    });

    // Clear connection state
    yield* Ref.set(connectionRef, Option.none());
  });

/**
 * Ensure connection is active and not idle with enhanced resource management
 */
export const ensureConnection = (
  connectionRef: Ref.Ref<Option.Option<ConnectionState>>,
  config: AppConfigType
) =>
  Effect.gen(function* () {
    const optionalConnectionState = yield* Ref.get(connectionRef);
    const currentTimestamp = Date.now();

    if (Option.isSome(optionalConnectionState)) {
      const connectionState = Option.getOrThrow(optionalConnectionState);
      const idleTimeMs = currentTimestamp - connectionState.lastUsed;
      const idleTimeoutMs = config.gremlin.idleTimeout * 1000; // Convert to milliseconds

      if (idleTimeMs < idleTimeoutMs && connectionState.client) {
        // Update last used time atomically
        yield* Ref.set(
          connectionRef,
          Option.some({ ...connectionState, lastUsed: currentTimestamp })
        );
        return connectionState;
      }

      // Connection is idle, close it gracefully
      yield* Effect.logInfo(`Connection idle for ${Math.round(idleTimeMs / 1000)}s, refreshing`);
      yield* closeConnections(connectionRef);
    }

    // Create new connection with proper resource management
    const newConnectionState = yield* createConnection(config);
    yield* Ref.set(connectionRef, Option.some(newConnectionState));
    return newConnectionState;
  });

/**
 * Get connection status with proper Effect error handling
 */
export const getConnectionStatus = (
  connectionRef: Ref.Ref<Option.Option<ConnectionState>>,
  config: AppConfigType
) =>
  ensureConnection(connectionRef, config).pipe(
    Effect.map(() => 'Available' as const),
    Effect.catchAll(() => Effect.succeed('Connection Error' as const))
  );

/**
 * Gremlin connection management with Effect.ts patterns
 */

import { Effect, Ref, Option } from 'effect';
import gremlin from 'gremlin';
import { GremlinConnectionError, Errors } from '../errors.js';
import type { AppConfigType } from '../config.js';
import type { ConnectionState } from './types.js';

const { Client, DriverRemoteConnection } = gremlin.driver;

/**
 * Create Gremlin connection with proper error handling
 */
export const createConnection = (
  config: AppConfigType
): Effect.Effect<ConnectionState, GremlinConnectionError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo('Creating Gremlin connection', {
      host: config.gremlinHost,
      port: config.gremlinPort,
      ssl: config.gremlinUseSSL,
    });

    const protocol = config.gremlinUseSSL ? 'wss' : 'ws';
    const connectionUrl = `${protocol}://${config.gremlinHost}:${config.gremlinPort}/gremlin`;

    // Create authentication config if credentials are provided
    const authConfig =
      Option.isSome(config.gremlinUsername) && Option.isSome(config.gremlinPassword)
        ? {
            auth: {
              username: Option.getOrThrow(config.gremlinUsername),
              password: Option.getOrThrow(config.gremlinPassword),
            },
          }
        : {};

    const client = yield* Effect.tryPromise({
      try: () =>
        Promise.resolve(
          new Client(connectionUrl, {
            traversalSource: config.gremlinTraversalSource,
            ...authConfig,
          })
        ),
      catch: error => Errors.connection('Failed to create Gremlin client', error),
    });

    const connection = yield* Effect.tryPromise({
      try: () =>
        Promise.resolve(
          new DriverRemoteConnection(connectionUrl, {
            traversalSource: config.gremlinTraversalSource,
            ...authConfig,
          })
        ),
      catch: error => Errors.connection('Failed to create remote connection', error),
    });

    const g = gremlin.process.AnonymousTraversalSource.traversal().withRemote(connection);

    // Test the connection
    yield* Effect.tryPromise({
      try: () => g.V().limit(1).count().next(),
      catch: (error: unknown) => Errors.connection('Connection test failed', error),
    });

    const state: ConnectionState = {
      client,
      connection,
      g,
      lastUsed: Date.now(),
    };

    yield* Effect.logInfo('✅ Gremlin connection established successfully');
    return state;
  });

/**
 * Close connections with proper resource management
 */
export const closeConnections = (connectionRef: Ref.Ref<Option.Option<ConnectionState>>) =>
  Effect.gen(function* () {
    const optionalState = yield* Ref.get(connectionRef);

    yield* Option.match(optionalState, {
      onNone: () => Effect.logDebug('No connection to close'),
      onSome: state =>
        Effect.gen(function* () {
          if (state.connection) {
            yield* Effect.tryPromise({
              try: () => state.connection!.close(),
              catch: error =>
                new GremlinConnectionError({
                  message: 'Failed to close Gremlin connection',
                  details: error,
                }),
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
 * Ensure connection is active and not idle
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

      if (idleTimeMs < config.gremlinIdleTimeout && connectionState.client) {
        // Update last used time
        yield* Ref.set(
          connectionRef,
          Option.some({ ...connectionState, lastUsed: currentTimestamp })
        );
        return connectionState;
      }

      // Connection is idle, close it
      yield* closeConnections(connectionRef);
    }

    // Create new connection
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

/**
 * Enhanced Gremlin connection management with Effect.ts resource patterns.
 * Uses Effect.acquireUseRelease and Scope for proper resource lifecycle management.
 */

import { Effect, Ref, Option, Scope, Redacted } from 'effect';
import gremlin from 'gremlin';
import { GremlinConnectionError, Errors } from '../errors.js';
import type { AppConfigType } from '../config.js';
import type { ConnectionState } from './types.js';

const { Client, DriverRemoteConnection } = gremlin.driver;

/**
 * Configuration object for Gremlin connections
 */
interface GremlinConnectionConfig {
  readonly url: string;
  readonly traversalSource: string;
  readonly auth?: {
    readonly username: string;
    readonly password: string;
  };
  readonly logLevel: string;
}

/**
 * Creates a standardized connection configuration from app config
 */
const createConnectionConfig = (config: AppConfigType): GremlinConnectionConfig => {
  const protocol = config.gremlin.useSSL ? 'wss' : 'ws';
  const url = `${protocol}://${config.gremlin.host}:${config.gremlin.port}/gremlin`;

  const auth = Option.zipWith(
    config.gremlin.username,
    config.gremlin.password,
    (username, password) => ({ username, password: Redacted.value(password) })
  );

  return {
    url,
    traversalSource: config.gremlin.traversalSource,
    auth: Option.getOrUndefined(auth),
    logLevel: config.logging?.level || 'info',
  };
};

/**
 * Creates client configuration with logging
 */
const createClientConfig = (connectionConfig: GremlinConnectionConfig) => ({
  traversalSource: connectionConfig.traversalSource,
  headers: {},
  ...(connectionConfig.auth ? { auth: connectionConfig.auth } : {}),
  log: {
    level: connectionConfig.logLevel,
    stream: process.stderr,
  },
});

/**
 * Creates remote connection configuration with logging
 */
const createRemoteConnectionConfig = (connectionConfig: GremlinConnectionConfig) => ({
  traversalSource: connectionConfig.traversalSource,
  headers: {},
  ...(connectionConfig.auth ? { auth: connectionConfig.auth } : {}),
  log: {
    level: connectionConfig.logLevel,
    stream: process.stderr,
  },
});

/**
 * Tests a Gremlin connection to ensure it's working
 */
const testConnection = (g: gremlin.process.GraphTraversalSource) =>
  Effect.tryPromise({
    try: () => g.V().limit(1).count().next(),
    catch: (error: unknown) =>
      Errors.connection('Connection test failed', {
        error,
        operation: 'connection_test',
      }),
  });

/**
 * Safely closes a connection with proper error handling
 */
const safeCloseConnection = (
  connection: gremlin.driver.DriverRemoteConnection | undefined,
  context: string = 'cleanup'
) =>
  Effect.gen(function* () {
    if (!connection) {
      yield* Effect.logDebug(`No connection to close during ${context}`);
      return;
    }

    yield* Effect.tryPromise({
      try: () => connection.close(),
      catch: error =>
        Errors.connection(`Failed to close Gremlin connection during ${context}`, {
          error,
          context,
        }),
    }).pipe(
      Effect.catchAll(error => Effect.logWarning(`Error during ${context}: ${error.message}`))
    );

    yield* Effect.logDebug(`Connection closed successfully during ${context}`);
  });

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

      const connectionConfig = createConnectionConfig(config);

      // Create client with standardized config
      const client = yield* Effect.try({
        try: () => new Client(connectionConfig.url, createClientConfig(connectionConfig)),
        catch: error =>
          Errors.connection('Failed to create Gremlin client', {
            error,
            host: config.gremlin.host,
            port: config.gremlin.port,
          }),
      });

      // Create remote connection with standardized config
      const connection = yield* Effect.try({
        try: () =>
          new DriverRemoteConnection(
            connectionConfig.url,
            createRemoteConnectionConfig(connectionConfig)
          ),
        catch: error =>
          Errors.connection('Failed to create remote connection', {
            error,
            host: config.gremlin.host,
            port: config.gremlin.port,
          }),
      });

      const g = yield* Effect.try({
        try: () => gremlin.process.AnonymousTraversalSource.traversal().withRemote(connection),
        catch: error =>
          Errors.connection('Failed to create graph traversal source', {
            error,
            host: config.gremlin.host,
            port: config.gremlin.port,
          }),
      });

      // Test the connection
      yield* testConnection(g);

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
        yield* safeCloseConnection(state.connection, 'release');
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
          onSome: state => safeCloseConnection(state.connection, 'pool cleanup'),
        });

        yield* Ref.set(connectionRef, Option.none());
        yield* Effect.logInfo('Connection pool cleaned up successfully');
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
      onSome: state => safeCloseConnection(state.connection, 'manual cleanup'),
    });

    // Clear connection state
    yield* Ref.set(connectionRef, Option.none());
    yield* Effect.logInfo('Gremlin connections closed');
  });

/**
 * Checks if a connection is idle based on the configured timeout
 */
const isConnectionIdle = (
  connectionState: ConnectionState,
  config: AppConfigType,
  currentTimestamp: number
): boolean => {
  const idleTimeMs = currentTimestamp - connectionState.lastUsed;
  const idleTimeoutMs = config.gremlin.idleTimeout * 1000;
  return idleTimeMs >= idleTimeoutMs;
};

/**
 * Updates the last used timestamp for a connection
 */
const updateLastUsed = (
  connectionRef: Ref.Ref<Option.Option<ConnectionState>>,
  connectionState: ConnectionState,
  timestamp: number
) => Ref.set(connectionRef, Option.some({ ...connectionState, lastUsed: timestamp }));

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

    return yield* Option.match(optionalConnectionState, {
      onNone: () =>
        Effect.gen(function* () {
          // No connection, create new
          const newConnectionState = yield* createConnection(config);
          yield* Ref.set(connectionRef, Option.some(newConnectionState));
          return newConnectionState;
        }),
      onSome: connectionState =>
        Effect.gen(function* () {
          if (!isConnectionIdle(connectionState, config, currentTimestamp)) {
            // Update last used time atomically
            yield* updateLastUsed(connectionRef, connectionState, currentTimestamp);
            return connectionState;
          }

          // Connection is idle, close it gracefully
          const idleTimeMs = currentTimestamp - connectionState.lastUsed;
          yield* Effect.logInfo(
            `Connection idle for ${Math.round(idleTimeMs / 1000)}s, refreshing`
          );
          yield* closeConnections(connectionRef);

          // Create new connection after closing
          const newConnectionState = yield* createConnection(config);
          yield* Ref.set(connectionRef, Option.some(newConnectionState));
          return newConnectionState;
        }),
    });
  });

/**
 * Get connection status with proper Effect error handling.
 * Returns the actual connection state on success, or fails with typed error.
 * This is more idiomatic than using success type for both cases.
 */
export const getConnectionStatus = (
  connectionRef: Ref.Ref<Option.Option<ConnectionState>>,
  config: AppConfigType
): Effect.Effect<ConnectionState, GremlinConnectionError> =>
  ensureConnection(connectionRef, config);

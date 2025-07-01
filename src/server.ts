#!/usr/bin/env node

/**
 * Effect-based Gremlin MCP Server implementation.
 * Replaces imperative patterns with Effect's functional composition.
 */

import { Effect, Layer, pipe, LogLevel, Logger, Context, Fiber, ManagedRuntime } from 'effect';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { AppConfig, type AppConfigType } from './config.js';
import { GremlinServiceLive } from './gremlin/service.js';
import { registerEffectToolHandlers } from './handlers/tools.js';
import { registerEffectResourceHandlers } from './handlers/resources.js';
import { createMcpHandlers } from './handlers/effect-runtime-bridge.js';
import { fromError } from './errors.js';

/**
 * MCP Server Service tag (using latest Effect 3.16.10 patterns)
 */
class McpServerService extends Context.Tag('McpServerService')<
  McpServerService,
  {
    readonly server: McpServer;
    readonly start: Effect.Effect<void, Error>;
    readonly stop: Effect.Effect<void, never>;
  }
>() {}

const makeMcpServerService = Effect.gen(function* () {
  const config = yield* AppConfig;

  // Create MCP server instance
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion,
  });

  yield* Effect.logInfo('✅ MCP Server instance created', {
    service: 'gremlin-mcp',
    name: config.serverName,
    version: config.serverVersion,
  });

  // Create runtime for handlers
  const serviceLayer = GremlinServiceLive(config);
  const serviceRuntime = ManagedRuntime.make(serviceLayer);
  const handlerBridge = createMcpHandlers(serviceRuntime);

  // Register handlers with dependency injection
  registerEffectToolHandlers(server, handlerBridge.bridge);
  registerEffectResourceHandlers(server, handlerBridge.bridge);

  yield* Effect.logInfo('✅ Handlers registered successfully', {
    service: 'gremlin-mcp',
  });

  // Add finalizer to dispose runtime
  yield* Effect.addFinalizer(() => Effect.promise(() => serviceRuntime.dispose()));

  return {
    server,
    start: Effect.gen(function* () {
      yield* Effect.logInfo('🔌 Creating STDIO transport...', { service: 'gremlin-mcp' });

      const transport = new StdioServerTransport();

      yield* Effect.logInfo('🔗 Connecting server to transport...', { service: 'gremlin-mcp' });

      yield* Effect.tryPromise({
        try: () => server.connect(transport),
        catch: error => new Error(fromError(error, 'Server connection failed').message),
      });

      yield* Effect.logInfo('✅ Gremlin MCP Server started successfully', {
        service: 'gremlin-mcp',
        pid: process.pid,
        ready: true,
      });
    }),
    stop: Effect.gen(function* () {
      yield* Effect.logInfo('🛑 Stopping MCP Server...', { service: 'gremlin-mcp' });
      // Server cleanup would go here if needed
    }),
  };
});

const McpServerServiceLive = Layer.effect(McpServerService, makeMcpServerService);

/**
 * Application Layer composition
 */
const AppLayer = (config: AppConfigType) =>
  Layer.mergeAll(GremlinServiceLive(config), McpServerServiceLive);

/**
 * Main application program
 */
const program = Effect.gen(function* () {
  // Get configuration
  const config = yield* AppConfig;

  yield* Effect.logInfo('🚀 Starting Gremlin MCP Server...', {
    service: 'gremlin-mcp',
    version: config.serverVersion,
    gremlinEndpoint: `${config.gremlinHost}:${config.gremlinPort}`,
    logLevel: config.logLevel,
  });

  // Get server service
  const mcpServer = yield* McpServerService;

  // Set up graceful shutdown
  yield* Effect.addFinalizer(() => mcpServer.stop);

  // Start the server
  yield* mcpServer.start;

  // Keep the program running
  yield* Effect.never;
});

/**
 * Enhanced logging configuration based on config
 */
const createLoggerLayer = (config: AppConfigType) => {
  const logLevel = (() => {
    switch (config.logLevel) {
      case 'error':
        return LogLevel.Error;
      case 'warn':
        return LogLevel.Warning;
      case 'info':
        return LogLevel.Info;
      case 'debug':
        return LogLevel.Debug;
      default:
        return LogLevel.Info;
    }
  })();

  return Layer.mergeAll(
    Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ logLevel: level, message, ...rest }) => {
        const timestamp = new Date().toISOString();
        const levelStr = level._tag.toUpperCase().padEnd(5);

        if (level._tag === 'Fatal' || level._tag === 'Error') {
          console.error(`[${timestamp}] ${levelStr} ${message}`, rest);
        } else if (level._tag === 'Warning') {
          console.warn(`[${timestamp}] ${levelStr} ${message}`, rest);
        } else {
          console.log(`[${timestamp}] ${levelStr} ${message}`, rest);
        }
      })
    ),
    Logger.minimumLogLevel(logLevel)
  );
};

/**
 * Effect-based signal handling
 */
const withGracefulShutdown = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(effect);

    // Set up signal handlers
    const handleSignal = (signal: string) => {
      Effect.runPromise(
        Effect.gen(function* () {
          yield* Effect.logInfo(`Received ${signal}. Shutting down gracefully...`);
          yield* Fiber.interrupt(fiber);
        })
      )
        .then(() => {
          process.exit(0);
        })
        .catch(error => {
          console.error('Error during shutdown:', error);
          process.exit(1);
        });
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));

    return yield* Fiber.join(fiber);
  });

/**
 * Main entry point with full Effect composition
 */
const main = Effect.gen(function* () {
  // Add startup logging before anything else
  console.info('🎬 Gremlin MCP Server executable started');
  console.info('📋 Process info:', {
    pid: process.pid,
    nodeVersion: process.versions.node,
    platform: process.platform,
    argv: process.argv,
    cwd: process.cwd(),
  });

  // Get configuration early for logging setup
  const config = yield* AppConfig;

  // Run the main program with all services provided
  yield* pipe(
    withGracefulShutdown(program),
    Effect.provide(AppLayer(config)),
    Effect.provide(createLoggerLayer(config))
  );
}).pipe(
  Effect.catchAll((error: unknown) =>
    Effect.gen(function* () {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      yield* Effect.logError('❌ Unhandled error in main', {
        service: 'gremlin-mcp',
        error: errorMessage,
        stack: errorStack,
      });

      // Exit with error code
      yield* Effect.sync(() => process.exit(1));
    })
  )
);

/**
 * Run the application
 */
Effect.runPromiseExit(Effect.scoped(main))
  .then(exit => {
    if (exit._tag === 'Failure') {
      console.error('❌ Fatal error:', exit.cause);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

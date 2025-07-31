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
import { Errors } from './errors.js';

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
    name: config.server.name,
    version: config.server.version,
  });

  yield* Effect.logInfo('✅ MCP Server instance created', {
    service: 'gremlin-mcp',
    name: config.server.name,
    version: config.server.version,
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

      yield* pipe(
        Effect.tryPromise(() => server.connect(transport)),
        Effect.mapError(error => {
          const serverError = Errors.resource('Server connection failed', 'connection', {
            error_type: error instanceof Error ? error.constructor.name : typeof error,
            error_message: error instanceof Error ? error.message : String(error),
          });
          return new Error(serverError.message);
        })
      );

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
 * Application Layer composition with explicit dependencies
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
    version: config.server.version,
    gremlinEndpoint: `${config.gremlin.host}:${config.gremlin.port}`,
    logLevel: config.logging.level,
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
 * Safely serialize log data to JSON
 */
const safeJsonStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return JSON.stringify({
      message: String(obj),
      serialization_error: true,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Enhanced logging configuration based on config
 * CRITICAL: All logging must go to stderr to avoid interfering with MCP JSON responses
 */
const createLoggerLayer = (config: AppConfigType) => {
  const logLevelMap = {
    error: LogLevel.Error,
    warn: LogLevel.Warning,
    info: LogLevel.Info,
    debug: LogLevel.Debug,
  } as const;

  const logLevel = logLevelMap[config.logging.level] ?? LogLevel.Info;

  return Layer.mergeAll(
    Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ logLevel: level, message, ...rest }) => {
        const logData = {
          level: level._tag.toLowerCase(),
          message,
          ...Object.fromEntries(
            Object.entries(rest).filter(
              ([key]) => !key.startsWith('_') && key !== 'span' && key !== 'fiber'
            )
          ),
          timestamp: new Date().toISOString(),
        };
        process.stderr.write(`${safeJsonStringify(logData)}\n`);
        return Effect.succeed(void 0);
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
  // Add startup logging before anything else - CRITICAL: Use stderr only
  const startupInfo = {
    level: 'info',
    message: 'Gremlin MCP Server executable started',
    process_info: {
      pid: process.pid,
      node_version: process.versions.node,
      platform: process.platform,
      argv: process.argv,
      cwd: process.cwd(),
    },
    timestamp: new Date().toISOString(),
  };
  process.stderr.write(`${JSON.stringify(startupInfo)}\n`);

  // Get configuration early for logging setup
  const config = yield* AppConfig;

  // Log configuration
  const configInfo = {
    level: 'info',
    message: 'Configuration loaded',
    config: {
      gremlin: {
        host: config.gremlin.host,
        port: config.gremlin.port,
        use_ssl: config.gremlin.useSSL,
        traversal_source: config.gremlin.traversalSource,
        idle_timeout: config.gremlin.idleTimeout,
      },
      logging: {
        level: config.logging.level,
      },
    },
    timestamp: new Date().toISOString(),
  };
  process.stderr.write(`${JSON.stringify(configInfo)}\n`);

  // Run the main program with all services provided
  yield* pipe(
    withGracefulShutdown(program),
    Effect.provide(AppLayer(config)),
    Effect.provide(createLoggerLayer(config))
  );
});

/**
 * Run the application with better error handling
 */
const runMain = pipe(
  Effect.scoped(main),
  Effect.catchAll((error: unknown) =>
    Effect.sync(() => {
      const errorData = {
        level: 'error',
        message: 'Fatal error in main program',
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };
      process.stderr.write(`${JSON.stringify(errorData)}\n`);
      process.exit(1);
    })
  )
);

Effect.runPromiseExit(runMain).then(exit => {
  if (exit._tag === 'Failure') {
    console.error('❌ Fatal error:', exit.cause);
    process.exit(1);
  }
});

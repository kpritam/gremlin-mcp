/**
 * Simplified Effect runtime utilities for MCP handlers.
 * Uses direct Layer.toRuntime pattern instead of complex bridge abstractions.
 */

import { Effect, Layer, Runtime } from 'effect';

/**
 * Create a runtime from a layer for MCP handlers
 */
export const createMcpRuntime = <R, E>(layer: Layer.Layer<R, E, never>) =>
  Effect.scoped(Layer.toRuntime(layer));

/**
 * Simple helper to run effects with a runtime and handle errors
 */
export const runWithRuntime = <A, E, R>(
  runtime: Runtime.Runtime<R>,
  effect: Effect.Effect<A, E, R>
): Promise<A> => Runtime.runPromise(runtime)(effect);

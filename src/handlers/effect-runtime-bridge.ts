/**
 * Effect-to-MCP runtime bridge.
 * Provides a clean interface for running Effect programs within MCP SDK callbacks.
 */

import { Effect, ManagedRuntime } from 'effect';

/**
 * Creates a bridge between Effect runtime and MCP SDK callbacks
 */
export interface EffectMcpBridge<R> {
  readonly runEffect: <A, E>(effect: Effect.Effect<A, E, R>) => Promise<A>;
}

/**
 * Creates an Effect-to-MCP bridge with proper dependency injection
 */
export const createEffectMcpBridge = <R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>
): EffectMcpBridge<R> => ({
  runEffect: <A, E>(effect: Effect.Effect<A, E, R>): Promise<A> => runtime.runPromise(effect),
});

/**
 * Handler factory type for creating MCP handlers with Effect runtime
 */
export type EffectHandlerFactory<R, Args, Result> = (
  bridge: EffectMcpBridge<R>
) => (args: Args) => Promise<Result>;

/**
 * Creates MCP handlers with dependency-injected Effect runtime
 */
export const createMcpHandlers = <R>(runtime: ManagedRuntime.ManagedRuntime<R, never>) => {
  const bridge = createEffectMcpBridge(runtime);

  return {
    bridge,
    createToolHandler: <Args, Result>(factory: EffectHandlerFactory<R, Args, Result>) =>
      factory(bridge),
    createResourceHandler: <Args, Result>(factory: EffectHandlerFactory<R, Args, Result>) =>
      factory(bridge),
  };
};

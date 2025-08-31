import { Context } from 'effect';
import type { ConnectionState } from './types.js';

/**
 * Represents the Gremlin client as a service in the Effect context.
 *
 * This service provides access to the active Gremlin connection state,
 * including the client, connection, and traversal source (`g`).
 *
 * @example
 * ```typescript
 * import { Effect } from 'effect';
 * import { GremlinClient } from './client.js';
 *
 * const myEffect = Effect.gen(function* () {
 *   const gremlin = yield* GremlinClient;
 *   const count = yield* Effect.tryPromise(() => gremlin.g.V().count().next());
 *   return count.value;
 * });
 * ```
 */
export class GremlinClient extends Context.Tag('GremlinClient')<GremlinClient, ConnectionState>() {}

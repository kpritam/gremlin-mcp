/**
 * Type guard functions for runtime type checking.
 */

/**
 * Type guard to check if an object is a Gremlin result with get method.
 * This is typically used for Map-like objects returned by Gremlin queries.
 *
 * @param obj - The object to check
 * @returns True if the object has a get method like a Map
 */
export function isGremlinResult(obj: unknown): obj is { get(key: string): unknown } {
  return typeof obj === 'object' && obj !== null && 'get' in obj;
}

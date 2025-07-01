/**
 * Type guard functions for runtime type checking.
 */

/**
 * Type guard to check if an object is a valid Gremlin result.
 * This can be a ResultSet object, Map-like object, or array.
 *
 * @param obj - The object to check
 * @returns True if the object is a valid Gremlin result format
 */
export function isGremlinResult(
  obj: unknown
): obj is
  | { get(key: string): unknown }
  | { _items: unknown[]; attributes?: unknown; length?: number }
  | { toArray(): unknown[] }
  | unknown[] {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Check for ResultSet object (has _items and length)
  if ('_items' in obj && Array.isArray((obj as any)._items)) {
    return true;
  }

  // Check for Map-like objects
  if ('get' in obj && typeof (obj as any).get === 'function') {
    return true;
  }

  // Check for objects with toArray method
  if ('toArray' in obj && typeof (obj as any).toArray === 'function') {
    return true;
  }

  // Check for direct arrays
  if (Array.isArray(obj)) {
    return true;
  }

  return false;
}

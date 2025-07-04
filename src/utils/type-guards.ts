/**
 * Type guard functions for runtime type checking.
 */

import type { driver } from 'gremlin';
type GremlinResultSet = driver.ResultSet;

/**
 * Type guard to check if an object is a Gremlin ResultSet
 */
export function isGremlinResultSet(obj: unknown): obj is GremlinResultSet {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Check for ResultSet methods
  return (
    'toArray' in obj &&
    typeof (obj as { toArray: unknown }).toArray === 'function' &&
    'first' in obj &&
    typeof (obj as { first: unknown }).first === 'function'
  );
}

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
  if ('_items' in obj && Array.isArray((obj as { _items: unknown[] })._items)) {
    return true;
  }

  // Check for Map-like objects
  if ('get' in obj && typeof (obj as { get: unknown }).get === 'function') {
    return true;
  }

  // Check for objects with toArray method
  if ('toArray' in obj && typeof (obj as { toArray: unknown }).toArray === 'function') {
    return true;
  }

  // Check for direct arrays
  if (Array.isArray(obj)) {
    return true;
  }

  return false;
}

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

/**
 * Type guard to check if an object is a Gremlin Vertex
 */
export function isGremlinVertex(
  obj: unknown
): obj is { id: unknown; label: string; type: 'vertex'; properties?: Record<string, unknown[]> } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const vertex = obj as Record<string, unknown>;
  return (
    vertex['type'] === 'vertex' &&
    'id' in vertex &&
    'label' in vertex &&
    typeof vertex['label'] === 'string'
  );
}

/**
 * Type guard to check if an object is a Gremlin Edge
 */
export function isGremlinEdge(
  obj: unknown
): obj is {
  id: unknown;
  label: string;
  type: 'edge';
  inV: unknown;
  outV: unknown;
  properties?: Record<string, unknown[]>;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const edge = obj as Record<string, unknown>;
  return (
    edge['type'] === 'edge' &&
    'id' in edge &&
    'label' in edge &&
    typeof edge['label'] === 'string' &&
    'inV' in edge &&
    'outV' in edge
  );
}

/**
 * Type guard to check if an object is a Gremlin Path
 */
export function isGremlinPath(
  obj: unknown
): obj is { labels: string[]; objects: unknown[]; type: 'path' } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const path = obj as Record<string, unknown>;
  return (
    path['type'] === 'path' &&
    'labels' in path &&
    Array.isArray(path['labels']) &&
    'objects' in path &&
    Array.isArray(path['objects'])
  );
}

/**
 * Type guard to check if an object is a Gremlin Property Map
 */
export function isGremlinPropertyMap(obj: unknown): obj is Record<string, unknown[]> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }

  const propMap = obj as Record<string, unknown>;
  return Object.values(propMap).every(value => Array.isArray(value));
}

/**
 * Type guard to check if a value is a valid schema count data
 */
export function isSchemaCountData(
  obj: unknown
): obj is { value?: Record<string, number>; total?: number } {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const countData = obj as Record<string, unknown>;
  return (
    (!('value' in countData) ||
      (typeof countData['value'] === 'object' &&
        countData['value'] !== null &&
        Object.values(countData['value'] as Record<string, unknown>).every(
          v => typeof v === 'number'
        ))) &&
    (!('total' in countData) || typeof countData['total'] === 'number')
  );
}

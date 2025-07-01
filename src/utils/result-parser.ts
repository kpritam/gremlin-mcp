/**
 * Gremlin result parsing utilities.
 *
 * This module provides idiomatic parsing of Gremlin query results into
 * type-safe, serializable objects using Zod schemas.
 */

import { z } from 'zod';
import { type GremlinResultItem, GremlinResultItemSchema } from '../gremlin/models.js';
import { calculateResultMetadata, type ResultMetadata } from './result-metadata.js';

/**
 * Type guard for objects with a specific constructor name.
 * This is used to identify native Gremlin types from the driver.
 */
function hasConstructorName(
  obj: unknown,
  name: 'Vertex' | 'Edge' | 'Path' | 'Property' | 'VertexProperty'
): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'constructor' in obj &&
    typeof obj.constructor === 'function' &&
    obj.constructor.name === name
  );
}

/**
 * Type guard and interface for raw vertex objects
 */
interface RawVertex {
  id: unknown;
  label: string;
  properties?: unknown;
}

function isRawVertex(obj: unknown): obj is RawVertex {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'label' in obj &&
    typeof obj.label === 'string'
  );
}

/**
 * Type guard and interface for raw edge objects
 */
interface RawEdge {
  id: unknown;
  label: string;
  inV?: unknown;
  outV?: unknown;
  properties?: unknown;
}

function isRawEdge(obj: unknown): obj is RawEdge {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'label' in obj &&
    typeof obj.label === 'string'
  );
}

/**
 * Type guard and interface for raw path objects
 */
interface RawPath {
  labels?: unknown;
  objects?: unknown;
}

function isRawPath(obj: unknown): obj is RawPath {
  return obj !== null && typeof obj === 'object';
}

/**
 * Type guard and interface for raw property objects
 */
interface RawProperty {
  key?: string;
  label?: string;
  value: unknown;
}

function isRawProperty(obj: unknown): obj is RawProperty {
  return obj !== null && typeof obj === 'object' && 'value' in obj;
}

/**
 * A Zod schema that preprocesses raw Gremlin results before validation.
 *
 * It transforms Gremlin-specific driver types (like Vertex, Edge, Path)
 * and data structures (like Map) into a standard format that can be
 * validated against the `GremlinResultItemSchema`.
 */
const GremlinPreprocessedResultSchema = z.preprocess((arg: unknown) => {
  // Pass through primitives and null/undefined, which Zod can handle directly.
  if (arg === null || typeof arg !== 'object') {
    return arg;
  }

  // Handle native Gremlin structure types by checking their constructor name
  // and transforming them into plain objects with a 'type' discriminator.
  if (hasConstructorName(arg, 'Vertex') && isRawVertex(arg)) {
    return { ...arg, type: 'vertex' };
  }

  if (hasConstructorName(arg, 'Edge') && isRawEdge(arg)) {
    return { ...arg, type: 'edge' };
  }

  if (hasConstructorName(arg, 'Path') && isRawPath(arg)) {
    return {
      labels: Array.isArray(arg.labels) ? arg.labels.map(String) : [],
      objects: arg.objects,
      type: 'path',
    };
  }

  if (
    (hasConstructorName(arg, 'Property') || hasConstructorName(arg, 'VertexProperty')) &&
    isRawProperty(arg)
  ) {
    return {
      key: arg.key || arg.label || '',
      value: arg.value,
      type: 'property',
    };
  }

  // Convert ES6 Maps to plain objects so Zod can parse them.
  if (arg instanceof Map) {
    return Object.fromEntries(arg.entries());
  }

  // If a generic object looks like a vertex or edge (e.g., from a different driver
  // or a simple JSON response), add the 'type' discriminator to help Zod parse it.
  if ('id' in arg && 'label' in arg) {
    if ('properties' in arg && !('inV' in arg) && !('outV' in arg) && isRawVertex(arg)) {
      return { ...arg, type: 'vertex' };
    }
    if ('inV' in arg && 'outV' in arg && isRawEdge(arg)) {
      return { ...arg, type: 'edge' };
    }
  }

  // Let arrays and other plain objects pass through for Zod to handle.
  return arg;
}, GremlinResultItemSchema);

/**
 * Parses a single raw Gremlin result item into a typed, serializable object.
 */
export function parseGremlinResultItem(rawResult: unknown): GremlinResultItem {
  return GremlinPreprocessedResultSchema.parse(rawResult);
}

/**
 * Parses an array of raw Gremlin results into typed objects.
 */
export function parseGremlinResults(rawResults: unknown[]): GremlinResultItem[] {
  return rawResults.map(parseGremlinResultItem);
}

/**
 * Enhanced result parser that provides detailed type information and metadata.
 */
export function parseGremlinResultsWithMetadata(rawResults: unknown[]): {
  results: GremlinResultItem[];
  metadata: ResultMetadata;
} {
  const results = parseGremlinResults(rawResults);
  const metadata = calculateResultMetadata(results);

  return { results, metadata };
}

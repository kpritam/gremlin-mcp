/**
 * Utilities for calculating metadata from Gremlin query results.
 */

import type { GremlinResultItem } from '../gremlin/models.js';

export interface ResultMetadata {
  totalCount: number;
  vertexCount: number;
  edgeCount: number;
  pathCount: number;
  propertyCount: number;
  propertyMapCount: number;
  primitiveCount: number;
  types: string[];
}

/**
 * Calculate comprehensive metadata from parsed Gremlin results.
 */
export function calculateResultMetadata(results: GremlinResultItem[]): ResultMetadata {
  let vertexCount = 0;
  let edgeCount = 0;
  let pathCount = 0;
  let propertyCount = 0;
  let propertyMapCount = 0;
  let primitiveCount = 0;
  const types = new Set<string>();

  results.forEach(result => {
    if (result && typeof result === 'object') {
      if ('type' in result) {
        if (result['type'] === 'vertex') {
          vertexCount++;
          types.add('vertex');
        } else if (result['type'] === 'edge') {
          edgeCount++;
          types.add('edge');
        } else if (result['type'] === 'path') {
          pathCount++;
          types.add('path');
        } else if (result['type'] === 'property') {
          propertyCount++;
          types.add('property');
        }
      } else if (Array.isArray(result)) {
        types.add('array');
      } else {
        // Likely a property map or generic object
        propertyMapCount++;
        types.add('property_map');
      }
    } else {
      primitiveCount++;
      types.add(typeof result);
    }
  });

  return {
    totalCount: results.length,
    vertexCount,
    edgeCount,
    pathCount,
    propertyCount,
    propertyMapCount,
    primitiveCount,
    types: Array.from(types),
  };
}

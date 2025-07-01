/**
 * Shared types and interfaces for Gremlin service modules
 */

import type { driver, process } from 'gremlin';
import type { GraphSchema } from './models.js';

// Gremlin type aliases
export type GremlinClientType = driver.Client;
export type GremlinConnection = driver.DriverRemoteConnection;
export type GraphTraversalSource = process.GraphTraversalSource;

/**
 * Internal connection state
 */
export interface ConnectionState {
  client?: GremlinClientType;
  connection?: GremlinConnection;
  g?: GraphTraversalSource;
  lastUsed: number;
}

/**
 * Configuration for schema generation
 */
export interface SchemaConfig {
  includeSampleValues: boolean;
  maxEnumValues: number;
  includeCounts: boolean;
  enumCardinalityThreshold: number;
  enumPropertyBlacklist: string[];
}

/**
 * Schema cache entry
 */
export interface SchemaCacheEntry {
  schema: GraphSchema;
  timestamp: number;
}

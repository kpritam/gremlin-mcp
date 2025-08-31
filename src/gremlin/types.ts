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
 * Internal connection state - represents a fully initialized connection
 */
export interface ConnectionState {
  readonly client: GremlinClientType;
  readonly connection: GremlinConnection;
  readonly g: GraphTraversalSource;
  readonly lastUsed: number;
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
  timeoutMs?: number;
  batchSize?: number;
}

/**
 * Schema cache entry
 */
export interface SchemaCacheEntry {
  schema: GraphSchema;
  timestamp: number;
}

/**
 * Gremlin service status information
 */
export interface ServiceStatus {
  /** Overall connection status */
  status: 'connected' | 'disconnected' | 'error';
}

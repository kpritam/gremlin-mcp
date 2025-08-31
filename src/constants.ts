/**
 * @fileoverview Application constants and default values.
 *
 * Centralized location for all constant values used throughout the application
 * including server metadata, MCP protocol identifiers, and configuration defaults.
 */

// Server Information
export const SERVER_NAME = 'gremlin-mcp';
export const SERVER_VERSION = '0.0.11-SNAPSHOT';

// MCP Resource URIs
export const RESOURCE_URIS = {
  STATUS: 'gremlin://status',
  SCHEMA: 'gremlin://schema',
} as const;

// MCP Tool Names
export const TOOL_NAMES = {
  GET_GRAPH_STATUS: 'get_graph_status',
  GET_GRAPH_SCHEMA: 'get_graph_schema',
  RUN_GREMLIN_QUERY: 'run_gremlin_query',
  REFRESH_SCHEMA_CACHE: 'refresh_schema_cache',
  IMPORT_GRAPH_DATA: 'import_graph_data',
  EXPORT_SUBGRAPH: 'export_subgraph',
} as const;

// Default Configuration Values
export const DEFAULTS = {
  TRAVERSAL_SOURCE: 'g',
  USE_SSL: false,
  LOG_LEVEL: 'info' as const,
  SERVER_NAME: 'gremlin-mcp',
  SERVER_VERSION: '0.0.11-SNAPSHOT',
} as const;

// Connection Status Messages
export const STATUS_MESSAGES = {
  AVAILABLE: 'Available',
  NOT_CONNECTED: 'Not Connected',
  CONNECTION_ERROR: 'Connection Error',
} as const;

// MIME Types
export const MIME_TYPES = {
  TEXT_PLAIN: 'text/plain',
  APPLICATION_JSON: 'application/json',
} as const;

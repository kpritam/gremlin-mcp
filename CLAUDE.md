# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules

**ALWAYS follow the development rules in RULES.md** - These rules are mandatory for all code changes, testing, security, and architecture decisions in this project.

## Development Commands

### Build and Type Checking

- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run type-check` - Run TypeScript type checking without compilation
- `npm run validate` - Run complete validation (format, lint, type-check, test)
- `npm run clean` - Remove dist/ directory

### Testing

- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate test coverage report
- `npm run test:it` - Run integration tests against external Gremlin server (requires running Gremlin server on localhost:8182/g)

### Code Quality

- `npm run lint` - Run ESLint on source and test files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Development and Execution

- `npm run dev` - Run server in development mode with tsx
- `npm start` - Run built server from dist/

## Architecture

### Implementation Status

This project is implemented using **Effect.ts** functional programming patterns throughout:

- **Current Implementation**: Effect.ts-based functional programming approach
- **Architecture**: Composable, type-safe effects with dependency injection and service patterns
- **Paradigm**: Immutable state management with Effect's composable error handling

### Core Components

**server.ts** - Effect-based MCP server implementation using @modelcontextprotocol/sdk:

- Effect service definitions with Context.Tag patterns for dependency injection
- Graceful startup/shutdown using Effect composition and fiber management
- Layer-based dependency resolution with service composition
- Signal handling using Effect's functional approach

**gremlin/service.ts** - Effect-based Gremlin service for graph operations:

- GremlinService using modern Effect.ts Context.Tag service pattern
- Ref-based state management for connections and schema caching
- Composable Effect operations for all graph database interactions
- Methods: getStatus, getSchema, refreshSchemaCache, executeQuery, healthCheck

**gremlin/schema-service.ts** - Effect-based schema management service:

- SchemaService extending Effect.Service with proper service definition
- Dependency injection of GremlinService through Effect's service system
- Cached schema operations with Effect state management

**config.ts** - Pure Effect-based configuration management:

- Effect.Config system for type-safe environment variable parsing and validation
- Composable configuration with Effect.Config.all for combining multiple config sources
- Automatic parsing, validation, and transformation using Effect patterns
- Single source of truth with no backward compatibility layers
- Exports only AppConfig Effect and AppConfigType for clean architecture

**handlers/** - Effect-based modular request handlers:

- **resources.ts** - Effect-based MCP resource handlers using pipe and service injection
- **tools.ts** - Effect-based MCP tool handlers with createEffectTool helpers
- **runtime-context.ts** - ManagedRuntime container for Effect execution in MCP handlers

**utils/** - Utility modules:

- **type-guards.ts** - Runtime type checking functions for Gremlin results
- **result-parser.ts** - Gremlin result parsing with metadata extraction
- **result-metadata.ts** - Metadata extraction from Gremlin query results
- **effect-tool-helpers.ts** - Effect-based tool creation helpers for MCP integration
- **tool-helpers.ts** - Legacy tool helpers (Effect.ts based)
- **data-operations.ts** - Effect-based graph data import/export operations

**constants.ts** - Application constants:

- Server information, resource URIs, tool names
- Default configuration values for Zod schema
- Status messages and MIME types

**gremlin/models.ts** - Zod schemas for runtime validation and TypeScript types:

- GraphSchema, Node, Relationship, RelationshipPattern types
- GremlinConfig for connection configuration
- GremlinQueryResult for query responses
- ImportDataInput and ExportSubgraphInput for data operations

**errors.ts** - Effect-based error management:

- Custom error classes for different error types (GremlinConnectionError, GremlinQueryError, etc.)
- Effect-compatible error handling with proper error types
- Structured error creation with context and cause information

### Available MCP Tools (6 tools)

1. **get_graph_status** - Check database connection status
2. **get_graph_schema** - Get complete schema with vertex/edge labels and relationship patterns
3. **run_gremlin_query** - Execute any Gremlin traversal query
4. **refresh_schema_cache** - Force immediate refresh of cached schema
5. **import_graph_data** - Import data from GraphSON or CSV formats with batch processing
6. **export_subgraph** - Export subgraph data to JSON, GraphSON, or CSV formats

### Available MCP Resources (2 resources)

1. **gremlin://status** - Real-time connection status
2. **gremlin://schema** - Cached schema information (JSON format)

### Key Patterns

**Effect.ts Functional Programming**: All operations use Effect's composable, type-safe approach to side effects and error handling.

**Service-Oriented Architecture**: Dependencies managed through Effect's Context.Tag and service injection patterns.

**Layer-Based Composition**: Application built using Effect.Layer for dependency resolution and service composition.

**Immutable State Management**: All state changes handled through Effect.Ref for thread-safe, immutable updates.

**Type Safety**: Comprehensive TypeScript types with runtime validation via Zod schemas and Effect's type system.

**Configuration Management**: Effect.Config-based environment variable validation with composable configuration parsing.

**Handler Separation**: MCP handlers use Effect composition with proper error handling and service injection.

**Utility Modules**: Effect-based utility functions for common graph operations and data transformations.

**Constants**: Application constants integrated with Effect configuration and schema systems.

**Modern Effect.ts Patterns**: Uses latest Effect 3.16.10 patterns including Context.Tag services and Layer composition.

**Generic Gremlin Support**: Effect-based abstractions work with any Gremlin-compatible database (TinkerPop, Neptune, etc.).

**Data Operations**: Effect-based import/export functionality with composable batch processing and error handling.

### Testing Setup

Tests use Jest with ts-jest for ESM support. Setup file at tests/setup.ts configures test environment. Coverage collection from src/ directory excluding .d.ts files. Comprehensive mocking for Gremlin dependencies.

**Test Suites**:

- **tests/config.test.ts** - Effect-based configuration management and validation
- **tests/models.test.ts** - Zod schema validation and type checking

**Integration Testing**: `tests/mcp-integration.test.ts` provides comprehensive validation against real Gremlin servers:

- Connection validation and status checks
- Schema discovery and structure validation
- Query execution with various Gremlin patterns
- Tool listing and availability verification
- Error handling for invalid queries
- Complex graph data creation and validation

Prerequisites for integration tests:

- Running Gremlin-compatible server (TinkerPop, Neptune, etc.)
- Set `GREMLIN_ENDPOINT` environment variable (e.g., `localhost:8182/g`)
- Run with: `GREMLIN_ENDPOINT=localhost:8182/g npm run test:it`

### Environment Variables

All environment variables are validated through Effect.Config:

- **GREMLIN_ENDPOINT** (required) - Server endpoint (host:port or host:port/traversal_source)
- **GREMLIN_USE_SSL** (optional) - Enable SSL/TLS connections (default: false)
- **GREMLIN_USERNAME** (optional) - Authentication username
- **GREMLIN_PASSWORD** (optional) - Authentication password
- **GREMLIN_IDLE_TIMEOUT** (optional) - Connection idle timeout in seconds (default: 300)
- **LOG_LEVEL** (optional) - Logging level: error, warn, info, debug (default: info)

### Error Handling

- **Effect-based Error Types** - Custom error classes (GremlinConnectionError, GremlinQueryError, etc.) with Effect compatibility
- **Composable Error Handling** - All operations use Effect.catchAll and Effect.either for structured error management
- **Graceful Degradation** - Schema operations fall back to cached data using Effect.orElse patterns
- **Detailed Error Context** - Errors include structured context and cause information for troubleshooting

### Performance Considerations

- **Effect.Ref State Management** - Thread-safe connection state with Effect.Ref for concurrent access
- **Schema Caching** - Effect-based cached schema with configurable refresh intervals using Ref
- **Batch Processing** - Effect-based import operations with composable batch processing
- **Lazy Service Initialization** - Services created only when needed through Effect's Layer system
- **Resource Management** - Automatic cleanup using Effect.addFinalizer and managed runtimes

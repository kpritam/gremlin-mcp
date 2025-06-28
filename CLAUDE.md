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
- `npm run test:it` - Run integration tests against external Gremlin server

### Code Quality

- `npm run lint` - Run ESLint on source and test files
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Development and Execution

- `npm run dev` - Run server in development mode with tsx
- `npm start` - Run built server from dist/

## Architecture

### Core Components

**server.ts** - Main MCP server implementation using the official @modelcontextprotocol/sdk. Handles:

- Lazy initialization of Gremlin connection via getGraphClient()
- Server configuration using parseServerConfig()
- Delegates to specialized handlers for resources and tools
- Graceful shutdown with SIGINT/SIGTERM handling

**gremlin/client.ts** - Gremlin client for graph operations:

- GremlinClient class with comprehensive graph database functionality
- Compatible with any Gremlin-enabled database (TinkerPop, Neptune, etc.)
- Connection management with idle timeout and retry logic
- Schema caching with automatic refresh
- Methods: getStatus(), executeGremlinQuery(), getSchema(), refreshSchemaCache()

**config.ts** - Centralized configuration parsing and validation:

- Zod-based environment variable schema with runtime validation
- Direct property access with type safety (config.gremlinHost, config.gremlinPort)
- Automatic type coercion and sensible defaults
- Exported config object for validated configuration throughout the application

**handlers/** - Modular request handlers:

- **index.ts** - Handler registration coordinator
- **resources.ts** - MCP resource handlers (status, schema)
- **tools.ts** - MCP tool handlers (6 tools: get_graph_status, get_graph_schema, run_gremlin_query, refresh_schema_cache, import_graph_data, export_subgraph)

**utils/** - Utility modules:

- **type-guards.ts** - Runtime type checking functions for Gremlin results
- **result-parser.ts** - Gremlin result parsing with metadata extraction
- **result-metadata.ts** - Metadata extraction from Gremlin query results

**constants.ts** - Application constants:

- Server information, resource URIs, tool names
- Default configuration values for Zod schema
- Status messages and MIME types

**gremlin/models.ts** - Zod schemas for runtime validation and TypeScript types:

- GraphSchema, Node, Relationship, RelationshipPattern types
- GremlinConfig for connection configuration
- GremlinQueryResult for query responses
- ImportDataInput and ExportSubgraphInput for data operations

**logger.ts** - Enhanced Winston configuration:

- Uses validated config.logLevel from Zod schema
- Conditional formatting based on log level
- Cleaner transport setup

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

**Modular Architecture**: Code is organized into focused modules with single responsibilities.

**Type Safety**: Comprehensive TypeScript types with runtime validation via Zod schemas.

**Configuration Management**: Zod-based environment variable validation with runtime type checking, automatic defaults, and centralized config export.

**Handler Separation**: MCP handlers are extracted into separate modules for better organization.

**Utility Modules**: Common functionality extracted into reusable utility modules.

**Constants**: Default values and magic strings extracted into constants, integrated with Zod schemas for type-safe defaults.

**Modern TypeScript**: Uses contemporary TypeScript patterns and idiomatic conventions.

**Generic Gremlin Support**: Code is designed to work with any Gremlin-compatible database, not just TinkerPop. Use `GremlinClient`, `GremlinConfig`, and `GremlinException` - no legacy TinkerPop-specific naming.

**Data Operations**: Comprehensive import/export functionality with support for multiple formats and batch processing.

### Testing Setup

Tests use Jest with ts-jest for ESM support. Setup file at tests/setup.ts configures test environment. Coverage collection from src/ directory excluding .d.ts files. Comprehensive mocking for Gremlin dependencies.

**Test Suites (4 suites, 43 tests total)**:

- **tests/client.test.ts** - GremlinClient functionality with comprehensive mocking (16 tests)
- **tests/models.test.ts** - Zod schema validation and type checking (16 tests)
- **tests/exceptions.test.ts** - Error handling and exception classes (5 tests)
- **tests/mcp-integration.test.ts** - End-to-end MCP server integration (6 tests)

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

All environment variables are validated through Zod schemas:

- **GREMLIN_ENDPOINT** (required) - Server endpoint (host:port or host:port/traversal_source)
- **GREMLIN_USE_SSL** (optional) - Enable SSL/TLS connections (default: false)
- **GREMLIN_USERNAME** (optional) - Authentication username
- **GREMLIN_PASSWORD** (optional) - Authentication password
- **GREMLIN_IDLE_TIMEOUT** (optional) - Connection idle timeout in seconds (default: 300)
- **LOG_LEVEL** (optional) - Logging level: error, warn, info, debug (default: info)

### Error Handling

- **GremlinException** - Custom exception class with modern TypeScript patterns
- **Comprehensive error handling** - All operations wrapped with try/catch
- **Graceful degradation** - Schema operations fall back to cached data when possible
- **Detailed error messages** - Include context and troubleshooting information

### Performance Considerations

- **Connection pooling** - Single connection with idle timeout management
- **Schema caching** - Cached schema with configurable refresh intervals
- **Batch processing** - Import operations use configurable batch sizes
- **Lazy initialization** - Graph client created only when needed

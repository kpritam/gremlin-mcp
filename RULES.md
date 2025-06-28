# Development Rules for Gremlin MCP Server

These rules must be followed when working on this project.

## Code Quality Standards

- All functions must implement structured error handling with specific failure modes
- Use TypeScript types and Zod schemas for runtime validation
- Scripts must verify preconditions before executing critical operations
- Follow existing code patterns and modular architecture

## Design Philosophy Principles

**KISS (Keep It Simple, Stupid)**

- Solutions must be straightforward and easy to understand
- Avoid over-engineering or unnecessary abstraction
- Prioritize code readability and maintainability

**YAGNI (You Aren't Gonna Need It)**

- Do not add speculative features unless explicitly required
- Focus only on immediate requirements and deliverables
- Minimize code bloat and technical debt

**SOLID Principles**

- Single Responsibility: each module should do one thing only
- Open-Closed: open for extension, closed for modification
- Interface Segregation: prefer specific interfaces over general ones
- Dependency Inversion: depend on abstractions, not implementations

## Gremlin Database Integration

- Support any Gremlin-compatible database (Apache TinkerPop, Neptune, etc.)
- Use `GremlinClient`, `GremlinConfig`, `GremlinException` naming
- Never hardcode database-specific assumptions
- Always validate Gremlin queries before execution
- Handle connection failures gracefully with proper error messages

## Security

- Never hardcode credentials - use environment variables
- Validate all inputs with Zod schemas
- Sanitize Gremlin queries to prevent injection
- Use principle of least privilege for database operations
- Log operations without exposing sensitive data

## Testing

- Write unit tests for all new functionality
- Use integration tests for database operations
- Run `npm run validate` before commits
- Maintain test coverage above 85%
- Mock external dependencies in unit tests

## Configuration

- Use Zod-based environment validation in config.ts
- Access config via exported ENV object
- Provide sensible defaults in constants.ts
- Document all environment variables

## Architecture

- Keep modules focused on single responsibilities
- Extract utilities to utils/ directory
- Use TypeScript generics for reusable components
- Follow existing error handling patterns
- Maintain separation between MCP handlers and business logic

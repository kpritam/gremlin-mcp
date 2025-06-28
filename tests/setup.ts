/**
 * Jest setup file for Gremlin MCP Server tests.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GREMLIN_ENDPOINT = 'localhost:8182/g';
process.env.GREMLIN_USE_SSL = 'false';

// Suppress console logs during tests unless specifically testing logging
if (!process.env.DEBUG_TESTS) {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
}

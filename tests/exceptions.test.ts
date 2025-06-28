/**
 * Tests for Gremlin exception handling.
 */

import { GremlinException } from '../src/gremlin/client.js';

describe('GremlinException', () => {
  it('should create exception from string message', () => {
    const message = 'Test error message';
    const exception = new GremlinException(message);

    expect(exception.message).toBe(message);
    expect(exception.details).toBeUndefined();
    expect(exception.name).toBe('GremlinException');
  });

  it('should create exception from object with message and details', () => {
    const errorInfo = {
      message: 'Connection failed',
      details: { host: 'localhost', port: 8182, error: 'ECONNREFUSED' },
    };
    const exception = new GremlinException(errorInfo);

    expect(exception.message).toBe(errorInfo.message);
    expect(exception.details).toEqual(errorInfo.details);
    expect(exception.name).toBe('GremlinException');
  });

  it('should handle object with missing details', () => {
    const errorInfo = {
      message: 'Test message',
    };
    const exception = new GremlinException(errorInfo);

    expect(exception.message).toBe(errorInfo.message);
    expect(exception.details).toBeUndefined();
  });

  it('should serialize to JSON correctly', () => {
    const errorInfo = {
      message: 'Test error',
      details: { code: 500, description: 'Internal error' },
    };
    const exception = new GremlinException(errorInfo);

    const json = exception.toJSON();
    expect(json).toEqual({
      message: errorInfo.message,
      details: errorInfo.details,
      stack: exception.stack,
    });
  });

  it('should maintain proper stack trace', () => {
    const exception = new GremlinException('Test error');
    expect(exception.stack).toBeDefined();
    expect(exception.stack).toContain('GremlinException');
  });

  it('should be instanceof Error and GremlinException', () => {
    const exception = new GremlinException('Test error');
    expect(exception).toBeInstanceOf(Error);
    expect(exception).toBeInstanceOf(GremlinException);
  });
});

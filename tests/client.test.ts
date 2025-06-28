/**
 * Tests for Gremlin client functionality.
 */

import { GremlinClient, GremlinException } from '../src/gremlin/client.js';
import type { GremlinConfig } from '../src/gremlin/models.js';

// Mock the gremlin module
jest.mock('gremlin', () => {
  const mockClient = jest.fn();
  const mockDriverRemoteConnection = jest.fn();
  const mockTraversal = jest.fn();

  return {
    __esModule: true,
    default: {
      driver: {
        Client: mockClient,
        DriverRemoteConnection: mockDriverRemoteConnection,
      },
      process: {
        AnonymousTraversalSource: {
          traversal: mockTraversal,
        },
        statics: {},
      },
    },
  };
});

// Mock the logger
jest.mock('../src/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('GremlinClient', () => {
  let config: GremlinConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      host: 'localhost',
      port: 8182,
      traversalSource: 'g',
      useSSL: false,
      idleTimeoutSeconds: 300,
      enumDiscoveryEnabled: true,
      enumCardinalityThreshold: 50,
      enumPropertyBlacklist: [],
      includeSampleValues: false,
      maxEnumValues: 10,
      includeCounts: true,
    };
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const client = new GremlinClient(config);
      expect(client).toBeInstanceOf(GremlinClient);
    });

    it('should create client with SSL config', () => {
      const sslConfig = { ...config, useSSL: true };
      const client = new GremlinClient(sslConfig);
      expect(client).toBeInstanceOf(GremlinClient);
    });

    it('should create client with authentication', () => {
      const authConfig = { ...config, username: 'user', password: 'pass' };
      const client = new GremlinClient(authConfig);
      expect(client).toBeInstanceOf(GremlinClient);
    });
  });

  describe('GremlinException', () => {
    it('should create exception with string message', () => {
      const exception = new GremlinException('Test error');
      expect(exception.message).toBe('Test error');
      expect(exception.details).toBeUndefined();
    });

    it('should create exception with options object', () => {
      const options = {
        message: 'Test error',
        details: { code: 500 },
        cause: new Error('Original error'),
      };
      const exception = new GremlinException(options);
      expect(exception.message).toBe('Test error');
      expect(exception.details).toEqual({ code: 500 });
      expect(exception.cause).toBeInstanceOf(Error);
    });

    it('should serialize to JSON correctly', () => {
      const exception = new GremlinException({
        message: 'Test error',
        details: { code: 500 },
      });
      const json = exception.toJSON();
      expect(json.message).toBe('Test error');
      expect(json.details).toEqual({ code: 500 });
      expect(json.stack).toBeDefined();
    });
  });

  describe('status methods', () => {
    it('should return Not Connected when no traversal source', async () => {
      const client = new GremlinClient(config);
      const status = await client.getStatus();
      expect(status).toBe('Not Connected');
    });

    it('should perform health check', async () => {
      const client = new GremlinClient(config);
      const health = await client.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.details).toContain('Could not initialize Gremlin connection');
    });
  });
});

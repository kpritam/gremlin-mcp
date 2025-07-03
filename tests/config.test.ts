/**
 * Tests for Effect-based configuration management and validation.
 */

import { Effect } from 'effect';
import { AppConfig, type AppConfigType } from '../src/config.js';

describe('Effect-based Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('AppConfig Effect', () => {
    it('should validate a complete configuration', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182/g';
      process.env.GREMLIN_USE_SSL = 'false';
      process.env.GREMLIN_USERNAME = 'testuser';
      process.env.GREMLIN_PASSWORD = 'testpass';
      process.env.LOG_LEVEL = 'info';
      process.env.GREMLIN_IDLE_TIMEOUT = '300';
      process.env.GREMLIN_ENUM_DISCOVERY_ENABLED = 'true';
      process.env.GREMLIN_ENUM_CARDINALITY_THRESHOLD = '10';
      process.env.GREMLIN_ENUM_PROPERTY_BLACKLIST = 'id,pk,name';
      process.env.GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES = 'false';
      process.env.GREMLIN_SCHEMA_MAX_ENUM_VALUES = '10';
      process.env.GREMLIN_SCHEMA_INCLUDE_COUNTS = 'true';

      const result = Effect.runSync(AppConfig);

      expect(result).toMatchObject({
        gremlinHost: 'localhost',
        gremlinPort: 8182,
        gremlinTraversalSource: 'g',
        gremlinUseSSL: false,
        gremlinIdleTimeout: 300,
        gremlinEnumDiscoveryEnabled: true,
        gremlinEnumCardinalityThreshold: 10,
        gremlinEnumPropertyBlacklist: ['id', 'pk', 'name'],
        gremlinSchemaIncludeSampleValues: false,
        gremlinSchemaMaxEnumValues: 10,
        gremlinSchemaIncludeCounts: true,
        logLevel: 'info',
        serverName: 'gremlin-mcp',
        serverVersion: '0.0.3',
      });
    });

    it('should handle minimal configuration with defaults', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';

      const result = Effect.runSync(AppConfig);

      expect(result).toMatchObject({
        gremlinHost: 'localhost',
        gremlinPort: 8182,
        gremlinTraversalSource: 'g',
        gremlinUseSSL: false,
        gremlinIdleTimeout: 300,
        gremlinEnumDiscoveryEnabled: true,
        gremlinEnumCardinalityThreshold: 10,
        gremlinSchemaIncludeSampleValues: false,
        gremlinSchemaMaxEnumValues: 10,
        gremlinSchemaIncludeCounts: true,
        logLevel: 'info',
      });
    });

    it('should fail when required GREMLIN_ENDPOINT is missing', () => {
      delete process.env.GREMLIN_ENDPOINT;

      expect(() => Effect.runSync(AppConfig)).toThrow();
    });

    it('should parse boolean values correctly', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_USE_SSL = 'true';
      process.env.GREMLIN_ENUM_DISCOVERY_ENABLED = '1';
      process.env.GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES = 't';
      process.env.GREMLIN_SCHEMA_INCLUDE_COUNTS = 'false';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinUseSSL).toBe(true);
      expect(result.gremlinEnumDiscoveryEnabled).toBe(true);
      expect(result.gremlinSchemaIncludeSampleValues).toBe(true);
      expect(result.gremlinSchemaIncludeCounts).toBe(false);
    });

    it('should parse endpoint with traversal source', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182/custom';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinHost).toBe('localhost');
      expect(result.gremlinPort).toBe(8182);
      expect(result.gremlinTraversalSource).toBe('custom');
    });

    it('should parse comma-separated blacklist', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_ENUM_PROPERTY_BLACKLIST = 'id, pk, name, description';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinEnumPropertyBlacklist).toEqual(['id', 'pk', 'name', 'description']);
    });

    it('should validate log level enum', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.LOG_LEVEL = 'debug';

      const result = Effect.runSync(AppConfig);

      expect(result.logLevel).toBe('debug');
    });

    it('should fail with invalid log level', () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.LOG_LEVEL = 'invalid';

      expect(() => Effect.runSync(AppConfig)).toThrow();
    });

    it('should parse numeric values correctly', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_IDLE_TIMEOUT = '600';
      process.env.GREMLIN_ENUM_CARDINALITY_THRESHOLD = '20';
      process.env.GREMLIN_SCHEMA_MAX_ENUM_VALUES = '15';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinIdleTimeout).toBe(600);
      expect(result.gremlinEnumCardinalityThreshold).toBe(20);
      expect(result.gremlinSchemaMaxEnumValues).toBe(15);
    });

    it('should handle optional authentication fields', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_USERNAME = 'testuser';
      process.env.GREMLIN_PASSWORD = 'testpass';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinUsername).toBeDefined();
      expect(result.gremlinPassword).toBeDefined();
    });

    it('should handle missing optional authentication fields', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      delete process.env.GREMLIN_USERNAME;
      delete process.env.GREMLIN_PASSWORD;

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinUsername).toBeDefined(); // Should be Option.none()
      expect(result.gremlinPassword).toBeDefined(); // Should be Option.none()
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error for invalid endpoint format', () => {
      process.env.GREMLIN_ENDPOINT = 'invalid-endpoint';

      expect(() => Effect.runSync(AppConfig)).toThrow(/Invalid endpoint format/);
    });

    it('should provide meaningful error for invalid port', () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:invalid';

      expect(() => Effect.runSync(AppConfig)).toThrow(/Port must be a positive integer/);
    });

    it('should provide meaningful error for empty endpoint', () => {
      process.env.GREMLIN_ENDPOINT = '';

      expect(() => Effect.runSync(AppConfig)).toThrow();
    });

    it('should handle missing host or port', () => {
      process.env.GREMLIN_ENDPOINT = ':8182';

      expect(() => Effect.runSync(AppConfig)).toThrow(/Host and port are required/);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate all required configuration fields are present', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182/g';

      const result = Effect.runSync(AppConfig);

      // Check all required fields are present
      expect(result.gremlinHost).toBeDefined();
      expect(result.gremlinPort).toBeDefined();
      expect(result.gremlinTraversalSource).toBeDefined();
      expect(result.gremlinUseSSL).toBeDefined();
      expect(result.gremlinIdleTimeout).toBeDefined();
      expect(result.gremlinEnumDiscoveryEnabled).toBeDefined();
      expect(result.gremlinEnumCardinalityThreshold).toBeDefined();
      expect(result.gremlinEnumPropertyBlacklist).toBeDefined();
      expect(result.gremlinSchemaIncludeSampleValues).toBeDefined();
      expect(result.gremlinSchemaMaxEnumValues).toBeDefined();
      expect(result.gremlinSchemaIncludeCounts).toBeDefined();
      expect(result.serverName).toBeDefined();
      expect(result.serverVersion).toBeDefined();
      expect(result.logLevel).toBeDefined();
    });

    it('should have correct default values', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlinTraversalSource).toBe('g');
      expect(result.gremlinUseSSL).toBe(false);
      expect(result.gremlinIdleTimeout).toBe(300);
      expect(result.gremlinEnumDiscoveryEnabled).toBe(true);
      expect(result.gremlinEnumCardinalityThreshold).toBe(10);
      expect(result.gremlinSchemaIncludeSampleValues).toBe(false);
      expect(result.gremlinSchemaMaxEnumValues).toBe(10);
      expect(result.gremlinSchemaIncludeCounts).toBe(true);
      expect(result.logLevel).toBe('info');
    });

    it('should use Effect for type-safe configuration access', () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';

      // Test that AppConfig is an Effect
      expect(Effect.isEffect(AppConfig)).toBe(true);

      // Test type compatibility
      const testEffect: Effect.Effect<AppConfigType, any> = AppConfig;
      expect(Effect.isEffect(testEffect)).toBe(true);
    });
  });
});

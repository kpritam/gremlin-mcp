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
        gremlin: {
          host: 'localhost',
          port: 8182,
          traversalSource: 'g',
          useSSL: false,
          idleTimeout: 300,
        },
        schema: {
          enumDiscoveryEnabled: true,
          enumCardinalityThreshold: 10,
          enumPropertyBlacklist: ['id', 'pk', 'name'],
          includeSampleValues: false,
          maxEnumValues: 10,
          includeCounts: true,
        },
        logging: {
          level: 'info',
        },
        server: {
          name: 'gremlin-mcp',
          version: '0.0.3',
        },
      });
    });

    it('should handle minimal configuration with defaults', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';

      const result = Effect.runSync(AppConfig);

      expect(result).toMatchObject({
        gremlin: {
          host: 'localhost',
          port: 8182,
          traversalSource: 'g',
          useSSL: false,
          idleTimeout: 300,
        },
        schema: {
          enumDiscoveryEnabled: true,
          enumCardinalityThreshold: 10,
          includeSampleValues: false,
          maxEnumValues: 10,
          includeCounts: true,
        },
        logging: {
          level: 'info',
        },
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

      expect(result.gremlin.useSSL).toBe(true);
      expect(result.schema.enumDiscoveryEnabled).toBe(true);
      expect(result.schema.includeSampleValues).toBe(true);
      expect(result.schema.includeCounts).toBe(false);
    });

    it('should parse endpoint with traversal source', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182/custom';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlin.host).toBe('localhost');
      expect(result.gremlin.port).toBe(8182);
      expect(result.gremlin.traversalSource).toBe('custom');
    });

    it('should parse comma-separated blacklist', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_ENUM_PROPERTY_BLACKLIST = 'id, pk, name, description';

      const result = Effect.runSync(AppConfig);

      expect(result.schema.enumPropertyBlacklist).toEqual(['id', 'pk', 'name', 'description']);
    });

    it('should validate log level enum', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.LOG_LEVEL = 'debug';

      const result = Effect.runSync(AppConfig);

      expect(result.logging.level).toBe('debug');
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

      expect(result.gremlin.idleTimeout).toBe(600);
      expect(result.schema.enumCardinalityThreshold).toBe(20);
      expect(result.schema.maxEnumValues).toBe(15);
    });

    it('should handle optional authentication fields', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      process.env.GREMLIN_USERNAME = 'testuser';
      process.env.GREMLIN_PASSWORD = 'testpass';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlin.username).toBeDefined();
      expect(result.gremlin.password).toBeDefined();
    });

    it('should handle missing optional authentication fields', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';
      delete process.env.GREMLIN_USERNAME;
      delete process.env.GREMLIN_PASSWORD;

      const result = Effect.runSync(AppConfig);

      expect(result.gremlin.username).toBeDefined(); // Should be Option.none()
      expect(result.gremlin.password).toBeDefined(); // Should be Option.none()
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
      expect(result.gremlin.host).toBeDefined();
      expect(result.gremlin.port).toBeDefined();
      expect(result.gremlin.traversalSource).toBeDefined();
      expect(result.gremlin.useSSL).toBeDefined();
      expect(result.gremlin.idleTimeout).toBeDefined();
      expect(result.schema.enumDiscoveryEnabled).toBeDefined();
      expect(result.schema.enumCardinalityThreshold).toBeDefined();
      expect(result.schema.enumPropertyBlacklist).toBeDefined();
      expect(result.schema.includeSampleValues).toBeDefined();
      expect(result.schema.maxEnumValues).toBeDefined();
      expect(result.schema.includeCounts).toBeDefined();
      expect(result.server.name).toBeDefined();
      expect(result.server.version).toBeDefined();
      expect(result.logging.level).toBeDefined();
    });

    it('should have correct default values', async () => {
      process.env.GREMLIN_ENDPOINT = 'localhost:8182';

      const result = Effect.runSync(AppConfig);

      expect(result.gremlin.traversalSource).toBe('g');
      expect(result.gremlin.useSSL).toBe(false);
      expect(result.gremlin.idleTimeout).toBe(300);
      expect(result.schema.enumDiscoveryEnabled).toBe(true);
      expect(result.schema.enumCardinalityThreshold).toBe(10);
      expect(result.schema.includeSampleValues).toBe(false);
      expect(result.schema.maxEnumValues).toBe(10);
      expect(result.schema.includeCounts).toBe(true);
      expect(result.logging.level).toBe('info');
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

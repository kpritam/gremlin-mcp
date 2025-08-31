/**
 * @fileoverview Query result models for Gremlin database responses.
 */

import { z } from 'zod';

/**
 * Gremlin vertex with full structure.
 */
export const GremlinVertexSchema = z.object({
  id: z.union([z.string(), z.number(), z.object({})]),
  label: z.string().min(1, 'Vertex label cannot be empty'),
  properties: z.record(z.string(), z.array(z.unknown())).optional(),
  type: z.literal('vertex'),
});

export type GremlinVertex = z.infer<typeof GremlinVertexSchema>;

/**
 * Gremlin edge with full structure.
 */
export const GremlinEdgeSchema = z.object({
  id: z.union([z.string(), z.number(), z.object({})]),
  label: z.string().min(1, 'Edge label cannot be empty'),
  inV: z.union([z.string(), z.number(), z.object({})]),
  outV: z.union([z.string(), z.number(), z.object({})]),
  properties: z.record(z.string(), z.array(z.unknown())).optional(),
  type: z.literal('edge'),
});

export type GremlinEdge = z.infer<typeof GremlinEdgeSchema>;

/**
 * Gremlin property map (from valueMap() queries).
 */
export const GremlinPropertyMapSchema = z.record(z.array(z.unknown()));
export type GremlinPropertyMap = z.infer<typeof GremlinPropertyMapSchema>;

/**
 * Gremlin path result (from path() queries).
 */
export const GremlinPathSchema = z.object({
  labels: z.array(z.string()),
  objects: z.array(z.unknown()),
  type: z.literal('path'),
});

export type GremlinPath = z.infer<typeof GremlinPathSchema>;

/**
 * Gremlin property result.
 */
export const GremlinPropertySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  type: z.literal('property'),
});

export type GremlinProperty = z.infer<typeof GremlinPropertySchema>;

/**
 * Structured Gremlin result types with discriminated union.
 */
export const GremlinStructuredResultSchema = z.discriminatedUnion('type', [
  GremlinVertexSchema,
  GremlinEdgeSchema,
  GremlinPathSchema,
  GremlinPropertySchema,
]);

/**
 * Generic objects without 'type' field.
 */
const GenericObjectSchema = z
  .record(z.unknown())
  .refine(obj => !('type' in obj) || typeof obj['type'] !== 'string', {
    message: "Objects with 'type' field must use structured schemas",
  });

/**
 * Recursive array validation.
 */
const ValidatedArraySchema: z.ZodType<unknown[]> = z.lazy(() => z.array(GremlinResultItemSchema));

/**
 * Union type for all possible Gremlin query results.
 */
export const GremlinResultItemSchema = z.union([
  GremlinStructuredResultSchema,
  GremlinPropertyMapSchema,
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  ValidatedArraySchema,
  GenericObjectSchema,
]);

export type GremlinStructuredResult = z.infer<typeof GremlinStructuredResultSchema>;
export type GremlinResultItem = z.infer<typeof GremlinResultItemSchema>;

/**
 * Gremlin query result with typed results and status.
 */
export const GremlinQueryResultSchema = z.object({
  /** Query results array with typed items */
  results: z.array(GremlinResultItemSchema),
  /** Status message about the query execution */
  message: z.string(),
});

export type GremlinQueryResult = z.infer<typeof GremlinQueryResultSchema>;

/**
 * Input schema for Gremlin query operations.
 */
export const GremlinQueryInputSchema = z.object({
  query: z
    .string()
    .min(1, 'Query cannot be empty')
    .describe('The Gremlin query to execute against the graph database'),
});

export type GremlinQueryInput = z.infer<typeof GremlinQueryInputSchema>;

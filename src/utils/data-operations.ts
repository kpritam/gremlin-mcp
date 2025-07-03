/**
 * Effect-based data operations for import/export functionality.
 * Provides composable operations for graph data management.
 */

import { Effect } from 'effect';
import { type ImportDataInput, type ExportSubgraphInput } from '../gremlin/models.js';
import { GremlinService } from '../gremlin/service.js';
import { Errors, ResourceError, GremlinConnectionError, GremlinQueryError } from '../errors.js';

/**
 * Type guard to check if a value is a record object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Import graph data using Effect patterns
 */
export const importGraphData = (
  service: typeof GremlinService.Service,
  input: ImportDataInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Starting import operation: format=${input.format}, size=${input.data.length} chars`
    );

    try {
      switch (input.format) {
        case 'graphson':
          return yield* importGraphSON(service, input);

        case 'csv':
          return yield* importCSV(service, input);

        default:
          return yield* Effect.fail(
            Errors.resource(`Unsupported import format: ${input.format}`, 'import_operation')
          );
      }
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Import operation failed', 'import_operation', error)
      );
    }
  });

/**
 * Export subgraph data using Effect patterns
 */
export const exportSubgraph = (
  service: typeof GremlinService.Service,
  input: ExportSubgraphInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(
      `Starting export operation: format=${input.format}, query=${input.traversal_query}`
    );

    try {
      // Execute the traversal query to get the subgraph data
      const queryResult = yield* service.executeQuery(input.traversal_query);

      switch (input.format) {
        case 'graphson':
          return yield* exportToGraphSON(queryResult.results, input);

        case 'json':
          return yield* exportToJSON(queryResult.results, input);

        case 'csv':
          return yield* exportToCSV(queryResult.results, input);

        default:
          return yield* Effect.fail(
            Errors.resource(`Unsupported export format: ${input.format}`, 'export_operation')
          );
      }
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Export operation failed', 'export_operation', error)
      );
    }
  });

/**
 * Clear graph data if requested
 */
const clearGraphIfRequested = (
  service: typeof GremlinService.Service,
  shouldClear: boolean | undefined
): Effect.Effect<void, GremlinConnectionError | GremlinQueryError> =>
  shouldClear
    ? Effect.gen(function* () {
        yield* service.executeQuery('g.V().drop()');
        yield* service.executeQuery('g.E().drop()');
        yield* Effect.logInfo('Graph cleared before import');
      })
    : Effect.void;

/**
 * Import vertices from GraphSON data
 */
const importVertices = (
  service: typeof GremlinService.Service,
  vertices: any[]
): Effect.Effect<void, GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    for (const vertex of vertices) {
      const query = buildVertexInsertQuery(vertex);
      yield* service.executeQuery(query);
    }
    yield* Effect.logInfo(`Imported ${vertices.length} vertices`);
  });

/**
 * Import edges from GraphSON data
 */
const importEdges = (
  service: typeof GremlinService.Service,
  edges: any[]
): Effect.Effect<void, GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    for (const edge of edges) {
      const query = buildEdgeInsertQuery(edge);
      yield* service.executeQuery(query);
    }
    yield* Effect.logInfo(`Imported ${edges.length} edges`);
  });

/**
 * Build GraphSON import summary
 */
const buildImportSummary = (vertexCount: number, edgeCount: number): string =>
  `GraphSON import completed successfully. Vertices: ${vertexCount}, Edges: ${edgeCount}`;

/**
 * Import GraphSON format data
 */
const importGraphSON = (
  service: typeof GremlinService.Service,
  input: ImportDataInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    try {
      const data = JSON.parse(input.data);

      yield* clearGraphIfRequested(service, input.options?.clear_graph);

      if (data.vertices) {
        yield* importVertices(service, data.vertices);
      }

      if (data.edges) {
        yield* importEdges(service, data.edges);
      }

      return buildImportSummary(data.vertices?.length || 0, data.edges?.length || 0);
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Failed to parse or import GraphSON data', 'graphson_import', error)
      );
    }
  });

/**
 * Parse CSV data into headers and rows
 */
const parseCSVData = (csvData: string): { headers: string[]; dataRows: string[] } => {
  const lines = csvData.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(',').map(h => h.trim()) || [];
  const dataRows = lines.slice(1);
  return { headers, dataRows };
};

/**
 * Process a single CSV row into vertex properties
 */
const processCSVRow = (row: string, headers: string[]): Record<string, string> => {
  const values = row.split(',').map(v => v.trim());
  return headers.reduce((props: Record<string, string>, header, index) => {
    if (values[index]) {
      props[header] = values[index];
    }
    return props;
  }, {});
};

/**
 * Import vertices from CSV rows
 */
const importCSVVertices = (
  service: typeof GremlinService.Service,
  dataRows: string[],
  headers: string[]
): Effect.Effect<void, GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    for (const row of dataRows) {
      const properties = processCSVRow(row, headers);
      const query = buildCSVVertexInsertQuery(properties);
      yield* service.executeQuery(query);
    }
    yield* Effect.logInfo(`Imported ${dataRows.length} vertices from CSV`);
  });

/**
 * Import CSV format data
 */
const importCSV = (
  service: typeof GremlinService.Service,
  input: ImportDataInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    try {
      const { headers, dataRows } = parseCSVData(input.data);

      yield* clearGraphIfRequested(service, input.options?.clear_graph);
      yield* importCSVVertices(service, dataRows, headers);

      return `CSV import completed successfully. Processed ${dataRows.length} rows.`;
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Failed to parse or import CSV data', 'csv_import', error)
      );
    }
  });

/**
 * Export to GraphSON format
 */
const exportToGraphSON = (
  results: unknown[],
  _input: ExportSubgraphInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    try {
      const graphsonData = {
        vertices: results.filter(
          r => typeof r === 'object' && r !== null && 'type' in r && r.type === 'vertex'
        ),
        edges: results.filter(
          r => typeof r === 'object' && r !== null && 'type' in r && r.type === 'edge'
        ),
      };

      return JSON.stringify(graphsonData, null, 2);
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Failed to export to GraphSON format', 'graphson_export', error)
      );
    }
  });

/**
 * Export to JSON format
 */
const exportToJSON = (
  results: unknown[],
  input: ExportSubgraphInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    try {
      const filteredResults =
        input.include_properties || input.exclude_properties
          ? results.map(result => filterProperties(result, input))
          : results;

      return JSON.stringify(filteredResults, null, 2);
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Failed to export to JSON format', 'json_export', error)
      );
    }
  });

/**
 * Export to CSV format
 */
const exportToCSV = (
  results: unknown[],
  _input: ExportSubgraphInput
): Effect.Effect<string, ResourceError | GremlinConnectionError | GremlinQueryError> =>
  Effect.gen(function* () {
    try {
      if (results.length === 0) {
        return '';
      }

      // Extract all unique property keys
      const allKeys = new Set<string>();
      results.forEach(result => {
        if (typeof result === 'object' && result !== null) {
          Object.keys(result).forEach(key => allKeys.add(key));
        }
      });

      const headers = Array.from(allKeys);
      const csvLines = [headers.join(',')];

      results.forEach(result => {
        if (isRecord(result)) {
          const row = headers.map(header => {
            const value = result[header];
            return value !== undefined ? String(value) : '';
          });
          csvLines.push(row.join(','));
        }
      });

      return csvLines.join('\n');
    } catch (error) {
      return yield* Effect.fail(
        Errors.resource('Failed to export to CSV format', 'csv_export', error)
      );
    }
  });

/**
 * Helper functions for query building
 */
function buildVertexInsertQuery(vertex: Record<string, unknown>): string {
  const label = vertex['label'] || 'vertex';
  const id = vertex['id'];
  const properties = vertex['properties'] || {};

  let query = `g.addV('${label}')`;

  if (id !== undefined) {
    query += `.property(id, '${id}')`;
  }

  for (const [key, value] of Object.entries(properties)) {
    if (Array.isArray(value)) {
      // Handle multi-value properties
      value.forEach(v => {
        query += `.property('${key}', '${v}')`;
      });
    } else {
      query += `.property('${key}', '${value}')`;
    }
  }

  return query;
}

function buildEdgeInsertQuery(edge: Record<string, unknown>): string {
  const label = edge['label'] || 'edge';
  const outV = edge['outV'];
  const inV = edge['inV'];
  const properties = edge['properties'] || {};

  let query = `g.V('${outV}').addE('${label}').to(g.V('${inV}'))`;

  for (const [key, value] of Object.entries(properties)) {
    query += `.property('${key}', '${value}')`;
  }

  return query;
}

function buildCSVVertexInsertQuery(properties: Record<string, string>): string {
  let query = "g.addV('data')";

  for (const [key, value] of Object.entries(properties)) {
    if (key && value) {
      query += `.property('${key}', '${value}')`;
    }
  }

  return query;
}

function filterProperties(result: unknown, input: ExportSubgraphInput): unknown {
  if (typeof result !== 'object' || result === null) {
    return result;
  }

  if (!isRecord(result)) {
    return result;
  }

  if (input.include_properties) {
    const filtered: Record<string, unknown> = {};
    input.include_properties.forEach(prop => {
      if (prop in result) {
        filtered[prop] = result[prop];
      }
    });
    return filtered;
  }

  if (input.exclude_properties) {
    const filtered = { ...result };
    input.exclude_properties.forEach(prop => {
      delete filtered[prop];
    });
    return filtered;
  }

  return result;
}

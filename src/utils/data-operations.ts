/**
 * Utility functions for data import/export operations.
 * Simplifies and standardizes data handling logic.
 */

import type { GremlinClient } from '../gremlin/client.js';
import { type ImportDataInput, type ExportSubgraphInput } from '../gremlin/models.js';
import { logger } from '../logger.js';

/**
 * Result type for import operations.
 */
export interface ImportResult {
  success: boolean;
  message: string;
  imported_count?: number;
  details?: unknown;
}

/**
 * Result type for export operations.
 */
export interface ExportResult {
  success: boolean;
  message: string;
  data?: unknown;
  format: string;
  exported_count?: number;
}

/**
 * Import graph data from various formats.
 */
export async function importGraphData(
  client: GremlinClient,
  input: ImportDataInput
): Promise<ImportResult> {
  try {
    const options = input.options || {};

    // Clear graph if requested
    if (options.clear_graph) {
      logger.info('Clearing graph before import');
      await client.executeGremlinQuery('g.V().drop().iterate()');
    }

    let importedCount = 0;

    switch (input.format) {
      case 'graphson':
        importedCount = await importGraphSONData(client, input.data, options);
        break;
      case 'csv':
        importedCount = await importCSVData(client, input.data, options);
        break;
      default:
        throw new Error(`Unsupported format: ${input.format}`);
    }

    return {
      success: true,
      message: `Successfully imported ${importedCount} items`,
      imported_count: importedCount,
    };
  } catch (error) {
    logger.error('Import failed', { error, input });
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      details: error instanceof Error ? error.stack : error,
    };
  }
}

/**
 * Export subgraph data to various formats.
 */
export async function exportSubgraph(
  client: GremlinClient,
  input: ExportSubgraphInput
): Promise<ExportResult> {
  try {
    const result = await client.executeGremlinQuery(input.traversal_query);

    if (!result.results || result.results.length === 0) {
      return {
        success: true,
        message: 'No data found for the given traversal',
        data: [],
        format: input.format,
        exported_count: 0,
      };
    }

    let exportedData: unknown;
    const filteredResults = filterProperties(result.results, input);

    switch (input.format) {
      case 'json':
        exportedData = formatAsJSON(filteredResults);
        break;
      case 'graphson':
        exportedData = formatAsGraphSON(filteredResults);
        break;
      case 'csv':
        exportedData = formatAsCSV(filteredResults);
        break;
      default:
        throw new Error(`Unsupported export format: ${input.format}`);
    }

    return {
      success: true,
      message: `Successfully exported ${filteredResults.length} items`,
      data: exportedData,
      format: input.format,
      exported_count: filteredResults.length,
    };
  } catch (error) {
    logger.error('Export failed', { error, input });
    return {
      success: false,
      message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      format: input.format,
    };
  }
}

/**
 * Import GraphSON format data.
 */
async function importGraphSONData(
  client: GremlinClient,
  data: string,
  options: ImportDataInput['options'] = {}
): Promise<number> {
  const graphsonData = JSON.parse(data);

  if (!Array.isArray(graphsonData)) {
    throw new Error('GraphSON data must be an array');
  }

  const batchSize = options.batch_size || 100;
  let importedCount = 0;

  for (let i = 0; i < graphsonData.length; i += batchSize) {
    const batch = graphsonData.slice(i, i + batchSize);
    const queries: string[] = [];

    for (const item of batch) {
      if (item['@type'] === 'g:Vertex') {
        queries.push(buildVertexQuery(item['@value']));
      } else if (item['@type'] === 'g:Edge') {
        queries.push(buildEdgeQuery(item['@value']));
      }
    }

    if (queries.length > 0) {
      const batchQuery = queries.join('; ');
      await client.executeGremlinQuery(batchQuery);
      importedCount += queries.length;
    }
  }

  return importedCount;
}

/**
 * Import CSV format data.
 */
async function importCSVData(
  client: GremlinClient,
  data: string,
  options: ImportDataInput['options'] = {}
): Promise<number> {
  const lines = data.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV data must have at least a header and one data row');
  }

  const headers = lines[0]!.split(',').map(h => h.trim());
  const batchSize = options.batch_size || 100;
  let importedCount = 0;

  for (let i = 1; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);
    const queries: string[] = [];

    for (const line of batch) {
      const values = line.split(',').map(v => v.trim());
      if (values.length === headers.length) {
        queries.push(buildCSVVertexQuery(headers, values));
      }
    }

    if (queries.length > 0) {
      const batchQuery = queries.join('; ');
      await client.executeGremlinQuery(batchQuery);
      importedCount += queries.length;
    }
  }

  return importedCount;
}

/**
 * Build Gremlin query for a vertex from GraphSON data.
 */
function buildVertexQuery(vertex: Record<string, unknown>): string {
  const label = String(vertex['label'] || 'vertex');
  let query = `g.addV('${sanitizeString(label)}')`;

  if (vertex['properties']) {
    const properties = vertex['properties'];
    if (typeof properties === 'object' && properties !== null) {
      for (const [propName, propValues] of Object.entries(properties)) {
        if (Array.isArray(propValues) && propValues.length > 0) {
          const valueObj = propValues[0];
          let value: unknown;
          if (typeof valueObj === 'object' && valueObj !== null && '@value' in valueObj) {
            const valueContainer = valueObj as Record<string, unknown>;
            const atValue = valueContainer['@value'];
            if (typeof atValue === 'object' && atValue !== null && 'value' in atValue) {
              value = (atValue as Record<string, unknown>)['value'];
            } else {
              value = atValue;
            }
          } else {
            value = valueObj;
          }
          query += `.property('${sanitizeString(propName)}', '${sanitizeString(String(value))}')`;
        }
      }
    }
  }

  return query;
}

/**
 * Build Gremlin query for an edge from GraphSON data.
 */
function buildEdgeQuery(edge: Record<string, unknown>): string {
  const label = String(edge['label'] || 'edge');
  const outV = String(edge['outV'] || '');
  const inV = String(edge['inV'] || '');
  let query = `g.V('${sanitizeString(outV)}').addE('${sanitizeString(label)}').to(g.V('${sanitizeString(inV)}'))`;

  if (edge['properties']) {
    const properties = edge['properties'];
    if (typeof properties === 'object' && properties !== null) {
      for (const [propName, propValue] of Object.entries(properties)) {
        query += `.property('${sanitizeString(propName)}', '${sanitizeString(String(propValue))}')`;
      }
    }
  }

  return query;
}

/**
 * Build Gremlin query for a vertex from CSV data.
 */
function buildCSVVertexQuery(headers: string[], values: string[]): string {
  let query = "g.addV('csvVertex')";

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = values[i];
    if (header && value && value !== '') {
      query += `.property('${sanitizeString(header)}', '${sanitizeString(value)}')`;
    }
  }

  return query;
}

/**
 * Filter properties based on include/exclude lists.
 */
function filterProperties(results: unknown[], input: ExportSubgraphInput): unknown[] {
  if (!input.include_properties && !input.exclude_properties) {
    return results;
  }

  return results.map(result => {
    if (typeof result !== 'object' || result === null) {
      return result;
    }

    const filtered = { ...result } as Record<string, unknown>;

    if (input.include_properties) {
      // Only keep specified properties
      const keep = {} as Record<string, unknown>;
      for (const prop of input.include_properties) {
        if (prop in filtered) {
          keep[prop] = filtered[prop];
        }
      }
      return keep;
    }

    if (input.exclude_properties) {
      // Remove specified properties
      for (const prop of input.exclude_properties) {
        delete filtered[prop];
      }
    }

    return filtered;
  });
}

/**
 * Format results as JSON.
 */
function formatAsJSON(results: unknown[]): unknown {
  return results;
}

/**
 * Format results as GraphSON.
 */
function formatAsGraphSON(results: unknown[]): unknown {
  return results.map(result => ({
    '@type': 'g:Vertex',
    '@value': result,
  }));
}

/**
 * Format results as CSV.
 */
function formatAsCSV(results: unknown[]): string {
  if (results.length === 0) {
    return '';
  }

  // Extract all unique property keys
  const allKeys = new Set<string>();
  for (const result of results) {
    if (typeof result === 'object' && result !== null) {
      Object.keys(result).forEach(key => allKeys.add(key));
    }
  }

  const headers = Array.from(allKeys);
  const csvLines = [headers.join(',')];

  for (const result of results) {
    if (typeof result === 'object' && result !== null) {
      const row = headers.map(header => {
        const value = (result as Record<string, unknown>)[header];
        return value ? String(value).replace(/,/g, ';') : '';
      });
      csvLines.push(row.join(','));
    }
  }

  return csvLines.join('\n');
}

/**
 * Sanitize string for Gremlin query to prevent injection.
 * Basic sanitization - in production, use more robust methods.
 */
function sanitizeString(str: string): string {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

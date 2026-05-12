/**
 * ═══════════════════════════════════════════════════════════════
 *  Schema Parser — "O Leitor do Cardápio"
 * ═══════════════════════════════════════════════════════════════
 *
 *  Takes a raw OpenAPI JSON document and produces a flat array of
 *  ParsedEndpoint objects that the UI layer can render without
 *  any knowledge of the OpenAPI spec itself.
 *
 *  Key responsibilities:
 *  1. Resolve $ref pointers within #/components/schemas
 *  2. Flatten path-level + operation-level parameters
 *  3. Extract request body & response schemas
 *  4. Generate stable, unique IDs for each endpoint
 * ═══════════════════════════════════════════════════════════════
 */

import type {
  OpenApiDocument,
  ParsedEndpoint,
  HttpMethod,
  OperationObject,
  SchemaObject,
  ParameterObject,
  JsonSchemaProperty,
} from '../types/openapi';

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

/* ── $ref resolver ───────────────────────────────────────────── */

/**
 * Resolves a JSON $ref pointer like `#/components/schemas/Aluno`
 * against the root document. Only local refs are supported — no
 * external file resolution (by design: we stay Client-Side only).
 */
function resolveRef(
  doc: OpenApiDocument,
  ref: string
): SchemaObject | JsonSchemaProperty | undefined {
  if (!ref.startsWith('#/')) return undefined;

  const segments = ref.replace('#/', '').split('/');
  let current: unknown = doc;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current as SchemaObject | JsonSchemaProperty | undefined;
}

/**
 * Deep-resolves all $ref fields in a schema property tree.
 * Returns a new object with refs replaced by their resolved values.
 */
function resolveSchemaRefs(
  doc: OpenApiDocument,
  schema: JsonSchemaProperty | SchemaObject
): SchemaObject {
  if ('$ref' in schema && schema.$ref) {
    const resolved = resolveRef(doc, schema.$ref);
    if (resolved) return resolveSchemaRefs(doc, resolved);
  }

  const result: SchemaObject = { ...schema } as SchemaObject;

  // Resolve nested properties
  if (result.properties) {
    const resolvedProps: Record<string, JsonSchemaProperty> = {};
    for (const [key, prop] of Object.entries(result.properties)) {
      if (prop.$ref) {
        const resolved = resolveRef(doc, prop.$ref);
        if (resolved) {
          resolvedProps[key] = resolveSchemaRefs(doc, resolved) as unknown as JsonSchemaProperty;
        } else {
          resolvedProps[key] = prop;
        }
      } else {
        resolvedProps[key] = prop;
      }
    }
    result.properties = resolvedProps;
  }

  // Resolve array items
  if (result.items && '$ref' in result.items && result.items.$ref) {
    const resolved = resolveRef(doc, result.items.$ref);
    if (resolved) {
      result.items = resolveSchemaRefs(doc, resolved) as unknown as JsonSchemaProperty;
    }
  }

  return result;
}

/* ── Request body extraction ─────────────────────────────────── */

function extractRequestBody(
  doc: OpenApiDocument,
  operation: OperationObject
): SchemaObject | undefined {
  const body = operation.requestBody;
  if (!body) return undefined;

  // Prefer application/json
  const jsonMedia = body.content['application/json'];
  if (!jsonMedia?.schema) return undefined;

  const raw = jsonMedia.schema;
  if ('$ref' in raw && raw.$ref) {
    const resolved = resolveRef(doc, raw.$ref);
    if (resolved) return resolveSchemaRefs(doc, resolved);
  }

  return resolveSchemaRefs(doc, raw as SchemaObject);
}

/* ── Response schema extraction ──────────────────────────────── */

function extractResponseSchema(
  doc: OpenApiDocument,
  operation: OperationObject
): SchemaObject | undefined {
  // Look for 200, 201, or default success response
  const successCodes = ['200', '201', '2XX', 'default'];
  for (const code of successCodes) {
    const response = operation.responses[code];
    if (!response?.content) continue;

    const jsonMedia = response.content['application/json'];
    if (!jsonMedia?.schema) continue;

    const raw = jsonMedia.schema;
    if ('$ref' in raw && raw.$ref) {
      const resolved = resolveRef(doc, raw.$ref);
      if (resolved) return resolveSchemaRefs(doc, resolved);
    }

    return resolveSchemaRefs(doc, raw as SchemaObject);
  }

  return undefined;
}

/* ── Main parser ─────────────────────────────────────────────── */

/**
 * Parses an OpenAPI document into a flat, renderable list of endpoints.
 * This is the single entry point for the schema → UI pipeline.
 */
export function parseOpenApiDocument(doc: OpenApiDocument): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    // Path-level parameters (shared across all methods on this path)
    const sharedParams: ParameterObject[] = pathItem.parameters ?? [];

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Merge path-level + operation-level parameters (operation wins on conflict)
      const operationParams = operation.parameters ?? [];
      const mergedParams = [...sharedParams];
      for (const op of operationParams) {
        const existingIdx = mergedParams.findIndex(
          (p) => p.name === op.name && p.in === op.in
        );
        if (existingIdx >= 0) {
          mergedParams[existingIdx] = op;
        } else {
          mergedParams.push(op);
        }
      }

      endpoints.push({
        id: `${method}:${path}`,
        method,
        path,
        summary: operation.summary ?? '',
        description: operation.description ?? '',
        tags: operation.tags ?? [],
        parameters: mergedParams,
        requestBody: extractRequestBody(doc, operation),
        responseSchema: extractResponseSchema(doc, operation),
        deprecated: operation.deprecated ?? false,
        security: operation.security ?? doc.security ?? [],
      });
    }
  }

  return endpoints;
}

/**
 * Extracts all unique tags from the document for sidebar navigation.
 */
export function extractTags(doc: OpenApiDocument): string[] {
  if (doc.tags) {
    return doc.tags.map((t) => t.name);
  }

  // Fallback: collect tags from all operations
  const tagSet = new Set<string>();
  for (const pathItem of Object.values(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation?.tags) {
        operation.tags.forEach((t) => tagSet.add(t));
      }
    }
  }
  return Array.from(tagSet);
}

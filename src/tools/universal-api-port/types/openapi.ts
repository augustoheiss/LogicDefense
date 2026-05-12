/**
 * ═══════════════════════════════════════════════════════════════
 *  OpenAPI Type Definitions — "O Cardápio" (The Menu)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Minimal, pragmatic subset of the OpenAPI 3.0/3.1 spec.
 *  We type only what the dynamic renderer actually consumes.
 *  This is NOT a full OpenAPI SDK — it's a surgical extraction
 *  layer for Client-Side UI generation.
 * ═══════════════════════════════════════════════════════════════
 */

/* ── Primitive JSON Schema types ─────────────────────────────── */

export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object';

export interface JsonSchemaProperty {
  type?: JsonSchemaType;
  description?: string;
  format?: string;          // e.g. 'date', 'email', 'uri', 'date-time'
  enum?: string[];          // fixed value sets
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;         // regex validation
  items?: JsonSchemaProperty; // for type: 'array'
  properties?: Record<string, JsonSchemaProperty>; // for type: 'object'
  required?: string[];      // required sub-properties
  $ref?: string;            // JSON Pointer reference (e.g. '#/components/schemas/Aluno')
}

/* ── Request / Response shapes ───────────────────────────────── */

export interface SchemaObject {
  type?: JsonSchemaType;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  items?: JsonSchemaProperty;
}

export interface MediaTypeObject {
  schema?: SchemaObject | { $ref: string };
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>; // e.g. 'application/json'
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

/* ── Parameters (path, query, header) ────────────────────────── */

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface ParameterObject {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  schema: JsonSchemaProperty;
}

/* ── Operation (a single HTTP method on a path) ──────────────── */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: Record<string, string[]>[];
  deprecated?: boolean;
}

/* ── Path item (all methods on a single URL path) ────────────── */

export type PathItemObject = Partial<Record<HttpMethod, OperationObject>> & {
  parameters?: ParameterObject[]; // shared across all methods on this path
};

/* ── Security scheme ─────────────────────────────────────────── */

export interface SecuritySchemeObject {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'header' | 'query' | 'cookie';
  scheme?: string;   // e.g. 'bearer'
  description?: string;
}

/* ── Server (base URL) ───────────────────────────────────────── */

export interface ServerObject {
  url: string;
  description?: string;
}

/* ── Info block ───────────────────────────────────────────────── */

export interface InfoObject {
  title: string;
  version: string;
  description?: string;
}

/* ── Components (reusable schemas, security, etc.) ───────────── */

export interface ComponentsObject {
  schemas?: Record<string, SchemaObject>;
  securitySchemes?: Record<string, SecuritySchemeObject>;
}

/* ── Root OpenAPI document ───────────────────────────────────── */

export interface OpenApiDocument {
  openapi: string;           // e.g. '3.0.3' or '3.1.0'
  info: InfoObject;
  servers?: ServerObject[];
  paths: Record<string, PathItemObject>;
  components?: ComponentsObject;
  security?: Record<string, string[]>[];
  tags?: { name: string; description?: string }[];
}

/* ── Parsed endpoint (our internal representation) ───────────── */

export interface ParsedEndpoint {
  id: string;               // unique key: `${method}:${path}`
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: ParameterObject[];
  requestBody?: SchemaObject;
  responseSchema?: SchemaObject;
  deprecated: boolean;
  security: Record<string, string[]>[];
}

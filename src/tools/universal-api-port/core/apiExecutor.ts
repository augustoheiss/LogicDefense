/**
 * API Executor — "A Transparência Total"
 * Executes HTTP requests and returns raw, unmodified traces.
 */

import type { HttpMethod, ParsedEndpoint } from '../types/openapi';

export interface RequestTrace {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: number;
}

export interface ResponseTrace {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  timestamp: number;
}

export interface ExecutionResult {
  request: RequestTrace;
  response: ResponseTrace | null;
  error: string | null;
}

export function buildUrl(
  baseUrl: string,
  pathTemplate: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>
): string {
  let resolvedPath = pathTemplate;
  for (const [key, value] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
  }
  const url = new URL(resolvedPath, baseUrl);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== '') url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function executeEndpoint(
  baseUrl: string,
  endpoint: ParsedEndpoint,
  params: {
    pathParams: Record<string, string>;
    queryParams: Record<string, string>;
    headerParams: Record<string, string>;
    body?: unknown;
  },
  authHeaders: Record<string, string> = {}
): Promise<ExecutionResult> {
  const url = buildUrl(baseUrl, endpoint.path, params.pathParams, params.queryParams);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...params.headerParams,
    ...authHeaders,
  };

  const requestTrace: RequestTrace = {
    url, method: endpoint.method,
    headers: { ...headers }, body: params.body, timestamp: Date.now(),
  };

  const startTime = performance.now();
  try {
    const fetchOptions: RequestInit = { method: endpoint.method.toUpperCase(), headers };
    if (params.body && ['post', 'put', 'patch'].includes(endpoint.method)) {
      fetchOptions.body = JSON.stringify(params.body);
    }

    const response = await fetch(url, fetchOptions);
    const durationMs = Math.round(performance.now() - startTime);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    let responseBody: unknown;
    const ct = response.headers.get('content-type') ?? '';
    responseBody = ct.includes('application/json') ? await response.json() : await response.text();

    return {
      request: requestTrace,
      response: { status: response.status, statusText: response.statusText, headers: responseHeaders, body: responseBody, durationMs, timestamp: Date.now() },
      error: null,
    };
  } catch (err) {
    return { request: requestTrace, response: null, error: err instanceof Error ? err.message : 'Unknown fetch error' };
  }
}

/**
 * HAR Exporter — Converts execution history to HAR 1.2 format.
 *
 * HAR (HTTP Archive) is a standard JSON format recognized by
 * Chrome DevTools, Firefox, Charles Proxy, and most API tools.
 * Exporting as HAR lets operators replay, audit, and share
 * their API session with full transparency.
 *
 * Spec: http://www.softwareishard.com/blog/har-12-spec/
 */

import type { ExecutionResult } from './apiExecutor';

/* ── HAR 1.2 type subset ─────────────────────────────────────── */

interface HarHeader {
  name: string;
  value: string;
}

interface HarQueryParam {
  name: string;
  value: string;
}

interface HarPostData {
  mimeType: string;
  text: string;
}

interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  headers: HarHeader[];
  queryString: HarQueryParam[];
  postData?: HarPostData;
  headersSize: number;
  bodySize: number;
}

interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  headers: HarHeader[];
  content: {
    size: number;
    mimeType: string;
    text: string;
  };
  headersSize: number;
  bodySize: number;
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: Record<string, never>;
  timings: {
    send: number;
    wait: number;
    receive: number;
  };
}

interface HarLog {
  version: string;
  creator: {
    name: string;
    version: string;
  };
  entries: HarEntry[];
}

interface HarDocument {
  log: HarLog;
}

/* ── Converters ──────────────────────────────────────────────── */

function headersToHar(headers: Record<string, string>): HarHeader[] {
  return Object.entries(headers).map(([name, value]) => ({ name, value }));
}

function extractQueryParams(url: string): HarQueryParam[] {
  try {
    const parsed = new URL(url);
    const params: HarQueryParam[] = [];
    parsed.searchParams.forEach((value, name) => {
      params.push({ name, value });
    });
    return params;
  } catch {
    return [];
  }
}

function resultToEntry(result: ExecutionResult): HarEntry | null {
  const { request, response } = result;

  // Build request body
  const bodyStr = request.body ? JSON.stringify(request.body) : '';
  const postData: HarPostData | undefined = bodyStr
    ? { mimeType: 'application/json', text: bodyStr }
    : undefined;

  const harRequest: HarRequest = {
    method: request.method.toUpperCase(),
    url: request.url,
    httpVersion: 'HTTP/1.1',
    headers: headersToHar(request.headers),
    queryString: extractQueryParams(request.url),
    headersSize: -1,
    bodySize: bodyStr ? new Blob([bodyStr]).size : 0,
    ...(postData && { postData }),
  };

  // Response (use empty placeholder for failed requests)
  const responseBodyStr = response
    ? JSON.stringify(response.body)
    : '';

  const harResponse: HarResponse = {
    status: response?.status ?? 0,
    statusText: response?.statusText ?? 'ERROR',
    httpVersion: 'HTTP/1.1',
    headers: response ? headersToHar(response.headers) : [],
    content: {
      size: responseBodyStr ? new Blob([responseBodyStr]).size : 0,
      mimeType: 'application/json',
      text: responseBodyStr,
    },
    headersSize: -1,
    bodySize: responseBodyStr ? new Blob([responseBodyStr]).size : 0,
  };

  const duration = response?.durationMs ?? 0;

  return {
    startedDateTime: new Date(request.timestamp).toISOString(),
    time: duration,
    request: harRequest,
    response: harResponse,
    cache: {},
    timings: {
      send: 0,
      wait: duration,
      receive: 0,
    },
  };
}

/* ── Main export ─────────────────────────────────────────────── */

/**
 * Converts execution history to a HAR 1.2 JSON document.
 */
export function toHarDocument(history: ExecutionResult[]): HarDocument {
  const entries: HarEntry[] = [];
  for (const result of history) {
    const entry = resultToEntry(result);
    if (entry) entries.push(entry);
  }

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Universal API Port — HeissLab',
        version: '1.0.0',
      },
      entries,
    },
  };
}

/**
 * Triggers a browser download of the HAR file.
 */
export function downloadHar(history: ExecutionResult[]): void {
  const har = toHarDocument(history);
  const json = JSON.stringify(har, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `api-port-${timestamp}.har`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * EndpointCard — Renders a single API endpoint as an interactive card.
 * Shows method badge, path, summary, and click-to-select behavior.
 */

import type { ParsedEndpoint, HttpMethod } from '../types/openapi';
import { useSchemaStore } from '../store/useSchemaStore';

const METHOD_COLORS: Record<HttpMethod, string> = {
  get: '#22c55e',
  post: '#3b82f6',
  put: '#f59e0b',
  patch: '#a855f7',
  delete: '#ef4444',
};

export function EndpointCard({ endpoint }: { endpoint: ParsedEndpoint }) {
  const { selectedEndpoint, selectEndpoint } = useSchemaStore();
  const isSelected = selectedEndpoint?.id === endpoint.id;

  return (
    <button
      className={`uap-endpoint-card ${isSelected ? 'uap-endpoint-card--selected' : ''} ${endpoint.deprecated ? 'uap-endpoint-card--deprecated' : ''}`}
      onClick={() => selectEndpoint(endpoint)}
    >
      <span
        className="uap-endpoint-card__method"
        style={{ backgroundColor: METHOD_COLORS[endpoint.method] }}
      >
        {endpoint.method.toUpperCase()}
      </span>
      <span className="uap-endpoint-card__path">{endpoint.path}</span>
      {endpoint.summary && (
        <span className="uap-endpoint-card__summary">{endpoint.summary}</span>
      )}
      {endpoint.deprecated && (
        <span className="uap-endpoint-card__badge">DEPRECATED</span>
      )}
    </button>
  );
}

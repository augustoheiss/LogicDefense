/**
 * ResponseViewer — Full transparency panel showing raw request + response traces.
 * Renders execution history with collapsible JSON viewers, timing badges,
 * and auto-tabulated table views for array responses.
 */

import { useState } from 'react';
import { useSchemaStore } from '../store/useSchemaStore';
import { ResponseTable } from './ResponseTable';
import { downloadHar } from '../core/harExporter';
import type { ExecutionResult } from '../core/apiExecutor';

function StatusBadge({ status }: { status: number }) {
  const color =
    status < 300 ? '#22c55e' :
    status < 400 ? '#f59e0b' :
    '#ef4444';
  return (
    <span className="uap-status-badge" style={{ backgroundColor: color }}>
      {status}
    </span>
  );
}

type ViewMode = 'auto' | 'json';

function TraceCard({ result, index }: { result: ExecutionResult; index: number }) {
  const { request, response, error } = result;
  const time = new Date(request.timestamp).toLocaleTimeString('pt-BR');
  const [viewMode, setViewMode] = useState<ViewMode>('auto');

  return (
    <div className={`uap-trace ${error ? 'uap-trace--error' : ''}`}>
      <div className="uap-trace__header">
        <span className="uap-trace__index">#{index + 1}</span>
        <span className={`uap-trace__method uap-method--${request.method}`}>
          {request.method.toUpperCase()}
        </span>
        <code className="uap-trace__url">{request.url}</code>
        {response && <StatusBadge status={response.status} />}
        {response && (
          <span className="uap-trace__timing">{response.durationMs}ms</span>
        )}
        <span className="uap-trace__time">{time}</span>
      </div>

      {error && <div className="uap-trace__error">❌ {error}</div>}

      <details className="uap-trace__details">
        <summary>📤 Requisição</summary>
        <pre className="uap-trace__json">
          {JSON.stringify({ url: request.url, method: request.method, headers: request.headers, body: request.body }, null, 2)}
        </pre>
      </details>

      {response && (
        <details className="uap-trace__details" open>
          <summary className="uap-trace__response-summary">
            <span>📥 Resposta ({response.status} {response.statusText})</span>
            {/* View mode toggle — only show if table rendering is possible */}
            <span className="uap-view-toggle" onClick={(e) => e.stopPropagation()}>
              <button
                className={`uap-view-toggle__btn ${viewMode === 'auto' ? 'uap-view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('auto')}
                title="Tabela automática (quando disponível)"
              >
                📊
              </button>
              <button
                className={`uap-view-toggle__btn ${viewMode === 'json' ? 'uap-view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('json')}
                title="JSON bruto"
              >
                {'{ }'}
              </button>
            </span>
          </summary>

          {/* Auto mode: try table first, fall back to JSON */}
          {viewMode === 'auto' && (
            <>
              <ResponseTable body={response.body} />
              {/* Always show raw JSON in a collapsed details below the table */}
              <details className="uap-trace__raw-fallback">
                <summary>Visualizar JSON bruto</summary>
                <pre className="uap-trace__json">
                  {JSON.stringify(response.body, null, 2)}
                </pre>
              </details>
            </>
          )}

          {/* JSON mode: raw only */}
          {viewMode === 'json' && (
            <pre className="uap-trace__json">
              {JSON.stringify(response.body, null, 2)}
            </pre>
          )}
        </details>
      )}
    </div>
  );
}

export function ResponseViewer() {
  const { executionHistory, clearHistory } = useSchemaStore();

  if (executionHistory.length === 0) {
    return (
      <div className="uap-response__empty">
        <span>📡</span>
        <p>Nenhuma requisição executada ainda</p>
        <p className="uap-response__hint">
          Execute um endpoint para ver a resposta crua aqui.<br />
          <strong>Transparência Total</strong> — você vê exatamente o que o servidor retornou.
        </p>
      </div>
    );
  }

  return (
    <div className="uap-response">
      <div className="uap-response__toolbar">
        <h3>Histórico de Requisições ({executionHistory.length})</h3>
        <div className="uap-response__actions">
          <button
            onClick={() => downloadHar(executionHistory)}
            className="uap-btn uap-btn--ghost"
            title="Exportar como arquivo HAR (HTTP Archive)"
          >
            📦 Exportar .har
          </button>
          <button onClick={clearHistory} className="uap-btn uap-btn--ghost">
            🗑️ Limpar
          </button>
        </div>
      </div>
      <div className="uap-response__list">
        {executionHistory.map((result, i) => (
          <TraceCard key={i} result={result} index={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * ResponseViewer — Full transparency panel showing raw request + response traces.
 * Renders execution history with collapsible JSON viewers and timing badges.
 */

import { useSchemaStore } from '../store/useSchemaStore';
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

function TraceCard({ result, index }: { result: ExecutionResult; index: number }) {
  const { request, response, error } = result;
  const time = new Date(request.timestamp).toLocaleTimeString('pt-BR');

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
          <summary>📥 Resposta ({response.status} {response.statusText})</summary>
          <pre className="uap-trace__json">
            {JSON.stringify(response.body, null, 2)}
          </pre>
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
        <button onClick={clearHistory} className="uap-btn uap-btn--ghost">
          🗑️ Limpar
        </button>
      </div>
      <div className="uap-response__list">
        {executionHistory.map((result, i) => (
          <TraceCard key={i} result={result} index={i} />
        ))}
      </div>
    </div>
  );
}

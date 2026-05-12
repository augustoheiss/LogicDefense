/**
 * ValidationPanel — Collapsible diagnostics banner shown after schema load.
 * Displays errors, warnings, and info with color-coded severity icons.
 */

import { useState } from 'react';
import { useSchemaStore } from '../store/useSchemaStore';
import type { Diagnostic } from '../core/schemaValidator';

const SEVERITY_CONFIG = {
  error:   { icon: '❌', label: 'Erro',   className: 'uap-diag--error' },
  warning: { icon: '⚠️', label: 'Aviso',  className: 'uap-diag--warning' },
  info:    { icon: 'ℹ️', label: 'Info',   className: 'uap-diag--info' },
} as const;

function DiagnosticRow({ diag }: { diag: Diagnostic }) {
  const config = SEVERITY_CONFIG[diag.severity];
  return (
    <div className={`uap-diag ${config.className}`}>
      <span className="uap-diag__icon">{config.icon}</span>
      <div className="uap-diag__body">
        <span className="uap-diag__message">{diag.message}</span>
        {diag.hint && <span className="uap-diag__hint">💡 {diag.hint}</span>}
        <code className="uap-diag__path">{diag.path}</code>
      </div>
    </div>
  );
}

export function ValidationPanel() {
  const validationResult = useSchemaStore((s) => s.validationResult);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!validationResult || validationResult.diagnostics.length === 0) return null;

  const { summary, diagnostics } = validationResult;
  const hasIssues = summary.errors > 0 || summary.warnings > 0;

  return (
    <div className={`uap-validation ${hasIssues ? 'uap-validation--issues' : 'uap-validation--clean'}`}>
      <button
        className="uap-validation__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="uap-validation__badges">
          {summary.errors > 0 && (
            <span className="uap-validation__badge uap-validation__badge--error">
              ❌ {summary.errors} {summary.errors === 1 ? 'erro' : 'erros'}
            </span>
          )}
          {summary.warnings > 0 && (
            <span className="uap-validation__badge uap-validation__badge--warning">
              ⚠️ {summary.warnings} {summary.warnings === 1 ? 'aviso' : 'avisos'}
            </span>
          )}
          {summary.infos > 0 && (
            <span className="uap-validation__badge uap-validation__badge--info">
              ℹ️ {summary.infos} {summary.infos === 1 ? 'dica' : 'dicas'}
            </span>
          )}
          {!hasIssues && (
            <span className="uap-validation__badge uap-validation__badge--ok">
              ✅ Schema válido — apenas dicas de melhoria
            </span>
          )}
        </div>
        <span className="uap-validation__toggle">
          {isExpanded ? '▲ Fechar' : '▼ Detalhes'}
        </span>
      </button>

      {isExpanded && (
        <div className="uap-validation__list">
          {diagnostics.map((d, i) => (
            <DiagnosticRow key={i} diag={d} />
          ))}
        </div>
      )}
    </div>
  );
}

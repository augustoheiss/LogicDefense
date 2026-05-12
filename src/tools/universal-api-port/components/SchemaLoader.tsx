/**
 * SchemaLoader — Drop zone + paste area for loading an OpenAPI JSON.
 * Supports: file upload (drag & drop), JSON paste, and demo schema.
 */

import { useState, useCallback, useRef } from 'react';
import { useSchemaStore } from '../store/useSchemaStore';
import { sampleSchema } from '../data/sampleSchema';
import type { OpenApiDocument } from '../types/openapi';

export function SchemaLoader() {
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tryParse = useCallback(
    (raw: string) => {
      try {
        const doc = JSON.parse(raw) as OpenApiDocument;
        if (!doc.openapi || !doc.paths) {
          setError('JSON inválido: campos "openapi" e "paths" são obrigatórios.');
          return;
        }
        setError(null);
        loadSchema(doc);
      } catch {
        setError('Erro ao interpretar JSON. Verifique a formatação.');
      }
    },
    [loadSchema]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => tryParse(reader.result as string);
      reader.readAsText(file);
    },
    [tryParse]
  );

  const handlePaste = () => {
    const raw = textareaRef.current?.value ?? '';
    if (raw.trim()) tryParse(raw.trim());
  };

  const handleDemo = () => {
    setError(null);
    loadSchema(sampleSchema);
  };

  return (
    <div className="uap-loader">
      <div className="uap-loader__hero">
        <div className="uap-loader__icon">🔌</div>
        <h2>Porta USB Universal</h2>
        <p>Conecte qualquer API carregando seu contrato OpenAPI (JSON)</p>
      </div>

      {/* Drop zone */}
      <div
        className={`uap-loader__dropzone ${isDragging ? 'uap-loader__dropzone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="uap-loader__dropzone-icon">📂</span>
        <span>Arraste um arquivo .json aqui</span>
      </div>

      {/* Or paste */}
      <div className="uap-loader__paste">
        <textarea
          ref={textareaRef}
          placeholder='Cole o JSON do OpenAPI aqui...'
          rows={6}
          className="uap-loader__textarea"
        />
        <button onClick={handlePaste} className="uap-btn uap-btn--secondary">
          Carregar JSON
        </button>
      </div>

      {/* Demo */}
      <button onClick={handleDemo} className="uap-btn uap-btn--primary">
        🧪 Carregar Schema Demo (Escola Modelo)
      </button>

      {error && <div className="uap-loader__error">{error}</div>}
    </div>
  );
}

/**
 * DynamicForm — The core "Zero Hardcode" renderer.
 * Generates form fields directly from OpenAPI parameter and schema definitions.
 * No business logic — purely schema-driven.
 */

import { useState, useCallback } from 'react';
import { useSchemaStore } from '../store/useSchemaStore';
import { executeEndpoint } from '../core/apiExecutor';
import type { JsonSchemaProperty, ParameterObject } from '../types/openapi';

function FieldInput({
  name,
  prop,
  value,
  onChange,
  required,
}: {
  name: string;
  prop: JsonSchemaProperty;
  value: string;
  onChange: (name: string, value: string) => void;
  required: boolean;
}) {
  const inputId = `uap-field-${name}`;

  // Enum → select dropdown
  if (prop.enum) {
    return (
      <div className="uap-field">
        <label htmlFor={inputId} className="uap-field__label">
          {name} {required && <span className="uap-field__req">*</span>}
        </label>
        {prop.description && <span className="uap-field__desc">{prop.description}</span>}
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          className="uap-field__select"
        >
          <option value="">— selecionar —</option>
          {prop.enum.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  // Boolean → checkbox
  if (prop.type === 'boolean') {
    return (
      <div className="uap-field uap-field--checkbox">
        <label htmlFor={inputId} className="uap-field__label">
          <input
            id={inputId}
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(name, String(e.target.checked))}
          />
          {name} {required && <span className="uap-field__req">*</span>}
        </label>
        {prop.description && <span className="uap-field__desc">{prop.description}</span>}
      </div>
    );
  }

  // Determine input type from format/type
  let inputType = 'text';
  if (prop.type === 'number' || prop.type === 'integer') inputType = 'number';
  if (prop.format === 'date') inputType = 'date';
  if (prop.format === 'date-time') inputType = 'datetime-local';
  if (prop.format === 'email') inputType = 'email';
  if (prop.format === 'uri') inputType = 'url';

  return (
    <div className="uap-field">
      <label htmlFor={inputId} className="uap-field__label">
        {name} {required && <span className="uap-field__req">*</span>}
      </label>
      {prop.description && <span className="uap-field__desc">{prop.description}</span>}
      <input
        id={inputId}
        type={inputType}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={prop.description ?? name}
        min={prop.minimum}
        max={prop.maximum}
        minLength={prop.minLength}
        maxLength={prop.maxLength}
        className="uap-field__input"
      />
    </div>
  );
}

export function DynamicForm() {
  const { selectedEndpoint, baseUrl, apiKey, authHeaderName, pushExecution, setIsExecuting, isExecuting } = useSchemaStore();
  const [values, setValues] = useState<Record<string, string>>({});
  const [bodyJson, setBodyJson] = useState('');

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  if (!selectedEndpoint) {
    return (
      <div className="uap-form__empty">
        <span>👈</span>
        <p>Selecione um endpoint para começar</p>
      </div>
    );
  }

  const { parameters, requestBody, method, path, summary } = selectedEndpoint;
  const pathParams = parameters.filter((p) => p.in === 'path');
  const queryParams = parameters.filter((p) => p.in === 'query');
  const headerParams = parameters.filter((p) => p.in === 'header');

  const renderParamSection = (title: string, params: ParameterObject[]) => {
    if (params.length === 0) return null;
    return (
      <fieldset className="uap-form__section">
        <legend>{title}</legend>
        {params.map((p) => (
          <FieldInput
            key={p.name}
            name={p.name}
            prop={p.schema}
            value={values[p.name] ?? ''}
            onChange={handleChange}
            required={p.required ?? false}
          />
        ))}
      </fieldset>
    );
  };

  const handleSubmit = async () => {
    setIsExecuting(true);
    try {
      const pp: Record<string, string> = {};
      pathParams.forEach((p) => { pp[p.name] = values[p.name] ?? ''; });
      const qp: Record<string, string> = {};
      queryParams.forEach((p) => { qp[p.name] = values[p.name] ?? ''; });
      const hp: Record<string, string> = {};
      headerParams.forEach((p) => { hp[p.name] = values[p.name] ?? ''; });

      let body: unknown = undefined;
      if (requestBody && bodyJson.trim()) {
        try { body = JSON.parse(bodyJson); } catch { body = bodyJson; }
      }

      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders[authHeaderName] = apiKey;

      const result = await executeEndpoint(baseUrl, selectedEndpoint, { pathParams: pp, queryParams: qp, headerParams: hp, body }, authHeaders);
      pushExecution(result);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="uap-form">
      <div className="uap-form__header">
        <span className={`uap-form__method uap-method--${method}`}>
          {method.toUpperCase()}
        </span>
        <code className="uap-form__path">{path}</code>
      </div>
      {summary && <p className="uap-form__summary">{summary}</p>}

      {renderParamSection('Parâmetros de Caminho (Path)', pathParams)}
      {renderParamSection('Parâmetros de Consulta (Query)', queryParams)}
      {renderParamSection('Parâmetros de Cabeçalho (Header)', headerParams)}

      {requestBody && (
        <fieldset className="uap-form__section">
          <legend>Corpo da Requisição (Body)</legend>
          {requestBody.properties && Object.entries(requestBody.properties).map(([name, prop]) => (
            <FieldInput
              key={name}
              name={name}
              prop={prop}
              value={values[name] ?? ''}
              onChange={handleChange}
              required={requestBody.required?.includes(name) ?? false}
            />
          ))}
          <details className="uap-form__raw-toggle">
            <summary>JSON bruto (avançado)</summary>
            <textarea
              value={bodyJson}
              onChange={(e) => setBodyJson(e.target.value)}
              placeholder='{ "campo": "valor" }'
              rows={5}
              className="uap-field__textarea"
            />
          </details>
        </fieldset>
      )}

      <button
        className="uap-btn uap-btn--execute"
        onClick={handleSubmit}
        disabled={isExecuting}
      >
        {isExecuting ? '⏳ Executando...' : '▶ Executar Requisição'}
      </button>
    </div>
  );
}

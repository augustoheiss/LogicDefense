/**
 * ConnectionBar — API base URL and authentication configuration.
 * Allows setting the target server and API key before executing requests.
 */

import { useSchemaStore } from '../store/useSchemaStore';

export function ConnectionBar() {
  const { baseUrl, setBaseUrl, apiKey, setApiKey, authHeaderName, setAuthHeaderName, rawDocument } = useSchemaStore();

  if (!rawDocument) return null;

  return (
    <div className="uap-connection">
      <div className="uap-connection__field">
        <label htmlFor="uap-base-url">🌐 Base URL</label>
        <input
          id="uap-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="uap-field__input"
        />
      </div>
      <div className="uap-connection__field">
        <label htmlFor="uap-auth-header">🔑 Header de Auth</label>
        <input
          id="uap-auth-header"
          type="text"
          value={authHeaderName}
          onChange={(e) => setAuthHeaderName(e.target.value)}
          placeholder="Authorization"
          className="uap-field__input"
        />
      </div>
      <div className="uap-connection__field">
        <label htmlFor="uap-api-key">🗝️ Chave API</label>
        <input
          id="uap-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Sua chave de acesso"
          className="uap-field__input"
        />
      </div>
    </div>
  );
}

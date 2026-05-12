/**
 * UniversalApiPort — Main orchestrator page.
 * Composes: SchemaLoader → ConnectionBar → Sidebar (endpoints) → DynamicForm → ResponseViewer
 */

import { useSchemaStore } from './store/useSchemaStore';
import { SchemaLoader } from './components/SchemaLoader';
import { ConnectionBar } from './components/ConnectionBar';
import { EndpointCard } from './components/EndpointCard';
import { DynamicForm } from './components/DynamicForm';
import { ResponseViewer } from './components/ResponseViewer';
import './styles/universal-api-port.css';

export function UniversalApiPort() {
  const { rawDocument, endpoints, tags, activeTag, setActiveTag, clearSchema } = useSchemaStore();

  // Phase 1: No schema loaded → show loader
  if (!rawDocument) {
    return (
      <div className="uap-page">
        <SchemaLoader />
      </div>
    );
  }

  // Phase 2: Schema loaded → show the workbench
  const filteredEndpoints = activeTag
    ? endpoints.filter((e) => e.tags.includes(activeTag))
    : endpoints;

  return (
    <div className="uap-page">
      {/* Top bar: API info + connection config */}
      <header className="uap-header">
        <div className="uap-header__info">
          <h1 className="uap-header__title">
            🔌 {rawDocument.info.title}
            <span className="uap-header__version">v{rawDocument.info.version}</span>
          </h1>
          {rawDocument.info.description && (
            <p className="uap-header__desc">{rawDocument.info.description}</p>
          )}
        </div>
        <button onClick={clearSchema} className="uap-btn uap-btn--ghost">
          ↩ Trocar Schema
        </button>
      </header>

      <ConnectionBar />

      {/* Main workbench: sidebar + form + response */}
      <div className="uap-workbench">
        {/* Sidebar: tag filters + endpoint list */}
        <aside className="uap-sidebar">
          <div className="uap-sidebar__tags">
            <button
              className={`uap-tag ${!activeTag ? 'uap-tag--active' : ''}`}
              onClick={() => setActiveTag(null)}
            >
              Todos ({endpoints.length})
            </button>
            {tags.map((tag) => {
              const count = endpoints.filter((e) => e.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  className={`uap-tag ${activeTag === tag ? 'uap-tag--active' : ''}`}
                  onClick={() => setActiveTag(tag)}
                >
                  {tag} ({count})
                </button>
              );
            })}
          </div>

          <div className="uap-sidebar__endpoints">
            {filteredEndpoints.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        </aside>

        {/* Center: dynamic form */}
        <main className="uap-main">
          <DynamicForm />
        </main>

        {/* Right: response transparency panel */}
        <section className="uap-panel">
          <ResponseViewer />
        </section>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import '../coin-assistant.css';
import { useCoinAssistantDB } from '../hooks/useCoinAssistantDB';
import type { CoinTable, TableGoals } from '../types';
import { downloadCSV, readCSVFile } from '../utils/csvIO';
import { TablesList } from './TablesList';
import { TableEditor } from './TableEditor';
import { TableModal } from './TableModal';
import { ConfirmDialog } from './ConfirmDialog';

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; table: CoinTable }
  | null;

export function CoinAssistantApp() {
  const db = useCoinAssistantDB();
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // Hidden file input for CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSaveModal(data: { name: string; description: string; goals: TableGoals }) {
    if (!modal) return;
    if (modal.mode === 'create') {
      db.createTable(data.name, data.description || undefined, data.goals);
    } else {
      db.renameTable(modal.table.id, data.name);
      db.updateTableDescription(modal.table.id, data.description);
      db.updateGoals(modal.table.id, data.goals);
    }
    setModal(null);
  }

  function handleDeleteConfirmed() {
    if (!confirmDeleteId) return;
    db.deleteTable(confirmDeleteId);
    setConfirmDeleteId(null);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!e.target.files) return;
    // Reset so the same file can be re-imported if needed
    e.target.value = '';

    if (!file) return;
    setImportError(null);

    try {
      const parsed = await readCSVFile(file);
      db.importTable(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erro desconhecido ao importar.');
    }
  }

  return (
    <div className="text-white flex flex-col" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* ── Hidden CSV import input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* ── Sub-header / toolbar ── */}
      <div className="border-b border-white/10 px-4 py-2.5 flex items-center gap-3 bg-[#0d1117]/50 backdrop-blur sticky top-[60px] z-10">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="text-white/40 hover:text-white transition-colors p-1 rounded"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span className="text-sm font-semibold text-white">Assistente Moeda</span>
        </div>
        <span className="text-xs text-white/20 hidden sm:block">
          — Gestão financeira local
        </span>
        <div className="flex-1" />
        <span className="text-xs text-white/20 hidden sm:block">
          {db.tables.length} {db.tables.length === 1 ? 'tabela' : 'tabelas'}
        </span>
      </div>

      {/* ── Import error toast ── */}
      {importError && (
        <div className="mx-4 mt-3 flex items-start gap-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
          <span className="text-base shrink-0">⚠️</span>
          <span className="flex-1">{importError}</span>
          <button
            onClick={() => setImportError(null)}
            className="shrink-0 text-red-400/50 hover:text-red-400 text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-56 shrink-0 border-r border-white/10 p-3 overflow-y-auto">
            <TablesList
              tables={db.tables}
              activeTableId={db.activeTableId}
              onSelect={db.setActiveTableId}
              onNew={() => setModal({ mode: 'create' })}
              onImportClick={() => fileInputRef.current?.click()}
              onExport={(table) => downloadCSV(table)}
              onEdit={(table) => setModal({ mode: 'edit', table })}
              onDelete={(id) => setConfirmDeleteId(id)}
            />
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {db.activeTable ? (
            <TableEditor
              key={db.activeTable.id}
              table={db.activeTable}
              onUpdateRow={(rowId, patch) => db.updateRow(db.activeTableId!, rowId, patch)}
              onDeleteRow={(rowId) => db.deleteRow(db.activeTableId!, rowId)}
              onAddRow={(row) => db.addRow(db.activeTableId!, row)}
              onEditTable={() =>
                db.activeTable && setModal({ mode: 'edit', table: db.activeTable })
              }
              onDeleteTable={() =>
                db.activeTableId && setConfirmDeleteId(db.activeTableId)
              }
            />
          ) : (
            <EmptyState onNew={() => setModal({ mode: 'create' })} />
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {modal && (
        <TableModal
          mode={modal.mode}
          table={modal.mode === 'edit' ? modal.table : null}
          onSave={handleSaveModal}
          onClose={() => setModal(null)}
        />
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Excluir tabela?"
          message="Todos os dados desta tabela serão perdidos permanentemente."
          confirmLabel="Excluir Tabela"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-80 gap-6 text-center">
      <div className="text-5xl opacity-20">🗂️</div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-white/50">Nenhuma tabela selecionada</h2>
        <p className="text-sm text-white/30 max-w-sm">
          Crie uma nova tabela para começar a registrar receitas, calcular médias e
          acompanhar suas metas financeiras.
        </p>
      </div>
      <button
        onClick={onNew}
        className="px-6 py-2.5 rounded-lg bg-[#a855f7] hover:bg-[#9333ea] text-white font-semibold transition-colors"
      >
        + Criar Primeira Tabela
      </button>
    </div>
  );
}

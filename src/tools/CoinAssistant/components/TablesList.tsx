import type { CoinTable } from '../types';

interface TablesListProps {
  tables: CoinTable[];
  activeTableId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImportClick: () => void;
  onExport: (table: CoinTable) => void;
  onEdit: (table: CoinTable) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function TablesList({
  tables,
  activeTableId,
  onSelect,
  onNew,
  onImportClick,
  onExport,
  onEdit,
  onDelete,
}: TablesListProps) {
  return (
    <aside className="flex flex-col gap-2 h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-white/10 gap-1">
        <span className="text-xs text-white/40 uppercase tracking-wider font-medium shrink-0">
          Tabelas
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onImportClick}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white px-2 py-1 rounded-md transition-colors"
            title="Importar tabela de CSV"
          >
            ↑ CSV
          </button>
          <button
            onClick={onNew}
            className="text-xs bg-[#a855f7] hover:bg-[#9333ea] text-white px-2.5 py-1 rounded-md transition-colors font-semibold"
            title="Nova tabela"
          >
            + Nova
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {tables.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-3 gap-3">
          <span className="text-3xl opacity-30">🗂️</span>
          <p className="text-xs text-white/30 leading-relaxed">
            Nenhuma tabela ainda.
            <br />
            Crie ou importe uma!
          </p>
        </div>
      )}

      {/* ── List ── */}
      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {tables.map((table) => {
          const isActive = table.id === activeTableId;
          return (
            <div
              key={table.id}
              className={`rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#a855f7]/15 border-[#a855f7]/40'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
              }`}
              onClick={() => onSelect(table.id)}
            >
              <div className="flex flex-col px-3 py-2.5">
                {/* ── Text content ── */}
                <p
                  className={`text-sm font-medium truncate ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {table.name}
                </p>
                {table.description && (
                  <p className="text-xs text-white/30 truncate mt-0.5">{table.description}</p>
                )}
                <p className="text-xs text-white/20 mt-1">{formatDate(table.updatedAt)}</p>

                {/* ── Action buttons (bottom-right aligned) ── */}
                <div className="flex justify-end gap-1.5 mt-2 pt-1.5 border-t border-white/5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(table);
                    }}
                    className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                    title="Editar tabela"
                    aria-label="Editar tabela"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(table);
                    }}
                    className="p-1.5 rounded-md text-white/30 hover:text-sky-400 hover:bg-sky-400/10 transition-colors"
                    title="Exportar como CSV"
                    aria-label="Exportar tabela"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Tem certeza que deseja remover esta tabela inteira? Esta ação não pode ser desfeita.')) {
                        onDelete(table.id);
                      }
                    }}
                    className="p-1.5 rounded-md text-red-400/40 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                    title="Excluir tabela"
                    aria-label="Excluir tabela"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

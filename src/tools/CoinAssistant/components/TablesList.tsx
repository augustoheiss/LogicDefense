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
              className={`group relative rounded-lg border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#a855f7]/15 border-[#a855f7]/40'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
              }`}
              onClick={() => onSelect(table.id)}
            >
              <div className="px-3 py-2.5 pr-16">
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
              </div>

              {/* ── Action buttons (edit / export / delete) ── */}
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(table);
                  }}
                  className="p-1.5 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors text-xs"
                  title="Editar tabela"
                  aria-label="Editar tabela"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(table);
                  }}
                  className="p-1.5 rounded text-white/30 hover:text-sky-400 hover:bg-sky-400/10 transition-colors text-xs"
                  title="Exportar como CSV"
                  aria-label="Exportar tabela"
                >
                  ↓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(table.id);
                  }}
                  className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors text-xs"
                  title="Excluir tabela"
                  aria-label="Excluir tabela"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

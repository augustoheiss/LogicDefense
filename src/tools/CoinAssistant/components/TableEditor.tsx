import { useState, useMemo } from 'react';
import type { CoinTable, TableRow } from '../types';
import { computeMetrics } from '../hooks/useMetricsEngine';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { AddRowForm } from './AddRowForm';
import { MetricsPanel } from './MetricsPanel';
import { GoalsPanel } from './GoalsPanel';
import { RevenueChart } from './RevenueChart';
import { RealInvestmentsChart } from './RealInvestmentsChart';
import { FutureProjectionChart } from './FutureProjectionChart';
import { WhatsAppExporter } from './WhatsAppExporter';
import { ConfirmDialog } from './ConfirmDialog';
import { downloadCSV } from '../utils/csvIO';

type TabId = 'spreadsheet' | 'metrics' | 'chart';

interface TableEditorProps {
  table: CoinTable;
  onUpdateRow: (rowId: string, patch: Partial<Omit<TableRow, 'id'>>) => void;
  onDeleteRow: (rowId: string) => void;
  onAddRow: (row: Omit<TableRow, 'id'>) => void;
  onEditTable: () => void;
}

export function TableEditor({
  table,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onEditTable,
}: TableEditorProps) {
  const [activeTab,    setActiveTab]    = useState<TabId>('spreadsheet');
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [deleteRowId,  setDeleteRowId]  = useState<string | null>(null);
  const [chartView,    setChartView]    = useState<'history' | 'projection'>('history');

  // Only revenue rows feed the metrics engine — deposits must never skew averages
  const revenueRows = useMemo(
    () => table.rows.filter((r) => r.entryType !== 'deposit'),
    [table.rows],
  );
  const metrics = useMemo(() => computeMetrics(revenueRows), [revenueRows]);

  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'spreadsheet', label: 'Planilha' },
    { id: 'metrics', label: 'Métricas' },
    { id: 'chart', label: 'Gráfico' },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* ── Table header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{table.name}</h2>
          {table.description && (
            <p className="text-sm text-white/40 mt-0.5">{table.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEditTable}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
          >
            ✎ Editar
          </button>
          <button
            onClick={() => downloadCSV(table)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/25 transition-colors font-medium"
            title="Exportar tabela como CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => setShowWhatsApp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </button>
        </div>
      </div>

      {/* ── Quick stats bar ── */}
      {metrics.grossTotal > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Total',   value: fmt(metrics.grossTotal),      color: 'text-white' },
            {
              label: 'Diária',
              value: fmt(metrics.globalDailyAvg),
              color: metrics.globalDailyAvg >= table.goals.dailyGoal
                ? 'text-emerald-400'
                : 'text-amber-400',
            },
            { label: 'Semanal', value: fmt(metrics.globalWeeklyAvg), color: 'text-white' },
            { label: 'Mensal',  value: fmt(metrics.globalMonthlyAvg),color: 'text-white' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center"
            >
              <div className="text-xs text-white/30 uppercase tracking-wider">{s.label}</div>
              <div className={`text-sm font-mono font-semibold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#a855f7] text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-white/20 self-end pb-2 pr-1">
          {table.rows.length} {table.rows.length === 1 ? 'entrada' : 'entradas'}
        </span>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'spreadsheet' && (
          <div className="flex flex-col gap-4">
            <SpreadsheetGrid
              rows={table.rows}
              dailyGoal={table.goals.dailyGoal}
              onUpdateRow={(rowId, patch) => onUpdateRow(rowId, patch)}
              onDeleteRow={(rowId) => setDeleteRowId(rowId)}
            />
            <AddRowForm onAdd={onAddRow} />
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <MetricsPanel metrics={metrics} dailyGoal={table.goals.dailyGoal} />
            </div>
            <div className="lg:w-72 shrink-0">
              <GoalsPanel goals={table.goals} metrics={metrics} />
            </div>
          </div>
        )}

        {activeTab === 'chart' && (
          <div className="space-y-4">
            {/* ── Chart view toggle ── */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 self-start w-fit">
              {([
                { id: 'history',    label: '📊 Histórico Mensal' },
                { id: 'projection', label: '💰 Investimentos & Projeção' },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setChartView(v.id)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    chartView === v.id
                      ? 'bg-[#a855f7] text-white shadow'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {chartView === 'history' && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <RevenueChart rows={revenueRows} dailyGoal={table.goals.dailyGoal} />
              </div>
            )}

            {chartView === 'projection' && (
              <div className="space-y-6">
                {/* ── Section 1: Real deposit history ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-xs font-semibold text-sky-400/80 uppercase tracking-wider px-1">
                      Seu Acúmulo Real
                    </span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <RealInvestmentsChart rows={table.rows} />
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-xs text-white/20 uppercase tracking-wider px-1">
                    Simulador de Futuro — 6 Anos
                  </span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* ── Section 2: Future projection simulator ── */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <FutureProjectionChart rows={table.rows} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showWhatsApp && (
        <WhatsAppExporter
          table={table}
          metrics={metrics}
          onClose={() => setShowWhatsApp(false)}
        />
      )}

      {deleteRowId && (
        <ConfirmDialog
          title="Excluir linha?"
          message="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          onConfirm={() => {
            onDeleteRow(deleteRowId);
            setDeleteRowId(null);
          }}
          onCancel={() => setDeleteRowId(null)}
        />
      )}
    </div>
  );
}

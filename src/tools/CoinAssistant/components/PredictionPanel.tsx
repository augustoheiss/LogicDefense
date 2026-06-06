/**
 * PredictionPanel — Dual-Engine Scenario Builder + Management UI
 *
 * Two generation engines:
 *   👯 Clonagem Exata   — copy-paste historical rows into future months (1:1)
 *   🧮 Previsão Estatística — generate synthetic rows from category averages
 *
 * Below the form: "Gestão de Cenários Sintéticos" — per-period management
 * with [✅ Tornar Real] and [🗑️ Apagar] actions, plus global clear.
 */

import { useState, useMemo } from 'react';
import type { TableRow } from '../types';
import {
  generateClonedData,
  generateStatisticalData,
  countGeneratedRows,
  getGeneratedPeriods,
  type SourceMode,
  type CloneConfig,
} from '../hooks/usePredictionEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PredictionPanelProps {
  rows: TableRow[];
  onBulkAdd: (rows: Omit<TableRow, 'id'>[]) => void;
  onDeleteGenerated: (prefix?: string) => number;
  onEffectuateGenerated: (prefix?: string) => number;
}

type SourceType = 'month' | 'year' | 'range' | 'lastN';
type EngineMode = 'clone' | 'statistical';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayYM(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

/** Available years from the dataset (real rows only). */
function availableYears(rows: TableRow[]): string[] {
  const years = new Set<string>();
  for (const r of rows) {
    if (!r.generatedBy) years.add(r.date.slice(0, 4));
  }
  return Array.from(years).sort().reverse();
}

/** Available months from the dataset (real rows only). */
function availableMonths(rows: TableRow[]): string[] {
  const months = new Set<string>();
  for (const r of rows) {
    if (!r.generatedBy) months.add(r.date.slice(0, 7));
  }
  return Array.from(months).sort().reverse();
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split('-');
  const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PredictionPanel({ rows, onBulkAdd, onDeleteGenerated, onEffectuateGenerated }: PredictionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Engine mode
  const [engineMode, setEngineMode] = useState<EngineMode>('clone');

  // Source config
  const [sourceType,       setSourceType]       = useState<SourceType>('month');
  const [sourceMonth,      setSourceMonth]      = useState('');
  const [sourceYear,       setSourceYear]       = useState('');
  const [sourceMonthKeys,  setSourceMonthKeys]  = useState<string[]>([]);
  const [sourceLastN,      setSourceLastN]      = useState(3);

  // Target config
  const [targetStart, setTargetStart] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);

  // Status
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Derived
  const years    = useMemo(() => availableYears(rows), [rows]);
  const months   = useMemo(() => availableMonths(rows), [rows]);
  const genCount = useMemo(() => countGeneratedRows(rows), [rows]);
  const generatedPeriods = useMemo(() => getGeneratedPeriods(rows), [rows]);

  // Initialize defaults on first open
  function handleOpen() {
    if (!isOpen) {
      if (!sourceMonth && months.length > 0) setSourceMonth(months[0]);
      if (!sourceYear && years.length > 0) setSourceYear(years[0]);
      if (!targetStart) {
        const latestMonth = months[0] ?? todayYM();
        const [y, m] = latestMonth.split('-').map(Number);
        const d = new Date(y, m, 1);
        setTargetStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    setIsOpen(!isOpen);
  }

  function buildSource(): SourceMode {
    switch (sourceType) {
      case 'month': return { type: 'month', ym: sourceMonth };
      case 'year':  return { type: 'year',  year: sourceYear };
      case 'range': return { type: 'range', sourceMonthKeys };
      case 'lastN': return { type: 'lastN', months: sourceLastN };
    }
  }

  function handleGenerate() {
    const config: CloneConfig = {
      source: buildSource(),
      targetStart,
      repeatCount,
    };

    const generated = engineMode === 'clone'
      ? generateClonedData(rows, config)
      : generateStatisticalData(rows, config);

    if (generated.length === 0) {
      setLastResult('⚠️ Nenhum dado encontrado no período selecionado.');
      return;
    }

    onBulkAdd(generated);

    const verb = engineMode === 'clone' ? 'clonados' : 'projetados';
    setLastResult(`✅ ${generated.length} registros ${verb} com sucesso!`);
  }

  function handleClearAll() {
    const count = onDeleteGenerated();
    setLastResult(`🗑️ ${count} registros de previsão removidos.`);
  }

  function handleDeletePeriod(period: string) {
    const count = onDeleteGenerated(period);
    setLastResult(`🗑️ ${count} registros removidos de ${formatMonthShort(period)}.`);
  }

  function handleEffectuatePeriod(period: string) {
    const count = onEffectuateGenerated(period);
    setLastResult(`✅ ${count} registros de ${formatMonthShort(period)} tornados reais!`);
  }

  // Source type options
  const sourceOptions = [
    { id: 'month' as const, label: '📅 Mês' },
    { id: 'year'  as const, label: '📆 Ano' },
    { id: 'range' as const, label: '📊 Sel. Múltipla' },
    { id: 'lastN' as const, label: '🔄 Últimos' },
  ];

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all ${
          isOpen
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-500/10'
            : genCount > 0
              ? 'bg-purple-500/10 text-purple-400/70 border-purple-500/20 hover:bg-purple-500/15'
              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/60'
        }`}
      >
        🔮 Previsão
        {genCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/30 text-purple-300 font-mono">
            {genCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {/* Panel */}
      {isOpen && (
        <div className="bg-[#0d1117] border border-purple-500/20 rounded-xl p-6 space-y-6 shadow-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
              🔮 Cenário Builder & Gestão de Previsões
            </h3>
            {genCount > 0 && (
              <span className="text-[10px] text-purple-400/60">
                {genCount} registros gerados ativos
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Cenário Builder Form */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-5 space-y-4">
              <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                ⚙️ Configuração do Cenário
              </h4>

              {/* ── Engine Mode Tabs ── */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                <button
                  onClick={() => setEngineMode('clone')}
                  className={`flex-1 px-3 py-2 text-[11px] font-semibold rounded-md transition-all ${
                    engineMode === 'clone'
                      ? 'bg-purple-500/25 text-purple-300 shadow'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  👯 Clonagem Exata
                </button>
                <button
                  onClick={() => setEngineMode('statistical')}
                  className={`flex-1 px-3 py-2 text-[11px] font-semibold rounded-md transition-all ${
                    engineMode === 'statistical'
                      ? 'bg-violet-500/25 text-violet-300 shadow'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  🧮 Previsão Estatística
                </button>
              </div>

              {/* Engine description */}
              <p className="text-[10px] text-white/25 leading-relaxed">
                {engineMode === 'clone'
                  ? '📋 Copia cada registro exatamente como está no período fonte, mapeando as datas para o destino.'
                  : '📊 Calcula a média e frequência por categoria no período fonte e gera registros sintéticos proporcionais.'}
              </p>

              {/* ── Source type selector ── */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                  Fonte dos dados
                </label>
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                  {sourceOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSourceType(opt.id)}
                      className={`flex-1 px-2 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                        sourceType === opt.id
                          ? 'bg-purple-500/30 text-purple-300 shadow'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Source-specific inputs */}
                <div className="flex flex-wrap gap-2">
                  {sourceType === 'month' && (
                    <select
                      value={sourceMonth}
                      onChange={(e) => setSourceMonth(e.target.value)}
                      className="bg-[#1a1f2e] text-white text-xs rounded px-2.5 py-1.5 border border-white/10 outline-none focus:ring-1 focus:ring-purple-400 flex-1 min-w-32 cursor-pointer"
                    >
                      {months.map((m) => (
                        <option key={m} value={m} style={{ background: '#1a1a2e', color: '#fff' }}>{formatMonthShort(m)}</option>
                      ))}
                    </select>
                  )}

                  {sourceType === 'year' && (
                    <select
                      value={sourceYear}
                      onChange={(e) => setSourceYear(e.target.value)}
                      className="bg-[#1a1f2e] text-white text-xs rounded px-2.5 py-1.5 border border-white/10 outline-none focus:ring-1 focus:ring-purple-400 flex-1 min-w-24 cursor-pointer"
                    >
                      {years.map((y) => (
                        <option key={y} value={y} style={{ background: '#1a1a2e', color: '#fff' }}>{y}</option>
                      ))}
                    </select>
                  )}

                  {sourceType === 'range' && (
                    <div className="flex flex-col gap-2 w-full">
                      <span className="text-[10px] text-white/25">Selecione os meses desejados (Cherry-pick)</span>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-white/10 rounded-lg bg-[#0d1117] w-full">
                        {months.map((m) => {
                          const isSelected = sourceMonthKeys.includes(m);
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setSourceMonthKeys((prev) =>
                                  prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
                                );
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/25'
                                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {formatMonthShort(m)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {sourceType === 'lastN' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Últimos</span>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={sourceLastN}
                        onChange={(e) => setSourceLastN(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                        className="bg-white/10 text-white text-xs rounded px-2.5 py-1.5 w-16 border border-white/10 outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      <span className="text-xs text-white/40">meses</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Target config ── */}
              <div className="space-y-2">
                <label className="text-[10px] text-white/30 uppercase tracking-wider font-medium">
                  Destino
                </label>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/25">Início em</span>
                    <input
                      type="month"
                      value={targetStart}
                      onChange={(e) => setTargetStart(e.target.value)}
                      className="bg-white/10 text-white text-xs rounded px-2.5 py-1.5 border border-white/10 outline-none [color-scheme:dark] focus:ring-1 focus:ring-purple-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-white/25">Repetir</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={repeatCount}
                        onChange={(e) => setRepeatCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                        className="bg-white/10 text-white text-xs rounded px-2.5 py-1.5 w-16 border border-white/10 outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      <span className="text-xs text-white/40">×</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Preview info ── */}
              <div className="text-[10px] text-white/25 bg-white/5 rounded-lg px-3 py-2 space-y-0.5">
                <p>
                  📋 Fonte: <span className="text-white/50">
                    {sourceType === 'month' && sourceMonth ? formatMonthShort(sourceMonth) : ''}
                    {sourceType === 'year' ? sourceYear : ''}
                    {sourceType === 'range'
                      ? sourceMonthKeys.length > 0
                        ? sourceMonthKeys.map(formatMonthShort).join(', ')
                        : 'Nenhum mês selecionado...'
                      : ''}
                    {sourceType === 'lastN' ? `Últimos ${sourceLastN} meses` : ''}
                  </span>
                </p>
                <p>
                  🎯 Destino: <span className="text-white/50">
                    {targetStart ? formatMonthShort(targetStart) : '...'} × {repeatCount}
                  </span>
                </p>
                <p>
                  ⚙️ Motor: <span className="text-white/50">
                    {engineMode === 'clone' ? 'Clonagem Exata (1:1)' : 'Previsão Estatística (médias)'}
                  </span>
                </p>
              </div>

              {/* ── Action button ── */}
              <button
                onClick={handleGenerate}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border transition-all ${
                  engineMode === 'clone'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30'
                    : 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30'
                }`}
              >
                {engineMode === 'clone' ? '👯 Clonar Dados' : '🧮 Gerar Previsão Estatística'}
              </button>

              {/* ── Result feedback ── */}
              {lastResult && (
                <div className={`text-xs px-3 py-2 rounded-lg ${
                  lastResult.startsWith('✅')
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : lastResult.startsWith('🗑️')
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {lastResult}
                </div>
              )}
            </div>

            {/* Right Column: Gestão de Cenários Sintéticos */}
            <div className="bg-gray-800/30 border border-white/5 rounded-xl p-5 space-y-4">
              <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
                📋 Gestão de Cenários Sintéticos
              </h4>

              {generatedPeriods.length > 0 ? (
                <div className="space-y-4">
                  {/* Period list */}
                  <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                    {generatedPeriods.map((p) => (
                      <div
                        key={p.period}
                        className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2 group hover:bg-white/8 transition-colors"
                      >
                        {/* Period info */}
                        <div className="flex items-center gap-2 text-xs text-white/60 min-w-0">
                          <span className="font-medium">{p.label}</span>
                          <span className="text-[10px] text-white/25 font-mono">
                            ({p.count} reg.)
                          </span>
                          {/* Type badges */}
                          <div className="flex gap-1 shrink-0">
                            {p.hasCloned && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400/70">
                                👯 clone
                              </span>
                            )}
                            {p.hasPredicted && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400/70">
                                🧮 stat
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleEffectuatePeriod(p.period)}
                            title="Tornar Real — remover flags sintéticos"
                            className="px-2 py-1 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                          >
                            ✅ Tornar Real
                          </button>
                          <button
                            onClick={() => handleDeletePeriod(p.period)}
                            title="Apagar registros sintéticos deste período"
                            className="px-2 py-1 text-[10px] font-semibold rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Global clear */}
                  <button
                    onClick={handleClearAll}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-semibold rounded-lg bg-red-500/10 text-red-400/70 border border-red-500/20 hover:bg-red-500/20 hover:text-red-400 transition-all"
                  >
                    🗑️ Apagar Todas as Previsões ({genCount})
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-white/20 space-y-2 h-full">
                  <span className="text-3xl">📭</span>
                  <span className="text-xs font-semibold">Nenhum cenário sintético</span>
                  <span className="text-[10px] text-white/10 text-center max-w-[200px]">
                    Use a configuração ao lado para gerar previsões ou clonar dados.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

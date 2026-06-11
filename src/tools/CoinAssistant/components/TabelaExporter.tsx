/**
 * TabelaExporter — PDF + CSV export for the "Tabela" tab.
 *
 * PDF: Renders a clean print-optimized version via native browser print.
 * CSV: Generates UTF-8 BOM CSV downloadable via Blob URL.
 */

import { useCallback, useMemo } from 'react';
import type { TableRow, TableGoals } from '../types';
import { computeWeeklyDebtTimeline } from '../utils/computeWeeklyDebtTimeline';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TabelaExporterProps {
  tableName: string;
  rows: TableRow[];
  goals: TableGoals;
  cutoffDate?: string;
}

// ─── CSS for the print popup ──────────────────────────────────────────────────

const PRINT_CSS = `
  @page {
    size: A4 landscape;
    margin: 8mm 10mm;
  }
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body {
    margin: 0; padding: 0; background: #fff;
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 10px;
    color: #1a1a2e;
  }
  h1 { font-size: 16px; margin: 0 0 4px; }
  h2 { font-size: 12px; margin: 0 0 12px; color: #666; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: right; padding: 6px 8px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  th:first-child, th:nth-child(2) { text-align: left; }
  td { padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-variant-numeric: tabular-nums; font-size: 10px; }
  td:first-child, td:nth-child(2) { text-align: left; }
  tr:nth-child(even) { background: #fafafa; }
  .neg { color: #dc2626; font-weight: 600; }
  .pos { color: #16a34a; font-weight: 600; }
  .neutral { color: #94a3b8; }
  tfoot td { border-top: 2px solid #334155; font-weight: 700; font-size: 11px; padding: 8px; background: #f8fafc; }
  .meta { text-align: right; font-size: 9px; color: #94a3b8; margin-top: 12px; }
  .header-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .badge-debt { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
  .badge-credit { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
`;

// ─── Currency Formatters (plain, for export) ──────────────────────────────────

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtSigned(v: number): string {
  const prefix = v >= 0 ? '+' : '';
  return `${prefix}${fmtBRL(v)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabelaExporter({
  tableName,
  rows,
  goals,
  cutoffDate,
}: TabelaExporterProps) {
  const timeline = useMemo(
    () => computeWeeklyDebtTimeline(rows, goals, cutoffDate),
    [rows, goals, cutoffDate],
  );

  const hasWaivers = timeline.some((e) => e.weeklyWaivers > 0);
  const hasPartner = timeline.some((e) => e.weeklyPartnerNet !== 0);

  // ── PDF Export ─────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    if (timeline.length === 0) return;

    const finalBalance = timeline[timeline.length - 1].cumulativeBalance;
    const totalRevenue = timeline.reduce((s, e) => s + e.weeklyRevenue, 0);
    const totalGoal = timeline.reduce((s, e) => s + e.weeklyGoal, 0);
    const totalWaivers = timeline.reduce((s, e) => s + e.weeklyWaivers, 0);
    const totalPartnerNet = timeline.reduce((s, e) => s + e.weeklyPartnerNet, 0);

    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isDebt = finalBalance < 0;
    const statusLabel = isDebt ? 'INADIMPLENTE' : 'SUPERÁVIT';
    const badgeClass = isDebt ? 'badge-debt' : 'badge-credit';

    // Build table rows HTML
    const bodyRows = timeline
      .map((e, i) => {
        const deltaClass = e.weekDelta < 0 ? 'neg' : e.weekDelta > 0 ? 'pos' : 'neutral';
        const balClass = e.cumulativeBalance < 0 ? 'neg' : 'pos';
        return `<tr>
          <td>${i + 1}</td>
          <td>${e.weekLabel}</td>
          <td>${fmtBRL(e.weeklyGoal)}</td>
          <td>${e.weeklyRevenue > 0 ? fmtBRL(e.weeklyRevenue) : '—'}</td>
          ${hasWaivers ? `<td>${e.weeklyWaivers > 0 ? '+' + fmtBRL(e.weeklyWaivers) : '—'}</td>` : ''}
          ${hasPartner ? `<td class="${e.weeklyPartnerNet < 0 ? 'neg' : e.weeklyPartnerNet > 0 ? 'pos' : 'neutral'}">${e.weeklyPartnerNet !== 0 ? fmtSigned(e.weeklyPartnerNet) : '—'}</td>` : ''}
          <td class="${deltaClass}">${e.weekDelta !== 0 ? fmtSigned(e.weekDelta) : '—'}</td>
          <td class="${balClass}">${fmtSigned(e.cumulativeBalance)}</td>
        </tr>`;
      })
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Demonstrativo de Saldo Acumulado — ${tableName}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="header-bar">
    <div>
      <h1>⚖️ Demonstrativo de Saldo Acumulado — ${tableName}</h1>
      <h2>${timeline.length} semanas · ${timeline[0].weekLabel.split(' – ')[0]} a ${timeline[timeline.length - 1].weekLabel.split(' – ')[1]}</h2>
    </div>
    <div>
      <span class="badge ${badgeClass}">${statusLabel}: ${fmtSigned(finalBalance)}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Semana</th>
        <th style="width:90px">Meta</th>
        <th style="width:90px">Receita</th>
        ${hasWaivers ? '<th style="width:80px">Waivers</th>' : ''}
        ${hasPartner ? '<th style="width:80px">Parceria</th>' : ''}
        <th style="width:100px">Δ Semana</th>
        <th style="width:120px">Saldo Acumulado</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">TOTAL (${timeline.length} semanas)</td>
        <td>${fmtBRL(totalGoal)}</td>
        <td>${fmtBRL(totalRevenue)}</td>
        ${hasWaivers ? `<td>+${fmtBRL(totalWaivers)}</td>` : ''}
        ${hasPartner ? `<td>${fmtSigned(totalPartnerNet)}</td>` : ''}
        <td class="${totalRevenue - totalGoal >= 0 ? 'pos' : 'neg'}">${fmtSigned(totalRevenue - totalGoal)}</td>
        <td class="${finalBalance >= 0 ? 'pos' : 'neg'}">${fmtSigned(finalBalance)}</td>
      </tr>
    </tfoot>
  </table>
  <p class="meta">Gerado em ${now} · Assistente Moeda — Gestão Financeira</p>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=1100,height=800');
    if (!popup) {
      alert('Pop-up bloqueado. Permita pop-ups e tente novamente.');
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
      }, 300);
    };
  }, [timeline, tableName, hasWaivers, hasPartner]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (timeline.length === 0) return;

    // Build headers
    const headers = ['#', 'Semana Início', 'Semana Fim', 'Semana', 'Meta Semanal', 'Receita'];
    if (hasWaivers) headers.push('Waivers');
    if (hasPartner) headers.push('Parceria Líquida');
    headers.push('Delta Semanal', 'Saldo Acumulado');

    const csvRows = [headers.join(';')]; // semicolon for pt-BR Excel compatibility

    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i];
      const cols: (string | number)[] = [
        i + 1,
        e.mondayKey,
        e.sundayKey,
        e.weekLabel,
        e.weeklyGoal,
        e.weeklyRevenue,
      ];
      if (hasWaivers) cols.push(e.weeklyWaivers);
      if (hasPartner) cols.push(e.weeklyPartnerNet);
      cols.push(e.weekDelta, e.cumulativeBalance);

      // Quote strings that might contain semicolons or commas
      csvRows.push(
        cols
          .map((c) => {
            if (typeof c === 'string' && (c.includes(';') || c.includes(',') || c.includes('"'))) {
              return `"${c.replace(/"/g, '""')}"`;
            }
            return String(c);
          })
          .join(';'),
      );
    }

    // UTF-8 BOM for proper Portuguese character support in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvRows.join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `demonstrativo_saldo_acumulado_${tableName.replace(/\s+/g, '_').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [timeline, tableName, hasWaivers, hasPartner]);

  return (
    <div className="flex items-center gap-2">
      {/* PDF button */}
      <button
        onClick={handleExportPDF}
        disabled={timeline.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/25 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Exportar tabela como PDF (impressão nativa)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        PDF
      </button>

      {/* CSV button */}
      <button
        onClick={handleExportCSV}
        disabled={timeline.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/25 disabled:opacity-30 disabled:cursor-not-allowed"
        title="Exportar tabela como CSV (abre no Google Sheets / Excel)"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        CSV
      </button>
    </div>
  );
}

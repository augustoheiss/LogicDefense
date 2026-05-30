/**
 * PdfExporter — Renders a hidden PrintableReport off-screen, then serialises
 * its DOM into a popup window for native browser print (Save as PDF).
 *
 * Why NOT html2canvas?
 *   html2canvas rasterises the entire DOM into a single flat image.
 *   This kills clickable <a> hyperlinks and CSS page-break rules.
 *   Native print preserves both.
 */

import { useRef, useCallback } from 'react';
import type { CoinTable, TableMetrics, CostBasedTarget } from '../types';
import { PrintableReport } from './PrintableReport';
import { resolveGoalForYear } from '../utils/dateUtils';

/** CSS injected into the print popup — controls A4 sizing, page breaks, and colour fidelity. */
const PRINT_CSS = `
  @page {
    size: A4;
    margin: 10mm 0;
  }
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }
  /* Force block on every element so page-break is never eaten by flex/grid */
  body * {
    max-width: 100%;
  }
  a {
    color: #7c3aed !important;
    text-decoration: underline !important;
    pointer-events: auto !important;
  }
`;

interface PdfExporterProps {
  table: CoinTable;
  metrics: TableMetrics;
  selectedMonth: string;
  costBasedTarget?: CostBasedTarget;
}

export function PdfExporter({ table, metrics, selectedMonth, costBasedTarget }: PdfExporterProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  const [selY] = selectedMonth.split('-').map(Number);
  const dailyGoal = resolveGoalForYear(table.goals.dailyGoals, selY);

  const handleExport = useCallback(() => {
    if (!reportRef.current) return;

    // Serialise the React-rendered report DOM (including Recharts SVGs)
    const html = reportRef.current.outerHTML;

    // Open a blank popup for the print dialog
    const popup = window.open('', '_blank', 'width=840,height=1100');
    if (!popup) {
      alert('O bloqueador de pop-ups impediu a exportação. Permita pop-ups e tente novamente.');
      return;
    }

    const monthLabel = new Date(selY, parseInt(selectedMonth.split('-')[1]) - 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório — ${table.name} — ${monthLabel}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  ${html}
</body>
</html>`);
    popup.document.close();

    // Wait for SVGs / fonts to settle, then trigger the native print dialog
    popup.onload = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
        // Don't auto-close — let the user review or cancel
      }, 400);
    };
  }, [selectedMonth, selY, table.name]);

  return (
    <>
      {/* Export button */}
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/25"
        title="Exportar relatório como PDF"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        PDF
      </button>

      {/* Hidden off-screen render target — React renders the report here,
          then handleExport serialises its .outerHTML into the print popup. */}
      <div
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '0',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      >
        <PrintableReport
          ref={reportRef}
          tableName={table.name}
          rows={table.rows}
          metrics={metrics}
          selectedMonth={selectedMonth}
          dailyGoal={dailyGoal}
          goals={table.goals}
          costBasedTarget={costBasedTarget}
        />
      </div>
    </>
  );
}

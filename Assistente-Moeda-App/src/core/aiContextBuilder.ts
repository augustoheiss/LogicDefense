/**
 * AI Context Builder — Assistente Moeda (React Native)
 *
 * Aggregates synthetic/generated future rows for the AI assistant context.
 * Migrated with import path updated to './types'.
 */

import type { TableRow } from './types';

export function buildAIScenarioContext(rows: TableRow[]): string {
  const syntheticRows = rows.filter((r) => r.generatedBy !== undefined);
  if (syntheticRows.length === 0) return '';

  const groups: { [key: string]: TableRow[] } = {};
  for (const row of syntheticRows) {
    const ym = row.date.slice(0, 7);
    if (!groups[ym]) groups[ym] = [];
    groups[ym].push(row);
  }

  const sortedMonths = Object.keys(groups).sort();
  const lines: string[] = ['🔮 CENÁRIOS PROJETADOS:'];

  for (const ym of sortedMonths) {
    const groupRows = groups[ym];

    const hasPredicted = groupRows.some((r) => r.generatedBy === 'predicted');
    const hasCloned = groupRows.some((r) => r.generatedBy === 'cloned');

    let typeLabel = '';
    if (hasPredicted && hasCloned) {
      typeLabel = 'Misto';
    } else if (hasPredicted) {
      typeLabel = 'Previsão Estatística';
    } else if (hasCloned) {
      const firstCloned = groupRows.find((r) => r.generatedBy === 'cloned');
      const clonedFrom = firstCloned?.clonedFrom;
      if (clonedFrom) {
        typeLabel = `Clonagem de ${formatShortMonthYearPT(clonedFrom)}`;
      } else {
        typeLabel = 'Clonagem';
      }
    } else {
      typeLabel = 'Projeção';
    }

    const revenue = groupRows
      .filter(
        (r) =>
          r.entryType !== 'expense' &&
          r.entryType !== 'deposit' &&
          r.entryType !== 'waiver' &&
          r.entryType !== 'partner_in' &&
          r.entryType !== 'partner_out'
      )
      .reduce((sum, r) => sum + r.value, 0);

    const expenses = groupRows
      .filter((r) => r.entryType === 'expense')
      .reduce((sum, r) => sum + r.value, 0);

    const net = revenue - expenses;

    const fmt = (v: number) => {
      if (Number.isInteger(v)) return `R$ ${v}`;
      return `R$ ${v.toFixed(2).replace('.', ',')}`;
    };

    const monthLabel = formatMonthYearPT(ym);
    lines.push(
      `- ${monthLabel} (${typeLabel}): Receita ${fmt(revenue)} | Custos: ${fmt(expenses)} | Saldo: ${fmt(net)}`
    );
  }

  return lines.join('\n');
}

function formatMonthYearPT(ym: string): string {
  const [y, m] = ym.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) return `${monthNames[monthIdx]}/${y}`;
  return ym;
}

function formatShortMonthYearPT(ym: string): string {
  const [y, m] = ym.split('-');
  const shortMonths = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) return `${shortMonths[monthIdx]}/${y}`;
  return ym;
}

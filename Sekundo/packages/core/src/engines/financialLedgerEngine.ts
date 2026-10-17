/**
 * Sekundo — Assistente Moeda (Financial Ledger & Sectoral Engine)
 *
 * Implements the Universal Law 'financial_ledger' inside @sekundo/core,
 * bridging Sekundo's Skeleton/Omni-CSV architecture with Assistente Moeda's
 * sovereign financial tables (revenue, expense, deposit, waiver, partner_in, partner_out).
 */

import type { SkeletonNode, NodeType, FlatSkeletonEntry } from '../skeleton/types';
import type {
  EventEngine,
  EngineMetrics,
  FinancialEntryType,
  FinancialLedgerMetrics,
  FinancialLedgerNodeMeta,
} from './types';

const ALLOWED_ENTRY_TYPES = new Set<FinancialEntryType>([
  'revenue',
  'expense',
  'deposit',
  'waiver',
  'partner_in',
  'partner_out',
  'unresolved',
]);

function parseNumericAmount(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const cleaned = val
      .replace(/[R$\s]/g, '')
      .replace(/\.(?=\d{3}(?:[.,]|$))/g, '')
      .replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export const financialLedgerEngine: EventEngine = {
  id: 'financial_ledger',
  name: 'Assistente Moeda (Finanças & Setores)',
  description:
    'Motor soberano de finanças pessoais, PME, frotas, imóveis SAC, tributário e carteira FIRE com suporte a API Pública/Turso e CSV Dinâmico.',
  icon: '🪙',
  allowedNodeTypes: ['header', 'slot', 'note'],

  defaultNodeTypeForDepth(depth: number): NodeType {
    if (depth <= 2) return 'header';
    return 'slot';
  },

  validateNode(node: SkeletonNode): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!node.label || !node.label.trim()) {
      errors.push(`Nó financeiro ${node.key} requer um rótulo ou descrição.`);
    }
    const meta = (node.meta || {}) as FinancialLedgerNodeMeta;
    if (meta.entryType && !ALLOWED_ENTRY_TYPES.has(meta.entryType)) {
      errors.push(`Tipo de lançamento inválido '${meta.entryType}' no nó ${node.key}.`);
    }
    if (meta.amountBRL !== undefined && !Number.isFinite(Number(meta.amountBRL))) {
      errors.push(`Valor monetário inválido no nó ${node.key}.`);
    }
    return { valid: errors.length === 0, errors };
  },

  calculateMetrics(tree: SkeletonNode[]): EngineMetrics {
    let transactionCount = 0;
    let grossTotal = 0;
    let totalExpenses = 0;
    let totalInvested = 0;
    let totalWaiverCredit = 0;
    let totalPartnerIn = 0;
    let totalPartnerOut = 0;
    let unresolvedCount = 0;

    const expenseDates: number[] = [];

    function walk(node: SkeletonNode) {
      const meta = (node.meta || {}) as FinancialLedgerNodeMeta;
      const hasEntry =
        meta.entryType !== undefined ||
        meta.amountBRL !== undefined ||
        (node.children.length === 0 && node.type !== 'header' && node.value !== '');

      if (hasEntry && node.children.length === 0) {
        const entryType: FinancialEntryType = ALLOWED_ENTRY_TYPES.has(
          meta.entryType as FinancialEntryType
        )
          ? (meta.entryType as FinancialEntryType)
          : 'revenue';

        const rawAmount =
          meta.amountBRL !== undefined ? Number(meta.amountBRL) : parseNumericAmount(node.value);
        const absVal = Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0);

        transactionCount++;

        switch (entryType) {
          case 'revenue':
            grossTotal += absVal;
            break;
          case 'expense':
            totalExpenses += absVal;
            if (meta.date && /^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
              const ts = Date.parse(`${meta.date}T00:00:00Z`);
              if (Number.isFinite(ts)) expenseDates.push(ts);
            }
            break;
          case 'deposit':
            totalInvested += absVal;
            break;
          case 'waiver':
            totalWaiverCredit += absVal;
            break;
          case 'partner_in':
            totalPartnerIn += absVal;
            break;
          case 'partner_out':
            totalPartnerOut += absVal;
            break;
          case 'unresolved':
            unresolvedCount++;
            break;
        }
      }

      for (const child of node.children) {
        walk(child);
      }
    }

    for (const root of tree) {
      walk(root);
    }

    let daySpan = 30;
    if (expenseDates.length >= 2) {
      const minTs = Math.min(...expenseDates);
      const maxTs = Math.max(...expenseDates);
      const diffDays = Math.floor((maxTs - minTs) / 86_400_000) + 1;
      daySpan = Math.max(1, diffDays);
    }

    const survivalDaily = totalExpenses > 0 ? totalExpenses / daySpan : 0;
    const survivalWeekly = survivalDaily * 7;
    const survivalMonthly = survivalDaily * 30;
    const netBalance = grossTotal - totalExpenses + totalPartnerIn - totalPartnerOut;

    const data: FinancialLedgerMetrics = {
      transactionCount,
      grossTotal: Number(grossTotal.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalInvested: Number(totalInvested.toFixed(2)),
      totalWaiverCredit: Number(totalWaiverCredit.toFixed(2)),
      totalPartnerIn: Number(totalPartnerIn.toFixed(2)),
      totalPartnerOut: Number(totalPartnerOut.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
      survivalDaily: Number(survivalDaily.toFixed(2)),
      survivalWeekly: Number(survivalWeekly.toFixed(2)),
      survivalMonthly: Number(survivalMonthly.toFixed(2)),
      unresolvedCount,
    };

    return {
      engineId: 'financial_ledger',
      data,
    };
  },

  supportedExports: ['csv', 'xlsx', 'pdf', 'yaml'],
};

/**
 * Bridges Assistente Moeda rows into Sekundo FlatSkeletonEntry items
 * so they can be inspected in the Multi-Engine Skeleton Editor or exported in Omni-CSV.
 */
export interface CoinBridgeRowInput {
  id: string;
  date: string;
  value: number;
  description?: string;
  entryType?: string;
  category?: string;
  tags?: string;
  periodStart?: string;
  periodEnd?: string;
  monthlyValue?: number;
  monthCount?: number;
  ticker?: string;
  quantity?: number;
  unitPrice?: number;
}

export function coinRowsToFlatSkeletonEntries(
  rows: CoinBridgeRowInput[],
  rootPrefix = '09',
  tableName = 'Assistente Moeda — Planilha Ativa'
): FlatSkeletonEntry[] {
  const entries: FlatSkeletonEntry[] = [
    {
      key: rootPrefix,
      type: 'header',
      label: `🪙 ${tableName}`,
      value: `${rows.length} lançamentos`,
      email: '',
      meta: {
        enginePartition: 'financial_ledger',
        tableName,
      },
    },
  ];

  rows.forEach((row, idx) => {
    const seq = String(idx + 1).padStart(2, '0');
    const entryType = (row.entryType || 'revenue') as FinancialEntryType;
    entries.push({
      key: `${rootPrefix}-${seq}`,
      type: 'slot',
      label: row.description || row.category || `Lançamento ${seq}`,
      value: String(row.value),
      email: '',
      meta: {
        rowId: row.id,
        date: row.date,
        amountBRL: row.value,
        entryType,
        category: row.category || 'Geral',
        tags: row.tags || '',
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        monthlyValue: row.monthlyValue,
        monthCount: row.monthCount,
        ticker: row.ticker,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        tableName,
      },
    });
  });

  return entries;
}

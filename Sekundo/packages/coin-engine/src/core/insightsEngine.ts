/**
 * Financial Insights Engine — Assistente Moeda
 *
 * Discovers spending anomalies, end-of-month projections, cost concentrations,
 * and actionable tips for families and individuals. Pure, zero-dependency.
 */

import type { TableRow, TableMetrics } from './types';

export interface FinancialInsight {
  id: string;
  type: 'anomaly' | 'projection' | 'concentration' | 'achievement' | 'tip';
  title: string;
  message: string;
  impactLevel: 'alto' | 'médio' | 'baixo';
  category?: string;
  metricValue?: number;
}

export function computeFinancialInsights(
  rows: TableRow[],
  metrics: Partial<TableMetrics>
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  if (!rows || rows.length === 0) return insights;

  const grossTotal = metrics.grossTotal || 0;
  const totalExpenses = metrics.totalExpenses || 0;
  const netBalance = grossTotal - totalExpenses;

  // 1. Projeção de Fechamento do Mês
  if (grossTotal > 0 || totalExpenses > 0) {
    if (netBalance > 0) {
      const savingsRate = Math.round((netBalance / (grossTotal || 1)) * 100);
      insights.push({
        id: 'proj_surplus',
        type: 'projection',
        title: 'Superávit no período',
        message: `Você está poupando ${savingsRate}% da sua renda. Mantendo esse ritmo, você fecha o período com sobra de R$ ${netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        impactLevel: 'alto',
        metricValue: netBalance,
      });
    } else if (netBalance < 0) {
      insights.push({
        id: 'proj_deficit',
        type: 'anomaly',
        title: 'Alerta de déficit',
        message: `As despesas superam as receitas em R$ ${Math.abs(netBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Considere adiar compras não essenciais.`,
        impactLevel: 'alto',
        metricValue: netBalance,
      });
    }
  }

  // 2. Concentração de Custos por Categoria
  const categoryTotals: Record<string, number> = {};
  for (const r of rows) {
    if (r.entryType === 'expense' && r.value > 0) {
      const cat = r.category || r.description || 'Outros';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + r.value;
    }
  }

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0 && totalExpenses > 0) {
    const [topCat, topVal] = sortedCategories[0];
    const topPct = Math.round((topVal / totalExpenses) * 100);

    if (topPct >= 40) {
      insights.push({
        id: 'cat_concentration',
        type: 'concentration',
        title: `Alta concentração em ${topCat}`,
        message: `A categoria "${topCat}" responde por ${topPct}% de todos os seus gastos no período (R$ ${topVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        impactLevel: 'médio',
        category: topCat,
        metricValue: topVal,
      });
    }
  }

  // 3. Conquista de Consistência
  if (metrics.daysWorked && metrics.daysWorked >= 7) {
    insights.push({
      id: 'streak_consistency',
      type: 'achievement',
      title: 'Hábito financeiro ativo',
      message: `Você já registrou movimentações em ${metrics.daysWorked} dias diferentes. Essa disciplina é essencial para a clareza patrimonial.`,
      impactLevel: 'baixo',
      metricValue: metrics.daysWorked,
    });
  }

  return insights;
}

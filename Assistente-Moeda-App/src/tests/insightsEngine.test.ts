declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(expected: any): void;
  toHaveProperty(prop: string, value?: any): void;
  toBeGreaterThan(expected: any): void;
  toBeLessThan(expected: any): void;
  not: any;
};

import { computeFinancialInsights } from '../core/insightsEngine';
import type { TableRow, TableMetrics } from '../core/types';

describe('Test Suite: Financial Insights Engine (computeFinancialInsights)', () => {
  it('deve retornar lista vazia quando não houver linhas registradas', () => {
    const metrics: Partial<TableMetrics> = {
      grossTotal: 0,
      totalExpenses: 0,
      totalDeposits: 0,
      dailyAverage: 0,
      daysWorked: 0,
      projectedTotal: 0,
      globalDailyGoal: 0,
      pendingGoals: 0,
      balance: 0,
    };

    const insights = computeFinancialInsights([], metrics);
    expect(insights.length).toBe(0);
  });

  it('deve gerar insight de projeção superavitária quando receitas superarem despesas', () => {
    const rows: TableRow[] = [
      { id: '1', date: '2026-07-01', value: 3000, description: 'Salário', entryType: 'revenue' },
      { id: '2', date: '2026-07-02', value: 1000, description: 'Aluguel', entryType: 'expense' },
    ];
    const metrics: Partial<TableMetrics> = {
      grossTotal: 3000,
      totalExpenses: 1000,
      totalDeposits: 0,
      dailyAverage: 1500,
      daysWorked: 2,
      projectedTotal: 3000,
      globalDailyGoal: 0,
      pendingGoals: 0,
      balance: 2000,
    };

    const insights = computeFinancialInsights(rows, metrics);
    const surplusInsight = insights.find(i => i.id === 'proj_surplus');

    expect(surplusInsight).toBeDefined();
    expect(surplusInsight?.type).toBe('projection');
    expect(surplusInsight?.metricValue).toBe(2000);
  });

  it('deve alertar sobre concentração de despesas quando uma categoria exceder 40% dos custos', () => {
    const rows: TableRow[] = [
      { id: '1', date: '2026-07-01', value: 1200, description: 'Aluguel Casa', category: 'Moradia', entryType: 'expense' },
      { id: '2', date: '2026-07-02', value: 300, description: 'Mercado', category: 'Alimentação', entryType: 'expense' },
      { id: '3', date: '2026-07-03', value: 200, description: 'Internet', category: 'Contas', entryType: 'expense' },
    ];
    // Total despesas = 1700. Moradia = 1200 (~70%)
    const metrics: Partial<TableMetrics> = {
      grossTotal: 2500,
      totalExpenses: 1700,
      totalDeposits: 0,
      dailyAverage: 500,
      daysWorked: 3,
      projectedTotal: 2500,
      globalDailyGoal: 0,
      pendingGoals: 0,
      balance: 800,
    };

    const insights = computeFinancialInsights(rows, metrics);
    const concentration = insights.find(i => i.id === 'cat_concentration');

    expect(concentration).toBeDefined();
    expect(concentration?.category).toBe('Moradia');
    expect(concentration?.message).toContain('Moradia');
  });

  it('deve gerar selo de consistência para rotinas com 7 ou mais dias de registros', () => {
    const rows: TableRow[] = [
      { id: '1', date: '2026-07-01', value: 100, description: 'Gasolina', entryType: 'expense' },
    ];
    const metrics: Partial<TableMetrics> = {
      grossTotal: 1000,
      totalExpenses: 500,
      totalDeposits: 0,
      dailyAverage: 100,
      daysWorked: 8,
      projectedTotal: 1000,
      globalDailyGoal: 0,
      pendingGoals: 0,
      balance: 500,
    };

    const insights = computeFinancialInsights(rows, metrics);
    const streak = insights.find(i => i.id === 'streak_consistency');

    expect(streak).toBeDefined();
    expect(streak?.type).toBe('achievement');
    expect(streak?.metricValue).toBe(8);
  });
});

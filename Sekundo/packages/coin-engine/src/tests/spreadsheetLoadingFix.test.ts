declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import { getEffectiveGoals } from '../core/dateUtils';
import type { TableGoals, CoinTable } from '../core/types';

describe('Relatório de Teste: Carregamento, Troca e Métricas Defensivas de Planilhas (spreadsheetLoadingFix)', () => {
  it('Deve alinhar índices de activeTables filtrando planilhas marcadas com isDeleted', () => {
    const allTables: CoinTable[] = [
      { id: 't-1', name: 'Planilha 1', description: '', createdAt: '', updatedAt: '', rows: [], goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} }, activeSectors: ['personal_finance'] },
      { id: 't-2', name: 'Excluída', description: '', createdAt: '', updatedAt: '', rows: [], goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} }, activeSectors: ['personal_finance'], isDeleted: true },
      { id: 't-3', name: 'Planilha 2', description: '', createdAt: '', updatedAt: '', rows: [], goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} }, activeSectors: ['personal_finance'] },
    ];

    const activeTables = allTables.filter((t) => !t.isDeleted);
    expect(activeTables.length).toBe(2);
    expect(activeTables[0].id).toBe('t-1');
    expect(activeTables[1].id).toBe('t-3');
  });

  it('Deve calcular metas com fallbacks defensivos zerados sem lançar TypeError', () => {
    const partialGoals: TableGoals = {
      dailyGoals: {},
      weeklyGoals: {},
      annualCosts: {},
      yearlyGoals: {
        2026: { dailyGoal: 100 } as any, // missing weeklyGoal and annualCost
      },
    };

    const effective = getEffectiveGoals({ year: 2026 }, partialGoals);
    expect(effective.dailyGoal).toBe(100);
    expect(effective.weeklyGoal).toBe(0);
    expect(effective.annualCost).toBe(0);
  });

  it('Deve retornar metas zeradas com segurança quando goals é null/undefined', () => {
    const effective = getEffectiveGoals({ year: 2026 }, null as any);
    expect(effective.dailyGoal).toBe(0);
    expect(effective.weeklyGoal).toBe(0);
    expect(effective.annualCost).toBe(0);
  });
});

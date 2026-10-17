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

import { computeHealthScore } from '../core/healthEngine';
import type { TableMetrics } from '../core/types';

describe('Test Suite: Financial Health Engine (computeHealthScore)', () => {
  const baseMetrics: Partial<TableMetrics> = {
    grossTotal: 5000,
    totalExpenses: 3000,
    totalDeposits: 6000,
    dailyAverage: 250,
    daysWorked: 20,
    projectedTotal: 6000,
    globalDailyGoal: 200,
    pendingGoals: 0,
    balance: 2000,
  };

  it('deve calcular um score excelente para finanças superavitárias com reserva e consistência', () => {
    const report = computeHealthScore(baseMetrics, { emergencyFundMonthsTarget: 2 });

    expect(report.score).toBeGreaterThan(80);
    expect(report.level).toBe('excelente');
    expect(report.pillars.length).toBe(4);

    const cashflowPillar = report.pillars.find(p => p.id === 'cashflow');
    expect(cashflowPillar?.status).toBe('bom');
    expect(cashflowPillar?.score).toBe(95);

    const reservePillar = report.pillars.find(p => p.id === 'reserve');
    expect(reservePillar?.status).toBe('bom');
    expect(reservePillar?.score).toBe(100);
  });

  it('deve diagnosticar nível crítico quando houver déficit acentuado e sem reserva', () => {
    const deficitMetrics: Partial<TableMetrics> = {
      grossTotal: 2000,
      totalExpenses: 4500, // Gasta mais que ganha
      totalDeposits: 0,
      dailyAverage: 100,
      daysWorked: 5,
      projectedTotal: 2500,
      globalDailyGoal: 300,
      pendingGoals: 0,
      balance: -2500,
    };

    const report = computeHealthScore(deficitMetrics);

    expect(report.score).toBeLessThan(45);
    expect(['crítico', 'atenção']).toContain(report.level);
    expect(report.nextBestAction.actionType).toBe('cut_expense');
  });

  it('deve alertar formação de reserva quando o fluxo for positivo mas depósitos forem nulos', () => {
    const noReserveMetrics: Partial<TableMetrics> = {
      grossTotal: 4000,
      totalExpenses: 3000,
      totalDeposits: 0,
      dailyAverage: 200,
      daysWorked: 15,
      projectedTotal: 4000,
      globalDailyGoal: 200,
      pendingGoals: 0,
      balance: 1000,
    };

    const report = computeHealthScore(noReserveMetrics);

    const reservePillar = report.pillars.find(p => p.id === 'reserve');
    expect(reservePillar?.score).toBe(30);
    expect(reservePillar?.status).toBe('perigo');
    expect(report.nextBestAction.actionType).toBe('build_reserve');
  });

  it('deve manter o score calibrado entre 0 e 100 em qualquer cenário extremo', () => {
    const emptyMetrics: Partial<TableMetrics> = {
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

    const report = computeHealthScore(emptyMetrics);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
    expect(report.evaluatedAt).toBeDefined();
  });
});

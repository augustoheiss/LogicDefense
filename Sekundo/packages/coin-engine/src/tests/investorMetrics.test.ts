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

import {
  DEFAULT_PERSONA_ALLOCATIONS,
  DEFAULT_PROFILE_CONFIGS,
  detectAssetClass,
  computeAssetPositions,
  computeInvestorMetrics,
} from '../core/investorMetricsEngine';
import { calculateSmartRebalance } from '../core/smartRebalancer';
import type { TableRow, AssetPosition, InvestorProfileConfig } from '../core/types';

describe('Test Suite: Investor Metrics & Smart Rebalancer', () => {
  it('todos os 5 perfis de investidor possuem alocações que somam exatamente 100%', () => {
    const personas = Object.keys(DEFAULT_PERSONA_ALLOCATIONS) as Array<keyof typeof DEFAULT_PERSONA_ALLOCATIONS>;
    expect(personas.length).toBe(5);

    personas.forEach((persona) => {
      const targets = DEFAULT_PERSONA_ALLOCATIONS[persona];
      const sum = targets.reduce((acc, t) => acc + t.targetPercentage, 0);
      expect(sum).toBe(100);
    });
  });

  it('detectAssetClass identifica tickers financeiros e descrições com precisão', () => {
    const rows: Array<{ row: TableRow; expected: string }> = [
      {
        row: { id: '1', date: '2026-05-10', value: 100, ticker: 'MXRF11' },
        expected: 'real_estate_funds',
      },
      {
        row: { id: '2', date: '2026-05-10', value: 100, ticker: 'PETR4' },
        expected: 'equities_brazil',
      },
      {
        row: { id: '3', date: '2026-05-10', value: 100, ticker: 'IVVB11' },
        expected: 'equities_global',
      },
      {
        row: { id: '4', date: '2026-05-10', value: 100, ticker: 'BTC' },
        expected: 'crypto',
      },
      {
        row: { id: '5', date: '2026-05-10', value: 100, description: 'Tesouro Selic 2029' },
        expected: 'cash_reserves',
      },
      {
        row: { id: '6', date: '2026-05-10', value: 100, description: 'Debênture Incentivada IPCA+' },
        expected: 'fixed_income_ipca',
      },
      {
        row: { id: '7', date: '2026-05-10', value: 100, description: 'Capital de Giro PJ Empresa' },
        expected: 'business_capital',
      },
    ];

    rows.forEach(({ row, expected }) => {
      const detected = detectAssetClass(row);
      expect(detected).toBe(expected);
    });
  });

  it('computeAssetPositions calcula desvios e deltas com fidelidade matemática', () => {
    const profile: InvestorProfileConfig = {
      profileType: 'safety',
      emergencyFundMonthsGoal: 12,
      fireTargetAnnualExpensesMultiplier: 25,
      customAllocations: [
        { assetClass: 'cash_reserves', targetPercentage: 50 },
        { assetClass: 'fixed_income_ipca', targetPercentage: 50 },
      ],
    };

    // Usuário tem R$ 8.000 em caixa e R$ 2.000 em IPCA (Total R$ 10.000)
    const rows: TableRow[] = [
      { id: '1', date: '2026-01-01', value: 8000, entryType: 'deposit', description: 'CDB Liquidez' },
      { id: '2', date: '2026-01-01', value: 2000, entryType: 'deposit', description: 'Tesouro IPCA 2035' },
    ];

    const positions = computeAssetPositions(rows, profile);
    expect(positions.length).toBe(2);

    const cash = positions.find((p) => p.assetClass === 'cash_reserves')!;
    const ipca = positions.find((p) => p.assetClass === 'fixed_income_ipca')!;

    expect(cash.currentValue).toBe(8000);
    expect(cash.currentPercentage).toBe(80);
    expect(cash.deviationPercentage).toBe(30); // 80 - 50 = +30% de superávit
    expect(cash.deltaBRL).toBe(-3000); // 5000 meta - 8000 atual = -3000

    expect(ipca.currentValue).toBe(2000);
    expect(ipca.currentPercentage).toBe(20);
    expect(ipca.deviationPercentage).toBe(-30); // 20 - 50 = -30% de defasagem
    expect(ipca.deltaBRL).toBe(3000); // 5000 meta - 2000 atual = +3000 (necessita aporte)
  });

  it('calculateSmartRebalance aloca novo aporte estritamente em ativos subalocados sem forçar vendas', () => {
    // Portfólio atual: R$ 10.000 em Renda Fixa (meta 50%) e R$ 15.000 em Ações (meta 50%)
    // Ações estão sobrealocadas (60%). O usuário aporta R$ 2.000.
    const positions: AssetPosition[] = [
      {
        assetClass: 'fixed_income_ipca',
        currentValue: 10000,
        currentPercentage: 40,
        targetPercentage: 50,
        deviationPercentage: -10,
        deltaBRL: 2500,
      },
      {
        assetClass: 'equities_brazil',
        currentValue: 15000,
        currentPercentage: 60,
        targetPercentage: 50,
        deviationPercentage: 10,
        deltaBRL: -2500,
      },
    ];

    const suggestions = calculateSmartRebalance(positions, 2000);

    // 100% do aporte de R$ 2.000 deve fluir para Renda Fixa para reduzir a defasagem
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].assetClass).toBe('fixed_income_ipca');
    expect(suggestions[0].suggestedAllocationBRL).toBe(2000);
    expect(suggestions[0].rationalExplanation).toContain('sem necessidade de realizar vendas');
  });

  it('computeInvestorMetrics calcula cobertura da Reserva de Emergência e Meta FIRE (Regra dos 4%)', () => {
    const profile = DEFAULT_PROFILE_CONFIGS.balanced; // Meta 6 meses, multiplicador 25x
    const monthlyExpenses = 5000;

    const rows: TableRow[] = [
      // R$ 30.000 em liquidez (exatamente 6 meses de custos de R$ 5.000)
      { id: '1', date: '2026-01-01', value: 30000, entryType: 'deposit', description: 'CDB 100% CDI Reserva' },
      // R$ 270.000 em outros investimentos (Patrimônio total = R$ 300.000)
      { id: '2', date: '2026-01-01', value: 270000, entryType: 'deposit', ticker: 'PETR4', description: 'Ações' },
      // Proventos passivos: R$ 1.250 / mês
      { id: '3', date: '2026-01-15', value: 1250, entryType: 'revenue', category: 'Proventos', description: 'Dividendos B3' },
    ];

    const metrics = computeInvestorMetrics(rows, profile, monthlyExpenses, 1500);

    expect(metrics.totalNetWorth).toBe(300000);
    expect(metrics.emergencyFundMonthsAvailable).toBe(6);
    expect(metrics.emergencyFundProgressPct).toBe(100);

    // Meta FIRE: 5.000 * 12 * 25 = R$ 1.500.000
    expect(metrics.fireNumberTarget).toBe(1500000);
    // Progresso FIRE: 300.000 / 1.500.000 = 20%
    expect(metrics.fireProgressPercentage).toBe(20);

    // Cobertura de proventos: 1250 / 5000 = 25%
    expect(metrics.passiveIncomeCoverageRatio).toBe(25);
    expect(metrics.portfolioHealthScore).toBe(50);
    expect(metrics.portfolioHealthScore).toBeGreaterThan(40);
  });
});

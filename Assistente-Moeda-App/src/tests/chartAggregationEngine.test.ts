declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeDefined(): void;
};

import {
  aggregateChartData,
  getDefaultChartConfig,
  type ChartBuilderConfig,
} from '../core/chartAggregationEngine';
import type { TableRow, TableGoals } from '../core/types';

describe('Test Suite: Chart Aggregation Engine & Dynamic Builder', () => {
  const sampleRows: TableRow[] = [
    {
      id: 'row-1',
      date: '2026-09-01',
      value: 1000,
      entryType: 'revenue',
      description: 'Salário',
      category: 'RECEITAS_AH',
    },
    {
      id: 'row-2',
      date: '2026-09-01',
      value: 200,
      entryType: 'expense',
      description: 'Supermercado',
      category: 'ALIMENTAÇÃO',
    },
    {
      id: 'row-3',
      date: '2026-09-15',
      value: 300,
      entryType: 'expense',
      description: 'Farmácia',
      category: 'SAÚDE',
    },
    {
      id: 'row-4',
      date: '2026-08-10',
      value: 500,
      entryType: 'revenue',
      description: 'Freelance',
      category: 'RECEITAS_AH',
    },
    {
      id: 'row-5',
      date: '2025-12-01',
      value: 2000,
      entryType: 'revenue',
      description: 'Bônus Anual',
      category: 'RECEITAS_AH',
    },
    {
      id: 'row-6',
      date: '2026-09-20',
      value: 150,
      entryType: 'deposit',
      description: 'Aporte Tesouro',
      category: 'INVESTIMENTOS',
    },
  ];

  const goals: TableGoals = {
    dailyGoals: { 2026: 50 },
    weeklyGoals: {},
    annualCosts: {},
  };

  it('1. Daily Scope (scopeType: day) agrega corretamente dias do mês', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'day',
      selectedMonth: '2026-09',
    };

    const res = aggregateChartData(sampleRows, config, goals);

    expect(res.points.length).toBe(30);
    const day1 = res.points.find((p) => p.dateISO === '2026-09-01');
    expect(Boolean(day1)).toBe(true);
    expect(day1?.revenue).toBe(1000);
    expect(day1?.expense).toBe(200);
    expect(day1?.balance).toBe(800);
    expect(day1?.rowCount).toBe(2);

    const day15 = res.points.find((p) => p.dateISO === '2026-09-15');
    expect(Boolean(day15)).toBe(true);
    expect(day15?.expense).toBe(300);
    expect(day15?.balance).toBe(-300);

    const day20 = res.points.find((p) => p.dateISO === '2026-09-20');
    expect(Boolean(day20)).toBe(true);
    expect(day20?.deposit).toBe(150);

    expect(res.totalRevenue).toBe(1000);
    expect(res.totalExpense).toBe(500);
    expect(res.netBalance).toBe(500);
    expect(res.totalDeposit).toBe(150);
  });

  it('2. Monthly Scope (scopeType: month) gera 12 meses do ano com saldo acumulado', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'month',
      selectedYear: 2026,
    };

    const res = aggregateChartData(sampleRows, config, goals);
    expect(res.points.length).toBe(12);

    const ago = res.points[7];
    expect(ago.dateISO).toBe('2026-08');
    expect(ago.revenue).toBe(500);

    const set = res.points[8];
    expect(set.dateISO).toBe('2026-09');
    expect(set.revenue).toBe(1000);
    expect(set.expense).toBe(500);
    expect(set.balance).toBe(500);
  });

  it('3. Yearly Scope (scopeType: year) agrega anos disponíveis', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'year',
    };

    const res = aggregateChartData(sampleRows, config);
    expect(res.points.some((p) => p.label === '2025')).toBe(true);
    expect(res.points.some((p) => p.label === '2026')).toBe(true);

    const y2025 = res.points.find((p) => p.label === '2025')!;
    expect(y2025.revenue).toBe(2000);

    const y2026 = res.points.find((p) => p.label === '2026')!;
    expect(y2026.revenue).toBe(1500);
    expect(y2026.expense).toBe(500);
  });

  it('4. Multi-Date Scope (scopeType: multi_date) isola apenas datas especificadas', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'multi_date',
      multiDates: ['2026-09-01', '2026-09-20'],
    };

    const res = aggregateChartData(sampleRows, config);
    expect(res.points.length).toBe(2);
    expect(res.points[0].dateISO).toBe('2026-09-01');
    expect(res.points[0].revenue).toBe(1000);
    expect(res.points[1].dateISO).toBe('2026-09-20');
    expect(res.points[1].deposit).toBe(150);
  });

  it('5. Custom Range Scope filtra período arbitrário', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'custom_range',
      customRange: { start: '2026-08-01', end: '2026-09-10' },
    };

    const res = aggregateChartData(sampleRows, config);
    expect(res.points.some((p) => p.dateISO === '2026-08-10')).toBe(true);
    expect(res.points.some((p) => p.dateISO === '2026-09-01')).toBe(true);
    expect(res.points.some((p) => p.dateISO === '2026-09-15')).toBe(false);
  });

  it('6. Filtro por Categoria isola estritamente despesas e receitas daquela categoria', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'day',
      selectedMonth: '2026-09',
      selectedCategories: ['ALIMENTAÇÃO'],
    };

    const res = aggregateChartData(sampleRows, config);
    expect(res.totalExpense).toBe(200);
    expect(res.totalRevenue).toBe(0);
  });

  it('7. Donut / Fatias de Categoria e Top Category calculados com precisão', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'day',
      selectedMonth: '2026-09',
    };

    const res = aggregateChartData(sampleRows, config);
    expect(res.donutSlices.length > 0).toBe(true);
    expect(Boolean(res.topCategory)).toBe(true);
    expect(res.donutSlices[0].name).toBe('RECEITAS_AH');
    expect(res.donutSlices[0].value).toBe(1000);
  });

  it('8. RowLookupMap permite drill-down das transações que geraram o ponto', () => {
    const config: ChartBuilderConfig = {
      ...getDefaultChartConfig(),
      scopeType: 'day',
      selectedMonth: '2026-09',
    };

    const res = aggregateChartData(sampleRows, config);
    const day1Rows = res.rowLookupMap.get('2026-09-01');
    expect(Boolean(day1Rows)).toBe(true);
    expect(day1Rows?.length).toBe(2);
    expect(day1Rows?.[0].description).toBe('Salário');
    expect(day1Rows?.[1].description).toBe('Supermercado');
  });
});

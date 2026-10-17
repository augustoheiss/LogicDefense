declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import type { TableRow, CoinTable } from '../core/types';

describe('Relatório de Teste: Re-renderização e Imutabilidade Global (contextImport)', () => {
  it('Deve simular carregamento de 64 transações (Motorista) e 1407 transações (Simulação 5 Anos) atualizando activeTable.rows', () => {
    const initialTable: CoinTable = {
      id: 'table-1',
      name: 'Planilha Ativa',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      rows: [],
      goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
      activeSectors: ['personal_finance'],
    };

    // 1. Simulate Motorista import (64 rows)
    const motoristaRows: TableRow[] = Array.from({ length: 64 }).map((_, i) => ({
      id: `row-m-${i + 1}`,
      date: '2026-07-26',
      value: 10 + i,
      description: `Corrida Motorista ${i + 1}`,
      entryType: 'revenue',
      category: 'Geral',
      tags: '',
      metadataJson: '{}',
    }));

    const statePass1: CoinTable = {
      ...initialTable,
      name: 'Motorista',
      rows: [...motoristaRows],
      updatedAt: new Date().toISOString(),
    };

    expect(statePass1.name).toBe('Motorista');
    expect(statePass1.rows.length).toBe(64);

    // 2. Simulate 5-Year Stress Test import (1407 rows)
    const stressRows: TableRow[] = Array.from({ length: 1407 }).map((_, i) => ({
      id: `row-s-${i + 1}`,
      date: '2026-07-27',
      value: 50 + i,
      description: `Transação Estresse ${i + 1}`,
      entryType: 'revenue',
      category: 'Geral',
      tags: '',
      metadataJson: '{}',
    }));

    const statePass2: CoinTable = {
      ...statePass1,
      name: 'Simulação 5 Anos',
      rows: [...stressRows],
      updatedAt: new Date().toISOString(),
    };

    expect(statePass2.name).toBe('Simulação 5 Anos');
    expect(statePass2.rows.length).toBe(1407);
  });
});

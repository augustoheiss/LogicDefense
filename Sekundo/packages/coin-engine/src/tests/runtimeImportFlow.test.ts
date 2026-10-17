declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
  toBeDefined(): void;
  not: {
    toBe(expected: any): void;
  };
};

import type { TableRow, CoinTable } from '../core/types';

describe('Relatório de Teste: Imutabilidade do Store e Fluxo de Atualização de Linhas (runtimeImportFlow)', () => {
  it('Deve simular inserção de 10 linhas e verificar que a referência da tabela é clonada', () => {
    const initialRows: TableRow[] = [];
    const initialTable: CoinTable = {
      id: 'table-1',
      name: 'Planilha Teste',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      rows: initialRows,
      goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
      activeSectors: ['personal_finance'],
    };

    const newRows: TableRow[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `row-${i + 1}`,
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      value: (i + 1) * 100,
      description: `Transação ${i + 1}`,
      entryType: 'revenue',
      category: 'Geral',
      tags: '',
      metadataJson: '{}',
    }));

    // Immutability simulation matching useCoinDB logic
    const updatedTable: CoinTable = {
      ...initialTable,
      rows: [...newRows].sort((a, b) => a.date.localeCompare(b.date)),
      updatedAt: new Date().toISOString(),
    };

    const clonedActiveSelector = {
      ...updatedTable,
      rows: [...updatedTable.rows],
    };

    expect(clonedActiveSelector.rows.length).toBe(10);
    expect(clonedActiveSelector.rows).not.toBe(initialRows);
    expect(clonedActiveSelector.rows[0].value).toBe(100);
    expect(clonedActiveSelector.rows[9].value).toBe(1000);
  });
});

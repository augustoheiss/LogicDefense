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
  not: any;
};

import { reduceDB } from '../core/dbReducer';
import type { DB, CoinTable, TableRow } from '../core/types';

describe('Test Suite: Database Reducer & Inverse Actions (reduceDB)', () => {
  const initialTable: CoinTable = {
    id: 'tbl_1',
    name: 'Família',
    description: 'Planilha principal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rows: [
      { id: 'r1', date: '2026-07-01', value: 100, description: 'Supermercado', entryType: 'expense' },
      { id: 'r2', date: '2026-07-02', value: 2500, description: 'Salário', entryType: 'revenue' },
    ],
    goals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} },
    activeSectors: ['personal_finance'],
  };

  const initialDB: DB = {
    tables: [initialTable],
  };

  it('ADD_ROWS: deve adicionar linhas imutavelmente e gerar inverseAction de DELETE_ROWS', () => {
    const newRows: TableRow[] = [
      { id: 'r3', date: '2026-07-03', value: 50, description: 'Farmácia', entryType: 'expense' },
    ];

    const result = reduceDB(initialDB, {
      type: 'ADD_ROWS',
      payload: { tableId: 'tbl_1', rows: newRows },
    });

    expect(result.nextDB.tables[0].rows.length).toBe(3);
    expect(result.nextDB.tables[0].rows[2].id).toBe('r3');
    expect(result.inverseAction?.type).toBe('DELETE_ROWS');
    if (result.inverseAction?.type === 'DELETE_ROWS') {
      expect(result.inverseAction.payload.rowIds).toContain('r3');

      // Executa o inverso e verifica se desfaz com perfeição
      const undoResult = reduceDB(result.nextDB, result.inverseAction);
      expect(undoResult.nextDB.tables[0].rows.length).toBe(2);
      expect(undoResult.nextDB.tables[0].rows.some(r => r.id === 'r3')).toBe(false);
    }
  });

  it('DELETE_ROWS: deve remover linhas e gerar inverseAction de ADD_ROWS com snapshot intacto', () => {
    const result = reduceDB(initialDB, {
      type: 'DELETE_ROWS',
      payload: { tableId: 'tbl_1', rowIds: ['r1'] },
    });

    expect(result.nextDB.tables[0].rows.length).toBe(1);
    expect(result.nextDB.tables[0].rows[0].id).toBe('r2');
    expect(result.inverseAction?.type).toBe('ADD_ROWS');

    if (result.inverseAction?.type === 'ADD_ROWS') {
      expect(result.inverseAction.payload.rows.length).toBe(1);
      expect(result.inverseAction.payload.rows[0].id).toBe('r1');

      // Aplica o desfazer
      const undoResult = reduceDB(result.nextDB, result.inverseAction);
      expect(undoResult.nextDB.tables[0].rows.length).toBe(2);
      expect(undoResult.nextDB.tables[0].rows.some(r => r.id === 'r1')).toBe(true);
    }
  });

  it('UPDATE_ROW: deve atualizar campos e gerar inverseAction com estado anterior para rollback', () => {
    const result = reduceDB(initialDB, {
      type: 'UPDATE_ROW',
      payload: {
        tableId: 'tbl_1',
        rowId: 'r1',
        updates: { value: 180, description: 'Supermercado Pão de Açúcar' },
      },
    });

    const updatedRow = result.nextDB.tables[0].rows.find(r => r.id === 'r1');
    expect(updatedRow?.value).toBe(180);
    expect(updatedRow?.description).toBe('Supermercado Pão de Açúcar');

    expect(result.inverseAction?.type).toBe('UPDATE_ROW');
    if (result.inverseAction?.type === 'UPDATE_ROW') {
      expect(result.inverseAction.payload.updates.value).toBe(100);
      expect(result.inverseAction.payload.updates.description).toBe('Supermercado');

      // Rollback via inverseAction
      const undoResult = reduceDB(result.nextDB, result.inverseAction);
      const restoredRow = undoResult.nextDB.tables[0].rows.find(r => r.id === 'r1');
      expect(restoredRow?.value).toBe(100);
      expect(restoredRow?.description).toBe('Supermercado');
    }
  });

  it('RENAME_TABLE: deve renomear tabela e permitir desfazer para o nome original', () => {
    const result = reduceDB(initialDB, {
      type: 'RENAME_TABLE',
      payload: { tableId: 'tbl_1', name: 'Casa e Contas' },
    });

    expect(result.nextDB.tables[0].name).toBe('Casa e Contas');
    expect(result.inverseAction?.type).toBe('RENAME_TABLE');
    if (result.inverseAction?.type === 'RENAME_TABLE') {
      expect(result.inverseAction.payload.name).toBe('Família');

      const undoResult = reduceDB(result.nextDB, result.inverseAction);
      expect(undoResult.nextDB.tables[0].name).toBe('Família');
    }
  });
});

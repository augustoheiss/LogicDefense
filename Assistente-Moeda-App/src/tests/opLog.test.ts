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

import { OpLog } from '../core/opLog';

describe('Test Suite: OpLog & Rolling Undo/Redo Engine', () => {
  it('Deve registrar ações e permitir desfazer e refazer', () => {
    const oplog = new OpLog(5);

    expect(oplog.canUndo()).toBe(false);
    expect(oplog.canRedo()).toBe(false);

    oplog.push(
      { type: 'ADD_ROWS', payload: { rows: [{ id: '1', date: '2026-07-01', value: 10 }] } },
      { type: 'DELETE_ROWS', payload: { rowIds: ['1'] } }
    );

    expect(oplog.canUndo()).toBe(true);
    expect(oplog.getUndoCount()).toBe(1);
    expect(oplog.getLastUndoDescription()).toBe('Adicionar 1 lançamento');

    // Desfaz
    const undoEntry = oplog.popUndo();
    expect(undoEntry?.inverseAction.type).toBe('DELETE_ROWS');
    expect(oplog.canUndo()).toBe(false);
    expect(oplog.canRedo()).toBe(true);

    // Refaz
    const redoEntry = oplog.popRedo();
    expect(redoEntry?.action.type).toBe('ADD_ROWS');
    expect(oplog.canUndo()).toBe(true);
    expect(oplog.canRedo()).toBe(false);
  });

  it('Deve limitar o histórico pelo maxEntries', () => {
    const oplog = new OpLog(3);
    for (let i = 1; i <= 5; i++) {
      oplog.push(
        { type: 'UPDATE_ROW', payload: { rowId: `r${i}`, updates: { value: i } } },
        { type: 'UPDATE_ROW', payload: { rowId: `r${i}`, updates: { value: 0 } } }
      );
    }

    expect(oplog.getUndoCount()).toBe(3);
  });
});

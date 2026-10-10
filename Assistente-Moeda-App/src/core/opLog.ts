/**
 * Op-Log & Undo/Redo Engine — Assistente Moeda
 *
 * Keeps an append-only rolling history of user/AI operations with inverse actions.
 * Provides deterministic undo and redo capabilities for the entire app.
 */

import type { Action } from './actions';

export interface OpLogEntry {
  id: string;
  timestamp: string;
  action: Action;
  inverseAction: Action;
  description: string;
}

export class OpLog {
  private undoStack: OpLogEntry[] = [];
  private redoStack: OpLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Record an executed action and its inverse counterpart.
   * Clears redo stack upon new user operations.
   */
  public push(action: Action, inverseAction: Action, description?: string): void {
    const entry: OpLogEntry = {
      id: 'op_' + Math.random().toString(36).slice(2, 10),
      timestamp: new Date().toISOString(),
      action,
      inverseAction,
      description: description || this.describeAction(action),
    };

    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Pop the last operation to undo it.
   * Returns the inverse action to be executed and saves entry to redo stack.
   */
  public popUndo(): OpLogEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry;
  }

  /**
   * Pop the last undone operation to redo it.
   */
  public popRedo(): OpLogEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry;
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoCount(): number {
    return this.undoStack.length;
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }

  public getLastUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private describeAction(action: Action): string {
    switch (action.type) {
      case 'ADD_ROWS': {
        const count = action.payload.rows.length;
        return count === 1 ? 'Adicionar 1 lançamento' : `Adicionar ${count} lançamentos`;
      }
      case 'DELETE_ROWS': {
        const count = action.payload.rowIds.length;
        return count === 1 ? 'Excluir 1 lançamento' : `Excluir ${count} lançamentos`;
      }
      case 'UPDATE_ROW':
        return 'Editar lançamento';
      case 'SET_TABLE_ROWS':
        return 'Atualizar lançamentos da planilha';
      case 'ADD_TABLE':
        return `Criar planilha "${action.payload.table.name}"`;
      case 'DELETE_TABLE':
        return 'Excluir planilha';
      case 'RENAME_TABLE':
        return `Renomear planilha para "${action.payload.name}"`;
      case 'REORDER_TABLES':
        return 'Reordenar planilhas';
      case 'UPDATE_GOALS':
        return 'Atualizar metas financeiras';
      case 'UPDATE_SECTORS':
        return 'Atualizar setores da planilha';
      case 'RENAME_CATEGORY':
        return `Renomear categoria para "${action.payload.newCategory}"`;
      default:
        return 'Operação financeira';
    }
  }
}

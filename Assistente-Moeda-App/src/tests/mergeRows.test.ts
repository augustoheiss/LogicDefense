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
};

import { mergeRows, isBankRowAlreadyPresent, generateUUIDv4, exportRowsToCSV, parseCSVText } from '../utils/csvEngine';
import type { TableRow } from '../core/types';

describe('mergeRows Engine & Deduplication Tests', () => {
  it('CASO 1: Deve fazer UPDATE de linha existente quando incoming possui ID correspondente', () => {
    const existing: TableRow[] = [
      { id: 'tx_001', date: '2026-08-01', value: 100, description: 'Supermercado', entryType: 'expense', category: 'Alimentação' },
      { id: 'tx_002', date: '2026-08-02', value: 50, description: 'Farmácia', entryType: 'expense', category: 'Saúde' },
    ];

    const incoming: TableRow[] = [
      { id: 'tx_001', date: '2026-08-01', value: 120, description: 'Supermercado Atualizado', entryType: 'expense', category: 'Alimentação' },
    ];

    const result = mergeRows(existing, incoming);

    expect(result.length).toBe(2);
    const updated = result.find((r) => r.id === 'tx_001');
    expect(updated).toBeDefined();
    expect(updated?.value).toBe(120);
    expect(updated?.description).toBe('Supermercado Atualizado');
  });

  it('CASO 2: Deve fazer INSERT de nova linha quando incoming possui ID novo que não existe', () => {
    const existing: TableRow[] = [
      { id: 'tx_001', date: '2026-08-01', value: 100, description: 'Supermercado', entryType: 'expense', category: 'Alimentação' },
    ];

    const newUuid = generateUUIDv4();
    const incoming: TableRow[] = [
      { id: newUuid, date: '2026-08-03', value: 200, description: 'Posto de Gasolina', entryType: 'expense', category: 'Transporte' },
    ];

    const result = mergeRows(existing, incoming);

    expect(result.length).toBe(2);
    const inserted = result.find((r) => r.id === newUuid);
    expect(inserted).toBeDefined();
    expect(inserted?.description).toBe('Posto de Gasolina');
  });

  it('CASO 3: Linha de Banco sem ID — Deve ignorar reimportação do mesmo arquivo sem duplicar', () => {
    const existing: TableRow[] = [
      { id: 'tx_existing_1', date: '2026-08-01', value: 5.0, description: 'Café Expresso', entryType: 'expense', category: 'Geral' },
    ];

    // Reimport do mesmo arquivo sem ID
    const incomingWithoutId: Omit<TableRow, 'id'>[] = [
      { date: '2026-08-01', value: 5.0, description: 'Café Expresso', entryType: 'expense', category: 'Geral' },
    ];

    const result = mergeRows(existing, incomingWithoutId);

    // Como já existia 1 café na mesma data com mesmo valor e descrição, não deve duplicar
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('tx_existing_1');
  });

  it('CASO 3: Linha de Banco sem ID — Deve permitir 2º café no mesmo dia se incoming trouxer 2 cafés e DB só tinha 1', () => {
    const existing: TableRow[] = [
      { id: 'tx_existing_1', date: '2026-08-01', value: 5.0, description: 'Café Expresso', entryType: 'expense', category: 'Geral' },
    ];

    // Extrato com 2 cafés idênticos no mesmo dia
    const incomingWithoutId: Omit<TableRow, 'id'>[] = [
      { date: '2026-08-01', value: 5.0, description: 'Café Expresso', entryType: 'expense', category: 'Geral' },
      { date: '2026-08-01', value: 5.0, description: 'Café Expresso', entryType: 'expense', category: 'Geral' },
    ];

    const result = mergeRows(existing, incomingWithoutId);

    // O 1º café bate com o existente. O 2º café é adicionado como nova entrada com UUID v4.
    expect(result.length).toBe(2);
    expect(result.filter((r) => r.value === 5.0 && r.description === 'Café Expresso').length).toBe(2);
  });

  it('isBankRowAlreadyPresent: Detecta presença por fingerprint de data, valor e descrição', () => {
    const existing: TableRow[] = [
      { id: 'tx_1', date: '2026-08-01', value: 15.50, description: 'Almoço', entryType: 'expense' },
    ];

    expect(isBankRowAlreadyPresent(existing, { date: '2026-08-01', value: 15.50, description: 'Almoço' })).toBe(true);
    expect(isBankRowAlreadyPresent(existing, { date: '2026-08-01', value: 20.00, description: 'Almoço' })).toBe(false);
  });

  it('Roundtrip Export/Import CSV com IDs: Preserva UUIDs e executa UPDATE no merge', () => {
    const originalRows: TableRow[] = [
      { id: 'uuid-101', date: '2026-08-01', value: 150.00, description: 'Serviço Prestado', entryType: 'revenue', category: 'Serviços' },
      { id: 'uuid-102', date: '2026-08-02', value: 45.00, description: 'Material de Escritório', entryType: 'expense', category: 'Insumos' },
    ];

    // Exporta para CSV
    const csvContent = exportRowsToCSV(originalRows);
    expect(csvContent).toContain('id,date,value');
    expect(csvContent).toContain('uuid-101');
    expect(csvContent).toContain('uuid-102');

    // Simula alteração do usuário no CSV exportado (UPDATE em uuid-101)
    const modifiedCsv = csvContent.replace('150.00', '180.00');

    // Importa o CSV modificado de volta
    const parsed = parseCSVText(modifiedCsv);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0]).toHaveProperty('id', 'uuid-101');

    // Executa merge com o estado existente
    const merged = mergeRows(originalRows, parsed.rows);
    expect(merged.length).toBe(2);

    const updatedRow = merged.find((r) => r.id === 'uuid-101');
    expect(updatedRow?.value).toBe(180.00);
  });
});

declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import { parseCSVText, exportRowsToCSV } from '../utils/csvEngine';
import { buildCSV } from '../services/exportService';
import type { TableRow } from '../core/types';

describe('Relatório de Teste: Prevenção de Crash Roundtrip Import/Export', () => {
  it('Deve importar CSV auto-gerado com campos trailing vazios sem lançar SyntaxError', () => {
    const selfExportedCSV = `## COIN ASSISTANT BACKUP v2 ##
name,Motorista
## ROWS ##
date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json
2026-07-26,1,"",revenue,,,,,,,`;

    // 1. Import first time
    const result1 = parseCSVText(selfExportedCSV);

    expect(result1.errors.length).toBe(0);
    expect(result1.skippedCount).toBe(0);
    expect(result1.rows.length).toBe(1);

    const row = result1.rows[0];
    expect(row.date).toBe('2026-07-26');
    expect(row.value).toBe(1);
    expect(row.entryType).toBe('revenue');
    expect(row.category).toBe('Geral');
    expect(row.tags).toBe('');
    expect(row.metadataJson).toBe('{}');

    // 2. Export row back via exportRowsToCSV
    const mockRows: TableRow[] = [{ ...row, id: 'row-1' }];
    const exportedCSV = exportRowsToCSV(mockRows);

    // Assert exported CSV contains "{}" for metadata_json instead of empty space
    expect(exportedCSV).toContain('"{}"');
    expect(exportedCSV).toContain('"Geral"');

    // 3. Export row back via buildCSV (with metadata block)
    const fullBackupExport = buildCSV(mockRows, 'Motorista', 'Planilha Motorista', { dailyGoals: {}, weeklyGoals: {}, annualCosts: {} });
    expect(fullBackupExport).toContain('"{}"');

    // 4. Re-import exported CSV strings and assert 100% identical data
    const result2 = parseCSVText(exportedCSV);
    expect(result2.errors.length).toBe(0);
    expect(result2.rows.length).toBe(1);
    expect(result2.rows[0].date).toBe(row.date);
    expect(result2.rows[0].value).toBe(row.value);
    expect(result2.rows[0].category).toBe('Geral');
    expect(result2.rows[0].metadataJson).toBe('{}');

    const result3 = parseCSVText(fullBackupExport);
    expect(result3.errors.length).toBe(0);
    expect(result3.rows.length).toBe(1);
    expect(result3.rows[0].date).toBe(row.date);
    expect(result3.rows[0].value).toBe(row.value);
    expect(result3.rows[0].metadataJson).toBe('{}');
  });
});

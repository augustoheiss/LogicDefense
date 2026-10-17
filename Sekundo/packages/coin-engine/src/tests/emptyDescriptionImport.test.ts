declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import { parseCSVText } from '../utils/csvEngine';

describe('Relatório de Teste: Preservação de Linhas com Descrição Vazia (emptyDescriptionImport)', () => {
  it('Deve importar a linha 2026-07-26,1,"",revenue sem descartá-la e mantendo parsed.rows.length === 1', () => {
    const rawCSV = `## COIN ASSISTANT BACKUP v2 ##
name,Motorista
## ROWS ##
date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json
2026-07-26,1,"",revenue,,,,,"Geral","","{}"`;

    const result = parseCSVText(rawCSV);

    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(1);

    const row = result.rows[0];
    expect(row.date).toBe('2026-07-26');
    expect(row.value).toBe(1);
    expect(row.entryType).toBe('revenue');
    expect(row.category).toBe('Geral');
    expect(row.tags).toBe('');
    expect(row.metadataJson).toBe('{}');
    // Ensure description was NOT dropped
    expect(row.description).toBe('');
  });
});

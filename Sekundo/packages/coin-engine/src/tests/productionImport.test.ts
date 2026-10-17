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

describe('Relatório de Teste: Fidelidade de Importação Backup v2 da Produção', () => {
  it('Deve importar planilha Backup v2 da produção com 100% de sucesso mantendo tipos customizados intactos', () => {
    const rawBackupV2 = `## COIN ASSISTANT BACKUP v2 ##
name,Motorista-Executivo
description,Movimentos
## ROWS ##
date,value,description,entryType,monthlyValue,monthCount,period_start,period_end
2026-01-01,6919.8,"IPVA",expense,576.65,12,2026-01-01,2026-12-31
2026-03-01,600,"PLACA PERDIDA",waiver,,,,
2026-05-20,2485.67,"REVISÃO DE 12000KM",partner_out,,,,
2026-05-20,2485.67,"REVISÃO DE 12000KM",partner_in,,,,`;

    const result = parseCSVText(rawBackupV2);

    // 1. Check success and metadata
    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(4);
    expect(result.metadata?.name).toBe('Motorista-Executivo');
    expect(result.metadata?.description).toBe('Movimentos');

    // 2. Row 1: expense with recurrence and period fields
    expect(result.rows[0].date).toBe('2026-01-01');
    expect(result.rows[0].value).toBe(6919.8);
    expect(result.rows[0].description).toBe('IPVA');
    expect(result.rows[0].entryType).toBe('expense');
    expect(result.rows[0].monthlyValue).toBe(576.65);
    expect(result.rows[0].monthCount).toBe(12);
    expect(result.rows[0].periodStart).toBe('2026-01-01');
    expect(result.rows[0].periodEnd).toBe('2026-12-31');

    // 3. Row 2: strictly waiver
    expect(result.rows[1].date).toBe('2026-03-01');
    expect(result.rows[1].value).toBe(600);
    expect(result.rows[1].description).toBe('PLACA PERDIDA');
    expect(result.rows[1].entryType).toBe('waiver');

    // 4. Row 3: strictly partner_out
    expect(result.rows[2].date).toBe('2026-05-20');
    expect(result.rows[2].value).toBe(2485.67);
    expect(result.rows[2].description).toBe('REVISÃO DE 12000KM');
    expect(result.rows[2].entryType).toBe('partner_out');

    // 5. Row 4: strictly partner_in
    expect(result.rows[3].date).toBe('2026-05-20');
    expect(result.rows[3].value).toBe(2485.67);
    expect(result.rows[3].description).toBe('REVISÃO DE 12000KM');
    expect(result.rows[3].entryType).toBe('partner_in');

    // 6. Cents accuracy assertion (6919.8 -> 691980 cents)
    const cents = Math.round(result.rows[0].value * 100);
    expect(cents).toBe(691980);
  });
});

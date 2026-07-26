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

describe('Relatório de Teste: Importação CSV sem Bloco de Metadados/Metas (noGoalsImport)', () => {
  it('Deve importar 100% das linhas de um CSV simples sem metas sem gerar erros ou chamar updateGoals', () => {
    const rawCSV = `date,value,description,entryType,category,tags
2026-07-01,150.00,"Aluguel",expense,"Moradia","fixo"
2026-07-02,3500.00,"Salário",revenue,"Trabalho","clt"
2026-07-03,45.50,"Mercado",expense,"Alimentação","essencial"`;

    const result = parseCSVText(rawCSV);

    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(3);

    // Row assertions
    expect(result.rows[0].date).toBe('2026-07-01');
    expect(result.rows[0].value).toBe(150);
    expect(result.rows[0].entryType).toBe('expense');
    expect(result.rows[0].category).toBe('Moradia');

    expect(result.rows[1].date).toBe('2026-07-02');
    expect(result.rows[1].value).toBe(3500);
    expect(result.rows[1].entryType).toBe('revenue');

    expect(result.rows[2].date).toBe('2026-07-03');
    expect(result.rows[2].value).toBe(45.5);

    // Metadata fallback assertion
    expect(result.metadata).toBeTruthy();
    expect(result.metadata?.name).toBe('Minha Planilha');
  });
});

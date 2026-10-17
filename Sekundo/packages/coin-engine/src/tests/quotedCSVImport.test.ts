declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import { parseCSVText, cleanCell } from '../utils/csvEngine';

describe('Relatório de Teste: Tokenizador CSV Quote-Aware e Parsing de Metadados JSON', () => {
  it('Deve limpar aspas externas e desescapar aspas duplas internas', () => {
    expect(cleanCell('"Geral"')).toBe('Geral');
    expect(cleanCell('"{}"')).toBe('{}');
    expect(cleanCell('"{""a"":1}"')).toBe('{"a":1}');
    expect(cleanCell('"Corrida, com vírgula"')).toBe('Corrida, com vírgula');
  });

  it('Deve importar CSV com vírgulas internas entre aspas e objetos JSON sem quebrar colunas', () => {
    const quotedCSV = `## COIN ASSISTANT BACKUP v2 ##
name,Motorista
## ROWS ##
date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json
2026-07-26,1,"",revenue,,,,,"Geral","","{}"
2026-07-27,500,"Corrida, com vírgula",revenue,,,,,"Viagens","tag1,tag2","{""massa_salarial_12"":80000,""receita_bruta_12"":570000}"`;

    const result = parseCSVText(quotedCSV);

    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(2);

    // Row 1 assertions
    expect(result.rows[0].date).toBe('2026-07-26');
    expect(result.rows[0].value).toBe(1);
    expect(result.rows[0].category).toBe('Geral');
    expect(result.rows[0].metadataJson).toBe('{}');
    const row1MetaObj = JSON.parse(result.rows[0].metadataJson!);
    expect(typeof row1MetaObj).toBe('object');

    // Row 2 assertions
    expect(result.rows[1].date).toBe('2026-07-27');
    expect(result.rows[1].value).toBe(500);
    expect(result.rows[1].description).toBe('Corrida, com vírgula');
    expect(result.rows[1].category).toBe('Viagens');
    expect(result.rows[1].tags).toBe('tag1,tag2');

    // Metadata JSON object parse assertion
    const row2MetaObj = JSON.parse(result.rows[1].metadataJson!);
    expect(row2MetaObj.massa_salarial_12).toBe(80000);
    expect(row2MetaObj.receita_bruta_12).toBe(570000);
  });
});

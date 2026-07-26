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

describe('Testes de Retrocompatibilidade de Importação CSV Legacy', () => {
  it('Deve importar CSV barebones contendo apenas "data,descricao,valor" com 100% de sucesso e aplicar defaults', () => {
    const rawCSV = `data,descricao,valor
15/07/2026,"Compra de Supermercado",-150.50
2026-07-20,"Recebimento de Cliente",5000.00`;

    const result = parseCSVText(rawCSV);

    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(2);

    // Row 1 assertions
    expect(result.rows[0].date).toBe('2026-07-15');
    expect(result.rows[0].description).toBe('Compra de Supermercado');
    expect(result.rows[0].value).toBe(-150.50);
    expect(result.rows[0].category).toBe('Geral');
    expect(result.rows[0].tags).toBe('');
    expect(result.rows[0].metadataJson).toBe('{}');

    // Row 2 assertions
    expect(result.rows[1].date).toBe('2026-07-20');
    expect(result.rows[1].description).toBe('Recebimento de Cliente');
    expect(result.rows[1].value).toBe(5000.00);
    expect(result.rows[1].category).toBe('Geral');
    expect(result.rows[1].tags).toBe('');
    expect(result.rows[1].metadataJson).toBe('{}');
  });

  it('Deve interpretar formatos de moeda brasileira (R$ 1.500,00) e centavos inteiros (valor_cents)', () => {
    const brlCSV = `data,descricao,valor
01/08/2026,"Serviço TI","R$ 1.500,00"
02/08/2026,"Taxa","-150,50"`;

    const resultBrl = parseCSVText(brlCSV);
    expect(resultBrl.rows[0].value).toBe(1500.00);
    expect(resultBrl.rows[1].value).toBe(-150.50);

    const centsCSV = `data_movimento,historico,valor_cents
2026-08-05,"Pagamento Fornecedor",150000`;

    const resultCents = parseCSVText(centsCSV);
    expect(resultCents.rows.length).toBe(1);
    expect(resultCents.rows[0].date).toBe('2026-08-05');
    expect(resultCents.rows[0].description).toBe('Pagamento Fornecedor');
    expect(resultCents.rows[0].value).toBe(1500.00);
  });

  it('Deve aceitar diferentes aliases de colunas (data_movimento, historico, title, memo, value)', () => {
    const aliasCSV = `data_movimento,title,value,categoria
10-08-2026,"Consultoria",3500.00,"Serviços"`;

    const result = parseCSVText(aliasCSV);
    expect(result.errors.length).toBe(0);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].date).toBe('2026-08-10');
    expect(result.rows[0].description).toBe('Consultoria');
    expect(result.rows[0].value).toBe(3500.00);
    expect(result.rows[0].category).toBe('Serviços');
  });

  it('Princípio Zero Perdas: não deve rejeitar linhas por causa de metadados inválidos ou ausentes', () => {
    const corruptMetaCSV = `data,descricao,valor,metadata_json
2026-08-12,"Venda Direta",800.00,"texto_invalido_sem_json"`;

    const result = parseCSVText(corruptMetaCSV);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].metadataJson).toBe('{}');
    expect(result.rows[0].value).toBe(800.00);
  });
});

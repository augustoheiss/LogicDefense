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
import type { TableRow } from '../core/types';

describe('Relatório de Teste 02: Reconciliação e Integridade do Motor CSV', () => {
  it('Deve importar texto CSV in-place com sucesso', () => {
    const rawCSV = `date,value,description,entryType,category,tags
2026-07-01,150000.00,"Faturamento Servicos de TI",revenue,"Receita de Vendas","ncg,welford"
2026-07-02,30000.00,"Folha de Pagamento CLT",expense,"Massa Salarial","fap_rat"`;

    const result = parseCSVText(rawCSV);

    expect(result.errors.length).toBe(0);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].date).toBe('2026-07-01');
    expect(result.rows[0].value).toBe(150000.00);
    expect(result.rows[0].entryType).toBe('revenue');
  });

  it('Garante precisão exata de centavos inteiros (amount_in_cents) sem perdas de ponto flutuante', () => {
    const testCases = [
      { raw: '150000.00', expectedCents: 15000000 },
      { raw: '120.55', expectedCents: 12055 },
      { raw: '0.01', expectedCents: 1 },
      { raw: '999999.99', expectedCents: 99999999 },
    ];

    testCases.forEach((tc) => {
      const csv = `date,value,description\n2026-07-01,${tc.raw},"Teste Cents"`;
      const parsed = parseCSVText(csv);
      const val = parsed.rows[0].value;
      const cents = Math.round(val * 100);
      expect(cents).toBe(tc.expectedCents);
    });
  });

  it('Deve autodetectar e autoativar tags de setores especializados', () => {
    const multiSectorCSV = `date,value,description,entryType,category,tags,metadata_json
2026-07-01,150000.00,"Faturamento PME",revenue,"Vendas","ncg,welford","{""receita_bruta_12"":350000}"
2026-07-03,10000.00,"Litigio Trabalhista",deposit,"Ações","adc_58,simples_nacional","{""data_ajuizamento"":""2024-05-20""}"
2026-07-04,450000.00,"Predio Comercial",deposit,"Imóveis","sistema_sac,cap_rate","{""property_value"":450000}"
2026-07-05,120.00,"Manutencao Frota",expense,"Frotas","cpk,weibull","{""idveiculo"":""CAR01""}"
2026-07-08,5000.00,"Investimento Offshore",deposit,"Offshore","fbar,fatca,monte_carlo","{""jurisdicao_pais"":""Suiça""}"`;

    const result = parseCSVText(multiSectorCSV);

    expect(result.detectedSectors).toContain('smb_accounting');
    expect(result.detectedSectors).toContain('legal_taxes');
    expect(result.detectedSectors).toContain('real_estate');
    expect(result.detectedSectors).toContain('vehicles');
    expect(result.detectedSectors).toContain('personal_finance');
  });

  it('Deve garantir integridade Roundtrip (Importação -> Exportação -> Re-importação)', () => {
    const originalCSV = `date,value,description,entryType,category,tags,metadata_json
2026-07-01,150000.00,"Faturamento Servicos de TI",revenue,"Receita de Vendas","ncg,welford","{""massa_salarial_12"":90000}"`;

    const firstParse = parseCSVText(originalCSV);
    const mockRows: TableRow[] = firstParse.rows.map((r, idx) => ({ ...r, id: `row-${idx}` }));

    const exportedCSV = exportRowsToCSV(mockRows);
    const secondParse = parseCSVText(exportedCSV);

    expect(secondParse.rows.length).toBe(firstParse.rows.length);
    expect(secondParse.rows[0].date).toBe(firstParse.rows[0].date);
    expect(secondParse.rows[0].value).toBe(firstParse.rows[0].value);
    expect(secondParse.rows[0].description).toBe(firstParse.rows[0].description);
    expect(secondParse.rows[0].entryType).toBe(firstParse.rows[0].entryType);
  });
});

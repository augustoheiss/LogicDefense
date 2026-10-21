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

  it('Deve particionar múltiplas planilhas financeiras de um Sekundo Omni-CSV (#PLANILHA,coin_ledger_row) sem fundir tableIds distintos', () => {
    const omniMultiTableCsv = [
      '#PLANILHA,coin_ledger_row,Assistente Moeda',
      '_container_id,_key,_type,_engines,group_or_tier,date_or_cycle,time_or_duration,title_or_name,primary_assignee,secondary_assignee,status_or_readiness,capabilities_or_tags,contact_or_location,notes_or_payload,_meta_json',
      'coin-pf-01,r1,leaf,financial_ledger,Salário,2026-10-01,mensal,Receita PF,7500,revenue,paid,PIX,Assistente Moeda,7500,"{""tableId"":""coin-pf-01"",""tableName"":""Planilha PF"",""tableEnvelope"":{""goals"":{""dailyGoals"":{""2026"":110}}}}"',
      'coin-pf-01,r2,leaf,financial_ledger,Moradia,2026-10-03,mensal,Aluguel PF,2200,expense,paid,Boleto,Assistente Moeda,2200,"{""tableId"":""coin-pf-01"",""tableName"":""Planilha PF""}"',
      'coin-pj-02,r3,leaf,financial_ledger,Faturamento,2026-10-05,mensal,Honorários PJ,18400,revenue,paid,TED,Assistente Moeda,18400,"{""tableId"":""coin-pj-02"",""tableName"":""Planilha PJ"",""tableEnvelope"":{""goals"":{""dailyGoals"":{""2026"":400}}}}"',
      '#ABA_PLANILHA,coin_ledger_row,FIM_DA_PLANILHA',
    ].join('\n');

    const parsed = parseCSVText(omniMultiTableCsv);

    expect(parsed.errors.length).toBe(0);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.tablePartitions?.length).toBe(2);
    expect(parsed.tablePartitions?.[0].tableId).toBe('coin-pf-01');
    expect(parsed.tablePartitions?.[0].metadata.name).toBe('Planilha PF');
    expect(parsed.tablePartitions?.[0].rows.length).toBe(2);
    expect(parsed.tablePartitions?.[0].rows[0].value).toBe(7500);
    expect(parsed.tablePartitions?.[1].tableId).toBe('coin-pj-02');
    expect(parsed.tablePartitions?.[1].metadata.name).toBe('Planilha PJ');
    expect(parsed.tablePartitions?.[1].rows.length).toBe(1);
    expect(parsed.tablePartitions?.[1].rows[0].value).toBe(18400);
  });
});

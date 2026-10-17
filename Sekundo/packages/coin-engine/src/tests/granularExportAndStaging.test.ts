declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toBeLessThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeDefined(): void;
};

import { serializeGranularCSV } from '../core/dynamicCsvSerializer';
import { parseCSVText } from '../utils/csvEngine';
import { computeMetrics } from '../core/metricsEngine';
import type { TableRow } from '../core/types';

describe('Relatório de Teste 26: Pipeline Granular de Exportação e Staging Quarentena (Agent-Native)', () => {
  const sampleRows: TableRow[] = [
    {
      id: 'row-1',
      date: '2026-07-01',
      value: 5000.0,
      description: 'Salário Mensal',
      entryType: 'revenue',
      category: 'Renda',
    },
    {
      id: 'row-2',
      date: '2026-07-05',
      value: 1200.0,
      description: 'Aluguel do Imóvel',
      entryType: 'expense',
      category: 'Moradia',
    },
    {
      id: 'row-3',
      date: '2026-07-10',
      value: 800.0,
      description: 'Aporte Tesouro Selic',
      entryType: 'deposit',
      category: 'Investimentos',
    },
    {
      id: 'row-4',
      date: '2026-07-15',
      value: 350.0,
      description: 'Cartão Nubank Item Ambíguo',
      entryType: 'unresolved',
      category: 'Fatura',
    },
    {
      id: 'row-5',
      date: '2026-08-01',
      value: 6000.0,
      description: 'Projeto Freelance',
      entryType: 'revenue',
      category: 'Serviços',
    },
  ];

  it('1. Serializa CSV Granular por escopo (Apenas Receitas)', () => {
    const csv = serializeGranularCSV(sampleRows, {
      scope: 'revenue',
      format: 'agent_compact',
      delimiter: ',',
    });

    expect(csv).toContain('Salário Mensal');
    expect(csv).toContain('Projeto Freelance');
    expect(csv.includes('Aluguel do Imóvel')).toBe(false);
    expect(csv.includes('Aporte Tesouro Selic')).toBe(false);
    expect(csv.includes('Cartão Nubank Item Ambíguo')).toBe(false);
  });

  it('2. Serializa CSV Granular por escopo (Apenas Despesas)', () => {
    const csv = serializeGranularCSV(sampleRows, {
      scope: 'expense',
      format: 'agent_compact',
      delimiter: ',',
    });

    expect(csv).toContain('Aluguel do Imóvel');
    expect(csv.includes('Salário Mensal')).toBe(false);
    expect(csv.includes('Aporte Tesouro Selic')).toBe(false);
  });

  it('3. Serializa CSV Granular por escopo (Apenas Quarentena / Neutro)', () => {
    const csv = serializeGranularCSV(sampleRows, {
      scope: 'unresolved',
      format: 'agent_compact',
      delimiter: ',',
    });

    expect(csv).toContain('Cartão Nubank Item Ambíguo');
    expect(csv.includes('Salário Mensal')).toBe(false);
    expect(csv.includes('Aluguel do Imóvel')).toBe(false);
  });

  it('4. Filtra por mês na exportação granular', () => {
    const csv = serializeGranularCSV(sampleRows, {
      scope: 'revenue',
      selectedMonth: '2026-07',
      format: 'agent_compact',
      delimiter: ',',
    });

    expect(csv).toContain('Salário Mensal');
    // Agosto deve ser filtrado
    expect(csv.includes('Projeto Freelance')).toBe(false);
  });

  it('5. Formato agent_compact economiza tokens e omite colunas internas', () => {
    const csv = serializeGranularCSV(sampleRows, {
      scope: 'all',
      format: 'agent_compact',
      delimiter: ',',
    });

    const lines = csv.split('\n');
    const header = lines[0];

    expect(header).toBe('date,value,description,category,entryType');
    expect(csv.includes('metadata_json')).toBe(false);
    expect(csv.includes('row-1')).toBe(false); // ID omitido no formato agente
  });

  it('6. Detecta ambiguidade em fragmentos sem coluna de tipo e permite forçar entryType', () => {
    const rawFragment = `data,valor,descricao,categoria
2026-07-01,150.00,"Supermercado","Alimentacao"
2026-07-02,45.90,"Uber Corrida","Transporte"`;

    // Sem opções: isAmbiguous deve ser true
    const parsedAmbiguous = parseCSVText(rawFragment);
    expect(parsedAmbiguous.isAmbiguous).toBe(true);

    // Com forceEntryType='expense': todas as linhas tornam-se expense
    const parsedForced = parseCSVText(rawFragment, { forceEntryType: 'expense' });
    expect(parsedForced.rows.length).toBe(2);
    expect(parsedForced.rows[0].entryType).toBe('expense');
    expect(parsedForced.rows[1].entryType).toBe('expense');
  });

  it('7. Suporta parsing explícito de tipo neutro / quarentena / unresolved', () => {
    const rawWithNeutral = `data,valor,descricao,tipo,categoria
2026-07-01,350.00,"Compra Nao Identificada",quarentena,"Outros"
2026-07-02,120.00,"Boleto Pendente",neutro,"Geral"`;

    const parsed = parseCSVText(rawWithNeutral);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].entryType).toBe('unresolved');
    expect(parsed.rows[1].entryType).toBe('unresolved');
  });

  it('8. Isolamento no metricsEngine: linhas em quarentena (unresolved) não inflam grossTotal nem expenses', () => {
    const testRows: TableRow[] = [
      { id: '1', date: '2026-07-01', value: 1000, entryType: 'revenue' },
      { id: '2', date: '2026-07-02', value: 400, entryType: 'expense' },
      { id: '3', date: '2026-07-03', value: 9999, entryType: 'unresolved' }, // Em quarentena!
    ];

    const metrics = computeMetrics(testRows);

    // grossTotal deve ser 1000 (apenas revenue)
    expect(metrics.grossTotal).toBe(1000);
    // totalExpenses deve ser 400 (apenas expense)
    expect(metrics.totalExpenses).toBe(400);
    // netBalance deve ser 1000 - 400 = 600
    expect(metrics.netBalance).toBe(600);
  });
});

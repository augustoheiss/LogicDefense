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
  toBeGreaterThan(expected: any): void;
  toBeLessThan(expected: any): void;
  not: any;
};

import { inferColumnType, isDateSample, isMoneySample, isTickerSample } from '../core/typeInferenceEngine';
import { parseDynamicCSV } from '../core/dynamicCsvParser';

describe('Test Suite: Type Inference & Dynamic CSV Parser', () => {
  it('deve inferir tipo date para formatos brasileiros e ISO com papel primary_date', () => {
    const samples = ['15/05/2026', '20/05/2026', '25/05/2026'];
    const res = inferColumnType(samples, 'data_pagamento');
    expect(res.dataType).toBe('date');
    expect(res.role).toBe('primary_date');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('deve inferir tipo money para moedas brasileiras e sugerir papel primary_amount', () => {
    const samples = ['R$ 1.500,00', '-45,90', '120,50'];
    const res = inferColumnType(samples, 'valor_liquido');
    expect(res.dataType).toBe('money');
    expect(res.role).toBe('primary_amount');
    expect(res.confidence).toBeGreaterThan(0.8);
  });

  it('deve inferir tickers financeiros da B3 e criptomoedas para invest_ticker', () => {
    const samples = ['PETR4', 'HGLG11', 'MXRF11', 'BTC', 'VALE3'];
    const res = inferColumnType(samples, 'codigo_ativo');
    expect(res.dataType).toBe('ticker');
    expect(res.role).toBe('invest_ticker');
  });

  it('deve sugerir inversão de sinal (invertSign) para extratos de cartão/fatura com valores positivos', () => {
    const samples = ['45,90', '120,00', '350,50'];
    const res = inferColumnType(samples, 'fatura_cartao_credito');
    expect(res.dataType).toBe('money');
    expect(res.suggestedInvertSign).toBe(true);
  });

  it('deve parsear CSV arbitrário com colunas customizadas sem perder nenhum dado', () => {
    const rawCSV = `Data;Historico;Valor;Ativo;Nota_Fiscal;Projeto
10/05/2026;Supermercado Central;-150,00;;NF-1002;Casa
11/05/2026;Aporte Mensal FII;2000,00;HGLG11;;Investimentos
12/05/2026;Consultoria de TI;5500,00;;NF-1003;Empresa`;

    const result = parseDynamicCSV(rawCSV, 'tbl_teste_dinamica');
    expect(result.schema.columns.length).toBe(6);
    expect(result.rows.length).toBe(3);

    // Validação da linha 1 (Supermercado)
    const row1 = result.rows[0];
    expect(row1.date).toBe('2026-05-10');
    expect(row1.value).toBe(-150);
    expect(row1.entryType).toBe('expense');
    expect(row1.customValues?.nota_fiscal).toBe('NF-1002');
    expect(row1.customValues?.projeto).toBe('Casa');

    // Validação da linha 2 (Aporte com Ticker HGLG11)
    const row2 = result.rows[1];
    expect(row2.date).toBe('2026-05-11');
    expect(row2.value).toBe(2000);
    expect(row2.ticker).toBe('HGLG11');
    expect(row2.customValues?.projeto).toBe('Investimentos');

    // Validação da linha 3 (Receita de Consultoria)
    const row3 = result.rows[2];
    expect(row3.date).toBe('2026-05-12');
    expect(row3.value).toBe(5500);
    expect(row3.entryType).toBe('revenue');
    expect(row3.customValues?.nota_fiscal).toBe('NF-1003');
  });

  it('deve parsear CSV estruturado Backup v3 com bloco ## SCHEMA_COLUMNS ## preservando configurações', () => {
    const v3CSV = `## COIN ASSISTANT BACKUP v3 ##
table_id,am_tbl_carteira
## SCHEMA_COLUMNS ##
id,label,originalHeader,dataType,role,visible,invertSign
date,Data,Data,date,primary_date,true,false
value,Valor,Valor,money,primary_amount,true,true
desc,Descrição,Descrição,text,primary_description,true,false
projeto,Projeto,Projeto,text,custom_attribute,true,false
## ROWS ##
date,value,desc,projeto
2026-06-01,80.00,"Almoço","Trabalho"`;

    const result = parseDynamicCSV(v3CSV, 'am_tbl_carteira');
    expect(result.hasExplicitSchema).toBe(true);
    expect(result.schema.columns.length).toBe(4);
    expect(result.rows.length).toBe(1);

    // Invert sign estava configurado como true no schema para value
    expect(result.rows[0].value).toBe(-80);
    expect(result.rows[0].entryType).toBe('expense');
    expect(result.rows[0].customValues?.projeto).toBe('Trabalho');
  });
});

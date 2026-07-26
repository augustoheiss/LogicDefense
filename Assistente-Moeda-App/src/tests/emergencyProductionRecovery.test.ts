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

describe('Relatório de Emergência: Testes de Recuperação da Planilha de Produção', () => {
  it('1. Deve carregar a planilha de produção legada SEM tag ## ROWS ## e com colunas separadas por ponto e vírgula (;)', () => {
    const rawLegacyProductionCSV = `name;Planilha Producao
meta_diaria;150
meta_semanal;1050
custo_anual;54750
data;tipo;valor;historico;categoria
2026-07-26;receita;500.00;Venda Producao;Geral
2026-07-26;despesa;120.00;Combustivel;Veiculos`;

    const parsed = parseCSVText(rawLegacyProductionCSV);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.rows[0].date).toBe('2026-07-26');
    expect(parsed.rows[0].value).toBe(500.00);
    expect(parsed.rows[1].value).toBe(120.00);
    expect(parsed.metadata?.name).toBe('Planilha Producao');
    expect(parsed.metadata?.tableGoals?.globalGoals?.dailyGoal).toBe(150);
  });

  it('2. Deve reconhecer metas globais legadas (goal_daily, goal_weekly, meta_diaria, meta_semanal)', () => {
    const csvGlobalGoals = `name,Planilha Global
goal_daily,200
goal_weekly,1400
goal_annual,73000
data,descricao,valor
2026-07-26,Servico Prestado,1000`;

    const parsed = parseCSVText(csvGlobalGoals);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.metadata?.tableGoals?.globalGoals?.dailyGoal).toBe(200);
    expect(parsed.metadata?.tableGoals?.globalGoals?.weeklyGoal).toBe(1400);
    expect(parsed.metadata?.tableGoals?.globalGoals?.annualCost).toBe(73000);
  });

  it('3. Deve reconhecer metas anuais dinâmicas (goal_daily_2026, goal_weekly_2026)', () => {
    const csvAnnualGoals = `name,Planilha Anual
goal_daily_2026,250
goal_weekly_2026,1750
data,descricao,valor
2026-07-26,Consultoria,2500`;

    const parsed = parseCSVText(csvAnnualGoals);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.metadata?.tableGoals?.dailyGoals[2026]).toBe(250);
    expect(parsed.metadata?.tableGoals?.weeklyGoals[2026]).toBe(1750);
    expect(parsed.metadata?.tableGoals?.yearlyGoals![2026].dailyGoal).toBe(250);
  });
});

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

describe('Relatório de Teste: Estresse de 5 Anos e Metas Dinâmicas no Header', () => {
  it('Deve importar o backup de estresse de 5 anos com 0 erros, capturar metas dinâmicas e carregar todas as linhas', () => {
    const stressCSV = `## COIN ASSISTANT BACKUP v2 ##
name,Simulação 5 Anos (Teste de Estresse)
description,Dados Históricos de 2021 a 2025
goal_daily_2021,70
goal_weekly_2021,490
goal_annual_2021,25000
goal_daily_2025,90
goal_weekly_2025,630
goal_annual_2025,37000
## ROWS ##
date,value,description,entryType,monthlyValue,monthCount,period_start,period_end
2021-01-01,85000,Financiamento Veículo (5 Anos),expense,1416.66,60,2021-01-01,2025-12-31
2021-01-13,10,Férias/Descanso 2021,waiver,,,,
2021-01-27,997.69,Aporte Investimento 1/2021,deposit,,,,`;

    const result = parseCSVText(stressCSV);

    // 1. Success assertions
    expect(result.errors.length).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.rows.length).toBe(3);

    // 2. Metadata assertions
    expect(result.metadata?.name).toBe('Simulação 5 Anos (Teste de Estresse)');
    expect(result.metadata?.description).toBe('Dados Históricos de 2021 a 2025');

    // 3. Dynamic header metadata goals assertions
    expect(result.metadata?.goals?.['goal_daily_2021']).toBe(70);
    expect(result.metadata?.goals?.['goal_weekly_2021']).toBe(490);
    expect(result.metadata?.goals?.['goal_annual_2021']).toBe(25000);

    expect(result.metadata?.goals?.['goal_daily_2025']).toBe(90);
    expect(result.metadata?.goals?.['goal_weekly_2025']).toBe(630);
    expect(result.metadata?.goals?.['goal_annual_2025']).toBe(37000);

    // 4. Structured tableGoals assertions
    expect(result.metadata?.tableGoals?.dailyGoals[2021]).toBe(70);
    expect(result.metadata?.tableGoals?.weeklyGoals[2021]).toBe(490);
    expect(result.metadata?.tableGoals?.annualCosts[2021]).toBe(25000);

    expect(result.metadata?.tableGoals?.dailyGoals[2025]).toBe(90);
    expect(result.metadata?.tableGoals?.weeklyGoals[2025]).toBe(630);
    expect(result.metadata?.tableGoals?.annualCosts[2025]).toBe(37000);

    // 5. Row data assertions
    expect(result.rows[0].date).toBe('2021-01-01');
    expect(result.rows[0].value).toBe(85000);
    expect(result.rows[0].description).toBe('Financiamento Veículo (5 Anos)');
    expect(result.rows[0].entryType).toBe('expense');
    expect(result.rows[0].monthlyValue).toBe(1416.66);
    expect(result.rows[0].monthCount).toBe(60);
    expect(result.rows[0].periodStart).toBe('2021-01-01');
    expect(result.rows[0].periodEnd).toBe('2025-12-31');

    expect(result.rows[1].entryType).toBe('waiver');
    expect(result.rows[2].entryType).toBe('deposit');
  });
});

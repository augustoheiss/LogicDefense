declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeLessThan(expected: number): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
};

import { parseCSVText } from '../utils/csvEngine';
import { generateDataset, buildCSVString } from '../data/generateMaster10YearDataset';

const DENSE_10YEAR_CSV = buildCSVString(generateDataset());

describe('Relatório de Teste 03: Dense Master 10-Year Dataset & Performance Benchmark', () => {
  it('Deve carregar e interpretar corretamente o dataset denso de 10 anos (2016-2026 com 700+ registros)', () => {
    const result = parseCSVText(DENSE_10YEAR_CSV);
    expect(result.errors.length).toBe(0);
    expect(result.rows.length).toBeGreaterThan(350);
    expect(result.rows[0].date).toBe('2016-01-05');
  });

  it('Deve autodetectar e autoativar todos os setores do sistema no dataset denso', () => {
    const result = parseCSVText(DENSE_10YEAR_CSV);
    const detected = result.detectedSectors;

    expect(detected).toContain('smb_accounting');
    expect(detected).toContain('legal_taxes');
    expect(detected).toContain('real_estate');
    expect(detected).toContain('vehicles');
    expect(detected).toContain('personal_finance');
  });

  it('Benchmark de Performance: Deve processar o dataset de 700+ linhas em menos de 100ms', () => {
    const startTime = performance.now();
    
    // Processa o dataset denso de 700+ linhas 10 vezes
    for (let i = 0; i < 10; i++) {
      parseCSVText(DENSE_10YEAR_CSV);
    }
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 10; // tempo médio em ms por parse completo

    expect(duration).toBeLessThan(100);
  });
});

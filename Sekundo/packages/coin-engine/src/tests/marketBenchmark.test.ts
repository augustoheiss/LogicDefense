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

import {
  annualToMonthlyRate,
  resolveBenchmarkRates,
  DEFAULT_SAFE_RATES,
} from '../core/marketBenchmark';

describe('Test Suite: Market Benchmark Engine (CDI & IPCA)', () => {
  it('deve converter taxa anual em taxa mensal equivalente corretamente', () => {
    // 10.65% a.a. -> ~0.85% a.m.
    const monthly = annualToMonthlyRate(10.65);
    expect(monthly).toBeGreaterThan(0.8);
    expect(monthly).toBeLessThan(0.9);

    // 0% a.a. -> 0% a.m.
    expect(annualToMonthlyRate(0)).toBe(0);
  });

  it('deve retornar taxas padrão seguras na ausência de overrides', () => {
    const rates = resolveBenchmarkRates(null);
    expect(rates.cdiAnnualRate).toBe(DEFAULT_SAFE_RATES.cdiAnnualRate);
    expect(rates.source).toBe('default_safe');
  });

  it('deve aplicar override manual do usuário com recálculo mensal instantâneo', () => {
    const rates = resolveBenchmarkRates(null, { cdiAnnual: 12.0, ipcaAnnual: 5.0 });
    expect(rates.cdiAnnualRate).toBe(12.0);
    expect(rates.ipcaAnnualRate).toBe(5.0);
    expect(rates.cdiMonthlyRate).toBeGreaterThan(0.9);
    expect(rates.source).toBe('manual_override');
  });
});

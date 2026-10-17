declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;
declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeGreaterThan(expected: number): void;
  toContain(expected: any): void;
  toBeTruthy(): void;
};

import { parseMoneyBR, parseBatchAmounts } from '../core/parseMoneyBR';

describe('Test Suite: Universal Brazilian Money Parser (parseMoneyBR & parseBatchAmounts)', () => {
  it('Deve converter corretamente valores decimais brasileiros com vírgula', () => {
    expect(parseMoneyBR('12,50')).toBe(12.50);
    expect(parseMoneyBR('0,99')).toBe(0.99);
    expect(parseMoneyBR('100,00')).toBe(100);
  });

  it('Deve converter valores com prefixo monetário e pontos de milhar', () => {
    expect(parseMoneyBR('R$ 1.234,56')).toBe(1234.56);
    expect(parseMoneyBR('  R$  50,25 ')).toBe(50.25);
    expect(parseMoneyBR('10.000,00')).toBe(10000);
  });

  it('Deve suportar notação decimal americana com ponto se não houver vírgula', () => {
    expect(parseMoneyBR('12.50')).toBe(12.50);
    expect(parseMoneyBR('1500.75')).toBe(1500.75);
  });

  it('Deve retornar 0 para valores vazios ou inválidos', () => {
    expect(parseMoneyBR('')).toBe(0);
    expect(parseMoneyBR('   ')).toBe(0);
    expect(parseMoneyBR('abc')).toBe(0);
    expect(parseMoneyBR(null as any)).toBe(0);
    expect(parseMoneyBR(undefined as any)).toBe(0);
  });

  it('Deve manter números já numéricos', () => {
    expect(parseMoneyBR(45.5)).toBe(45.5);
    expect(parseMoneyBR(-10.2)).toBe(-10.2);
  });

  it('Deve fazer o parsing correto de lotes separados por ponto-e-vírgula', () => {
    const batch = parseBatchAmounts('12,50; 25,00; 100,00');
    expect(batch.length).toBe(3);
    expect(batch[0]).toBe(12.50);
    expect(batch[1]).toBe(25.00);
    expect(batch[2]).toBe(100.00);
  });

  it('Deve fazer o parsing de lotes separados por quebra de linha', () => {
    const batch = parseBatchAmounts("15,90\n30,50\n45,00");
    expect(batch.length).toBe(3);
    expect(batch[0]).toBe(15.90);
    expect(batch[1]).toBe(30.50);
    expect(batch[2]).toBe(45.00);
  });

  it('Deve desambiguar vírgulas decimais de vírgulas separadoras de lote', () => {
    // "12,50, 35,00" não deve gerar [12, 50, 35, 0] mas sim [12.50, 35.00]
    const batch = parseBatchAmounts('12,50, 35,00');
    expect(batch.length).toBe(2);
    expect(batch[0]).toBe(12.50);
    expect(batch[1]).toBe(35.00);
  });
});

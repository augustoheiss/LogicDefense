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

import { sanitizeRowsForAI } from '../services/aiChatService';
import type { TableRow } from '../core/types';

describe('Test Suite: AI Context Privacy Guard (sanitizeRowsForAI)', () => {
  const sensitiveRows: TableRow[] = [
    {
      id: '1',
      date: '2026-07-01',
      value: 450,
      description: 'Consulta Dr. Marcelo Psiquiatra PIX CPF 123.456.789-00',
      category: 'Saúde',
      entryType: 'expense',
    },
    {
      id: '2',
      date: '2026-07-02',
      value: 80,
      description: 'Farmácia Remédio Tarja Preta',
      entryType: 'expense',
    },
  ];

  it('deve anonimizar descrições pessoais por padrão quando allowRaw for false', () => {
    const sanitized = sanitizeRowsForAI(sensitiveRows, false);

    expect(sanitized[0].description).toBe('[Saúde]');
    expect(sanitized[0].description).not.toContain('Dr. Marcelo');
    expect(sanitized[0].description).not.toContain('123.456.789-00');

    expect(sanitized[1].description).toBe('Despesa');
    expect(sanitized[1].description).not.toContain('Tarja Preta');

    // Valores e datas continuam precisos para a IA calcular
    expect(sanitized[0].value).toBe(450);
    expect(sanitized[1].value).toBe(80);
  });

  it('deve preservar as descrições originais apenas quando o usuário der opt-in explícito (allowRaw: true)', () => {
    const raw = sanitizeRowsForAI(sensitiveRows, true);
    expect(raw[0].description).toBe('Consulta Dr. Marcelo Psiquiatra PIX CPF 123.456.789-00');
    expect(raw[1].description).toBe('Farmácia Remédio Tarja Preta');
  });
});

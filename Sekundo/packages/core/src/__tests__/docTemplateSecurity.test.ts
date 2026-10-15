import { describe, it, expect } from 'vitest';
import {
  renderTemplateString,
  parseSdocYaml,
  solveLayout,
  SdocLimitError,
  yamlToRegistry,
} from '../index';

describe('Phase F2 (Red Teaming V3) — Template & YAML Security Guarantees', () => {
  it('renders prototype pollution and constructor code-execution attempts as inert literal strings', () => {
    const ctx = {
      value: 'Maria Clara',
      meta: { date: '2026-10-15' },
    };

    const malicious1 = "{{constructor.constructor('return process')()}}";
    expect(renderTemplateString(malicious1, ctx)).toBe(malicious1);

    const malicious2 = '{{__proto__.polluted}}';
    expect(renderTemplateString(malicious2, ctx)).toBe(malicious2);

    const malicious3 = '{{value.toString()}}';
    expect(renderTemplateString(malicious3, ctx)).toBe(malicious3);

    const valid = "Olá, {{value | upper}} em {{meta.date | date:'dd/MM/yyyy'}}!";
    expect(renderTemplateString(valid, ctx)).toBe('Olá, MARIA CLARA em 15/10/2026!');
  });

  it('aborts with SdocLimitError(LIMIT_PAGES) when repeat would generate more than 500 pages', () => {
    const { doc } = parseSdocYaml(`
sdoc: 1
name: DoS Page Bomb Test
page: { format: a4 }
repeat:
  over: "all"
  per_page: 1
layers:
  - id: l1
    items:
      - { id: t1, type: text, x: 10, y: 10, w: 100, text: "{{value}}" }
`);
    expect(doc).not.toBeNull();

    const hugeContexts = Array.from({ length: 1000 }, (_, i) => ({ value: `Item ${i}` }));
    expect(() => solveLayout(doc!, [], { customContexts: hugeContexts })).toThrowError(SdocLimitError);
    try {
      solveLayout(doc!, [], { customContexts: hugeContexts });
    } catch (err: any) {
      expect(err.code).toBe('LIMIT_PAGES');
    }
  });

  it('rejects YAML billion-laughs alias bombs (maxAliasCount: 100)', () => {
    const anchors: string[] = ['a0: &a0 ["x", "x"]'];
    for (let i = 1; i <= 10; i++) {
      anchors.push(`a${i}: &a${i} [*a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}, *a${i - 1}]`);
    }
    const bombYaml = anchors.join('\n') + '\nnodes: *a10\n';

    expect(() => yamlToRegistry(bombYaml)).toThrow();
  });
});

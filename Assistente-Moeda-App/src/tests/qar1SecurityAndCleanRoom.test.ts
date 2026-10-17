/**
 * QAR1 Security & Clean-Room Data Hygiene Test Suite
 *
 * Verifies defensive remediations for:
 *   - SEC-03: Silent API key exfiltration in CSV exports
 *   - SEC-04: "Sanitizer Paradox" in AI Analyst (tables & transactions leak when allowRawData=false)
 *   - SEC-05: Stored DOM XSS in PDF/HTML generators (buildReportHTML & buildTabularAuditHTML)
 *   - SEC-06: CSV Formula Injection (CWE-1236) neutralization
 *   - SEC-07: CSPRNG entropy for local fallback API keys
 */

import {
  escapeHtml,
  neutralizeCsvFormula,
  redactApiKeyForExport,
  generateSecureLocalApiKey,
  sanitizeTablesForAI,
  sanitizeTransactionsForAI,
} from '../utils/securitySanitizer';
import {
  buildCSV,
  buildGranularCSV,
  buildReportHTML,
  buildTabularAuditHTML,
  generateLocalApiKey,
} from '../services/exportService';
import { sendChatMessage } from '../services/aiChatService';
import { computeMetrics as calculateMetrics } from '../core/metricsEngine';
import type { TableRow, TableGoals } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('QAR1 Security & Clean-Room Hygiene Suite (SEC-01 to SEC-07)', () => {
  const sampleGoals: TableGoals = {
    dailyGoals: { 2026: 150 },
    weeklyGoals: { 2026: 1050 },
    annualCosts: { 2026: 18000 },
  };

  it('SEC-03: buildCSV e buildGranularCSV NÃO devem vazar chaves am_sheet_live_* do localStorage por padrão', () => {
    const secretLiveKey = 'am_sheet_live_9999888877776666555544443333222211110000aaaabbbb';
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('coin_api_key_tbl_sec', secretLiveKey);
      window.localStorage.setItem('coin_active_api_key', secretLiveKey);
    }

    const rows: TableRow[] = [
      { id: 'r1', date: '2026-07-10', value: 500, description: 'Consultoria', entryType: 'revenue' },
    ];

    // Exportação padrão para compartilhamento: chave deve ser redigida
    const defaultCsv = buildCSV(rows, 'Planilha Auditada', 'Desc', sampleGoals, 'tbl_sec');
    expect(defaultCsv).not.toContain(secretLiveKey);
    expect(defaultCsv).toContain('api_key,am_sheet_live_local');

    // Exportação Granular Backup v3 padrão: chave também deve ser redigida
    const granularCsv = buildGranularCSV(
      rows,
      { scope: 'all', format: 'backup_v3' },
      'Planilha Auditada',
      'Desc',
      sampleGoals,
      'tbl_sec'
    );
    expect(granularCsv).not.toContain(secretLiveKey);

    // Apenas quando o usuário passar explicitamente a chave ou includeSecretApiKey=true
    const sovereignCsv = buildCSV(
      rows,
      'Planilha Auditada',
      'Desc',
      sampleGoals,
      'tbl_sec',
      secretLiveKey,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    expect(sovereignCsv).toContain(`api_key,${secretLiveKey}`);
  });

  it('SEC-04: sendChatMessage deve fechar o Paradoxo do Sanitizador em tables e transactions quando allowRawData=false', async () => {
    let capturedBody: any = null;
    const origFetch = globalThis.fetch;

    globalThis.fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: 'Análise concluída', modelUsed: 'gpt-4o-mini' }),
        text: async () => JSON.stringify({ content: 'Análise concluída', modelUsed: 'gpt-4o-mini' }),
      } as any;
    }) as any;

    try {
      const sensitiveRows: TableRow[] = [
        {
          id: 'tx_1',
          date: '2026-07-15',
          value: 2400,
          description: 'PIX Confidencial Hospital Sírio CPF 123.456.789-00',
          category: 'Saúde',
          entryType: 'expense',
        },
      ];
      const sensitiveTables = [
        {
          id: 'tbl_1',
          name: 'Pessoal',
          rows: sensitiveRows,
        },
      ];

      await sendChatMessage(
        'Resumo do mês',
        sensitiveRows,
        sampleGoals,
        'Pessoal',
        0,
        '2026-07-31',
        sensitiveTables,
        sensitiveRows,
        {},
        false // allowRawData = false (Modo Privado Ativo)
      );

      expect(capturedBody).toBeDefined();
      const serializedPayload = JSON.stringify(capturedBody);
      expect(serializedPayload).not.toContain('PIX Confidencial Hospital Sírio');
      expect(serializedPayload).not.toContain('123.456.789-00');
      expect(capturedBody.rows[0].description).toBe('[Saúde]');
      expect(capturedBody.tables[0].rows[0].description).toBe('[Saúde]');
      expect(capturedBody.transactions[0].description).toBe('[Saúde]');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SEC-05: buildReportHTML e buildTabularAuditHTML devem escapar tags HTML/DOM especiais', () => {
    const rowsWithMarkup: TableRow[] = [
      {
        id: 'xss_1',
        date: '2026-07-10',
        value: 300,
        description: '<img src=x onerror="window.__xss=1"> & " Aspas \' Simples',
        category: '<script>alert(1)</script>',
        ticker: '<b>PETR4</b>',
        entryType: 'revenue',
        customValues: {
          '<svg onload=1>': '<iframe src="javascript:void(0)">',
        },
      },
    ];
    const metrics = calculateMetrics(rowsWithMarkup, sampleGoals);
    const html = buildReportHTML(
      'Planilha <script>evil()</script>',
      rowsWithMarkup,
      metrics,
      sampleGoals,
      '2026-07'
    );

    expect(html).not.toContain('<script>evil()</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;window.__xss=1&quot;&gt;');

    const auditHtml = buildTabularAuditHTML('Tabela <h1>Injetada</h1>', [
      {
        mondayKey: '2026-07-06',
        sundayKey: '2026-07-12',
        weekNumber: 28,
        weekLabel: '<img src=1 onerror=1>',
        weeklyGoal: 1000,
        weeklyRevenue: 1200,
        weeklyWaivers: 0,
        weeklyPartnerNet: 0,
        weekDelta: 200,
        cumulativeBalance: 200,
      },
    ]);
    expect(auditHtml).not.toContain('<h1>Injetada</h1>');
    expect(auditHtml).not.toContain('<img src=1');
    expect(auditHtml).toContain('&lt;h1&gt;Injetada&lt;/h1&gt;');
  });

  it('SEC-06: neutralizeCsvFormula deve bloquear injeção de fórmulas (=, +, -, @) preservando números negativos', () => {
    expect(neutralizeCsvFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(neutralizeCsvFormula('+cmd|\'/C calc\'!A0')).toBe("'+cmd|'/C calc'!A0");
    expect(neutralizeCsvFormula('-2+3+cmd')).toBe("'-2+3+cmd");
    expect(neutralizeCsvFormula('@SUM(1+1)')).toBe("'@SUM(1+1)");
    // Números puros assinados não devem ser corrompidos
    expect(neutralizeCsvFormula('-150.50')).toBe('-150.50');
    expect(neutralizeCsvFormula('-1250,00')).toBe('-1250,00');
    expect(neutralizeCsvFormula('Compra normal no mercado')).toBe('Compra normal no mercado');
  });

  it('SEC-07: generateLocalApiKey deve usar CSPRNG e gerar chaves únicas de 62 caracteres', () => {
    const k1 = generateLocalApiKey('tbl_alpha');
    const k2 = generateLocalApiKey('tbl_alpha');
    expect(k1.startsWith('am_sheet_live_')).toBe(true);
    expect(k2.startsWith('am_sheet_live_')).toBe(true);
    expect(k1.length).toBe('am_sheet_live_'.length + 48);
    expect(k1).not.toBe(k2);
  });
});

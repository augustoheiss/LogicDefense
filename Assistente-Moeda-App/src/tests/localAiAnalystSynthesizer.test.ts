/**
 * Unit Tests — Local AI-Analyst Synthesizer (Manual Offline Delivery)
 *
 * Validates:
 *   1. DRE parity, partnership passthrough isolation, and survival break-even metrics
 *   2. Accrual-basis category summaries (multi-month periodStart->periodEnd proration)
 *   3. 4-Tier Cascade Ledger compression (Tier 1 <=200 vs Tier 2 201..1000)
 *   4. Privacy / LGPD anonymization (descriptions stripped, numerical DRE preserved)
 *   5. All 4 output formats (.md full dossier, .xml semantic, .md pure context, .json API bundle)
 */

import {
  generateManualAiAnalystSynthesis,
  buildLocalAnalysisContext,
  buildAccrualCategorySummaries,
  SKILLS_MANIFEST,
} from '../core/localAiAnalystSynthesizer';
import type { TableRow, TableGoals } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

const SAMPLE_GOALS: TableGoals = {
  dailyGoals: { 2026: 200 },
  weeklyGoals: { 2026: 1400 },
  annualCosts: { 2026: 24000 },
  globalGoals: {
    dailyGoal: 200,
    weeklyGoal: 1400,
    annualCost: 24000,
  },
};

const SAMPLE_ROWS: TableRow[] = [
  {
    id: 'r1',
    date: '2026-03-02',
    value: 1500,
    entryType: 'revenue',
    category: 'FREELANCE',
    description: 'Projeto Cliente Alpha',
  },
  {
    id: 'r2',
    date: '2026-03-09',
    value: 1800,
    entryType: 'revenue',
    category: 'FREELANCE',
    description: 'Consultoria Cliente Beta',
  },
  {
    id: 'e1',
    date: '2026-03-01',
    value: 600,
    entryType: 'expense',
    category: 'INFRAESTRUTURA',
    description: 'Servidor Cloud Trimestral',
    periodStart: '2026-03-01',
    periodEnd: '2026-05-31',
  },
  {
    id: 'e2',
    date: '2026-03-05',
    value: 80,
    entryType: 'expense',
    category: 'DIVERSOS',
    description: 'Café Reunião Centro',
  },
  {
    id: 'e3',
    date: '2026-03-10',
    value: 70,
    entryType: 'expense',
    category: 'DIVERSOS',
    description: 'Estacionamento Cliente',
  },
  {
    id: 'd1',
    date: '2026-03-01',
    value: 1000,
    entryType: 'deposit',
    category: 'RESERVA',
    description: 'Aporte Tesouro Selic',
  },
  {
    id: 'p1',
    date: '2026-03-04',
    value: 500,
    entryType: 'partner_in',
    description: 'Adiantamento Sócio João',
  },
  {
    id: 'p2',
    date: '2026-03-06',
    value: 500,
    entryType: 'partner_out',
    description: 'Repasse Sócio João',
  },
];

describe('Local AI-Analyst Synthesizer — Core Parity & Formats', () => {
  it('exposes all 8 core financial skills in SKILLS_MANIFEST', () => {
    expect(SKILLS_MANIFEST.length).toBe(8);
  });

  it('computes accurate DRE, partnership isolation, and accrual categories', () => {
    const ctx = buildLocalAnalysisContext(SAMPLE_ROWS, SAMPLE_GOALS, 'Planilha Teste', {
      asOfDate: '2026-03-15',
    });

    // Operational revenue = 1500 + 1800 = 3300 (partner_in 500 is isolated!)
    expect(ctx.metrics.grossTotal).toBe(3300);
    // Operational expenses = 600 + 80 + 70 = 750 (partner_out 500 is isolated!)
    expect(ctx.metrics.totalExpenses).toBe(750);
    expect(ctx.metrics.netBalance).toBe(2550);
    expect(ctx.metrics.totalPartnerIn).toBe(500);
    expect(ctx.metrics.totalPartnerOut).toBe(500);
    expect(ctx.ledgerTier).toBe(1);

    // Check accrual category summaries
    const expCats = buildAccrualCategorySummaries(SAMPLE_ROWS, 'expense', 3, false);
    expect(expCats.length).toBe(2);
    // INFRAESTRUTURA has larger volume (600) vs DIVERSOS (150), while DIVERSOS has higher launch count (2x)
    expect(expCats[0].category).toBe('INFRAESTRUTURA');
    expect(expCats[0].rawLaunchCount).toBe(1);
    expect(expCats[0].activeMonthsCount).toBe(3); // Prorated across March, April, May
    expect(expCats[1].category).toBe('DIVERSOS');
    expect(expCats[1].rawLaunchCount).toBe(2);
  });

  it('generates Format 1: ai_analyst_full_md (.md) with 8 Skills, DRE, and Round-Trip protocol', () => {
    const res = generateManualAiAnalystSynthesis(SAMPLE_ROWS, SAMPLE_GOALS, 'Minha Empresa', {
      format: 'ai_analyst_full_md',
      profile: 'cfo',
      userCustomPrompt: 'Onde devo reduzir custos neste trimestre?',
      asOfDate: '2026-03-15',
    });

    expect(res.metadata.extension).toBe('md');
    expect(res.metadata.profile).toBe('cfo');
    expect(res.content.includes('PROTOCOLO DE INGESTÃO MANUAL ATIVO')).toBe(true);
    expect(res.content.includes('PROTOCOLO DE RETORNO MANUAL (ROUND-TRIP SEM API)')).toBe(true);
    expect(res.content.includes('Onde devo reduzir custos neste trimestre?')).toBe(true);
    expect(res.content.includes('Projeto Cliente Alpha')).toBe(true);
  });

  it('generates Format 2: ai_analyst_xml (.xml) with semantic XML tags for Claude/Reasoning models', () => {
    const res = generateManualAiAnalystSynthesis(SAMPLE_ROWS, SAMPLE_GOALS, 'Minha Empresa', {
      format: 'ai_analyst_xml',
      profile: 'native',
      asOfDate: '2026-03-15',
    });

    expect(res.metadata.extension).toBe('xml');
    expect(res.content.includes('<assistente_moeda_ai_analyst_synthesis')).toBe(true);
    expect(res.content.includes('<dre_synthesis currency="BRL">')).toBe(true);
    expect(res.content.includes('<statistical_distribution currency="BRL">')).toBe(true);
    expect(res.content.includes('<accrual_categories>')).toBe(true);
  });

  it('generates Format 3: analysis_context_md (.md) without system prompt header', () => {
    const res = generateManualAiAnalystSynthesis(SAMPLE_ROWS, SAMPLE_GOALS, 'Minha Empresa', {
      format: 'analysis_context_md',
      asOfDate: '2026-03-15',
    });

    expect(res.metadata.extension).toBe('md');
    expect(res.content.includes('# 📊 SÍNTESE EXECUTIVA AI-ANALYST')).toBe(true);
    expect(res.content.includes('PROTOCOLO DE INGESTÃO MANUAL ATIVO')).toBe(false);
  });

  it('generates Format 4: api_routes_bundle_json (.json) mirroring all public API routes', () => {
    const res = generateManualAiAnalystSynthesis(SAMPLE_ROWS, SAMPLE_GOALS, 'Minha Empresa', {
      format: 'api_routes_bundle_json',
      asOfDate: '2026-03-15',
    });

    expect(res.metadata.extension).toBe('json');
    const parsed = JSON.parse(res.content);
    expect(parsed.routes['/api/v1/public/agent-prompt'].status).toBe('ok');
    expect(parsed.routes['/api/v1/public/ai-analyst'].mandatoryRoute).toBe(true);
    expect(parsed.routes['/api/v1/public/summary'].dre.grossTotal).toBe(3300);
    expect(parsed.routes['/api/v1/public/transactions'].count).toBe(SAMPLE_ROWS.length);
  });

  it('enforces LGPD / Modo Rua anonymization without altering DRE totals', () => {
    const res = generateManualAiAnalystSynthesis(SAMPLE_ROWS, SAMPLE_GOALS, 'Minha Empresa', {
      format: 'ai_analyst_full_md',
      anonymizeDescriptions: true,
      asOfDate: '2026-03-15',
    });

    expect(res.metadata.anonymized).toBe(true);
    // Personal descriptions must NOT appear when anonymized
    expect(res.content.includes('Projeto Cliente Alpha')).toBe(false);
    expect(res.content.includes('Adiantamento Sócio João')).toBe(false);
    // Category brackets should replace personal descriptions
    expect(res.content.includes('[FREELANCE]')).toBe(true);
  });

  it('switches to Tier 2 Cascade Compression when spreadsheet exceeds 200 rows', () => {
    const manyRows: TableRow[] = [];
    for (let i = 0; i < 250; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      manyRows.push({
        id: `row_${i}`,
        date: `2026-01-${day}`,
        value: 100 + i,
        entryType: i % 3 === 0 ? 'expense' : 'revenue',
        category: i % 3 === 0 ? 'OPERACIONAL' : 'VENDAS',
        description: `Lançamento #${i}`,
      });
    }

    const res = generateManualAiAnalystSynthesis(manyRows, SAMPLE_GOALS, 'Planilha Grande', {
      format: 'analysis_context_md',
      asOfDate: '2026-02-01',
    });

    expect(res.metadata.ledgerTier).toBe(2);
    expect(res.content.includes('Matriz Histórica Mensal')).toBe(true);
    expect(res.content.includes('Lançamentos Mais Recentes (150 itens detalhados)')).toBe(true);
  });
});

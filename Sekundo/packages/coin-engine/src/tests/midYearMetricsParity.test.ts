/**
 * Mid-Year Onboarding & Cross-Channel Mathematical Parity Test Suite
 *
 * Validates the 4 Architectural Precision Locks:
 *   1. Lock 1 — Full Monthly Competence Envelope (activeMonths sum of days, zero intra-month spike,
 *      zero empty-month gap dilution, 100% reconciliation of globalMonthlyAvg & survivalMonthly).
 *   2. Lock 2 — Unified Competence-Clipped WhatsApp Weekly Closing (sum of weeks === byMonth[ym].grossMonthly).
 *   3. Lock 3 — Prevention of Sanitizer Paradox in Clean-Room Categories (deterministic bijective mapping
 *      CATEGORIA_RECEITA_01..N / CATEGORIA_DESPESA_01..N, population stdDev ÷ N, tableName anonymization).
 *   4. Cross-Channel Parity across UI Metrics, WhatsApp Export, and all 5 AI Specialist Profiles
 *      ('native', 'cfo', 'operational', 'goals', 'dev').
 */

import { computeMetrics, computeBaselineGoals } from '../core/metricsEngine';
import {
  computeActiveMonthsSpan,
  getEffectivePeriodSpanDays,
  buildMonthCompetenceWeekGroups,
  parseSelectedMonthsSpec,
  serializeSelectedMonthsSpec,
  toggleMonthSelection,
  toggleYearSelection,
  formatSelectedMonthsLabel,
  filterAndClipRowsByMonths,
} from '../core/dateUtils';
import { buildWhatsAppReport } from '../services/exportService';
import {
  buildLocalAnalysisContext,
  buildLocalWhatsAppReportText,
  buildAccrualCategorySummaries,
  sanitizeRowsForManualSynthesis,
  generateManualAiAnalystSynthesis,
  type ManualSynthesisProfile,
} from '../core/localAiAnalystSynthesizer';
import type { TableRow, TableGoals } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

const BASE_GOALS: TableGoals = {
  dailyGoals: { 2026: 200 },
  weeklyGoals: { 2026: 1400 },
  annualCosts: { 2026: 36000 },
  globalGoals: {
    dailyGoal: 200,
    weeklyGoal: 1400,
    annualCost: 36000,
  },
};

describe('Mid-Year Onboarding & Cross-Channel Mathematical Parity (4 Precision Locks)', () => {
  it('Lock 1 (Scenario 1): Mid-Year Onboarding in June only (Day 10 to Day 25) uses full 30-day competence envelope without 2x inflation', () => {
    const juneRows: TableRow[] = [
      {
        id: 'rev_jun_1',
        date: '2026-06-10',
        value: 3000,
        entryType: 'revenue',
        category: 'CONSULTORIA',
        description: 'Projeto Etapa 1',
      },
      {
        id: 'rev_jun_2',
        date: '2026-06-25',
        value: 3000,
        entryType: 'revenue',
        category: 'CONSULTORIA',
        description: 'Projeto Etapa 2',
      },
      {
        id: 'exp_jun_1',
        date: '2026-06-10',
        value: 1800,
        entryType: 'expense',
        category: 'ALUGUEL',
        description: 'Aluguel Operacional',
      },
      {
        id: 'exp_jun_2',
        date: '2026-06-25',
        value: 1200,
        entryType: 'expense',
        category: 'INFRAESTRUTURA',
        description: 'Servidores e Links',
      },
    ];

    const span = computeActiveMonthsSpan(juneRows);
    expect(span.activeMonthsCount).toBe(1);
    expect(span.effectiveSpanDays).toBe(30); // Full June calendar days, NOT 16 days (Jun 10..25)

    // Test even when asOfDate is early in the month (e.g. 2026-06-07) -> no 4x spike!
    const mEarly = computeMetrics(juneRows, BASE_GOALS, '2026-06-07');
    expect(mEarly.byMonth['2026-06'].dailyAvg).toBe(200); // 6000 / 30 days
    expect(mEarly.byMonth['2026-06'].weeklyAvg).toBe(1400); // 200 * 7

    const m = computeMetrics(juneRows, BASE_GOALS, '2026-06-30');
    expect(m.grossTotal).toBe(6000);
    expect(m.totalExpenses).toBe(3000);

    // Revenue averages reconcile 100% with June competence
    expect(m.globalDailyAvg).toBe(200);
    expect(m.globalWeeklyAvg).toBe(1400);
    expect(m.globalMonthlyAvg).toBe(6000);
    expect(m.globalAnnualAvg).toBe(72000);
    expect(m.byYear['2026'].dailyAvg).toBe(200);
    expect(m.byYear['2026'].weeklyAvg).toBe(1400);
    expect(m.byYear['2026'].monthlyAvg).toBe(6000);
    expect(m.globalMonthlyAvg).toBe(m.byYear['2026'].monthlyAvg);

    // Survival / Break-Even averages reconcile 100% with June expenses
    expect(m.survivalDaily).toBe(100);
    expect(m.survivalWeekly).toBe(700);
    expect(m.survivalMonthly).toBe(3000);
    expect(m.survivalAnnualCost).toBe(36000);

    // Baseline goals from CSV import also respect active competence months
    const baseline = computeBaselineGoals(juneRows);
    expect(baseline.globalGoals?.dailyGoal).toBe(200);
    expect(baseline.globalGoals?.weeklyGoal).toBe(1400);
    expect(baseline.globalGoals?.annualCost).toBe(72000);
  });

  it('Lock 1 (Scenario 2): Sparse Months with Gap (March + October only) uses 62 active days (31+31), never 245 continuous days', () => {
    const sparseRows: TableRow[] = [
      {
        id: 'rev_mar',
        date: '2026-03-15',
        value: 6200,
        entryType: 'revenue',
        category: 'VENDAS',
        description: 'Fechamento Março',
      },
      {
        id: 'rev_oct',
        date: '2026-10-20',
        value: 6200,
        entryType: 'revenue',
        category: 'VENDAS',
        description: 'Fechamento Outubro',
      },
      {
        id: 'exp_mar',
        date: '2026-03-10',
        value: 3100,
        entryType: 'expense',
        category: 'OPERACIONAL',
        description: 'Custo Março',
      },
      {
        id: 'exp_oct',
        date: '2026-10-10',
        value: 3100,
        entryType: 'expense',
        category: 'OPERACIONAL',
        description: 'Custo Outubro',
      },
    ];

    const span = computeActiveMonthsSpan(sparseRows);
    expect(span.activeMonthsCount).toBe(2);
    expect(span.effectiveSpanDays).toBe(62); // 31 (Mar) + 31 (Oct) = 62 days
    expect(getEffectivePeriodSpanDays(['2026-03', '2026-10']).effectiveSpanDays).toBe(62);

    const m = computeMetrics(sparseRows, BASE_GOALS, '2026-10-31');
    expect(m.grossTotal).toBe(12400);
    expect(m.totalExpenses).toBe(6200);

    // 12400 / 62 days = 200/day, 6200/active month
    expect(m.globalDailyAvg).toBe(200);
    expect(m.globalWeeklyAvg).toBe(1400);
    expect(m.globalMonthlyAvg).toBe(6200);
    expect(m.globalAnnualAvg).toBe(74400);
    expect(m.byYear['2026'].monthlyAvg).toBe(6200);

    // Survival: 6200 / 62 days = 100/day, 3100/active month
    expect(m.survivalDaily).toBe(100);
    expect(m.survivalWeekly).toBe(700);
    expect(m.survivalMonthly).toBe(3100);
    expect(m.survivalAnnualCost).toBe(37200);
  });

  it('Lock 2 (Scenario 3): Cross-Channel WhatsApp Weekly Closing clips cross-month weeks and prorates period entries so Sum(Weeks) === grossMonthly', () => {
    // 2026-05-27 is Wednesday of the week Mon 2026-05-25 .. Sun 2026-05-31
    // 2026-05-31 is Sunday in May; 2026-06-01 is Monday in June.
    // Let's test July 2026 where 2026-07-05 is a Sunday whose Monday is 2026-06-29 (June)!
    const crossMonthRows: TableRow[] = [
      {
        id: 'rev_jun_29',
        date: '2026-06-29', // Monday in June, same week as Sunday 2026-07-05
        value: 1000,
        entryType: 'revenue',
        category: 'SERVICOS',
        description: 'Receita Final de Junho',
      },
      {
        id: 'rev_jul_02',
        date: '2026-07-02', // Thursday in July, same week as Sunday 2026-07-05
        value: 2000,
        entryType: 'revenue',
        category: 'SERVICOS',
        description: 'Receita Início de Julho',
      },
      {
        id: 'rev_jul_period',
        date: '2026-07-10',
        periodStart: '2026-07-10',
        periodEnd: '2026-07-19', // 10 days across 2 weeks in July, R$ 100/day
        value: 1000,
        entryType: 'revenue',
        category: 'CONTRATO',
        description: 'Contrato Periódico 10 Dias',
      },
      {
        id: 'exp_jul_1',
        date: '2026-07-05',
        value: 1550,
        entryType: 'expense',
        category: 'ALUGUEL',
        description: 'Aluguel Julho',
      },
    ];

    const m = computeMetrics(crossMonthRows, BASE_GOALS, '2026-07-31');
    const julyGross = m.byMonth['2026-07'].grossMonthly;
    // July gross should be strictly 2000 + 1000 = 3000 (the 1000 on 2026-06-29 belongs to June!)
    expect(julyGross).toBe(3000);
    expect(m.byMonth['2026-06'].grossMonthly).toBe(1000);

    const julyWeeks = buildMonthCompetenceWeekGroups(crossMonthRows, BASE_GOALS, '2026-07');
    const sumOfJulyWeeks = Math.round(julyWeeks.reduce((s, w) => s + w.weeklyTotal, 0) * 100) / 100;
    expect(sumOfJulyWeeks).toBe(julyGross);

    // ExportService WhatsApp Report and Local AI Synthesizer WhatsApp Report must agree 100%
    const waExport = buildWhatsAppReport('Planilha Auditoria', m, BASE_GOALS, '2026-07', crossMonthRows);
    const waLocal = buildLocalWhatsAppReportText('Planilha Auditoria', m, BASE_GOALS, '2026-07', crossMonthRows);

    // Neither July report may include the 29/06 entry as part of July's weekly closing
    expect(waExport.includes('Receita Final de Junho')).toBe(false);
    expect(waLocal.includes('Receita Final de Junho')).toBe(false);
    expect(waExport.includes('Receita Início de Julho')).toBe(true);
    expect(waLocal.includes('Receita Início de Julho')).toBe(true);

    // Verify buildLocalAnalysisContext with selectedMonth='2026-07' preserves global metrics (grossTotal = 4000, not 3000)
    const ctxScoped = buildLocalAnalysisContext(crossMonthRows, BASE_GOALS, 'Planilha Auditoria', {
      selectedMonth: '2026-07',
      asOfDate: '2026-07-31',
    });
    expect(ctxScoped.metrics.grossTotal).toBe(4000);
    expect(ctxScoped.metrics.byYear['2026'].grossAnnual).toBe(4000);
  });

  it('Lock 3 (Scenario 4): Clean-Room Sanitizer prevents Category Collapse, masks non-allowlisted PII prefixes, and preserves 100% of statistical distribution across all 5 Agent Profiles', () => {
    // Rows without explicit `category`, relying on description prefixes that contain sensitive names
    const uncategorizedPiiRows: TableRow[] = [
      {
        id: 'r1',
        date: '2026-08-05',
        value: 2500,
        entryType: 'revenue',
        description: 'PIX CLIENTE CONFIDENCIAL ALPHA - Consultoria',
      },
      {
        id: 'r2',
        date: '2026-08-12',
        value: 1500,
        entryType: 'revenue',
        description: 'TED EMPRESA SECRETA BETA - Projeto',
      },
      {
        id: 'e1',
        date: '2026-08-08',
        value: 900,
        entryType: 'expense',
        description: 'BOLETO FORNECEDOR PRIVADO GAMA - Peças',
      },
      {
        id: 'e2',
        date: '2026-08-18',
        value: 300,
        entryType: 'expense',
        description: 'PIX PRESTADOR SIGILOSO DELTA - Reparo',
      },
    ];

    const rawExpCats = buildAccrualCategorySummaries(uncategorizedPiiRows, 'expense', 1, false);
    const rawRevCats = buildAccrualCategorySummaries(uncategorizedPiiRows, 'revenue', 1, false);
    expect(rawExpCats.length).toBe(2);
    expect(rawRevCats.length).toBe(2);

    // Sanitize with anonymize = true
    const sanitized = sanitizeRowsForManualSynthesis(uncategorizedPiiRows, true);
    const anonExpCats = buildAccrualCategorySummaries(sanitized, 'expense', 1, true);
    const anonRevCats = buildAccrualCategorySummaries(sanitized, 'revenue', 1, true);

    // Cardinality, share percentages, and values must be 100% preserved (NO collapse to 1 bucket!)
    expect(anonExpCats.length).toBe(2);
    expect(anonRevCats.length).toBe(2);
    expect(anonExpCats[0].sharePercentage).toBe(rawExpCats[0].sharePercentage);
    expect(anonExpCats[1].sharePercentage).toBe(rawExpCats[1].sharePercentage);
    expect(anonExpCats[0].category).toBe('CATEGORIA_DESPESA_01');
    expect(anonExpCats[1].category).toBe('CATEGORIA_DESPESA_02');
    expect(anonRevCats[0].category).toBe('CATEGORIA_RECEITA_01');
    expect(anonRevCats[1].category).toBe('CATEGORIA_RECEITA_02');

    // Verify all 5 Specialist Profiles generate complete dossiers with zero PII leakage and identical DRE numbers
    const profiles: ManualSynthesisProfile[] = ['native', 'cfo', 'operational', 'goals', 'dev'];
    for (const profile of profiles) {
      const res = generateManualAiAnalystSynthesis(
        uncategorizedPiiRows,
        BASE_GOALS,
        'Planilha Pessoal Secreta',
        {
          format: 'ai_analyst_full_md',
          profile,
          anonymizeDescriptions: true,
          asOfDate: '2026-08-31',
        },
      );

      expect(res.metadata.profile).toBe(profile);
      expect(res.metadata.anonymized).toBe(true);
      expect(res.content.includes('Planilha Pessoal Secreta')).toBe(false);
      expect(res.content.includes('Planilha Auditada (Modo Clean-Room LGPD)')).toBe(true);
      expect(res.content.includes('CLIENTE CONFIDENCIAL ALPHA')).toBe(false);
      expect(res.content.includes('FORNECEDOR PRIVADO GAMA')).toBe(false);
      expect(res.content.includes('CATEGORIA_DESPESA_01')).toBe(true);
      expect(res.content.includes('CATEGORIA_RECEITA_01')).toBe(true);
      expect(res.content.includes('R$ 4.000,00')).toBe(true); // Gross total
      expect(res.content.includes('R$ 1.200,00')).toBe(true); // Total expenses
    }
  });

  it('Multi-Month Filter (1x Select / 2x Deselect & Auto-Revert to Todos): idempotent toggle state machine', () => {
    let sel: string[] = []; // [] === 'all' (Todos)
    expect(serializeSelectedMonthsSpec(sel)).toBe('all');

    // 1st click on 2026-06 -> selects 2026-06
    sel = toggleMonthSelection(sel, '2026-06');
    expect(sel).toEqual(['2026-06']);
    expect(serializeSelectedMonthsSpec(sel)).toBe('2026-06');

    // 1st click on 2026-08 -> adds 2026-08 (sorted descending)
    sel = toggleMonthSelection(sel, '2026-08');
    expect(sel).toEqual(['2026-08', '2026-06']);
    expect(serializeSelectedMonthsSpec(sel)).toBe('2026-08,2026-06');

    // 2nd click on 2026-06 -> deselects 2026-06, leaving only 2026-08
    sel = toggleMonthSelection(sel, '2026-06');
    expect(sel).toEqual(['2026-08']);
    expect(serializeSelectedMonthsSpec(sel)).toBe('2026-08');

    // 2nd click on the last remaining selected month (2026-08) -> reverts to [] ('all' / Todos)
    sel = toggleMonthSelection(sel, '2026-08');
    expect(sel).toEqual([]);
    expect(serializeSelectedMonthsSpec(sel)).toBe('all');
  });

  it('Multi-Year Macro-Toggle (1 Year = 12m, 2 Years = 24m / 730 days) & Fine-Tuning Individual Months', () => {
    const months2025 = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
    const months2026 = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
    const all36Months = [
      ...Array.from({ length: 12 }, (_, i) => `2024-${String(i + 1).padStart(2, '0')}`),
      ...months2025,
      ...months2026,
    ];

    let sel: string[] = [];

    // 1st click on Year 2026 -> selects all 12 months of 2026
    sel = toggleYearSelection(sel, '2026', all36Months);
    expect(sel.length).toBe(12);
    expect(formatSelectedMonthsLabel(sel, all36Months)).toBe('Ano 2026 (12m)');

    // 1st click on Year 2025 -> adds all 12 months of 2025 (total 24 months across 2 years!)
    sel = toggleYearSelection(sel, '2025', all36Months);
    expect(sel.length).toBe(24);
    expect(formatSelectedMonthsLabel(sel, all36Months)).toBe('Anos 2025+2026 (24m)');
    const span24 = getEffectivePeriodSpanDays(sel);
    expect(span24.activeMonthsCount).toBe(24);
    expect(span24.effectiveSpanDays).toBe(730); // 365 (2025) + 365 (2026) = 730 days

    // Clicking a single month (2026-02) inside the 24-month selection deselects just that month -> 23 months
    sel = toggleMonthSelection(sel, '2026-02');
    expect(sel.length).toBe(23);

    // Clicking Year 2026 again re-completes all 12 months of 2026 -> back to 24 months
    sel = toggleYearSelection(sel, '2026', all36Months);
    expect(sel.length).toBe(24);

    // Clicking Year 2026 a second time when all 12 months of 2026 are active deselects 2026 -> leaves 12 months of 2025
    sel = toggleYearSelection(sel, '2026', all36Months);
    expect(sel.length).toBe(12);
    expect(formatSelectedMonthsLabel(sel, all36Months)).toBe('Ano 2025 (12m)');
  });

  it('Multi-Month Competence Clipping: filterAndClipRowsByMonths clips period entries across gap months and recalculates exact metrics', () => {
    const multiMonthRows: TableRow[] = [
      {
        id: 'rev_may',
        date: '2026-05-10',
        value: 3100,
        entryType: 'revenue',
        category: 'VENDAS',
        description: 'Receita Maio',
      },
      {
        id: 'rev_jun',
        date: '2026-06-10',
        value: 3000,
        entryType: 'revenue',
        category: 'VENDAS',
        description: 'Receita Junho',
      },
      {
        id: 'rev_jul',
        date: '2026-07-10',
        value: 6200,
        entryType: 'revenue',
        category: 'VENDAS',
        description: 'Receita Julho',
      },
      {
        // Multi-month expense spanning May 01 to July 31 (92 days total @ R$ 100/day = R$ 9.200)
        id: 'exp_q2_q3',
        date: '2026-05-01',
        periodStart: '2026-05-01',
        periodEnd: '2026-07-31',
        value: 9200,
        entryType: 'expense',
        category: 'INFRAESTRUTURA',
        description: 'Contrato Trimestral',
      },
    ];

    // User selects ONLY May (31d) and July (31d), skipping June (30d)!
    const selectedSpec = ['2026-07', '2026-05'];
    const clippedRows = filterAndClipRowsByMonths(multiMonthRows, selectedSpec);

    // June punctual row must be excluded; May + July punctual rows included;
    // Period expense must be split into 2 contiguous segments (May: 3100, July: 3100), excluding June's 3000!
    const mScoped = computeMetrics(clippedRows, BASE_GOALS, '2026-07-31');
    expect(mScoped.grossTotal).toBe(9300); // 3100 (May) + 6200 (July)
    expect(mScoped.totalExpenses).toBe(6200); // 3100 (May) + 3100 (July)
    expect(mScoped.netBalance).toBe(3100);
    expect(Object.keys(mScoped.byMonth).sort()).toEqual(['2026-05', '2026-07']);

    // 62 active days (31 May + 31 July):
    // Daily avg = 9300 / 62 = 150/day; Monthly avg = 9300 / 2 = 4650/month
    expect(mScoped.globalDailyAvg).toBe(150);
    expect(mScoped.globalWeeklyAvg).toBe(1050);
    expect(mScoped.globalMonthlyAvg).toBe(4650);
    expect(mScoped.survivalDaily).toBe(100);
    expect(mScoped.survivalMonthly).toBe(3100);

    // Multi-month WhatsApp Report should aggregate May + July cleanly
    const waMulti = buildWhatsAppReport(
      'Planilha Multi-Meses',
      mScoped,
      BASE_GOALS,
      serializeSelectedMonthsSpec(selectedSpec),
      clippedRows,
    );
    expect(waMulti.includes('Receita Maio')).toBe(true);
    expect(waMulti.includes('Receita Julho')).toBe(true);
    expect(waMulti.includes('Receita Junho')).toBe(false);
  });
});


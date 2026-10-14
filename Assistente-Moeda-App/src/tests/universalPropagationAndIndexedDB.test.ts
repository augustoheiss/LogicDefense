/**
 * Universal Propagation, Mathematical Engine Fixes & Local-First Suite
 *
 * Validates all 7 phases of the Master Plan:
 *   1. Persistent OpLog serialize() / hydrate() roundtrip
 *   2. Mathematical Engine fixes (waiver deduction, negative expense normalization,
 *      TableMetrics -> HealthEngine integration)
 *   3. Lossless Universal CSV v3 roundtrip (preserving category, tags, customValues,
 *      ticker/quantity/unitPrice, unresolved quarantine, activeSectors, dashboardConfig,
 *      sectorParams, and preventing PT-BR schema Column Shift Corruption)
 *   4. Street/Privacy Mode masking ('R$ •••••') with forceReveal=true override for exports
 *   5. Modular App Builder presets & health-stage recommendation engine
 */

import { OpLog } from '../core/opLog';
import { computeMetrics } from '../core/metricsEngine';
import { computeHealthScore } from '../core/healthEngine';
import { serializeDynamicCSV } from '../core/dynamicCsvSerializer';
import { parseCSVText } from '../utils/csvEngine';
import {
  formatCurrencyFull,
  formatCurrencySmart,
  setPrivacyModeActive,
  isPrivacyModeActive,
  PRIVACY_MASK,
} from '../core/formatCurrency';
import {
  WORKSPACE_PRESETS,
  getDefaultDashboardConfig,
  getRecommendedPresetForHealth,
  resolveEffectiveDashboardConfig,
} from '../core/workspacePresets';
import type {
  TableRow,
  TableGoals,
  DynamicTableSchema,
  InvestorProfileConfig,
  DashboardConfig,
  SectorParamsConfig,
} from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: any) => any;

describe('Phase 1: Persistent OpLog (Undo/Redo across sessions)', () => {
  it('serializes and hydrates undo and redo stacks losslessly', () => {
    const log1 = new OpLog();
    log1.push(
      {
        type: 'ADD_ROWS',
        payload: {
          tableId: 'tbl_1',
          rows: [{ id: 'r1', date: '2026-04-10', value: 150, entryType: 'expense', category: 'Alimentação' }],
        },
      },
      {
        type: 'DELETE_ROWS',
        payload: {
          tableId: 'tbl_1',
          rowIds: ['r1'],
        },
      },
      'Adicionar despesa'
    );

    log1.push(
      {
        type: 'UPDATE_ROW',
        payload: {
          tableId: 'tbl_1',
          rowId: 'r1',
          updates: { value: 200 },
        },
      },
      {
        type: 'UPDATE_ROW',
        payload: {
          tableId: 'tbl_1',
          rowId: 'r1',
          updates: { value: 150 },
        },
      },
      'Atualizar despesa'
    );

    // Move one entry to redo stack
    const popped = log1.popUndo();
    expect(popped).toBeDefined();
    expect(log1.canUndo()).toBe(true);
    expect(log1.canRedo()).toBe(true);

    const snapshot = log1.serialize();
    expect(snapshot.undoStack.length).toBe(1);
    expect(snapshot.redoStack.length).toBe(1);

    const log2 = new OpLog();
    log2.hydrate(snapshot);
    expect(log2.canUndo()).toBe(true);
    expect(log2.canRedo()).toBe(true);
    expect(log2.getUndoCount()).toBe(1);
    expect(log2.getRedoCount()).toBe(1);
  });
});

describe('Phase 2: Mathematical & Domain Engines (Waivers, Negative Expenses, Health Score)', () => {
  const sampleGoals: TableGoals = {
    dailyGoals: { 2026: 200 },
    weeklyGoals: { 2026: 1400 },
    annualCosts: { 2026: 36500 },
  };

  it('deducts waiver rows from billableWeeks and increments waivedWeeks & totalWaiverCredit', () => {
    const rowsWithWaiver: TableRow[] = [
      { id: 'rev_1', date: '2026-04-01', value: 3000, entryType: 'revenue' },
      { id: 'rev_2', date: '2026-04-29', value: 2500, entryType: 'revenue' },
      {
        id: 'waiver_1',
        date: '2026-04-10',
        value: 0,
        entryType: 'waiver',
        periodStart: '2026-04-10',
        periodEnd: '2026-04-16', // 7 waived days = 1 waived week
        description: 'Férias médicas',
      },
    ];

    const rowsWithoutWaiver = rowsWithWaiver.filter((r) => r.entryType !== 'waiver');
    const metricsWithWaiver = computeMetrics(rowsWithWaiver, sampleGoals, '2026-04-30');
    const metricsWithoutWaiver = computeMetrics(rowsWithoutWaiver, sampleGoals, '2026-04-30');

    expect(metricsWithWaiver.waivedWeeks).toBe(1);
    expect(metricsWithWaiver.totalWaiverCredit).toBe(1400);
    expect(metricsWithWaiver.billableWeeks).toBeLessThan(metricsWithoutWaiver.billableWeeks);
  });

  it('normalizes negative expense values with Math.abs() and excludes unresolved quarantine rows', () => {
    const rows: TableRow[] = [
      { id: '1', date: '2026-04-01', value: 5000, entryType: 'revenue', category: 'Salário' },
      { id: '2', date: '2026-04-02', value: -450, entryType: 'expense', category: 'Mercado' },
      { id: '3', date: '2026-04-03', value: 1000, entryType: 'deposit', category: 'Tesouro Selic' },
      { id: '4', date: '2026-04-04', value: 99999, entryType: 'unresolved', description: 'Importação ambígua' },
    ];

    const metrics = computeMetrics(rows, sampleGoals, '2026-04-04');
    expect(metrics.grossTotal).toBe(5000);
    expect(metrics.totalExpenses).toBe(450);
    expect(metrics.netBalance).toBe(4550);
    expect(metrics.balance).toBe(4550);
    expect(metrics.totalDeposits).toBe(1000);
    expect(metrics.daysWorked).toBe(3); // 3 active non-unresolved days
    expect(metrics.dailyAverage).toBe(5000);
    expect(metrics.globalDailyGoal).toBe(200);

    const health = computeHealthScore(metrics);
    expect(health.score).toBeGreaterThan(50);
    expect(health.pillars.length).toBe(4);
    const cashflowPillar = health.pillars.find((p) => p.id === 'cashflow');
    expect(cashflowPillar?.status).toBe('bom');
  });
});

describe('Phase 3: Universal CSV Engine v3 & Anti-Column-Shift Protection', () => {
  it('roundtrips all row fields, customValues, investorProfile, activeSectors, dashboardConfig, and sectorParams losslessly', () => {
    const ptBrSchema: DynamicTableSchema = {
      tableId: 'tbl_custom',
      version: 3,
      updatedAt: '2026-04-13T12:00:00.000Z',
      delimiter: ';',
      hasHeaders: true,
      columns: [
        { id: 'data', originalHeader: 'Data', label: 'Data', dataType: 'date', role: 'primary_date', visible: true, isCustom: false },
        { id: 'valor', originalHeader: 'Valor', label: 'Valor', dataType: 'money', role: 'primary_amount', visible: true, isCustom: false },
        { id: 'descricao', originalHeader: 'Descrição', label: 'Descrição', dataType: 'text', role: 'primary_description', visible: true, isCustom: false },
        { id: 'tipo', originalHeader: 'Tipo', label: 'Tipo', dataType: 'text', role: 'entry_type', visible: true, isCustom: false },
        { id: 'categoria', originalHeader: 'Categoria', label: 'Categoria', dataType: 'category', role: 'category_tag', visible: true, isCustom: false },
        { id: 'centro_custo', originalHeader: 'Centro de Custo', label: 'Centro de Custo', dataType: 'text', role: 'custom_attribute', visible: true, isCustom: true },
      ],
    };

    const goals: TableGoals = {
      dailyGoals: { 2026: 300 },
      weeklyGoals: { 2026: 2100 },
      annualCosts: { 2026: 48000 },
    };

    const investorProfile: InvestorProfileConfig = {
      profileType: 'balanced',
      emergencyFundMonthsGoal: 6,
      fireTargetAnnualExpensesMultiplier: 25,
      monthlyContributionGoal: 2500,
    };

    const activeSectors = ['personal_finance', 'real_estate', 'legal_taxes'];
    const dashboardConfig: DashboardConfig = {
      preset: 'investor',
      widgetOrder: ['health_score', 'investor_summary', 'month_summary'],
      hiddenWidgets: ['lessons'],
      preferredViewMode: 'spreadsheet',
    };
    const sectorParams: SectorParamsConfig = {
      creditRateMonthlyPct: 9.5,
      extraAmortizationMonthly: 400,
      discountRateMonthlyPct: 0.95,
      updatedAt: '2026-04-13T12:00:00.000Z',
    };

    const originalRows: TableRow[] = [
      {
        id: 'row_a',
        date: '2026-04-10',
        value: 1250.5,
        entryType: 'deposit',
        category: 'Investimentos',
        tags: '#fii #renda',
        description: 'Compra KNRI11',
        ticker: 'KNRI11',
        quantity: 10,
        unitPrice: 125.05,
        customValues: { centro_custo: 'Holding Familiar' },
      },
      {
        id: 'row_b',
        date: '2026-04-11',
        value: 89.9,
        entryType: 'unresolved',
        category: 'Geral',
        description: 'PIX Desconhecido',
        customValues: { centro_custo: 'Pessoal' },
      },
    ];

    const csvText = serializeDynamicCSV(
      originalRows,
      'Carteira Soberana',
      'Teste Completo v3',
      goals,
      'tbl_custom',
      null,
      undefined,
      ptBrSchema,
      investorProfile,
      activeSectors,
      dashboardConfig,
      sectorParams
    );

    const parsed = parseCSVText(csvText);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.rows.length).toBe(2);
    expect(parsed.metadata?.name).toBe('Carteira Soberana');

    // Verify no Column Shift Corruption occurred on PT-BR schema!
    const rA = parsed.rows.find((r) => 'id' in r && r.id === 'row_a') as TableRow;
    expect(rA).toBeDefined();
    expect(rA.date).toBe('2026-04-10');
    expect(rA.value).toBe(1250.5);
    expect(rA.entryType).toBe('deposit');
    expect(rA.category).toBe('Investimentos');
    expect(rA.tags).toBe('#fii #renda');
    expect(rA.description).toBe('Compra KNRI11');
    expect(rA.ticker).toBe('KNRI11');
    expect(rA.quantity).toBe(10);
    expect(rA.unitPrice).toBe(125.05);
    expect(rA.customValues?.centro_custo).toBe('Holding Familiar');

    // Verify 'unresolved' quarantine status survived CSV roundtrip
    const rB = parsed.rows.find((r) => 'id' in r && r.id === 'row_b') as TableRow;
    expect(rB).toBeDefined();
    expect(rB.entryType).toBe('unresolved');
    expect(rB.customValues?.centro_custo).toBe('Pessoal');

    // Verify metadata headers roundtripped
    expect(parsed.metadata?.activeSectors).toEqual(activeSectors);
    expect(parsed.metadata?.dashboardConfig?.preset).toBe('investor');
    expect(parsed.metadata?.sectorParams?.creditRateMonthlyPct).toBe(9.5);
    expect(parsed.metadata?.investorProfile?.profileType).toBe('balanced');
    expect(parsed.metadata?.tableGoals?.dailyGoals[2026]).toBe(300);
    expect(parsed.metadata?.tableGoals?.annualCosts[2026]).toBe(48000);
  });
});

describe('Phase 4: Street/Privacy Mode & Export Reveal', () => {
  it('masks currency values on screen when Privacy Mode is active and reveals when forceReveal=true', () => {
    setPrivacyModeActive(false);
    expect(isPrivacyModeActive()).toBe(false);
    const normalText = formatCurrencyFull(1500);
    expect(normalText).toContain('1.500');

    setPrivacyModeActive(true);
    expect(isPrivacyModeActive()).toBe(true);
    expect(formatCurrencyFull(1500)).toBe(PRIVACY_MASK);
    expect(formatCurrencySmart(1500)).toBe(PRIVACY_MASK);

    // PDF / Export override must reveal the real value even in Street Mode
    const revealedForExport = formatCurrencyFull(1500, true);
    expect(revealedForExport).toContain('1.500');
    const revealedSmartForExport = formatCurrencySmart(1500, true);
    expect(revealedSmartForExport).not.toBe(PRIVACY_MASK);

    // Reset global state
    setPrivacyModeActive(false);
  });
});

describe('Phase 6: Modular App Builder & Health-Stage Presets', () => {
  it('provides all 5 canonical financial journey presets and recommends appropriate stage', () => {
    expect(Object.keys(WORKSPACE_PRESETS).length).toBe(5);
    expect(WORKSPACE_PRESETS.survival.activeSectors).toContain('personal_finance');
    expect(WORKSPACE_PRESETS.investor.activeSectors).toContain('real_estate');
    expect(WORKSPACE_PRESETS.smb.activeSectors).toContain('smb_accounting');

    expect(getRecommendedPresetForHealth('critical', 32).id).toBe('survival');
    expect(getRecommendedPresetForHealth('building', 62).id).toBe('freelancer');
    expect(getRecommendedPresetForHealth('thriving', 85).id).toBe('investor');

    const resolved = resolveEffectiveDashboardConfig(undefined);
    expect(resolved.preset).toBe('freelancer');
    expect(resolved.widgetOrder.length).toBeGreaterThan(5);
    expect(getDefaultDashboardConfig('smb').preset).toBe('smb');
  });
});

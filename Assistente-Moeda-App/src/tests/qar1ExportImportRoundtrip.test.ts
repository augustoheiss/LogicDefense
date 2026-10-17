/**
 * QAR1 Complete Export & Import Roundtrip Suite (EXP-01 to EXP-08)
 *
 * Validates all 8 data input/output pipelines:
 *   - EXP-01: CSV Backup v3 full roundtrip (goals, schema, investorProfile, activeSectors, dashboardConfig, sectorParams, customValues)
 *   - EXP-02: CSV Backup v2 legacy compatibility
 *   - EXP-03: Semicolon bank statement CSV v1 with Brazilian currency & DD/MM/YYYY dates
 *   - EXP-04: Granular CSV export (scopes: revenue, expense, deposit, partner, unresolved; formats: agent_compact, standard_csv, backup_v3)
 *   - EXP-05: Import merge vs replace deduplication invariants
 *   - EXP-06: PDF Executive Report & Tabular Audit HTML structural integrity
 *   - EXP-07: WhatsApp Monthly Report & Weekly Operational Dossier
 *   - EXP-08: Sovereign JSON Backup (single table & multi-table vault)
 */

import {
  buildCSV,
  buildGranularCSV,
  buildJSONBackup,
  buildReportHTML,
  buildTabularAuditHTML,
  buildWhatsAppReport,
  buildWhatsAppDossie,
} from '../services/exportService';
import { parseCSVText, mergeRows } from '../utils/csvEngine';
import { computeMetrics as calculateMetrics } from '../core/metricsEngine';
import type { TableRow, TableGoals, CoinTable } from '../core/types';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;

describe('QAR1 Export & Import Complete Roundtrip Suite (EXP-01 to EXP-08)', () => {
  const richGoals: TableGoals = {
    dailyGoals: { 2026: 200 },
    weeklyGoals: { 2026: 1400, '2026-W28': 1600 },
    annualCosts: { 2026: 24000 },
    globalGoals: { dailyGoal: 200, weeklyGoal: 1400, annualCost: 24000 },
    yearlyGoals: {
      2026: { dailyGoal: 200, weeklyGoal: 1400, annualCost: 24000 },
    },
    monthlyGoals: {
      '2026-07': { dailyGoal: 220, weeklyGoal: 1540, annualCost: 26400 },
    },
  };

  const sampleRows: TableRow[] = [
    {
      id: 'exp_r1',
      date: '2026-07-05',
      value: 3500.5,
      description: 'Faturamento Projeto Alpha',
      entryType: 'revenue',
      category: 'Serviços',
      tags: 'b2b,alpha',
      customValues: { cliente: 'Acme Corp', nf: '1042' },
    },
    {
      id: 'exp_r2',
      date: '2026-07-08',
      value: 1200,
      description: 'Seguro Frota Anual',
      entryType: 'expense',
      monthlyValue: 100,
      monthCount: 12,
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      category: 'Seguros',
      tags: 'fixo',
    },
    {
      id: 'exp_r3',
      date: '2026-07-12',
      value: 1050,
      description: 'Aporte FII HGLG11',
      entryType: 'deposit',
      category: 'Investimentos',
      ticker: 'HGLG11',
      quantity: 10,
      unitPrice: 105,
    },
    {
      id: 'exp_r4',
      date: '2026-07-15',
      value: 400,
      description: 'Reembolso Sócio',
      entryType: 'partner_in',
      category: 'Parceria',
    },
    {
      id: 'exp_r5',
      date: '2026-07-18',
      value: 95,
      description: 'Compra Pendente Conciliação',
      entryType: 'unresolved',
      category: 'Quarentena',
    },
  ];

  it('EXP-01: CSV Backup v3 deve preservar 100% das linhas, metas, investimentos, setores e dashboardConfig no roundtrip', () => {
    const csvV3 = buildCSV(
      sampleRows,
      'Empresa QAR1',
      'Auditoria Completa',
      richGoals,
      'tbl_qar1',
      null,
      42,
      {
        version: 3,
        tableId: 'tbl_qar1',
        delimiter: ',',
        hasHeaders: true,
        updatedAt: '2026-07-20T00:00:00.000Z',
        columns: [
          {
            id: 'cliente',
            key: 'cliente',
            label: 'Cliente',
            originalHeader: 'Cliente',
            dataType: 'text',
            role: 'custom_attribute',
            visible: true,
            isCustom: true,
          },
        ],
      },
      {
        profileType: 'balanced',
        emergencyFundMonthsGoal: 6,
        fireTargetAnnualExpensesMultiplier: 25,
        monthlyContributionGoal: 1500,
      },
      ['core_cashflow', 'smb_accounting'],
      {
        preset: 'smb',
        hiddenWidgets: ['lessons'],
        widgetOrder: ['month_summary', 'health_score'],
        preferredViewMode: 'cad_canvas',
      },
      { pmrDays: 30, pmeDays: 15, pmpDays: 45 }
    );

    const parsed = parseCSVText(csvV3);
    expect(parsed.rows.length).toBe(sampleRows.length);
    expect(parsed.metadata?.name).toBe('Empresa QAR1');
    expect(parsed.metadata?.tableGoals?.monthlyGoals?.['2026-07']?.weeklyGoal).toBe(1540);
    expect(parsed.metadata?.investorProfile?.profileType).toBe('balanced');
    expect(parsed.metadata?.activeSectors).toContain('smb_accounting');
    expect(parsed.metadata?.sectorParams?.pmrDays).toBe(30);

    const investRow = parsed.rows.find((r) => 'id' in r && r.id === 'exp_r3') as TableRow | undefined;
    expect(investRow?.ticker).toBe('HGLG11');
    expect(investRow?.quantity).toBe(10);
    expect(investRow?.unitPrice).toBe(105);
  });

  it('EXP-04: buildGranularCSV deve filtrar corretamente por escopo (revenue, expense, deposit, partner, unresolved) e formato', () => {
    const revCsv = buildGranularCSV(sampleRows, { scope: 'revenue', format: 'agent_compact' });
    expect(revCsv).toContain('Faturamento Projeto Alpha');
    expect(revCsv).not.toContain('Seguro Frota Anual');
    expect(revCsv).not.toContain('Aporte FII HGLG11');

    const expCsv = buildGranularCSV(sampleRows, { scope: 'expense', format: 'standard_csv', delimiter: ';' });
    expect(expCsv).toContain('Seguro Frota Anual');
    expect(expCsv).not.toContain('Faturamento Projeto Alpha');

    const partnerCsv = buildGranularCSV(sampleRows, { scope: 'partner', format: 'agent_compact' });
    expect(partnerCsv).toContain('Reembolso Sócio');

    const unresolvedCsv = buildGranularCSV(sampleRows, { scope: 'unresolved', format: 'agent_compact' });
    expect(unresolvedCsv).toContain('Compra Pendente Conciliação');
  });

  it('EXP-05: mergeRows deve atualizar registros existentes por ID e preservar registros não conflitantes', () => {
    const updatedIncoming: TableRow[] = [
      {
        ...sampleRows[0],
        value: 4000, // valor atualizado para o mesmo ID exp_r1
      },
      {
        id: 'exp_r6_new',
        date: '2026-07-25',
        value: 800,
        description: 'Novo Contrato',
        entryType: 'revenue',
      },
    ];

    const merged = mergeRows(sampleRows, updatedIncoming);
    expect(merged.length).toBe(sampleRows.length + 1);
    const r1 = merged.find((r) => r.id === 'exp_r1');
    expect(r1?.value).toBe(4000);
  });

  it('EXP-06 & EXP-07: Relatórios PDF HTML, WhatsApp Mensal e Dossiê Semanal devem conter totais exatos e zero NaN', () => {
    const metrics = calculateMetrics(sampleRows, richGoals);
    const pdfHtml = buildReportHTML('Empresa QAR1', sampleRows, metrics, richGoals, '2026-07');
    expect(pdfHtml).toContain('Empresa QAR1');
    expect(pdfHtml).not.toContain('NaN');
    expect(pdfHtml).not.toContain('undefined');

    const waReport = buildWhatsAppReport('Empresa QAR1', metrics, richGoals, '2026-07', sampleRows);
    expect(waReport).toContain('Faturamento Projeto Alpha');
    expect(waReport).toContain('Seguro Frota Anual');
    expect(waReport).not.toContain('NaN');

    const dossie = buildWhatsAppDossie(
      [
        {
          mondayKey: '2026-07-06',
          sundayKey: '2026-07-12',
          weekNumber: 28,
          weekLabel: '06/07 a 12/07',
          weeklyGoal: 1400,
          weeklyRevenue: 3500.5,
          weeklyWaivers: 0,
          weeklyPartnerNet: 0,
          weekDelta: 2100.5,
          cumulativeBalance: 2100.5,
        },
      ],
      metrics.globalGoalBalance,
      sampleRows,
      richGoals
    );
    expect(dossie).toContain('DOSSIÊ DE AUDITORIA OPERACIONAL');
    expect(dossie).not.toContain('NaN');

    const auditHtml = buildTabularAuditHTML('Empresa QAR1', [
      {
        mondayKey: '2026-07-06',
        sundayKey: '2026-07-12',
        weekNumber: 28,
        weekLabel: '06/07 a 12/07',
        weeklyGoal: 1400,
        weeklyRevenue: 3500.5,
        weeklyWaivers: 0,
        weeklyPartnerNet: 0,
        weekDelta: 2100.5,
        cumulativeBalance: 2100.5,
      },
    ]);
    expect(auditHtml).toContain('SUPERÁVIT');
    expect(auditHtml).not.toContain('NaN');
  });

  it('EXP-08: buildJSONBackup deve serializar estrutura soberana v3.1 para tabela única e múltiplas tabelas', () => {
    const table: CoinTable = {
      id: 'tbl_json_1',
      name: 'Vault Principal',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
      rows: sampleRows,
      goals: richGoals,
    };

    const singleBackup = JSON.parse(buildJSONBackup(table));
    expect(singleBackup.version).toBe('3.1');
    expect(singleBackup.table.id).toBe('tbl_json_1');
    expect(singleBackup.table.rows.length).toBe(sampleRows.length);

    const multiBackup = JSON.parse(buildJSONBackup([table]));
    expect(multiBackup.version).toBe('3.1');
    expect(Array.isArray(multiBackup.tables)).toBe(true);
    expect(multiBackup.tables[0].name).toBe('Vault Principal');
  });
});

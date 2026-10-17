/**
 * Local AI-Analyst Synthesizer — Assistente Moeda
 *
 * Deterministic, offline-capable synthesis engine that replicates 100% of the
 * backend mandatory `/api/v1/public/ai-analyst`, `/api/v1/public/analysis-context`,
 * `/api/v1/public/agent-prompt`, `/api/v1/public/summary`, and `/api/v1/public/transactions`
 * routes directly on the client device (React Native / Web).
 *
 * Enables users to copy or download their complete financial synthesis in:
 *   1. `ai_analyst_full_md` (.md) — Self-contained Executive Dossier (8 Skills + DRE + Stats + Ledger + Round-Trip)
 *   2. `ai_analyst_xml` (.xml)     — Semantic XML-structured synthesis optimized for Claude / Reasoning models
 *   3. `analysis_context_md` (.md) — Pure analytical context without System Prompt (for Custom GPTs / Projects / NotebookLM)
 *   4. `api_routes_bundle_json` (.json) — Offline mirror of all public API routes in a single JSON payload
 */

import { computeMetrics, rowContributions } from './metricsEngine';
import {
  getEffectiveGoals,
  getWeeklyGoalForDate,
  getMondayOf,
  getSundayOf,
  toLocalKey,
  resolveGoalForYear,
  computeActiveMonthsSpan,
  buildMonthCompetenceWeekGroups,
} from './dateUtils';
import { buildAIScenarioContext } from './aiContextBuilder';
import { neutralizeCsvFormula } from '../utils/securitySanitizer';
import type {
  TableRow,
  TableGoals,
  TableMetrics,
  InvestorProfileConfig,
  SectorSimulationParams,
} from './types';

// ── Types & Contracts ────────────────────────────────────────────────────────

export type ManualSynthesisFormat =
  | 'ai_analyst_full_md'
  | 'ai_analyst_xml'
  | 'analysis_context_md'
  | 'api_routes_bundle_json';

export type ManualSynthesisProfile =
  | 'native'
  | 'cfo'
  | 'operational'
  | 'goals'
  | 'dev';

export interface ManualSynthesisOptions {
  format: ManualSynthesisFormat;
  profile?: ManualSynthesisProfile;
  /** When true, strips personal descriptions/payees and replaces with category labels (LGPD / Modo Rua). */
  anonymizeDescriptions?: boolean;
  /** Optional 'YYYY-MM' filter. When omitted or 'all', synthesizes full spreadsheet history. */
  selectedMonth?: string;
  /** Optional user question or objective embedded at the end of the synthesis. */
  userCustomPrompt?: string;
  /** Reference date 'YYYY-MM-DD' for calculations (defaults to today). */
  asOfDate?: string;
  /** Optional local enrichment: Investor profile config. */
  investorProfile?: InvestorProfileConfig;
  /** Optional local enrichment: Active sector IDs. */
  activeSectors?: string[];
  /** Optional local enrichment: Sector simulation parameters. */
  sectorParams?: SectorSimulationParams;
}

export interface CategoryAccrualSummary {
  category: string;
  entryType: 'expense' | 'revenue';
  totalAccruedValue: number;
  rawLaunchCount: number;
  activeMonthsCount: number;
  avgPerActiveMonth: number;
  avgPerGlobalMonth: number;
  sharePercentage: number;
  sampleDescriptions: string[];
  meanLaunchValue: number;
  maxLaunchValue: number;
  minLaunchValue: number;
  medianLaunchValue: number;
  stdDevLaunchValue: number;
  accrualDailyRate: number;
  accrualWeeklyRate: number;
}

export interface SynthesisMetadata {
  format: ManualSynthesisFormat;
  profile: ManualSynthesisProfile;
  extension: 'md' | 'xml' | 'json';
  charCount: number;
  byteSize: number;
  estimatedTokens: number;
  rowCount: number;
  ledgerTier: 1 | 2 | 3 | 4;
  anonymized: boolean;
}

export interface GeneratedSynthesisResult {
  content: string;
  metadata: SynthesisMetadata;
}

// ── 8 Financial Skills Matrix ────────────────────────────────────────────────

export interface FinancialSkillSpec {
  id: string;
  name: string;
  discipline: string;
  focus: string;
}

export const SKILLS_MANIFEST: FinancialSkillSpec[] = [
  {
    id: 'fpa_senior',
    name: 'FP&A Sênior (Planejamento & Análise)',
    discipline: 'Variance Analysis, Rolling Forecast, Sazonalidade e Projeções Estatísticas',
    focus: 'Comparar metas hierárquicas (global/anual/mensal) contra o realizado e projetar tendências de caixa.',
  },
  {
    id: 'controllership_gaap',
    name: 'Controladoria & Auditoria (Controller / GAAP)',
    discipline: 'Regime de Competência (Accrual Basis) vs. Caixa e Isolamento de Passthrough',
    focus: 'Ratear receitas/despesas periódicas (periodStart→periodEnd) e isolar repasses de sócios (partner_in/partner_out).',
  },
  {
    id: 'strategic_cfo',
    name: 'CFO Estratégico (Alocação & Solvência)',
    discipline: 'DRE Estrutural, Margem Operacional Líquida, Runway e Blindagem de Liquidez',
    focus: 'Avaliar geração de caixa livre, solvência estrutural e cobertura de reserva de emergência.',
  },
  {
    id: 'pricing_unit_economics',
    name: 'Engenharia de Precificação & Unit Economics',
    discipline: 'Ponto de Equilíbrio (Break-Even Diário/Semanal/Mensal) e Valor Líquido da Hora',
    focus: 'Determinar o faturamento mínimo de sobrevivência e a rentabilidade real do esforço operacional.',
  },
  {
    id: 'tax_provisioning',
    name: 'Estratégia Tributária & Provisão Fiscal',
    discipline: 'Segregação de Reserva para Impostos e Eficiência Fiscal PME/Autônomo',
    focus: 'Proteger o caixa garantindo provisão tributária antes da retirada ou distribuição de lucros.',
  },
  {
    id: 'cashflow_working_capital',
    name: 'Gestão de Fluxo de Caixa & Volatilidade',
    discipline: 'Estabilidade Operacional (Mediana vs. Média), Moda e Risco (Desvio Padrão)',
    focus: 'Mitigar oscilações bruscas de faturamento e descasamentos no ciclo financeiro.',
  },
  {
    id: 'wealth_fire_investments',
    name: 'Gestão de Patrimônio & Juros Compostos (FIRE)',
    discipline: 'Aportes Acumulados, Rendimento Composto (Benchmark CDI 0,8% a.m.) e Alocação',
    focus: 'Acelerar a transição da renda ativa para a cobertura de custos via renda passiva.',
  },
  {
    id: 'accounts_payable_cost_anatomy',
    name: 'Contas a Pagar & Anatomia de Despesas',
    discipline: 'Frequência de Uso vs. Volume Monetário Concentrado',
    focus: 'Separar ralos invisíveis repetitivos (alta frequência) de pesos fixos estruturais (alto volume).',
  },
];

// ── Formatting Helpers ───────────────────────────────────────────────────────

function fmtBRL(value: number): string {
  const safe = typeof value === 'number' && !isNaN(value) ? value : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}R$ ${formatted}`;
}

function fmtPct(value: number): string {
  const safe = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `${safe.toFixed(1).replace('.', ',')}%`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCdata(unsafe: string): string {
  return unsafe.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

const SAFE_OPERATIONAL_CATEGORIES = new Set<string>([
  'FREELANCE',
  'INVESTIMENTOS',
  'INFRAESTRUTURA',
  'DIVERSOS',
  'RESERVA',
  'OPERACIONAL',
  'VENDAS',
  'ALUGUEL',
  'COMBUSTIVEL',
  'COMBUSTÍVEL',
  'MANUTENCAO',
  'MANUTENÇÃO',
  'IMPOSTOS',
  'TRIBUTOS',
  'ALIMENTACAO',
  'ALIMENTAÇÃO',
  'MERCADO',
  'SUPERMERCADO',
  'ENERGIA',
  'LUZ',
  'AGUA',
  'ÁGUA',
  'INTERNET',
  'TELEFONE',
  'CONDOMINIO',
  'CONDOMÍNIO',
  'SAUDE',
  'SAÚDE',
  'FARMACIA',
  'FARMÁCIA',
  'EDUCACAO',
  'EDUCAÇÃO',
  'TRANSPORTE',
  'UBER',
  '99',
  'IFOOD',
  'DELIVERY',
  'SERVICO',
  'SERVIÇO',
  'SERVICOS',
  'SERVIÇOS',
  'CONSULTORIA',
  'SALARIO',
  'SALÁRIO',
  'PRO-LABORE',
  'PRÓ-LABORE',
  'APORTE',
  'RENDIMENTO',
  'DIVIDENDOS',
  'SEGURO',
  'IPVA',
  'IPTU',
  'CONTABILIDADE',
  'MARKETING',
  'SOFTWARE',
  'ASSINATURA',
  'ASSINATURAS',
  'CUSTO OPERACIONAL',
  'DESPESAS GERAIS',
  'RECEITA OPERACIONAL',
  'REPASSE PARCERIA',
  'ENTRADA PARCERIA',
  'ABONO',
]);

function normalizeCategoryName(row: TableRow, anonymized = false): string {
  if (row.category && row.category.trim().length > 0) {
    return row.category.trim().toUpperCase();
  }
  if (!anonymized && row.description && row.description.trim().length > 0) {
    const desc = row.description.trim();
    const sepMatch = desc.match(/^([^—\-:|/]{2,24})\s*[—\-:|/]/);
    if (sepMatch && sepMatch[1]) {
      return sepMatch[1].trim().toUpperCase();
    }
    const firstWord = desc.split(/\s+/)[0]?.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '').toUpperCase();
    if (firstWord && firstWord.length >= 3) {
      return firstWord;
    }
  }
  return row.entryType === 'expense' ? 'DESPESAS GERAIS' : 'RECEITA OPERACIONAL';
}

/**
 * Clean-Room Sanitizer (Lock 3 — Prevention of Sanitizer Paradox):
 * Extracts the category key BEFORE masking `r.description` so category cardinality,
 * HHI concentration, and Population Standard Deviation (÷ N) are 100% preserved.
 * If `anonymize = true` and the extracted category is not in `SAFE_OPERATIONAL_CATEGORIES`
 * (e.g. a personal/client name extracted from a description prefix), maps it bijectively
 * and deterministically to `CATEGORIA_RECEITA_01..N` / `CATEGORIA_DESPESA_01..N`.
 */
export function sanitizeRowsForManualSynthesis(
  rows: TableRow[],
  anonymize = false,
): TableRow[] {
  if (!anonymize) return rows;

  const revMap = new Map<string, string>();
  const expMap = new Map<string, string>();
  const otherMap = new Map<string, string>();

  return rows.map((r) => {
    const rawCat = normalizeCategoryName(r, false);
    let safeCat = rawCat;

    if (!SAFE_OPERATIONAL_CATEGORIES.has(rawCat) && !/^CATEGORIA_(RECEITA|DESPESA|OPERACIONAL)_\d+$/.test(rawCat)) {
      const et = r.entryType || 'revenue';
      if (et === 'expense') {
        if (!expMap.has(rawCat)) {
          expMap.set(rawCat, `CATEGORIA_DESPESA_${String(expMap.size + 1).padStart(2, '0')}`);
        }
        safeCat = expMap.get(rawCat)!;
      } else if (et === 'revenue') {
        if (!revMap.has(rawCat)) {
          revMap.set(rawCat, `CATEGORIA_RECEITA_${String(revMap.size + 1).padStart(2, '0')}`);
        }
        safeCat = revMap.get(rawCat)!;
      } else {
        if (!otherMap.has(rawCat)) {
          otherMap.set(rawCat, `CATEGORIA_OPERACIONAL_${String(otherMap.size + 1).padStart(2, '0')}`);
        }
        safeCat = otherMap.get(rawCat)!;
      }
    }

    return {
      ...r,
      category: safeCat,
      description: `[${safeCat.toUpperCase()}]`,
      tags: undefined,
      ticker: undefined,
      clonedFrom: undefined,
      metadataJson: undefined,
      customValues: undefined,
    };
  });
}

// ── Accrual-Basis Category Anatomy (100% Parity with context_builder.py) ────

export function buildAccrualCategorySummaries(
  rows: TableRow[],
  entryTypeTarget: 'expense' | 'revenue',
  globalMonthsCount: number,
  anonymize = false,
): CategoryAccrualSummary[] {
  const filtered = rows.filter((r) => {
    if (r.generatedBy !== undefined) return false;
    const et = r.entryType || 'revenue';
    if (entryTypeTarget === 'revenue') {
      return et === 'revenue' && r.value > 0;
    }
    return et === 'expense' && Math.abs(r.value) > 0;
  });

  if (filtered.length === 0) return [];

  const catMap = new Map<
    string,
    {
      totalValue: number;
      launchCount: number;
      rawValues: number[];
      monthsSet: Set<string>;
      descriptions: Set<string>;
    }
  >();

  let grandTotal = 0;

  for (const row of filtered) {
    const cat = normalizeCategoryName(row, anonymize);
    const absVal = Math.abs(row.value);
    const absRow = { ...row, value: absVal };
    const contribs = rowContributions(absRow);

    let bucket = catMap.get(cat);
    if (!bucket) {
      bucket = {
        totalValue: 0,
        launchCount: 0,
        rawValues: [],
        monthsSet: new Set<string>(),
        descriptions: new Set<string>(),
      };
      catMap.set(cat, bucket);
    }

    bucket.launchCount += 1;
    bucket.rawValues.push(absVal);
    if (!anonymize && row.description && bucket.descriptions.size < 4) {
      bucket.descriptions.add(row.description.trim());
    }

    for (const c of contribs) {
      const val = Math.abs(c.value);
      bucket.totalValue += val;
      grandTotal += val;
      if (c.date && c.date.length >= 7) {
        bucket.monthsSet.add(c.date.slice(0, 7));
      }
    }
  }

  // Active competence months span (Lock 1)
  const spanInfo = computeActiveMonthsSpan(filtered);
  const activeDaysSpan = Math.max(1, spanInfo.effectiveSpanDays);

  const effectiveGlobalMonths = Math.max(1, globalMonthsCount);
  const summaries: CategoryAccrualSummary[] = [];

  for (const [category, data] of catMap.entries()) {
    const activeMonthsCount = Math.max(1, data.monthsSet.size);
    const sortedVals = [...data.rawValues].sort((a, b) => a - b);
    const count = sortedVals.length;
    const meanVal = count > 0 ? data.totalValue / count : 0;
    const maxVal = count > 0 ? sortedVals[count - 1] : 0;
    const minVal = count > 0 ? sortedVals[0] : 0;
    const mid = Math.floor(count / 2);
    const medianVal =
      count === 0
        ? 0
        : count % 2 === 1
        ? sortedVals[mid]
        : (sortedVals[mid - 1] + sortedVals[mid]) / 2;
    // Population variance (÷ N) for 100% parity with CategorySummary.tsx & metricsEngine.ts (Lock 3)
    const variance =
      count > 0
        ? sortedVals.reduce((acc, v) => acc + Math.pow(v - meanVal, 2), 0) / count
        : 0;
    const stdDevVal = Math.sqrt(variance);
    const dailyRate = data.totalValue / activeDaysSpan;
    const weeklyRate = dailyRate * 7;

    summaries.push({
      category,
      entryType: entryTypeTarget,
      totalAccruedValue: data.totalValue,
      rawLaunchCount: data.launchCount,
      activeMonthsCount,
      avgPerActiveMonth: data.totalValue / activeMonthsCount,
      avgPerGlobalMonth: data.totalValue / effectiveGlobalMonths,
      sharePercentage: grandTotal > 0 ? (data.totalValue / grandTotal) * 100 : 0,
      sampleDescriptions: Array.from(data.descriptions),
      meanLaunchValue: meanVal,
      maxLaunchValue: maxVal,
      minLaunchValue: minVal,
      medianLaunchValue: medianVal,
      stdDevLaunchValue: stdDevVal,
      accrualDailyRate: dailyRate,
      accrualWeeklyRate: weeklyRate,
    });
  }

  return summaries.sort((a, b) => b.totalAccruedValue - a.totalAccruedValue);
}

// ── Live WhatsApp Executive Report Builder (100% Parity with exportService.ts) ──

export function buildLocalWhatsAppReportText(
  tableName: string,
  metrics: TableMetrics,
  goals: TableGoals,
  reportMonth: string,
  rows: TableRow[] = [],
): string {
  const realRows = rows.filter((r) => r.generatedBy === undefined);
  const partnerInRows = realRows.filter((r) => r.entryType === 'partner_in');
  const partnerOutRows = realRows.filter((r) => r.entryType === 'partner_out');

  const usedInIds = new Set<string>();
  const usedOutIds = new Set<string>();
  const canceledPartnerships: Array<{
    inRow: TableRow;
    outRow: TableRow;
    value: number;
  }> = [];

  for (const inRow of partnerInRows) {
    const matchOut = partnerOutRows.find(
      (outRow) =>
        !usedOutIds.has(outRow.id) &&
        Math.abs(Math.abs(outRow.value) - Math.abs(inRow.value)) < 0.01,
    );
    if (matchOut) {
      usedInIds.add(inRow.id);
      usedOutIds.add(matchOut.id);
      canceledPartnerships.push({
        inRow,
        outRow: matchOut,
        value: Math.abs(inRow.value),
      });
    }
  }

  const recentPartnerOut = [...partnerOutRows]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 8);

  const lines: string[] = [];
  lines.push(`📊 *Relatório Financeiro — ${tableName}*`);
  lines.push(`📅 Referência: *${reportMonth}*`);
  lines.push('');

  const monthData = metrics.byMonth[reportMonth];
  const [rYear, rMonth] = reportMonth.split('-').map(Number);
  const effGoals = getEffectiveGoals({ year: rYear, month: rMonth }, goals);
  const dailyGoalForMonth = effGoals.dailyGoal || resolveGoalForYear(goals.dailyGoals, rYear);
  const weeklyGoalForMonth = effGoals.weeklyGoal || resolveGoalForYear(goals.weeklyGoals, rYear);

  if (monthData) {
    const monthExp = monthData.expense ?? 0;
    const monthNet = monthData.grossMonthly - monthExp;
    lines.push(`🔹 *Resumo de Resultados do Mês (${reportMonth})*`);
    lines.push(`  • Receita Bruta: *${fmtBRL(monthData.grossMonthly)}*`);
    if (monthExp > 0) {
      lines.push(`  • Custos Rateados no Mês: *-${fmtBRL(monthExp)}*`);
      lines.push(`  • Saldo Líquido do Mês: *${fmtBRL(monthNet)}*`);
    }
    lines.push(
      `  • Média Diária: ${fmtBRL(monthData.dailyAvg)}${
        dailyGoalForMonth > 0 ? ` (Meta: ${fmtBRL(dailyGoalForMonth)})` : ''
      }`,
    );
    lines.push(
      `  • Média Semanal: ${fmtBRL(monthData.weeklyAvg)}${
        weeklyGoalForMonth > 0 ? ` (Meta: ${fmtBRL(weeklyGoalForMonth)})` : ''
      }`,
    );
    lines.push('');

    // Unified competence-clipped weekly breakdown inside reportMonth (Lock 2)
    const weekGroups = buildMonthCompetenceWeekGroups(realRows, goals, reportMonth);
    const activeWeekGroups = weekGroups.filter((w) => w.dailyEntries.length > 0 || w.weeklyTotal > 0);

    if (activeWeekGroups.length > 0) {
      lines.push(`📅 *Extrato de Entradas por Semana (${reportMonth})*`);
      for (const week of activeWeekGroups) {
        const monKey = toLocalKey(week.weekStartDate);
        const sunKey = toLocalKey(week.weekEndDate);
        const wTotal = week.weeklyTotal;
        const wGoal = week.weeklyGoal;
        const wDiff = week.differenceFromGoal;
        const statusStr =
          wGoal > 0
            ? wDiff >= 0
              ? `🟢 Meta Batida (+${fmtBRL(wDiff)})`
              : `🔴 Faltam ${fmtBRL(Math.abs(wDiff))}`
            : '';
        lines.push(
          `  *Semana ${week.weekNumber} (${monKey} a ${sunKey}):* *${fmtBRL(wTotal)}* ${statusStr}`,
        );
        for (const item of week.dailyEntries) {
          lines.push(
            `    ▫️ ${item.date}: ${fmtBRL(item.value)}${
              item.description ? ` (${item.description})` : ''
            }`,
          );
        }
      }
      lines.push('');
    }
  }

  lines.push(`🌐 *Visão Global & Metas de Sobrevivência (Planilha Completa)*`);
  lines.push(`  • Total Bruto Acumulado: *${fmtBRL(metrics.grossTotal)}*`);
  lines.push(`  • Total de Despesas Operacionais: *-${fmtBRL(metrics.totalExpenses)}*`);
  lines.push(`  • Saldo Operacional Líquido: *${fmtBRL(metrics.netBalance)}*`);
  lines.push(`  • Média Diária Global: ${fmtBRL(metrics.globalDailyAvg)}`);
  lines.push(`  • Média Semanal Global: ${fmtBRL(metrics.globalWeeklyAvg)}`);
  lines.push(`  • Média Mensal Global: ${fmtBRL(metrics.globalMonthlyAvg)}`);
  if (metrics.totalExpenses > 0) {
    lines.push(
      `  • Sobrevivência (Break-Even): Diária ${fmtBRL(metrics.survivalDaily)} | Semanal ${fmtBRL(
        metrics.survivalWeekly,
      )} | Mensal ${fmtBRL(metrics.survivalMonthly)}`,
    );
  }

  if (metrics.totalPartnerIn > 0 || metrics.totalPartnerOut > 0) {
    lines.push('');
    lines.push(`🤝 *Balanço de Parcerias & Repasses (Isolado da Operação)*`);
    lines.push(`  • Entradas de Parceria: ${fmtBRL(metrics.totalPartnerIn)}`);
    lines.push(`  • Saídas de Parceria: -${fmtBRL(metrics.totalPartnerOut)}`);
    lines.push(`  • Caixa Líquido c/ Parceria: *${fmtBRL(metrics.netWithPartner)}*`);
    if (canceledPartnerships.length > 0) {
      lines.push(
        `  • Conciliações Mútuas Anuladas (Wash): ${canceledPartnerships.length} par(es) (${fmtBRL(
          canceledPartnerships.reduce((s, p) => s + p.value, 0),
        )})`,
      );
    }
    if (recentPartnerOut.length > 0) {
      lines.push(`  • Últimos Repasses Efetuados:`);
      for (const po of recentPartnerOut.slice(0, 5)) {
        lines.push(
          `    ▫️ ${po.date}: -${fmtBRL(Math.abs(po.value))}${
            po.description ? ` — ${po.description}` : ''
          }`,
        );
      }
    }
  }

  return lines.join('\n');
}

// ── System Persona Prompt Builder (Manual / Offline Adapted) ────────────────

export function buildManualPersonaPrompt(
  profile: ManualSynthesisProfile = 'native',
  tableName = 'Planilha Principal',
): string {
  const skillsLines = SKILLS_MANIFEST.map(
    (s, i) => `   ${i + 1}. **${s.name}**: ${s.discipline} — *${s.focus}*`,
  ).join('\n');

  const commonHeader = `Você é o **Assistente Moeda Native Agent** — Agente Financeiro Autônomo e Consultor Executivo operando com a **Extração Completa das Rotas da API da Planilha Atual Renderizada no Navegador: "${tableName}"**.
Você opera com a fusão das 8 disciplinas financeiras de elite do Assistente Moeda:
${skillsLines}

⚡ **ESPELHO COMPLETO DAS ROTAS DA API PÚBLICA (EXTRAÍDO DA PLANILHA ATUAL DO CLIENTE)**:
1. **ETAPA 1 (\`GET /api/v1/public/agent-prompt\`)**: Concluída neste cabeçalho com as 8 Skills Financeiras e o Protocolo de Aula Executiva.
2. **ETAPA 2 (\`POST /api/v1/public/ai-analyst\` + \`GET /api/v1/public/analysis-context\`)**:
   - Você está recebendo abaixo a **Síntese Real e Integral da Planilha Atual ("${tableName}")** compilada diretamente da memória do navegador do usuário, incluindo o **Relatório Executivo (Padrão WhatsApp)**, **DRE por Competência**, **Estatísticas Avançadas (Mediana, Moda, Desvio Padrão)**, **Anatomia de Categorias**, **Banco de Tempo** e **Razão de Transações (\`/api/v1/public/transactions\`)**.
   - **NÃO tente fazer requisições HTTP externas**. Todos os cálculos abaixo pertencem à planilha ativa que o usuário está visualizando agora.`;

  const methodologyBlock = `🎓 **FILOSOFIA DE AULA EXECUTIVA & RIGOR METODOLÓGICO (INEGOCIÁVEL)**:
- **ZERO DUMP DE DADOS**: Nunca responda com tabelas cruas ou números soltos sem explicar a **causa raiz**, o **impacto futuro no caixa** e a **recomendação prática acionável**.
- **NÚMEROS EXATOS & PADRÃO BRL**: Utilize exclusivamente os valores auditados neste documento. Formate sempre como \`R$ X.XXX,XX\`. **NUNCA invente números, datas ou transações inexistentes**.
- **CONTROLADORIA & ISOLAMENTO DE PARCERIAS**: Trate entradas e saídas de parceria (\`partner_in\` / \`partner_out\`) estritamente como **PASSTHROUGH** (repasses de terceiros/sócios que se anulam e não representam capacidade produtiva própria).
- **ESTATÍSTICAS AVANÇADAS**: Ensine ao usuário a diferença entre a **Média** (sensível a picos) e a **Mediana** (ganho típico estável), use a **Moda** para apontar padrões repetitivos e o **Desvio Padrão** para medir a volatilidade e o risco operacional.
- **ANATOMIA DE DESPESAS (FREQUÊNCIA vs. VOLUME)**: Segregue cirurgicamente a **Frequência de Uso** (pequenos gastos repetitivos no dia a dia) do **Volume Monetário Concentrado** (pesos estruturais fixos, bancários ou parcelados).
- **PRECIFICAÇÃO & VALOR DA HORA**: Compare a geração de receita com o Ponto de Equilíbrio Operacional (Metas de Sobrevivência Diária, Semanal e Mensal) e avalie a sustentabilidade do Banco de Tempo.
- **PROVISÃO TRIBUTÁRIA**: Lembre sempre da separação da reserva para impostos e reserva de emergência antes da retirada de lucros.`;

  if (profile === 'cfo') {
    return `${commonHeader}

🏛️ **FOCO ESPECIALISTA ATIVO: CFO EXECUTIVO & FP&A SÊNIOR**
Sua missão é ministrar uma **Aula Executiva C-Level** sobre a saúde estrutural desta planilha:
1. Diagnostique a DRE Estrutural (Receita Operacional vs. Despesas Rateadas por Competência vs. Margem Líquida).
2. Compare o faturamento atual com o **Ponto de Equilíbrio (Break-Even de Sobrevivência)** e com as **Metas Configuradas**.
3. Analise a Anatomia de Despesas destacando os 3 maiores pesos estruturais (Volume) vs. os 3 maiores ralos de hábito (Frequência).
4. Avalie o Portfólio de Investimentos (juros compostos a 0,8% a.m.) e proponha um Plano de Ação Executivo com 3 a 5 diretrizes práticas.

${methodologyBlock}`;
  }

  if (profile === 'operational') {
    return `${commonHeader}

⚡ **FOCO ESPECIALISTA ATIVO: AGENTE OPERACIONAL & CONCILIAÇÃO EM LOTE (GOD MODE)**
Sua missão é auditar lançamentos, higienizar categorias, conciliar itens pendentes e estruturar novos lotes de transações:
1. Verifique se há itens em quarentena (\`unresolved\`) ou categorias genéricas que podem ser reclassificadas.
2. Quando o usuário solicitar o registro, criação ou importação de faturas/extratos/transações, forneça o bloco pronto para reimportação imediata no Assistente Moeda (em formato **CSV compatível com "Colar Texto CSV"** ou **JSON Function Calling** conforme especificado na seção final deste documento).

${methodologyBlock}`;
  }

  if (profile === 'goals') {
    return `${commonHeader}

🎯 **FOCO ESPECIALISTA ATIVO: ESTRATEGISTA DE METAS, BANCO DE TEMPO & BURNOUT SHIELD**
Sua missão é correlacionar o desempenho financeiro com a sustentabilidade da rotina humana:
1. Analise profundamente o **Balanço Estrito de Metas (Strict Goal Balance)** e o **Banco de Tempo (Semanas de Crédito/Débito)**.
2. Calcule quantas semanas de folga acumulada (ou de reposição necessária) o usuário possui em relação à meta semanal vigente.
3. Compare a Mediana Diária com a Meta Diária para informar quantos dias de trabalho efetivo por semana são necessários para bater a meta sem exaustão (Burnout Shield).

${methodologyBlock}`;
  }

  if (profile === 'dev') {
    return `${commonHeader}

🛠️ **FOCO ESPECIALISTA ATIVO: AGENTE DEV, AUTOMAÇÃO & AUDITORIA DE DADOS**
Sua missão é atuar como Engenheiro de Dados Financeiros e Integrador:
1. Utilize as estruturas analíticas e o Razão de Lançamentos abaixo para validar consistência de esquemas, somatórios, rateios de competência (\`periodStart\`→\`periodEnd\`) e conciliação de saldos.
2. Ao gerar scripts, automações ou payloads de sincronismo em lote (\`batch-sync\`), respeite rigorosamente os contratos de dados do Assistente Moeda (despesas negativas, receitas positivas, datas ISO \`YYYY-MM-DD\`, sem IDs manuais).

${methodologyBlock}`;
  }

  // Default: 'native'
  return `${commonHeader}

${methodologyBlock}`;
}

// ── Manual Round-Trip Footer (Return to App without API) ────────────────────

export function buildManualRoundTripInstructions(realRows: TableRow[] = []): string {
  const sampleRow = realRows[realRows.length - 1];
  const sampleDate = sampleRow?.date || 'YYYY-MM-DD';
  const sampleDesc = sampleRow?.description?.replace(/;/g, ',') || 'Descrição clara do item';
  const sampleVal = sampleRow
    ? sampleRow.entryType === 'expense'
      ? -Math.abs(sampleRow.value)
      : Math.abs(sampleRow.value)
    : -150.0;
  const sampleType = sampleRow?.entryType || 'expense';
  const sampleCat = sampleRow?.category || 'OPERACIONAL';

  return `---
## ⚡ FUNCTION CALLING / GOD MODE & RETORNO PARA A PLANILHA (\`batch-sync\` / CSV)

Se o usuário pedir explicitamente para **adicionar, registrar ou sincronizar novas transações** na planilha, responda com o bloco JSON oficial da rota \`POST /api/v1/public/transactions/batch-sync\` ou com o bloco CSV de colagem direta:

### 1. Formato JSON Function Calling (Padrão API Assistente Moeda)
Para transação única:
\`\`\`json
{
  "action": "add_transaction",
  "parameters": {
    "description": "${sampleDesc}",
    "value": ${sampleVal.toFixed(2)},
    "date": "${sampleDate}",
    "period_start": "${sampleDate}",
    "period_end": "${sampleDate}"
  }
}
\`\`\`

Para lote de transações / extratos / faturas:
\`\`\`json
{
  "action": "bulk_add_transactions",
  "parameters": {
    "transactions": [
      { "description": "${sampleDesc}", "value": ${sampleVal.toFixed(2)}, "date": "${sampleDate}", "category": "${sampleCat}" }
    ]
  }
}
\`\`\`

### 2. Formato CSV para Colagem Direta ("📋 Colar Texto CSV" na Aba Planilha)
\`\`\`csv
Data;Valor;Descrição;Tipo;Categoria;Início;Fim
${sampleDate};${sampleVal.toFixed(2)};${sampleDesc};${sampleType};${sampleCat};${sampleRow?.periodStart || ''};${sampleRow?.periodEnd || ''}
\`\`\`
> **Regras estritas**: Despesas = números **NEGATIVOS** (ex: \`-120.00\`); Receitas = números **POSITIVOS** (ex: \`2500.00\`). Vigências periódicas em transação única com \`period_start\` e \`period_end\`. Omitir IDs manuais.`;
}

// ── Core Analytical Context Builder (100% Parity with context_builder.py) ───

export function buildLocalAnalysisContext(
  rows: TableRow[],
  goals: TableGoals,
  tableName = 'Planilha Principal',
  options?: Partial<ManualSynthesisOptions>,
): {
  markdown: string;
  whatsappReport: string;
  metrics: TableMetrics;
  effectiveRows: TableRow[];
  ledgerTier: 1 | 2 | 3 | 4;
  expenseCategories: CategoryAccrualSummary[];
  revenueCategories: CategoryAccrualSummary[];
} {
  const anonymize = Boolean(options?.anonymizeDescriptions);
  const effectiveTableName = anonymize
    ? 'Planilha Auditada (Modo Clean-Room LGPD)'
    : tableName;
  const selectedMonth =
    options?.selectedMonth && options.selectedMonth !== 'all'
      ? options.selectedMonth
      : undefined;
  const asOfDate = options?.asOfDate || new Date().toISOString().slice(0, 10);

  // Sanitize full history first so global metrics (timeBankBalance, globalGoalBalance, byYear) are never truncated by selectedMonth
  const allSanitizedRows = sanitizeRowsForManualSynthesis(rows, anonymize);
  const metrics = computeMetrics(allSanitizedRows, goals, asOfDate);

  // Filter by selectedMonth if requested for scoped ledger/category views (including multi-day rows that overlap the selected month)
  const effectiveRows = selectedMonth
    ? allSanitizedRows.filter((r) => {
        if (r.date && r.date.startsWith(selectedMonth)) return true;
        if (r.periodStart && r.periodEnd) {
          const mStart = `${selectedMonth}-01`;
          const mEnd = `${selectedMonth}-31`;
          return r.periodStart <= mEnd && r.periodEnd >= mStart;
        }
        return false;
      })
    : allSanitizedRows;

  // Sort real rows chronologically
  const sortedRows = [...effectiveRows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const realRows = sortedRows.filter((r) => r.generatedBy === undefined);
  const syntheticRows = sortedRows.filter((r) => r.generatedBy !== undefined);

  // Counts by entryType
  const counts = {
    revenue: 0,
    expense: 0,
    deposit: 0,
    waiver: 0,
    partner_in: 0,
    partner_out: 0,
    unresolved: 0,
  };
  for (const r of realRows) {
    const et = (r.entryType || 'revenue') as keyof typeof counts;
    if (et in counts) {
      counts[et] += 1;
    } else {
      counts.revenue += 1;
    }
  }

  const minDate = sortedRows[0]?.date || asOfDate;
  const maxDate = sortedRows[sortedRows.length - 1]?.date || asOfDate;
  const activeMonthsCount = Math.max(1, Object.keys(metrics.byMonth).length);

  // Current / Reference Year & Month Goals
  const refYearMonth = selectedMonth || asOfDate.slice(0, 7);
  const [refYear, refMonth] = refYearMonth.split('-').map(Number);
  const effGoals = getEffectiveGoals({ year: refYear, month: refMonth }, goals);
  const activeDailyGoal = effGoals.dailyGoal || resolveGoalForYear(goals.dailyGoals, refYear);
  const activeWeeklyGoal = effGoals.weeklyGoal || resolveGoalForYear(goals.weeklyGoals, refYear);
  const activeAnnualCost = effGoals.annualCost || resolveGoalForYear(goals.annualCosts, refYear);

  // Accrual Category Summaries
  const expenseCategories = buildAccrualCategorySummaries(
    effectiveRows,
    'expense',
    activeMonthsCount,
    anonymize,
  );
  const revenueCategories = buildAccrualCategorySummaries(
    effectiveRows,
    'revenue',
    activeMonthsCount,
    anonymize,
  );

  // Determine Ledger Tier based on row count
  const totalRowCount = sortedRows.length;
  const ledgerTier: 1 | 2 | 3 | 4 =
    totalRowCount <= 200
      ? 1
      : totalRowCount <= 1000
      ? 2
      : totalRowCount <= 5000
      ? 3
      : 4;

  const lines: string[] = [];

  // ── 1. VISÃO GERAL & METADADOS DA PLANILHA ──
  lines.push(`# 📊 SÍNTESE EXECUTIVA AI-ANALYST — ${effectiveTableName.toUpperCase()}`);
  lines.push(`- **Data de Referência da Auditoria**: \`${asOfDate}\``);
  lines.push(
    `- **Escopo Temporal**: ${
      selectedMonth ? `Mês Filtrado (\`${selectedMonth}\`)` : `Histórico Completo (\`${minDate}\` até \`${maxDate}\`)`
    }`,
  );
  lines.push(
    `- **Modo de Privacidade**: ${
      anonymize
        ? '🛡️ Anonimizado (LGPD / Modo Rua — Descrições pessoais ocultadas)'
        : '🔓 Completo (Descrições e categorias originais preservadas)'
    }`,
  );
  lines.push(
    `- **Volume de Registros**: **${totalRowCount}** lançamentos totais (${realRows.length} reais | ${syntheticRows.length} projetados/clonados)`,
  );
  lines.push(
    `- **Composição por Tipo (Reais)**: Receitas: ${counts.revenue} | Despesas: ${counts.expense} | Aportes/Investimentos: ${counts.deposit} | Abonos (Waivers): ${counts.waiver} | Parceria Entrada: ${counts.partner_in} | Parceria Saída: ${counts.partner_out}${
      counts.unresolved > 0 ? ` | ⚠️ Pendentes/Quarentena: ${counts.unresolved}` : ''
    }`,
  );
  lines.push('');

  // ── 2. METAS CONFIGURADAS & PONTO DE EQUILÍBRIO (BREAK-EVEN) ──
  lines.push(`## 🎯 1. METAS CONFIGURADAS & PONTO DE EQUILÍBRIO (BREAK-EVEN)`);
  lines.push(`### 1.1 Metas Hierárquicas Ativas (Ref: ${refYearMonth})`);
  lines.push(`- **Meta Diária Efetiva**: **${fmtBRL(activeDailyGoal)}**`);
  lines.push(`- **Meta Semanal Efetiva**: **${fmtBRL(activeWeeklyGoal)}**`);
  lines.push(`- **Meta Mensal Estimada (4,33 sem)**: **${fmtBRL(activeWeeklyGoal * 4.333)}**`);
  lines.push(`- **Custo Estrutural Anual Configurado**: **${fmtBRL(activeAnnualCost)}**`);

  if (metrics.totalExpenses > 0) {
    lines.push(`### 1.2 Ponto de Equilíbrio Operacional Real (Metas de Sobrevivência / Break-Even)`);
    lines.push(
      `*(Calculado dinamicamente sobre a vida útil das despesas reais registradas na planilha)*`,
    );
    lines.push(`- **Custo de Sobrevivência Diário (Break-Even Diário)**: **${fmtBRL(metrics.survivalDaily)}**`);
    lines.push(`- **Custo de Sobrevivência Semanal (Break-Even Semanal)**: **${fmtBRL(metrics.survivalWeekly)}**`);
    lines.push(`- **Custo de Sobrevivência Mensal (Break-Even Mensal — Competência)**: **${fmtBRL(metrics.survivalMonthly)}**`);
    lines.push(`- **Custo Operacional Anualizado Projetado (12m)**: **${fmtBRL(metrics.survivalAnnualCost)}**`);
    if (activeWeeklyGoal > 0 && metrics.survivalWeekly > 0) {
      const safetySpread = activeWeeklyGoal - metrics.survivalWeekly;
      const spreadPct = ((activeWeeklyGoal / metrics.survivalWeekly - 1) * 100);
      lines.push(
        `- **Spread de Segurança (Meta Semanal vs. Sobrevivência Semanal)**: **${fmtBRL(safetySpread)}/semana** (${fmtPct(spreadPct)} acima do break-even)`,
      );
    }
  }
  lines.push('');

  // ── 3. DRE CONSOLIDADA & TOTAIS OPERACIONAIS ──
  const operationalMarginPct =
    metrics.grossTotal > 0 ? (metrics.netBalance / metrics.grossTotal) * 100 : 0;
  const refYearExpenses = metrics.byYear[String(refYear)]?.yearExpenses ?? metrics.annualExpenses;

  lines.push(`## 💰 2. DRE CONSOLIDADA & TOTAIS OPERACIONAIS (CAPACIDADE PRÓPRIA)`);
  lines.push(`- **Receita Operacional Bruta (Própria)**: **${fmtBRL(metrics.grossTotal)}**`);
  lines.push(`- **Total de Custos e Despesas Operacionais (Acumulado)**: **${fmtBRL(metrics.totalExpenses)}**`);
  lines.push(`- **Despesas Rateadas no Ano Corrente (${refYear})**: **${fmtBRL(refYearExpenses)}**`);
  lines.push(
    `- **Resultado Operacional Líquido (Receita - Despesas)**: **${fmtBRL(metrics.netBalance)}** (${
      metrics.netBalance >= 0 ? '🟢 SUPERÁVIT OPERACIONAL' : '🔴 DÉFICIT OPERACIONAL'
    })`,
  );
  lines.push(`- **Margem Operacional Líquida**: **${fmtPct(operationalMarginPct)}**`);
  lines.push('');

  // ── 4. ISOLAMENTO DE PARCERIAS (PASSTHROUGH NETTING) ──
  if (metrics.totalPartnerIn > 0 || metrics.totalPartnerOut > 0) {
    const partnerNet = metrics.totalPartnerIn - metrics.totalPartnerOut;
    lines.push(`## 🤝 3. CONTROLADORIA DE PARCERIAS & SÓCIOS (ISOLAMENTO PASSTHROUGH)`);
    lines.push(
      `> **Nota de Auditoria (GAAP)**: Valores de parceria (\`partner_in\` / \`partner_out\`) são isolados da Receita Bruta Própria para não distorcer sua média de produtividade diária/semanal.`,
    );
    lines.push(`- **Entradas de Parceria / Reembolsos (\`partner_in\`)**: **${fmtBRL(metrics.totalPartnerIn)}**`);
    lines.push(`- **Saídas de Parceria / Repasses (\`partner_out\`)**: **${fmtBRL(metrics.totalPartnerOut)}**`);
    lines.push(
      `- **Saldo Líquido de Parceria (Net Passthrough)**: **${fmtBRL(partnerNet)}** (${
        Math.abs(partnerNet) < 0.01
          ? '100% Conciliado / Anulado'
          : partnerNet > 0
          ? 'Crédito Retido de Parceria'
          : 'Pendente de Reembolso pelo Sócio'
      })`,
    );
    lines.push(`- **Receita Combinada (Própria + Parceria)**: ${fmtBRL(metrics.grossWithPartner)}`);
    lines.push(`- **Despesa Combinada (Própria + Parceria)**: ${fmtBRL(metrics.expensesWithPartner)}`);
    lines.push(`- **Caixa Líquido Combinado (c/ Parceria)**: **${fmtBRL(metrics.netWithPartner)}**`);
    lines.push('');
  }

  // ── 5. MÉDIAS GLOBAIS & ESTATÍSTICAS AVANÇADAS ──
  const positiveRevCount = allSanitizedRows.filter(
    (r) =>
      r.generatedBy === undefined &&
      (r.entryType === 'revenue' || !r.entryType) &&
      r.value > 0,
  ).length;
  const meanTransaction = positiveRevCount > 0 ? metrics.grossTotal / positiveRevCount : 0;
  const cvPct =
    meanTransaction > 0 ? (metrics.stdDeviation / meanTransaction) * 100 : 0;
  const medianToMeanRatio =
    meanTransaction > 0 ? (metrics.medianTransaction / meanTransaction) * 100 : 0;

  lines.push(`## 📈 4. MÉDIAS DE PRODUTIVIDADE & ESTATÍSTICAS AVANÇADAS`);
  lines.push(`### 4.1 Médias Operacionais Globais`);
  lines.push(`- **Média Diária Global (dias ativos)**: **${fmtBRL(metrics.globalDailyAvg)}**`);
  lines.push(`- **Média Semanal Global**: **${fmtBRL(metrics.globalWeeklyAvg)}**`);
  lines.push(`- **Média Mensal Global (${activeMonthsCount} meses ativos)**: **${fmtBRL(metrics.globalMonthlyAvg)}**`);
  lines.push(`- **Projeção Anualizada por Ritmo Atual**: **${fmtBRL(metrics.globalAnnualAvg)}**`);

  lines.push(`### 4.2 Distribuição Estatística de Receitas (Rigor Quantitativo)`);
  lines.push(`- **Mediana (Ganho Típico Estável — imune a outliers)**: **${fmtBRL(metrics.medianTransaction)}**`);
  lines.push(`- **Moda (Ticket/Ganho Mais Recorrente)**: **${fmtBRL(metrics.modeTransaction)}**`);
  lines.push(`- **Desvio Padrão (Volatilidade / Oscilação Monetária)**: **${fmtBRL(metrics.stdDeviation)}**`);
  lines.push(`- **Maior Receita Registrada (Max)**: **${fmtBRL(metrics.maxTransaction)}**`);
  lines.push(`- **Menor Receita Positiva (Min)**: **${fmtBRL(metrics.minTransaction)}**`);
  lines.push(
    `- **Índice de Dispersão (Coeficiente de Variação CV)**: **${fmtPct(cvPct)}** | Relação Mediana/Média: **${fmtPct(medianToMeanRatio)}**`,
  );
  lines.push('');

  // ── 6. BALANÇO ESTRITO DE METAS & BANCO DE TEMPO (BURNOUT SHIELD) ──
  const repositionWeeks =
    activeWeeklyGoal > 0 ? metrics.globalGoalBalance / activeWeeklyGoal : 0;

  lines.push(`## ⏱️ 5. BALANÇO ESTRITO DE METAS & BANCO DE TEMPO (BURNOUT SHIELD)`);
  lines.push(`- **Semanas Totais Decorridas no Histórico**: **${metrics.totalElapsedWeeks}** semanas`);
  lines.push(
    `- **Semanas Abonadas / Justificadas (Waivers)**: **${metrics.waivedWeeks.toFixed(2)}** semanas (Crédito Monetário Abonado: **${fmtBRL(metrics.totalWaiverCredit)}**)`,
  );
  lines.push(`- **Semanas Efetivamente Cobráveis**: **${metrics.billableWeeks.toFixed(2)}** semanas`);
  lines.push(
    `- **Saldo Global Estrito da Meta (Strict Goal Balance)**: **${fmtBRL(metrics.globalGoalBalance)}** (${
      metrics.globalGoalBalance >= 0 ? '🏆 SUPERÁVIT ACUMULADO' : '⚠️ DÉFICIT DE META ACUMULADO'
    })`,
  );
  lines.push(
    `- **Saldo do Banco de Tempo**: **${metrics.timeBankBalance >= 0 ? '+' : ''}${metrics.timeBankBalance.toFixed(2)} semanas**`,
  );
  lines.push(
    `- **Semanas Equivalentes de Folga / Reposição (Liquid Math @ ${fmtBRL(activeWeeklyGoal)}/sem)**: **${
      repositionWeeks >= 0 ? '+' : ''
    }${repositionWeeks.toFixed(2)} semanas**`,
  );
  lines.push(
    `- **Equivalência Histórica em Semanas**: Produzido: ${metrics.grossTotalWeeks.toFixed(2)} sem | Abonado: ${metrics.waiverTotalWeeks.toFixed(2)} sem | Exigido pela Meta: ${metrics.goalTotalWeeks.toFixed(2)} sem | Saldo Líquido: ${metrics.netBalanceWeeks.toFixed(2)} sem`,
  );
  lines.push('');

  // ── 7. DESEMPENHO DO MÊS DE REFERÊNCIA & HISTÓRICO ANUAL ──
  const currentMonthMetrics = metrics.byMonth[refYearMonth];
  lines.push(`## 🗓️ 6. DESEMPENHO DO MÊS DE REFERÊNCIA (${refYearMonth}) & HISTÓRICO ANUAL`);
  if (currentMonthMetrics) {
    const monthExp = currentMonthMetrics.expense ?? 0;
    const monthNet = currentMonthMetrics.grossMonthly - monthExp;
    const dailyGoalPct =
      activeDailyGoal > 0 ? (currentMonthMetrics.dailyAvg / activeDailyGoal) * 100 : 0;
    lines.push(`### 6.1 Resumo do Mês \`${refYearMonth}\``);
    lines.push(`- **Receita Bruta do Mês**: **${fmtBRL(currentMonthMetrics.grossMonthly)}**`);
    lines.push(`- **Despesas Rateadas no Mês (Competência)**: **${fmtBRL(monthExp)}**`);
    lines.push(`- **Saldo Líquido do Mês**: **${fmtBRL(monthNet)}**`);
    lines.push(
      `- **Média Diária no Mês**: **${fmtBRL(currentMonthMetrics.dailyAvg)}** (${fmtPct(dailyGoalPct)} da Meta Diária)`,
    );
    lines.push(`- **Média Semanal no Mês**: **${fmtBRL(currentMonthMetrics.weeklyAvg)}**`);
    lines.push(`- **Faturamento da Última Semana do Mês**: **${fmtBRL(currentMonthMetrics.lastWeekGross)}**`);
  } else {
    lines.push(`- *Sem movimentações operacionais registradas especificamente no mês \`${refYearMonth}\`.*`);
  }

  const sortedYears = Object.keys(metrics.byYear).sort();
  if (sortedYears.length > 0) {
    lines.push(`### 6.2 Consolidado Anual (DRE por Ano Calendário)`);
    for (const yr of sortedYears) {
      const ym = metrics.byYear[yr];
      const yrNet = ym.grossAnnual - ym.yearExpenses;
      lines.push(
        `- **Ano ${yr}**: Receita Bruta: **${fmtBRL(ym.grossAnnual)}** | Despesas (Competência): **${fmtBRL(
          ym.yearExpenses,
        )}** | Saldo Líquido: **${fmtBRL(yrNet)}** | Média Diária: ${fmtBRL(
          ym.dailyAvg,
        )} | Média Semanal: ${fmtBRL(ym.weeklyAvg)} | Média Mensal: ${fmtBRL(ym.monthlyAvg)}`,
      );
    }
  }
  lines.push('');

  // ── 8. ANATOMIA DE CATEGORIAS POR REGIME DE COMPETÊNCIA (ACCRUAL BASIS) ──
  lines.push(`## 🔬 7. ANATOMIA DE CATEGORIAS POR REGIME DE COMPETÊNCIA (FREQUÊNCIA vs. VOLUME)`);
  if (expenseCategories.length > 0) {
    lines.push(
      `### 7.1 Radiografia de Custos & Despesas (Ordenado por Volume Monetário Rateado)`,
    );
    for (const cat of expenseCategories.slice(0, 20)) {
      const descSample =
        !anonymize && cat.sampleDescriptions.length > 0
          ? ` | Ex: *${cat.sampleDescriptions.slice(0, 3).join(', ')}*`
          : '';
      lines.push(
        `- **${cat.category}** (${cat.rawLaunchCount}x): Total Rateado: **${fmtBRL(
          cat.totalAccruedValue,
        )}** (**${fmtPct(cat.sharePercentage)}**) | Média/Lanç: ${fmtBRL(
          cat.meanLaunchValue,
        )} | Mediana: ${fmtBRL(cat.medianLaunchValue)} | DP: ${fmtBRL(
          cat.stdDevLaunchValue,
        )} | Max: ${fmtBRL(cat.maxLaunchValue)} | Min: ${fmtBRL(
          cat.minLaunchValue,
        )} | Diária (Competência): ${fmtBRL(cat.accrualDailyRate)} | Semanal: ${fmtBRL(
          cat.accrualWeeklyRate,
        )} | Média em meses ativos (${cat.activeMonthsCount}m): ${fmtBRL(
          cat.avgPerActiveMonth,
        )}/mês${descSample}`,
      );
    }

    const byFrequency = [...expenseCategories].sort(
      (a, b) => b.rawLaunchCount - a.rawLaunchCount,
    );
    lines.push(`### 7.2 Top Categorias de Despesa por Frequência de Uso (Hábito Repetitivo)`);
    for (const cat of byFrequency.slice(0, 5)) {
      lines.push(
        `- **${cat.category}**: **${cat.rawLaunchCount} lançamentos** — Volume Acumulado: **${fmtBRL(
          cat.totalAccruedValue,
        )}** (Ticket Médio por Lançamento: ${fmtBRL(
          cat.totalAccruedValue / Math.max(1, cat.rawLaunchCount),
        )})`,
      );
    }
  } else {
    lines.push(`- *Nenhuma despesa operacional registrada para decomposição por categorias.*`);
  }

  if (revenueCategories.length > 0) {
    lines.push(`### 7.3 Composição de Fontes de Receita Operacional`);
    for (const cat of revenueCategories.slice(0, 12)) {
      lines.push(
        `- **${cat.category}** (${cat.rawLaunchCount}x): **${fmtBRL(
          cat.totalAccruedValue,
        )}** (**${fmtPct(cat.sharePercentage)}**) | Média/Lanç: ${fmtBRL(
          cat.meanLaunchValue,
        )} | Mediana: ${fmtBRL(cat.medianLaunchValue)} | DP: ${fmtBRL(
          cat.stdDevLaunchValue,
        )} | Diária (Competência): ${fmtBRL(cat.accrualDailyRate)} | Semanal: ${fmtBRL(
          cat.accrualWeeklyRate,
        )} | Média em meses ativos: ${fmtBRL(cat.avgPerActiveMonth)}/mês`,
      );
    }
  }
  lines.push('');

  // ── 9. PORTFÓLIO DE INVESTIMENTOS & PATRIMÔNIO (BENCHMARK CDI 0,8% A.M.) ──
  lines.push(`## 🏦 8. PORTFÓLIO DE INVESTIMENTOS & JUROS COMPOSTOS (BENCHMARK CDI 0,8% A.M.)`);
  if (metrics.depositCount > 0 || options?.investorProfile) {
    lines.push(`- **Quantidade de Aportes Realizados**: **${metrics.depositCount}**`);
    lines.push(`- **Capital Principal Investido**: **${fmtBRL(metrics.totalInvested)}**`);
    lines.push(`- **Rendimento Composto Acumulado (0,8% a.m.)**: **${fmtBRL(metrics.totalInterestEarned)}**`);
    lines.push(`- **Saldo Patrimonial Total do Portfólio**: **${fmtBRL(metrics.investmentBalance)}**`);

    if (metrics.survivalMonthly > 0 && metrics.investmentBalance > 0) {
      const runwayMonths = metrics.investmentBalance / metrics.survivalMonthly;
      lines.push(
        `- **Runway / Cobertura de Sobrevivência Atual**: **${runwayMonths.toFixed(1)} meses** de custos operacionais cobertos pelo portfólio`,
      );
    }

    if (options?.investorProfile) {
      const ip = options.investorProfile;
      lines.push(
        `- **Perfil de Investidor Configurado**: \`${ip.profileType.toUpperCase()}\` | Meta de Reserva de Emergência: **${
          ip.emergencyFundMonthsGoal
        } meses** | Multiplicador FIRE: **${ip.fireTargetAnnualExpensesMultiplier}x custos anuais**${
          ip.monthlyContributionGoal
            ? ` | Meta de Aporte Mensal: **${fmtBRL(ip.monthlyContributionGoal)}**`
            : ''
        }`,
      );
    }

    if (metrics.portfolioTimeline.length > 0) {
      lines.push(`### Evolução Recente do Portfólio (Últimos 6 Meses)`);
      for (const pt of metrics.portfolioTimeline.slice(-6)) {
        lines.push(
          `- **${pt.month}**: Aporte no Mês: ${fmtBRL(pt.monthlyDeposit)} | Juros no Mês: ${fmtBRL(
            pt.currentMonthYield,
          )} | Principal Acumulado: ${fmtBRL(pt.accumulatedPrincipal)} | Saldo Total: **${fmtBRL(
            pt.totalBalance,
          )}**`,
        );
      }
    }
  } else {
    lines.push(`- *Nenhum aporte de investimento (\`deposit\`) registrado até o momento.*`);
  }
  lines.push('');

  // ── 10. PARÂMETROS SETORIAIS & SIMULADORES ATIVOS (LOCAL ENRICHMENT) ──
  if (
    (options?.activeSectors && options.activeSectors.length > 0) ||
    options?.sectorParams
  ) {
    const sp = options?.sectorParams;
    lines.push(`## ⚙️ 9. PARÂMETROS OPERACIONAIS & SETORIAIS DO USUÁRIO`);
    if (options?.activeSectors && options.activeSectors.length > 0) {
      lines.push(`- **Módulos Setoriais Ativos**: ${options.activeSectors.join(', ')}`);
    }
    if (sp) {
      if (sp.hoursWorkedPerWeek || sp.commuteHoursPerWeek) {
        const totalWeeklyHours = (sp.hoursWorkedPerWeek || 0) + (sp.commuteHoursPerWeek || 0);
        const netHourlyRate =
          totalWeeklyHours > 0
            ? (metrics.globalWeeklyAvg - metrics.survivalWeekly) / totalWeeklyHours
            : 0;
        const grossHourlyRate =
          totalWeeklyHours > 0 ? metrics.globalWeeklyAvg / totalWeeklyHours : 0;
        lines.push(
          `- **Jornada Semanal Declarada**: ${sp.hoursWorkedPerWeek || 0}h trabalho + ${
            sp.commuteHoursPerWeek || 0
          }h deslocamento = **${totalWeeklyHours}h/semana** (Valor Hora Bruto: **${fmtBRL(
            grossHourlyRate,
          )}/h** | Valor Hora Líquido pós-custos: **${fmtBRL(netHourlyRate)}/h**)`,
        );
      }
      if (sp.monthlyKm || sp.kmPerLiter || sp.fuelPricePerLiter || sp.vehicleValueBRL) {
        lines.push(
          `- **Parâmetros de Frota/Veículo**: Valor Veículo: ${fmtBRL(
            sp.vehicleValueBRL || 0,
          )} | Rodagem Mensal: ${sp.monthlyKm || 0} km | Consumo: ${
            sp.kmPerLiter || 0
          } km/L | Combustível: ${fmtBRL(sp.fuelPricePerLiter || 0)}/L`,
        );
      }
      if (sp.pmrDays !== undefined || sp.pmeDays !== undefined || sp.pmpDays !== undefined) {
        lines.push(
          `- **Ciclo de Capital de Giro PME**: PMR (Recebimento): ${
            sp.pmrDays ?? 0
          }d | PME (Estoque): ${sp.pmeDays ?? 0}d | PMP (Pagamento): ${sp.pmpDays ?? 0}d`,
        );
      }
    }
    lines.push('');
  }

  // ── 11. CENÁRIOS PROJETADOS & HISTÓRICO SEMANAL ──
  const scenarioCtx = buildAIScenarioContext(effectiveRows);
  if (scenarioCtx) {
    lines.push(`## 🔮 10. CENÁRIOS PROJETADOS (SIMULAÇÕES FUTURAS)`);
    lines.push(scenarioCtx);
    lines.push('');
  }

  const sortedWeekMondays = Object.keys(metrics.byWeek).sort();
  if (sortedWeekMondays.length > 0) {
    lines.push(`## 📅 11. DESEMPENHO SEMANAL CONSOLIDADO (${sortedWeekMondays.length} SEMANAS ATIVAS)`);
    const weeksToDisplay =
      sortedWeekMondays.length <= 20
        ? sortedWeekMondays
        : sortedWeekMondays.slice(-12);

    if (sortedWeekMondays.length > 20) {
      const olderWeeks = sortedWeekMondays.slice(0, sortedWeekMondays.length - 12);
      const olderSum = olderWeeks.reduce((acc, wk) => acc + (metrics.byWeek[wk] || 0), 0);
      lines.push(
        `- **Histórico Anterior Comprimido (${olderWeeks.length} semanas: \`${olderWeeks[0]}\` a \`${
          olderWeeks[olderWeeks.length - 1]
        }\`)**: Receita Acumulada = **${fmtBRL(olderSum)}** (Média: ${fmtBRL(
          olderSum / olderWeeks.length,
        )}/semana)`,
      );
      lines.push(`### Últimas 12 Semanas Detalhadas:`);
    }

    for (const mondayKey of weeksToDisplay) {
      const wkRev = metrics.byWeek[mondayKey] || 0;
      const monDate = new Date(mondayKey + 'T12:00:00');
      const sunDate = getSundayOf(monDate);
      const sunKey = toLocalKey(sunDate);
      const wkGoal = getWeeklyGoalForDate(sunKey, goals);
      const delta = wkRev - wkGoal;
      lines.push(
        `- **Semana \`${mondayKey}\` a \`${sunKey}\`**: Faturamento: **${fmtBRL(
          wkRev,
        )}** | Meta: ${fmtBRL(wkGoal)} | Saldo Semanal: **${delta >= 0 ? '+' : ''}${fmtBRL(
          delta,
        )}**`,
      );
    }
    lines.push('');
  }

  // ── 11.5 RELATÓRIO EXECUTIVO WHATSAPP DA PLANILHA ATUAL ──
  const whatsappReport = buildLocalWhatsAppReportText(
    effectiveTableName,
    metrics,
    goals,
    refYearMonth,
    allSanitizedRows,
  );
  lines.push(`## 📱 12. RELATÓRIO EXECUTIVO WHATSAPP (EXTRAÍDO DA PLANILHA ATUAL)`);
  lines.push('```text');
  lines.push(whatsappReport);
  lines.push('```');
  lines.push('');

  // ── 13. RAZÃO ANALÍTICO DE LANÇAMENTOS (4-TIER CASCADE COMPRESSION) ──
  lines.push(
    `## 🧾 13. RAZÃO ANALÍTICO DE LANÇAMENTOS (\`/api/v1/public/transactions\` — TIER ${ledgerTier} — ${totalRowCount} REGISTROS)`,
  );

  if (totalRowCount === 0) {
    lines.push(`- *Nenhum lançamento registrado na planilha.*`);
  } else if (ledgerTier === 1) {
    lines.push(
      `*(Tier 1 Ativo: Como a planilha possui ≤ 200 registros, 100% dos lançamentos estão listados integralmente abaixo)*`,
    );
    lines.push(`| Data | Tipo | Valor | Categoria | Descrição | Vigência / Período |`);
    lines.push(`| :--- | :--- | ---: | :--- | :--- | :--- |`);
    for (const r of sortedRows) {
      const et = r.entryType || 'revenue';
      const signedVal = et === 'expense' || et === 'partner_out' ? -Math.abs(r.value) : r.value;
      const cat = normalizeCategoryName(r, anonymize);
      const desc = (r.description || '—').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
      const period =
        r.periodStart && r.periodEnd && r.periodStart !== r.periodEnd
          ? `${r.periodStart} → ${r.periodEnd}`
          : 'Pontual';
      lines.push(
        `| ${r.date} | \`${et}\` | ${fmtBRL(signedVal)} | ${cat} | ${desc} | ${period} |`,
      );
    }
  } else {
    // Tiers 2, 3, 4: Monthly Consolidated Matrix + Top Structural Entries + Recent Granular Tail
    const recentTailLimit = ledgerTier === 2 ? 150 : ledgerTier === 3 ? 100 : 60;
    const olderSlice = sortedRows.slice(0, Math.max(0, totalRowCount - recentTailLimit));
    const recentSlice = sortedRows.slice(-recentTailLimit);

    lines.push(
      `*(Tier ${ledgerTier} de Compressão Inteligente Ativo para preservar janela de contexto: Matriz Mensal Consolidada dos primeiros ${olderSlice.length} registros + Top Maiores Impactos + Listagem Granular Completa dos últimos ${recentSlice.length} lançamentos)*`,
    );

    // Monthly Matrix of all rows
    const monthlyAgg = new Map<
      string,
      { rev: number; exp: number; dep: number; count: number }
    >();
    for (const r of sortedRows) {
      const ym = (r.date || '').slice(0, 7) || 'Sem-Data';
      const cur = monthlyAgg.get(ym) || { rev: 0, exp: 0, dep: 0, count: 0 };
      const et = r.entryType || 'revenue';
      if (et === 'expense') cur.exp += Math.abs(r.value);
      else if (et === 'deposit') cur.dep += Math.abs(r.value);
      else if (et === 'revenue') cur.rev += r.value;
      cur.count += 1;
      monthlyAgg.set(ym, cur);
    }

    lines.push(`### 13.1 Matriz Histórica Mensal (Fluxo de Caixa)`);
    lines.push(`| Mês (YYYY-MM) | Qtd | Receita Caixa | Despesa Lançada | Aportes | Saldo Caixa |`);
    lines.push(`| :--- | ---: | ---: | ---: | ---: | ---: |`);
    for (const [ym, data] of Array.from(monthlyAgg.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      lines.push(
        `| \`${ym}\` | ${data.count} | ${fmtBRL(data.rev)} | ${fmtBRL(data.exp)} | ${fmtBRL(
          data.dep,
        )} | ${fmtBRL(data.rev - data.exp)} |`,
      );
    }

    // Top 15 largest expenses across history
    const topExpenses = [...sortedRows]
      .filter((r) => r.entryType === 'expense')
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 15);
    if (topExpenses.length > 0) {
      lines.push(`### 13.2 Top ${topExpenses.length} Maiores Despesas Estruturais do Histórico`);
      for (const r of topExpenses) {
        const period =
          r.periodStart && r.periodEnd ? ` (Vigência: ${r.periodStart} a ${r.periodEnd})` : '';
        lines.push(
          `- \`${r.date}\` | **${fmtBRL(-Math.abs(r.value))}** | [${normalizeCategoryName(
            r,
            anonymize,
          )}] ${r.description || 'Sem descrição'}${period}`,
        );
      }
    }

    // Recent granular tail
    lines.push(`### 13.3 Lançamentos Mais Recentes (${recentSlice.length} itens detalhados)`);
    lines.push(`| Data | Tipo | Valor | Categoria | Descrição | Vigência |`);
    lines.push(`| :--- | :--- | ---: | :--- | :--- | :--- |`);
    for (const r of recentSlice) {
      const et = r.entryType || 'revenue';
      const signedVal = et === 'expense' || et === 'partner_out' ? -Math.abs(r.value) : r.value;
      const cat = normalizeCategoryName(r, anonymize);
      const desc = (r.description || '—').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
      const period =
        r.periodStart && r.periodEnd && r.periodStart !== r.periodEnd
          ? `${r.periodStart} → ${r.periodEnd}`
          : 'Pontual';
      lines.push(
        `| ${r.date} | \`${et}\` | ${fmtBRL(signedVal)} | ${cat} | ${desc} | ${period} |`,
      );
    }
  }

  return {
    markdown: lines.join('\n'),
    whatsappReport,
    metrics,
    effectiveRows,
    ledgerTier,
    expenseCategories,
    revenueCategories,
  };
}

// ── XML Synthesis Builder (Optimized for Claude / o1 / o3 / DeepSeek-R1) ────

function buildXmlSynthesisDocument(
  tableName: string,
  options: ManualSynthesisOptions,
  analysis: ReturnType<typeof buildLocalAnalysisContext>,
): string {
  const profile = options.profile || 'native';
  const personaPrompt = buildManualPersonaPrompt(profile, tableName);
  const roundTrip = buildManualRoundTripInstructions(analysis.effectiveRows);
  const m = analysis.metrics;
  const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);

  const skillsXml = SKILLS_MANIFEST.map(
    (s) =>
      `    <skill id="${s.id}" name="${escapeXml(s.name)}">\n      <discipline>${escapeXml(
        s.discipline,
      )}</discipline>\n      <focus>${escapeXml(s.focus)}</focus>\n    </skill>`,
  ).join('\n');

  const expCatsXml = analysis.expenseCategories
    .slice(0, 20)
    .map(
      (c) =>
        `    <category name="${escapeXml(c.category)}" type="expense" accrued_brl="${c.totalAccruedValue.toFixed(
          2,
        )}" share_pct="${c.sharePercentage.toFixed(1)}" frequency_count="${
          c.rawLaunchCount
        }" active_months="${c.activeMonthsCount}" avg_active_month_brl="${c.avgPerActiveMonth.toFixed(
          2,
        )}" median_brl="${c.medianLaunchValue.toFixed(2)}" std_dev_brl="${c.stdDevLaunchValue.toFixed(
          2,
        )}" daily_accrual_brl="${c.accrualDailyRate.toFixed(2)}" weekly_accrual_brl="${c.accrualWeeklyRate.toFixed(
          2,
        )}" />`,
    )
    .join('\n');

  const revCatsXml = analysis.revenueCategories
    .slice(0, 12)
    .map(
      (c) =>
        `    <category name="${escapeXml(c.category)}" type="revenue" accrued_brl="${c.totalAccruedValue.toFixed(
          2,
        )}" share_pct="${c.sharePercentage.toFixed(1)}" frequency_count="${
          c.rawLaunchCount
        }" active_months="${c.activeMonthsCount}" median_brl="${c.medianLaunchValue.toFixed(
          2,
        )}" std_dev_brl="${c.stdDevLaunchValue.toFixed(2)}" />`,
    )
    .join('\n');

  const userQuestionXml = options.userCustomPrompt?.trim()
    ? `\n  <user_objective_and_question>\n${escapeXml(
        options.userCustomPrompt.trim(),
      )}\n  </user_objective_and_question>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<assistente_moeda_ai_analyst_synthesis version="3.1" mode="manual_offline_direct" generated_at="${new Date().toISOString()}" as_of_date="${asOfDate}">
  <spreadsheet_meta name="${escapeXml(tableName)}" total_rows="${analysis.effectiveRows.length}" ledger_tier="${analysis.ledgerTier}" anonymized="${Boolean(options.anonymizeDescriptions)}" scope="${options.selectedMonth || 'all'}" />

  <system_persona profile="${escapeXml(profile)}">
<![CDATA[
${escapeCdata(personaPrompt)}
]]>
  </system_persona>

  <financial_skills_matrix count="${SKILLS_MANIFEST.length}">
${skillsXml}
  </financial_skills_matrix>

  <dre_synthesis currency="BRL">
    <gross_operational_revenue>${m.grossTotal.toFixed(2)}</gross_operational_revenue>
    <total_operational_expenses>${m.totalExpenses.toFixed(2)}</total_operational_expenses>
    <current_year_prorated_expenses>${m.annualExpenses.toFixed(2)}</current_year_prorated_expenses>
    <net_operational_balance>${m.netBalance.toFixed(2)}</net_operational_balance>
    <survival_break_even daily="${m.survivalDaily.toFixed(2)}" weekly="${m.survivalWeekly.toFixed(2)}" monthly="${m.survivalMonthly.toFixed(2)}" annual="${m.survivalAnnualCost.toFixed(2)}" />
    <partnership_passthrough partner_in="${m.totalPartnerIn.toFixed(2)}" partner_out="${m.totalPartnerOut.toFixed(2)}" net_with_partner="${m.netWithPartner.toFixed(2)}" />
    <investments_cdi_portfolio deposits_count="${m.depositCount}" principal_invested="${m.totalInvested.toFixed(2)}" compound_interest_earned="${m.totalInterestEarned.toFixed(2)}" total_portfolio_balance="${m.investmentBalance.toFixed(2)}" />
  </dre_synthesis>

  <statistical_distribution currency="BRL">
    <global_daily_average>${m.globalDailyAvg.toFixed(2)}</global_daily_average>
    <global_weekly_average>${m.globalWeeklyAvg.toFixed(2)}</global_weekly_average>
    <global_monthly_average>${m.globalMonthlyAvg.toFixed(2)}</global_monthly_average>
    <median_typical_transaction>${m.medianTransaction.toFixed(2)}</median_typical_transaction>
    <mode_recurring_transaction>${m.modeTransaction.toFixed(2)}</mode_recurring_transaction>
    <std_deviation_volatility>${m.stdDeviation.toFixed(2)}</std_deviation_volatility>
    <max_transaction>${m.maxTransaction.toFixed(2)}</max_transaction>
    <min_positive_transaction>${m.minTransaction.toFixed(2)}</min_positive_transaction>
  </statistical_distribution>

  <weekly_timebank_and_goals>
    <elapsed_weeks>${m.totalElapsedWeeks}</elapsed_weeks>
    <waived_weeks>${m.waivedWeeks.toFixed(2)}</waived_weeks>
    <billable_weeks>${m.billableWeeks.toFixed(2)}</billable_weeks>
    <waiver_monetary_credit_brl>${m.totalWaiverCredit.toFixed(2)}</waiver_monetary_credit_brl>
    <strict_global_goal_balance_brl>${m.globalGoalBalance.toFixed(2)}</strict_global_goal_balance_brl>
    <time_bank_balance_weeks>${m.timeBankBalance.toFixed(2)}</time_bank_balance_weeks>
  </weekly_timebank_and_goals>

  <accrual_categories>
${expCatsXml}
${revCatsXml}
  </accrual_categories>

  <whatsapp_executive_report>
<![CDATA[
${escapeCdata(analysis.whatsappReport)}
]]>
  </whatsapp_executive_report>

  <analytical_context_markdown>
<![CDATA[
${escapeCdata(analysis.markdown)}
]]>
  </analytical_context_markdown>

  <manual_round_trip_protocol>
<![CDATA[
${escapeCdata(roundTrip)}
]]>
  </manual_round_trip_protocol>${userQuestionXml}
</assistente_moeda_ai_analyst_synthesis>`;
}

// ── Offline API Routes Bundle JSON Builder ──────────────────────────────────

function buildApiRoutesBundleJson(
  tableName: string,
  goals: TableGoals,
  options: ManualSynthesisOptions,
  analysis: ReturnType<typeof buildLocalAnalysisContext>,
): string {
  const profile = options.profile || 'native';
  const asOfDate = options.asOfDate || new Date().toISOString().slice(0, 10);
  const m = analysis.metrics;

  const csvLines = [
    'Data;Valor;Descrição;Tipo;Categoria;Início;Fim',
    ...analysis.effectiveRows.map((r) => {
      const signed = r.entryType === 'expense' || r.entryType === 'partner_out' ? -Math.abs(r.value) : r.value;
      const desc = neutralizeCsvFormula((r.description || '').replace(/;/g, ',').replace(/\r?\n/g, ' '));
      const cat = neutralizeCsvFormula(normalizeCategoryName(r, Boolean(options.anonymizeDescriptions)));
      return `${r.date};${signed.toFixed(2)};${desc};${r.entryType || 'revenue'};${cat};${r.periodStart || ''};${r.periodEnd || ''}`;
    }),
  ];

  const bundle = {
    _meta: {
      generator: 'Assistente Moeda — Local AI-Analyst Synthesizer v3.1',
      mode: 'offline_api_routes_mirror',
      generatedAt: new Date().toISOString(),
      asOfDate,
      tableName,
      anonymized: Boolean(options.anonymizeDescriptions),
      selectedMonth: options.selectedMonth || 'all',
      instructionForAI:
        'Este arquivo JSON contém o espelho exato de todas as rotas da API pública do Assistente Moeda (/agent-prompt, /ai-analyst, /analysis-context, /summary, /transactions, /spreadsheet/export e /whatsapp-report) extraídas diretamente da planilha atual do usuário no navegador.',
    },
    routes: {
      '/api/v1/public/agent-prompt': {
        status: 'ok',
        profile,
        skillsManifest: SKILLS_MANIFEST,
        systemPrompt: buildManualPersonaPrompt(profile, tableName),
      },
      '/api/v1/public/ai-analyst': {
        status: 'ok',
        mandatoryRoute: true,
        userPrompt:
          options.userCustomPrompt?.trim() ||
          'Realize o diagnóstico executivo completo da minha planilha atual usando as 8 skills financeiras.',
        executiveContextMarkdown: analysis.markdown,
        whatsappExecutiveReport: analysis.whatsappReport,
        roundTripProtocolMarkdown: buildManualRoundTripInstructions(analysis.effectiveRows),
      },
      '/api/v1/public/analysis-context': {
        status: 'ok',
        markdown: analysis.markdown,
      },
      '/api/v1/public/whatsapp-report': {
        status: 'ok',
        text: analysis.whatsappReport,
      },
      '/api/v1/public/summary': {
        status: 'ok',
        tableName,
        rowCount: analysis.effectiveRows.length,
        dre: {
          grossTotal: m.grossTotal,
          totalExpenses: m.totalExpenses,
          annualExpenses: m.annualExpenses,
          netBalance: m.netBalance,
          survivalDaily: m.survivalDaily,
          survivalWeekly: m.survivalWeekly,
          survivalMonthly: m.survivalMonthly,
          survivalAnnualCost: m.survivalAnnualCost,
        },
        averages: {
          globalDailyAvg: m.globalDailyAvg,
          globalWeeklyAvg: m.globalWeeklyAvg,
          globalMonthlyAvg: m.globalMonthlyAvg,
          globalAnnualAvg: m.globalAnnualAvg,
        },
        statistics: {
          medianTransaction: m.medianTransaction,
          modeTransaction: m.modeTransaction,
          stdDeviation: m.stdDeviation,
          maxTransaction: m.maxTransaction,
          minTransaction: m.minTransaction,
        },
        timeBankAndGoals: {
          globalGoalBalance: m.globalGoalBalance,
          timeBankBalance: m.timeBankBalance,
          totalElapsedWeeks: m.totalElapsedWeeks,
          waivedWeeks: m.waivedWeeks,
          billableWeeks: m.billableWeeks,
          totalWaiverCredit: m.totalWaiverCredit,
        },
        investments: {
          depositCount: m.depositCount,
          totalInvested: m.totalInvested,
          totalInterestEarned: m.totalInterestEarned,
          investmentBalance: m.investmentBalance,
        },
        partnerships: {
          totalPartnerIn: m.totalPartnerIn,
          totalPartnerOut: m.totalPartnerOut,
          netWithPartner: m.netWithPartner,
        },
        accrualCategories: {
          expenses: analysis.expenseCategories,
          revenues: analysis.revenueCategories,
        },
        configuredGoals: goals,
      },
      '/api/v1/public/transactions': {
        status: 'ok',
        count: analysis.effectiveRows.length,
        transactions: analysis.effectiveRows.map((r) => ({
          date: r.date,
          value: r.entryType === 'expense' ? -Math.abs(r.value) : r.value,
          entry_type: r.entryType || 'revenue',
          category: normalizeCategoryName(r, Boolean(options.anonymizeDescriptions)),
          description: r.description || '',
          period_start: r.periodStart || null,
          period_end: r.periodEnd || null,
          generated_by: r.generatedBy || null,
        })),
      },
      '/api/v1/public/spreadsheet/export': {
        status: 'ok',
        format: 'csv',
        csvContent: csvLines.join('\n'),
      },
    },
  };

  return JSON.stringify(bundle, null, 2);
}

// ── Main Entry Point: Build Any of the 4 Manual Synthesis Formats ───────────

export function generateManualAiAnalystSynthesis(
  rows: TableRow[],
  goals: TableGoals,
  tableName = 'Planilha Principal',
  options: ManualSynthesisOptions = { format: 'ai_analyst_full_md', profile: 'native' },
): GeneratedSynthesisResult {
  const format = options.format || 'ai_analyst_full_md';
  const profile = options.profile || 'native';
  const effectiveTableName = options.anonymizeDescriptions
    ? 'Planilha Auditada (Modo Clean-Room LGPD)'
    : tableName;
  const analysis = buildLocalAnalysisContext(rows, goals, effectiveTableName, options);

  let content = '';
  let extension: 'md' | 'xml' | 'json' = 'md';

  if (format === 'ai_analyst_full_md') {
    extension = 'md';
    const personaHeader = buildManualPersonaPrompt(profile, effectiveTableName);
    const roundTripFooter = buildManualRoundTripInstructions(analysis.effectiveRows);
    const customPromptSection = options.userCustomPrompt?.trim()
      ? `\n\n---\n## 💬 COMANDO / OBJETIVO ATUAL DO USUÁRIO\n\n> ${options.userCustomPrompt.trim()}\n\n*(Responda diretamente ao comando acima utilizando toda a Síntese Executiva \`AI-Analyst\` fornecida neste documento.)*`
      : `\n\n---\n## 💬 COMANDO INICIAL SUGERIDO AO AGENTE\n\n> Realize o diagnóstico executivo completo da minha planilha **"${effectiveTableName}"** em formato de Aula Executiva, cobrindo: (1) DRE & Ponto de Equilíbrio de Sobrevivência, (2) Estatísticas Avançadas (Mediana vs. Média e Volatilidade), (3) Anatomia de Despesas (Frequência vs. Volume Monetário), (4) Banco de Tempo & Metas, e (5) Plano de Ação com 3 a 5 recomendações práticas.`;

    content = `${personaHeader}\n\n---\n\n${analysis.markdown}\n\n${roundTripFooter}${customPromptSection}\n`;
  } else if (format === 'ai_analyst_xml') {
    extension = 'xml';
    content = buildXmlSynthesisDocument(effectiveTableName, options, analysis);
  } else if (format === 'analysis_context_md') {
    extension = 'md';
    const customPromptSection = options.userCustomPrompt?.trim()
      ? `\n\n---\n## 💬 OBJETIVO / PERGUNTA DO USUÁRIO\n\n${options.userCustomPrompt.trim()}\n`
      : '';
    content = `${analysis.markdown}${customPromptSection}\n`;
  } else if (format === 'api_routes_bundle_json') {
    extension = 'json';
    content = buildApiRoutesBundleJson(effectiveTableName, goals, options, analysis);
  }

  const charCount = content.length;
  const byteSize =
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(content).length
      : charCount;
  // ~4 chars per token heuristic for Portuguese/Markdown/Numeric text
  const estimatedTokens = Math.max(1, Math.ceil(charCount / 3.8));

  return {
    content,
    metadata: {
      format,
      profile,
      extension,
      charCount,
      byteSize,
      estimatedTokens,
      rowCount: analysis.effectiveRows.length,
      ledgerTier: analysis.ledgerTier,
      anonymized: Boolean(options.anonymizeDescriptions),
    },
  };
}

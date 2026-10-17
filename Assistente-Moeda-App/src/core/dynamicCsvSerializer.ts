/**
 * Dynamic CSV Serializer — Assistente Moeda
 *
 * Pure platform-agnostic serializer that exports tables into:
 *   - Backup v3 Standard: contains ## SCHEMA_COLUMNS ##, ## INVESTOR_PROFILE ##,
 *     and dynamic ## ROWS ## with 100% fidelity for custom and investment columns.
 *   - Legacy Semicolon CSV: fallback when no schema or metadata is provided.
 */

import type {
  TableRow,
  TableGoals,
  DynamicTableSchema,
  InvestorProfileConfig,
  GranularExportOptions,
  DashboardConfig,
  SectorSimulationParams,
} from './types';
import { neutralizeCsvFormula, redactApiKeyForExport } from '../utils/securitySanitizer';

export function serializeDynamicCSV(
  rows: TableRow[],
  tableName?: string,
  description?: string,
  goals?: TableGoals,
  tableId?: string,
  apiKey?: string | null,
  lastEventSeq?: number,
  schema?: DynamicTableSchema,
  investorProfile?: InvestorProfileConfig,
  activeSectors?: string[],
  dashboardConfig?: DashboardConfig,
  sectorParams?: SectorSimulationParams,
  includeSecretApiKey: boolean = false
): string {
  if (tableName || goals || tableId || schema || investorProfile || activeSectors || dashboardConfig || sectorParams) {
    const meta: string[] = ['## COIN ASSISTANT BACKUP v3 ##'];
    if (tableId) {
      meta.push(`table_id,${tableId}`);
    }

    // Security Gate (SEC-03): Never exfiltrate localStorage live API keys into shared CSV files
    // unless explicitly requested (includeSecretApiKey === true) or an explicit non-default apiKey was passed by a test/migration caller.
    const explicitKeyProvided = typeof apiKey === 'string' && apiKey.trim().length > 0;
    const effectiveApiKey = redactApiKeyForExport(
      apiKey,
      includeSecretApiKey || explicitKeyProvided
    );
    meta.push(`api_key,${effectiveApiKey}`);

    let effectiveSeq = lastEventSeq;
    if ((effectiveSeq === undefined || effectiveSeq === null || effectiveSeq === 0) && typeof window !== 'undefined' && window.localStorage) {
      const rawSeq = (tableId ? window.localStorage.getItem(`coin_last_seq_${tableId}`) : null) ||
                     window.localStorage.getItem('coin_active_seq');
      if (rawSeq) {
        const parsed = parseInt(rawSeq, 10);
        if (!isNaN(parsed)) effectiveSeq = parsed;
      }
    }
    meta.push(`last_event_seq,${effectiveSeq ?? 0}`);
    meta.push(`exported_at,${new Date().toISOString()}`);

    if (tableName) {
      meta.push(`name,${neutralizeCsvFormula(tableName)}`);
    }
    if (description) {
      meta.push(`description,${neutralizeCsvFormula(description)}`);
    }
    if (activeSectors && activeSectors.length > 0) {
      meta.push(`active_sectors,${encodeURIComponent(JSON.stringify(activeSectors))}`);
    }
    if (dashboardConfig) {
      meta.push(`dashboard_config,${encodeURIComponent(JSON.stringify(dashboardConfig))}`);
    }
    if (sectorParams && Object.keys(sectorParams).length > 0) {
      meta.push(`sector_params,${encodeURIComponent(JSON.stringify(sectorParams))}`);
    }

    // 1. Global goals (with fallback to legacy 'global' keys)
    if (goals?.globalGoals) {
      meta.push(`goal_global_daily,${goals.globalGoals.dailyGoal}`);
      meta.push(`goal_global_weekly,${goals.globalGoals.weeklyGoal}`);
      meta.push(`goal_global_annual,${goals.globalGoals.annualCost}`);
    } else if (goals) {
      const gDaily = (goals.dailyGoals as any)?.['global'];
      const gWeekly = (goals.weeklyGoals as any)?.['global'];
      const gAnnual = (goals.annualCosts as any)?.['global'];
      if (gDaily !== undefined) meta.push(`goal_global_daily,${gDaily}`);
      if (gWeekly !== undefined) meta.push(`goal_global_weekly,${gWeekly}`);
      if (gAnnual !== undefined) meta.push(`goal_global_annual,${gAnnual}`);
    }

    // 2. Yearly goals (combine explicit yearlyGoals + legacy year-keyed maps)
    const serializedYears = new Set<string>();
    if (goals?.yearlyGoals) {
      Object.entries(goals.yearlyGoals).forEach(([year, g]) => {
        serializedYears.add(String(year));
        meta.push(`goal_daily_${year},${g.dailyGoal}`);
        meta.push(`goal_weekly_${year},${g.weeklyGoal}`);
        meta.push(`goal_annual_${year},${g.annualCost}`);
      });
    }
    if (goals) {
      const legacyYears = new Set<string>();
      Object.keys(goals.dailyGoals || {}).forEach((k) => { if (/^\d{4}$/.test(k)) legacyYears.add(k); });
      Object.keys(goals.weeklyGoals || {}).forEach((k) => { if (/^\d{4}$/.test(k)) legacyYears.add(k); });
      Object.keys(goals.annualCosts || {}).forEach((k) => { if (/^\d{4}$/.test(k)) legacyYears.add(k); });
      legacyYears.forEach((year) => {
        if (!serializedYears.has(year)) {
          const yNum = Number(year);
          const dVal = goals.dailyGoals?.[yNum] ?? (goals.dailyGoals as any)?.[year] ?? 0;
          const wVal = goals.weeklyGoals?.[yNum] ?? (goals.weeklyGoals as any)?.[year] ?? 0;
          const aVal = goals.annualCosts?.[yNum] ?? (goals.annualCosts as any)?.[year] ?? 0;
          meta.push(`goal_daily_${year},${dVal}`);
          meta.push(`goal_weekly_${year},${wVal}`);
          meta.push(`goal_annual_${year},${aVal}`);
        }
      });
    }

    // 3. Monthly goals
    if (goals?.monthlyGoals) {
      Object.entries(goals.monthlyGoals).forEach(([month, g]) => {
        meta.push(`goal_monthly_daily_${month},${g.dailyGoal}`);
        meta.push(`goal_monthly_weekly_${month},${g.weeklyGoal}`);
        meta.push(`goal_monthly_annual_${month},${g.annualCost}`);
      });
    }

    // 4. Weekly overrides (manual sprints)
    if (goals?.weeklyGoals) {
      Object.entries(goals.weeklyGoals).forEach(([key, val]) => {
        if (typeof key === 'string' && key.includes('-W')) {
          meta.push(`goal_weekly_${key},${val}`);
        }
      });
    }

    // 5. Dynamic Table Schema Block
    if (schema && schema.columns && schema.columns.length > 0) {
      meta.push('## SCHEMA_COLUMNS ##');
      meta.push('id,label,originalHeader,dataType,role,invertSign,visible');
      schema.columns.forEach((c) => {
        const id = c.id || c.key || '';
        const label = (c.label || c.originalHeader || id).replace(/,/g, ' ');
        const orig = (c.originalHeader || c.label || id).replace(/,/g, ' ');
        const dataType = c.dataType || 'text';
        const role = c.role || c.semanticRole || 'custom_attribute';
        const invertSign = (c.invertSign || c.transformRule?.invertSign) ? 'true' : 'false';
        const visible = c.visible !== false ? 'true' : 'false';
        meta.push(`${id},${label},${orig},${dataType},${role},${invertSign},${visible}`);
      });
    }

    // 6. Investor Profile Configuration Block
    if (investorProfile) {
      meta.push('## INVESTOR_PROFILE ##');
      meta.push(`profile_type,${investorProfile.profileType}`);
      meta.push(`emergency_fund_goal_months,${investorProfile.emergencyFundMonthsGoal || 6}`);
      meta.push(`fire_annual_multiplier,${investorProfile.fireTargetAnnualExpensesMultiplier || 25}`);
      if (investorProfile.monthlyContributionGoal) {
        meta.push(`monthly_contribution_goal,${investorProfile.monthlyContributionGoal}`);
      }
      if (investorProfile.customAllocations && investorProfile.customAllocations.length > 0) {
        meta.push(`custom_allocations,${encodeURIComponent(JSON.stringify(investorProfile.customAllocations))}`);
      }
    }

    meta.push('## ROWS ##');

    const customCols = (schema?.columns || []).filter((c) => {
      if (c.isCustom === false) return false;
      const role = (c.role || c.semanticRole || '').toLowerCase();
      if (role && role !== 'custom_attribute' && role !== 'custom') return false;
      const k = (c.key || c.id || '').toLowerCase();
      return ![
        'id', 'date', 'data', 'value', 'valor', 'description', 'descricao', 'descrição',
        'entrytype', 'entry_type', 'tipo', 'monthlyvalue', 'monthcount',
        'period_start', 'period_end', 'category', 'categoria', 'tags', 'metadata_json',
        'ticker', 'quantity', 'quantidade', 'unitprice', 'unit_price', 'preco_unitario', 'preço_unitário',
        'generatedby', 'clonedfrom',
      ].includes(k);
    });

    const hasInvestCols = rows.some((r) => r.ticker || r.quantity !== undefined || r.unitPrice !== undefined);
    const hasGeneratedCols = rows.some((r) => r.generatedBy || r.clonedFrom);

    let header = 'id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json';
    if (hasInvestCols) {
      header += ',ticker,quantity,unitPrice';
    }
    if (hasGeneratedCols) {
      header += ',generatedBy,clonedFrom';
    }
    if (customCols.length > 0) {
      header += ',' + customCols.map((c) => c.key || c.id).join(',');
    }

    const lines = rows.map((r) => {
      let mergedMetaStr = r.metadataJson && r.metadataJson.trim() ? r.metadataJson.trim() : '{}';
      if (r.customValues && Object.keys(r.customValues).length > 0) {
        try {
          const parsedMeta = JSON.parse(mergedMetaStr);
          if (typeof parsedMeta === 'object' && parsedMeta !== null) {
            mergedMetaStr = JSON.stringify({ ...parsedMeta, ...r.customValues });
          }
        } catch {
          mergedMetaStr = JSON.stringify(r.customValues);
        }
      }

      const safeDesc = neutralizeCsvFormula(r.description || '').replace(/"/g, '""');
      const safeCat = r.category && r.category.trim()
        ? `"${neutralizeCsvFormula(r.category).replace(/"/g, '""')}"`
        : '"Geral"';
      const safeTags = r.tags ? `"${neutralizeCsvFormula(r.tags).replace(/"/g, '""')}"` : '""';

      const cols = [
        r.id || '',
        r.date,
        r.value,
        `"${safeDesc}"`,
        r.entryType || 'revenue',
        r.monthlyValue !== undefined ? r.monthlyValue : '',
        r.monthCount !== undefined ? r.monthCount : '',
        r.periodStart || '',
        r.periodEnd || '',
        safeCat,
        safeTags,
        `"${mergedMetaStr.replace(/"/g, '""')}"`,
      ];

      if (hasInvestCols) {
        cols.push(
          r.ticker ? `"${neutralizeCsvFormula(r.ticker).replace(/"/g, '""')}"` : '',
          r.quantity !== undefined ? String(r.quantity) : '',
          r.unitPrice !== undefined ? String(r.unitPrice) : ''
        );
      }

      if (hasGeneratedCols) {
        cols.push(
          r.generatedBy ? `"${r.generatedBy.replace(/"/g, '""')}"` : '',
          r.clonedFrom ? `"${r.clonedFrom.replace(/"/g, '""')}"` : ''
        );
      }

      if (customCols.length > 0) {
        customCols.forEach((c) => {
          const colKey = c.key || c.id;
          const val = r.customValues?.[colKey] ?? '';
          cols.push(`"${neutralizeCsvFormula(String(val)).replace(/"/g, '""')}"`);
        });
      }

      return cols.join(',');
    });

    return [...meta, header, ...lines].join('\n');
  }

  // Fallback to standard semicolon-delimited CSV for plain rows export
  const header = 'ID;Data;Tipo;Valor;Descrição;Período Início;Período Fim;Valor Mensal;Meses;Gerado Por;Categoria;Tags;Metadados';
  const lines = rows.map((r) => {
    const cols = [
      r.id || '',
      r.date,
      r.entryType || 'revenue',
      r.value.toString().replace('.', ','),
      `"${neutralizeCsvFormula(r.description || '').replace(/"/g, '""')}"`,
      r.periodStart || '',
      r.periodEnd || '',
      r.monthlyValue?.toString().replace('.', ',') || '',
      r.monthCount?.toString() || '',
      r.generatedBy || '',
      r.category ? `"${neutralizeCsvFormula(r.category).replace(/"/g, '""')}"` : '',
      r.tags ? `"${neutralizeCsvFormula(r.tags).replace(/"/g, '""')}"` : '',
      r.metadataJson ? `"${r.metadataJson.replace(/"/g, '""')}"` : '',
    ];
    return cols.join(';');
  });
  return [header, ...lines].join('\n');
}

/**
 * Granular Sliced CSV Serializer — Export by parts (revenue only, expense only, etc.)
 * Supports Agent-Ready Compact format (4-5 token-efficient columns) and standard CSV.
 */
export function serializeGranularCSV(
  rows: TableRow[],
  options: GranularExportOptions,
  tableName?: string,
  description?: string,
  goals?: TableGoals,
  tableId?: string,
  apiKey?: string | null,
  lastEventSeq?: number,
  schema?: DynamicTableSchema,
  investorProfile?: InvestorProfileConfig,
  activeSectors?: string[],
  dashboardConfig?: DashboardConfig,
  sectorParams?: SectorSimulationParams
): string {
  // 1. Filter rows by Scope
  let filtered = [...rows];
  if (options.scope === 'revenue') {
    filtered = filtered.filter((r) => !r.entryType || r.entryType === 'revenue');
  } else if (options.scope === 'expense') {
    filtered = filtered.filter((r) => r.entryType === 'expense');
  } else if (options.scope === 'deposit') {
    filtered = filtered.filter((r) => r.entryType === 'deposit');
  } else if (options.scope === 'partner') {
    filtered = filtered.filter((r) => r.entryType === 'partner_in' || r.entryType === 'partner_out');
  } else if (options.scope === 'unresolved') {
    filtered = filtered.filter((r) => r.entryType === 'unresolved');
  }

  // 2. Filter by Date / Month
  const targetMonth = options.selectedMonth || (options as any).month;
  if (targetMonth && targetMonth !== 'all') {
    filtered = filtered.filter((r) => r.date && r.date.startsWith(targetMonth));
  }
  if (options.startDate) {
    filtered = filtered.filter((r) => r.date && r.date >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter((r) => r.date && r.date <= options.endDate!);
  }

  // 3. Filter by Category
  if (options.categoryFilter && options.categoryFilter.trim()) {
    const cf = options.categoryFilter.trim().toLowerCase();
    filtered = filtered.filter((r) => r.category && r.category.toLowerCase() === cf);
  }

  // 4. Format Selection
  const delim = options.delimiter || (options.format === 'agent_compact' ? ',' : ';');

  if (options.format === 'backup_v3') {
    return serializeDynamicCSV(
      filtered,
      tableName,
      description,
      goals,
      tableId,
      apiKey,
      lastEventSeq,
      schema,
      investorProfile,
      activeSectors,
      dashboardConfig,
      sectorParams
    );
  }

  if (options.format === 'agent_compact') {
    // Ultra-clean format with minimal token footprint for LLM prompts
    const hasInvest = filtered.some((r) => r.ticker || r.quantity || r.unitPrice);
    const headers = ['date', 'value', 'description', 'category', 'entryType'];
    if (hasInvest) {
      headers.push('ticker', 'quantity', 'unitPrice');
    }
    const lines = filtered.map((r) => {
      const cols = [
        r.date,
        r.value.toFixed(2),
        `"${neutralizeCsvFormula(r.description || '').replace(/"/g, '""')}"`,
        `"${neutralizeCsvFormula(r.category || 'Geral').replace(/"/g, '""')}"`,
        r.entryType || 'revenue',
      ];
      if (hasInvest) {
        cols.push(
          r.ticker ? `"${neutralizeCsvFormula(r.ticker).replace(/"/g, '""')}"` : '',
          r.quantity !== undefined ? String(r.quantity) : '',
          r.unitPrice !== undefined ? String(r.unitPrice) : ''
        );
      }
      return cols.join(delim);
    });
    return [headers.join(delim), ...lines].join('\n');
  }

  // 'standard_csv': clean human-readable tabular CSV
  const headers = ['Data', 'Valor', 'Descrição', 'Tipo', 'Categoria', 'Tags'];
  const lines = filtered.map((r) => {
    const valStr = delim === ';' ? r.value.toString().replace('.', ',') : r.value.toFixed(2);
    const cols = [
      r.date,
      valStr,
      `"${neutralizeCsvFormula(r.description || '').replace(/"/g, '""')}"`,
      r.entryType || 'revenue',
      `"${neutralizeCsvFormula(r.category || 'Geral').replace(/"/g, '""')}"`,
      `"${neutralizeCsvFormula(r.tags || '').replace(/"/g, '""')}"`,
    ];
    return cols.join(delim);
  });
  return [headers.join(delim), ...lines].join('\n');
}


/**
 * Dynamic CSV Serializer — Assistente Moeda
 *
 * Pure platform-agnostic serializer that exports tables into:
 *   - Backup v3 Standard: contains ## SCHEMA_COLUMNS ##, ## INVESTOR_PROFILE ##,
 *     and dynamic ## ROWS ## with 100% fidelity for custom and investment columns.
 *   - Legacy Semicolon CSV: fallback when no schema or metadata is provided.
 */

import type { TableRow, TableGoals, DynamicTableSchema, InvestorProfileConfig } from './types';

export function serializeDynamicCSV(
  rows: TableRow[],
  tableName?: string,
  description?: string,
  goals?: TableGoals,
  tableId?: string,
  apiKey?: string | null,
  lastEventSeq?: number,
  schema?: DynamicTableSchema,
  investorProfile?: InvestorProfileConfig
): string {
  if (tableName || goals || tableId || schema || investorProfile) {
    const meta: string[] = ['## COIN ASSISTANT BACKUP v3 ##'];
    if (tableId) {
      meta.push(`table_id,${tableId}`);
    }

    let effectiveApiKey = apiKey;
    if (!effectiveApiKey && typeof window !== 'undefined' && window.localStorage) {
      effectiveApiKey = (tableId ? window.localStorage.getItem(`coin_api_key_${tableId}`) : null) ||
                        window.localStorage.getItem('coin_active_api_key');
    }
    if (!effectiveApiKey) {
      effectiveApiKey = 'am_sheet_live_local';
    }
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
      meta.push(`name,${tableName}`);
    }
    if (description) {
      meta.push(`description,${description}`);
    }

    // 1. Global goals
    if (goals?.globalGoals) {
      meta.push(`goal_global_daily,${goals.globalGoals.dailyGoal}`);
      meta.push(`goal_global_weekly,${goals.globalGoals.weeklyGoal}`);
      meta.push(`goal_global_annual,${goals.globalGoals.annualCost}`);
    }

    // 2. Yearly goals
    if (goals?.yearlyGoals) {
      Object.entries(goals.yearlyGoals).forEach(([year, g]) => {
        meta.push(`goal_daily_${year},${g.dailyGoal}`);
        meta.push(`goal_weekly_${year},${g.weeklyGoal}`);
        meta.push(`goal_annual_${year},${g.annualCost}`);
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
      const k = (c.key || c.id || '').toLowerCase();
      return !['id', 'date', 'value', 'description', 'entrytype', 'monthlyvalue', 'monthcount', 'period_start', 'period_end', 'category', 'tags', 'metadata_json', 'ticker', 'quantity', 'unitprice'].includes(k);
    });

    const hasInvestCols = rows.some((r) => r.ticker || r.quantity || r.unitPrice);
    
    let header = 'id,date,value,description,entryType,monthlyValue,monthCount,period_start,period_end,category,tags,metadata_json';
    if (hasInvestCols) {
      header += ',ticker,quantity,unitPrice';
    }
    if (customCols.length > 0) {
      header += ',' + customCols.map((c) => c.key || c.id).join(',');
    }

    const lines = rows.map((r) => {
      const cols = [
        r.id || '',
        r.date,
        r.value,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.entryType || 'revenue',
        r.monthlyValue !== undefined ? r.monthlyValue : '',
        r.monthCount !== undefined ? r.monthCount : '',
        r.periodStart || '',
        r.periodEnd || '',
        r.category && r.category.trim() ? `"${r.category.replace(/"/g, '""')}"` : '"Geral"',
        r.tags ? `"${r.tags.replace(/"/g, '""')}"` : '""',
        r.metadataJson && r.metadataJson.trim() ? `"${r.metadataJson.replace(/"/g, '""')}"` : '"{}"',
      ];

      if (hasInvestCols) {
        cols.push(
          r.ticker ? `"${r.ticker.replace(/"/g, '""')}"` : '',
          r.quantity !== undefined ? String(r.quantity) : '',
          r.unitPrice !== undefined ? String(r.unitPrice) : ''
        );
      }

      if (customCols.length > 0) {
        customCols.forEach((c) => {
          const colKey = c.key || c.id;
          const val = r.customValues?.[colKey] ?? '';
          cols.push(`"${String(val).replace(/"/g, '""')}"`);
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
      `"${(r.description || '').replace(/"/g, '""')}"`,
      r.periodStart || '',
      r.periodEnd || '',
      r.monthlyValue?.toString().replace('.', ',') || '',
      r.monthCount?.toString() || '',
      r.generatedBy || '',
      r.category ? `"${r.category.replace(/"/g, '""')}"` : '',
      r.tags ? `"${r.tags.replace(/"/g, '""')}"` : '',
      r.metadataJson ? `"${r.metadataJson.replace(/"/g, '""')}"` : '',
    ];
    return cols.join(';');
  });
  return [header, ...lines].join('\n');
}

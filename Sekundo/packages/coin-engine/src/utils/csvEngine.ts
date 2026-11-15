import type { TableRow, TableGoals, DynamicTableSchema, InvestorProfileConfig } from '../core/types';
import { detectSectorsFromRows } from './sectorTagDetector';
import { parseDynamicCSV, parseDynamicCSVAsync } from '../core/dynamicCsvParser';
import { neutralizeCsvFormula } from './securitySanitizer';
import {
  type AsyncImportControllerOptions,
  IMPORT_STAGE_LABELS_PT,
  throwIfImportAborted,
  yieldToEventLoop,
  yieldToUiFrame,
} from '../services/importPipelineContract';

// Delimiter detection helper
export function detectDelimiter(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;

  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

// Cell cleaner — strips outer double quotes and unescapes inner quotes
export function cleanCell(cell: string): string {
  if (!cell) return '';
  let s = String(cell).trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1);
  }
  return s.replace(/""/g, '"').trim();
}

// Quote-aware CSV line splitter
export function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '""';
        i++; // skip escaped quote pair
      } else {
        inQuotes = !inQuotes;
        current += '"';
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cleanCell(current));
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(cleanCell(current));
  return result;
}

// Date parser & normalizer
export function parseAndNormalizeDate(input: string): string | null {
  if (!input) return null;
  let s = cleanCell(input);
  if (!s) return null;

  s = s.split(/[\sT]/)[0];
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY (US format)
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return null;
}

// Value parser & normalizer
export function parseValue(input: string, isCentsColumn: boolean = false): number | null {
  if (input === null || input === undefined) return null;
  let s = cleanCell(input).replace(/['"R$\s]/g, '').trim();
  if (!s) return null;

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }

  const num = parseFloat(s);
  if (isNaN(num)) return null;

  if (isCentsColumn) {
    return num / 100;
  }
  return num;
}

// Extensible Entry Type normalizer — preserves exact string values!
export function normalizeEntryType(input: string): TableRow['entryType'] {
  if (!input) return 'revenue';
  const s = cleanCell(input).toLowerCase();
  if (!s) return 'revenue';

  if (s === 'receita') return 'revenue';
  if (s === 'despesa' || s === 'custo') return 'expense';
  if (s === 'depósito' || s === 'deposito' || s === 'aporte' || s === 'investimento') return 'deposit';
  if (s === 'abono' || s === 'justificativa') return 'waiver';
  if (s === 'neutro' || s === 'unresolved' || s === 'pendente' || s === 'quarentena') return 'unresolved';

  // Return s unchanged (partner_in, partner_out, waiver, expense, revenue, deposit, custom string)
  return s as TableRow['entryType'];
}

export interface CSVTablePartitionOutput {
  tableId: string;
  rows: (TableRow | Omit<TableRow, 'id'>)[];
  metadata: NonNullable<CSVParseOutput['metadata']>;
  detectedSectors: string[];
}

export interface CSVParseOutput {
  rows: (TableRow | Omit<TableRow, 'id'>)[];
  errors: string[];
  skippedCount: number;
  detectedSectors: string[];
  isAmbiguous?: boolean;
  metadata?: {
    tableId?: string;
    apiKey?: string;
    lastEventSeq?: number;
    name?: string;
    description?: string;
    goals?: Record<string, number | string>;
    tableGoals?: TableGoals;
    schema?: DynamicTableSchema;
    investorProfile?: InvestorProfileConfig;
    activeSectors?: string[];
    dashboardConfig?: import('../core/types').DashboardConfig;
    sectorParams?: import('../core/types').SectorSimulationParams;
  };
  /**
   * Quando um pacote Sekundo Omni-CSV (`#PLANILHA,coin_ledger_row`) contém uma ou mais
   * planilhas financeiras identificadas por `_container_id` distintos, cada partição
   * é retornada separadamente para impedir a fusão indevida de valores.
   */
  tablePartitions?: CSVTablePartitionOutput[];
  detectedHeaders?: string[];
}

function findHeaderIdx(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  for (const alias of aliases) {
    const normalizedAlias = alias.replace(/[^a-z0-9_]/gi, '').toLowerCase();
    const idx = headers.findIndex((h) => h.replace(/[^a-z0-9_]/gi, '').toLowerCase() === normalizedAlias);
    if (idx !== -1) return idx;
  }
  return -1;
}

interface PreparedCsvPreamble {
  cleaned: string;
  allLines: string[];
  transactionLines: string[];
  schemaMarkerLineIdx: number;
  metaObj: NonNullable<CSVParseOutput['metadata']>;
}

function isPlainCsvCommentLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('#')) return false;
  if (t.startsWith('##')) return false;
  if (/^#(PLANILHA|ABA_PLANILHA|FIM_PLANILHA|SHEET)(?:[,:\s]|$)/i.test(t)) return false;
  return true;
}

function prepareCsvPreamble(csvText: string): PreparedCsvPreamble | null {
  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;

  const allLines = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isPlainCsvCommentLine(l));

  if (allLines.length === 0) {
    return null;
  }

  const dateAliases = ['date', 'data', 'data_movimento', 'created_at'];
  const amountAliases = ['amount', 'valor', 'value', 'valor_cents', 'amount_in_cents', 'preco'];

  const schemaMarkerRegex = /##\s*SCHEMA_COLUMNS\s*##/i;
  const investorMarkerRegex = /##\s*INVESTOR_PROFILE\s*##/i;
  const rowsMarkerRegex = /##\s*ROWS\s*##/i;
  let schemaMarkerLineIdx = -1;
  let investorMarkerLineIdx = -1;
  let rowsMarkerLineIdx = -1;

  for (let i = 0; i < allLines.length; i++) {
    if (schemaMarkerRegex.test(allLines[i])) {
      schemaMarkerLineIdx = i;
    } else if (investorMarkerRegex.test(allLines[i])) {
      investorMarkerLineIdx = i;
    } else if (rowsMarkerRegex.test(allLines[i])) {
      rowsMarkerLineIdx = i;
    }
  }

  let metadataLines: string[] = [];
  let transactionLines: string[] = [];

  const earliestBlockIdx = [schemaMarkerLineIdx, investorMarkerLineIdx, rowsMarkerLineIdx]
    .filter((idx) => idx !== -1)
    .reduce((min, idx) => Math.min(min, idx), Infinity);

  if (earliestBlockIdx !== Infinity) {
    metadataLines = allLines.slice(0, earliestBlockIdx);
    if (rowsMarkerLineIdx !== -1) {
      transactionLines = allLines.slice(rowsMarkerLineIdx + 1);
    }
  } else {
    let transactionHeaderIdx = -1;
    for (let i = 0; i < allLines.length; i++) {
      const lineDelim = detectDelimiter(allLines[i]);
      const cols = splitCSVLine(allLines[i], lineDelim).map((h) => cleanCell(h).toLowerCase());
      const hasDate = findHeaderIdx(cols, dateAliases) !== -1;
      const hasAmount = findHeaderIdx(cols, amountAliases) !== -1;
      if (hasDate && hasAmount) {
        transactionHeaderIdx = i;
        break;
      }
    }

    if (transactionHeaderIdx !== -1) {
      metadataLines = allLines.slice(0, transactionHeaderIdx);
      transactionLines = allLines.slice(transactionHeaderIdx);
    } else {
      transactionLines = allLines;
    }
  }

  const metaObj: NonNullable<CSVParseOutput['metadata']> = {
    name: 'Minha Planilha',
    description: '',
    goals: {},
    tableGoals: {
      dailyGoals: {},
      weeklyGoals: {},
      annualCosts: {},
      yearlyGoals: {},
      globalGoals: { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 },
    },
  };

  if (
    investorMarkerLineIdx !== -1 &&
    (rowsMarkerLineIdx === -1 || investorMarkerLineIdx < rowsMarkerLineIdx)
  ) {
    const invEndIdx = rowsMarkerLineIdx !== -1 ? rowsMarkerLineIdx : allLines.length;
    const invLines = allLines.slice(investorMarkerLineIdx + 1, invEndIdx);
    let pType: import('../core/types').InvestorProfileType = 'safety';
    let emGoal = 6;
    let fireMult = 25;
    let moGoal: number | undefined = undefined;
    let custAlloc: any = undefined;

    invLines.forEach((line) => {
      if (line.startsWith('##')) return;
      const parts = splitCSVLine(line, detectDelimiter(line));
      if (parts.length >= 2) {
        const k = parts[0].toLowerCase();
        const v = parts[1];
        if (k === 'profile_type') pType = v as import('../core/types').InvestorProfileType;
        if (k === 'emergency_fund_goal_months') emGoal = parseInt(v, 10) || 6;
        if (k === 'fire_annual_multiplier') fireMult = parseInt(v, 10) || 25;
        if (k === 'monthly_contribution_goal') moGoal = parseFloat(v) || undefined;
        if (k === 'custom_allocations') {
          try {
            custAlloc = JSON.parse(decodeURIComponent(v));
          } catch {}
        }
      }
    });

    metaObj.investorProfile = {
      profileType: pType,
      emergencyFundMonthsGoal: emGoal,
      fireTargetAnnualExpensesMultiplier: fireMult,
      monthlyContributionGoal: moGoal,
      customAllocations: custAlloc,
    };
  }

  const currentYear = new Date().getFullYear();

  metadataLines.forEach((line) => {
    if (line.startsWith('##')) return;
    const lineDelim = detectDelimiter(line);
    const parts = splitCSVLine(line, lineDelim).map((p) => cleanCell(p));
    if (parts.length >= 2) {
      const rawKey = parts[0];
      const keyLower = rawKey.toLowerCase();
      const valStr = parts[1];
      const numVal = parseFloat(valStr);

      if (keyLower === 'table_id' || keyLower === 'tableid' || keyLower === 'id_planilha') {
        metaObj.tableId = valStr;
      } else if (keyLower === 'api_key' || keyLower === 'apikey' || keyLower === 'chave_api') {
        metaObj.apiKey = valStr;
      } else if (keyLower === 'last_event_seq' || keyLower === 'lasteventseq' || keyLower === 'seq') {
        const parsedSeq = parseInt(valStr, 10);
        if (!isNaN(parsedSeq)) {
          metaObj.lastEventSeq = parsedSeq;
        }
      } else if (keyLower === 'name' || keyLower === 'nome') {
        metaObj.name = valStr;
      } else if (keyLower === 'description' || keyLower === 'descricao') {
        metaObj.description = valStr;
      } else if (keyLower === 'active_sectors') {
        try {
          const parsed = JSON.parse(decodeURIComponent(valStr));
          if (Array.isArray(parsed)) metaObj.activeSectors = parsed;
        } catch {}
      } else if (keyLower === 'dashboard_config') {
        try {
          const parsed = JSON.parse(decodeURIComponent(valStr));
          if (parsed && typeof parsed === 'object') metaObj.dashboardConfig = parsed;
        } catch {}
      } else if (keyLower === 'sector_params') {
        try {
          const parsed = JSON.parse(decodeURIComponent(valStr));
          if (parsed && typeof parsed === 'object') metaObj.sectorParams = parsed;
        } catch {}
      } else if (keyLower === 'exported_at') {
        // Ignore timestamp metadata key
      } else {
        const finalVal = !isNaN(numVal) ? numVal : valStr;
        metaObj.goals![rawKey] = finalVal;

        if (!isNaN(numVal)) {
          const dGoals = metaObj.tableGoals!.dailyGoals as Record<number | string, number>;
          const wGoals = metaObj.tableGoals!.weeklyGoals as Record<number | string, number>;
          const aCosts = metaObj.tableGoals!.annualCosts as Record<number | string, number>;

          if (!metaObj.tableGoals!.globalGoals) {
            metaObj.tableGoals!.globalGoals = { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 };
          }
          if (!metaObj.tableGoals!.monthlyGoals) {
            metaObj.tableGoals!.monthlyGoals = {};
          }

          if (keyLower === 'goal_global_daily' || keyLower === 'meta_global_diaria') {
            metaObj.tableGoals!.globalGoals.dailyGoal = numVal;
            dGoals['global'] = numVal;
            dGoals[currentYear] = numVal;
          } else if (keyLower === 'goal_global_weekly' || keyLower === 'meta_global_semanal') {
            metaObj.tableGoals!.globalGoals.weeklyGoal = numVal;
            wGoals['global'] = numVal;
            wGoals[currentYear] = numVal;
          } else if (keyLower === 'goal_global_annual' || keyLower === 'meta_global_anual') {
            metaObj.tableGoals!.globalGoals.annualCost = numVal;
            aCosts['global'] = numVal;
            aCosts[currentYear] = numVal;
          } else if (/^(?:goal_weekly_|meta_semanal_)(\d{4}-W\d{2})$/i.test(keyLower)) {
            const match = keyLower.match(/^(?:goal_weekly_|meta_semanal_)(\d{4}-W\d{2})$/i);
            if (match) {
              wGoals[match[1].toUpperCase()] = numVal;
            }
          } else if (/^goal_monthly_(daily|weekly|annual)_(\d{4}-\d{2})$/i.test(keyLower)) {
            const match = keyLower.match(/^goal_monthly_(daily|weekly|annual)_(\d{4}-\d{2})$/i);
            if (match) {
              const [, gType, mKey] = match;
              if (!metaObj.tableGoals!.monthlyGoals[mKey]) {
                metaObj.tableGoals!.monthlyGoals[mKey] = { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 };
              }
              if (gType === 'daily') metaObj.tableGoals!.monthlyGoals[mKey].dailyGoal = numVal;
              if (gType === 'weekly') metaObj.tableGoals!.monthlyGoals[mKey].weeklyGoal = numVal;
              if (gType === 'annual') metaObj.tableGoals!.monthlyGoals[mKey].annualCost = numVal;
            }
          } else if (/^(?:goal_|meta_|custo_)(daily|weekly|annual|diaria|semanal|anual)_(\d{4})$/i.test(keyLower)) {
            const annualMatch = keyLower.match(
              /^(?:goal_|meta_|custo_)(daily|weekly|annual|diaria|semanal|anual)_(\d{4})$/i
            );
            if (annualMatch) {
              const [, typeStr, yearStr] = annualMatch;
              const year = parseInt(yearStr, 10);
              let goalType = 'daily';
              if (typeStr === 'weekly' || typeStr === 'semanal') goalType = 'weekly';
              if (typeStr === 'annual' || typeStr === 'anual') goalType = 'annual';

              if (goalType === 'daily') dGoals[year] = numVal;
              if (goalType === 'weekly') wGoals[year] = numVal;
              if (goalType === 'annual') aCosts[year] = numVal;

              const currentYg = metaObj.tableGoals!.yearlyGoals![year] || {
                dailyGoal: 0,
                weeklyGoal: 0,
                annualCost: 0,
              };
              if (goalType === 'daily') currentYg.dailyGoal = numVal;
              if (goalType === 'weekly') currentYg.weeklyGoal = numVal;
              if (goalType === 'annual') currentYg.annualCost = numVal;
              metaObj.tableGoals!.yearlyGoals![year] = currentYg;
            }
          } else if (/^(?:goal_|meta_|custo_)?(daily|weekly|annual|diaria|semanal|anual)$/i.test(keyLower)) {
            const globalMatch = keyLower.match(
              /^(?:goal_|meta_|custo_)?(daily|weekly|annual|diaria|semanal|anual)$/i
            );
            if (globalMatch) {
              const typeStr = globalMatch[1];
              let goalType = 'daily';
              if (typeStr === 'weekly' || typeStr === 'semanal') goalType = 'weekly';
              if (typeStr === 'annual' || typeStr === 'anual') goalType = 'annual';

              if (goalType === 'daily') {
                metaObj.tableGoals!.globalGoals.dailyGoal = numVal;
                dGoals['global'] = numVal;
                dGoals[currentYear] = numVal;
              } else if (goalType === 'weekly') {
                metaObj.tableGoals!.globalGoals.weeklyGoal = numVal;
                wGoals['global'] = numVal;
                wGoals[currentYear] = numVal;
              } else if (goalType === 'annual') {
                metaObj.tableGoals!.globalGoals.annualCost = numVal;
                aCosts['global'] = numVal;
                aCosts[currentYear] = numVal;
              }

              const currentYg = metaObj.tableGoals!.yearlyGoals![currentYear] || {
                dailyGoal: 0,
                weeklyGoal: 0,
                annualCost: 0,
              };
              if (goalType === 'daily') currentYg.dailyGoal = numVal;
              if (goalType === 'weekly') currentYg.weeklyGoal = numVal;
              if (goalType === 'annual') currentYg.annualCost = numVal;
              metaObj.tableGoals!.yearlyGoals![currentYear] = currentYg;
            }
          }
        }
      }
    }
  });

  return {
    cleaned,
    allLines,
    transactionLines,
    schemaMarkerLineIdx,
    metaObj,
  };
}

interface StandardCsvColumnIndices {
  delimiter: string;
  headers: string[];
  nodeKindIdx: number;
  idIdx: number;
  dateIdx: number;
  descriptionIdx: number;
  amountIdx: number;
  categoryIdx: number;
  tagsIdx: number;
  metadataIdx: number;
  typeIdx: number;
  monthlyValueIdx: number;
  monthCountIdx: number;
  periodStartIdx: number;
  periodEndIdx: number;
  tickerIdx: number;
  quantityIdx: number;
  unitPriceIdx: number;
  generatedByIdx: number;
  clonedFromIdx: number;
  isCentsColumn: boolean;
  headerSectors: Set<string>;
}

function buildStandardCsvColumnIndices(headerLine: string): StandardCsvColumnIndices {
  const dateAliases = ['date', 'data', 'data_movimento', 'created_at'];
  const amountAliases = ['amount', 'valor', 'value', 'valor_cents', 'amount_in_cents', 'preco'];
  const delimiter = detectDelimiter(headerLine);
  const headers = splitCSVLine(headerLine, delimiter).map((h) => cleanCell(h).toLowerCase());

  const idIdx = findHeaderIdx(headers, [
    'id',
    'uuid',
    'transaction_id',
    'id_transacao',
    'external_id',
    '_key',
    'key',
  ]);
  const dateIdx = findHeaderIdx(headers, dateAliases);
  const descriptionIdx = findHeaderIdx(headers, [
    'description',
    'descricao',
    'descrição',
    'historico',
    'memo',
    'title',
    'label',
  ]);
  const amountIdx = findHeaderIdx(headers, amountAliases);
  const categoryIdx = findHeaderIdx(headers, ['category', 'categoria']);
  const tagsIdx = findHeaderIdx(headers, [
    'tags',
    'sector_tags',
    'etiquetas',
    'metodo_pagamento',
    'payment_method',
  ]);
  const metadataIdx = findHeaderIdx(headers, [
    'metadata_json',
    'metadatajson',
    'metadata',
    'metadados',
    '_meta_json',
  ]);
  const explicitEntryTypeIdx = findHeaderIdx(headers, ['entry_type', 'entrytype']);
  const typeIdx =
    explicitEntryTypeIdx !== -1
      ? explicitEntryTypeIdx
      : findHeaderIdx(headers, ['entrytype', 'entry_type', 'tipo', 'type']);
  const nodeKindIdx = findHeaderIdx(headers, ['_type', 'tipo']);
  const monthlyValueIdx = findHeaderIdx(headers, [
    'monthlyvalue',
    'valor_mensal',
    'monthly_value',
    'valor mensal',
  ]);
  const monthCountIdx = findHeaderIdx(headers, [
    'monthcount',
    'qtd_meses',
    'month_count',
    'months',
    'meses',
  ]);
  const periodStartIdx = findHeaderIdx(headers, [
    'period_start',
    'periodstart',
    'inicio_periodo',
    'period_inicio',
    'período início',
  ]);
  const periodEndIdx = findHeaderIdx(headers, [
    'period_end',
    'periodend',
    'fim_periodo',
    'period_fim',
    'período fim',
  ]);
  const tickerIdx = findHeaderIdx(headers, ['ticker', 'ativo', 'codigo_ativo']);
  const quantityIdx = findHeaderIdx(headers, ['quantity', 'quantidade', 'qtd']);
  const unitPriceIdx = findHeaderIdx(headers, [
    'unitprice',
    'unit_price',
    'preco_unitario',
    'preço unitário',
  ]);
  const generatedByIdx = findHeaderIdx(headers, [
    'generatedby',
    'generated_by',
    'gerado_por',
    'gerado por',
  ]);
  const clonedFromIdx = findHeaderIdx(headers, [
    'clonedfrom',
    'cloned_from',
    'clonado_de',
    'clonado de',
  ]);

  const matchedAmountHeader = headers[amountIdx] || '';
  const isCentsColumn =
    matchedAmountHeader === 'valor_cents' || matchedAmountHeader === 'amount_in_cents';

  const headerSectors = new Set<string>();
  const headerSectorsMap: Record<string, string[]> = {
    smb_accounting: [
      'ncg',
      'fap_rat',
      'lucro_real',
      'cfar',
      'massa_salarial_12',
      'receita_bruta_12',
    ],
    legal_taxes: [
      'fator_r',
      'taxa_legal',
      'irpf_2026',
      'simples_nacional',
      'tipo_debito',
      'data_ajuizamento',
    ],
    real_estate: ['tabela_price', 'sistema_sac', 'cap_rate', 'rental_income'],
    vehicles: [
      'cpk',
      'weibull',
      'ubi',
      'tco_vehicle',
      'milhas_km',
      'receita_bruta',
      'tipo_viagem',
    ],
  };

  headers.forEach((h) => {
    for (const [sec, keywords] of Object.entries(headerSectorsMap)) {
      if (keywords.some((kw) => h.includes(kw))) {
        headerSectors.add(sec);
      }
    }
  });

  return {
    delimiter,
    headers,
    nodeKindIdx,
    idIdx,
    dateIdx,
    descriptionIdx,
    amountIdx,
    categoryIdx,
    tagsIdx,
    metadataIdx,
    typeIdx,
    monthlyValueIdx,
    monthCountIdx,
    periodStartIdx,
    periodEndIdx,
    tickerIdx,
    quantityIdx,
    unitPriceIdx,
    generatedByIdx,
    clonedFromIdx,
    isCentsColumn,
    headerSectors,
  };
}

function stepStandardTransactionLine(
  lineText: string,
  lineNum: number,
  todayStr: string,
  colMap: StandardCsvColumnIndices,
  options: {
    fallbackEntryType?: TableRow['entryType'];
    forceEntryType?: TableRow['entryType'];
  } | undefined,
  metaObj: NonNullable<CSVParseOutput['metadata']>,
  rows: (TableRow | Omit<TableRow, 'id'>)[],
  errors: string[]
): number {
  const cols = splitCSVLine(lineText, colMap.delimiter);
  if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
    return 1;
  }

  if (colMap.nodeKindIdx !== -1 && cols[colMap.nodeKindIdx]) {
    const nk = cleanCell(cols[colMap.nodeKindIdx]).toLowerCase();
    if (
      nk === 'header' ||
      nk === 'root' ||
      nk === 'branch' ||
      nk === 'group' ||
      nk === 'raiz' ||
      nk === 'bloco'
    ) {
      if (colMap.descriptionIdx !== -1 && cols[colMap.descriptionIdx]) {
        metaObj.name = cleanCell(cols[colMap.descriptionIdx]);
      }
      return 0;
    }
  }

  try {
    let rowId: string | undefined = undefined;
    if (colMap.idIdx !== -1 && cols[colMap.idIdx] !== undefined && cols[colMap.idIdx] !== null) {
      const cleanedId = cleanCell(cols[colMap.idIdx]);
      if (cleanedId.length > 0) {
        rowId = cleanedId;
      }
    }

    const rawDate = cols[colMap.dateIdx] || '';
    const normalizedDate = parseAndNormalizeDate(rawDate) || todayStr;

    const rawAmount = cols[colMap.amountIdx] || '0';
    let parsedVal = parseValue(rawAmount, colMap.isCentsColumn);
    if (parsedVal === null || isNaN(parsedVal)) {
      parsedVal = 0;
    }

    let entryType: TableRow['entryType'] =
      options?.forceEntryType || options?.fallbackEntryType || 'revenue';
    if (!options?.forceEntryType) {
      if (colMap.typeIdx !== -1 && cols[colMap.typeIdx]) {
        entryType = normalizeEntryType(cols[colMap.typeIdx]);
      } else if (
        colMap.categoryIdx !== -1 &&
        cols[colMap.categoryIdx] &&
        cols[colMap.categoryIdx].trim()
      ) {
        const inferredFromCat = normalizeEntryType(cols[colMap.categoryIdx]);
        if (
          inferredFromCat &&
          ['revenue', 'expense', 'deposit', 'waiver', 'partner_in', 'partner_out', 'unresolved'].includes(
            inferredFromCat
          )
        ) {
          entryType = inferredFromCat;
        }
      }
    }

    let description = '';
    if (
      colMap.descriptionIdx !== -1 &&
      cols[colMap.descriptionIdx] !== undefined &&
      cols[colMap.descriptionIdx] !== null
    ) {
      description = cleanCell(cols[colMap.descriptionIdx]);
    }
    if (description === '' && colMap.descriptionIdx === -1) {
      description = 'IMPORTADO VIA PLANILHA';
    }

    const category =
      colMap.categoryIdx !== -1 && cols[colMap.categoryIdx]
        ? cleanCell(cols[colMap.categoryIdx])
        : 'Geral';

    const tags =
      colMap.tagsIdx !== -1 && cols[colMap.tagsIdx] ? cleanCell(cols[colMap.tagsIdx]) : '';

    let metadataJson = '{}';
    const customValues: Record<string, string | number | boolean> = {};
    if (
      colMap.metadataIdx !== -1 &&
      cols[colMap.metadataIdx] !== undefined &&
      cols[colMap.metadataIdx] !== null
    ) {
      const rawMeta = cleanCell(cols[colMap.metadataIdx]);
      if (rawMeta.length > 0) {
        try {
          const parsedObj = JSON.parse(rawMeta);
          if (typeof parsedObj === 'object' && parsedObj !== null) {
            metadataJson = JSON.stringify(parsedObj);
            Object.entries(parsedObj).forEach(([k, v]) => {
              if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                customValues[k] = v;
              }
            });
          } else {
            metadataJson = '{}';
          }
        } catch {
          metadataJson = '{}';
        }
      }
    }

    let monthlyValue: number | undefined = undefined;
    if (colMap.monthlyValueIdx !== -1 && cols[colMap.monthlyValueIdx]) {
      const parsedMv = parseValue(cols[colMap.monthlyValueIdx]);
      if (parsedMv !== null && !isNaN(parsedMv)) monthlyValue = parsedMv;
    }

    let monthCount: number | undefined = undefined;
    if (colMap.monthCountIdx !== -1 && cols[colMap.monthCountIdx]) {
      const parsedMc = parseInt(cleanCell(cols[colMap.monthCountIdx]), 10);
      if (!isNaN(parsedMc)) monthCount = parsedMc;
    }

    let periodStart: string | undefined = undefined;
    if (colMap.periodStartIdx !== -1 && cols[colMap.periodStartIdx]) {
      const parsedPs = parseAndNormalizeDate(cols[colMap.periodStartIdx]);
      if (parsedPs) periodStart = parsedPs;
    }

    let periodEnd: string | undefined = undefined;
    if (colMap.periodEndIdx !== -1 && cols[colMap.periodEndIdx]) {
      const parsedPe = parseAndNormalizeDate(cols[colMap.periodEndIdx]);
      if (parsedPe) periodEnd = parsedPe;
    }

    let ticker: string | undefined = undefined;
    if (colMap.tickerIdx !== -1 && cols[colMap.tickerIdx]) {
      const t = cleanCell(cols[colMap.tickerIdx]).toUpperCase();
      if (t) ticker = t;
    }

    let quantity: number | undefined = undefined;
    if (colMap.quantityIdx !== -1 && cols[colMap.quantityIdx]) {
      const q = parseFloat(cleanCell(cols[colMap.quantityIdx]));
      if (!isNaN(q)) quantity = q;
    }

    let unitPrice: number | undefined = undefined;
    if (colMap.unitPriceIdx !== -1 && cols[colMap.unitPriceIdx]) {
      const p = parseValue(cols[colMap.unitPriceIdx]);
      if (p !== null && !isNaN(p)) unitPrice = p;
    }

    let generatedBy: string | undefined = undefined;
    if (colMap.generatedByIdx !== -1 && cols[colMap.generatedByIdx]) {
      const g = cleanCell(cols[colMap.generatedByIdx]);
      if (g) generatedBy = g;
    }

    let clonedFrom: string | undefined = undefined;
    if (colMap.clonedFromIdx !== -1 && cols[colMap.clonedFromIdx]) {
      const c = cleanCell(cols[colMap.clonedFromIdx]);
      if (c) clonedFrom = c;
    }

    rows.push({
      ...(rowId ? { id: rowId } : {}),
      date: normalizedDate,
      value: parsedVal,
      description,
      entryType,
      category: category || 'Geral',
      tags: tags || '',
      metadataJson,
      monthlyValue,
      monthCount,
      periodStart,
      periodEnd,
      ...(ticker ? { ticker } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(unitPrice !== undefined ? { unitPrice } : {}),
      ...(generatedBy ? { generatedBy } : {}),
      ...(clonedFrom ? { clonedFrom } : {}),
      ...(Object.keys(customValues).length > 0 ? { customValues } : {}),
    } as TableRow | Omit<TableRow, 'id'>);
    return 0;
  } catch (err: any) {
    errors.push(`Linha ${lineNum}: ${err.message}`);
    return 1;
  }
}

interface OmniRouterAccumulator {
  currentSheet: string;
  activeOmniHeaders: string[];
  hasSheetMarkers: boolean;
  partitionsMap: Map<
    string,
    {
      tableId: string;
      explicitName?: string;
      metadata: NonNullable<CSVParseOutput['metadata']>;
      rows: TableRow[];
    }
  >;
  rows: (TableRow | Omit<TableRow, 'id'>)[];
}

function detectCsvVariantFlags(allLines: string[]): {
  isSekundoOmniCsv: boolean;
  isSekundoCanonicalTree: boolean;
} {
  const firstRawLine = allLines[0] || '';
  const isSekundoOmniCsv =
    /^#?(PLANILHA|ABA_PLANILHA)[,:]/i.test(firstRawLine) ||
    allLines.some(
      (l) => /^_container_id,_key,_type,_engines/i.test(l) || /^_record_kind,_container_id/i.test(l)
    );
  const isSekundoCanonicalTree =
    !isSekundoOmniCsv && allLines.some((l) => /^_?key,_?type,label,value/i.test(l));
  return { isSekundoOmniCsv, isSekundoCanonicalTree };
}

function createOmniRouterAccumulator(allLines: string[]): OmniRouterAccumulator {
  return {
    currentSheet: '',
    activeOmniHeaders: [],
    hasSheetMarkers: allLines.some((l) => /^#?PLANILHA[,:]/i.test(l)),
    partitionsMap: new Map(),
    rows: [],
  };
}

function stepOmniRouterLine(
  line: string,
  todayStr: string,
  options: { fallbackEntryType?: TableRow['entryType']; forceEntryType?: TableRow['entryType'] } | undefined,
  acc: OmniRouterAccumulator
): void {
  if (/^#?PLANILHA[,:]/i.test(line)) {
    const parts = splitCSVLine(line, ',');
    acc.currentSheet = (parts[1] || '').trim().toLowerCase();
    return;
  }
  if (/^#?(ABA_PLANILHA|FIM_PLANILHA)[,:]/i.test(line)) {
    acc.currentSheet = '';
    return;
  }
  if (/^(_container_id,_key|_record_kind,_container_id)/i.test(line)) {
    acc.activeOmniHeaders = splitCSVLine(line, ',').map((h) => cleanCell(h).toLowerCase());
    return;
  }
  if (acc.activeOmniHeaders.length === 0) return;

  const cols = splitCSVLine(line, ',');
  const rowMap: Record<string, string> = {};
  acc.activeOmniHeaders.forEach((h, idx) => {
    rowMap[h] = cols[idx] !== undefined ? cleanCell(cols[idx]) : '';
  });

  const isCoinRow =
    acc.currentSheet === 'coin_ledger_row' ||
    acc.currentSheet === 'financial_ledger' ||
    rowMap._record_kind === 'coin_ledger_row' ||
    (!acc.hasSheetMarkers && rowMap._engines === 'financial_ledger');

  if (!isCoinRow) return;

  let meta: Record<string, any> = {};
  if (rowMap._meta_json) {
    try {
      meta = JSON.parse(rowMap._meta_json);
    } catch {
      meta = {};
    }
  }

  const rawContainerCell = (rowMap._container_id || '').trim();
  const [parsedContainerId, explicitContainerName] = rawContainerCell.includes('::')
    ? rawContainerCell.split('::').map((s) => s.trim())
    : [rawContainerCell, ''];
  const metaTableId = typeof meta.tableId === 'string' ? meta.tableId.trim() : '';
  const resolvedTableId = parsedContainerId || metaTableId || 'coin-default';
  const containerChangedManually = Boolean(
    parsedContainerId && metaTableId && parsedContainerId !== metaTableId
  );

  let partition = acc.partitionsMap.get(resolvedTableId);
  if (!partition) {
    partition = {
      tableId: resolvedTableId,
      explicitName: undefined,
      metadata: {
        tableId: resolvedTableId,
        name: 'Minha Planilha',
        description: '',
        goals: {},
        tableGoals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {}, yearlyGoals: {} },
      },
      rows: [],
    };
    acc.partitionsMap.set(resolvedTableId, partition);
  }

  const candidateTableName =
    explicitContainerName ||
    (!containerChangedManually && meta.tableName ? String(meta.tableName) : '') ||
    (!containerChangedManually && meta.tableEnvelope?.tableName
      ? String(meta.tableEnvelope.tableName)
      : '') ||
    (containerChangedManually ? parsedContainerId : '');

  if (
    candidateTableName &&
    (!partition.explicitName ||
      partition.explicitName === 'Minha Planilha' ||
      partition.explicitName === 'Assistente Moeda — Geral')
  ) {
    partition.explicitName = candidateTableName;
    partition.metadata.name = candidateTableName;
  }

  if (
    !containerChangedManually &&
    meta.tableEnvelope &&
    typeof meta.tableEnvelope === 'object'
  ) {
    const env = meta.tableEnvelope;
    if (env.description) partition.metadata.description = String(env.description);
    if (env.goals) partition.metadata.tableGoals = env.goals;
    if (env.investorProfile) partition.metadata.investorProfile = env.investorProfile;
    if (env.schema) partition.metadata.schema = env.schema;
    if (env.activeSectors) partition.metadata.activeSectors = env.activeSectors;
    if (env.dashboardConfig) partition.metadata.dashboardConfig = env.dashboardConfig;
    if (env.sectorParams) partition.metadata.sectorParams = env.sectorParams;
  }

  const isHeaderSentinel =
    (rowMap._type || '').trim().toLowerCase() === 'header' ||
    Boolean(meta.isTableHeaderOnly) ||
    (rowMap._key || '').startsWith('__table_header__');

  if (isHeaderSentinel) return;

  const parsedVal =
    parseValue(
      rowMap.primary_assignee ||
        rowMap.notes_or_payload ||
        String(meta.amount ?? meta.amountBRL ?? meta.value ?? 0)
    ) ?? 0;
  const normalizedDate =
    parseAndNormalizeDate(rowMap.date_or_cycle || meta.date || '') || todayStr;
  const entryType = options?.forceEntryType
    ? options.forceEntryType
    : normalizeEntryType(
        rowMap.secondary_assignee || meta.entryType || options?.fallbackEntryType || 'revenue'
      );

  const newRow: TableRow = {
    id: rowMap._key || meta.id || `coin-omni-${acc.rows.length + 1}`,
    date: normalizedDate,
    value: parsedVal,
    description: neutralizeCsvFormula(
      rowMap.title_or_name || meta.description || 'Lançamento Importado'
    ),
    category: neutralizeCsvFormula(rowMap.group_or_tier || meta.category || 'Geral'),
    tags: neutralizeCsvFormula(
      rowMap.capabilities_or_tags ||
        (Array.isArray(meta.tags) ? meta.tags.join(',') : meta.tags) ||
        meta.paymentMethod ||
        'PIX'
    ),
    entryType,
    createdAt: new Date().toISOString(),
  };

  if (typeof meta.monthlyValue === 'number') newRow.monthlyValue = meta.monthlyValue;
  if (typeof meta.monthCount === 'number') newRow.monthCount = meta.monthCount;
  if (meta.periodStart || meta.period_start) {
    newRow.periodStart = String(meta.periodStart || meta.period_start);
  }
  if (meta.periodEnd || meta.period_end) {
    newRow.periodEnd = String(meta.periodEnd || meta.period_end);
  }
  if (meta.ticker) newRow.ticker = String(meta.ticker);
  if (typeof meta.quantity === 'number') newRow.quantity = meta.quantity;
  if (typeof meta.unitPrice === 'number') newRow.unitPrice = meta.unitPrice;
  if (meta.customValues && typeof meta.customValues === 'object') {
    newRow.customValues = meta.customValues;
  }

  partition.rows.push(newRow);
  acc.rows.push(newRow);
}

function finalizeOmniRouterOutput(
  acc: OmniRouterAccumulator,
  metaObj: NonNullable<CSVParseOutput['metadata']>,
  errors: string[],
  skippedCount: number
): CSVParseOutput {
  const tablePartitions: CSVTablePartitionOutput[] = [];
  const usedNames = new Map<string, number>();
  let partIdx = 0;
  for (const part of acc.partitionsMap.values()) {
    partIdx += 1;
    let resolvedName =
      part.explicitName ||
      (acc.partitionsMap.size > 1
        ? `Planilha Financeira #${partIdx} (${part.tableId})`
        : 'Minha Planilha');
    const count = usedNames.get(resolvedName) || 0;
    usedNames.set(resolvedName, count + 1);
    if (count > 0 && acc.partitionsMap.size > 1) {
      resolvedName = `${resolvedName} (${part.tableId})`;
    }
    part.metadata.name = resolvedName;

    const partRowSectors = detectSectorsFromRows(part.rows);
    const partDetectedSectors = Array.from(
      new Set(['personal_finance', ...(part.metadata.activeSectors || []), ...partRowSectors])
    );

    tablePartitions.push({
      tableId: part.tableId,
      rows: part.rows,
      metadata: part.metadata,
      detectedSectors: partDetectedSectors,
    });
  }

  if (tablePartitions.length > 0) {
    const firstPart = tablePartitions[0];
    metaObj.tableId = firstPart.metadata.tableId;
    metaObj.name = firstPart.metadata.name;
    if (firstPart.metadata.description) metaObj.description = firstPart.metadata.description;
    if (firstPart.metadata.tableGoals) metaObj.tableGoals = firstPart.metadata.tableGoals;
    if (firstPart.metadata.investorProfile) {
      metaObj.investorProfile = firstPart.metadata.investorProfile;
    }
    if (firstPart.metadata.schema) metaObj.schema = firstPart.metadata.schema;
    if (firstPart.metadata.activeSectors) metaObj.activeSectors = firstPart.metadata.activeSectors;
    if (firstPart.metadata.dashboardConfig) {
      metaObj.dashboardConfig = firstPart.metadata.dashboardConfig;
    }
    if (firstPart.metadata.sectorParams) metaObj.sectorParams = firstPart.metadata.sectorParams;
  }

  const rowSectors = detectSectorsFromRows(acc.rows as TableRow[]);
  const detectedSectors = Array.from(
    new Set(['personal_finance', ...(metaObj.activeSectors || []), ...rowSectors])
  );
  return {
    rows: acc.rows,
    errors,
    skippedCount,
    detectedSectors,
    metadata: metaObj,
    tablePartitions,
  };
}

interface CanonicalTreeContext {
  canonHeaderIdx: number;
  canonDelim: string;
  kIdx: number;
  tIdx: number;
  lIdx: number;
  vIdx: number;
  mIdx: number;
}

function createCanonicalTreeContext(allLines: string[]): CanonicalTreeContext {
  const canonHeaderIdx = allLines.findIndex((l) => /^_?key,_?type,label,value/i.test(l));
  const canonDelim = detectDelimiter(allLines[canonHeaderIdx]);
  const canonHeaders = splitCSVLine(allLines[canonHeaderIdx], canonDelim).map((h) =>
    cleanCell(h).toLowerCase()
  );
  return {
    canonHeaderIdx,
    canonDelim,
    kIdx: findHeaderIdx(canonHeaders, ['_key', 'key']),
    tIdx: findHeaderIdx(canonHeaders, ['_type', 'type', 'tipo']),
    lIdx: findHeaderIdx(canonHeaders, ['label', 'descricao', 'description', 'nome']),
    vIdx: findHeaderIdx(canonHeaders, ['value', 'valor', 'amount']),
    mIdx: findHeaderIdx(canonHeaders, ['_meta_json', 'meta_json', 'metadata_json']),
  };
}

function stepCanonicalTreeLine(
  line: string,
  ctx: CanonicalTreeContext,
  todayStr: string,
  options: { fallbackEntryType?: TableRow['entryType']; forceEntryType?: TableRow['entryType'] } | undefined,
  metaObj: NonNullable<CSVParseOutput['metadata']>,
  rows: (TableRow | Omit<TableRow, 'id'>)[]
): void {
  const cols = splitCSVLine(line, ctx.canonDelim);
  const rawKey = ctx.kIdx !== -1 && cols[ctx.kIdx] ? cleanCell(cols[ctx.kIdx]) : '';
  const rawNodeType = ctx.tIdx !== -1 && cols[ctx.tIdx] ? cleanCell(cols[ctx.tIdx]).toLowerCase() : '';
  const rawLabel = ctx.lIdx !== -1 && cols[ctx.lIdx] ? cleanCell(cols[ctx.lIdx]) : '';
  const rawVal = ctx.vIdx !== -1 && cols[ctx.vIdx] ? cleanCell(cols[ctx.vIdx]) : '';
  const rawMeta = ctx.mIdx !== -1 && cols[ctx.mIdx] ? cleanCell(cols[ctx.mIdx]) : '';

  if (
    rawNodeType === 'header' ||
    rawNodeType === 'root' ||
    rawNodeType === 'branch' ||
    rawNodeType === 'group' ||
    rawNodeType === 'raiz' ||
    rawNodeType === 'bloco'
  ) {
    if (rawKey === '01' && rawLabel) {
      metaObj.name = rawLabel;
    }
    return;
  }

  let meta: Record<string, any> = {};
  if (rawMeta) {
    try {
      meta = JSON.parse(rawMeta);
    } catch {
      meta = {};
    }
  }

  const parsedVal =
    parseValue(rawVal || String(meta.amountBRL ?? meta.amount ?? meta.value ?? 0)) ?? 0;
  const normalizedDate =
    parseAndNormalizeDate(meta.date || meta.data || '') || todayStr;
  const entryType = options?.forceEntryType
    ? options.forceEntryType
    : normalizeEntryType(
        meta.entryType || meta.entry_type || options?.fallbackEntryType || 'revenue'
      );

  const newRow: TableRow = {
    id: rawKey || meta.id || `coin-canon-${rows.length + 1}`,
    date: normalizedDate,
    value: parsedVal,
    description: neutralizeCsvFormula(rawLabel || meta.description || 'Lançamento Importado'),
    category: neutralizeCsvFormula(meta.category || meta.categoria || 'Geral'),
    tags: neutralizeCsvFormula(meta.paymentMethod || meta.tags || 'PIX'),
    entryType,
    createdAt: new Date().toISOString(),
  };

  if (typeof meta.monthlyValue === 'number') newRow.monthlyValue = meta.monthlyValue;
  if (typeof meta.monthCount === 'number') newRow.monthCount = meta.monthCount;
  if (meta.ticker) newRow.ticker = String(meta.ticker);
  if (typeof meta.quantity === 'number') newRow.quantity = meta.quantity;
  if (typeof meta.unitPrice === 'number') newRow.unitPrice = meta.unitPrice;

  rows.push(newRow);
}

export function parseCSVText(
  csvText: string,
  options?: {
    fallbackEntryType?: TableRow['entryType'];
    forceEntryType?: TableRow['entryType'];
  }
): CSVParseOutput {
  const errors: string[] = [];
  let skippedCount = 0;
  const rows: (TableRow | Omit<TableRow, 'id'>)[] = [];

  const preamble = prepareCsvPreamble(csvText);
  if (!preamble) {
    return {
      rows,
      errors: ['O CSV está vazio.'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata: {
        name: 'Minha Planilha',
        description: '',
        goals: {},
        tableGoals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {}, yearlyGoals: {} },
      },
    };
  }

  const { cleaned, allLines, transactionLines, schemaMarkerLineIdx, metaObj } = preamble;
  const metadata = metaObj;

  // If Backup v3 explicit schema marker is detected, delegate to dynamic CSV parser
  if (schemaMarkerLineIdx !== -1) {
    const dynamicResult = parseDynamicCSV(cleaned, metaObj.tableId || 'default');
    metaObj.schema = dynamicResult.schema;
    if (dynamicResult.investorProfile) {
      metaObj.investorProfile = dynamicResult.investorProfile;
    }
    const rowSectors = detectSectorsFromRows(dynamicResult.rows);
    const detectedSectors = Array.from(new Set([
      'personal_finance',
      ...(metaObj.activeSectors || []),
      ...rowSectors,
    ]));

    return {
      rows: dynamicResult.rows,
      errors: dynamicResult.errors,
      skippedCount: dynamicResult.skippedLines,
      detectedSectors,
      metadata: metaObj,
    };
  }
  
  if (transactionLines.length === 0) {
    return {
      rows,
      errors: ['Nenhuma linha de transação foi encontrada.'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata,
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const { isSekundoOmniCsv, isSekundoCanonicalTree } = detectCsvVariantFlags(allLines);

  if (isSekundoOmniCsv) {
    const acc = createOmniRouterAccumulator(allLines);
    for (let i = 0; i < allLines.length; i++) {
      stepOmniRouterLine(allLines[i], todayStr, options, acc);
    }
    return finalizeOmniRouterOutput(acc, metaObj, errors, skippedCount);
  }

  if (isSekundoCanonicalTree) {
    const canonCtx = createCanonicalTreeContext(allLines);
    for (let i = canonCtx.canonHeaderIdx + 1; i < allLines.length; i++) {
      stepCanonicalTreeLine(allLines[i], canonCtx, todayStr, options, metaObj, rows);
    }

    const rowSectors = detectSectorsFromRows(rows as TableRow[]);
    const detectedSectors = Array.from(
      new Set(['personal_finance', ...(metaObj.activeSectors || []), ...rowSectors])
    );
    return {
      rows,
      errors,
      skippedCount,
      detectedSectors,
      metadata: metaObj,
    };
  }

  const colMap = buildStandardCsvColumnIndices(transactionLines[0]);
  const { headers, typeIdx, headerSectors } = colMap;

  if (colMap.dateIdx === -1 || colMap.amountIdx === -1) {
    return {
      rows,
      errors: [
        'Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas de data ("data", "date") e valor ("valor", "amount").',
      ],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata,
      detectedHeaders: headers,
    };
  }

  for (let i = 1; i < transactionLines.length; i++) {
    skippedCount += stepStandardTransactionLine(
      transactionLines[i],
      i + 1,
      todayStr,
      colMap,
      options,
      metaObj,
      rows,
      errors
    );
  }

  // Detect sectors from parsed rows
  const rowSectors = detectSectorsFromRows(rows);
  const detectedSectors = Array.from(
    new Set([
      'personal_finance',
      ...(metaObj.activeSectors || []),
      ...headerSectors,
      ...rowSectors,
    ])
  );

  console.log('[CSV Parser]: Total rows extracted from section ## ROWS ##:', rows.length);

  const isAmbiguous = typeIdx === -1 && !options?.forceEntryType;

  return {
    rows,
    errors,
    skippedCount,
    detectedSectors,
    isAmbiguous,
    metadata,
    detectedHeaders: headers,
  };
}

/**
 * Cooperative async non-blocking CSV parser with UI frame yield, progress ticks, and AbortSignal.
 * Shares exact row-mapping logic with synchronous `parseCSVText` for 100% parity.
 */
export async function parseCSVTextAsync(
  csvText: string,
  options?: {
    fallbackEntryType?: TableRow['entryType'];
    forceEntryType?: TableRow['entryType'];
  },
  controllerOptions: AsyncImportControllerOptions = {}
): Promise<CSVParseOutput> {
  throwIfImportAborted(controllerOptions.signal);
  const fileName = controllerOptions.fileName || 'planilha.csv';

  controllerOptions.onProgress?.({
    stage: 'decoding',
    stageLabel: IMPORT_STAGE_LABELS_PT.decoding,
    detailLabel: `Analisando cabeçalhos e separadores de "${fileName}"...`,
    cancellable: true,
    fileName,
    sizeBytes: controllerOptions.sizeBytes,
    percent: 10,
  });
  await yieldToUiFrame();
  throwIfImportAborted(controllerOptions.signal);

  const preamble = prepareCsvPreamble(csvText);
  if (!preamble) {
    return {
      rows: [],
      errors: ['O CSV está vazio.'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata: {
        name: 'Minha Planilha',
        description: '',
        goals: {},
        tableGoals: { dailyGoals: {}, weeklyGoals: {}, annualCosts: {}, yearlyGoals: {} },
      },
    };
  }

  const { cleaned, allLines, transactionLines, schemaMarkerLineIdx, metaObj } = preamble;
  const { isSekundoOmniCsv, isSekundoCanonicalTree } = detectCsvVariantFlags(allLines);
  const chunkSize = Math.max(50, controllerOptions.chunkSize || 250);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (schemaMarkerLineIdx !== -1) {
    const dynamicResult = await parseDynamicCSVAsync(
      cleaned,
      metaObj.tableId || 'default',
      options,
      { ...controllerOptions, fileName }
    );
    throwIfImportAborted(controllerOptions.signal);
    metaObj.schema = dynamicResult.schema;
    if (dynamicResult.investorProfile) {
      metaObj.investorProfile = dynamicResult.investorProfile;
    }
    const rowSectors = detectSectorsFromRows(dynamicResult.rows);
    const detectedSectors = Array.from(
      new Set(['personal_finance', ...(metaObj.activeSectors || []), ...rowSectors])
    );

    controllerOptions.onProgress?.({
      stage: 'validating',
      stageLabel: IMPORT_STAGE_LABELS_PT.validating,
      detailLabel: `${dynamicResult.rows.length.toLocaleString('pt-BR')} linha(s) validadas.`,
      processedCount: dynamicResult.rows.length,
      totalCount: dynamicResult.rows.length,
      percent: 82,
      cancellable: true,
      fileName,
      sizeBytes: controllerOptions.sizeBytes,
    });
    await yieldToEventLoop();
    throwIfImportAborted(controllerOptions.signal);

    return {
      rows: dynamicResult.rows,
      errors: dynamicResult.errors,
      skippedCount: dynamicResult.skippedLines,
      detectedSectors,
      metadata: metaObj,
    };
  }

  if (isSekundoOmniCsv) {
    const acc = createOmniRouterAccumulator(allLines);
    const totalLines = allLines.length;
    for (let i = 0; i < totalLines; i++) {
      stepOmniRouterLine(allLines[i], todayStr, options, acc);
      if (i > 0 && i % chunkSize === 0) {
        throwIfImportAborted(controllerOptions.signal);
        controllerOptions.onProgress?.({
          stage: 'parsing_rows',
          stageLabel: IMPORT_STAGE_LABELS_PT.parsing_rows,
          detailLabel: `Processando ${i.toLocaleString('pt-BR')} de ${totalLines.toLocaleString('pt-BR')} linha(s) Omni-CSV...`,
          processedCount: i,
          totalCount: totalLines,
          percent: 15 + Math.round((i / Math.max(1, totalLines)) * 55),
          cancellable: true,
          fileName,
          sizeBytes: controllerOptions.sizeBytes,
        });
        await yieldToEventLoop();
      }
    }
    throwIfImportAborted(controllerOptions.signal);
    const parsed = finalizeOmniRouterOutput(acc, metaObj, [], 0);
    controllerOptions.onProgress?.({
      stage: 'validating',
      stageLabel: IMPORT_STAGE_LABELS_PT.validating,
      detailLabel: `${parsed.rows.length.toLocaleString('pt-BR')} linha(s) validadas.`,
      processedCount: parsed.rows.length,
      totalCount: parsed.rows.length,
      percent: 82,
      cancellable: true,
      fileName,
      sizeBytes: controllerOptions.sizeBytes,
    });
    await yieldToEventLoop();
    throwIfImportAborted(controllerOptions.signal);
    return parsed;
  }

  if (isSekundoCanonicalTree) {
    const canonCtx = createCanonicalTreeContext(allLines);
    const canonRows: (TableRow | Omit<TableRow, 'id'>)[] = [];
    const totalDataLines = Math.max(1, allLines.length - (canonCtx.canonHeaderIdx + 1));
    for (let i = canonCtx.canonHeaderIdx + 1; i < allLines.length; i++) {
      stepCanonicalTreeLine(allLines[i], canonCtx, todayStr, options, metaObj, canonRows);
      const processed = i - canonCtx.canonHeaderIdx;
      if (processed % chunkSize === 0) {
        throwIfImportAborted(controllerOptions.signal);
        controllerOptions.onProgress?.({
          stage: 'parsing_rows',
          stageLabel: IMPORT_STAGE_LABELS_PT.parsing_rows,
          detailLabel: `Processando ${processed.toLocaleString('pt-BR')} de ${totalDataLines.toLocaleString('pt-BR')} linha(s)...`,
          processedCount: processed,
          totalCount: totalDataLines,
          percent: 15 + Math.round((processed / totalDataLines) * 55),
          cancellable: true,
          fileName,
          sizeBytes: controllerOptions.sizeBytes,
        });
        await yieldToEventLoop();
      }
    }
    throwIfImportAborted(controllerOptions.signal);
    const rowSectors = detectSectorsFromRows(canonRows as TableRow[]);
    const detectedSectors = Array.from(
      new Set(['personal_finance', ...(metaObj.activeSectors || []), ...rowSectors])
    );
    controllerOptions.onProgress?.({
      stage: 'validating',
      stageLabel: IMPORT_STAGE_LABELS_PT.validating,
      detailLabel: `${canonRows.length.toLocaleString('pt-BR')} linha(s) validadas.`,
      processedCount: canonRows.length,
      totalCount: canonRows.length,
      percent: 82,
      cancellable: true,
      fileName,
      sizeBytes: controllerOptions.sizeBytes,
    });
    await yieldToEventLoop();
    throwIfImportAborted(controllerOptions.signal);
    return {
      rows: canonRows,
      errors: [],
      skippedCount: 0,
      detectedSectors,
      metadata: metaObj,
    };
  }

  if (transactionLines.length === 0) {
    return {
      rows: [],
      errors: ['Nenhuma linha de transação foi encontrada.'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata: metaObj,
    };
  }

  const colMap = buildStandardCsvColumnIndices(transactionLines[0]);
  const { headers, typeIdx, headerSectors } = colMap;

  if (colMap.dateIdx === -1 || colMap.amountIdx === -1) {
    return {
      rows: [],
      errors: [
        'Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas de data ("data", "date") e valor ("valor", "amount").',
      ],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata: metaObj,
      detectedHeaders: headers,
    };
  }

  const rows: (TableRow | Omit<TableRow, 'id'>)[] = [];
  const errors: string[] = [];
  let skippedCount = 0;
  const totalDataLines = Math.max(1, transactionLines.length - 1);

  for (let i = 1; i < transactionLines.length; i++) {
    skippedCount += stepStandardTransactionLine(
      transactionLines[i],
      i + 1,
      todayStr,
      colMap,
      options,
      metaObj,
      rows,
      errors
    );
    if (i % chunkSize === 0) {
      throwIfImportAborted(controllerOptions.signal);
      controllerOptions.onProgress?.({
        stage: 'parsing_rows',
        stageLabel: IMPORT_STAGE_LABELS_PT.parsing_rows,
        detailLabel: `Processando ${i.toLocaleString('pt-BR')} de ${totalDataLines.toLocaleString('pt-BR')} linha(s)...`,
        processedCount: i,
        totalCount: totalDataLines,
        percent: 15 + Math.round((i / totalDataLines) * 55),
        cancellable: true,
        fileName,
        sizeBytes: controllerOptions.sizeBytes,
      });
      await yieldToEventLoop();
    }
  }

  throwIfImportAborted(controllerOptions.signal);
  controllerOptions.onProgress?.({
    stage: 'validating',
    stageLabel: IMPORT_STAGE_LABELS_PT.validating,
    detailLabel: 'Identificando setores e verificando integridade...',
    processedCount: totalDataLines,
    totalCount: totalDataLines,
    percent: 78,
    cancellable: true,
    fileName,
    sizeBytes: controllerOptions.sizeBytes,
  });
  await yieldToEventLoop();
  throwIfImportAborted(controllerOptions.signal);

  const rowSectors = detectSectorsFromRows(rows);
  const detectedSectors = Array.from(
    new Set([
      'personal_finance',
      ...(metaObj.activeSectors || []),
      ...headerSectors,
      ...rowSectors,
    ])
  );

  const isAmbiguous = typeIdx === -1 && !options?.forceEntryType;

  return {
    rows,
    errors,
    skippedCount,
    detectedSectors,
    isAmbiguous,
    metadata: metaObj,
    detectedHeaders: headers,
  };
}

export function exportRowsToCSV(rows: TableRow[]): string {
  const headers = ['id', 'date', 'value', 'description', 'entryType', 'category', 'tags', 'metadata_json'];
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const safeId = neutralizeCsvFormula(row.id || '');
    const safeDate = neutralizeCsvFormula(row.date || '');
    const safeDesc = neutralizeCsvFormula(row.description || '').replace(/"/g, '""');
    const safeType = neutralizeCsvFormula(row.entryType || 'revenue');
    const rawCat = row.category && row.category.trim() ? row.category : 'Geral';
    const safeCat = neutralizeCsvFormula(rawCat).replace(/"/g, '""');
    const safeTags = row.tags ? neutralizeCsvFormula(row.tags).replace(/"/g, '""') : '';
    const rawMeta = row.metadataJson && row.metadataJson.trim() ? row.metadataJson : '{}';
    const safeMeta = neutralizeCsvFormula(rawMeta).replace(/"/g, '""');

    const cols = [
      safeId,
      safeDate,
      row.value.toFixed(2),
      `"${safeDesc}"`,
      safeType,
      `"${safeCat}"`,
      `"${safeTags}"`,
      `"${safeMeta}"`,
    ];
    lines.push(cols.join(','));
  });

  return lines.join('\n');
}

// ── UUID v4 Generator ─────────────────────────────────────────────────────────
export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Merge & Frequency Fingerprint Engine ──────────────────────────────────────

function getRowFingerprintKey(row: { date: string; value: number; description?: string }): string {
  const d = row.date || '';
  const v = Number(row.value || 0).toFixed(2);
  const desc = (row.description || '').trim().toLowerCase();
  return `${d}|${v}|${desc}`;
}

export function isBankRowAlreadyPresent(
  existingRows: TableRow[],
  incoming: TableRow | Omit<TableRow, 'id'>
): boolean {
  const key = getRowFingerprintKey(incoming);
  return existingRows.some((r) => getRowFingerprintKey(r) === key);
}

/**
 * Merges incoming spreadsheet rows into existing rows.
 * Rules:
 * CASE 1: Incoming row has ID and exists in current table -> UPDATE
 * CASE 2: Incoming row has ID and does NOT exist in current table -> INSERT
 * CASE 3: Incoming row has NO ID (e.g. bank CSV) -> Frequency-based fingerprinting.
 */
export function mergeRows(
  existingRows: TableRow[],
  incomingRows: (TableRow | Omit<TableRow, 'id'>)[]
): TableRow[] {
  const existingMap = new Map<string, TableRow>();
  existingRows.forEach((row) => {
    if (row.id) {
      existingMap.set(row.id, row);
    }
  });

  // Track frequency counts in existingRows for rows without ID
  const existingFreqCounts = new Map<string, number>();
  existingRows.forEach((row) => {
    const key = getRowFingerprintKey(row);
    existingFreqCounts.set(key, (existingFreqCounts.get(key) || 0) + 1);
  });

  // Track how many frequency matches we have consumed from existingRows
  const matchedFreqCounts = new Map<string, number>();
  const newRowsToAdd: TableRow[] = [];

  incomingRows.forEach((rawIncoming) => {
    const incomingId = 'id' in rawIncoming ? rawIncoming.id : undefined;

    // CASO 1 & CASO 2: A linha possui ID
    if (incomingId) {
      if (existingMap.has(incomingId)) {
        // CASO 1: UPDATE
        const existing = existingMap.get(incomingId)!;
        existingMap.set(incomingId, {
          ...existing,
          ...rawIncoming,
          id: incomingId,
        });
      } else {
        // CASO 2: INSERT com o ID fornecido
        const newRow: TableRow = {
          ...(rawIncoming as TableRow),
          id: incomingId,
        };
        existingMap.set(incomingId, newRow);
      }
      return;
    }

    // CASO 3: A linha NÃO POSSUI ID (ex: CSV de Banco) -> Fingerprint por Frequência
    const key = getRowFingerprintKey(rawIncoming);
    const totalInExisting = existingFreqCounts.get(key) || 0;
    const consumedSoFar = matchedFreqCounts.get(key) || 0;

    if (consumedSoFar < totalInExisting) {
      // Frequency match: this row is already present in existing rows -> skip as duplicate
      matchedFreqCounts.set(key, consumedSoFar + 1);
    } else {
      // New distinct entry or exceeds existing frequency -> insert with new UUID v4
      const newRow: TableRow = {
        ...(rawIncoming as TableRow),
        id: generateUUIDv4(),
      };
      newRowsToAdd.push(newRow);
    }
  });

  const merged = [...Array.from(existingMap.values()), ...newRowsToAdd];
  return merged.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}


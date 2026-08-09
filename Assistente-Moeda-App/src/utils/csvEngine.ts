import type { TableRow, TableGoals } from '../core/types';
import { detectSectorsFromRows } from './sectorTagDetector';

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
  if (s === 'depósito' || s === 'deposito') return 'deposit';
  if (s === 'abono' || s === 'justificativa') return 'waiver';

  // Return s unchanged (partner_in, partner_out, waiver, expense, revenue, deposit, custom string)
  return s as TableRow['entryType'];
}

export interface CSVParseOutput {
  rows: (TableRow | Omit<TableRow, 'id'>)[];
  errors: string[];
  skippedCount: number;
  detectedSectors: string[];
  metadata?: {
    name?: string;
    description?: string;
    goals?: Record<string, number | string>;
    tableGoals?: TableGoals;
  };
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

export function parseCSVText(csvText: string): CSVParseOutput {
  const errors: string[] = [];
  let skippedCount = 0;
  const rows: (TableRow | Omit<TableRow, 'id'>)[] = [];

  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  
  // Split all lines safely
  const allLines = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allLines.length === 0) {
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

  const dateAliases = ['date', 'data', 'data_movimento', 'created_at'];
  const amountAliases = ['amount', 'valor', 'value', 'valor_cents', 'amount_in_cents', 'preco'];

  // Check if ## ROWS ## marker exists
  const rowsMarkerRegex = /##\s*ROWS\s*##/i;
  let rowsMarkerLineIdx = -1;
  for (let i = 0; i < allLines.length; i++) {
    if (rowsMarkerRegex.test(allLines[i])) {
      rowsMarkerLineIdx = i;
      break;
    }
  }

  let metadataLines: string[] = [];
  let transactionLines: string[] = [];

  if (rowsMarkerLineIdx !== -1) {
    metadataLines = allLines.slice(0, rowsMarkerLineIdx);
    transactionLines = allLines.slice(rowsMarkerLineIdx + 1);
  } else {
    // Dynamic Header Search: scan lines to find the actual transaction header row containing date and amount columns
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
      // Fallback: line 0 as header
      transactionLines = allLines;
    }
  }

  // Parse metadata from metadataLines (flexible delimiter per line)
  const metaObj: {
    name?: string;
    description?: string;
    goals: Record<string, number | string>;
    tableGoals: TableGoals;
  } = {
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

      if (keyLower === 'name' || keyLower === 'nome') {
        metaObj.name = valStr;
      } else if (keyLower === 'description' || keyLower === 'descricao') {
        metaObj.description = valStr;
      } else {
        const finalVal = !isNaN(numVal) ? numVal : valStr;
        metaObj.goals[rawKey] = finalVal;

        if (!isNaN(numVal)) {
          const dGoals = metaObj.tableGoals.dailyGoals as Record<number | string, number>;
          const wGoals = metaObj.tableGoals.weeklyGoals as Record<number | string, number>;
          const aCosts = metaObj.tableGoals.annualCosts as Record<number | string, number>;

          if (!metaObj.tableGoals.globalGoals) {
            metaObj.tableGoals.globalGoals = { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 };
          }
          if (!metaObj.tableGoals.monthlyGoals) {
            metaObj.tableGoals.monthlyGoals = {};
          }

          // 1. Explicit Global Keys: goal_global_daily, goal_global_weekly, goal_global_annual
          if (keyLower === 'goal_global_daily' || keyLower === 'meta_global_diaria') {
            metaObj.tableGoals.globalGoals.dailyGoal = numVal;
            dGoals['global'] = numVal;
            dGoals[currentYear] = numVal;
          } else if (keyLower === 'goal_global_weekly' || keyLower === 'meta_global_semanal') {
            metaObj.tableGoals.globalGoals.weeklyGoal = numVal;
            wGoals['global'] = numVal;
            wGoals[currentYear] = numVal;
          } else if (keyLower === 'goal_global_annual' || keyLower === 'meta_global_anual') {
            metaObj.tableGoals.globalGoals.annualCost = numVal;
            aCosts['global'] = numVal;
            aCosts[currentYear] = numVal;
          }
          // 2. Weekly ISO Override Keys: goal_weekly_2026-W30 or meta_semanal_2026-W30
          else if (/^(?:goal_weekly_|meta_semanal_)(\d{4}-W\d{2})$/i.test(keyLower)) {
            const match = keyLower.match(/^(?:goal_weekly_|meta_semanal_)(\d{4}-W\d{2})$/i);
            if (match) {
              wGoals[match[1].toUpperCase()] = numVal;
            }
          }
          // 3. Monthly Goals: goal_monthly_daily_2026-07, goal_monthly_weekly_2026-07, goal_monthly_annual_2026-07
          else if (/^goal_monthly_(daily|weekly|annual)_(\d{4}-\d{2})$/i.test(keyLower)) {
            const match = keyLower.match(/^goal_monthly_(daily|weekly|annual)_(\d{4}-\d{2})$/i);
            if (match) {
              const [, gType, mKey] = match;
              if (!metaObj.tableGoals.monthlyGoals[mKey]) {
                metaObj.tableGoals.monthlyGoals[mKey] = { dailyGoal: 0, weeklyGoal: 0, annualCost: 0 };
              }
              if (gType === 'daily') metaObj.tableGoals.monthlyGoals[mKey].dailyGoal = numVal;
              if (gType === 'weekly') metaObj.tableGoals.monthlyGoals[mKey].weeklyGoal = numVal;
              if (gType === 'annual') metaObj.tableGoals.monthlyGoals[mKey].annualCost = numVal;
            }
          }
          // 4. Annual Goals: goal_daily_2026, goal_weekly_2026, goal_annual_2026, meta_diaria_2026
          else if (/^(?:goal_|meta_|custo_)(daily|weekly|annual|diaria|semanal|anual)_(\d{4})$/i.test(keyLower)) {
            const annualMatch = keyLower.match(/^(?:goal_|meta_|custo_)(daily|weekly|annual|diaria|semanal|anual)_(\d{4})$/i);
            if (annualMatch) {
              const [, typeStr, yearStr] = annualMatch;
              const year = parseInt(yearStr, 10);
              let goalType = 'daily';
              if (typeStr === 'weekly' || typeStr === 'semanal') goalType = 'weekly';
              if (typeStr === 'annual' || typeStr === 'anual') goalType = 'annual';

              if (goalType === 'daily') dGoals[year] = numVal;
              if (goalType === 'weekly') wGoals[year] = numVal;
              if (goalType === 'annual') aCosts[year] = numVal;

              const currentYg = metaObj.tableGoals.yearlyGoals![year] || {
                dailyGoal: 0,
                weeklyGoal: 0,
                annualCost: 0,
              };
              if (goalType === 'daily') currentYg.dailyGoal = numVal;
              if (goalType === 'weekly') currentYg.weeklyGoal = numVal;
              if (goalType === 'annual') currentYg.annualCost = numVal;
              metaObj.tableGoals.yearlyGoals![year] = currentYg;
            }
          }
          // 5. Global Fallback Keys (without year or suffix): goal_daily, goal_weekly, goal_annual, meta_diaria, meta_semanal, custo_anual
          else if (/^(?:goal_|meta_|custo_)?(daily|weekly|annual|diaria|semanal|anual)$/i.test(keyLower)) {
            const globalMatch = keyLower.match(/^(?:goal_|meta_|custo_)?(daily|weekly|annual|diaria|semanal|anual)$/i);
            if (globalMatch) {
              const typeStr = globalMatch[1];
              let goalType = 'daily';
              if (typeStr === 'weekly' || typeStr === 'semanal') goalType = 'weekly';
              if (typeStr === 'annual' || typeStr === 'anual') goalType = 'annual';

              if (goalType === 'daily') {
                metaObj.tableGoals.globalGoals.dailyGoal = numVal;
                dGoals['global'] = numVal;
                dGoals[currentYear] = numVal;
              } else if (goalType === 'weekly') {
                metaObj.tableGoals.globalGoals.weeklyGoal = numVal;
                wGoals['global'] = numVal;
                wGoals[currentYear] = numVal;
              } else if (goalType === 'annual') {
                metaObj.tableGoals.globalGoals.annualCost = numVal;
                aCosts['global'] = numVal;
                aCosts[currentYear] = numVal;
              }

              const currentYg = metaObj.tableGoals.yearlyGoals![currentYear] || {
                dailyGoal: 0,
                weeklyGoal: 0,
                annualCost: 0,
              };
              if (goalType === 'daily') currentYg.dailyGoal = numVal;
              if (goalType === 'weekly') currentYg.weeklyGoal = numVal;
              if (goalType === 'annual') currentYg.annualCost = numVal;
              metaObj.tableGoals.yearlyGoals![currentYear] = currentYg;
            }
          }
        }
      }
    }
  });

  const metadata = metaObj;

  if (transactionLines.length === 0) {
    return {
      rows,
      errors: ['Nenhuma linha de transação foi encontrada.'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata,
    };
  }

  const delimiter = detectDelimiter(transactionLines[0]);
  const headers = splitCSVLine(transactionLines[0], delimiter).map((h) => cleanCell(h).toLowerCase());

  const idAliases = ['id', 'uuid', 'transaction_id', 'id_transacao', 'external_id'];
  const descriptionAliases = ['description', 'descricao', 'historico', 'memo', 'title'];
  const categoryAliases = ['category', 'categoria'];
  const tagsAliases = ['tags', 'sector_tags', 'etiquetas'];
  const metadataAliases = ['metadata_json', 'metadatajson', 'metadata', 'metadados'];
  const typeAliases = ['entrytype', 'entry_type', 'tipo', 'type'];
  const monthlyValueAliases = ['monthlyvalue', 'valor_mensal', 'monthly_value'];
  const monthCountAliases = ['monthcount', 'qtd_meses', 'month_count', 'months'];
  const periodStartAliases = ['period_start', 'periodstart', 'inicio_periodo', 'period_inicio'];
  const periodEndAliases = ['period_end', 'periodend', 'fim_periodo', 'period_fim'];

  const idIdx = findHeaderIdx(headers, idAliases);
  const dateIdx = findHeaderIdx(headers, dateAliases);
  const descriptionIdx = findHeaderIdx(headers, descriptionAliases);
  const amountIdx = findHeaderIdx(headers, amountAliases);
  const categoryIdx = findHeaderIdx(headers, categoryAliases);
  const tagsIdx = findHeaderIdx(headers, tagsAliases);
  const metadataIdx = findHeaderIdx(headers, metadataAliases);
  const typeIdx = findHeaderIdx(headers, typeAliases);
  const monthlyValueIdx = findHeaderIdx(headers, monthlyValueAliases);
  const monthCountIdx = findHeaderIdx(headers, monthCountAliases);
  const periodStartIdx = findHeaderIdx(headers, periodStartAliases);
  const periodEndIdx = findHeaderIdx(headers, periodEndAliases);

  if (dateIdx === -1 || amountIdx === -1) {
    return {
      rows,
      errors: ['Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas de data ("data", "date") e valor ("valor", "amount").'],
      skippedCount: 0,
      detectedSectors: ['personal_finance'],
      metadata,
    };
  }

  const matchedAmountHeader = headers[amountIdx] || '';
  const isCentsColumn = matchedAmountHeader === 'valor_cents' || matchedAmountHeader === 'amount_in_cents';

  // Scan headers for sector keywords
  const headerSectors = new Set<string>();
  const headerSectorsMap: Record<string, string[]> = {
    smb_accounting: ['ncg', 'fap_rat', 'lucro_real', 'cfar', 'massa_salarial_12', 'receita_bruta_12'],
    legal_taxes: ['fator_r', 'taxa_legal', 'irpf_2026', 'simples_nacional', 'tipo_debito', 'data_ajuizamento'],
    real_estate: ['tabela_price', 'sistema_sac', 'cap_rate', 'rental_income'],
    vehicles: ['cpk', 'weibull', 'ubi', 'tco_vehicle', 'milhas_km', 'receita_bruta', 'tipo_viagem'],
  };

  headers.forEach((h) => {
    for (const [sec, keywords] of Object.entries(headerSectorsMap)) {
      if (keywords.some((kw) => h.includes(kw))) {
        headerSectors.add(sec);
      }
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  for (let i = 1; i < transactionLines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCSVLine(transactionLines[i], delimiter);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
      skippedCount++;
      continue;
    }

    try {
      let rowId: string | undefined = undefined;
      if (idIdx !== -1 && cols[idIdx] !== undefined && cols[idIdx] !== null) {
        const cleanedId = cleanCell(cols[idIdx]);
        if (cleanedId.length > 0) {
          rowId = cleanedId;
        }
      }

      const rawDate = cols[dateIdx] || '';
      const normalizedDate = parseAndNormalizeDate(rawDate) || todayStr;

      const rawAmount = cols[amountIdx] || '0';
      let parsedVal = parseValue(rawAmount, isCentsColumn);
      if (parsedVal === null || isNaN(parsedVal)) {
        parsedVal = 0;
      }

      let entryType: TableRow['entryType'] = 'revenue';
      if (typeIdx !== -1 && cols[typeIdx]) {
        entryType = normalizeEntryType(cols[typeIdx]);
      } else if (categoryIdx !== -1 && cols[categoryIdx] && cols[categoryIdx].trim()) {
        entryType = normalizeEntryType(cols[categoryIdx]);
      }

      let description = '';
      if (descriptionIdx !== -1 && cols[descriptionIdx] !== undefined && cols[descriptionIdx] !== null) {
        description = cleanCell(cols[descriptionIdx]);
      }
      if (description === '' && descriptionIdx === -1) {
        description = 'IMPORTADO VIA PLANILHA';
      }

      const category = categoryIdx !== -1 && cols[categoryIdx]
        ? cleanCell(cols[categoryIdx])
        : 'Geral';

      const tags = tagsIdx !== -1 && cols[tagsIdx]
        ? cleanCell(cols[tagsIdx])
        : '';

      let metadataJson = '{}';
      if (metadataIdx !== -1 && cols[metadataIdx] !== undefined && cols[metadataIdx] !== null) {
        const rawMeta = cleanCell(cols[metadataIdx]);
        if (rawMeta.length > 0) {
          try {
            const parsedObj = JSON.parse(rawMeta);
            if (typeof parsedObj === 'object' && parsedObj !== null) {
              metadataJson = JSON.stringify(parsedObj);
            } else {
              metadataJson = '{}';
            }
          } catch {
            metadataJson = '{}';
          }
        }
      }

      // Recurrence and period fields
      let monthlyValue: number | undefined = undefined;
      if (monthlyValueIdx !== -1 && cols[monthlyValueIdx]) {
        const parsedMv = parseValue(cols[monthlyValueIdx]);
        if (parsedMv !== null && !isNaN(parsedMv)) monthlyValue = parsedMv;
      }

      let monthCount: number | undefined = undefined;
      if (monthCountIdx !== -1 && cols[monthCountIdx]) {
        const parsedMc = parseInt(cleanCell(cols[monthCountIdx]), 10);
        if (!isNaN(parsedMc)) monthCount = parsedMc;
      }

      let periodStart: string | undefined = undefined;
      if (periodStartIdx !== -1 && cols[periodStartIdx]) {
        const parsedPs = parseAndNormalizeDate(cols[periodStartIdx]);
        if (parsedPs) periodStart = parsedPs;
      }

      let periodEnd: string | undefined = undefined;
      if (periodEndIdx !== -1 && cols[periodEndIdx]) {
        const parsedPe = parseAndNormalizeDate(cols[periodEndIdx]);
        if (parsedPe) periodEnd = parsedPe;
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
      });
    } catch (err: any) {
      errors.push(`Linha ${lineNum}: ${err.message}`);
      skippedCount++;
    }
  }

  // Detect sectors from parsed rows
  const rowSectors = detectSectorsFromRows(rows);
  const detectedSectors = Array.from(new Set(['personal_finance', ...headerSectors, ...rowSectors]));

  console.log('[CSV Parser]: Total rows extracted from section ## ROWS ##:', rows.length);

  return {
    rows,
    errors,
    skippedCount,
    detectedSectors,
    metadata,
  };
}

export function exportRowsToCSV(rows: TableRow[]): string {
  const headers = ['id', 'date', 'value', 'description', 'entryType', 'category', 'tags', 'metadata_json'];
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const cols = [
      row.id || '',
      row.date || '',
      row.value.toFixed(2),
      `"${(row.description || '').replace(/"/g, '""')}"`,
      row.entryType || 'revenue',
      row.category && row.category.trim() ? `"${row.category.replace(/"/g, '""')}"` : '"Geral"',
      row.tags ? `"${row.tags.replace(/"/g, '""')}"` : '""',
      row.metadataJson && row.metadataJson.trim() ? `"${row.metadataJson.replace(/"/g, '""')}"` : '"{}"',
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


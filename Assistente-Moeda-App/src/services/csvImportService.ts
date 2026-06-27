/**
 * CSV Import Service — Assistente Moeda
 *
 * Parses CSV files into TableRow arrays for batch insertion.
 *
 * Supports TWO formats:
 *   1. "App Export" — Our own semicolon-delimited export format:
 *      Data;Tipo;Valor;Descrição;Período Início;Período Fim;Valor Mensal;Meses;Gerado Por
 *
 *   2. "Web Legacy" — The original web CoinAssistant format (flexible):
 *      Columns may be: Data, Valor, Descrição/Descricao, Tipo, etc.
 *      Delimiter: semicolon (;) or comma (,) — auto-detected.
 *      Values may use Brazilian format (1.234,56) or US format (1234.56).
 *
 * The parser:
 *   - Auto-detects delimiter (semicolon vs comma)
 *   - Auto-detects header row (skips it if found)
 *   - Normalizes date formats (DD/MM/YYYY → YYYY-MM-DD)
 *   - Normalizes Brazilian currency values (1.234,56 → 1234.56)
 *   - Maps column headers to TableRow fields by name
 */

import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { TableRow, TableGoals } from '../core/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CSVImportResult {
  success: boolean;
  rows: Omit<TableRow, 'id'>[];
  totalParsed: number;
  skippedLines: number;
  errors: string[];
  isBackupV2?: boolean;
  backupName?: string;
  backupDescription?: string;
  backupGoals?: TableGoals;
}

// ── Known Column Names → TableRow Field Mapping ──────────────────────────────

const COLUMN_MAP: Record<string, keyof TableRow> = {
  // Portuguese and English headers
  'data':            'date',
  'date':            'date',
  'dt':              'date',
  'valor':           'value',
  'value':           'value',
  'descricao':       'description',
  'descrição':       'description',
  'desc':            'description',
  'description':     'description',
  'tipo':            'entryType',
  'type':            'entryType',
  'entrytype':       'entryType',
  'periodo inicio':  'periodStart',
  'período início':  'periodStart',
  'periodstart':     'periodStart',
  'period_start':    'periodStart',
  'data inicial':    'periodStart',
  'data_inicial':    'periodStart',
  'periodo fim':     'periodEnd',
  'período fim':     'periodEnd',
  'periodend':       'periodEnd',
  'period_end':      'periodEnd',
  'data final':      'periodEnd',
  'data_final':      'periodEnd',
  'valor mensal':    'monthlyValue',
  'monthlyvalue':    'monthlyValue',
  'valor_mensal':    'monthlyValue',
  'meses':           'monthCount',
  'monthcount':      'monthCount',
  'month_count':     'monthCount',
  'gerado por':      'generatedBy',
  'generatedby':     'generatedBy',
  'generated_by':    'generatedBy',
};

const VALID_ENTRY_TYPES = new Set([
  'revenue', 'deposit', 'waiver', 'expense', 'partner_in', 'partner_out',
]);

// ── File Picker ──────────────────────────────────────────────────────────────

export async function pickCSVFile(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    if (Platform.OS === 'web') {
      // On web, read the file via fetch (the URI is a blob URL)
      const response = await fetch(asset.uri);
      const text = await response.text();
      return text;
    }

    // On native, read via FileSystem
    const content = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return content;
  } catch (error: any) {
    console.error('CSV pick error:', error);
    return null;
  }
}

// ── Parser ───────────────────────────────────────────────────────────────────

export function parseCSV(raw: string): CSVImportResult {
  if (raw.includes('## COIN ASSISTANT BACKUP v2 ##')) {
    return parseBackupV2(raw);
  }

  const errors: string[] = [];
  let skippedLines = 0;

  // Normalize line endings
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { success: false, rows: [], totalParsed: 0, skippedLines: 0, errors: ['Arquivo vazio'] };
  }

  // Auto-detect delimiter
  const delimiter = detectDelimiter(lines[0]);

  // Check if first line is a header
  const firstCols = splitCSVLine(lines[0], delimiter);
  const headerMap = tryMapHeaders(firstCols);
  const hasHeader = headerMap !== null;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: Omit<TableRow, 'id'>[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = hasHeader ? i + 2 : i + 1;
    const cols = splitCSVLine(dataLines[i], delimiter);

    try {
      const row = headerMap
        ? parseRowWithHeaders(cols, headerMap)
        : parseRowPositional(cols);

      if (row) {
        rows.push(row);
      } else {
        skippedLines++;
      }
    } catch (err: any) {
      errors.push(`Linha ${lineNum}: ${err.message}`);
      skippedLines++;
    }
  }

  return {
    success: rows.length > 0,
    rows,
    totalParsed: rows.length,
    skippedLines,
    errors,
  };
}

// ── Backup v2 Parser ──────────────────────────────────────────────────────────

function parseBackupV2(raw: string): CSVImportResult {
  const errors: string[] = [];
  let skippedLines = 0;

  // Split into metadata and rows
  const parts = raw.split('## ROWS ##');
  const metadataSection = parts[0] || '';
  const rowsSection = parts[1] || '';

  // Parse Metadata
  const dailyGoals: Record<number, number> = {};
  const weeklyGoals: Record<string | number, number> = {};
  const annualCosts: Record<number, number> = {};
  const years = new Set<number>();
  let name = 'Importado (Backup)';
  let description = 'Tabela importada via Backup v2';

  let globalDaily: number | undefined;
  let globalWeekly: number | undefined;
  let globalAnnual: number | undefined;

  const monthlyDaily: Record<string, number> = {};
  const monthlyWeekly: Record<string, number> = {};
  const monthlyAnnual: Record<string, number> = {};

  const metaLines = metadataSection
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  for (const line of metaLines) {
    if (!line || line.startsWith('#')) continue;
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const key = line.slice(0, commaIdx).trim();
    const val = line.slice(commaIdx + 1).trim();
    if (!key) continue;

    if (key === 'name') {
      name = val;
    } else if (key === 'description') {
      description = val;
    } else if (key === 'goal_global_daily') {
      globalDaily = parseFloat(val);
    } else if (key === 'goal_global_weekly') {
      globalWeekly = parseFloat(val);
    } else if (key === 'goal_global_annual') {
      globalAnnual = parseFloat(val);
    } else {
      const dailyMatch = key.match(/^goal_daily_(\d+)$/i);
      const weeklyMatch = key.match(/^goal_weekly_(\d{4}-W\d{2}|\d+)$/i);
      const annualMatch = key.match(/^goal_annual_(\d+)$/i);

      const monthlyDailyMatch = key.match(/^goal_monthly_daily_(\d{4}-\d{2})$/i);
      const monthlyWeeklyMatch = key.match(/^goal_monthly_weekly_(\d{4}-\d{2})$/i);
      const monthlyAnnualMatch = key.match(/^goal_monthly_annual_(\d{4}-\d{2})$/i);

      if (dailyMatch) {
        const year = parseInt(dailyMatch[1], 10);
        const parsedVal = parseFloat(val);
        if (!isNaN(year) && !isNaN(parsedVal)) {
          dailyGoals[year] = parsedVal;
          years.add(year);
        }
      } else if (weeklyMatch) {
        const weekOrYear = weeklyMatch[1];
        const parsedVal = parseFloat(val);
        if (weekOrYear && !isNaN(parsedVal)) {
          if (weekOrYear.includes('-W')) {
            weeklyGoals[weekOrYear] = parsedVal;
          } else {
            const year = parseInt(weekOrYear, 10);
            if (!isNaN(year)) {
              weeklyGoals[year] = parsedVal;
              years.add(year);
            }
          }
        }
      } else if (annualMatch) {
        const year = parseInt(annualMatch[1], 10);
        const parsedVal = parseFloat(val);
        if (!isNaN(year) && !isNaN(parsedVal)) {
          annualCosts[year] = parsedVal;
          years.add(year);
        }
      } else if (monthlyDailyMatch) {
        const month = monthlyDailyMatch[1];
        const parsedVal = parseFloat(val);
        if (month && !isNaN(parsedVal)) {
          monthlyDaily[month] = parsedVal;
        }
      } else if (monthlyWeeklyMatch) {
        const month = monthlyWeeklyMatch[1];
        const parsedVal = parseFloat(val);
        if (month && !isNaN(parsedVal)) {
          monthlyWeekly[month] = parsedVal;
        }
      } else if (monthlyAnnualMatch) {
        const month = monthlyAnnualMatch[1];
        const parsedVal = parseFloat(val);
        if (month && !isNaN(parsedVal)) {
          monthlyAnnual[month] = parsedVal;
        }
      }
    }
  }

  // Build globalGoals fallback profile
  let globalGoals: { dailyGoal: number; weeklyGoal: number; annualCost: number } | undefined;
  if (globalDaily !== undefined || globalWeekly !== undefined || globalAnnual !== undefined) {
    const fallbackWeekly = globalWeekly ?? (globalDaily ? globalDaily * 7 : 0);
    const fallbackDaily = globalDaily ?? Math.round((fallbackWeekly / 7) * 100) / 100;
    const fallbackAnnual = globalAnnual ?? fallbackWeekly * 52;
    globalGoals = {
      dailyGoal: Number(fallbackDaily),
      weeklyGoal: Number(fallbackWeekly),
      annualCost: Number(fallbackAnnual),
    };
  }

  // Build yearlyGoals overrides
  const yearlyGoals: Record<number, { dailyGoal: number; weeklyGoal: number; annualCost: number }> = {};
  for (const year of years) {
    const dg = dailyGoals[year];
    const wg = weeklyGoals[year];
    const ac = annualCosts[year];

    const finalWg = Number(wg !== undefined ? wg : (dg !== undefined ? dg * 7 : 0));
    const finalDg = Number(dg !== undefined ? dg : Math.round((finalWg / 7) * 100) / 100);
    const finalAc = Number(ac !== undefined ? ac : finalWg * 52);

    yearlyGoals[year] = {
      dailyGoal: Number(finalDg),
      weeklyGoal: Number(finalWg),
      annualCost: Number(finalAc),
    };

    if (dailyGoals[year] === undefined) dailyGoals[year] = Number(finalDg);
    if (weeklyGoals[year] === undefined) weeklyGoals[year] = Number(finalWg);
    if (annualCosts[year] === undefined) annualCosts[year] = Number(finalAc);
  }

  // Build monthlyGoals overrides
  const monthlyGoals: Record<string, { dailyGoal: number; weeklyGoal: number; annualCost: number }> = {};
  const monthlyMonths = new Set<string>([
    ...Object.keys(monthlyDaily),
    ...Object.keys(monthlyWeekly),
    ...Object.keys(monthlyAnnual),
  ]);
  for (const m of monthlyMonths) {
    const md = monthlyDaily[m];
    const mw = monthlyWeekly[m];
    const ma = monthlyAnnual[m];

    const finalMw = Number(mw !== undefined ? mw : (md !== undefined ? md * 7 : 0));
    const finalMd = Number(md !== undefined ? md : Math.round((finalMw / 7) * 100) / 100);
    const finalMa = Number(ma !== undefined ? ma : finalMw * 52);

    monthlyGoals[m] = {
      dailyGoal: Number(finalMd),
      weeklyGoal: Number(finalMw),
      annualCost: Number(finalMa),
    };
  }

  const goals: TableGoals = {
    dailyGoals,
    weeklyGoals,
    annualCosts,
    yearlyGoals,
    ...(globalGoals ? { globalGoals } : {}),
    ...(Object.keys(monthlyGoals).length > 0 ? { monthlyGoals } : {}),
  };

  // Parse Rows
  const rowLines = rowsSection
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rowLines.length === 0) {
    return {
      success: true,
      rows: [],
      totalParsed: 0,
      skippedLines: 0,
      errors: ['Nenhuma linha de dados encontrada após ## ROWS ##'],
      isBackupV2: true,
      backupName: name,
      backupDescription: description,
      backupGoals: goals,
    };
  }

  // Header parsing (comma delimiter)
  const headers = splitCSVLine(rowLines[0], ',');
  const headerMap = tryMapHeaders(headers);
  const dataLines = headerMap ? rowLines.slice(1) : rowLines;
  const rows: Omit<TableRow, 'id'>[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = metaLines.length + 1 + (headerMap ? i + 2 : i + 1);
    const cols = splitCSVLine(dataLines[i], ',');

    try {
      const row = headerMap
        ? parseRowWithHeaders(cols, headerMap)
        : parseRowPositional(cols);

      if (row) {
        rows.push(row);
      } else {
        skippedLines++;
      }
    } catch (err: any) {
      errors.push(`Linha ${lineNum}: ${err.message}`);
      skippedLines++;
    }
  }

  return {
    success: true,
    rows,
    totalParsed: rows.length,
    skippedLines,
    errors,
    isBackupV2: true,
    backupName: name,
    backupDescription: description,
    backupGoals: goals,
  };
}

// ── Delimiter Detection ──────────────────────────────────────────────────────

function detectDelimiter(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  // Tab detection
  const tabs = (line.match(/\t/g) || []).length;

  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

// ── CSV Line Splitter (handles quoted fields) ────────────────────────────────

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── Header Mapping ───────────────────────────────────────────────────────────

function tryMapHeaders(cols: string[]): Map<number, keyof TableRow> | null {
  const map = new Map<number, keyof TableRow>();

  for (let i = 0; i < cols.length; i++) {
    const normalized = cols[i]
      .toLowerCase()
      .replace(/['"]/g, '')
      .trim();

    const field = COLUMN_MAP[normalized];
    if (field) {
      map.set(i, field);
    }
  }

  // Must have at least 'date' and 'value' mapped to be a valid header
  const fields = new Set(map.values());
  if (fields.has('date') && fields.has('value')) {
    return map;
  }

  return null;
}

// ── Row Parsing (with headers) ───────────────────────────────────────────────

function parseRowWithHeaders(
  cols: string[],
  headerMap: Map<number, keyof TableRow>,
): Omit<TableRow, 'id'> | null {
  const raw: Record<string, string> = {};

  headerMap.forEach((field, colIdx) => {
    if (colIdx < cols.length) {
      raw[field] = cols[colIdx];
    }
  });

  return buildRow(raw);
}

// ── Row Parsing (positional — no headers) ────────────────────────────────────
// Assumes: Data, Tipo, Valor, Descrição  (or Data, Valor, Descrição)

function parseRowPositional(cols: string[]): Omit<TableRow, 'id'> | null {
  if (cols.length < 2) return null;

  // Try to detect: is col[1] a number? → [date, value, desc]
  // Or is col[2] a number? → [date, type, value, desc]
  const secondAsNum = parseValue(cols[1]);

  if (secondAsNum !== null && cols.length >= 2) {
    // Format: Date, Value, [Description], ...
    return buildRow({
      date: cols[0],
      value: cols[1],
      description: cols[2] || '',
      entryType: cols[3] || '',
    });
  }

  // Format: Date, Type, Value, [Description], ...
  return buildRow({
    date: cols[0],
    entryType: cols[1],
    value: cols[2] || '0',
    description: cols[3] || '',
    periodStart: cols[4] || '',
    periodEnd: cols[5] || '',
    monthlyValue: cols[6] || '',
    monthCount: cols[7] || '',
    generatedBy: cols[8] || '',
  });
}

// ── Build Row ────────────────────────────────────────────────────────────────

function buildRow(raw: Record<string, string>): Omit<TableRow, 'id'> | null {
  const dateStr = normalizeDate(raw.date || '');
  if (!dateStr) return null;

  const value = parseValue(raw.value || '0');
  if (value === null || value === 0) return null;

  const entryType = normalizeEntryType(raw.entryType || '');
  const description = (raw.description || '').replace(/^"|"$/g, '').trim() || undefined;

  const row: Omit<TableRow, 'id'> = {
    date: dateStr,
    value: Number(Math.round(value * 100) / 100),
    description,
    entryType,
  };

  // Optional fields
  const periodStart = normalizeDate(raw.periodStart || '');
  const periodEnd = normalizeDate(raw.periodEnd || '');
  if (periodStart && periodEnd) {
    row.periodStart = periodStart;
    row.periodEnd = periodEnd;
  }

  const monthlyValue = parseValue(raw.monthlyValue || '');
  if (monthlyValue !== null && monthlyValue > 0) {
    row.monthlyValue = Number(Math.round(monthlyValue * 100) / 100);
  }

  const monthCount = parseInt(raw.monthCount || '', 10);
  if (!isNaN(monthCount) && monthCount > 0) {
    row.monthCount = Number(monthCount);
  }

  const gen = (raw.generatedBy || '').trim().toLowerCase();
  if (gen === 'predicted' || gen === 'cloned') {
    row.generatedBy = gen;
  }

  return row;
}

// ── Date Normalization ───────────────────────────────────────────────────────

function normalizeDate(input: string): string | null {
  let s = input.replace(/['"]/g, '').trim();
  if (!s) return null;

  // Strip time signature if present (e.g. "2026-06-21 14:00:00" -> "2026-06-21")
  s = s.split(/\s+/)[0];
  if (!s) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY (US format — less common)
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    // If month > 12, it's probably DD/MM/YYYY
    if (parseInt(m) > 12) {
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
    }
  }

  return null;
}

// ── Value Normalization ──────────────────────────────────────────────────────

function parseValue(input: string): number | null {
  let s = input.replace(/['"R$\s]/g, '').trim();
  if (!s) return null;

  // Brazilian format: 1.234,56 → 1234.56
  if (s.includes(',') && s.includes('.')) {
    // "1.234,56" → dots are thousands sep, comma is decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "123,45" → comma is decimal
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : Math.abs(num);
}

// ── Entry Type Normalization ─────────────────────────────────────────────────

function normalizeEntryType(input: string): TableRow['entryType'] {
  const s = input.replace(/['"]/g, '').trim().toLowerCase();

  // Direct match
  if (VALID_ENTRY_TYPES.has(s)) return s as TableRow['entryType'];

  // Portuguese labels → types
  if (s.includes('receita') || s.includes('revenue')) return 'revenue';
  if (s.includes('despesa') || s.includes('expense') || s.includes('custo')) return 'expense';
  if (s.includes('depósito') || s.includes('deposito') || s.includes('deposit') || s.includes('investimento') || s.includes('aporte')) return 'deposit';
  if (s.includes('abono') || s.includes('waiver') || s.includes('justificativa')) return 'waiver';
  if (s.includes('sócio') || s.includes('socio') || s.includes('partner')) {
    if (s.includes('↑') || s.includes('out') || s.includes('pag')) return 'partner_out';
    return 'partner_in';
  }

  // Default
  return 'revenue';
}

// ── Full Import Flow ─────────────────────────────────────────────────────────

export async function importCSVFlow(): Promise<CSVImportResult> {
  const content = await pickCSVFile();

  if (!content) {
    return {
      success: false,
      rows: [],
      totalParsed: 0,
      skippedLines: 0,
      errors: ['Nenhum arquivo selecionado'],
    };
  }

  return parseCSV(content);
}

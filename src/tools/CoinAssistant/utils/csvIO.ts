/**
 * CSV Import / Export for Assistente Moeda
 *
 * File format:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ ## COIN ASSISTANT BACKUP v1 ##                             │  ← magic header
 * │ name,Motorista Executivo                                   │  ← metadata
 * │ description,Controle financeiro mensal                     │
 * │ goal_daily,86.00                                           │
 * │ goal_weekly,600.00                                         │
 * │ goal_annual,34736.50                                       │
 * │ ## ROWS ##                                                 │  ← section separator
 * │ date,value,description,entryType                          │  ← column header
 * │ 2026-01-26,300.00,Corrida para aeroporto,revenue          │  ← data rows
 * │ 2026-02-01,2000.00,Aporte mensal Tesouro,deposit          │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Backward compatibility: old CSVs without the entryType column are accepted;
 * missing entryType defaults to 'revenue'.
 *
 * - Fields containing commas, double-quotes, or newlines are RFC 4180-quoted.
 * - File is UTF-8 with a BOM (U+FEFF) for Excel compatibility.
 * - Line endings: CRLF for maximum spreadsheet compatibility.
 */

import type { CoinTable, TableGoals, TableRow } from '../types';

const MAGIC       = '## COIN ASSISTANT BACKUP v1 ##';
const ROWS_MARKER = '## ROWS ##';
const CRLF        = '\r\n';

// ── Exported type (rows lack IDs — assigned on import) ────────────────────────

export interface ImportedTable {
  name: string;
  description?: string;
  goals: TableGoals;
  rows: Array<Omit<TableRow, 'id'>>;
}

// ── Field-level CSV helpers ───────────────────────────────────────────────────

/**
 * RFC 4180: wrap in double-quotes if the value contains a comma, double-quote,
 * or newline. Existing double-quotes are doubled ("").
 */
function escapeField(raw: string | number | undefined): string {
  const s = String(raw ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Parse a single CSV line into an array of fields.
 * Handles quoted fields (commas inside quotes, doubled-quote escapes).
 */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Serialises a CoinTable into the Assistente Moeda CSV format.
 * Returns a string ready to be written to a file.
 */
export function exportTableToCSV(table: CoinTable): string {
  const sortedRows = [...table.rows].sort((a, b) => a.date.localeCompare(b.date));

  const lines = [
    MAGIC,
    `name,${escapeField(table.name)}`,
    `description,${escapeField(table.description ?? '')}`,
    `goal_daily,${table.goals.dailyGoal}`,
    `goal_weekly,${table.goals.weeklyGoal}`,
    `goal_annual,${table.goals.annualCost}`,
    ROWS_MARKER,
    'date,value,description,entryType',
    ...sortedRows.map(
      (r) =>
        `${r.date},${r.value},${escapeField(r.description ?? '')},${r.entryType ?? 'revenue'}`,
    ),
  ];

  // UTF-8 BOM (\uFEFF) ensures Excel opens the file correctly on all platforms
  return '\uFEFF' + lines.join(CRLF);
}

/**
 * Triggers a browser download of the table as a .csv file.
 * Filename is a slug derived from the table name.
 */
export function downloadCSV(table: CoinTable): void {
  const content = exportTableToCSV(table);
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href     = url;
  anchor.download = `${slugify(table.name)}-backup.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Converts a table name to a safe ASCII filename slug. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics (é→e, ã→a, etc.)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tabela'
  );
}

// ── Import ────────────────────────────────────────────────────────────────────

/**
 * Parses a CSV string produced by exportTableToCSV back into table data.
 * Throws a descriptive Portuguese error if the format is invalid.
 */
export function importTableFromCSV(csv: string): ImportedTable {
  // Strip optional BOM
  const cleaned = csv.startsWith('\uFEFF') ? csv.slice(1) : csv;
  const lines   = cleaned.split(/\r?\n/);

  // Validate magic header
  if (lines[0]?.trim() !== MAGIC) {
    throw new Error(
      'Arquivo inválido. Use apenas backups exportados pelo Assistente Moeda (.csv).',
    );
  }

  // ── Parse metadata ──────────────────────────────────────────────────────────
  const meta: Record<string, string> = {};
  let rowsSectionLine = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === ROWS_MARKER) {
      rowsSectionLine = i;
      break;
    }
    if (!line) continue;

    const firstComma = line.indexOf(',');
    if (firstComma === -1) continue;

    const key   = line.slice(0, firstComma).trim();
    // Use parseLine so that quoted values (with commas) are handled
    const value = parseLine(line)[1] ?? '';
    meta[key]   = value.trim();
  }

  if (rowsSectionLine === -1) {
    throw new Error('Seção de dados (## ROWS ##) não encontrada no arquivo.');
  }

  const goals: TableGoals = {
    dailyGoal:  parseFinite(meta['goal_daily'],  50),
    weeklyGoal: parseFinite(meta['goal_weekly'], 400),
    annualCost: parseFinite(meta['goal_annual'], 15000),
  };

  // ── Parse data rows ──────────────────────────────────────────────────────────
  // Header line is at rowsSectionLine + 1; detect whether entryType column exists
  const headerLine  = lines[rowsSectionLine + 1]?.toLowerCase() ?? '';
  const hasTypeCol  = headerLine.includes('entrytype');
  const dataStart   = rowsSectionLine + 2; // first actual data row

  const rows: Array<Omit<TableRow, 'id'>> = [];

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields    = parseLine(line);
    const date      = fields[0]?.trim() ?? '';
    const rawVal    = fields[1]?.trim() ?? '';
    const desc      = fields[2]?.trim() || undefined;
    const rawType   = hasTypeCol ? (fields[3]?.trim() ?? '') : '';
    const entryType = rawType === 'deposit' ? 'deposit' : 'revenue';

    // Skip rows with invalid date or non-numeric value
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = parseFloat(rawVal);
    if (isNaN(value) || value < 0) continue;

    rows.push({ date, value, description: desc, entryType });
  }

  return {
    name:        meta['name']?.trim()        || 'Tabela Importada',
    description: meta['description']?.trim() || undefined,
    goals,
    rows,
  };
}

/**
 * Reads a File object and resolves to parsed table data.
 * Rejects with a descriptive error on failure.
 */
export function readCSVFile(file: File): Promise<ImportedTable> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => {
      try {
        resolve(importTableFromCSV(e.target?.result as string));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo. Tente novamente.'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseFinite(raw: string | undefined, fallback: number): number {
  const n = parseFloat(raw ?? '');
  return isFinite(n) && n >= 0 ? n : fallback;
}

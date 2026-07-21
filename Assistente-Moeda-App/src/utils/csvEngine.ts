import type { TableRow } from '../core/types';
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

// Quote-aware CSV line splitter
export function splitCSVLine(line: string, delimiter: string): string[] {
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

// Date parser & normalizer
export function parseAndNormalizeDate(input: string): string | null {
  let s = input.replace(/['"]/g, '').trim();
  if (!s) return null;

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

  // MM/DD/YYYY (US)
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    if (parseInt(m) > 12) {
      return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
    }
  }

  return null;
}

// Value parser & normalizer
export function parseValue(input: string): number | null {
  let s = input.replace(/['"R$\s]/g, '').trim();
  if (!s) return null;

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

// Entry Type normalizer
const VALID_ENTRY_TYPES = new Set([
  'revenue', 'deposit', 'waiver', 'expense', 'partner_in', 'partner_out',
]);

export function normalizeEntryType(input: string): TableRow['entryType'] {
  const s = input.replace(/['"]/g, '').trim().toLowerCase();
  if (VALID_ENTRY_TYPES.has(s)) return s as TableRow['entryType'];

  if (s.includes('receita') || s.includes('revenue')) return 'revenue';
  if (s.includes('despesa') || s.includes('expense') || s.includes('custo')) return 'expense';
  if (s.includes('depósito') || s.includes('deposito') || s.includes('deposit') || s.includes('investimento') || s.includes('aporte')) return 'deposit';
  if (s.includes('abono') || s.includes('waiver') || s.includes('justificativa')) return 'waiver';
  if (s.includes('sócio') || s.includes('socio') || s.includes('partner')) {
    if (s.includes('out') || s.includes('pag')) return 'partner_out';
    return 'partner_in';
  }

  return 'revenue';
}

export interface CSVParseOutput {
  rows: Omit<TableRow, 'id'>[];
  errors: string[];
  skippedCount: number;
  detectedSectors: string[];
}

export function parseCSVText(csvText: string): CSVParseOutput {
  const errors: string[] = [];
  let skippedCount = 0;
  const rows: Omit<TableRow, 'id'>[] = [];

  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  const lines = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows, errors: ['O CSV está vazio.'], skippedCount: 0, detectedSectors: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/['"]/g, '').trim()
  );

  const dateIdx = headers.indexOf('date') !== -1 ? headers.indexOf('date') : headers.indexOf('data');
  const typeIdx = headers.indexOf('type') !== -1 ? headers.indexOf('type') : headers.indexOf('tipo');
  const categoryIdx = headers.indexOf('category') !== -1 ? headers.indexOf('category') : headers.indexOf('categoria');
  const amountIdx = headers.indexOf('amount') !== -1 ? headers.indexOf('amount') : headers.indexOf('valor');
  const descriptionIdx = headers.indexOf('description') !== -1 ? headers.indexOf('description') : headers.indexOf('descricao');
  const tagsIdx = headers.indexOf('tags') !== -1 ? headers.indexOf('tags') : headers.indexOf('etiquetas');
  const metadataIdx = headers.indexOf('metadata_json') !== -1 ? headers.indexOf('metadata_json') : headers.indexOf('metadados');

  if (dateIdx === -1 || amountIdx === -1) {
    return {
      rows,
      errors: ['Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas "date" / "data" e "amount" / "valor".'],
      skippedCount: 0,
      detectedSectors: [],
    };
  }

  // Scan headers for sector keywords (e.g. if column header itself indicates a sector)
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

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
      skippedCount++;
      continue;
    }

    try {
      const rawDate = cols[dateIdx] || '';
      const normalizedDate = parseAndNormalizeDate(rawDate);
      if (!normalizedDate) {
        throw new Error(`Data inválida ou em formato não reconhecido: "${rawDate}"`);
      }

      const rawAmount = cols[amountIdx] || '';
      const parsedVal = parseValue(rawAmount);
      if (parsedVal === null || isNaN(parsedVal)) {
        throw new Error(`Valor numérico inválido: "${rawAmount}"`);
      }

      const entryType = typeIdx !== -1 && cols[typeIdx]
        ? normalizeEntryType(cols[typeIdx])
        : 'revenue';

      const description = descriptionIdx !== -1 && cols[descriptionIdx]
        ? cols[descriptionIdx].replace(/^"|"$/g, '').trim()
        : 'IMPORTADO VIA PLANILHA';

      const category = categoryIdx !== -1 && cols[categoryIdx]
        ? cols[categoryIdx].replace(/^"|"$/g, '').trim()
        : undefined;

      const tags = tagsIdx !== -1 && cols[tagsIdx]
        ? cols[tagsIdx].replace(/^"|"$/g, '').trim()
        : undefined;

      const metadataJson = metadataIdx !== -1 && cols[metadataIdx]
        ? cols[metadataIdx].replace(/^"|"$/g, '').trim()
        : undefined;

      rows.push({
        date: normalizedDate,
        value: parsedVal,
        description,
        entryType,
        category,
        tags,
        metadataJson,
      });
    } catch (err: any) {
      errors.push(`Linha ${lineNum}: ${err.message}`);
      skippedCount++;
    }
  }

  // Detect sectors from parsed rows
  const rowSectors = detectSectorsFromRows(rows);
  const detectedSectors = Array.from(new Set([...headerSectors, ...rowSectors]));

  return {
    rows,
    errors,
    skippedCount,
    detectedSectors,
  };
}

export function exportRowsToCSV(rows: TableRow[]): string {
  const headers = ['date', 'value', 'description', 'entryType', 'category', 'tags', 'metadata_json'];
  const lines = [headers.join(',')];

  rows.forEach((row) => {
    const cols = [
      row.date || '',
      row.value.toFixed(2),
      `"${(row.description || '').replace(/"/g, '""')}"`,
      row.entryType || 'revenue',
      row.category ? `"${row.category.replace(/"/g, '""')}"` : '',
      row.tags ? `"${row.tags.replace(/"/g, '""')}"` : '',
      row.metadataJson ? `"${row.metadataJson.replace(/"/g, '""')}"` : '',
    ];
    lines.push(cols.join(','));
  });

  return lines.join('\n');
}

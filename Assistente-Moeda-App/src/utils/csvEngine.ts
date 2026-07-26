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
  if (!input) return null;
  let s = String(input).replace(/['"]/g, '').trim();
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
  let s = String(input).replace(/['"R$\s]/g, '').trim();
  if (!s) return null;

  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
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
  const s = String(input).replace(/['"]/g, '').trim().toLowerCase();
  if (!s) return 'revenue';

  if (s === 'receita') return 'revenue';
  if (s === 'despesa' || s === 'custo') return 'expense';
  if (s === 'depósito' || s === 'deposito') return 'deposit';
  if (s === 'abono' || s === 'justificativa') return 'waiver';

  // Return s unchanged (partner_in, partner_out, waiver, expense, revenue, deposit, custom string)
  return s as TableRow['entryType'];
}

export interface CSVParseOutput {
  rows: Omit<TableRow, 'id'>[];
  errors: string[];
  skippedCount: number;
  detectedSectors: string[];
  metadata?: {
    name?: string;
    description?: string;
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
  const rows: Omit<TableRow, 'id'>[] = [];
  let metadata: { name?: string; description?: string } | undefined = undefined;

  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
  
  // Section Parsing for Backup v2 (## COIN ASSISTANT BACKUP v2 ## / ## ROWS ##)
  let csvSourceText = cleaned;
  const rowsMarkerRegex = /##\s*ROWS\s*##/i;
  const rowsMarkerMatch = cleaned.match(rowsMarkerRegex);

  if (rowsMarkerMatch && rowsMarkerMatch.index !== undefined) {
    const headerBlock = cleaned.slice(0, rowsMarkerMatch.index);
    csvSourceText = cleaned.slice(rowsMarkerMatch.index + rowsMarkerMatch[0].length);

    // Extract metadata name and description from headerBlock
    const metaLines = headerBlock
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('##'));

    const metaObj: { name?: string; description?: string } = {};
    metaLines.forEach((line) => {
      const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 2) {
        const key = parts[0].toLowerCase();
        if (key === 'name') metaObj.name = parts[1];
        if (key === 'description') metaObj.description = parts[1];
      }
    });

    if (metaObj.name || metaObj.description) {
      metadata = metaObj;
    }
  }

  const lines = csvSourceText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { rows, errors: ['O CSV está vazio.'], skippedCount: 0, detectedSectors: [], metadata };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCSVLine(lines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/['"]/g, '').trim()
  );

  const dateAliases = ['date', 'data', 'data_movimento', 'created_at'];
  const descriptionAliases = ['description', 'descricao', 'historico', 'memo', 'title'];
  const amountAliases = ['amount', 'valor', 'value', 'valor_cents', 'amount_in_cents'];
  const categoryAliases = ['category', 'categoria', 'type'];
  const tagsAliases = ['tags', 'sector_tags', 'etiquetas'];
  const metadataAliases = ['metadata_json', 'metadatajson', 'metadata', 'metadados'];
  const typeAliases = ['entrytype', 'entry_type', 'tipo'];
  const monthlyValueAliases = ['monthlyvalue', 'valor_mensal', 'monthly_value'];
  const monthCountAliases = ['monthcount', 'qtd_meses', 'month_count', 'months'];
  const periodStartAliases = ['period_start', 'periodstart', 'inicio_periodo', 'period_inicio'];
  const periodEndAliases = ['period_end', 'periodend', 'fim_periodo', 'period_fim'];

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
      detectedSectors: [],
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

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cols = splitCSVLine(lines[i], delimiter);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
      skippedCount++;
      continue;
    }

    try {
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

      const description = descriptionIdx !== -1 && cols[descriptionIdx]
        ? cols[descriptionIdx].replace(/^"|"$/g, '').trim()
        : 'IMPORTADO VIA PLANILHA';

      const category = categoryIdx !== -1 && cols[categoryIdx]
        ? cols[categoryIdx].replace(/^"|"$/g, '').trim()
        : 'Geral';

      const tags = tagsIdx !== -1 && cols[tagsIdx]
        ? cols[tagsIdx].replace(/^"|"$/g, '').trim()
        : '';

      let metadataJson = '{}';
      if (metadataIdx !== -1 && cols[metadataIdx]) {
        const rawMeta = cols[metadataIdx].replace(/^"|"$/g, '').trim();
        if (rawMeta) {
          try {
            JSON.parse(rawMeta);
            metadataJson = rawMeta;
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
        const parsedMc = parseInt(cols[monthCountIdx].trim(), 10);
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
  const detectedSectors = Array.from(new Set([...headerSectors, ...rowSectors]));

  return {
    rows,
    errors,
    skippedCount,
    detectedSectors,
    metadata,
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

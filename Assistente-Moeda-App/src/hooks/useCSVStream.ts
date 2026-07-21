import { useCallback } from 'react';
import { useCoinDB } from './useCoinDB';
import { detectSectorsFromRows } from '../utils/sectorTagDetector';
import type { TableRow } from '../core/types';

export interface CSVStreamImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  autoActivatedSectors: string[];
}

// Delimiter detection helper
function detectDelimiter(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;

  if (tabs > semicolons && tabs > commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

// Quote-aware CSV line splitter
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

// Date parser & normalizer
function parseAndNormalizeDate(input: string): string | null {
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
function parseValue(input: string): number | null {
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

function normalizeEntryType(input: string): TableRow['entryType'] {
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

export function useCSVStream() {
  const { activeTable, addRows, updateActiveSectors } = useCoinDB() as any;

  const importCSVStream = useCallback(
    async (csvText: string): Promise<CSVStreamImportResult> => {
      if (!activeTable) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: ['Nenhuma tabela ativa selecionada.'],
          autoActivatedSectors: [],
        };
      }

      const errors: string[] = [];
      let skippedCount = 0;

      // Clean BOM if present and split lines
      const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;
      const lines = cleaned
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: ['O texto colado está vazio.'],
          autoActivatedSectors: [],
        };
      }

      // Detect delimiter from header line
      const delimiter = detectDelimiter(lines[0]);
      const headers = splitCSVLine(lines[0], delimiter).map((h) =>
        h.toLowerCase().replace(/['"]/g, '').trim()
      );

      // Verify header mappings
      const dateIdx = headers.indexOf('date');
      const typeIdx = headers.indexOf('type');
      const categoryIdx = headers.indexOf('category');
      const amountIdx = headers.indexOf('amount');
      const descriptionIdx = headers.indexOf('description');
      const tagsIdx = headers.indexOf('tags');
      const metadataIdx = headers.indexOf('metadata_json');

      if (dateIdx === -1 || amountIdx === -1) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: [
            'Cabeçalhos inválidos. O CSV precisa conter ao menos as colunas "date" e "amount".',
          ],
          autoActivatedSectors: [],
        };
      }

      const rowsToInsert: Omit<TableRow, 'id'>[] = [];

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
            : 'IMPORTADO VIA IA';

          const category = categoryIdx !== -1 && cols[categoryIdx]
            ? cols[categoryIdx].replace(/^"|"$/g, '').trim()
            : undefined;

          const tags = tagsIdx !== -1 && cols[tagsIdx]
            ? cols[tagsIdx].replace(/^"|"$/g, '').trim()
            : undefined;

          const metadataJson = metadataIdx !== -1 && cols[metadataIdx]
            ? cols[metadataIdx].replace(/^"|"$/g, '').trim()
            : undefined;

          rowsToInsert.push({
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

      if (rowsToInsert.length === 0) {
        return {
          success: false,
          importedCount: 0,
          skippedCount,
          errors,
          autoActivatedSectors: [],
        };
      }

      // Save valid rows
      await addRows(rowsToInsert);

      // Sector Auto-discovery tag detection
      const currentActiveSectors = activeTable.activeSectors || ['personal_finance'];
      const detectedSectors = detectSectorsFromRows(rowsToInsert);
      const sectorsToActivate = detectedSectors.filter(
        (sec) => !currentActiveSectors.includes(sec)
      );

      if (sectorsToActivate.length > 0) {
        const nextSectors = Array.from(new Set([...currentActiveSectors, ...sectorsToActivate]));
        await updateActiveSectors(nextSectors);
      }

      return {
        success: true,
        importedCount: rowsToInsert.length,
        skippedCount,
        errors,
        autoActivatedSectors: sectorsToActivate,
      };
    },
    [activeTable, addRows, updateActiveSectors]
  );

  return {
    importCSVStream,
  };
}

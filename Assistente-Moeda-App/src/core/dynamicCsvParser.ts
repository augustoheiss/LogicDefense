/**
 * Dynamic CSV Parser — Assistente Moeda
 *
 * Universal schema-agnostic CSV parser that:
 *   1. Tokenizes any CSV/TSV table regardless of delimiter (; or , or \t) and column count.
 *   2. Reconstructs DynamicTableSchema from ## SCHEMA_COLUMNS ## if present (Backup v3).
 *   3. Auto-infers types and semantic roles using typeInferenceEngine if importing a raw CSV.
 *   4. Transforms rows according to user-defined DynamicColumnDefinition rules (invertSign, multiplier, etc.).
 *   5. Preserves 100% of custom and non-standard columns in row.customValues and row.metadataJson.
 */

import type { TableRow, DynamicTableSchema, DynamicColumnDefinition, InvestorProfileConfig, InvestorProfileType, AssetAllocationTarget } from './types';
import { detectDelimiter, splitCSVLine, cleanCell, parseAndNormalizeDate, parseValue, normalizeEntryType, generateUUIDv4 } from '../utils/csvEngine';
import { inferColumnType } from './typeInferenceEngine';

export interface DynamicCSVParseResult {
  schema: DynamicTableSchema;
  rows: TableRow[];
  totalParsed: number;
  skippedLines: number;
  errors: string[];
  hasExplicitSchema: boolean;
  rawHeaders: string[];
  investorProfile?: InvestorProfileConfig;
}

/**
 * Parses raw CSV text into a dynamic schema and normalized TableRow array.
 */
export function parseDynamicCSV(
  csvText: string,
  tableId: string = 'default',
  options?: { fallbackEntryType?: TableRow['entryType']; forceEntryType?: TableRow['entryType'] }
): DynamicCSVParseResult {
  const errors: string[] = [];
  let skippedLines = 0;
  const cleaned = csvText.startsWith('\uFEFF') ? csvText.slice(1) : csvText;

  const allLines = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (allLines.length === 0) {
    const emptySchema: DynamicTableSchema = {
      version: 3,
      tableId,
      columns: [],
      delimiter: ';',
      hasHeaders: true,
      updatedAt: new Date().toISOString(),
    };
    return {
      schema: emptySchema,
      rows: [],
      totalParsed: 0,
      skippedLines: 0,
      errors: ['Arquivo CSV vazio.'],
      hasExplicitSchema: false,
      rawHeaders: [],
    };
  }

  // ── 1. Check for Structured Backup v3 Blocks ────────────────────────────────
  const schemaMarkerRegex = /##\s*SCHEMA_COLUMNS\s*##/i;
  const investorMarkerRegex = /##\s*INVESTOR_PROFILE\s*##/i;
  const rowsMarkerRegex = /##\s*ROWS\s*##/i;

  let schemaMarkerIdx = -1;
  let investorMarkerIdx = -1;
  let rowsMarkerIdx = -1;

  for (let i = 0; i < allLines.length; i++) {
    if (schemaMarkerRegex.test(allLines[i])) {
      schemaMarkerIdx = i;
    } else if (investorMarkerRegex.test(allLines[i])) {
      investorMarkerIdx = i;
    } else if (rowsMarkerRegex.test(allLines[i])) {
      rowsMarkerIdx = i;
    }
  }

  const hasExplicitSchema = schemaMarkerIdx !== -1 && rowsMarkerIdx !== -1 && rowsMarkerIdx > schemaMarkerIdx;

  if (hasExplicitSchema) {
    return parseStructuredV3CSV(allLines, schemaMarkerIdx, rowsMarkerIdx, tableId, investorMarkerIdx);
  }

  // ── 2. Parse Raw Arbitrary CSV ──────────────────────────────────────────────
  const firstLine = allLines[0];
  const delimiter = detectDelimiter(firstLine);
  const rawHeaders = splitCSVLine(firstLine, delimiter).map(cleanCell);

  // Collect data rows (up to 50 for sampling)
  const dataLines = allLines.slice(1);
  const sampleMatrix: string[][] = [];

  for (let i = 0; i < Math.min(dataLines.length, 50); i++) {
    const cols = splitCSVLine(dataLines[i], delimiter).map(cleanCell);
    sampleMatrix.push(cols);
  }

  // Infer Column Definitions
  const dynamicColumns: DynamicColumnDefinition[] = rawHeaders.map((header, colIdx) => {
    const samples = sampleMatrix.map((row) => row[colIdx] || '');
    const inference = inferColumnType(samples, header);
    const colId = header
      .toLowerCase()
      .replace(/[^a-z0-9_]/gi, '_')
      .replace(/^_+|_+$/g, '') || `col_${colIdx}`;

    return {
      id: colId,
      originalHeader: header,
      label: header || `Coluna ${colIdx + 1}`,
      dataType: inference.dataType,
      role: inference.role,
      visible: true,
      isCustom: inference.role === 'custom_attribute',
      transformRule: {
        invertSign: inference.suggestedInvertSign,
      },
    };
  });

  // Ensure there is at least one primary_date and primary_amount assigned
  ensureEssentialRoles(dynamicColumns);

  const schema: DynamicTableSchema = {
    version: 3,
    tableId,
    columns: dynamicColumns,
    delimiter,
    hasHeaders: true,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const rows = buildRowsFromDataLines(dataLines, delimiter, schema, errors, rawHeaders, options);

  return {
    schema,
    rows,
    totalParsed: rows.length,
    skippedLines: dataLines.length - rows.length,
    errors,
    hasExplicitSchema: false,
    rawHeaders,
  };
}

// ── Helper: Parse Structured Backup v3 (with explicit SCHEMA_COLUMNS block) ──

function parseStructuredV3CSV(
  allLines: string[],
  schemaMarkerIdx: number,
  rowsMarkerIdx: number,
  tableId: string,
  investorMarkerIdx: number = -1
): DynamicCSVParseResult {
  const errors: string[] = [];
  const schemaEndIdx = (investorMarkerIdx !== -1 && investorMarkerIdx < rowsMarkerIdx)
    ? investorMarkerIdx
    : rowsMarkerIdx;

  const schemaLines = allLines.slice(schemaMarkerIdx + 1, schemaEndIdx);
  const transactionLines = allLines.slice(rowsMarkerIdx + 1);

  if (schemaLines.length < 2 || transactionLines.length === 0) {
    throw new Error('Formato Backup v3 inválido: bloco de esquema ou dados corrompido.');
  }

  // Parse Investor Profile Block if present
  let investorProfile: InvestorProfileConfig | undefined = undefined;
  if (investorMarkerIdx !== -1 && investorMarkerIdx < rowsMarkerIdx) {
    const invLines = allLines.slice(investorMarkerIdx + 1, rowsMarkerIdx);
    let pType: InvestorProfileType = 'safety';
    let emGoal = 6;
    let fireMult = 25;
    let moGoal: number | undefined = undefined;
    let custAlloc: any = undefined;

    invLines.forEach((line) => {
      const parts = splitCSVLine(line, detectDelimiter(line));
      if (parts.length >= 2) {
        const k = parts[0].toLowerCase();
        const v = parts[1];
        if (k === 'profile_type') pType = v as InvestorProfileType;
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

    investorProfile = {
      profileType: pType,
      emergencyFundMonthsGoal: emGoal,
      fireTargetAnnualExpensesMultiplier: fireMult,
      monthlyContributionGoal: moGoal,
      customAllocations: custAlloc,
    };
  }

  // Extract table_id from metadata section above schemaMarkerIdx
  let effectiveTableId = tableId;
  const metaLines = allLines.slice(0, schemaMarkerIdx);
  metaLines.forEach((line) => {
    const parts = splitCSVLine(line, detectDelimiter(line));
    if (parts.length >= 2 && parts[0].toLowerCase() === 'table_id') {
      effectiveTableId = parts[1];
    }
  });

  const schemaDelim = detectDelimiter(schemaLines[0]);
  const schemaHeaders = splitCSVLine(schemaLines[0], schemaDelim).map((h) => cleanCell(h).toLowerCase());

  const idIdx = schemaHeaders.indexOf('id');
  const labelIdx = schemaHeaders.indexOf('label');
  const origHeaderIdx = schemaHeaders.indexOf('originalheader');
  const typeIdx = schemaHeaders.indexOf('datatype');
  const roleIdx = schemaHeaders.indexOf('role');
  const visibleIdx = schemaHeaders.indexOf('visible');
  const invertSignIdx = schemaHeaders.indexOf('invertsign');

  const columns: DynamicColumnDefinition[] = [];

  for (let i = 1; i < schemaLines.length; i++) {
    const cols = splitCSVLine(schemaLines[i], schemaDelim).map(cleanCell);
    if (cols.length < 2) continue;

    const id = idIdx !== -1 ? cols[idIdx] : `col_${i}`;
    const label = labelIdx !== -1 ? cols[labelIdx] : id;
    const orig = origHeaderIdx !== -1 ? cols[origHeaderIdx] : label;
    const dataType = (typeIdx !== -1 ? cols[typeIdx] : 'text') as any;
    const role = (roleIdx !== -1 ? cols[roleIdx] : 'custom_attribute') as any;
    const visible = visibleIdx !== -1 ? cols[visibleIdx] !== 'false' : true;
    const invertSign = invertSignIdx !== -1 ? cols[invertSignIdx] === 'true' : false;

    columns.push({
      id,
      label,
      originalHeader: orig,
      dataType: dataType || 'text',
      role: role || 'custom_attribute',
      visible,
      isCustom: role === 'custom_attribute',
      transformRule: {
        invertSign,
      },
    });
  }

  const dataDelim = detectDelimiter(transactionLines[0]);
  const rawHeaders = splitCSVLine(transactionLines[0], dataDelim).map(cleanCell);

  const schema: DynamicTableSchema = {
    version: 3,
    tableId: effectiveTableId,
    columns,
    delimiter: dataDelim,
    hasHeaders: true,
    updatedAt: new Date().toISOString(),
  };

  const rows = buildRowsFromDataLines(transactionLines.slice(1), dataDelim, schema, errors, rawHeaders);

  return {
    schema,
    rows,
    totalParsed: rows.length,
    skippedLines: transactionLines.length - 1 - rows.length,
    errors,
    hasExplicitSchema: true,
    rawHeaders,
    investorProfile,
  };
}

// ── Helper: Map Data Lines to TableRow[] Using DynamicTableSchema ───────────

export function buildRowsFromDataLines(
  dataLines: string[],
  delimiter: string,
  schema: DynamicTableSchema,
  errors: string[] = [],
  rawHeaders?: string[],
  options?: { fallbackEntryType?: TableRow['entryType']; forceEntryType?: TableRow['entryType'] }
): TableRow[] {
  const rows: TableRow[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // Map header lower names to index if rawHeaders is present
  const headerMap: Record<string, number> = {};
  if (rawHeaders) {
    rawHeaders.forEach((h, idx) => {
      headerMap[cleanCell(h).toLowerCase()] = idx;
    });
  }
  const hasNamedHeaders = rawHeaders && rawHeaders.length > 0;

  dataLines.forEach((line, lineIdx) => {
    const cols = splitCSVLine(line, delimiter).map(cleanCell);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) {
      return;
    }

    try {
      let rowId = (hasNamedHeaders && headerMap['id'] !== undefined && cols[headerMap['id']])
        ? cols[headerMap['id']]
        : generateUUIDv4();
      let rowDate = todayStr;
      let rowValue = 0;
      let rowDescription = '';
      let rowEntryType: TableRow['entryType'] = options?.forceEntryType || options?.fallbackEntryType || 'revenue';
      let rowCategory = 'Geral';
      let rowTags = '';
      let rowTicker: string | undefined = undefined;
      let rowQuantity: number | undefined = undefined;
      let rowUnitPrice: number | undefined = undefined;
      let rowPeriodStart: string | undefined = undefined;
      let rowPeriodEnd: string | undefined = undefined;
      let rowMonthlyValue: number | undefined = undefined;
      let rowMonthCount: number | undefined = undefined;
      const customValues: Record<string, string | number | boolean> = {};

      schema.columns.forEach((colDef, colIdx) => {
        let rawVal = cols[colIdx];
        if (hasNamedHeaders) {
          const colKey = colDef.id.toLowerCase();
          const origKey = (colDef.originalHeader || '').toLowerCase();
          const labelKey = (colDef.label || '').toLowerCase();
          const targetIdx = headerMap[colKey] ?? headerMap[origKey] ?? headerMap[labelKey];
          if (targetIdx !== undefined && cols[targetIdx] !== undefined) {
            rawVal = cols[targetIdx];
          }
        }

        if (rawVal === undefined || rawVal === null) return;

        switch (colDef.role) {
          case 'primary_date': {
            const parsedDate = parseAndNormalizeDate(rawVal);
            if (parsedDate) rowDate = parsedDate;
            break;
          }
          case 'primary_amount': {
            let num = parseValue(rawVal);
            if (num !== null && !isNaN(num)) {
              if (colDef.transformRule?.invertSign) {
                num = -num;
              }
              if (colDef.transformRule?.multiplier) {
                num = num * colDef.transformRule.multiplier;
              }
              rowValue = num;
            }
            break;
          }
          case 'primary_description': {
            rowDescription = cleanCell(rawVal);
            break;
          }
          case 'entry_type': {
            rowEntryType = normalizeEntryType(rawVal);
            break;
          }
          case 'category': {
            rowCategory = cleanCell(rawVal) || 'Geral';
            break;
          }
          case 'tags': {
            rowTags = cleanCell(rawVal);
            break;
          }
          case 'invest_ticker': {
            const t = cleanCell(rawVal).toUpperCase();
            if (t) rowTicker = t;
            break;
          }
          case 'invest_quantity': {
            const q = parseFloat(cleanCell(rawVal));
            if (!isNaN(q)) rowQuantity = q;
            break;
          }
          case 'invest_unit_price': {
            const p = parseValue(rawVal);
            if (p !== null && !isNaN(p)) rowUnitPrice = p;
            break;
          }
          case 'period_start': {
            const ps = parseAndNormalizeDate(rawVal);
            if (ps) rowPeriodStart = ps;
            break;
          }
          case 'period_end': {
            const pe = parseAndNormalizeDate(rawVal);
            if (pe) rowPeriodEnd = pe;
            break;
          }
          case 'monthly_value': {
            const mv = parseValue(rawVal);
            if (mv !== null && !isNaN(mv)) rowMonthlyValue = mv;
            break;
          }
          case 'month_count': {
            const mc = parseInt(cleanCell(rawVal), 10);
            if (!isNaN(mc)) rowMonthCount = mc;
            break;
          }
          case 'custom_attribute':
          default: {
            customValues[colDef.id] = rawVal;
            break;
          }
        }
      });

      // Also capture named standard and investment fields if not part of schema
      if (hasNamedHeaders && !options?.forceEntryType) {
        const typeIdx = headerMap['entrytype'] ?? headerMap['entry_type'] ?? headerMap['tipo'] ?? headerMap['type'];
        if (typeIdx !== undefined && cols[typeIdx]) {
          rowEntryType = normalizeEntryType(cols[typeIdx]);
        }
        const catIdx = headerMap['category'] ?? headerMap['categoria'];
        if (catIdx !== undefined && cols[catIdx]) {
          rowCategory = cleanCell(cols[catIdx]) || rowCategory;
        }
        const tagIdx = headerMap['tags'] ?? headerMap['etiquetas'];
        if (tagIdx !== undefined && cols[tagIdx]) {
          rowTags = cleanCell(cols[tagIdx]) || rowTags;
        }
        if (!rowTicker && headerMap['ticker'] !== undefined && cols[headerMap['ticker']]) {
          rowTicker = cleanCell(cols[headerMap['ticker']]).toUpperCase();
        }
        if (rowQuantity === undefined && headerMap['quantity'] !== undefined && cols[headerMap['quantity']]) {
          const q = parseFloat(cleanCell(cols[headerMap['quantity']]));
          if (!isNaN(q)) rowQuantity = q;
        }
        if (rowUnitPrice === undefined && headerMap['unitprice'] !== undefined && cols[headerMap['unitprice']]) {
          const p = parseValue(cols[headerMap['unitprice']]);
          if (p !== null && !isNaN(p)) rowUnitPrice = p;
        }
        if (rowMonthlyValue === undefined && headerMap['monthlyvalue'] !== undefined && cols[headerMap['monthlyvalue']]) {
          const mv = parseValue(cols[headerMap['monthlyvalue']]);
          if (mv !== null && !isNaN(mv)) rowMonthlyValue = mv;
        }
        if (rowMonthCount === undefined && headerMap['monthcount'] !== undefined && cols[headerMap['monthcount']]) {
          const mc = parseInt(cleanCell(cols[headerMap['monthcount']]), 10);
          if (!isNaN(mc)) rowMonthCount = mc;
        }
        if (!rowPeriodStart && headerMap['period_start'] !== undefined && cols[headerMap['period_start']]) {
          const ps = parseAndNormalizeDate(cols[headerMap['period_start']]);
          if (ps) rowPeriodStart = ps;
        }
        if (!rowPeriodEnd && headerMap['period_end'] !== undefined && cols[headerMap['period_end']]) {
          const pe = parseAndNormalizeDate(cols[headerMap['period_end']]);
          if (pe) rowPeriodEnd = pe;
        }
      }

      // If value is negative and entryType was still default 'revenue', calibrate to 'expense'
      if (rowValue < 0 && rowEntryType === 'revenue') {
        rowEntryType = 'expense';
      }

      const row: TableRow = {
        id: rowId,
        date: rowDate,
        value: rowValue,
        description: rowDescription || 'Item Importado',
        entryType: rowEntryType,
        category: rowCategory,
        tags: rowTags,
        metadataJson: Object.keys(customValues).length > 0 ? JSON.stringify(customValues) : '{}',
        createdAt: new Date().toISOString(),
        ...(rowTicker ? { ticker: rowTicker } : {}),
        ...(rowQuantity !== undefined ? { quantity: rowQuantity } : {}),
        ...(rowUnitPrice !== undefined ? { unitPrice: rowUnitPrice } : {}),
        ...(rowPeriodStart ? { periodStart: rowPeriodStart } : {}),
        ...(rowPeriodEnd ? { periodEnd: rowPeriodEnd } : {}),
        ...(rowMonthlyValue !== undefined ? { monthlyValue: rowMonthlyValue } : {}),
        ...(rowMonthCount !== undefined ? { monthCount: rowMonthCount } : {}),
        ...(Object.keys(customValues).length > 0 ? { customValues } : {}),
      };

      rows.push(row);
    } catch (err: any) {
      errors.push(`Linha ${lineIdx + 2}: ${err.message}`);
    }
  });

  return rows;
}

// ── Ensure Date and Amount Roles Exist ───────────────────────────────────────

function ensureEssentialRoles(columns: DynamicColumnDefinition[]): void {
  const hasDate = columns.some((c) => c.role === 'primary_date');
  const hasAmount = columns.some((c) => c.role === 'primary_amount');

  if (!hasDate) {
    const firstDateCol = columns.find((c) => c.dataType === 'date');
    if (firstDateCol) {
      firstDateCol.role = 'primary_date';
    } else if (columns.length > 0) {
      columns[0].role = 'primary_date';
    }
  }

  if (!hasAmount) {
    const firstMoneyCol = columns.find((c) => c.dataType === 'money');
    if (firstMoneyCol) {
      firstMoneyCol.role = 'primary_amount';
    } else {
      const firstNumCol = columns.find((c) => c.dataType === 'number');
      if (firstNumCol) {
        firstNumCol.role = 'primary_amount';
      }
    }
  }
}

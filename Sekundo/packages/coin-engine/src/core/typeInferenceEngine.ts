/**
 * Type Inference Engine — Assistente Moeda
 *
 * Statistical heuristic analysis that infers data types and semantic roles
 * by sampling raw values from arbitrary CSV columns.
 *
 * Supports Brazilian and international financial patterns:
 *   - Dates: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, ISO timestamps
 *   - Money: R$ 1.500,00, -45,90, (120.00), $150.00, 1500.00
 *   - Financial Tickers: PETR4, VALE3, HGLG11, MXRF11, IVVB11, BTC, ETH, etc.
 *   - Entry Types: Receita, Despesa, Depósito, Aporte, Parceria, Abono
 *   - Categories, Tags, Quantities, Unit Prices, and Custom Attributes
 */

import type { ColumnDataType, ColumnSemanticRole, DynamicColumnDefinition, DynamicTableSchema } from './types';

// ── Clean & Normalize Value Sample ───────────────────────────────────────────

function cleanSample(val: string | null | undefined): string {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

// ── Type Checkers ────────────────────────────────────────────────────────────

export function isDateSample(val: string): boolean {
  const s = cleanSample(val);
  if (!s || s.length < 6) return false;
  const noTime = s.split(/[\sT]/)[0];

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}$/.test(noTime)) return true;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}$/.test(noTime)) return true;

  // DD/MM/YY or MM/DD/YY (short year)
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2}$/.test(noTime)) return true;

  return false;
}

export function isMoneySample(val: string): boolean {
  const s = cleanSample(val);
  if (!s) return false;

  // Explicit currency symbols
  if (/[R$€£¥]/.test(s)) return true;

  // Brazilian currency pattern: 1.234,56 or -1.234,56 or 1234,56 or 45,90
  if (/^-?(\d{1,3}(\.\d{3})+|\d+),\d{2}$/.test(s)) return true;

  // US currency pattern: 1,234.56 or -1,234.56 or 1234.56 or 45.90
  if (/^-?(\d{1,3}(,\d{3})+|\d+)\.\d{2}$/.test(s)) return true;

  // Accounting parenthesized negative: (150.00) or (150,00)
  if (/^\(\s*(\d{1,3}([.,]\d{3})+|\d+)[.,]\d{2}\s*\)$/.test(s)) return true;

  return false;
}

export function isTickerSample(val: string): boolean {
  const s = cleanSample(val).toUpperCase();
  if (!s || s.length < 3 || s.length > 10) return false;

  // B3 Shares & FIIs: PETR4, VALE3, HGLG11, MXRF11, BOVA11, IVVB11, BIDI4T
  if (/^[A-Z]{4}(3|4|5|6|11|12|34)[B]?$/.test(s)) return true;

  // Major Crypto tickers
  if (/^(BTC|ETH|SOL|USDT|USDC|BNB|ADA|XRP|DOT|AVAX|MATIC|LINK)$/.test(s)) return true;

  // US Equities: AAPL, MSFT, GOOGL, NVDA, AMZN, TSLA, SPY, QQQ, VOO
  if (/^[A-Z]{1,5}$/.test(s) && (s === 'SPY' || s === 'QQQ' || s === 'VOO' || s === 'IVV')) return true;

  return false;
}

export function isEntryTypeSample(val: string): boolean {
  const s = cleanSample(val).toLowerCase();
  if (!s) return false;
  const known = [
    'receita', 'despesa', 'custo', 'depósito', 'deposito', 'aporte',
    'investimento', 'abono', 'justificativa', 'waiver', 'partner_in', 'partner_out',
    'sócio', 'socio', 'crédito', 'credito', 'débito', 'debito', 'revenue', 'expense', 'deposit'
  ];
  return known.includes(s);
}

export function isQuantitySample(val: string): boolean {
  const s = cleanSample(val);
  if (!s) return false;
  return /^-?\d+$/.test(s);
}

export function isNumberSample(val: string): boolean {
  const s = cleanSample(val).replace(/\s/g, '');
  if (!s) return false;
  return /^-?\d+([.,]\d+)?$/.test(s);
}

// ── Role Inferrer by Header Name ─────────────────────────────────────────────

function inferRoleByHeader(headerName: string, dataType: ColumnDataType): ColumnSemanticRole {
  const h = headerName.toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (/^(data|date|dt|datamovimento|dtmovimento|competencia|createdat)$/.test(h)) {
    return 'primary_date';
  }
  if (/^(valor|value|amount|valortotal|valorliquido|saldo|total|preco|price)$/.test(h)) {
    return 'primary_amount';
  }
  if (/^(descricao|description|desc|memo|historico|title|item|estabelecimento)$/.test(h)) {
    return 'primary_description';
  }
  if (/^(tipo|type|entrytype|operacao|natureza)$/.test(h)) {
    return 'entry_type';
  }
  if (/^(categoria|category|classe|rubrica|subcategoria)$/.test(h)) {
    return 'category';
  }
  if (/^(tags|tag|setor|etiquetas)$/.test(h)) {
    return 'tags';
  }
  if (/^(ticker|ativo|papel|codigo|symbol|codigonegociacao)$/.test(h)) {
    return 'invest_ticker';
  }
  if (/^(quantidade|qtd|quant|shares|quantity|cotas)$/.test(h)) {
    return 'invest_quantity';
  }
  if (/^(precomedio|pm|unitario|preco_unitario|unitprice|cotacao)$/.test(h)) {
    return 'invest_unit_price';
  }
  if (/^(periodoinicio|periodstart|datainicial|inicio)$/.test(h)) {
    return 'period_start';
  }
  if (/^(periodofim|periodend|datafinal|fim)$/.test(h)) {
    return 'period_end';
  }
  if (/^(valormensal|monthlyvalue)$/.test(h)) {
    return 'monthly_value';
  }
  if (/^(meses|monthcount|qtdmeses)$/.test(h)) {
    return 'month_count';
  }

  // Fallbacks by DataType
  if (dataType === 'date') return 'primary_date';
  if (dataType === 'money') return 'primary_amount';
  if (dataType === 'ticker') return 'invest_ticker';
  if (dataType === 'entryType') return 'entry_type';
  if (dataType === 'category') return 'category';

  return 'custom_attribute';
}

// ── Inferred Column Output ───────────────────────────────────────────────────

export interface InferredColumnResult {
  dataType: ColumnDataType;
  role: ColumnSemanticRole;
  confidence: number; // 0 to 1
  suggestedInvertSign: boolean;
  sampleSummary: string;
}

/**
 * Evaluates an array of samples from a column and returns the inferred DataType and Role.
 */
export function inferColumnType(samples: string[], headerName: string = ''): InferredColumnResult {
  const validSamples = samples
    .map(cleanSample)
    .filter((s) => s.length > 0)
    .slice(0, 50);

  if (validSamples.length === 0) {
    const role = inferRoleByHeader(headerName, 'text');
    return {
      dataType: 'text',
      role,
      confidence: 0.1,
      suggestedInvertSign: false,
      sampleSummary: 'Vazio',
    };
  }

  let dateScore = 0;
  let moneyScore = 0;
  let tickerScore = 0;
  let entryTypeScore = 0;
  let numberScore = 0;
  let qtyScore = 0;

  validSamples.forEach((val) => {
    if (isDateSample(val)) dateScore++;
    if (isMoneySample(val)) moneyScore++;
    if (isTickerSample(val)) tickerScore++;
    if (isEntryTypeSample(val)) entryTypeScore++;
    if (isQuantitySample(val)) qtyScore++;
    if (isNumberSample(val)) numberScore++;
  });

  const total = validSamples.length;
  const dateRatio = dateScore / total;
  const moneyRatio = moneyScore / total;
  const tickerRatio = tickerScore / total;
  const entryTypeRatio = entryTypeScore / total;
  const numberRatio = numberScore / total;
  const qtyRatio = qtyScore / total;

  let inferredType: ColumnDataType = 'text';
  let confidence = 0.5;

  if (dateRatio >= 0.7) {
    inferredType = 'date';
    confidence = dateRatio;
  } else if (entryTypeRatio >= 0.6) {
    inferredType = 'entryType';
    confidence = entryTypeRatio;
  } else if (tickerRatio >= 0.5) {
    inferredType = 'ticker';
    confidence = tickerRatio;
  } else if (moneyRatio >= 0.6) {
    inferredType = 'money';
    confidence = moneyRatio;
  } else if (qtyRatio >= 0.8 && !headerName.toLowerCase().includes('valor')) {
    inferredType = 'quantity';
    confidence = qtyRatio;
  } else if (numberRatio >= 0.7) {
    // If header suggests money (e.g. valor, amount), prefer money
    const h = headerName.toLowerCase();
    if (h.includes('valor') || h.includes('amount') || h.includes('total') || h.includes('saldo') || h.includes('preco')) {
      inferredType = 'money';
    } else {
      inferredType = 'number';
    }
    confidence = numberRatio;
  } else {
    // Check if unique values ratio is small -> Category
    const uniqueValues = new Set(validSamples.map((v) => v.toLowerCase())).size;
    if (uniqueValues <= 5 && total >= 5) {
      inferredType = 'category';
      confidence = 0.75;
    } else {
      inferredType = 'text';
      confidence = 0.8;
    }
  }

  const role = inferRoleByHeader(headerName, inferredType);

  // Check if sign inversion should be suggested (e.g. credit card bill where expenses are positive)
  const isCardHeader = /fatura|cartao|credit_card|nubank_fatura|itau_card/i.test(headerName);
  const suggestedInvertSign = isCardHeader && inferredType === 'money';

  const sampleSummary = validSamples.slice(0, 3).join(', ');

  return {
    dataType: inferredType,
    role,
    confidence,
    suggestedInvertSign,
    sampleSummary,
  };
}

/**
 * Creates a complete DynamicTableSchema by inferring column definitions
 * from raw headers and a sample set of data rows.
 */
export function inferTableSchema(
  headers: string[],
  sampleRows: Record<string, string>[] = [],
  tableId: string = 'default'
): DynamicTableSchema {
  const columns: DynamicColumnDefinition[] = headers.map((h, idx) => {
    const samples = sampleRows.map((r) => r[h] || '').filter((v) => v.length > 0);
    const inference = inferColumnType(samples, h);
    const key = h.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    return {
      id: key || `col_${idx}`,
      key,
      originalHeader: h,
      rawHeader: h,
      label: h,
      dataType: inference.dataType,
      role: inference.role,
      semanticRole: inference.role,
      invertSign: inference.suggestedInvertSign,
      visible: true,
      isCustom: !['data', 'valor', 'descricao', 'tipo', 'categoria'].includes(key),
      originalIndex: idx,
      transformRule: {
        invertSign: inference.suggestedInvertSign,
      },
    };
  });

  return {
    version: 3,
    tableId,
    columns,
    delimiter: ';',
    hasHeaders: true,
    updatedAt: new Date().toISOString(),
  };
}

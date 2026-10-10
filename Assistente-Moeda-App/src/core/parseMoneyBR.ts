/**
 * Brazilian & Universal Currency Parsing Utility — Assistente Moeda
 *
 * Reliably parses currency strings in Brazilian Portuguese ("1.234,56", "R$ 50,00", "12,5")
 * as well as international numbers ("1234.56", "-50.00").
 */

export function parseMoneyBR(input: string | number | null | undefined, defaultValue = 0): number {
  if (input === null || input === undefined) return defaultValue;
  if (typeof input === 'number') return isNaN(input) ? defaultValue : input;

  let raw = input.trim();
  if (!raw) return defaultValue;

  // Detect sign
  const isNegative = raw.includes('-') || (raw.startsWith('(') && raw.endsWith(')'));

  // Remove currency symbols, parentheses, non-numeric characters except '.' and ','
  raw = raw.replace(/[^\d.,]/g, '');

  if (!raw) return defaultValue;

  // Handle formats:
  // Case 1: Both '.' and ',' present
  if (raw.includes('.') && raw.includes(',')) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Brazilian format: 1.234.567,89 -> remove dots, replace comma with dot
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234,567.89 -> remove commas
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    // Only comma present: "1234,56" or "12,5" -> convert comma to dot
    // But check if it's thousands separator like "1,000,000" without decimal:
    const commaParts = raw.split(',');
    if (commaParts.length > 2) {
      // multiple commas -> thousand separators
      raw = raw.replace(/,/g, '');
    } else {
      raw = raw.replace(',', '.');
    }
  } else if (raw.includes('.')) {
    // Only dot present: "1234.56" or "1.000.000"
    const dotParts = raw.split('.');
    if (dotParts.length > 2) {
      // multiple dots -> Brazilian thousand separators
      raw = raw.replace(/\./g, '');
    } else {
      // single dot -> standard float
      // raw remains as-is
    }
  }

  const num = parseFloat(raw);
  if (isNaN(num)) return defaultValue;

  return isNegative ? -Math.abs(num) : Math.abs(num);
}

/**
 * Parses batch values from a text block.
 * Supports delimiters: semicolons (;), newlines (\n), pipes (|), or commas (when not used as decimals).
 *
 * Example:
 * "12,50; 34,90; 100" -> [12.5, 34.9, 100]
 * "12.50, 34.90, 100" -> [12.5, 34.9, 100]
 * "10\n20,50\n30" -> [10, 20.5, 30]
 */
export function parseBatchAmounts(text: string): number[] {
  if (!text || typeof text !== 'string') return [];

  // If text contains semicolons, newlines, or pipes, use those as primary delimiters
  let tokens: string[] = [];
  if (/[;\n|]/.test(text)) {
    tokens = text.split(/[;\n|]+/).map((s) => s.trim()).filter(Boolean);
  } else if (text.includes(',')) {
    // Ambiguity: is comma a separator between numbers, or a decimal separator?
    // If we have items like "10, 20, 30" (integers with spaces), or "12,50, 34,80"
    // Heuristic: if comma is followed by space, or if comma separates numbers
    const parts = text.split(/,\s+/);
    if (parts.length > 1) {
      // Split by comma+space
      tokens = parts.map((s) => s.trim()).filter(Boolean);
    } else {
      // Single token or decimal number
      tokens = [text.trim()];
    }
  } else {
    // Split by spaces
    tokens = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  }

  const result: number[] = [];
  for (const token of tokens) {
    const val = parseMoneyBR(token);
    if (!isNaN(val) && val > 0) {
      result.push(val);
    }
  }

  return result;
}

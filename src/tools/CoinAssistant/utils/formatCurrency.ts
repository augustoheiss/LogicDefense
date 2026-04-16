/**
 * Smart Currency Formatting for Assistente Moeda
 *
 * Prevents layout breaks in dashboard metric cards by abbreviating
 * large values while keeping full precision in tooltips/exports.
 *
 * Rules:
 *   value < 1 000           → R$ 123,45     (full BRL)
 *   value < 1 000 000       → R$ 1,5k
 *   value < 1 000 000 000   → R$ 2,2m
 *   value >= 1 000 000 000  → R$ 10b
 *   If result > 8 chars     → R$ 1.2e12      (scientific fallback)
 *
 * Negative values retain sign: -R$ 1,5k
 */

const SUFFIXES: [number, string][] = [
  [1_000_000_000, 'b'],
  [1_000_000,     'm'],
  [1_000,         'k'],
];

/**
 * Abbreviated currency for compact UI cards.
 * Use this in MetricCard values, quick stats, etc.
 */
export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs  = Math.abs(value);

  // Small values — full formatting
  if (abs < 1_000) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Try each suffix tier
  for (const [threshold, suffix] of SUFFIXES) {
    if (abs >= threshold) {
      const scaled = abs / threshold;
      // Use 1 decimal if it adds information, 0 if it's an integer
      const decimals = scaled >= 100 ? 0 : scaled % 1 === 0 ? 0 : 1;
      const formatted = scaled.toFixed(decimals);

      // Scientific fallback: if the formatted+suffix is too long
      if (formatted.length > 6) {
        return `${sign}R$ ${abs.toExponential(1)}`;
      }

      return `${sign}R$ ${formatted.replace('.', ',')}${suffix}`;
    }
  }

  // Should never reach here, but safety net
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Full precision BRL formatting (the legacy `fmt` function).
 * Use in tooltips, CSV export, detailed views, and WhatsApp reports.
 */
export function formatCurrencyFull(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Signed balance formatting: +R$ 1,2k or -R$ 800,00
 * Always shows explicit sign for positive values.
 */
export function formatBalanceShort(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrencyShort(value)}`;
}

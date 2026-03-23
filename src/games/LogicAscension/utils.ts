// ── Number display utilities ───────────────────────────────────────────────────

/**
 * Formats a raw power/level number into a compact, human-readable string.
 *
 * < 1K       → exact integer      (e.g. 999)
 * 1K–999K    → 1-decimal + K      (e.g. 1.5K, 42K)
 * 1M–999M    → 1-decimal + M      (e.g. 1.2M)
 * 1B–999B    → 1-decimal + B      (e.g. 3.4B)
 * 1T–999T    → 1-decimal + T      (e.g. 1.1T)
 * ≥ 1 Quad   → scientific         (e.g. 1.5e15)
 *
 * Trailing ".0" decimals are stripped so output reads cleanly (1K not 1.0K).
 */
export function formatPower(num: number): string {
  const fmt = (n: number, suffix: string) => {
    const s = n.toFixed(1);
    return (s.endsWith('.0') ? s.slice(0, -2) : s) + suffix;
  };

  if (num < 1_000)               return String(Math.round(num));
  if (num < 1_000_000)           return fmt(num / 1_000,               'K');
  if (num < 1_000_000_000)       return fmt(num / 1_000_000,           'M');
  if (num < 1_000_000_000_000)   return fmt(num / 1_000_000_000,       'B');
  if (num < 1_000_000_000_000_000) return fmt(num / 1_000_000_000_000, 'T');

  // ≥ 1 Quadrillion → clean scientific notation (strip trailing zeros, drop '+')
  return num.toExponential(2)
    .replace(/\.?0+(e)/, '$1')
    .replace('e+', 'e');
}

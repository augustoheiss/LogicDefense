// ============================================================
// LOGIC INVADERS — Score Formatter
// Idle-game style: fractions → sci notation, k/m/b suffixes,
// huge numbers → sci notation. Handles negatives.
// ============================================================

/**
 * Format a score number for display in the HUD / leaderboard.
 *
 * Range              → Output example
 * ─────────────────────────────────────
 * 0                  → "0"
 * < 0.01 (fraction)  → "1.20e-4"
 * 0.01 – 999         → "42"  or  "0.07"
 * 1 000 – 999 999    → "4.2k"
 * 1 000 000 – 999 m  → "3.1m"
 * 1 000 000 000 – 1T → "2.5b"
 * ≥ 1 000 000 000 000→ "1.20e+12"
 * Negative           → "-4.2k"  (same rules, sign prefix)
 */
export function formatScore(num: number): string {
  if (!isFinite(num) || isNaN(num)) return '???';
  if (num === 0) return '0';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  // Tiny fractions — scientific with negative exponent
  if (abs < 0.01) {
    return sign + abs.toExponential(2);
  }

  // Standard range (no suffix needed)
  if (abs < 1_000) {
    // Show integer if it's effectively a whole number
    return sign + (Number.isInteger(abs) ? String(Math.round(abs)) : abs.toFixed(2).replace(/\.?0+$/, ''));
  }

  // Thousands
  if (abs < 1_000_000) {
    return sign + (abs / 1_000).toFixed(1) + 'k';
  }

  // Millions
  if (abs < 1_000_000_000) {
    return sign + (abs / 1_000_000).toFixed(1) + 'm';
  }

  // Billions
  if (abs < 1_000_000_000_000) {
    return sign + (abs / 1_000_000_000).toFixed(1) + 'b';
  }

  // Astronomical — full scientific notation
  return sign + abs.toExponential(2);
}

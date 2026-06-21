/**
 * Color Tokens — Assistente Moeda Design System
 *
 * Matches the existing CoinAssistant dark theme with accent purple (#a855f7).
 * Designed for adaptive rendering: dark mode default with light mode option.
 */

export const colors = {
  // ── Background layers ─────────────────────────────────────────
  background: {
    primary:   '#0d1117',   // Main app background
    secondary: '#161b22',   // Cards, elevated surfaces
    tertiary:  '#1c2128',   // Inputs, nested containers
    elevated:  '#21262d',   // Modals, overlays
  },

  // ── Text hierarchy ────────────────────────────────────────────
  text: {
    primary:    'rgba(255, 255, 255, 0.92)',
    secondary:  'rgba(255, 255, 255, 0.60)',
    tertiary:   'rgba(255, 255, 255, 0.40)',
    disabled:   'rgba(255, 255, 255, 0.20)',
    inverse:    '#0d1117',
  },

  // ── Brand / Accent ────────────────────────────────────────────
  accent: {
    purple:     '#a855f7',
    purpleHover:'#9333ea',
    purpleLight:'rgba(168, 85, 247, 0.15)',
    purpleBorder:'rgba(168, 85, 247, 0.30)',
  },

  // ── Semantic ──────────────────────────────────────────────────
  success: {
    main:   '#10b981',
    light:  'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.30)',
  },
  warning: {
    main:   '#f59e0b',
    light:  'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.30)',
  },
  danger: {
    main:   '#ef4444',
    light:  'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.20)',
  },
  info: {
    main:   '#3b82f6',
    light:  'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.30)',
  },

  // ── Borders ───────────────────────────────────────────────────
  border: {
    default:  'rgba(255, 255, 255, 0.08)',
    subtle:   'rgba(255, 255, 255, 0.04)',
    strong:   'rgba(255, 255, 255, 0.15)',
  },

  // ── Entry types (matching web CoinAssistant) ──────────────────
  entryType: {
    revenue:     '#10b981', // emerald-500
    deposit:     '#3b82f6', // blue-500
    waiver:      '#f59e0b', // amber-500
    expense:     '#ef4444', // red-500
    partner_in:  '#06b6d4', // cyan-500
    partner_out: '#f97316', // orange-500
  },

  // ── Chart palette ─────────────────────────────────────────────
  chart: {
    primary:   '#a855f7',
    secondary: '#10b981',
    tertiary:  '#3b82f6',
    quaternary:'#f59e0b',
    negative:  '#ef4444',
  },
} as const;

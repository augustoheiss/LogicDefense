/**
 * Smart Description Autocomplete Engine
 *
 * Builds a frequency-indexed map of every unique description already present
 * in the table, keyed by entry type. When the user starts typing a new
 * description, `getSuggestions(query)` returns the top matches, enabling
 * the form to:
 *   1. Auto-fill the description (friction reduction).
 *   2. Auto-switch the entry type selector (smart context).
 *
 * Matching strategy (all case-insensitive):
 *   - Prefix match: "seg" → "Seguro do veículo"
 *   - Word-start match: "veí" → "Seguro do **veí**culo"
 *
 * Results are sorted by frequency (most used first), capped at 5.
 */

import { useMemo, useCallback } from 'react';
import type { TableRow } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutocompleteSuggestion {
  /** The original description text (preserving casing). */
  description: string;
  /** The entry type most commonly associated with this description. */
  entryType: 'revenue' | 'deposit' | 'waiver' | 'expense' | 'partner_in' | 'partner_out';
  /** How many rows use this exact description. */
  count: number;
}

const MAX_SUGGESTIONS = 5;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutocomplete(rows: TableRow[]) {
  /**
   * Build the full index once, recomputed only when rows change.
   *
   * For each unique description (case-insensitive key), we track:
   *   - The original-cased string (taken from the first occurrence).
   *   - The dominant entry type (the type that appears most often).
   *   - The total count.
   */
  const index = useMemo<AutocompleteSuggestion[]>(() => {
    const map = new Map<
      string, // lowercase key
      {
        description: string; // original casing
        typeCounts: Record<string, number>; // entryType → count
        total: number;
      }
    >();

    for (const row of rows) {
      const raw = (row.description ?? '').trim();
      if (!raw) continue;

      const key = raw.toLowerCase();
      const entryType = row.entryType ?? 'revenue';

      const existing = map.get(key);
      if (existing) {
        existing.typeCounts[entryType] = (existing.typeCounts[entryType] ?? 0) + 1;
        existing.total++;
      } else {
        map.set(key, {
          description: raw,
          typeCounts: { [entryType]: 1 },
          total: 1,
        });
      }
    }

    // Convert to flat array with dominant entry type resolved
    return Array.from(map.values())
      .map((entry) => {
        // Pick the entry type with the highest count
        let dominantType = 'revenue';
        let maxCount = 0;
        for (const [type, count] of Object.entries(entry.typeCounts)) {
          if (count > maxCount) {
            maxCount = count;
            dominantType = type;
          }
        }
        return {
          description: entry.description,
          entryType: dominantType as AutocompleteSuggestion['entryType'],
          count: entry.total,
        };
      })
      .sort((a, b) => b.count - a.count); // pre-sort by frequency
  }, [rows]);

  /**
   * Returns the top matching suggestions for a given query.
   *
   * Matching rules (all case-insensitive):
   *   1. Prefix match: query matches the start of the description.
   *   2. Word-start match: query matches the start of any word in the description.
   *
   * Prefix matches are ranked above word-start matches.
   * Within each tier, results are sorted by frequency (most used first).
   */
  const getSuggestions = useCallback(
    (query: string): AutocompleteSuggestion[] => {
      const q = query.trim().toLowerCase();
      if (q.length < 1) return [];

      const prefixMatches: AutocompleteSuggestion[] = [];
      const wordMatches: AutocompleteSuggestion[] = [];

      for (const item of index) {
        const lower = item.description.toLowerCase();

        if (lower.startsWith(q)) {
          // Don't suggest the exact same string (nothing to auto-complete)
          if (lower !== q) {
            prefixMatches.push(item);
          }
        } else if (lower.split(/\s+/).some((word) => word.startsWith(q))) {
          wordMatches.push(item);
        }
      }

      // Prefix matches first (already sorted by count from the index), then word matches
      return [...prefixMatches, ...wordMatches].slice(0, MAX_SUGGESTIONS);
    },
    [index],
  );

  return { getSuggestions, index };
}

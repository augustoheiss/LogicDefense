/**
 * Sekundo Document Engine — Registry Selector Evaluator (`selector.ts`)
 *
 * Evaluates declarative `repeat.over` selectors over a `FlatRegistry`:
 * - `"all"`: all entries in the registry
 * - `"slots"` or `"slots(where: value != '')"`: slot entries (optionally non-empty)
 * - `"territories"`: territory root entries
 * - `"children(of: '01-01')"`: descendants of a specific `PathKey`
 * - `"s13_pages(year: '2027')"` / `"s13_pages"`: pre-grouped 20-row S-13-S multi-cycle pages
 */

import type { FlatRegistry, FlatSkeletonEntry } from '../skeleton/types';
import type { TerritoryAssignmentCycle } from '../engines/types';
import * as pathKey from '../skeleton/pathKey';
import { computeTerritoryRecencyList } from '../engines/territoryEngine';
import { extractQuadrasFromRegistry } from '../geo/quadraPolygonEngine';
import { chunkCyclesBy4 } from '../pdf/s13Generator';

export interface S13VisualRowContext {
  territoryNumber: string;
  locality: string;
  lastCompletedDate: string;
  c0_assignedTo: string;
  c0_assignedAt: string;
  c0_completedAt: string;
  c1_assignedTo: string;
  c1_assignedAt: string;
  c1_completedAt: string;
  c2_assignedTo: string;
  c2_assignedAt: string;
  c2_completedAt: string;
  c3_assignedTo: string;
  c3_assignedAt: string;
  c3_completedAt: string;
}

export interface S13PageContext extends Record<string, unknown> {
  serviceYear: string;
  rows: S13VisualRowContext[];
  rowCount: number;
}

function entryToContext(entry: FlatSkeletonEntry, index: number): Record<string, unknown> {
  const meta = (entry.meta || {}) as Record<string, unknown>;
  return {
    index: index + 1,
    key: entry.key,
    type: entry.type,
    label: entry.label,
    value: entry.value,
    email: entry.email,
    meta,
    // Convenient top-level aliases for S-89 and common templates
    studentName: entry.value,
    assistantName: (meta.assistantTo as string) || (meta.ajudante as string) || '',
    date: (meta.date as string) || (meta.data as string) || '',
    partTitle: entry.label,
    room: (meta.room as string) || (meta.sala as string) || 'Salão Principal',
    remarks: (meta.remarks as string) || (meta.notes as string) || '',
  };
}

/**
 * Builds the 20-row page contexts for S-13-S multi-cycle tables from a `FlatRegistry`,
 * matching the exact domain rules of `s13Generator.ts`.
 */
export function buildS13PageContexts(
  flatRegistry: FlatRegistry,
  requestedYear: string = '2027'
): S13PageContext[] {
  const recencyList = computeTerritoryRecencyList(flatRegistry, 'hierarchical');
  const quadras = extractQuadrasFromRegistry(flatRegistry);

  const workerByTerritory = new Map<string, string>();
  for (const q of quadras) {
    for (const s of q.streets) {
      for (const u of s.units) {
        if (u.workerName && u.workerName !== 'Trabalhado' && !workerByTerritory.has(q.territoryNumber)) {
          workerByTerritory.set(q.territoryNumber, u.workerName);
        }
      }
    }
  }

  const historyByTerritory = new Map<
    string,
    {
      locality: string;
      lastCompletedBeforeYear?: string;
      lastCompleted2027?: string;
      lastCompleted2026?: string;
      cycles: TerritoryAssignmentCycle[];
    }
  >();

  for (const entry of flatRegistry) {
    const meta = (entry.meta || {}) as Record<string, any>;
    const tNum = meta.territoryNumber || meta.territory_number;
    if (tNum && Array.isArray(meta.assignmentHistory)) {
      historyByTerritory.set(String(tNum), {
        locality: String(meta.locality || entry.label.split('—')[1] || '').trim(),
        lastCompletedBeforeYear: meta.lastCompletedBeforeYear ? String(meta.lastCompletedBeforeYear) : undefined,
        lastCompleted2027: meta.lastCompleted2027 ? String(meta.lastCompleted2027) : undefined,
        lastCompleted2026: meta.lastCompleted2026 ? String(meta.lastCompleted2026) : undefined,
        cycles: meta.assignmentHistory as TerritoryAssignmentCycle[],
      });
    }
  }

  const yearsToRender = requestedYear === 'all' ? ['2027', '2026'] : [requestedYear];
  const pages: S13PageContext[] = [];

  for (const currentYear of yearsToRender) {
    const visualRows: S13VisualRowContext[] = [];

    for (const item of recencyList) {
      const explicit = historyByTerritory.get(item.territoryNumber);
      let cycles: TerritoryAssignmentCycle[] = [];
      let locality = '';
      let lastCompletedDate = '';

      if (explicit) {
        cycles = explicit.cycles.filter(
          (c) => !c.serviceYear || String(c.serviceYear) === currentYear
        );
        locality = explicit.locality || item.locality || '';
        lastCompletedDate =
          currentYear === '2027'
            ? explicit.lastCompleted2027 || explicit.lastCompletedBeforeYear || ''
            : explicit.lastCompleted2026 || explicit.lastCompletedBeforeYear || '';
      } else {
        const fallbackWorker =
          workerByTerritory.get(item.territoryNumber) ||
          (item.workedUnits > 0 ? 'Grupo de Campo' : '');
        cycles = fallbackWorker
          ? [
              {
                assignedTo: fallbackWorker,
                assignedAt: item.assignedAt || '-',
                completedAt: item.isCompleted ? item.completedAt : undefined,
              },
            ]
          : [];
        locality = item.locality || item.label.replace(item.territoryNumber, '').replace(/^[\s—-]+/, '');
        lastCompletedDate = item.completedAt || '';
      }

      const chunks = chunkCyclesBy4(cycles);
      for (const chunk of chunks) {
        visualRows.push({
          territoryNumber: item.territoryNumber,
          locality,
          lastCompletedDate,
          c0_assignedTo: chunk[0]?.assignedTo || '',
          c0_assignedAt: chunk[0]?.assignedAt || '',
          c0_completedAt: chunk[0]?.completedAt || '',
          c1_assignedTo: chunk[1]?.assignedTo || '',
          c1_assignedAt: chunk[1]?.assignedAt || '',
          c1_completedAt: chunk[1]?.completedAt || '',
          c2_assignedTo: chunk[2]?.assignedTo || '',
          c2_assignedAt: chunk[2]?.assignedAt || '',
          c2_completedAt: chunk[2]?.completedAt || '',
          c3_assignedTo: chunk[3]?.assignedTo || '',
          c3_assignedAt: chunk[3]?.assignedAt || '',
          c3_completedAt: chunk[3]?.completedAt || '',
        });
      }
    }

    const rowsPerPage = 20;
    for (let i = 0; i < Math.max(visualRows.length, 1); i += rowsPerPage) {
      const slice = visualRows.slice(i, i + rowsPerPage);
      const paddedRows: S13VisualRowContext[] = [...slice];
      while (paddedRows.length < rowsPerPage) {
        paddedRows.push({
          territoryNumber: '',
          locality: '',
          lastCompletedDate: '',
          c0_assignedTo: '',
          c0_assignedAt: '',
          c0_completedAt: '',
          c1_assignedTo: '',
          c1_assignedAt: '',
          c1_completedAt: '',
          c2_assignedTo: '',
          c2_assignedAt: '',
          c2_completedAt: '',
          c3_assignedTo: '',
          c3_assignedAt: '',
          c3_completedAt: '',
        });
      }
      pages.push({
        serviceYear: currentYear,
        rows: paddedRows,
        rowCount: slice.length,
      });
    }
  }

  return pages;
}

/**
 * Evaluates a selector expression (`repeat.over`) against a `FlatRegistry`
 * and returns an array of binding context objects.
 */
export function evaluateRegistrySelector(
  selectorExpr: string,
  registry: FlatRegistry,
  options?: { serviceYear?: string }
): Record<string, unknown>[] {
  const expr = (selectorExpr || 'all').trim();

  // S-13-S multi-cycle page selector: `s13_pages` or `s13_pages(year: '2027')`
  if (expr.startsWith('s13_pages')) {
    const yearMatch = expr.match(/year\s*:\s*['"]?([^'")\s]+)['"]?/i);
    const year = options?.serviceYear || (yearMatch ? yearMatch[1] : '2027');
    return buildS13PageContexts(registry, year);
  }

  // Children of a branch prefix: `children(of: '01-01')` or `children(of: "01-*")`
  const childrenMatch = expr.match(/^children\s*\(\s*of\s*:\s*['"]([^'"]+)['"]\s*\)$/i);
  if (childrenMatch) {
    const rawPrefix = childrenMatch[1].replace(/-\*$/, '').trim();
    const normPrefix = pathKey.normalize(rawPrefix);
    return registry
      .filter((e) => pathKey.isDescendant(e.key, normPrefix))
      .map(entryToContext);
  }

  // Non-empty slots: `slots(where: value != '')`
  if (/^slots\s*\(\s*where\s*:\s*value\s*!=\s*['"]{2}\s*\)$/i.test(expr)) {
    return registry
      .filter((e) => e.value && e.value.trim().length > 0)
      .map(entryToContext);
  }

  if (expr === 'slots') {
    return registry.filter((e) => e.type === 'slot').map(entryToContext);
  }

  if (expr === 'territories') {
    return registry.filter((e) => e.type === 'territory').map(entryToContext);
  }

  // Default: all entries
  return registry.map(entryToContext);
}

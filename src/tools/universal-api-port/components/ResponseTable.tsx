/**
 * ResponseTable — Auto-tabulates array-of-objects API responses.
 *
 * Detection logic:
 *  1. If body is an array of objects → render as table directly
 *  2. If body is an object with a single array-of-objects field
 *     (common pattern: { "data": [...], "total": 42 }) → render that field
 *  3. Otherwise → returns null (fallback to raw JSON)
 *
 * Design: no hardcoded field names, fully dynamic column discovery.
 */

import { useState, useMemo } from 'react';

/* ── Type guards ─────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function isRow(val: unknown): val is Row {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isRowArray(val: unknown): val is Row[] {
  return Array.isArray(val) && val.length > 0 && val.every(isRow);
}

/* ── Extract tabular data from any response shape ────────────── */

interface TableData {
  rows: Row[];
  wrapperKey?: string; // e.g. "data" if extracted from { data: [...] }
}

function extractTableData(body: unknown): TableData | null {
  // Case 1: body is directly an array of objects
  if (isRowArray(body)) {
    return { rows: body };
  }

  // Case 2: body is an object wrapping a single array field
  if (isRow(body)) {
    const entries = Object.entries(body);
    const arrayEntries = entries.filter(([, v]) => isRowArray(v));
    if (arrayEntries.length === 1) {
      const [key, arr] = arrayEntries[0];
      return { rows: arr as Row[], wrapperKey: key };
    }
  }

  return null;
}

/* ── Cell renderer ───────────────────────────────────────────── */

function CellValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="uap-table__null">—</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={`uap-table__bool uap-table__bool--${value}`}>{value ? '✓' : '✗'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="uap-table__number">{value}</span>;
  }
  if (typeof value === 'object') {
    return <code className="uap-table__object">{JSON.stringify(value)}</code>;
  }
  return <>{String(value)}</>;
}

/* ── Main component ──────────────────────────────────────────── */

export function ResponseTable({ body }: { body: unknown }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const tableData = useMemo(() => extractTableData(body), [body]);

  // Discover all unique columns across all rows
  const columns = useMemo(() => {
    if (!tableData) return [];
    const colSet = new Set<string>();
    for (const row of tableData.rows) {
      Object.keys(row).forEach((k) => colSet.add(k));
    }
    return Array.from(colSet);
  }, [tableData]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    if (!tableData) return [];
    if (!sortCol) return tableData.rows;

    return [...tableData.rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;

      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });

      return sortAsc ? cmp : -cmp;
    });
  }, [tableData, sortCol, sortAsc]);

  if (!tableData) return null;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="uap-table-wrap">
      {tableData.wrapperKey && (
        <div className="uap-table__source">
          Dados extraídos de <code>{tableData.wrapperKey}</code> ({tableData.rows.length} {tableData.rows.length === 1 ? 'registro' : 'registros'})
        </div>
      )}
      {!tableData.wrapperKey && (
        <div className="uap-table__source">
          {tableData.rows.length} {tableData.rows.length === 1 ? 'registro' : 'registros'}
        </div>
      )}
      <div className="uap-table__scroll">
        <table className="uap-table">
          <thead>
            <tr>
              <th className="uap-table__th uap-table__th--index">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`uap-table__th ${sortCol === col ? 'uap-table__th--sorted' : ''}`}
                  onClick={() => handleSort(col)}
                >
                  {col}
                  {sortCol === col && (
                    <span className="uap-table__sort-arrow">{sortAsc ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i} className="uap-table__tr">
                <td className="uap-table__td uap-table__td--index">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col} className="uap-table__td">
                    <CellValue value={row[col]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

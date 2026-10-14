/**
 * Sekundo — Client-Side Territory Assignment Record (S-13-S Multi-Cycle 4-Column) & Territory Card (S-12) PDF Generator
 *
 * 100% local, zero server egress: builds printable A4 PDF documents directly in the browser/device
 * using `pdf-lib` following the official S-13-S 4-column multi-cycle grid ("Designado para" x 4 per row,
 * split into Assignee Name on top and "Data da designação | Data da conclusão" on bottom, with automatic
 * multi-row continuation when a territory exceeds 4 assignments in a Service Year).
 *
 * Skills: agency-pdf-engine-architect, agency-web-gis-developer
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import type { TerritoryAssignmentCycle } from '../engines/types';
import { computeTerritoryRecencyList } from '../engines/territoryEngine';
import { extractQuadrasFromRegistry, formatQuadraPerimeterDescription } from '../geo/quadraPolygonEngine';

async function getPdfLib() {
  return await import('pdf-lib');
}

/** Strips characters outside WinAnsi (Latin-1) so StandardFonts.Helvetica never throws on emojis. */
function toWinAnsiSafe(text: string): string {
  return (text || '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[✓✔]/g, '[OK]')
    .replace(/[⬜□]/g, '[ ]')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
}

export interface TerritoryPDFResult {
  pdfBytes: Uint8Array;
  territoryCount: number;
  quadraCount: number;
  totalUnits: number;
  workedUnits: number;
  rowCount?: number;
}

interface NormalizedS13RowGroup {
  territoryNumber: string;
  locality: string;
  lastCompletedDate: string;
  serviceYear: string;
  cycles: TerritoryAssignmentCycle[];
}

/**
 * Splits an array of assignment cycles into chunks of 4 (since each S-13-S row holds 4 cycles).
 */
export function chunkCyclesBy4(
  cycles: TerritoryAssignmentCycle[]
): TerritoryAssignmentCycle[][] {
  if (!cycles || cycles.length === 0) {
    return [[]];
  }
  const chunks: TerritoryAssignmentCycle[][] = [];
  for (let i = 0; i < cycles.length; i += 4) {
    chunks.push(cycles.slice(i, i + 4));
  }
  return chunks;
}

/**
 * Generates a complete A4 Territory Assignment Record (S-13-S 4-Column Multi-Cycle Table)
 * + optional Territory Quadra Cards (S-12 style) 100% on the client using `pdf-lib`.
 */
export async function generateTerritoryS13AndCardsPDF(
  flatRegistry: FlatSkeletonEntry[],
  options: {
    eventName?: string;
    serviceYear?: string; // e.g. '2027', '2026', or 'all'
    includeQuadraCards?: boolean;
  } = {}
): Promise<TerritoryPDFResult> {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const recencyList = computeTerritoryRecencyList(flatRegistry, 'hierarchical');
  const quadras = extractQuadrasFromRegistry(flatRegistry);

  const totalUnits = recencyList.reduce((acc, r) => acc + r.totalUnits, 0);
  const workedUnits = recencyList.reduce((acc, r) => acc + r.workedUnits, 0);

  // Gather volunteer/worker names & explicit assignmentHistory per territory
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

  // Determine which Service Years to render
  const requestedYear = options.serviceYear || '2027';
  const yearsToRender: string[] = [];
  if (requestedYear === 'all') {
    yearsToRender.push('2027', '2026');
  } else {
    yearsToRender.push(requestedYear);
  }

  let totalRenderedRows = 0;

  // Render S-13-S pages per Service Year
  for (const currentYear of yearsToRender) {
    const rowGroups: NormalizedS13RowGroup[] = [];

    for (const item of recencyList) {
      const explicit = historyByTerritory.get(item.territoryNumber);
      if (explicit) {
        const filteredCycles = explicit.cycles.filter(
          (c) => !c.serviceYear || String(c.serviceYear) === currentYear
        );
        const lastComp =
          currentYear === '2027'
            ? explicit.lastCompleted2027 || explicit.lastCompletedBeforeYear || ''
            : explicit.lastCompleted2026 || explicit.lastCompletedBeforeYear || '';

        rowGroups.push({
          territoryNumber: item.territoryNumber,
          locality: explicit.locality || item.locality || '',
          lastCompletedDate: lastComp,
          serviceYear: currentYear,
          cycles: filteredCycles,
        });
      } else {
        const fallbackWorker =
          workerByTerritory.get(item.territoryNumber) ||
          (item.workedUnits > 0 ? 'Grupo de Campo' : '');
        const fallbackCycles: TerritoryAssignmentCycle[] = fallbackWorker
          ? [
              {
                assignedTo: fallbackWorker,
                assignedAt: item.assignedAt || '-',
                completedAt: item.isCompleted ? item.completedAt : undefined,
              },
            ]
          : [];

        rowGroups.push({
          territoryNumber: item.territoryNumber,
          locality: item.locality || item.label.replace(item.territoryNumber, '').replace(/^[\s—-]+/, ''),
          lastCompletedDate: item.completedAt || '',
          serviceYear: currentYear,
          cycles: fallbackCycles,
        });
      }
    }

    // Flatten into visual rows (each row holds up to 4 cycles)
    const visualRows: {
      territoryNumber: string;
      locality: string;
      lastCompletedDate: string;
      fourCycles: TerritoryAssignmentCycle[];
    }[] = [];

    for (const grp of rowGroups) {
      const chunks = chunkCyclesBy4(grp.cycles);
      for (const chunk of chunks) {
        visualRows.push({
          territoryNumber: grp.territoryNumber,
          locality: grp.locality,
          lastCompletedDate: grp.lastCompletedDate,
          fourCycles: chunk,
        });
      }
    }

    // Ensure at least 1 page even if empty
    const rowsPerPage = 20;
    const pageChunks: (typeof visualRows)[] = [];
    for (let i = 0; i < Math.max(visualRows.length, 1); i += rowsPerPage) {
      pageChunks.push(visualRows.slice(i, i + rowsPerPage));
    }

    for (const pageRows of pageChunks) {
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const tableX = 34;
      const tableW = 527;
      const colTerrW = 58;
      const colLastW = 61;
      const colCycleW = (tableW - colTerrW - colLastW) / 4; // 102pt each

      // Title
      page.drawText('REGISTRO DE DESIGNACAO DE TERRITORIO', {
        x: 138,
        y: 800,
        size: 14,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });

      // Service Year Header
      page.drawText('Ano de servico:', {
        x: tableX,
        y: 774,
        size: 10,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });
      page.drawText(toWinAnsiSafe(currentYear), {
        x: tableX + 88,
        y: 774,
        size: 10,
        font: fontRegular,
        color: rgb(0.05, 0.05, 0.05),
      });
      page.drawLine({
        start: { x: tableX + 78, y: 772 },
        end: { x: tableX + 135, y: 772 },
        thickness: 0.8,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Table Header Geometry
      const headerTopY = 764;
      const headerH = 32;
      const headerBottomY = headerTopY - headerH;

      page.drawRectangle({
        x: tableX,
        y: headerBottomY,
        width: tableW,
        height: headerH,
        color: rgb(0.82, 0.82, 0.82),
        borderColor: rgb(0.05, 0.05, 0.05),
        borderWidth: 1.5,
      });

      // Column 1 Header: Terr. n.o
      page.drawText('Terr. n.o', {
        x: tableX + 11,
        y: headerBottomY + 13,
        size: 8,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });

      // Column 2 Header: Ultima data concluida*
      page.drawText('Ultima data', {
        x: tableX + colTerrW + 9,
        y: headerBottomY + 17,
        size: 7,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });
      page.drawText('concluida*', {
        x: tableX + colTerrW + 11,
        y: headerBottomY + 8,
        size: 7,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
      });

      // Vertical dividers for Col 1 and Col 2
      page.drawLine({
        start: { x: tableX + colTerrW, y: headerTopY },
        end: { x: tableX + colTerrW, y: headerBottomY },
        thickness: 1.2,
        color: rgb(0.05, 0.05, 0.05),
      });
      page.drawLine({
        start: { x: tableX + colTerrW + colLastW, y: headerTopY },
        end: { x: tableX + colTerrW + colLastW, y: headerBottomY },
        thickness: 1.5,
        color: rgb(0.05, 0.05, 0.05),
      });

      // 4 Cycle Columns Headers ("Designado para" + "Data da designacao | Data da conclusao")
      for (let c = 0; c < 4; c++) {
        const cx = tableX + colTerrW + colLastW + c * colCycleW;
        if (c > 0) {
          page.drawLine({
            start: { x: cx, y: headerTopY },
            end: { x: cx, y: headerBottomY },
            thickness: 1,
            color: rgb(0.05, 0.05, 0.05),
          });
        }
        // Horizontal split inside cycle header
        const midHeaderY = headerBottomY + 18;
        page.drawLine({
          start: { x: cx, y: midHeaderY },
          end: { x: cx + colCycleW, y: midHeaderY },
          thickness: 0.7,
          color: rgb(0.15, 0.15, 0.15),
        });
        // Vertical split in bottom half of cycle header
        page.drawLine({
          start: { x: cx + colCycleW / 2, y: midHeaderY },
          end: { x: cx + colCycleW / 2, y: headerBottomY },
          thickness: 0.7,
          color: rgb(0.15, 0.15, 0.15),
        });

        page.drawText('Designado para', {
          x: cx + 22,
          y: midHeaderY + 4,
          size: 7.5,
          font: fontBold,
          color: rgb(0.05, 0.05, 0.05),
        });

        page.drawText('Data da', { x: cx + 11, y: headerBottomY + 10, size: 6, font: fontBold });
        page.drawText('designacao', { x: cx + 6, y: headerBottomY + 3, size: 6, font: fontBold });

        page.drawText('Data da', { x: cx + colCycleW / 2 + 11, y: headerBottomY + 10, size: 6, font: fontBold });
        page.drawText('conclusao', { x: cx + colCycleW / 2 + 8, y: headerBottomY + 3, size: 6, font: fontBold });
      }

      // Render 20 fixed grid rows per page (authentic S-13-S sheet look)
      const rowH = 33;
      let cursorY = headerBottomY;

      for (let r = 0; r < rowsPerPage; r++) {
        const rowBottomY = cursorY - rowH;
        const rowMidY = rowBottomY + rowH / 2;
        const rowData = pageRows[r];

        // Row outer box
        page.drawRectangle({
          x: tableX,
          y: rowBottomY,
          width: tableW,
          height: rowH,
          borderColor: rgb(0.1, 0.1, 0.1),
          borderWidth: 0.8,
        });

        // Vertical lines for Col 1 & Col 2
        page.drawLine({
          start: { x: tableX + colTerrW, y: cursorY },
          end: { x: tableX + colTerrW, y: rowBottomY },
          thickness: 0.8,
          color: rgb(0.15, 0.15, 0.15),
        });
        page.drawLine({
          start: { x: tableX + colTerrW + colLastW, y: cursorY },
          end: { x: tableX + colTerrW + colLastW, y: rowBottomY },
          thickness: 1.5,
          color: rgb(0.05, 0.05, 0.05),
        });

        if (rowData) {
          totalRenderedRows++;
          const safeCode = toWinAnsiSafe(rowData.territoryNumber).slice(0, 12);
          const safeLoc = toWinAnsiSafe(rowData.locality).slice(0, 13);
          const safeLast = toWinAnsiSafe(rowData.lastCompletedDate).slice(0, 12);

          page.drawText(safeCode, {
            x: tableX + 5,
            y: rowBottomY + 19,
            size: 8,
            font: fontBold,
            color: rgb(0.08, 0.08, 0.12),
          });
          if (safeLoc) {
            page.drawText(safeLoc, {
              x: tableX + 5,
              y: rowBottomY + 8,
              size: 7.2,
              font: fontRegular,
              color: rgb(0.2, 0.2, 0.25),
            });
          }
          if (safeLast) {
            page.drawText(safeLast, {
              x: tableX + colTerrW + 8,
              y: rowBottomY + 13,
              size: 7,
              font: fontRegular,
              color: rgb(0.15, 0.15, 0.2),
            });
          }
        }

        // Draw 4 cycle columns inside this row
        for (let c = 0; c < 4; c++) {
          const cx = tableX + colTerrW + colLastW + c * colCycleW;
          if (c > 0) {
            page.drawLine({
              start: { x: cx, y: cursorY },
              end: { x: cx, y: rowBottomY },
              thickness: 0.8,
              color: rgb(0.15, 0.15, 0.15),
            });
          }
          // Horizontal split between Assignee Name (top) and Dates (bottom)
          page.drawLine({
            start: { x: cx, y: rowMidY },
            end: { x: cx + colCycleW, y: rowMidY },
            thickness: 0.5,
            color: rgb(0.65, 0.65, 0.65),
          });
          // Vertical split between Data da designacao and Data da conclusao
          page.drawLine({
            start: { x: cx + colCycleW / 2, y: rowMidY },
            end: { x: cx + colCycleW / 2, y: rowBottomY },
            thickness: 0.5,
            color: rgb(0.35, 0.35, 0.35),
          });

          const cycle = rowData?.fourCycles[c];
          if (cycle) {
            const safeAssignee = toWinAnsiSafe(cycle.assignedTo).slice(0, 26);
            const safeStart = toWinAnsiSafe(cycle.assignedAt).slice(0, 10);
            const safeEnd = toWinAnsiSafe(cycle.completedAt || '').slice(0, 10);

            page.drawText(safeAssignee, {
              x: cx + 4,
              y: rowMidY + 5,
              size: 6.5,
              font: fontRegular,
              color: rgb(0.1, 0.1, 0.15),
            });
            page.drawText(safeStart, {
              x: cx + 6,
              y: rowBottomY + 4,
              size: 6.5,
              font: fontRegular,
              color: rgb(0.15, 0.15, 0.2),
            });
            if (safeEnd) {
              page.drawText(safeEnd, {
                x: cx + colCycleW / 2 + 6,
                y: rowBottomY + 4,
                size: 6.5,
                font: fontRegular,
                color: rgb(0.15, 0.15, 0.2),
              });
            }
          }
        }

        cursorY = rowBottomY;
      }

      // Outer thick frame around the entire S-13-S grid
      page.drawRectangle({
        x: tableX,
        y: cursorY,
        width: tableW,
        height: headerTopY - cursorY,
        borderColor: rgb(0.02, 0.02, 0.02),
        borderWidth: 2,
      });

      // Official Footnote
      page.drawText(
        '*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada territorio foi concluido pela ultima vez.',
        {
          x: tableX,
          y: cursorY - 14,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.1, 0.1, 0.1),
        }
      );
      page.drawText('S-13-S', {
        x: tableX,
        y: cursorY - 30,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      });
    }
  }

  // Optional Section: Printable Quadra Cards (S-12 Tactical Cards)
  if (options.includeQuadraCards !== false && quadras.length > 0) {
    let page = pdfDoc.addPage([595.28, 841.89]);
    let y = 795;

    page.drawText('CARTOES TATICOS DE QUADRAS & RUAS DELIMITADORAS (S-12)', {
      x: 40,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.07, 0.09, 0.15),
    });
    y -= 18;

    for (const q of quadras) {
      if (y < 110) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 795;
      }
      const cardHeight = Math.min(120, 48 + q.streets.length * 14);
      page.drawRectangle({
        x: 40,
        y: y - cardHeight + 12,
        width: 515,
        height: cardHeight,
        borderColor: rgb(0.75, 0.78, 0.84),
        borderWidth: 1,
        color: rgb(0.98, 0.99, 1),
      });

      page.drawText(
        toWinAnsiSafe(`[${q.territoryNumber}] ${q.label} - ${q.workedUnits}/${q.totalUnits} (${q.coveragePercent}%)`),
        { x: 48, y: y - 2, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.2) }
      );
      page.drawText(
        toWinAnsiSafe(formatQuadraPerimeterDescription(q.perimeterStreets)).slice(0, 95),
        { x: 48, y: y - 16, size: 8.5, font: fontRegular, color: rgb(0.3, 0.36, 0.45) }
      );

      let sy = y - 30;
      for (const st of q.streets.slice(0, 5)) {
        const nums = st.units
          .map((u) => `${u.worked === 1 ? '[OK]' : '[ ]'} ${u.numberOrComplement}`)
          .join('  ');
        page.drawText(
          toWinAnsiSafe(`${st.streetName}: ${nums}`).slice(0, 100),
          { x: 54, y: sy, size: 8, font: fontRegular, color: rgb(0.18, 0.22, 0.3) }
        );
        sy -= 13;
      }

      y -= cardHeight + 10;
    }
  }

  // Stamp page numbers (1/N) on all pages
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;
  allPages.forEach((p, idx) => {
    p.drawText(`${idx + 1}/${totalPages}`, {
      x: 542,
      y: 42,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.15, 0.15, 0.15),
    });
  });

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    territoryCount: recencyList.length,
    quadraCount: quadras.length,
    totalUnits,
    workedUnits,
    rowCount: totalRenderedRows,
  };
}

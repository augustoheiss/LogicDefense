/**
 * Sekundo — Client-Side Territory Assignment Record (S-13) & Territory Card (S-12) PDF Generator
 *
 * 100% local, zero server egress: builds printable A4 PDF documents directly in the browser/device
 * using `pdf-lib` from the flat skeleton registry, recency metrics, and quadra perimeter streets.
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
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
}

/**
 * Generates a complete A4 Territory Assignment Record (S-13 style table) + Territory Quadra Cards (S-12 style)
 * 100% on the client using `pdf-lib`.
 */
export async function generateTerritoryS13AndCardsPDF(
  flatRegistry: FlatSkeletonEntry[],
  options: {
    eventName?: string;
    serviceYear?: string;
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
  const serviceYear = options.serviceYear || String(new Date().getFullYear());
  const eventTitle = toWinAnsiSafe(options.eventName || 'Registro de Designacao de Territorio');

  // Gather volunteer/worker names per territory
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

  // Page 1: S-13 Territory Assignment Record Table
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  let y = 795;

  const drawHeader = () => {
    page.drawText('REGISTRO DE DESIGNACAO DE TERRITORIO (S-13)', {
      x: 40,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.07, 0.09, 0.15),
    });
    y -= 18;
    page.drawText(
      toWinAnsiSafe(`${eventTitle}  |  Ano de Servico: ${serviceYear}  |  Gerado em: ${new Date().toISOString().slice(0, 10)}`),
      {
        x: 40,
        y,
        size: 9,
        font: fontRegular,
        color: rgb(0.35, 0.4, 0.48),
      }
    );
    y -= 22;

    // Table Header
    page.drawRectangle({
      x: 40,
      y: y - 4,
      width: 515,
      height: 20,
      color: rgb(0.1, 0.14, 0.22),
    });
    const cols = [
      { x: 46, label: 'Terr. No.' },
      { x: 115, label: 'Ultima Conclusao' },
      { x: 215, label: 'Designado Para' },
      { x: 345, label: 'Data Saida' },
      { x: 420, label: 'Data Conclusao' },
      { x: 505, label: 'Cobertura' },
    ];
    for (const c of cols) {
      page.drawText(c.label, {
        x: c.x,
        y: y + 2,
        size: 8.5,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }
    y -= 22;
  };

  drawHeader();

  for (let i = 0; i < recencyList.length; i++) {
    if (y < 70) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 795;
      drawHeader();
    }
    const item = recencyList[i];
    if (i % 2 === 1) {
      page.drawRectangle({
        x: 40,
        y: y - 4,
        width: 515,
        height: 18,
        color: rgb(0.95, 0.96, 0.98),
      });
    }

    const worker = toWinAnsiSafe(workerByTerritory.get(item.territoryNumber) || (item.workedUnits > 0 ? 'Grupo de Campo' : '-'));
    const assignedStr = toWinAnsiSafe(item.assignedAt || '-');
    const completedStr = toWinAnsiSafe(item.isCompleted && item.completedAt ? item.completedAt : 'Em andamento');
    const lastDaysStr =
      item.isCompleted && item.daysSinceCompleted !== null
        ? `ha ${item.daysSinceCompleted}d`
        : `${item.percent}%`;
    const covStr = `${item.workedUnits}/${item.totalUnits} (${item.percent}%)`;

    page.drawText(toWinAnsiSafe(item.territoryNumber), { x: 46, y, size: 9, font: fontBold, color: rgb(0.1, 0.12, 0.18) });
    page.drawText(toWinAnsiSafe(lastDaysStr), { x: 115, y, size: 8.5, font: fontRegular, color: rgb(0.2, 0.25, 0.32) });
    page.drawText(worker.slice(0, 22), { x: 215, y, size: 8.5, font: fontRegular, color: rgb(0.15, 0.2, 0.28) });
    page.drawText(assignedStr.slice(0, 12), { x: 345, y, size: 8.5, font: fontRegular, color: rgb(0.2, 0.25, 0.32) });
    page.drawText(completedStr.slice(0, 14), { x: 420, y, size: 8.5, font: fontRegular, color: rgb(0.05, 0.45, 0.3) });
    page.drawText(toWinAnsiSafe(covStr), { x: 505, y, size: 8, font: fontBold, color: rgb(0.15, 0.2, 0.28) });

    y -= 18;
  }

  // Optional Section: Printable Quadra Cards (S-12 Tactical Cards)
  if (options.includeQuadraCards !== false && quadras.length > 0) {
    y -= 20;
    if (y < 180) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 795;
    }
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
        toWinAnsiSafe(`[${q.territoryNumber}] ${q.label} — ${q.workedUnits}/${q.totalUnits} (${q.coveragePercent}%)`),
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

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    territoryCount: recencyList.length,
    quadraCount: quadras.length,
    totalUnits,
    workedUnits,
  };
}

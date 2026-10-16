/**
 * Sekundo Document Engine — Built-in Canonical `.sdoc.yaml` Templates (`builtinTemplates.ts`)
 *
 * Implements Phase F2 proof-of-fire:
 * 1. `fichas-4up.sdoc.yaml` — 4-Up Assignment Slips on A4
 * 2. `territorios-multiciclo.sdoc.yaml` — 4-Column Multi-Cycle Territory Assignment Record
 *    expressed 100% as declarative `.sdoc.yaml` data!
 */

import type { FlatRegistry } from '../../skeleton/types';
import { parseSdocYaml } from '../schema';
import { solveLayout } from '../layoutSolver';
import { renderDisplayListToPdf, type PdfPainterOptions } from '../painters/pdfPainter';
import type { DisplayList } from '../types';

export const S89_4UP_SDOC_YAML = `# fichas-4up.sdoc.yaml — Fichas de Designação 4-Up em Folha A4
sdoc: 1
name: Fichas de Designação 4-Up (A4)
page:
  format: a4
  orientation: portrait
  unit: mm
fonts:
  body:
    family: Helvetica
repeat:
  over: "slots(where: value != '')"
  per_page: 4
  grid:
    cols: 1
    rows: 4
    gap: 4
    startX: 10
    startY: 8
    cellW: 190
    cellH: 66
layers:
  - id: moldura
    name: Moldura & Guias de Corte
    locked: true
    items:
      - id: slip_frame
        type: rect
        x: 0
        y: 0
        w: 190
        h: 66
        fill: "#FFFFFF"
        stroke: "#333333"
        stroke_width: 0.5
      - id: header_line
        type: line
        x1: 0
        y1: 12
        x2: 190
        y2: 12
        stroke: "#999999"
        stroke_width: 0.35
        dash: [2, 1]
  - id: campos
    name: Campos da Designação
    items:
      - id: slip_title
        type: text
        x: 4
        y: 3
        w: 120
        text: "DESIGNAÇÃO DA PROGRAMAÇÃO"
        size: 9.5
        weight: bold
        color: "#111111"
      - id: slip_date
        type: text
        x: 130
        y: 3
        w: 56
        text: "{{meta.date | date:'dd/MM/yyyy' | default:'—'}}"
        size: 9.5
        weight: bold
        align: right
        color: "#111111"
      - id: slip_student
        type: text
        x: 4
        y: 16
        w: 180
        text: "Nome: {{value}}"
        size: 11
        weight: bold
        color: "#0F172A"
      - id: slip_assistant
        type: text
        x: 4
        y: 26
        w: 180
        text: "Ajudante: {{meta.assistantTo | default:'—'}}"
        size: 9.5
        color: "#334155"
      - id: slip_part
        type: text
        x: 4
        y: 36
        w: 180
        text: "Parte: {{label}}"
        size: 9.5
        max_lines: 2
        color: "#1E293B"
      - id: slip_room
        type: text
        x: 4
        y: 52
        w: 180
        text: "Local: {{meta.room | default:'Auditório Principal'}}"
        size: 8.5
        color: "#475569"
`;

/**
 * Generates the declarative `territorios-multiciclo.sdoc.yaml` template where all 20 rows
 * and 4 cycle columns per row are described in YAML millimeters (`mm`).
 */
function buildS13MulticycleYaml(): string {
  const tableX = 12; // 34pt ≈ 12mm
  const tableW = 186; // 527pt ≈ 186mm
  const colTerrW = 20.5;
  const colLastW = 21.5;
  const colCycleW = (tableW - colTerrW - colLastW) / 4; // 36mm each
  const headerTopY = 26.8;
  const headerH = 11.3;
  const rowH = 11.64;

  const lines: string[] = [
    '# territorios-multiciclo.sdoc.yaml — Registro de Designação de Território (4 Colunas Multi-Ciclo)',
    'sdoc: 1',
    'name: "Registro de Designação de Território (Multi-Ciclo)"',
    'page:',
    '  format: a4',
    '  orientation: portrait',
    '  unit: mm',
    'fonts:',
    '  body:',
    '    family: Helvetica',
    'repeat:',
    '  over: "s13_pages"',
    '  per_page: 1',
    'layers:',
    '  - id: grade_s13',
    '    name: Grade de Registro Multi-Ciclo',
    '    locked: true',
    '    items:',
    `      - { id: hdr_bg, type: rect, x: ${tableX}, y: ${headerTopY}, w: ${tableW}, h: ${headerH}, fill: "#D1D1D1", stroke: "#0D0D0D", stroke_width: 0.5 }`,
    `      - { id: outer_frame, type: rect, x: ${tableX}, y: ${headerTopY}, w: ${tableW}, h: ${Number((headerH + 20 * rowH).toFixed(2))}, stroke: "#050505", stroke_width: 0.7 }`,
    `      - { id: v_col1, type: line, x1: ${Number((tableX + colTerrW).toFixed(2))}, y1: ${headerTopY}, x2: ${Number((tableX + colTerrW).toFixed(2))}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#1A1A1A", stroke_width: 0.35 }`,
    `      - { id: v_col2, type: line, x1: ${Number((tableX + colTerrW + colLastW).toFixed(2))}, y1: ${headerTopY}, x2: ${Number((tableX + colTerrW + colLastW).toFixed(2))}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#0D0D0D", stroke_width: 0.5 }`,
  ];

  for (let c = 0; c < 4; c++) {
    const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
    const midX = Number((cx + colCycleW / 2).toFixed(2));
    if (c > 0) {
      lines.push(
        `      - { id: v_cyc_${c}, type: line, x1: ${cx}, y1: ${headerTopY}, x2: ${cx}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#262626", stroke_width: 0.3 }`
      );
    }
    lines.push(
      `      - { id: hdr_split_h_${c}, type: line, x1: ${cx}, y1: ${Number((headerTopY + 5).toFixed(2))}, x2: ${Number((cx + colCycleW).toFixed(2))}, y2: ${Number((headerTopY + 5).toFixed(2))}, stroke: "#262626", stroke_width: 0.25 }`,
      `      - { id: hdr_split_v_${c}, type: line, x1: ${midX}, y1: ${Number((headerTopY + 5).toFixed(2))}, x2: ${midX}, y2: ${Number((headerTopY + headerH).toFixed(2))}, stroke: "#262626", stroke_width: 0.25 }`
    );
  }

  for (let r = 0; r < 20; r++) {
    const ry = Number((headerTopY + headerH + r * rowH).toFixed(2));
    const midY = Number((ry + rowH / 2).toFixed(2));
    lines.push(
      `      - { id: row_box_${r}, type: rect, x: ${tableX}, y: ${ry}, w: ${tableW}, h: ${rowH}, stroke: "#262626", stroke_width: 0.28 }`,
      `      - { id: row_mid_${r}, type: line, x1: ${Number((tableX + colTerrW + colLastW).toFixed(2))}, y1: ${midY}, x2: ${Number((tableX + tableW).toFixed(2))}, y2: ${midY}, stroke: "#A6A6A6", stroke_width: 0.18 }`
    );
    for (let c = 0; c < 4; c++) {
      const midX = Number((tableX + colTerrW + colLastW + c * colCycleW + colCycleW / 2).toFixed(2));
      lines.push(
        `      - { id: row_${r}_v_${c}, type: line, x1: ${midX}, y1: ${midY}, x2: ${midX}, y2: ${Number((ry + rowH).toFixed(2))}, stroke: "#595959", stroke_width: 0.18 }`
      );
    }
  }

  // Layer 2: Titles, Headers, and 20-Row Bindings
  lines.push(
    '  - id: textos_s13',
    '    name: Cabeçalho e Dados dos 20 Territórios',
    '    items:',
    '      - { id: title_s13, type: text, x: 48, y: 12, w: 125, text: "REGISTRO DE DESIGNACAO DE TERRITORIO", size: 14, weight: bold }',
    `      - { id: lbl_year, type: text, x: ${tableX}, y: 21, w: 52, text: "Ciclo / Ano Operacional:", size: 10, weight: bold }`,
    `      - { id: val_year, type: text, x: ${tableX + 46}, y: 21, w: 30, text: "{{serviceYear}}", size: 10 }`,
    `      - { id: hdr_terr, type: text, x: ${tableX + 2}, y: ${Number((headerTopY + 3.5).toFixed(2))}, w: 18, text: "Terr. n.o", size: 8, weight: bold }`,
    `      - { id: hdr_last1, type: text, x: ${Number((tableX + colTerrW + 2).toFixed(2))}, y: ${Number((headerTopY + 2).toFixed(2))}, w: 19, text: "Ultima data", size: 7, weight: bold }`,
    `      - { id: hdr_last2, type: text, x: ${Number((tableX + colTerrW + 2).toFixed(2))}, y: ${Number((headerTopY + 5.5).toFixed(2))}, w: 19, text: "concluida*", size: 7, weight: bold }`
  );

  for (let c = 0; c < 4; c++) {
    const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
    const midX = Number((cx + colCycleW / 2).toFixed(2));
    lines.push(
      `      - { id: hdr_des_${c}, type: text, x: ${Number((cx + 5).toFixed(2))}, y: ${Number((headerTopY + 1).toFixed(2))}, w: 28, text: "Designado para", size: 7.5, weight: bold }`,
      `      - { id: hdr_dt1_${c}, type: text, x: ${Number((cx + 2).toFixed(2))}, y: ${Number((headerTopY + 5.8).toFixed(2))}, w: 16, text: "Data da designacao", size: 5.8, weight: bold }`,
      `      - { id: hdr_dt2_${c}, type: text, x: ${Number((midX + 2).toFixed(2))}, y: ${Number((headerTopY + 5.8).toFixed(2))}, w: 16, text: "Data da conclusao", size: 5.8, weight: bold }`
    );
  }

  for (let r = 0; r < 20; r++) {
    const ry = Number((headerTopY + headerH + r * rowH).toFixed(2));
    const midY = Number((ry + rowH / 2).toFixed(2));
    lines.push(
      `      - { id: r_${r}_code, type: text, x: ${tableX + 1.5}, y: ${Number((ry + 1.2).toFixed(2))}, w: 18, text: "{{rows.${r}.territoryNumber | truncate:12}}", size: 8, weight: bold }`,
      `      - { id: r_${r}_loc, type: text, x: ${tableX + 1.5}, y: ${Number((ry + 5.6).toFixed(2))}, w: 18, text: "{{rows.${r}.locality | truncate:13}}", size: 7 }`,
      `      - { id: r_${r}_last, type: text, x: ${Number((tableX + colTerrW + 2).toFixed(2))}, y: ${Number((ry + 3.5).toFixed(2))}, w: 19, text: "{{rows.${r}.lastCompletedDate | truncate:12}}", size: 7 }`
    );
    for (let c = 0; c < 4; c++) {
      const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
      const midX = Number((cx + colCycleW / 2).toFixed(2));
      lines.push(
        `      - { id: r_${r}_c${c}_who, type: text, x: ${Number((cx + 1.2).toFixed(2))}, y: ${Number((ry + 1.2).toFixed(2))}, w: 34, text: "{{rows.${r}.c${c}_assignedTo | truncate:26}}", size: 6.5 }`,
        `      - { id: r_${r}_c${c}_in, type: text, x: ${Number((cx + 1.5).toFixed(2))}, y: ${Number((midY + 1.2).toFixed(2))}, w: 16, text: "{{rows.${r}.c${c}_assignedAt | truncate:10}}", size: 6.5 }`,
        `      - { id: r_${r}_c${c}_out, type: text, x: ${Number((midX + 1.5).toFixed(2))}, y: ${Number((midY + 1.2).toFixed(2))}, w: 16, text: "{{rows.${r}.c${c}_completedAt | truncate:10}}", size: 6.5 }`
      );
    }
  }

  const footerY = Number((headerTopY + headerH + 20 * rowH + 3).toFixed(2));
  lines.push(
    `      - { id: footnote_s13, type: text, x: ${tableX}, y: ${footerY}, w: 185, text: "*Ao iniciar uma nova folha, use esta coluna para registrar a data em que cada territorio foi concluido pela ultima vez.", size: 7.5 }`,
    `      - { id: code_s13, type: text, x: ${tableX}, y: ${Number((footerY + 5).toFixed(2))}, w: 40, text: "REG-TERR-4C", size: 8.5, weight: bold }`,
    ''
  );

  return lines.join('\n');
}

export const S13S_MULTICYCLE_SDOC_YAML = buildS13MulticycleYaml();
export const FICHAS_4UP_SDOC_YAML = S89_4UP_SDOC_YAML;
export const TERRITORIOS_MULTICYCLE_SDOC_YAML = S13S_MULTICYCLE_SDOC_YAML;

export const BUILTIN_SDOC_TEMPLATES: Record<string, { id: string; name: string; yaml: string }> = {
  'fichas-4up': {
    id: 'fichas-4up',
    name: 'Fichas de Designação 4-Up (A4)',
    yaml: S89_4UP_SDOC_YAML,
  },
  'territorios-multiciclo': {
    id: 'territorios-multiciclo',
    name: 'Registro de Territórios (4 Colunas Multi-Ciclo)',
    yaml: S13S_MULTICYCLE_SDOC_YAML,
  },
};

/**
 * Convenience end-to-end compiler: `.sdoc.yaml` + `FlatRegistry` → `{ displayList, pdfBytes }`.
 */
export async function compileSdocToPdf(
  sdocYaml: string,
  registry: FlatRegistry = [],
  options?: PdfPainterOptions & { serviceYear?: string }
): Promise<{ displayList: DisplayList; pdfBytes: Uint8Array }> {
  const { doc, issues } = parseSdocYaml(sdocYaml);
  if (!doc) {
    throw new Error(`Documento SDOC inválido: ${issues.map((i) => i.message).join('; ')}`);
  }
  const displayList = solveLayout(doc, registry, { serviceYear: options?.serviceYear });
  const pdfBytes = await renderDisplayListToPdf(displayList, options);
  return { displayList, pdfBytes };
}

/**
 * Sekundo Document Engine — Built-in Canonical `.sdoc.yaml` Templates (`builtinTemplates.ts`)
 *
 * 100% Clean-Room & Domain-Agnostic Sekundo Layouts:
 * 1. `fichas-4up.sdoc.yaml` — Cartões de Tarefa Operacional 4-Up em Folha A4
 * 2. `territorios-multiciclo.sdoc.yaml` — Painel Executivo de Setores e Ciclos (Layout Original Sekundo)
 */

import type { FlatRegistry } from '../../skeleton/types';
import { parseSdocYaml } from '../schema';
import { solveLayout } from '../layoutSolver';
import { renderDisplayListToPdf, type PdfPainterOptions } from '../painters/pdfPainter';
import type { DisplayList } from '../types';

export const S89_4UP_SDOC_YAML = `# cartoes-4up.sdoc.yaml — Cartões de Tarefa Operacional 4-Up (Layout Original Sekundo)
# DICA: Os dados ({{value}}, {{label}}) vêm da árvore ativa (Esqueleto / Escala),
# ou você pode editar diretamente qualquer texto fixo abaixo entre aspas.
sdoc: 1
name: Cartões de Tarefa Operacional 4-Up (A4)
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
  - id: estrutura_cartao
    name: Estrutura do Cartão Sekundo
    locked: true
    items:
      - id: card_bg
        type: rect
        x: 0
        y: 0
        w: 190
        h: 66
        fill: "#FFFFFF"
        stroke: "#CBD5E1"
        stroke_width: 0.4
      - id: card_header_band
        type: rect
        x: 0
        y: 0
        w: 190
        h: 11
        fill: "#0F172A"
        stroke: "#0F172A"
        stroke_width: 0.2
      - id: card_accent_line
        type: line
        x1: 0
        y1: 11
        x2: 190
        y2: 11
        stroke: "#3B82F6"
        stroke_width: 0.6
  - id: dados_cartao
    name: Dados da Tarefa Operacional
    items:
      - id: card_title
        type: text
        x: 5
        y: 3
        w: 120
        text: "CARTAO DE TAREFA OPERACIONAL — SEKUNDO"
        size: 9
        weight: bold
        color: "#F8FAFC"
      - id: card_date
        type: text
        x: 130
        y: 3
        w: 55
        text: "{{meta.date | date:'dd/MM/yyyy' | default:'—'}}"
        size: 9
        weight: bold
        align: right
        color: "#38BDF8"
      - id: card_participant
        type: text
        x: 5
        y: 16
        w: 180
        text: "Responsavel: {{value}}"
        size: 11
        weight: bold
        color: "#0F172A"
      - id: card_partner
        type: text
        x: 5
        y: 26
        w: 180
        text: "Apoio / Parceiro: {{meta.assistantTo | default:'—'}}"
        size: 9.5
        color: "#334155"
      - id: card_task
        type: text
        x: 5
        y: 36
        w: 180
        text: "Atividade: {{label}}"
        size: 9.5
        max_lines: 2
        color: "#1E293B"
      - id: card_location
        type: text
        x: 5
        y: 52
        w: 180
        text: "Ambiente / Canal: {{meta.room | default:'Sala Principal'}}"
        size: 8.5
        color: "#64748B"
`;

/**
 * Generates the 100% original Sekundo Executive Sector Dashboard `.sdoc.yaml` template
 * (`painel-setores.sdoc.yaml`). Uses a modern dark-slate header banner, flat zebra rows,
 * and zero visual or structural imitation of external organizational forms.
 */
function buildS13MulticycleYaml(): string {
  const tableX = 12;
  const tableW = 186;
  const colTerrW = 32;
  const colLastW = 22;
  const colCycleW = (tableW - colTerrW - colLastW) / 4; // 33mm each
  const headerTopY = 27;
  const headerH = 8.5;
  const rowH = 11.5;

  const lines: string[] = [
    '# painel-setores.sdoc.yaml — Painel Executivo de Setores e Ciclos (Layout Original Sekundo)',
    '# COMO EDITAR OS NOMES:',
    '# 1) Os valores {{rows.N.c0_assignedTo}} buscam automaticamente os participantes (Participante 01..16)',
    '#    da árvore ativa do evento (ou você pode substituir qualquer "{{...}}" abaixo por um nome fixo).',
    '# 2) Para testar com seu próprio PDF, clique em "Subir PDF (Fundo)" ou "Subir PDF (Rebuild)" na barra superior.',
    'sdoc: 1',
    'name: "Painel Executivo de Setores e Ciclos (Sekundo)"',
    'page:',
    '  format: a4',
    '  orientation: portrait',
    '  unit: mm',
    'fonts:',
    '  body:',
    '    family: Helvetica',
    'repeat:',
    '  over: "sector_pages"',
    '  per_page: 1',
    'layers:',
    '  - id: estrutura_painel',
    '    name: Estrutura Visual Sekundo',
    '    locked: true',
    '    items:',
    `      - { id: top_banner, type: rect, x: ${tableX}, y: 10, w: ${tableW}, h: 14, fill: "#0F172A", stroke: "#0F172A", stroke_width: 0.2 }`,
    `      - { id: top_accent, type: line, x1: ${tableX}, y1: 24, x2: ${tableX + tableW}, y2: 24, stroke: "#3B82F6", stroke_width: 0.8 }`,
    `      - { id: col_hdr_bg, type: rect, x: ${tableX}, y: ${headerTopY}, w: ${tableW}, h: ${headerH}, fill: "#1E293B", stroke: "#1E293B", stroke_width: 0.2 }`,
  ];

  for (let r = 0; r < 20; r++) {
    const ry = Number((headerTopY + headerH + r * rowH).toFixed(2));
    const fillHex = r % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    lines.push(
      `      - { id: row_bg_${r}, type: rect, x: ${tableX}, y: ${ry}, w: ${tableW}, h: ${rowH}, fill: "${fillHex}", stroke: "#CBD5E1", stroke_width: 0.2 }`
    );
  }

  // Subtle vertical column dividers
  lines.push(
    `      - { id: div_col1, type: line, x1: ${Number((tableX + colTerrW).toFixed(2))}, y1: ${headerTopY}, x2: ${Number((tableX + colTerrW).toFixed(2))}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#CBD5E1", stroke_width: 0.2 }`,
    `      - { id: div_col2, type: line, x1: ${Number((tableX + colTerrW + colLastW).toFixed(2))}, y1: ${headerTopY}, x2: ${Number((tableX + colTerrW + colLastW).toFixed(2))}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#CBD5E1", stroke_width: 0.2 }`
  );

  for (let c = 1; c < 4; c++) {
    const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
    lines.push(
      `      - { id: div_cyc_${c}, type: line, x1: ${cx}, y1: ${headerTopY}, x2: ${cx}, y2: ${Number((headerTopY + headerH + 20 * rowH).toFixed(2))}, stroke: "#E2E8F0", stroke_width: 0.2 }`
    );
  }

  // Layer 2: Titles, Column Labels, and 20-Row Bindings
  lines.push(
    '  - id: dados_painel',
    '    name: Dados de Cobertura dos Setores',
    '    items:',
    `      - { id: banner_title, type: text, x: ${tableX + 4}, y: 12.2, w: 130, text: "CONTROLE OPERACIONAL DE SETORES E CICLOS", size: 11, weight: bold, color: "#F8FAFC" }`,
    `      - { id: banner_sub, type: text, x: ${tableX + 4}, y: 18, w: 120, text: "SEKUNDO ENGINE — PAINEL AGNOSTICO DE COBERTURA", size: 7.5, color: "#94A3B8" }`,
    `      - { id: banner_year, type: text, x: ${tableX + tableW - 48}, y: 14, w: 44, text: "CICLO {{serviceYear}}", size: 9.5, weight: bold, align: right, color: "#38BDF8" }`,
    `      - { id: hdr_sector, type: text, x: ${tableX + 2}, y: ${Number((headerTopY + 2.5).toFixed(2))}, w: ${colTerrW - 3}, text: "SETOR / LOCAL", size: 7, weight: bold, color: "#F8FAFC" }`,
    `      - { id: hdr_last, type: text, x: ${Number((tableX + colTerrW + 2).toFixed(2))}, y: ${Number((headerTopY + 2.5).toFixed(2))}, w: ${colLastW - 3}, text: "ULT. CICLO", size: 7, weight: bold, color: "#F8FAFC" }`
  );

  for (let c = 0; c < 4; c++) {
    const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
    lines.push(
      `      - { id: hdr_cyc_${c}, type: text, x: ${Number((cx + 2).toFixed(2))}, y: ${Number((headerTopY + 2.5).toFixed(2))}, w: ${colCycleW - 3}, text: "CICLO 0${c + 1} (OPERADOR / DATAS)", size: 6.5, weight: bold, color: "#E2E8F0" }`
    );
  }

  for (let r = 0; r < 20; r++) {
    const ry = Number((headerTopY + headerH + r * rowH).toFixed(2));
    lines.push(
      `      - { id: r_${r}_code, type: text, x: ${tableX + 2}, y: ${Number((ry + 1.5).toFixed(2))}, w: ${colTerrW - 3}, text: "{{rows.${r}.territoryNumber | truncate:14}}", size: 7.5, weight: bold, color: "#0F172A" }`,
      `      - { id: r_${r}_loc, type: text, x: ${tableX + 2}, y: ${Number((ry + 5.8).toFixed(2))}, w: ${colTerrW - 3}, text: "{{rows.${r}.locality | truncate:18}}", size: 6.5, color: "#475569" }`,
      `      - { id: r_${r}_last, type: text, x: ${Number((tableX + colTerrW + 2).toFixed(2))}, y: ${Number((ry + 3.5).toFixed(2))}, w: ${colLastW - 3}, text: "{{rows.${r}.lastCompletedDate | truncate:12}}", size: 6.8, color: "#334155" }`
    );
    for (let c = 0; c < 4; c++) {
      const cx = Number((tableX + colTerrW + colLastW + c * colCycleW).toFixed(2));
      lines.push(
        `      - { id: r_${r}_c${c}_who, type: text, x: ${Number((cx + 1.5).toFixed(2))}, y: ${Number((ry + 1.5).toFixed(2))}, w: ${colCycleW - 3}, text: "{{rows.${r}.c${c}_assignedTo | truncate:22}}", size: 6.8, weight: bold, color: "#0F172A" }`,
        `      - { id: r_${r}_c${c}_dates, type: text, x: ${Number((cx + 1.5).toFixed(2))}, y: ${Number((ry + 6.0).toFixed(2))}, w: ${colCycleW - 3}, text: "{{rows.${r}.c${c}_assignedAt | truncate:10}} -> {{rows.${r}.c${c}_completedAt | truncate:10}}", size: 6, color: "#64748B" }`
      );
    }
  }

  const footerY = Number((headerTopY + headerH + 20 * rowH + 3.5).toFixed(2));
  lines.push(
    `      - { id: footer_note, type: text, x: ${tableX}, y: ${footerY}, w: 185, text: "SEKUNDO ENGINE — Relatorio gerado localmente (100% agnostico e offline).", size: 7.5, color: "#64748B" }`,
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
    name: 'Cartões de Tarefa Operacional 4-Up (A4)',
    yaml: S89_4UP_SDOC_YAML,
  },
  'territorios-multiciclo': {
    id: 'territorios-multiciclo',
    name: 'Painel Executivo de Setores (Multi-Ciclo)',
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

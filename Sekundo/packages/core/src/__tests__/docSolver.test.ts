import { describe, it, expect } from 'vitest';
import {
  toPdf,
  fromPdf,
  PAGE_FORMATS,
  measureTextWidthMm,
  breakTextIntoLines,
  parseSdocYaml,
  solveLayout,
  SdocCstMutator,
  inspectPDFForm,
  stampCoordinateMapOnPDF,
  computeTemplateFingerprintSha256,
  extractTextStage,
  extractVectorStage,
  detectGridStage,
  synthesizeIngestedSdoc,
  writeUnifiedOutput,
  parseAppManifestYaml,
  DEFAULT_SEKUNDO_APP_YAML,
} from '../index';

describe('Phase F0, F2, F4, F5 — SDOC Solver, Units, CST Mutator, Multi-page AcroForm & Ingestion', () => {
  it('satisfies coordinate roundtrip property: fromPdf(toPdf(p)) ≈ p (±0.01mm) across 1,000 random points in A4 and Letter', () => {
    const formats = [PAGE_FORMATS.a4, PAGE_FORMATS.letter];
    for (const fmt of formats) {
      for (let i = 0; i < 500; i++) {
        const xMm = Math.random() * fmt.widthMm;
        const yMm = Math.random() * fmt.heightMm;
        const hMm = Math.random() * 30;

        const { xPt, yPt } = toPdf(xMm, yMm, fmt.heightMm, hMm);
        const restored = fromPdf(xPt, yPt, fmt.heightMm, hMm);

        expect(Math.abs(restored.xMm - xMm)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(restored.yMm - yMm)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it('guarantees every broken line in DisplayList has width <= box w', () => {
    const boxWidthMm = 45;
    const fontSizePt = 10;
    const sampleText =
      'Esta é uma frase longa de teste para validar que o Layout Solver quebra todas as linhas respeitando rigorosamente a largura máxima em milímetros, inclusive palavrasGigantescasSemEspacoAlgumNoMeio.';
    const lines = breakTextIntoLines(sampleText, boxWidthMm, fontSizePt, 'normal');
    expect(lines.length).toBeGreaterThan(3);
    for (const line of lines) {
      const w = measureTextWidthMm(line, fontSizePt, 'normal');
      expect(w).toBeLessThanOrEqual(boxWidthMm + 0.01);
    }
  });

  it('mutates only the target primitive coordinate in YAML via CST while preserving user comments', () => {
    const originalYaml = `# Comentário do cabeçalho do usuário (NÃO PODE SUMIR)
sdoc: 1
name: Meu Documento Comentado
page:
  format: a4
layers:
  - id: camada_base
    # Comentário importante na camada
    items:
      - id: quadro_1
        type: rect
        x: 10 # posição inicial X
        y: 20
        w: 80
        h: 40
`;

    const mutated = SdocCstMutator.updatePrimitiveInPlace(originalYaml, 'quadro_1', { x: 55.5 });
    expect(mutated).toContain('# Comentário do cabeçalho do usuário (NÃO PODE SUMIR)');
    expect(mutated).toContain('# Comentário importante na camada');
    expect(mutated).toContain('x: 55.5');
    expect(mutated).toContain('y: 20');
  });

  it('detects AcroForm fields on page 3 of a 5-page PDF and stamps coordinate maps in mm', async () => {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      doc.addPage([595.28, 841.89]);
    }
    const page3 = doc.getPages()[2];
    const form = doc.getForm();
    const tf = form.createTextField('campo_pagina_3');
    tf.addToPage(page3, { x: 100, y: 500, width: 180, height: 20 });

    const pdfBytes = await doc.save();
    const sha = await computeTemplateFingerprintSha256(pdfBytes);
    expect(sha).toMatch(/^sha256:[0-9a-f]{64}$/);

    const inspected = await inspectPDFForm(pdfBytes);
    expect(inspected).toHaveLength(1);
    expect(inspected[0].fieldName).toBe('campo_pagina_3');
    expect(inspected[0].page).toBe(3);

    const stamped = await stampCoordinateMapOnPDF(
      pdfBytes,
      {
        '01-01': {
          x: 25,
          y: 40,
          unit: 'mm',
          page: 3,
          printMode: 'keyAndValue',
          label: 'Orador',
          fontSize: 11,
        },
      },
      [
        {
          key: '01-01',
          type: 'slot',
          label: 'Expositor',
          value: 'Alex Nogueira 🎯',
          email: '',
          meta: {},
        },
      ]
    );
    expect(stamped.stampedCount).toBe(1);
    expect(stamped.pdfBytes.byteLength).toBeGreaterThan(pdfBytes.byteLength);
  });

  it('fuses kerning text fragments, collinear vector segments, and detects tables in ingestion stages', () => {
    const texts = extractTextStage(
      [
        { str: 'REG', xPt: 50, yPt: 780, widthPt: 24, heightPt: 12 },
        { str: 'ISTRO', xPt: 74.5, yPt: 780, widthPt: 36, heightPt: 12 },
        { str: 'Separado', xPt: 50, yPt: 740, widthPt: 45, heightPt: 10 },
      ],
      297
    );
    expect(texts).toHaveLength(2);
    expect((texts[0] as any).text).toBe('REGISTRO');

    const vectors = extractVectorStage(
      [
        // 3 horizontal lines
        { type: 'line', xPt: 30, yPt: 700, x2Pt: 230, y2Pt: 700 },
        { type: 'line', xPt: 30, yPt: 670, x2Pt: 230, y2Pt: 670 },
        { type: 'line', xPt: 30, yPt: 640, x2Pt: 230, y2Pt: 640 },
        // 3 vertical lines
        { type: 'line', xPt: 30, yPt: 700, x2Pt: 30, y2Pt: 640 },
        { type: 'line', xPt: 130, yPt: 700, x2Pt: 130, y2Pt: 640 },
        { type: 'line', xPt: 230, yPt: 700, x2Pt: 230, y2Pt: 640 },
      ],
      297
    );

    const gridResult = detectGridStage(vectors);
    expect(gridResult.tables).toHaveLength(1);
    const tbl = gridResult.tables[0] as Extract<typeof gridResult.tables[0], { type: 'table' }>;
    expect(tbl.cols.length).toBe(2);
    expect(tbl.rows.length).toBe(2);

    const ingested = synthesizeIngestedSdoc({
      name: 'Teste Ingestão',
      sha256: 'sha256:abc123',
      mode: 'rebuild',
      pageCount: 1,
      textItems: texts,
      vectorItems: vectors,
    });
    expect(ingested.report.tableCount).toBe(1);
    expect(ingested.report.textCount).toBe(2);
    const parsed = parseSdocYaml(ingested.yaml);
    expect(parsed.doc).not.toBeNull();
    const dl = solveLayout(parsed.doc!);
    expect(dl.pages).toHaveLength(1);
  });

  it('produces consistent data across all 4 unified output writers (whatsapp, csv, yaml, pdf) & parses app manifest', async () => {
    const registry = [
      {
        key: '01-01',
        type: 'slot' as const,
        label: 'Palestra Principal',
        value: 'Caio Cavalcanti',
        email: 'caio@example.org',
        meta: { date: '2026-10-18', room: 'Auditório Principal', assistantTo: 'Daniela' },
      },
    ];

    const wa = (await writeUnifiedOutput('whatsapp', {
      registry,
      eventName: 'Sessão Plenária',
      options: {
        customTemplate: '📅 *{{eventName}}*\n{{#each slots}}• {{label}}: {{value}} ({{date | date:"dd/MM/yyyy"}}){{/each}}',
      },
    })) as string;
    const csv = (await writeUnifiedOutput('csv', { registry, eventName: 'Sessão Plenária' })) as string;
    const yml = (await writeUnifiedOutput('yaml', { registry, eventName: 'Sessão Plenária' })) as string;
    const pdf = (await writeUnifiedOutput('pdf', { registry, eventName: 'Sessão Plenária' })) as Uint8Array;

    expect(wa).toContain('Caio Cavalcanti');
    expect(wa).toContain('18/10/2026');
    expect(csv).toContain('Caio Cavalcanti');
    expect(yml).toContain('Caio Cavalcanti');
    expect(pdf.byteLength).toBeGreaterThan(500);

    const manifest = parseAppManifestYaml(DEFAULT_SEKUNDO_APP_YAML);
    expect(manifest.pranchetas.length).toBeGreaterThanOrEqual(2);
    expect(manifest.rituais.every((r) => r.confirmar === true)).toBe(true);
  });
});

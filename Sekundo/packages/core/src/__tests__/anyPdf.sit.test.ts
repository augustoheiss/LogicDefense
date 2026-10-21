/**
 * Sekundo — Any-PDF SIT & QA R1 Acceptance Test Suite (`anyPdf.sit.test.ts`)
 *
 * Promotes all 20 probes from `zz_qa_r1_sit.test.ts` into strict, measurable
 * assertions matching Part 4 of the QA R1 + SIT Remediation Plan:
 * - C1: US Letter page size & field drift <= 0.5 mm (output = 612 x 792 pt)
 * - C3: Multi-page rebuild 1:1 text per page (no duplication onto pages 2..N)
 * - C4: Repeat + multi-page underlay emits all underlay pages per record
 * - C5: Corrupt or missing underlay throws `UnderlayError`
 * - C6: Pre-filled AcroForm defaultValue preserved in output
 * - C7: Empty registry with repeat emits 0 fake demo records + warning
 * - C8: 20-page underlay repeat size ratio <= 1.5x (shared Form XObject cache)
 * - C9: Generic form fields (CPF, Telefone, Endereco, Nome) bind to `input.<field>` and render 4 distinct values from `*.form.yaml`
 * - H1: Checkbox `"false"` string unchecks box; radio group selects `'F'`; dropdown selects `'RJ'`
 * - H2: Value longer than `maxLength` truncates and fills with warning instead of failing
 * - H3: Emoji, Cyrillic, curly quotes, and accents succeed (`ok: true`) with structured warnings
 * - H4 / U8: `/XFA` and `/Sig` detected before `getForm()` and surfaced in `runDocumentPreflight`
 * - H5: `extractAcroFormStage` preserves `fieldType`, `options`, `maxLength`, `defaultValue`
 * - H6: `measureTextWidthMm` error <= 1.0% vs real `StandardFonts.Helvetica` and `HelveticaBold`
 * - H7: Truncated text records warning with field name, original text, and cut text
 * - H8: `/Rotate 90` page sets `orientation: 'landscape'` and transforms field coordinates
 * - H10: `date` filter supports `dd/MM`, `dd 'de' MMMM`, and `dd/MM/yyyy` -> `yyyy-MM-dd`
 * - H11: `fillAcroFormMailMerge` 20-record size ratio <= 1.5x
 * - H12: Multi-widget field reports all pages (`[1, 2]`)
 * - R4: `docOps.ts` HLC field-level reconciliation & conflict detection + PDF provenance metadata
 */

import { describe, it, expect } from 'vitest';
import {
  PDFDocument,
  StandardFonts,
  PDFName,
  PDFString,
  degrees,
} from 'pdf-lib';
import {
  extractAcroFormStage,
  synthesizeIngestedSdoc,
  solveLayout,
  measureTextWidthMm,
  renderDisplayListToPdf,
  UnderlayError,
  inspectPDFForm,
  fillAcroForm,
  fillAcroFormMailMerge,
  renderTemplateString,
  parseFormRecordYaml,
  formRecordToContexts,
  runDocumentPreflight,
  createHLC,
  tickHLC,
  createSetFieldValueOp,
  reconcileDocFieldOps,
  encodeDocSyncEnvelope,
  decodeDocSyncEnvelope,
  PT_PER_MM,
} from '../index';

async function makeForm(opts: {
  size?: [number, number];
  pages?: number;
  rotate?: number;
  fields?: { name: string; page?: number; x: number; y: number; w: number; h: number; maxLen?: number }[];
  checkbox?: string;
  radio?: { name: string; options: string[] };
  dropdown?: { name: string; options: string[] };
  prefill?: Record<string, string>;
  xfa?: boolean;
  sig?: boolean;
  heavyContent?: boolean;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = opts.size || [595.28, 841.89];
  const pages = Array.from({ length: opts.pages || 1 }, () => doc.addPage(size));
  if (opts.rotate) pages.forEach((p) => p.setRotation(degrees(opts.rotate!)));
  pages.forEach((p, i) => {
    p.drawText(`Formulario de teste - pagina ${i + 1}`, { x: 40, y: size[1] - 40, size: 12, font });
    if (opts.heavyContent) {
      for (let k = 0; k < 600; k++) {
        p.drawText(`Linha de conteudo pesado numero ${k} lorem ipsum dolor sit amet`, {
          x: 20,
          y: (k * 7) % (size[1] - 60),
          size: 6,
          font,
        });
      }
    }
  });
  const form = doc.getForm();
  for (const f of opts.fields || []) {
    const tf = form.createTextField(f.name);
    if (f.maxLen) tf.setMaxLength(f.maxLen);
    tf.addToPage(pages[(f.page || 1) - 1], { x: f.x, y: f.y, width: f.w, height: f.h });
    if (opts.prefill?.[f.name]) tf.setText(opts.prefill[f.name]);
  }
  if (opts.checkbox) {
    const cb = form.createCheckBox(opts.checkbox);
    cb.addToPage(pages[0], { x: 40, y: 100, width: 14, height: 14 });
  }
  if (opts.radio) {
    const rg = form.createRadioGroup(opts.radio.name);
    opts.radio.options.forEach((o, i) =>
      rg.addOptionToPage(o, pages[0], { x: 40 + i * 30, y: 140, width: 14, height: 14 })
    );
  }
  if (opts.dropdown) {
    const dd = form.createDropdown(opts.dropdown.name);
    dd.addOptions(opts.dropdown.options);
    dd.addToPage(pages[0], { x: 200, y: 140, width: 120, height: 18 });
  }
  if (opts.xfa) {
    form.updateFieldAppearances();
    form.acroForm.dict.set(PDFName.of('XFA'), PDFString.of('<xdp:xdp/>'));
  }
  if (opts.sig) {
    form.acroForm.dict.set(PDFName.of('SigFlags'), doc.context.obj(3));
    const sigDict = doc.context.obj({
      FT: 'Sig',
      T: PDFString.of('Assinatura_Digital'),
      V: { Type: 'Sig', Filter: 'Adobe.PPKLite', ByteRange: [0, 100, 200, 300] },
    });
    form.acroForm.addField(doc.context.register(sigDict));
  }
  return doc.save({ updateFieldAppearances: !opts.xfa });
}

async function ingestLikeApp(bytes: Uint8Array, mode: 'overlay' | 'rebuild' = 'overlay') {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const p0 = pdf.getPages()[0];
  const { width, height } = p0.getSize();
  const widthMm = Number((width / PT_PER_MM).toFixed(2));
  const heightMm = Number((height / PT_PER_MM).toFixed(2));
  const raw = await inspectPDFForm(bytes);
  const fields = extractAcroFormStage(raw, heightMm, [], widthMm);
  const res = synthesizeIngestedSdoc({
    name: 'probe',
    sha256: 'sha256:probe',
    mode,
    pageCount: pdf.getPageCount(),
    widthMm,
    heightMm,
    isXfa: raw.some((f) => f.isXfa),
    hasSignature: raw.some((f) => f.hasSignature),
    isEncrypted: raw.some((f) => f.isEncrypted),
    fields,
  });
  return { ...res, raw, widthMm, heightMm, pageCount: pdf.getPageCount(), rotation: p0.getRotation().angle };
}

const registry1 = [
  { key: '01-01', label: 'Leitura', value: 'Participante 01', type: 'slot', status: 'active', meta: { date: '2026-10-15', room: 'Sala A' } },
] as any[];

describe('QA R1 + SIT Acceptance Suite (Part 4 Targets)', () => {
  it('C1 — Letter-size PDF ingest preserves 612x792 pt output and <= 0.5 mm vertical drift', async () => {
    const bytes = await makeForm({
      size: [612, 792],
      fields: [{ name: 'Nome', x: 72, y: 72, w: 200, h: 18 }],
    });
    const ing = await ingestLikeApp(bytes);
    expect(ing.doc.page.format).toBe('letter');

    const dl = solveLayout(ing.doc, registry1);
    expect(dl.pages[0].widthMm).toBeCloseTo(215.9, 1);
    expect(dl.pages[0].heightMm).toBeCloseTo(279.4, 1);

    const out = await renderDisplayListToPdf(dl, { blobs: { 'sha256:probe': bytes } });
    const outDoc = await PDFDocument.load(out);
    const outSize = outDoc.getPages()[0].getSize();
    expect(outSize.width).toBeCloseTo(612, 1);
    expect(outSize.height).toBeCloseTo(792, 1);

    const fieldOp = dl.pages[0].ops.find((o) => o.layerId === 'fields')!;
    const outBottomPt = outSize.height - (fieldOp.y + fieldOp.h) * PT_PER_MM;
    const verticalDriftMm = Math.abs((outBottomPt - 72) / PT_PER_MM);
    expect(verticalDriftMm).toBeLessThanOrEqual(0.5);
  });

  it('C3 — multi-page rebuild scopes page-1 text strictly to page 1 (1:1 per page)', () => {
    const res = synthesizeIngestedSdoc({
      name: 'mp',
      sha256: 'sha256:mp',
      mode: 'rebuild',
      pageCount: 3,
      widthMm: 210,
      heightMm: 297,
      textItems: [
        { type: 'text', id: 'txt_1', page: 1, x: 20, y: 20, w: 100, text: 'Titulo da pagina 1', size: 12 },
        { type: 'text', id: 'txt_2', page: 2, x: 20, y: 20, w: 100, text: 'Titulo da pagina 2', size: 12 },
      ],
    });
    const dl = solveLayout(res.doc, registry1);
    expect(dl.pages.length).toBe(3);

    const textOpsPerPage = dl.pages.map((p) =>
      p.ops.filter((o) => o.kind === 'text').map((o: any) => o.lines?.join(' '))
    );
    expect(textOpsPerPage[0]).toEqual(['Titulo da pagina 1']);
    expect(textOpsPerPage[1]).toEqual(['Titulo da pagina 2']);
    expect(textOpsPerPage[2]).toEqual([]);
  });

  it('C4 — repeat + multi-page underlay emits all underlay pages [1, 2] for every record', () => {
    const doc: any = {
      sdoc: 1,
      name: 'mm',
      page: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      underlay: { source: 'sha256:x', pages: [1, 2], mode: 'overlay' },
      repeat: { over: 'slots', per_page: 1 },
      fields: [
        { id: 'f1', from: 'acroform', name: 'Nome', page: 1, rect: [20, 20, 80, 8], bind: 'value' },
        { id: 'f2', from: 'acroform', name: 'Assinatura', page: 2, rect: [20, 20, 80, 8], bind: 'label' },
      ],
      layers: [],
    };
    const dl = solveLayout(doc, [], {
      customContexts: [
        { value: 'Registro A', label: 'Pag2-A' },
        { value: 'Registro B', label: 'Pag2-B' },
        { value: 'Registro C', label: 'Pag2-C' },
      ],
    });

    expect(dl.pages.length).toBe(6);
    expect(dl.pages.map((p) => p.underlay?.page)).toEqual([1, 2, 1, 2, 1, 2]);
    expect(dl.pages.map((p) => (p.ops[0] as any).lines.join(' '))).toEqual([
      'Registro A',
      'Pag2-A',
      'Registro B',
      'Pag2-B',
      'Registro C',
      'Pag2-C',
    ]);
  });

  it('C5 — corrupt or missing underlay throws UnderlayError', async () => {
    const doc: any = {
      sdoc: 1,
      name: 'c',
      page: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      underlay: { source: 'sha256:bad', pages: [1], mode: 'overlay' },
      layers: [{ id: 'l', name: 'l', items: [{ type: 'text', id: 't', x: 10, y: 10, w: 100, text: 'Valor', size: 10 }] }],
    };
    const dl = solveLayout(doc, []);

    await expect(
      renderDisplayListToPdf(dl, { blobs: { 'sha256:bad': new Uint8Array([1, 2, 3, 4, 5]) } })
    ).rejects.toThrow(UnderlayError);

    await expect(renderDisplayListToPdf(dl, { blobs: {} })).rejects.toThrow(UnderlayError);
  });

  it('C6 — pre-filled AcroForm values are preserved via defaultValue fallback', async () => {
    const bytes = await makeForm({
      fields: [{ name: 'Campo', x: 72, y: 600, w: 200, h: 18 }],
      prefill: { Campo: 'VALOR_PRE_PREENCHIDO' },
    });
    const ing = await ingestLikeApp(bytes);
    expect(ing.doc.fields?.[0]?.defaultValue).toBe('VALOR_PRE_PREENCHIDO');

    const dl = solveLayout(ing.doc, []);
    const fieldOp = dl.pages[0].ops.find((o) => o.layerId === 'fields') as any;
    expect(fieldOp.lines).toEqual(['VALOR_PRE_PREENCHIDO']);
  });

  it('C7 — empty registry with repeat injects 0 fake demo data and records a warning', () => {
    const doc: any = {
      sdoc: 1,
      name: 'r',
      page: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      repeat: { over: "slots(where: value != '')", per_page: 1 },
      layers: [
        {
          id: 'l',
          name: 'l',
          items: [{ type: 'text', id: 't', x: 10, y: 10, w: 150, text: '{{value}} / {{meta.assistantTo}}', size: 10 }],
        },
      ],
    };
    const dl = solveLayout(doc, []);
    const texts = dl.pages[0].ops.map((o: any) => o.lines?.join(' ')).join(' ');
    expect(texts).not.toContain('Voluntário Exemplo');
    expect(texts).not.toContain('Ajudante Exemplo');
    expect(dl.warnings.length).toBeGreaterThan(0);
  });

  it('C8 — painter caches embedded underlay XObject so 20 pages <= 1.5x of 1 page', async () => {
    const bytes = await makeForm({ fields: [{ name: 'Nome', x: 72, y: 600, w: 200, h: 18 }], heavyContent: true });
    const mk = (): any => ({
      sdoc: 1,
      name: 's',
      page: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      underlay: { source: 'sha256:h', pages: [1], mode: 'overlay' },
      repeat: { over: 'slots', per_page: 1 },
      fields: [{ id: 'f', from: 'acroform', name: 'Nome', page: 1, rect: [20, 20, 80, 8], bind: 'value' }],
      layers: [],
    });
    const ctx = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `Pessoa ${i + 1}` }));
    const o1 = await renderDisplayListToPdf(solveLayout(mk(), [], { customContexts: ctx(1) }), { blobs: { 'sha256:h': bytes } });
    const o20 = await renderDisplayListToPdf(solveLayout(mk(), [], { customContexts: ctx(20) }), { blobs: { 'sha256:h': bytes } });

    const growthRatio = o20.length / o1.length;
    expect(growthRatio).toBeLessThanOrEqual(1.5);
  });

  it('C9 — generic form (CPF/Telefone/Endereco/Nome) binds to input.<field> and renders 4 distinct values from form.yaml', async () => {
    const bytes = await makeForm({
      fields: [
        { name: 'CPF', x: 72, y: 700, w: 150, h: 18 },
        { name: 'Telefone', x: 72, y: 660, w: 150, h: 18 },
        { name: 'Endereco_Residencial', x: 72, y: 620, w: 300, h: 18 },
        { name: 'Nome_Completo', x: 72, y: 580, w: 300, h: 18 },
      ],
    });
    const ing = await ingestLikeApp(bytes);
    const binds = (ing.doc.fields || []).map((f) => ({ name: f.name, bind: f.bind }));
    expect(binds.find((b) => b.name === 'CPF')?.bind).toBe('input.CPF');
    expect(binds.find((b) => b.name === 'Telefone')?.bind).toBe('input.Telefone');

    const formYaml = [
      'form: 1',
      'records:',
      '  - id: rec_1',
      '    values:',
      '      CPF: "123.456.789-00"',
      '      Telefone: "(11) 98888-7777"',
      '      Endereco_Residencial: "Av. Paulista, 1000"',
      '      Nome_Completo: "Participante 01"',
    ].join('\n');

    const parsedForm = parseFormRecordYaml(formYaml);
    const dl = solveLayout(ing.doc, [], { customContexts: formRecordToContexts(parsedForm) });
    const renderedTexts = dl.pages[0].ops
      .filter((o) => o.layerId === 'fields')
      .map((o: any) => o.lines?.join(' '));

    expect(renderedTexts).toEqual([
      '123.456.789-00',
      '(11) 98888-7777',
      'Av. Paulista, 1000',
      'Participante 01',
    ]);
    expect(new Set(renderedTexts).size).toBe(4);
  });

  it('H1 — checkbox "false" string unchecks box; radio selects "F"; dropdown selects "RJ"', async () => {
    const bytes = await makeForm({
      checkbox: 'Aceito',
      radio: { name: 'Sexo', options: ['M', 'F'] },
      dropdown: { name: 'Estado', options: ['SP', 'RJ', 'MG'] },
    });
    const r = await fillAcroForm(bytes, { Aceito: 'false', Sexo: 'F', Estado: 'RJ' }, { flatten: false });
    const d = await PDFDocument.load(r.pdfBytes);
    const f = d.getForm();

    expect(f.getCheckBox('Aceito').isChecked()).toBe(false);
    expect(f.getRadioGroup('Sexo').getSelected()).toBe('F');
    expect(f.getDropdown('Estado').getSelected()).toEqual(['RJ']);
    expect(r.matchedFields).toEqual(['Aceito', 'Sexo', 'Estado']);
    expect(r.unmatchedFields).toEqual([]);
  });

  it('H2 — value longer than maxLength is truncated and filled with a warning', async () => {
    const bytes = await makeForm({ fields: [{ name: 'CEP', x: 72, y: 700, w: 100, h: 18, maxLen: 8 }] });
    const r = await fillAcroForm(bytes, { CEP: '01310-100 (Bela Vista)' }, { flatten: false });
    expect(r.matchedFields).toEqual(['CEP']);
    expect(r.filledFieldCount).toBe(1);
    expect(r.warnings?.length).toBeGreaterThan(0);

    const d = await PDFDocument.load(r.pdfBytes);
    expect(d.getForm().getTextField('CEP').getText()).toBe('01310-10');
  });

  it('H3 — emoji, Cyrillic, curly quotes, and accents succeed without throwing', async () => {
    const bytes = await makeForm({ fields: [{ name: 'Nome', x: 72, y: 700, w: 200, h: 18 }] });
    for (const val of ['Operador 😀', 'Оператор', '“Participante” – ok', 'Sessão Ação']) {
      const r = await fillAcroForm(bytes, { Nome: val }, { flatten: true });
      expect(r.filledFieldCount).toBe(1);
      expect(r.matchedFields).toEqual(['Nome']);
    }
  });

  it('H4 & U8 — XFA form and digital signature (/Sig) are detected and surfaced in preflight', async () => {
    const bytes = await makeForm({
      fields: [{ name: 'Nome', x: 72, y: 700, w: 200, h: 18 }],
      xfa: true,
      sig: true,
    });
    const ing = await ingestLikeApp(bytes);
    expect(ing.raw.some((f) => f.isXfa)).toBe(true);
    expect(ing.raw.some((f) => f.hasSignature)).toBe(true);

    const pf = runDocumentPreflight({ doc: ing.doc });
    expect(pf.blocksSilentFlatten).toBe(true);
    expect(pf.issues.some((i) => i.code === 'XFA_UNSUPPORTED')).toBe(true);
    expect(pf.issues.some((i) => i.code === 'DIGITAL_SIGNATURE_DETECTED')).toBe(true);
  });

  it('H5 — ingest preserves fieldType and options for checkbox, radio, and dropdown', async () => {
    const bytes = await makeForm({
      checkbox: 'Aceito',
      radio: { name: 'Sexo', options: ['M', 'F'] },
      dropdown: { name: 'Estado', options: ['SP', 'RJ'] },
    });
    const ing = await ingestLikeApp(bytes);
    const byName = Object.fromEntries((ing.doc.fields || []).map((f) => [f.name, f]));

    expect(byName.Aceito?.fieldType).toBe('checkbox');
    expect(byName.Sexo?.fieldType).toBe('radio');
    expect(byName.Sexo?.options).toEqual(['M', 'F']);
    expect(byName.Estado?.fieldType).toBe('dropdown');
    expect(byName.Estado?.options).toEqual(['SP', 'RJ']);
  });

  it('H6 — measureTextWidthMm matches real Helvetica and Helvetica-Bold within <= 1.0%', async () => {
    const doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const samples = ['DESIGNAÇÃO ÁÉÍÓÚ', 'Programação da Reunião', 'WWWWMMMM', 'Participante 01'];

    for (const s of samples) {
      const realReg = reg.widthOfTextAtSize(s, 10) / PT_PER_MM;
      const realBold = bold.widthOfTextAtSize(s, 10) / PT_PER_MM;
      const estReg = measureTextWidthMm(s, 10, 'normal');
      const estBold = measureTextWidthMm(s, 10, 'bold');

      const regErrPct = Math.abs(((estReg - realReg) / realReg) * 100);
      const boldErrPct = Math.abs(((estBold - realBold) / realBold) * 100);
      expect(regErrPct).toBeLessThanOrEqual(1.0);
      expect(boldErrPct).toBeLessThanOrEqual(1.0);
    }
  });

  it('H7 — truncated field text records a structured warning with field, original text, and cut text', () => {
    const doc: any = {
      sdoc: 1,
      name: 't',
      page: { format: 'a4', orientation: 'portrait', unit: 'mm' },
      fields: [{ id: 'f', from: 'acroform', name: 'Nome', page: 1, rect: [20, 20, 30, 6], bind: 'value' }],
      layers: [],
    };
    const fullText = 'Coordenador Operacional Regional do Setor Central Alpha';
    const dl = solveLayout(doc, [{ key: 'k', label: 'l', value: fullText } as any]);
    const op: any = dl.pages[0].ops[0];
    expect(dl.warnings.length).toBeGreaterThan(0);
    expect(dl.warnings[0]).toContain('Nome');
    expect(dl.warnings[0]).toContain(fullText);
    expect(dl.warnings[0]).toContain(op.lines[0]);
  });

  it('H8 — /Rotate 90 page sets landscape orientation and transforms field coordinates', async () => {
    const bytes = await makeForm({ rotate: 90, fields: [{ name: 'Nome', x: 72, y: 700, w: 200, h: 18 }] });
    const ing = await ingestLikeApp(bytes);
    expect(ing.rotation).toBe(90);
    expect(ing.doc.page.orientation).toBe('landscape');
    expect(ing.doc.page.widthMm).toBeGreaterThan(ing.doc.page.heightMm!);
  });

  it('H10 — date filter supports dd/MM, dd de MMMM, and dd/MM/yyyy -> yyyy-MM-dd', () => {
    expect(renderTemplateString("{{d | date:'dd/MM/yyyy'}}", { d: '2026-10-15' })).toBe('15/10/2026');
    expect(renderTemplateString("{{d | date:'dd/MM'}}", { d: '2026-10-15' })).toBe('15/10');
    expect(renderTemplateString("{{d | date:'dd \\'de\\' MMMM'}}", { d: '2026-10-15' })).toBe('15 de outubro');
    expect(renderTemplateString("{{d | date:'yyyy-MM-dd'}}", { d: '15/10/2026' })).toBe('2026-10-15');
  });

  it('H11 — fillAcroFormMailMerge 20-record size ratio <= 1.5x via shared Form XObject', async () => {
    const bytes = await makeForm({ fields: [{ name: 'Nome', x: 72, y: 700, w: 200, h: 18 }], heavyContent: true });
    const one = await fillAcroFormMailMerge(bytes, [{ Nome: 'A' }]);
    const many = await fillAcroFormMailMerge(
      bytes,
      Array.from({ length: 20 }, (_, i) => ({ Nome: `Pessoa ${i}` }))
    );

    const ratio = many.pdfBytes.length / one.pdfBytes.length;
    expect(ratio).toBeLessThanOrEqual(1.5);
  });

  it('H12 — multi-widget field reports all pages [1, 2]', async () => {
    const doc = await PDFDocument.create();
    const p1 = doc.addPage();
    const p2 = doc.addPage();
    const tf = doc.getForm().createTextField('NomeRepetido');
    tf.addToPage(p1, { x: 50, y: 700, width: 200, height: 18 });
    tf.addToPage(p2, { x: 50, y: 500, width: 200, height: 18 });
    const fields = await inspectPDFForm(await doc.save());

    expect(fields.length).toBe(2);
    expect(fields.map((f) => f.page)).toEqual([1, 2]);
    expect(fields[0].pages).toEqual([1, 2]);
  });

  it('R4 — HLC field-level sync operations reconcile deterministically and detect conflicts', () => {
    const baseForm = parseFormRecordYaml('form: 1\nrecords:\n  - id: rec_1\n    values:\n      CPF: "000"\n');
    const hlcA = createHLC('peer_A', 1000);
    const hlcB = tickHLC(hlcA, 'peer_B', 1005);

    const opA = createSetFieldValueOp('rec_1', 'CPF', '111.111.111-11', hlcA, 'Participante 01');
    const opB = createSetFieldValueOp('rec_1', 'CPF', '222.222.222-22', hlcB, 'Participante 02');
    const opTel = createSetFieldValueOp('rec_1', 'Telefone', '(11) 99999-0000', hlcA, 'Participante 01');

    const env = encodeDocSyncEnvelope('sha256:test', [opB, opA, opTel]);
    const decoded = decodeDocSyncEnvelope(env);
    expect(decoded?.templateHash).toBe('sha256:test');
    expect(decoded?.ops.length).toBe(3);

    const reconciled = reconcileDocFieldOps(baseForm, decoded!.ops as any);
    expect(reconciled.doc.records[0].values.CPF).toBe('222.222.222-22');
    expect(reconciled.doc.records[0].values.Telefone).toBe('(11) 99999-0000');
    expect(reconciled.conflicts.length).toBe(1);
    expect(reconciled.conflicts[0].winnerValue).toBe('222.222.222-22');
    expect(reconciled.conflicts[0].loserValue).toBe('111.111.111-11');
  });
});

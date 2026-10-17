import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFString, StandardFonts, degrees } from 'pdf-lib';
import {
  DEFAULT_MAP_SYMBOLOGY_CONFIG,
  SYMBOLOGY_DIMENSION_OPTIONS,
  SYMBOLOGY_SHAPES,
  extractSymbologyCategory,
  resolvePinSymbology,
  buildSymbologyLegend,
  extractAcroFormStage,
  inspectPDFForm,
  fillAcroForm,
  fillAcroFormMailMerge,
  PT_PER_MM,
} from '../index';

describe('Dynamic Map Symbology Engine (Bloco 3)', () => {
  const samplePins = [
    {
      key: '01.01.01',
      label: 'Unidade 100',
      worked: 0 as const,
      meta: {
        territory_number: 'T-01',
        zone: 'Zona Norte',
        neighborhood: 'Setor Alfa',
        city: 'Polo Central',
        state: 'SP',
        country: 'BR',
        property_type: 'residencial',
      },
    },
    {
      key: '01.02.01',
      label: 'Unidade 200',
      worked: 1 as const,
      meta: {
        territory_number: 'T-01',
        zone: 'Zona Norte',
        neighborhood: 'Setor Beta',
        city: 'Polo Central',
        state: 'SP',
        country: 'BR',
        property_type: 'comercial',
      },
    },
    {
      key: '02.01.01',
      label: 'Unidade 300',
      worked: 0 as const,
      meta: {
        territory_number: 'T-02',
        zone: 'Zona Sul',
        neighborhood: 'Setor Gama',
        city: 'Distrito Sul',
        state: 'RJ',
        country: 'BR',
        property_type: 'predio',
      },
    },
  ];

  it('defaults to unified circle mode (dimension: none, baseShape: circle) with empty legend', () => {
    expect(DEFAULT_MAP_SYMBOLOGY_CONFIG.dimension).toBe('none');
    expect(DEFAULT_MAP_SYMBOLOGY_CONFIG.baseShape).toBe('circle');

    const s0 = resolvePinSymbology(samplePins[0], false, DEFAULT_MAP_SYMBOLOGY_CONFIG);
    const s1 = resolvePinSymbology(samplePins[1], true, DEFAULT_MAP_SYMBOLOGY_CONFIG);
    const s2 = resolvePinSymbology(samplePins[2], false, DEFAULT_MAP_SYMBOLOGY_CONFIG);

    expect(s0.shape).toBe('circle');
    expect(s1.shape).toBe('circle');
    expect(s2.shape).toBe('circle');
    expect(s0.color).toBe('#0EA5E9'); // Pending
    expect(s1.color).toBe('#10B981'); // Worked

    const legend = buildSymbologyLegend(samplePins, DEFAULT_MAP_SYMBOLOGY_CONFIG);
    expect(legend).toEqual([]);
  });

  it('supports switching unified baseShape and custom overrides', () => {
    for (const shape of SYMBOLOGY_SHAPES) {
      const cfg = { ...DEFAULT_MAP_SYMBOLOGY_CONFIG, baseShape: shape };
      expect(resolvePinSymbology(samplePins[0], false, cfg).shape).toBe(shape);
    }

    const withOverride = resolvePinSymbology(
      {
        ...samplePins[0],
        meta: { ...samplePins[0].meta, pinShape: 'star', pinColor: '#EC4899' },
      },
      false,
      { ...DEFAULT_MAP_SYMBOLOGY_CONFIG, respectManualPinOverrides: true }
    );
    expect(withOverride.shape).toBe('star');
    expect(withOverride.color).toBe('#EC4899');
  });

  it('supports all 10 hierarchy dimensions including path_depth_1, path_depth_2, path_depth_3', () => {
    expect(SYMBOLOGY_DIMENSION_OPTIONS.map((d) => d.id)).toEqual([
      'none',
      'territory',
      'zone',
      'neighborhood',
      'city',
      'state_country',
      'property_type',
      'path_depth_1',
      'path_depth_2',
      'path_depth_3',
    ]);

    expect(extractSymbologyCategory(samplePins[0], 'path_depth_1').categoryLabel).toBe('N1: 01');
    expect(extractSymbologyCategory(samplePins[0], 'path_depth_2').categoryLabel).toBe('N2: 01');
    expect(extractSymbologyCategory(samplePins[0], 'path_depth_3').categoryLabel).toBe('N3: 01');

    const byZoneCfg = { ...DEFAULT_MAP_SYMBOLOGY_CONFIG, dimension: 'zone' as const };
    const zoneLegend = buildSymbologyLegend(samplePins, byZoneCfg);
    expect(zoneLegend.length).toBe(2);
    expect(zoneLegend.map((l) => l.label)).toEqual(['Zona Norte', 'Zona Sul']);
    expect(zoneLegend[0].count).toBe(2);
    expect(zoneLegend[1].count).toBe(1);
  });
});

describe('QA R2 PDF Engine Fixes (Bloco 5: R2-01 to R2-06)', () => {
  it('R2-01 & R2-02 — per-page geometry and /Rotate 180 coordinate transform in extractAcroFormStage', async () => {
    const doc = await PDFDocument.create();
    const p1 = doc.addPage([595.28, 841.89]); // Page 1: A4 Portrait (210x297mm)
    const p2 = doc.addPage([612, 1008]); // Page 2: US Legal (215.9x355.6mm) rotated 180 deg
    p2.setRotation(degrees(180));

    const form = doc.getForm();
    const f1 = form.createTextField('CampoP1');
    f1.addToPage(p1, { x: 50, y: 700, width: 100, height: 20 });

    const f2 = form.createTextField('CampoP2Rot180');
    f2.addToPage(p2, { x: 50, y: 100, width: 100, height: 20 });

    const pdfBytes = await doc.save();
    const rawFields = await inspectPDFForm(pdfBytes);

    const pagesGeometry = [
      { widthMm: 210, heightMm: 297 },
      { widthMm: 215.9, heightMm: 355.6, rotate: 180 },
    ];
    const extracted = extractAcroFormStage(rawFields, 297, [], 210, pagesGeometry);

    const extP2 = extracted.find((f) => f.name === 'CampoP2Rot180')!;
    expect(extP2.page).toBe(2);
    expect(extP2.pageRotation).toBe(180);
    // In /Rotate 180, yPt=100 from bottom-left maps to ptToMm(100) from visual top (~35.28mm)
    expect(extP2.rect[1]).toBeCloseTo(100 / PT_PER_MM, 0);
    // And xPt=50, width=100 maps to 215.9 - ptToMm(50) - ptToMm(100) (~163.0mm)
    expect(extP2.rect[0]).toBeCloseTo(215.9 - 150 / PT_PER_MM, 0);
  });

  it('R2-04 — fillAcroFormMailMerge preserves page rotation on merged pages', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const p1 = doc.addPage([595.28, 841.89]);
    p1.setRotation(degrees(90));
    p1.drawText('Template Rotacionado 90', { x: 40, y: 780, size: 12, font });
    const tf = doc.getForm().createTextField('Nome');
    tf.addToPage(p1, { x: 50, y: 700, width: 150, height: 20 });
    const bytes = await doc.save();

    const merged = await fillAcroFormMailMerge(bytes, [
      { Nome: 'Participante 01' },
      { Nome: 'Participante 02' },
    ]);
    const loaded = await PDFDocument.load(merged.pdfBytes);
    expect(loaded.getPageCount()).toBe(2);
    expect(loaded.getPages()[0].getRotation().angle).toBe(90);
    expect(loaded.getPages()[1].getRotation().angle).toBe(90);
  });

  it('R2-05 & R2-06 — fillAcroForm emits single-header PDF when unsigned and removes /Sig + /Perms when stripSignatures is true', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const form = doc.getForm();
    const tf = form.createTextField('Campo');
    tf.addToPage(page, { x: 50, y: 700, width: 150, height: 20 });

    // Unsigned PDF -> R2-05 single %PDF- header
    const unsignedBytes = await doc.save();
    const filledUnsigned = await fillAcroForm(
      unsignedBytes,
      { Campo: 'Valor Limpo' },
      { flatten: false }
    );
    const rawStr = new TextDecoder('latin1').decode(filledUnsigned.pdfBytes);
    const headerMatches = rawStr.match(/%PDF-/g) || [];
    expect(headerMatches.length).toBe(1);

    // Signed PDF with /Sig and /Perms -> R2-06 stripSignatures removes /Sig field and /Perms
    form.acroForm.dict.set(PDFName.of('SigFlags'), doc.context.obj(3));
    doc.catalog.set(PDFName.of('Perms'), doc.context.obj({}));
    const sigDict = doc.context.obj({
      FT: 'Sig',
      T: PDFString.of('Assinatura_Digital'),
      V: { Type: 'Sig', Filter: 'Adobe.PPKLite', ByteRange: [0, 100, 200, 300] },
    });
    form.acroForm.addField(doc.context.register(sigDict));
    const signedBytes = await doc.save();

    const stripped = await fillAcroForm(
      signedBytes,
      { Campo: 'Sem Assinatura' },
      { flatten: false, stripSignatures: true }
    );
    const strippedInspection = await inspectPDFForm(stripped.pdfBytes);
    expect(strippedInspection.some((f) => f.hasSignature)).toBe(false);
    expect(strippedInspection.some((f) => f.fieldType === 'signature')).toBe(false);
  });
});

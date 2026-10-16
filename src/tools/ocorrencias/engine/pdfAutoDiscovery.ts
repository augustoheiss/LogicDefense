/**
 * Ocorrências 2.0 PDF Engine — AcroForm Inspector, Anchor Discovery & SHA-256 Matcher
 * (`engine/pdfAutoDiscovery.ts`)
 *
 * Isolated and unified from:
 * - `@sekundo/core/pdf/acroFormFiller.ts` (AcroForm widget extraction, /XFA & /Sig detection)
 * - `@sekundo/core/pdf/templateMatcher.ts` (SHA-256 template fingerprinting)
 * - `src/tools/ocorrencias/auto_mapper.py` (Portuguese school form anchor heuristics, ported to TypeScript)
 */

import * as pdfLib from 'pdf-lib';
import type {
  Mm,
  OcorrenciaDocSpec,
  OcorrenciaFieldSpec,
  OcorrenciaFieldType,
  OcorrenciaPageGeometry,
} from './types';
import { ptToMm, roundMm } from './units';

async function getPdfLib() {
  return pdfLib;
}

/**
 * Canonical school occurrence fields — includes all 9 fields (fixing the bug where
 * `checkbox_orientacao_aluno`, `checkbox_convocar_responsavel`, `compromissos_firmados`,
 * and `telefone` were missing from `TemplateMapper.tsx`).
 */
export const DEFAULT_OCORRENCIA_FIELD_SPECS: OcorrenciaFieldSpec[] = [
  {
    id: 'nome_aluno',
    label: 'Nome do(a) Estudante',
    type: 'text',
    page: 1,
    rect: [58.5, 47.9, 80.0, 7.0],
    fontSizePt: 10,
    minFontSizePt: 7,
    weight: 'bold',
    align: 'left',
    backgroundMode: 'transparent',
    required: true,
    source: 'manual',
  },
  {
    id: 'turma',
    label: 'Turma / Série',
    type: 'text',
    page: 1,
    rect: [34.5, 56.7, 36.0, 7.0],
    fontSizePt: 10,
    minFontSizePt: 7,
    weight: 'normal',
    align: 'left',
    backgroundMode: 'transparent',
    required: true,
    source: 'manual',
  },
  {
    id: 'data',
    label: 'Data da Ocorrência',
    type: 'date',
    page: 1,
    rect: [158.5, 47.9, 30.0, 7.0],
    fontSizePt: 10,
    minFontSizePt: 7,
    weight: 'normal',
    align: 'center',
    backgroundMode: 'transparent',
    required: true,
    source: 'manual',
  },
  {
    id: 'telefone',
    label: 'Telefone de Contato',
    type: 'text',
    page: 1,
    rect: [165.0, 56.7, 34.0, 7.0],
    fontSizePt: 10,
    minFontSizePt: 7,
    weight: 'normal',
    align: 'left',
    backgroundMode: 'transparent',
    source: 'manual',
  },
  {
    id: 'responsavel_registro',
    label: 'Responsável pelo Registro',
    type: 'text',
    page: 1,
    rect: [66.5, 249.0, 85.0, 7.0],
    fontSizePt: 10,
    minFontSizePt: 7,
    weight: 'normal',
    align: 'left',
    backgroundMode: 'transparent',
    source: 'manual',
  },
  {
    id: 'descricao_ocorrencia',
    label: 'Descrição da Ocorrência (Relato Formal)',
    type: 'textarea',
    page: 1,
    rect: [21.2, 91.2, 165.0, 62.0],
    fontSizePt: 10.5,
    minFontSizePt: 6.5,
    weight: 'normal',
    align: 'left',
    backgroundMode: 'transparent',
    required: true,
    source: 'manual',
  },
  {
    id: 'checkbox_orientacao_aluno',
    label: '[X] Orientação Individual ao Estudante',
    type: 'checkbox',
    page: 1,
    rect: [24.7, 170.3, 4.5, 5.0],
    fontSizePt: 11,
    minFontSizePt: 8,
    weight: 'bold',
    align: 'center',
    backgroundMode: 'transparent',
    source: 'manual',
  },
  {
    id: 'checkbox_convocar_responsavel',
    label: '[X] Convocação dos Responsáveis Legais',
    type: 'checkbox',
    page: 1,
    rect: [24.7, 177.4, 4.5, 5.0],
    fontSizePt: 11,
    minFontSizePt: 8,
    weight: 'bold',
    align: 'center',
    backgroundMode: 'transparent',
    source: 'manual',
  },
  {
    id: 'compromissos_firmados',
    label: 'Compromissos e Encaminhamentos Firmados',
    type: 'textarea',
    page: 1,
    rect: [21.2, 200.8, 165.0, 37.0],
    fontSizePt: 10.5,
    minFontSizePt: 6.5,
    weight: 'normal',
    align: 'left',
    backgroundMode: 'transparent',
    source: 'manual',
  },
];

/**
 * Computes a deterministic SHA-256 hex fingerprint of the uploaded PDF bytes.
 * Isolated from `@sekundo/core/pdf/templateMatcher.ts`.
 */
export async function computeTemplateFingerprintSha256(pdfBytes: Uint8Array): Promise<string> {
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const copy = new Uint8Array(pdfBytes.byteLength);
      copy.set(pdfBytes);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback below
  }

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < pdfBytes.length; i++) {
    if (i % 2 === 0) {
      h1 ^= pdfBytes[i];
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    } else {
      h2 ^= pdfBytes[i];
      h2 = Math.imul(h2, 0x01000193) >>> 0;
    }
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}${pdfBytes.length
    .toString(16)
    .padStart(8, '0')}`;
}

export interface PDFSecurityInspection {
  isXfa: boolean;
  hasSignature: boolean;
  isEncrypted: boolean;
}

/**
 * Inspects a PDF binary for XFA dynamic form streams and Digital Signatures (`/Sig`).
 * Isolated from `@sekundo/core/pdf/acroFormFiller.ts`.
 */
export async function inspectPDFSecurityAndXfa(
  pdfBytes: Uint8Array
): Promise<PDFSecurityInspection> {
  const { PDFDocument, PDFName, PDFDict, PDFArray } = await getPdfLib();
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const isEncrypted = Boolean((pdfDoc as any).isEncrypted);
    let isXfa = false;
    let hasSignature = false;

    try {
      const form = pdfDoc.getForm();
      const acroFormDict = form.acroForm.dict;
      if (acroFormDict.has(PDFName.of('XFA'))) {
        isXfa = true;
      }
      const sigFlags = acroFormDict.get(PDFName.of('SigFlags'));
      if (sigFlags && sigFlags.toString() !== '0') {
        hasSignature = true;
      }
      const fieldsArr = acroFormDict.lookup(PDFName.of('Fields'));
      if (fieldsArr instanceof PDFArray) {
        for (let i = 0; i < fieldsArr.size(); i++) {
          const fDict = fieldsArr.lookup(i);
          if (fDict instanceof PDFDict) {
            const ft = fDict.get(PDFName.of('FT'));
            if (ft && ft.toString() === '/Sig') {
              hasSignature = true;
            }
          }
        }
      }
    } catch {
      // No AcroForm dictionary
    }

    return { isXfa, hasSignature, isEncrypted };
  } catch {
    return { isXfa: false, hasSignature: false, isEncrypted: true };
  }
}

interface AnchorRule {
  fieldId: string;
  label: string;
  type: OcorrenciaFieldType;
  patterns: RegExp[];
  offsetXMm: Mm;
  offsetYMm: Mm;
  widthMm: Mm;
  heightMm: Mm;
  fontSizePt: number;
}

/**
 * Client-side port of `auto_mapper.py` anchor rules in physical Millimeters (`Mm`).
 * Matches Portuguese school occurrence form labels extracted via `pdf.js` `getTextContent()`.
 */
const ANCHOR_DISCOVERY_RULES: AnchorRule[] = [
  {
    fieldId: 'nome_aluno',
    label: 'Nome do(a) Estudante',
    type: 'text',
    patterns: [/nome\s+do\(?a?\)?\s*(?:aluno|estudante)/i, /^aluno\(?a?\)?\s*:/i, /^estudante\s*:/i],
    offsetXMm: 2,
    offsetYMm: -1.5,
    widthMm: 82,
    heightMm: 7,
    fontSizePt: 10,
  },
  {
    fieldId: 'turma',
    label: 'Turma / Série',
    type: 'text',
    patterns: [/^turma\s*:?/i, /s[eé]rie\s*\/\s*turma/i, /ano\s*\/\s*turma/i],
    offsetXMm: 2,
    offsetYMm: -1.5,
    widthMm: 36,
    heightMm: 7,
    fontSizePt: 10,
  },
  {
    fieldId: 'data',
    label: 'Data da Ocorrência',
    type: 'date',
    patterns: [/^data\s*:?$/i, /data\s+da\s+ocorr[eê]ncia/i],
    offsetXMm: 2,
    offsetYMm: -1.5,
    widthMm: 30,
    heightMm: 7,
    fontSizePt: 10,
  },
  {
    fieldId: 'telefone',
    label: 'Telefone de Contato',
    type: 'text',
    patterns: [/telefone(?:\s+de\s+contato)?\s*:?/i, /celular\s*:?/i, /contato\s*:?/i],
    offsetXMm: 2,
    offsetYMm: -1.5,
    widthMm: 34,
    heightMm: 7,
    fontSizePt: 10,
  },
  {
    fieldId: 'descricao_ocorrencia',
    label: 'Descrição da Ocorrência (Relato Formal)',
    type: 'textarea',
    patterns: [
      /descri[cç][aã]o\s+da\s+ocorr[eê]ncia/i,
      /relato\s+d[ao]\s+(?:ocorr[eê]ncia|fato)/i,
      /hist[oó]rico\s+da\s+ocorr[eê]ncia/i,
    ],
    offsetXMm: 0,
    offsetYMm: 10.2,
    widthMm: 165,
    heightMm: 62,
    fontSizePt: 10.5,
  },
  {
    fieldId: 'checkbox_orientacao_aluno',
    label: '[X] Orientação Individual ao Estudante',
    type: 'checkbox',
    patterns: [/orienta[cç][aã]o\s+(?:individual\s+)?ao\s+(?:aluno|estudante)/i, /advert[eê]ncia\s+verbal/i],
    offsetXMm: -5.8,
    offsetYMm: -1.0,
    widthMm: 4.5,
    heightMm: 5.0,
    fontSizePt: 11,
  },
  {
    fieldId: 'checkbox_convocar_responsavel',
    label: '[X] Convocação dos Responsáveis Legais',
    type: 'checkbox',
    patterns: [/convocar\s+respons[aá]ve(?:l|is)/i, /convoca[cç][aã]o\s+d[eo]s\s+respons[aá]veis/i],
    offsetXMm: -5.8,
    offsetYMm: -1.0,
    widthMm: 4.5,
    heightMm: 5.0,
    fontSizePt: 11,
  },
  {
    fieldId: 'compromissos_firmados',
    label: 'Compromissos e Encaminhamentos Firmados',
    type: 'textarea',
    patterns: [
      /compromissos?\s+firmados?/i,
      /encaminhamentos?\s+(?:pedag[oó]gicos?|adotados?)/i,
      /provid[eê]ncias?\s+adotadas?/i,
    ],
    offsetXMm: 0,
    offsetYMm: 9.0,
    widthMm: 165,
    heightMm: 37,
    fontSizePt: 10.5,
  },
  {
    fieldId: 'responsavel_registro',
    label: 'Responsável pelo Registro',
    type: 'text',
    patterns: [
      /respons[aá]vel\s+pelo\s+(?:registro|atendimento)/i,
      /servidor\(?a?\)?\s+respons[aá]vel/i,
      /assinatura\s+do\(?a?\)?\s+professor/i,
    ],
    offsetXMm: 2,
    offsetYMm: -1.5,
    widthMm: 85,
    heightMm: 7,
    fontSizePt: 10,
  },
];

/**
 * Inspects a PDF binary (and optional loaded `pdf.js` document proxy) to automatically
 * build a complete `OcorrenciaDocSpec` in physical Millimeters (`Mm`):
 * 1. Computes SHA-256 fingerprint
 * 2. Extracts page geometries (`widthMm`, `heightMm`)
 * 3. Extracts native AcroForm widgets (if present)
 * 4. Runs client-side Anchor Discovery on `pdf.js` text items (if `pdfjsDoc` provided)
 * 5. Ensures all 9 canonical school occurrence fields exist so no field is ever silently dropped
 */
export async function autoDiscoverOcorrenciaFields(
  pdfBytes: Uint8Array,
  pdfjsDoc?: any,
  fileName = 'template_ocorrencia.pdf'
): Promise<OcorrenciaDocSpec> {
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFOptionList,
    PDFRadioGroup,
  } = await getPdfLib();

  const sha256 = await computeTemplateFingerprintSha256(pdfBytes);
  const security = await inspectPDFSecurityAndXfa(pdfBytes);

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const rawPages = pdfDoc.getPages();

  const pages: OcorrenciaPageGeometry[] = rawPages.map((p) => {
    const { width, height } = p.getSize();
    return {
      widthMm: roundMm(ptToMm(width)),
      heightMm: roundMm(ptToMm(height)),
      rotate: p.getRotation().angle || 0,
    };
  });

  const discoveredById = new Map<string, OcorrenciaFieldSpec>();

  // 1. Extract Native AcroForm Widgets (Sekundo acroFormFiller logic)
  try {
    const form = pdfDoc.getForm();
    const rawFields = form.getFields();

    for (const f of rawFields) {
      const rawName = f.getName();
      let type: OcorrenciaFieldType = 'text';
      let defaultValue = '';
      let options: string[] | undefined;
      let maxLength: number | undefined;

      if (f instanceof PDFTextField) {
        type = f.isMultiline() ? 'textarea' : 'text';
        defaultValue = f.getText() ?? '';
        maxLength = f.getMaxLength();
      } else if (f instanceof PDFCheckBox) {
        type = 'checkbox';
        defaultValue = f.isChecked() ? 'true' : 'false';
      } else if (f instanceof PDFDropdown) {
        type = 'dropdown';
        options = f.getOptions();
        defaultValue = f.getSelected()[0] ?? '';
      } else if (f instanceof PDFOptionList || f instanceof PDFRadioGroup) {
        type = 'dropdown';
        options = f.getOptions();
      }

      const widgets = f.acroField.getWidgets();
      if (widgets.length === 0) continue;

      const w = widgets[0];
      const rectPt = w.getRectangle();
      const widgetPageRef = w.P();
      let pageIndex = 0;
      if (widgetPageRef) {
        const foundIdx = rawPages.findIndex((p) => p.ref === widgetPageRef);
        if (foundIdx !== -1) pageIndex = foundIdx;
      }

      const pageGeom = pages[pageIndex] || { widthMm: 210, heightMm: 297 };
      const xMm = roundMm(ptToMm(rectPt.x));
      const wMm = roundMm(Math.max(4, ptToMm(rectPt.width)));
      const hMm = roundMm(Math.max(4, ptToMm(rectPt.height)));
      // Flip bottom-left PDF origin to top-left Mm
      const yMm = roundMm(Math.max(0, pageGeom.heightMm - ptToMm(rectPt.y) - hMm));

      // Map known school field names or keep sanitized AcroForm ID
      const mappedCanonicalId = matchCanonicalFieldId(rawName, type);
      const id = mappedCanonicalId || sanitizeFieldId(rawName);

      discoveredById.set(id, {
        id,
        label: findCanonicalLabel(id) || rawName,
        type,
        page: pageIndex + 1,
        rect: [xMm, yMm, wMm, hMm],
        fontSizePt: type === 'checkbox' ? 11 : 10,
        minFontSizePt: 6.5,
        weight: type === 'checkbox' ? 'bold' : 'normal',
        align: type === 'checkbox' ? 'center' : 'left',
        backgroundMode: 'transparent',
        options,
        maxLength,
        defaultValue,
        acroFieldName: rawName,
        source: 'acroform',
      });
    }
  } catch {
    // PDF has no AcroForm or non-standard dictionary
  }

  // 2. Client-Side Anchor Discovery via pdf.js getTextContent()
  let totalTextItems = 0;
  if (pdfjsDoc && typeof pdfjsDoc.getPage === 'function') {
    const numPages = Math.min(pages.length, pdfjsDoc.numPages || pages.length);
    for (let pNum = 1; pNum <= numPages; pNum++) {
      try {
        const pdfPage = await pdfjsDoc.getPage(pNum);
        const textContent = await pdfPage.getTextContent();
        const pageGeom = pages[pNum - 1] || { widthMm: 210, heightMm: 297 };
        const items: any[] = textContent?.items || [];
        totalTextItems += items.length;

        for (const item of items) {
          const str = String(item.str || '').trim();
          if (!str || str.length < 3) continue;

          // pdf.js transform: [scaleX, skewY, skewX, scaleY, txPt, tyPt] (origin bottom-left)
          const txPt = Number(item.transform?.[4] ?? 0);
          const tyPt = Number(item.transform?.[5] ?? 0);
          const itemWidthPt = Number(item.width ?? str.length * 5);
          const itemHeightPt = Math.abs(Number(item.height || item.transform?.[3] || 10));

          const anchorXMm = ptToMm(txPt);
          const anchorEndXMm = ptToMm(txPt + itemWidthPt);
          const anchorTopYMm = pageGeom.heightMm - ptToMm(tyPt) - ptToMm(itemHeightPt);

          for (const rule of ANCHOR_DISCOVERY_RULES) {
            if (discoveredById.has(rule.fieldId)) continue;
            const matched = rule.patterns.some((rx) => rx.test(str));
            if (!matched) continue;

            const isBlockBelow = rule.offsetYMm > 2;
            const startsWithInlineBox =
              rule.type === 'checkbox' && /^[\(\[\☐\□]/.test(str);
            const rawX = startsWithInlineBox
              ? anchorXMm
              : isBlockBelow || rule.offsetXMm < 0
              ? anchorXMm + rule.offsetXMm
              : anchorEndXMm + rule.offsetXMm;
            const rawY = anchorTopYMm + rule.offsetYMm;

            const xMm = roundMm(Math.max(5, Math.min(pageGeom.widthMm - 20, rawX)));
            const yMm = roundMm(Math.max(5, Math.min(pageGeom.heightMm - 10, rawY)));
            const maxAvailableWidth = Math.max(10, pageGeom.widthMm - xMm - 10);
            const wMm = roundMm(Math.min(rule.widthMm, maxAvailableWidth));
            const hMm = roundMm(rule.heightMm);

            discoveredById.set(rule.fieldId, {
              id: rule.fieldId,
              label: rule.label,
              type: rule.type,
              page: pNum,
              rect: [xMm, yMm, wMm, hMm],
              fontSizePt: rule.fontSizePt,
              minFontSizePt: 6.5,
              weight: rule.type === 'checkbox' ? 'bold' : 'normal',
              align: rule.type === 'checkbox' ? 'center' : 'left',
              backgroundMode: 'transparent',
              source: 'anchor',
            });
          }
        }
      } catch {
        // Ignore pdf.js text extraction error on individual page
      }
    }
  }

  const isScannedLikely = Boolean(pdfjsDoc && totalTextItems === 0 && discoveredById.size === 0);

  // 3. Merge with canonical default fields so all 9 standard occurrence fields are always available
  const finalFields: OcorrenciaFieldSpec[] = [];
  for (const defField of DEFAULT_OCORRENCIA_FIELD_SPECS) {
    const discovered = discoveredById.get(defField.id);
    if (discovered) {
      finalFields.push({
        ...defField,
        ...discovered,
        backgroundMode: isScannedLikely ? 'whiteout' : discovered.backgroundMode ?? 'transparent',
      });
      discoveredById.delete(defField.id);
    } else {
      finalFields.push({
        ...defField,
        rect: [...defField.rect] as [Mm, Mm, Mm, Mm],
        backgroundMode: isScannedLikely ? 'whiteout' : defField.backgroundMode ?? 'transparent',
      });
    }
  }

  // Append any extra custom AcroForm fields discovered in the document
  for (const extraField of discoveredById.values()) {
    finalFields.push(extraField);
  }

  return {
    version: 2,
    name: fileName,
    sha256,
    pageCount: Math.max(1, pages.length),
    pages: pages.length > 0 ? pages : [{ widthMm: 210, heightMm: 297 }],
    fields: finalFields,
    security: {
      ...security,
      isScannedLikely,
    },
  };
}

function sanitizeFieldId(rawName: string): string {
  return (
    rawName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'campo_extra'
  );
}

function matchCanonicalFieldId(
  rawName: string,
  type: OcorrenciaFieldType
): string | null {
  const norm = sanitizeFieldId(rawName);
  if (norm.includes('aluno') || norm.includes('estudante') || norm === 'nome') return 'nome_aluno';
  if (norm.includes('turma') || norm.includes('serie')) return 'turma';
  if (norm.includes('data')) return 'data';
  if (norm.includes('tel') || norm.includes('celular') || norm.includes('contato')) return 'telefone';
  if (norm.includes('descri') || norm.includes('relato') || norm.includes('ocorrencia'))
    return 'descricao_ocorrencia';
  if (type === 'checkbox' && norm.includes('orienta')) return 'checkbox_orientacao_aluno';
  if (type === 'checkbox' && (norm.includes('convoc') || norm.includes('responsave')))
    return 'checkbox_convocar_responsavel';
  if (norm.includes('compromisso') || norm.includes('encaminhamento')) return 'compromissos_firmados';
  if (norm.includes('registro') || norm.includes('professor') || norm.includes('servidor'))
    return 'responsavel_registro';
  return null;
}

function findCanonicalLabel(id: string): string | undefined {
  return DEFAULT_OCORRENCIA_FIELD_SPECS.find((f) => f.id === id)?.label;
}

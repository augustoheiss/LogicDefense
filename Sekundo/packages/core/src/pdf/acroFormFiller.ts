/**
 * Sekundo — Native AcroForm Inspector & Injector Engine
 *
 * Implements deterministic form field inspection, data injection,
 * and 4-Up graphical imposition for official PDF assignment templates (such as S-89).
 */

// Type-only import for compilation
import type { PDFFormField, TemplateCoordinateMap } from './types';
import type { FlatSkeletonEntry } from '../skeleton/types';
import { sanitizeForWinAnsiWithWarnings } from './unicodeFont';

/** Helper to dynamically load pdf-lib on demand */
async function getPdfLib() {
  return await import('pdf-lib');
}

// ---------------------------------------------------------------------------
// Assignment Slip Data Contract (S-89 Model)
// ---------------------------------------------------------------------------

export interface S89Assignment {
  /** Name of the designated volunteer or speaker */
  studentName: string;
  /** Assistant / partner name (if applicable) */
  assistantName?: string;
  /** Date of the meeting / assignment */
  date: string;
  /** Part number or description (e.g. "Painel Temático", "Apresentação Geral") */
  partTitle: string;
  /** Classroom / hall designation (e.g. "Salão Principal", "Sala B") */
  roomOrHall?: string;
  /** Additional remarks or study point */
  remarks?: string;
}

export interface FormFillResult {
  /** Output binary PDF data */
  pdfBytes: Uint8Array;
  /** Total fields successfully matched and filled */
  filledFieldCount: number;
  /** Names of fields that were populated */
  matchedFields: string[];
  /** Names of fields that could not be matched */
  unmatchedFields: string[];
  /** Non-fatal warnings generated during filling (e.g., maxLength truncation, emoji/Cyrillic sanitization) */
  warnings?: string[];
}

/**
 * Parses boolean-like values for AcroForm checkboxes.
 * Handles `"false"`, `"0"`, `"no"`, `"nao"`, `"não"`, `"off"`, `""` as `false` (resolves H1).
 */
export function parseAcroBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const norm = val.trim().toLowerCase();
    if (['false', '0', 'no', 'nao', 'não', 'off', 'unchecked', 'n', ''].includes(norm)) {
      return false;
    }
    if (['true', '1', 'yes', 'sim', 'on', 'checked', 's', 'x', '✓', '✔'].includes(norm)) {
      return true;
    }
    return Boolean(norm);
  }
  return Boolean(val);
}

/**
 * Inspects a PDF binary for `/XFA`, `/Sig` (digital signatures), and `/Encrypt` BEFORE
 * `pdfDoc.getForm()` is called (since `pdf-lib`'s `getForm()` strips `/XFA` on access — H4).
 */
export async function inspectPDFSecurityAndXfa(pdfBytes: Uint8Array): Promise<{
  isXfa: boolean;
  hasSignature: boolean;
  isEncrypted: boolean;
}> {
  const { PDFDocument, PDFName, PDFDict, PDFArray } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const isEncrypted = Boolean(pdfDoc.isEncrypted);
  let isXfa = false;
  let hasSignature = false;

  try {
    const rawForm = (pdfDoc as any).formCache?.access?.();
    if (rawForm && typeof rawForm.hasXFA === 'function' && rawForm.hasXFA()) {
      isXfa = true;
    }
    const acroDict = rawForm?.acroForm?.dict || pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (acroDict) {
      if (typeof acroDict.has === 'function' && acroDict.has(PDFName.of('XFA'))) {
        isXfa = true;
      }
      const sigFlags = typeof acroDict.get === 'function' ? acroDict.get(PDFName.of('SigFlags')) : undefined;
      if (sigFlags && String(sigFlags) !== '0') {
        hasSignature = true;
      }
      const fieldsArr = typeof acroDict.lookup === 'function' ? acroDict.lookup(PDFName.of('Fields')) : undefined;
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
    }
  } catch {
    // Ignore malformed catalog dictionaries
  }

  return { isXfa, hasSignature, isEncrypted };
}

// ---------------------------------------------------------------------------
// Form Inspection
// ---------------------------------------------------------------------------

/**
 * Inspects a PDF binary and extracts all interactive AcroForm fields,
 * resolving the actual 1-indexed page number of each widget, options, maxLength,
 * default values, page rotation, and XFA/Signature/Encryption flags.
 */
export async function inspectPDFForm(pdfBytes: Uint8Array): Promise<PDFFormField[]> {
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFRadioGroup,
    PDFOptionList,
    PDFName,
    PDFDict,
    PDFArray,
  } = await getPdfLib();

  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const isEncrypted = Boolean(pdfDoc.isEncrypted);

  // IMPORTANT (H4 & U8): Check /XFA and /Sig on raw formCache BEFORE pdfDoc.getForm() deletes /XFA
  let isXfa = false;
  let hasSignature = false;
  try {
    const rawForm = (pdfDoc as any).formCache?.access?.();
    if (rawForm && typeof rawForm.hasXFA === 'function' && rawForm.hasXFA()) {
      isXfa = true;
    }
    const acroDict = rawForm?.acroForm?.dict || pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (acroDict) {
      if (typeof acroDict.has === 'function' && acroDict.has(PDFName.of('XFA'))) {
        isXfa = true;
      }
      const sigFlags = typeof acroDict.get === 'function' ? acroDict.get(PDFName.of('SigFlags')) : undefined;
      if (sigFlags && String(sigFlags) !== '0') {
        hasSignature = true;
      }
      const fieldsArr = typeof acroDict.lookup === 'function' ? acroDict.lookup(PDFName.of('Fields')) : undefined;
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
    }
  } catch {
    // Non-fatal
  }

  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const detected: PDFFormField[] = [];

  for (const field of fields) {
    const name = field.getName();
    let type: PDFFormField['fieldType'] = 'text';
    let defaultValue: string | undefined;
    let options: string[] | undefined;
    let maxLength: number | undefined;

    if (field instanceof PDFTextField) {
      type = 'text';
      try {
        const txt = field.getText();
        if (txt !== undefined && txt !== '') defaultValue = txt;
        maxLength = field.getMaxLength();
      } catch {
        // Ignore read error on malformed text field
      }
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox';
      try {
        if (field.isChecked()) defaultValue = 'true';
      } catch {
        // Ignore
      }
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown';
      try {
        options = field.getOptions();
        const sel = field.getSelected();
        if (sel && sel.length > 0) defaultValue = sel[0];
      } catch {
        // Ignore
      }
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
      try {
        options = field.getOptions();
        const sel = field.getSelected();
        if (sel) defaultValue = sel;
      } catch {
        // Ignore
      }
    } else if (field instanceof PDFOptionList) {
      type = 'optionlist';
      try {
        options = field.getOptions();
        const sel = field.getSelected();
        if (sel && sel.length > 0) defaultValue = sel[0];
      } catch {
        // Ignore
      }
    } else {
      try {
        const ft = field.acroField.dict.get(PDFName.of('FT'));
        if (ft && ft.toString() === '/Sig') {
          type = 'signature';
          hasSignature = true;
        }
      } catch {
        // Ignore
      }
    }

    // Resolve all widget placements across pages (H12)
    const widgetPlacements: {
      pageNum: number;
      x: number;
      y: number;
      width: number;
      height: number;
      pageRotation: number;
    }[] = [];

    try {
      const widgets = field.acroField.getWidgets();
      for (const widget of widgets) {
        const rect = widget.getRectangle();
        let pageNum = 1;
        const pageRef = widget.P();
        if (pageRef) {
          const foundIdx = pages.findIndex((p) => p.ref === pageRef);
          if (foundIdx >= 0) {
            pageNum = foundIdx + 1;
          }
        } else {
          for (let i = 0; i < pages.length; i++) {
            const annots = pages[i].node.Annots();
            if (annots && annots.asArray().some((a) => a === widget.dict)) {
              pageNum = i + 1;
              break;
            }
          }
        }
        const targetPage = pages[pageNum - 1] || pages[0];
        const pageRotation = targetPage ? targetPage.getRotation().angle || 0 : 0;

        widgetPlacements.push({
          pageNum,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          pageRotation,
        });
      }
    } catch {
      // Fallback if widget rectangles are absent in corrupted headers
    }

    if (widgetPlacements.length === 0) {
      const firstPageRot = pages[0] ? pages[0].getRotation().angle || 0 : 0;
      widgetPlacements.push({
        pageNum: 1,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        pageRotation: firstPageRot,
      });
    }

    const distinctPages = Array.from(new Set(widgetPlacements.map((w) => w.pageNum)));
    const placementsToEmit =
      type === 'radio'
        ? [widgetPlacements[0]]
        : widgetPlacements;

    placementsToEmit.forEach((wp, wIdx) => {
      detected.push({
        fieldId: placementsToEmit.length > 1 ? `${name}_w${wIdx + 1}` : name,
        fieldName: name,
        fieldType: type,
        page: wp.pageNum,
        pages: distinctPages,
        x: wp.x,
        y: wp.y,
        width: wp.width,
        height: wp.height,
        defaultValue,
        options,
        maxLength,
        isXfa,
        hasSignature,
        isEncrypted,
        pageRotation: wp.pageRotation,
      });
    });
  }

  return detected;
}

// ---------------------------------------------------------------------------
// Deterministic Form Injection
// ---------------------------------------------------------------------------

/**
 * Injects key-value pairs directly into native AcroForm fields.
 * Supports text, booleans (checkboxes), dropdowns, radio groups, and option lists.
 * Sanitizes non-WinAnsi characters (emoji/Cyrillic) and enforces `maxLength` with warnings.
 */
export async function fillAcroForm(
  templatePdfBytes: Uint8Array,
  values: Record<string, string | boolean | number>,
  options: { flatten?: boolean } = {}
): Promise<FormFillResult> {
  const {
    PDFDocument,
    PDFTextField,
    PDFCheckBox,
    PDFDropdown,
    PDFRadioGroup,
    PDFOptionList,
  } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const matchedFields: string[] = [];
  const unmatchedFields: string[] = [];
  const warnings: string[] = [];
  let filledFieldCount = 0;

  for (const field of fields) {
    const name = field.getName();
    let matched = false;

    const lookupKey = Object.keys(values).find(
      (k) => k === name || k.toLowerCase() === name.toLowerCase()
    );

    if (lookupKey !== undefined) {
      const val = values[lookupKey];

      try {
        if (field instanceof PDFTextField) {
          let strVal = String(val ?? '');
          const maxLen = field.getMaxLength();
          if (maxLen !== undefined && maxLen > 0 && strVal.length > maxLen) {
            warnings.push(
              `Campo "${name}" truncado de ${strVal.length} para ${maxLen} caracteres (limite maxLength do PDF).`
            );
            strVal = strVal.slice(0, maxLen);
          }
          const sanitized = sanitizeForWinAnsiWithWarnings(strVal, name);
          if (sanitized.warnings.length > 0) {
            warnings.push(...sanitized.warnings);
          }
          field.setText(sanitized.text);
          matched = true;
        } else if (field instanceof PDFCheckBox) {
          if (parseAcroBoolean(val)) {
            field.check();
          } else {
            field.uncheck();
          }
          matched = true;
        } else if (field instanceof PDFDropdown) {
          const sanitized = sanitizeForWinAnsiWithWarnings(String(val ?? ''), name);
          if (sanitized.warnings.length > 0) warnings.push(...sanitized.warnings);
          field.select(sanitized.text);
          matched = true;
        } else if (field instanceof PDFRadioGroup) {
          field.select(String(val ?? ''));
          matched = true;
        } else if (field instanceof PDFOptionList) {
          field.select(String(val ?? ''));
          matched = true;
        }
      } catch (err) {
        warnings.push(`Falha ao preencher campo "${name}": ${(err as Error)?.message || String(err)}`);
      }
    }

    if (matched) {
      matchedFields.push(name);
      filledFieldCount++;
    } else {
      unmatchedFields.push(name);
    }
  }

  if (options.flatten) {
    form.flatten();
  }

  const outputBytes = await pdfDoc.save();

  return {
    pdfBytes: outputBytes,
    filledFieldCount,
    matchedFields,
    unmatchedFields,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 4-Up Imposition Engine (S-89 Model)
// ---------------------------------------------------------------------------

/**
 * Fills up to 4 S-89 assignment slips per page, automatically mapping
 * fields across quadrants 1 to 4 using recognized conventions:
 * - Official field codes (e.g. `900_1_Text_SanSerif` to `900_4_Text_SanSerif`)
 * - Quadrant prefixes (e.g. `q1_student`, `q2_student`, `q3_student`, `q4_student`)
 * - Suffix indices (e.g. `student_1`, `student_2`, etc.)
 */
export async function fillS89Assignments4Up(
  templatePdfBytes: Uint8Array,
  assignments: S89Assignment[],
  options: { flatten?: boolean } = {}
): Promise<FormFillResult> {
  const { PDFDocument } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const valuesToInject: Record<string, string | boolean> = {};

  for (let q = 0; q < Math.min(assignments.length, 4); q++) {
    const qIndex = q + 1;
    const data = assignments[q];

    const aliases = {
      student: [
        `900_${qIndex}_Text_SanSerif`,
        `student_${qIndex}`,
        `q${qIndex}_student`,
        `name_${qIndex}`,
        `nome_${qIndex}`,
      ],
      assistant: [
        `900_${qIndex}_Text_SanSerif_Assistant`,
        `assistant_${qIndex}`,
        `q${qIndex}_assistant`,
        `ajudante_${qIndex}`,
      ],
      date: [
        `900_${qIndex}_Text_SanSerif_Date`,
        `date_${qIndex}`,
        `q${qIndex}_date`,
        `data_${qIndex}`,
      ],
      partTitle: [
        `900_${qIndex}_Text_SanSerif_Part`,
        `part_${qIndex}`,
        `q${qIndex}_part`,
        `parte_${qIndex}`,
        `designacao_${qIndex}`,
      ],
      roomOrHall: [
        `900_${qIndex}_Text_SanSerif_Room`,
        `room_${qIndex}`,
        `q${qIndex}_room`,
        `sala_${qIndex}`,
      ],
      remarks: [
        `900_${qIndex}_Text_SanSerif_Remarks`,
        `remarks_${qIndex}`,
        `q${qIndex}_remarks`,
        `notas_${qIndex}`,
      ],
    };

    const findField = (aliasList: string[]): string | undefined => {
      return fields.find((f) =>
        aliasList.some((alias) => f.getName().toLowerCase() === alias.toLowerCase())
      )?.getName();
    };

    const studentField = findField(aliases.student);
    if (studentField) valuesToInject[studentField] = data.studentName;

    const assistantField = findField(aliases.assistant);
    if (assistantField && data.assistantName) valuesToInject[assistantField] = data.assistantName;

    const dateField = findField(aliases.date);
    if (dateField) valuesToInject[dateField] = data.date;

    const partField = findField(aliases.partTitle);
    if (partField) valuesToInject[partField] = data.partTitle;

    const roomField = findField(aliases.roomOrHall);
    if (roomField && data.roomOrHall) valuesToInject[roomField] = data.roomOrHall;

    const remarksField = findField(aliases.remarks);
    if (remarksField && data.remarks) valuesToInject[remarksField] = data.remarks;
  }

  return fillAcroForm(templatePdfBytes, valuesToInject, options);
}

// ---------------------------------------------------------------------------
// Coordinate Map Stamping & Mail-Merge (Resolves A1, A2, A5, H11)
// ---------------------------------------------------------------------------

function toWinAnsiSafeLocal(text: string): string {
  return sanitizeForWinAnsiWithWarnings(text || '').text.trim();
}

/**
 * Stamps values from a `FlatSkeletonEntry[]` onto a PDF using a `TemplateCoordinateMap`.
 * Coordinates in the map are in `mm` from top-left (or `pt` if `unit === 'pt'`).
 * Converts top-left `(xMm, yMm)` to bottom-left PDF points `(xPt, pageHeightPt - yPt - fontSizePt)`.
 */
export async function stampCoordinateMapOnPDF(
  templatePdfBytes: Uint8Array,
  coordMap: TemplateCoordinateMap,
  entries: FlatSkeletonEntry[]
): Promise<{ pdfBytes: Uint8Array; stampedCount: number }> {
  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const entryByKey = new Map<string, FlatSkeletonEntry>();
  for (const e of entries) {
    entryByKey.set(e.key, e);
  }

  let stampedCount = 0;

  for (const [key, mapping] of Object.entries(coordMap)) {
    const entry = entryByKey.get(key);
    if (!entry) continue;

    const rawText =
      mapping.printMode === 'keyAndValue'
        ? `${entry.label || mapping.label}: ${entry.value}`
        : entry.value || '';
    const safeText = toWinAnsiSafeLocal(rawText);
    if (!safeText) continue;

    const pageIdx = Math.max(0, Math.min(pages.length - 1, (mapping.page || 1) - 1));
    const page = pages[pageIdx];
    if (!page) continue;

    const { height: pageHeightPt } = page.getSize();
    const fontSize = mapping.fontSize || 10;
    const isPt = mapping.unit === 'pt';
    const xPt = isPt ? mapping.x : (mapping.x * 72) / 25.4;
    const yFromTopPt = isPt ? mapping.y : (mapping.y * 72) / 25.4;
    const yPt = Math.max(4, pageHeightPt - yFromTopPt - fontSize * 0.8);

    page.drawText(safeText, {
      x: xPt,
      y: yPt,
      size: fontSize,
      font: fontRegular,
      color: rgb(0.05, 0.05, 0.08),
    });
    stampedCount++;
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, stampedCount };
}

/**
 * Generates a multi-page Mail-Merge PDF where each record in `records` gets its own
 * filled copy of `templatePdfBytes`.
 *
 * Optimization (H11): Embeds the template pages ONCE as shared PDF Form XObjects
 * (`mergedPdf.embedPages`) and draws each record's values on lightweight pages,
 * preventing `N × templateSize` resource duplication.
 */
export async function fillAcroFormMailMerge(
  templatePdfBytes: Uint8Array,
  records: Record<string, string | boolean | number>[]
): Promise<FormFillResult> {
  if (records.length === 0) {
    return fillAcroForm(templatePdfBytes, {}, { flatten: true });
  }

  const { PDFDocument, StandardFonts, rgb } = await getPdfLib();
  const inspectedFields = await inspectPDFForm(templatePdfBytes);

  // Prepare clean base template with empty flattened fields so default values stay intact if not overridden
  const baseDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const basePages = baseDoc.getPages();
  const pageDims = basePages.map((p) => p.getSize());

  const mergedPdf = await PDFDocument.create();
  const embeddedBasePages = await mergedPdf.embedPages(basePages);
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica);

  let totalFilled = 0;
  const matchedSet = new Set<string>();
  const unmatchedSet = new Set<string>();
  const allWarnings: string[] = [];

  for (const rec of records) {
    const matchedInRec = new Set<string>();

    for (let pIdx = 0; pIdx < embeddedBasePages.length; pIdx++) {
      const { width, height } = pageDims[pIdx];
      const page = mergedPdf.addPage([width, height]);
      page.drawPage(embeddedBasePages[pIdx], {
        x: 0,
        y: 0,
        width,
        height,
      });

      const pageFields = inspectedFields.filter((f) => (f.page || 1) === pIdx + 1);
      for (const f of pageFields) {
        const lookupKey = Object.keys(rec).find(
          (k) => k === f.fieldName || k.toLowerCase() === f.fieldName.toLowerCase()
        );
        if (lookupKey !== undefined) {
          const rawVal = rec[lookupKey];
          let textToDraw = '';
          if (f.fieldType === 'checkbox') {
            textToDraw = parseAcroBoolean(rawVal) ? 'X' : '';
          } else {
            let strVal = String(rawVal ?? '');
            if (f.maxLength && f.maxLength > 0 && strVal.length > f.maxLength) {
              strVal = strVal.slice(0, f.maxLength);
            }
            const san = sanitizeForWinAnsiWithWarnings(strVal, f.fieldName);
            if (san.warnings.length > 0) allWarnings.push(...san.warnings);
            textToDraw = san.text;
          }

          if (textToDraw) {
            const fontSize = Math.min(11, Math.max(7, (f.height || 14) * 0.65));
            page.drawText(textToDraw, {
              x: f.x + 2,
              y: f.y + Math.max(2, ((f.height || 14) - fontSize) / 2),
              size: fontSize,
              font: fontRegular,
              color: rgb(0.05, 0.05, 0.08),
            });
          }
          matchedInRec.add(f.fieldName);
        } else if (f.defaultValue) {
          const san = sanitizeForWinAnsiWithWarnings(f.defaultValue, f.fieldName);
          if (san.text) {
            const fontSize = Math.min(11, Math.max(7, (f.height || 14) * 0.65));
            page.drawText(san.text, {
              x: f.x + 2,
              y: f.y + Math.max(2, ((f.height || 14) - fontSize) / 2),
              size: fontSize,
              font: fontRegular,
              color: rgb(0.05, 0.05, 0.08),
            });
          }
        }
      }
    }

    for (const f of inspectedFields) {
      if (matchedInRec.has(f.fieldName)) {
        matchedSet.add(f.fieldName);
        totalFilled++;
      } else {
        unmatchedSet.add(f.fieldName);
      }
    }
  }

  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
  return {
    pdfBytes,
    filledFieldCount: totalFilled,
    matchedFields: Array.from(matchedSet),
    unmatchedFields: Array.from(unmatchedSet),
    warnings: allWarnings,
  };
}



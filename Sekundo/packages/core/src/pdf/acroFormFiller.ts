/**
 * Sekundo — Native AcroForm Inspector & Injector Engine
 *
 * Implements deterministic form field inspection, data injection,
 * and 4-Up graphical imposition for official PDF assignment templates (such as S-89).
 */

// Type-only import for compilation
import type { PDFDocument as PDFDocumentType, PDFTextField as PDFTextFieldType, PDFCheckBox as PDFCheckBoxType, PDFDropdown as PDFDropdownType, PDFRadioGroup as PDFRadioGroupType } from 'pdf-lib';
import type { PDFFormField, TemplateCoordinateMap } from './types';
import type { FlatSkeletonEntry } from '../skeleton/types';

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
}

// ---------------------------------------------------------------------------
// Form Inspection
// ---------------------------------------------------------------------------

/**
 * Inspects a PDF binary and extracts all interactive AcroForm fields,
 * resolving the actual 1-indexed page number of each widget.
 */
export async function inspectPDFForm(pdfBytes: Uint8Array): Promise<PDFFormField[]> {
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const detected: PDFFormField[] = [];

  for (const field of fields) {
    const name = field.getName();
    let type: PDFFormField['fieldType'] = 'text';

    if (field instanceof PDFTextField) {
      type = 'text';
    } else if (field instanceof PDFCheckBox) {
      type = 'checkbox';
    } else if (field instanceof PDFDropdown) {
      type = 'dropdown';
    } else if (field instanceof PDFRadioGroup) {
      type = 'radio';
    }

    // Locate widget bounding box & actual page index (1-indexed)
    let pageNum = 1;
    let x = 0;
    let y = 0;
    let width = 0;
    let height = 0;

    try {
      const widgets = field.acroField.getWidgets();
      if (widgets.length > 0) {
        const widget = widgets[0];
        const rect = widget.getRectangle();
        x = rect.x;
        y = rect.y;
        width = rect.width;
        height = rect.height;

        const pageRef = widget.P();
        if (pageRef) {
          const foundIdx = pages.findIndex((p) => p.ref === pageRef);
          if (foundIdx >= 0) {
            pageNum = foundIdx + 1;
          }
        } else {
          // Fallback: scan page Annots arrays if widget /P reference is omitted
          for (let i = 0; i < pages.length; i++) {
            const annots = pages[i].node.Annots();
            if (annots && annots.asArray().some((a) => a === widget.dict)) {
              pageNum = i + 1;
              break;
            }
          }
        }
      }
    } catch {
      // Fallback if widget rectangles are absent in corrupted headers
    }

    detected.push({
      fieldId: name,
      fieldName: name,
      fieldType: type,
      page: pageNum,
      x,
      y,
      width,
      height,
    });
  }

  return detected;
}

// ---------------------------------------------------------------------------
// Deterministic Form Injection
// ---------------------------------------------------------------------------

/**
 * Injects key-value pairs directly into native AcroForm fields.
 * Supports text, booleans (checkboxes), and dropdowns.
 */
export async function fillAcroForm(
  templatePdfBytes: Uint8Array,
  values: Record<string, string | boolean | number>,
  options: { flatten?: boolean } = {}
): Promise<FormFillResult> {
  const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } = await getPdfLib();
  const pdfDoc = await PDFDocument.load(templatePdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  const matchedFields: string[] = [];
  const unmatchedFields: string[] = [];
  let filledFieldCount = 0;

  for (const field of fields) {
    const name = field.getName();
    let matched = false;

    // Direct match or normalized lowercase match
    const lookupKey = Object.keys(values).find(
      (k) => k === name || k.toLowerCase() === name.toLowerCase()
    );

    if (lookupKey !== undefined) {
      const val = values[lookupKey];

      try {
        if (field instanceof PDFTextField) {
          field.setText(String(val ?? ''));
          matched = true;
        } else if (field instanceof PDFCheckBox) {
          if (Boolean(val)) {
            field.check();
          } else {
            field.uncheck();
          }
          matched = true;
        } else if (field instanceof PDFDropdown) {
          field.select(String(val));
          matched = true;
        }
      } catch (err) {
        // Fallback on formatting/encoding edge case
        console.warn(`[Sekundo AcroForm] Failed to fill field "${name}":`, err);
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

  // For each quadrant (0 to 3)
  for (let q = 0; q < Math.min(assignments.length, 4); q++) {
    const qIndex = q + 1; // 1-indexed (1, 2, 3, 4)
    const data = assignments[q];

    // Canonical S-89 AcroForm field aliases
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

    // Find actual matching field names in the template for each alias
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
// Coordinate Map Stamping & Mail-Merge (Resolves A1, A2, A5)
// ---------------------------------------------------------------------------

function toWinAnsiSafeLocal(text: string): string {
  return (text || '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[✓✔]/g, '[OK]')
    .replace(/[⬜□]/g, '[ ]')
    .replace(/[•·]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .trim();
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
 */
export async function fillAcroFormMailMerge(
  templatePdfBytes: Uint8Array,
  records: Record<string, string | boolean | number>[]
): Promise<FormFillResult> {
  if (records.length === 0) {
    return fillAcroForm(templatePdfBytes, {}, { flatten: true });
  }
  if (records.length === 1) {
    return fillAcroForm(templatePdfBytes, records[0], { flatten: true });
  }

  const { PDFDocument } = await getPdfLib();
  const mergedPdf = await PDFDocument.create();
  let totalFilled = 0;
  const matchedSet = new Set<string>();
  const unmatchedSet = new Set<string>();

  for (const rec of records) {
    const single = await fillAcroForm(templatePdfBytes, rec, { flatten: true });
    totalFilled += single.filledFieldCount;
    single.matchedFields.forEach((m) => matchedSet.add(m));
    single.unmatchedFields.forEach((u) => unmatchedSet.add(u));

    const singleDoc = await PDFDocument.load(single.pdfBytes);
    const copiedPages = await mergedPdf.copyPages(singleDoc, singleDoc.getPageIndices());
    for (const p of copiedPages) {
      mergedPdf.addPage(p);
    }
  }

  const pdfBytes = await mergedPdf.save();
  return {
    pdfBytes,
    filledFieldCount: totalFilled,
    matchedFields: Array.from(matchedSet),
    unmatchedFields: Array.from(unmatchedSet),
  };
}


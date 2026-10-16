/**
 * Ocorrências 2.0 PDF Engine — Core Contracts & Types (`engine/types.ts`)
 *
 * Isolated and unified from `@sekundo/core/doc/types.ts`, `@sekundo/core/pdf/types.ts`,
 * and `cv-maker/engine/DynamicDensityCompressor.ts`.
 *
 * Canonical coordinate system: Physical Millimeters (`Mm`, origin top-left, y downward).
 */

/** Physical millimeter coordinate (origin top-left, y downward). */
export type Mm = number;

export type PageFormatId = 'a4' | 'a3' | 'a5' | 'letter' | 'legal' | 'tabloid' | 'executive' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';

export type OcorrenciaFieldType = 'text' | 'textarea' | 'checkbox' | 'date' | 'signature' | 'dropdown';
export type FieldBackgroundMode = 'transparent' | 'whiteout';
export type FieldOverflowBehavior = 'continue-page' | 'shrink-clamp';

export interface OcorrenciaPageGeometry {
  widthMm: Mm;
  heightMm: Mm;
  rotate?: number;
}

export interface OcorrenciaFieldSpec {
  id: string;
  label: string;
  type: OcorrenciaFieldType;
  /** 1-indexed page number (1 = first page) */
  page: number;
  /** Physical bounding box [xMm, yMm, wMm, hMm] from top-left */
  rect: [Mm, Mm, Mm, Mm];
  /** Base/maximum font size in PostScript points */
  fontSizePt?: number;
  /** Minimum font size allowed during logarithmic auto-fit bisection */
  minFontSizePt?: number;
  /** Font weight */
  weight?: 'normal' | 'bold';
  /** Horizontal alignment */
  align?: 'left' | 'center' | 'right';
  /** Text color hex (default '#0F172A') */
  color?: string;
  /** Background mode: 'transparent' preserves underlying PDF lines; 'whiteout' paints a cover box */
  backgroundMode?: FieldBackgroundMode;
  /** Overflow behavior when text exceeds box even at minFontSizePt (default: 'continue-page' for textarea) */
  overflowBehavior?: FieldOverflowBehavior;
  /** Optional dropdown/radio options if extracted from AcroForm */
  options?: string[];
  /** Optional character limit from AcroForm */
  maxLength?: number;
  /** Optional default value */
  defaultValue?: string;
  /** Origin of field discovery */
  source?: 'manual' | 'acroform' | 'anchor' | 'vault' | 'imported';
  /** Original AcroForm field name if backed by native widget */
  acroFieldName?: string;
  /** Whether field is required before export */
  required?: boolean;
}

export interface OcorrenciaDocSpec {
  version: 2;
  name: string;
  sha256: string;
  pageCount: number;
  pages: OcorrenciaPageGeometry[];
  fields: OcorrenciaFieldSpec[];
  security?: {
    isXfa?: boolean;
    hasSignature?: boolean;
    isEncrypted?: boolean;
    isScannedLikely?: boolean;
  };
}

export type ResolvedOp =
  | {
      kind: 'text';
      id: string;
      fieldId: string;
      page: number;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      lines: string[];
      sizePt: number;
      baseSizePt: number;
      lineHeightMm: Mm;
      weight: 'normal' | 'bold';
      align: 'left' | 'center' | 'right';
      color: string;
      autoFitted: boolean;
      overflowed: boolean;
    }
  | {
      kind: 'rect';
      id: string;
      fieldId?: string;
      page: number;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      fill?: string;
      fillOpacity?: number;
      stroke?: string;
      strokeWidthMm?: Mm;
    }
  | {
      kind: 'signature';
      id: string;
      fieldId: string;
      page: number;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      strokes: Array<Array<[Mm, Mm]>>;
      svgPathMm: string;
      color: string;
      strokeWidthMm: Mm;
    };

export interface ContinuationSectionSpec {
  fieldId: string;
  fieldLabel: string;
  lines: string[];
  fontSizePt: number;
  lineHeightMm: Mm;
}

export interface DisplayPage {
  /** 1-indexed page number */
  pageNumber: number;
  widthMm: Mm;
  heightMm: Mm;
  rotate?: number;
  ops: ResolvedOp[];
}

export interface DisplayList {
  pages: DisplayPage[];
  continuationSections?: ContinuationSectionSpec[];
  warnings: string[];
  fieldMetrics: Record<
    string,
    {
      fontSizePt: number;
      lineCount: number;
      autoFitted: boolean;
      overflowed: boolean;
      continuedOnAnnex?: boolean;
      continuationLineCount?: number;
    }
  >;
  stats: {
    primitives: number;
    pages: number;
    ms: number;
  };
}

export type PreflightSeverity = 'info' | 'warning' | 'error';

export type PreflightIssueCode =
  | 'XFA_UNSUPPORTED'
  | 'DIGITAL_SIGNATURE_DETECTED'
  | 'ENCRYPTED_PDF'
  | 'SCANNED_PDF_NOTICE'
  | 'EMPTY_REQUIRED_FIELD'
  | 'MAX_LENGTH_EXCEEDED'
  | 'TEXT_BOX_OVERFLOW'
  | 'CONTINUATION_SHEET_GENERATED'
  | 'AUTOFIT_APPLIED'
  | 'UNICODE_SANITIZED';

export interface PreflightIssue {
  code: PreflightIssueCode;
  severity: PreflightSeverity;
  fieldId?: string;
  fieldLabel?: string;
  message: string;
}

export interface PreflightReport {
  ok: boolean;
  blocksSilentFlatten: boolean;
  issues: PreflightIssue[];
}

/** Legacy PyMuPDF template_map.json schema for backward-compatible import/export & Python fallback */
export interface LegacyPyMuPDFCoords {
  x: number;
  y: number;
  max_width: number;
  height?: number;
  max_lines?: number;
  font_size: number;
  type: string;
  label: string;
  page?: number;
  background_mode?: FieldBackgroundMode;
}

export interface LegacyTemplateMap {
  _comment?: string;
  sha256?: string;
  page_width: number;
  page_height: number;
  coordinate_system: 'pymupdf_top_left';
  fields: Record<string, LegacyPyMuPDFCoords>;
}

/**
 * Sekundo — PDF Type Definitions
 */

import type { PathKey } from '../skeleton/types';

// ---------------------------------------------------------------------------
// Print Mode
// ---------------------------------------------------------------------------

/** How a field value is rendered on the PDF. */
export type PrintMode = 'valueOnly' | 'keyAndValue';

// ---------------------------------------------------------------------------
// PDF Field (Detected from AcroForm)
// ---------------------------------------------------------------------------

/** A form field detected from a PDF with AcroForm annotations. */
export interface PDFFormField {
  /** Internal field ID from the PDF. */
  fieldId: string;

  /** Human-readable field name (if available). */
  fieldName: string;

  /** Field type. */
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionlist' | 'signature';

  /** Page number (1-indexed). */
  page: number;

  /** All 1-indexed pages where widgets of this field appear (H12). */
  pages?: number[];

  /** Bounding box coordinates (in PDF points, origin bottom-left). */
  x: number;
  y: number;
  width: number;
  height: number;

  /** Pre-existing / default value in the PDF form (C6). */
  defaultValue?: string;

  /** Options for radio / dropdown / option-list fields (H1 / H5). */
  options?: string[];

  /** Max character length constraint for text fields (H2). */
  maxLength?: number;

  /** True if the PDF contains an XFA stream (H4). */
  isXfa?: boolean;

  /** True if the PDF contains a digital signature field or SigFlags (U8). */
  hasSignature?: boolean;

  /** True if the PDF was loaded with encryption dictionary present (U7). */
  isEncrypted?: boolean;

  /** Rotation angle of the page in degrees (0, 90, 180, 270) (H8). */
  pageRotation?: number;
}

// ---------------------------------------------------------------------------
// Coordinate Map (Stored in localStorage)
// ---------------------------------------------------------------------------

/**
 * A mapping from a skeleton path key to a specific coordinate on a PDF page.
 * This is what enables the "click-to-place" and "auto-detect" workflows.
 */
export interface CoordinateMapping {
  /** X position from left edge (in mm by default, or PDF points if unit === 'pt'). */
  x: number;

  /** Y position from top edge (in mm by default, or PDF points if unit === 'pt'). */
  y: number;

  /** Coordinate unit: 'mm' (canonical, top-left origin) or 'pt' (legacy). Defaults to 'mm'. */
  unit?: 'mm' | 'pt';

  /** Page number (1-indexed). */
  page: number;

  /** How to render the value. */
  printMode: PrintMode;

  /** Cached label for auto-complete suggestions. */
  label: string;

  /** Font size override (optional, in pt). */
  fontSize?: number;

  /** Max width for text wrapping (optional, in mm or pt matching unit). */
  maxWidth?: number;
}

/**
 * A complete coordinate map for a specific PDF template.
 * Keyed by a SHA-256 or FNV fingerprint of the PDF binary.
 */
export type TemplateCoordinateMap = Record<PathKey, CoordinateMapping>;

/**
 * All saved PDF template mappings in localStorage.
 * Key format: "sha256:<hex>" or "tpl_<fnv16>_<len>"
 */
export type PDFMapStorage = Record<string, TemplateCoordinateMap>;

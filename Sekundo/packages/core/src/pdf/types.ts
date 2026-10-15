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
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown';

  /** Page number (1-indexed). */
  page: number;

  /** Bounding box coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
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

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
  /** X position in PDF points from left edge. */
  x: number;

  /** Y position in PDF points from top edge. */
  y: number;

  /** Page number (1-indexed). */
  page: number;

  /** How to render the value. */
  printMode: PrintMode;

  /** Cached label for auto-complete suggestions. */
  label: string;

  /** Font size override (optional). */
  fontSize?: number;

  /** Max width for text wrapping (optional, in PDF points). */
  maxWidth?: number;
}

/**
 * A complete coordinate map for a specific PDF template.
 * Keyed by a hash of the PDF file (first 8 chars of SHA-256).
 */
export type TemplateCoordinateMap = Record<PathKey, CoordinateMapping>;

/**
 * All saved PDF template mappings in localStorage.
 * Key format: "template_<sha256_first8>"
 */
export type PDFMapStorage = Record<string, TemplateCoordinateMap>;

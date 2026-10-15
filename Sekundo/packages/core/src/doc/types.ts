/**
 * Sekundo Document Engine (`@sekundo/core/doc`) — Core Contracts & Types
 *
 * Defines the canonical schema for `.sdoc.yaml` (Sekundo Document),
 * the deterministic `DisplayList` (in millimeters, origin top-left),
 * and the unified `OutputWriter` interface.
 */

import type { FlatRegistry } from '../skeleton/types';

/** Physical millimeter coordinate (origin top-left, y downward). */
export type Mm = number;

export type PageFormatId = 'a4' | 'a3' | 'a5' | 'letter' | 'legal' | 'tabloid' | 'executive' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';

export interface SdocPageConfig {
  format: PageFormatId;
  orientation?: PageOrientation;
  unit?: 'mm';
  widthMm?: Mm;
  heightMm?: Mm;
  marginMm?: Mm;
  background?: string;
}

export interface InlineTextSpan {
  id?: string;
  text: string;
  font?: string;
  size?: number;
  weight?: 'normal' | 'bold';
  style?: 'normal' | 'italic';
  color?: string;
  background?: string;
}

export type SdocPrimitive =
  | {
      type: 'text';
      id: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h?: Mm;
      text: string;
      size?: number;
      weight?: 'normal' | 'bold';
      align?: 'left' | 'center' | 'right';
      maxLines?: number;
      lineHeight?: number;
      color?: string;
      spans?: InlineTextSpan[];
    }
  | {
      type: 'rect';
      id: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      fill?: string;
      stroke?: string;
      strokeWidth?: Mm;
      radius?: Mm;
    }
  | {
      type: 'line';
      id: string;
      x1: Mm;
      y1: Mm;
      x2: Mm;
      y2: Mm;
      stroke?: string;
      strokeWidth?: Mm;
      dash?: Mm[];
    }
  | {
      type: 'path';
      id: string;
      points: [Mm, Mm][];
      closed?: boolean;
      fill?: string;
      stroke?: string;
      strokeWidth?: Mm;
    }
  | {
      type: 'image';
      id: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      blob: string;
    }
  | {
      type: 'table';
      id: string;
      x: Mm;
      y: Mm;
      cols: Mm[];
      rows: Mm[];
      stroke?: string;
      strokeWidth?: Mm;
      headerFill?: string;
      fontSize?: number;
      cells?: Record<string, string>;
    };

export interface SdocLayer {
  id: string;
  name?: string;
  locked?: boolean;
  visible?: boolean;
  items: SdocPrimitive[];
}

export interface SdocRepeatGrid {
  cols: number;
  rows: number;
  gap?: Mm;
  gapX?: Mm;
  gapY?: Mm;
  startX?: Mm;
  startY?: Mm;
  cellW?: Mm;
  cellH?: Mm;
}

export interface SdocRepeatConfig {
  over: string;
  per_page?: number;
  grid?: SdocRepeatGrid;
}

export interface SdocUnderlayConfig {
  source: string; // e.g. "sha256:9f2c..."
  pages?: number[];
  mode?: 'overlay' | 'rebuild';
}

export interface SdocField {
  id: string;
  from?: 'acroform' | 'click' | 'text' | 'grid';
  name?: string;
  page?: number;
  rect: [Mm, Mm, Mm, Mm]; // [x, y, w, h] in mm from top-left
  bind: string;
  size?: number;
  weight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
}

export interface SdocDocument {
  sdoc: number;
  name: string;
  page: SdocPageConfig;
  fonts?: Record<string, { family: string }>;
  repeat?: SdocRepeatConfig;
  underlay?: SdocUnderlayConfig;
  fields?: SdocField[];
  header?: SdocPrimitive[];
  footer?: SdocPrimitive[];
  layers: SdocLayer[];
}

export type ResolvedOp =
  | {
      kind: 'text';
      id: string;
      layerId: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      lines: string[];
      sizePt: number;
      lineHeightMm: Mm;
      weight: 'normal' | 'bold';
      align: 'left' | 'center' | 'right';
      color: string;
      spans?: InlineTextSpan[];
    }
  | {
      kind: 'rect';
      id: string;
      layerId: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      fill?: string;
      stroke?: string;
      strokeWidthMm: Mm;
      radiusMm?: Mm;
    }
  | {
      kind: 'line';
      id: string;
      layerId: string;
      x1: Mm;
      y1: Mm;
      x2: Mm;
      y2: Mm;
      stroke: string;
      strokeWidthMm: Mm;
      dash?: Mm[];
    }
  | {
      kind: 'path';
      id: string;
      layerId: string;
      points: [Mm, Mm][];
      closed: boolean;
      fill?: string;
      stroke?: string;
      strokeWidthMm: Mm;
    }
  | {
      kind: 'image';
      id: string;
      layerId: string;
      x: Mm;
      y: Mm;
      w: Mm;
      h: Mm;
      blob: string;
    };

export interface DisplayPage {
  index: number;
  widthMm: Mm;
  heightMm: Mm;
  background?: string;
  underlay?: {
    blob: string;
    page: number;
    mode: 'overlay' | 'rebuild';
  };
  ops: ResolvedOp[];
}

export interface DisplayList {
  pages: DisplayPage[];
  warnings: string[];
  stats: {
    primitives: number;
    pages: number;
    ms: number;
  };
}

export interface WriterInput {
  registry: FlatRegistry;
  eventName?: string;
  sdocYaml?: string;
  options?: Record<string, unknown>;
}

export interface OutputWriter<T = Uint8Array | string> {
  kind: 'pdf' | 'whatsapp' | 'csv' | 'yaml';
  write(input: WriterInput): Promise<T>;
}

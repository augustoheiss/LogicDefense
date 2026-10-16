/**
 * Ocorrências 2.0 — Interactive Millimeter SVG Overlay & Live DisplayList Painter
 * (`OcorrenciasSvgOverlay.tsx`)
 *
 * Unifies:
 * - `@sekundo/core/doc/painters/svgPainter.ts` (renders solved `DisplayPage` ops in `Mm`)
 * - `@sekundo/app/pdf/PdfOverlayLayer.tsx` (interactive drag-to-move, resize handle, click-drag draw)
 *
 * Uses `viewBox="0 0 {widthMm} {heightMm}"` so all coordinates live natively in
 * physical Millimeters (`Mm`). Changing zoom (`scale`) never corrupts coordinates!
 */

import React, { useRef, useState } from 'react';
import type {
  DisplayPage,
  Mm,
  OcorrenciaFieldSpec,
  ResolvedOp,
} from './engine';
import { ptToMm, roundMm } from './engine';

export interface OcorrenciasSvgOverlayProps {
  pageNumber: number;
  widthMm: Mm;
  heightMm: Mm;
  fieldsOnPage: OcorrenciaFieldSpec[];
  displayPage?: DisplayPage;
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
  selectedFieldId: string;
  showFieldFrames: boolean;
  drawModeActive: boolean;
  onSelectField: (fieldId: string) => void;
  onUpdateFieldRect: (fieldId: string, newRect: [Mm, Mm, Mm, Mm], pageNumber: number) => void;
  onToggleFieldBackground?: (fieldId: string) => void;
  onResetFieldRect?: (fieldId: string) => void;
}

type InteractionState =
  | {
      mode: 'move';
      fieldId: string;
      startClientX: number;
      startClientY: number;
      initialRect: [Mm, Mm, Mm, Mm];
    }
  | {
      mode: 'resize';
      fieldId: string;
      startClientX: number;
      startClientY: number;
      initialRect: [Mm, Mm, Mm, Mm];
    }
  | {
      mode: 'draw';
      fieldId: string;
      startXMm: Mm;
      startYMm: Mm;
      currentRect: [Mm, Mm, Mm, Mm];
    }
  | null;

export const OcorrenciasSvgOverlay: React.FC<OcorrenciasSvgOverlayProps> = ({
  pageNumber,
  widthMm,
  heightMm,
  fieldsOnPage,
  displayPage,
  fieldMetrics,
  selectedFieldId,
  showFieldFrames,
  drawModeActive,
  onSelectField,
  onUpdateFieldRect,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>(null);

  const clientToMm = (clientX: number, clientY: number): { xMm: Mm; yMm: Mm } => {
    const svg = svgRef.current;
    if (!svg) return { xMm: 0, yMm: 0 };
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { xMm: 0, yMm: 0 };
    const xMm = ((clientX - rect.left) / rect.width) * widthMm;
    const yMm = ((clientY - rect.top) / rect.height) * heightMm;
    return {
      xMm: roundMm(Math.max(0, Math.min(widthMm, xMm))),
      yMm: roundMm(Math.max(0, Math.min(heightMm, yMm))),
    };
  };

  const clientDeltaToMm = (dxPx: number, dyPx: number): { dxMm: Mm; dyMm: Mm } => {
    const svg = svgRef.current;
    if (!svg) return { dxMm: 0, dyMm: 0 };
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { dxMm: 0, dyMm: 0 };
    return {
      dxMm: (dxPx / rect.width) * widthMm,
      dyMm: (dyPx / rect.height) * heightMm,
    };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Only start drawing a new box if drawModeActive is enabled and user clicked empty canvas
    if (!drawModeActive || !selectedFieldId) return;

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);

    const { xMm, yMm } = clientToMm(e.clientX, e.clientY);
    setInteraction({
      mode: 'draw',
      fieldId: selectedFieldId,
      startXMm: xMm,
      startYMm: yMm,
      currentRect: [xMm, yMm, 1, 1],
    });
  };

  const handleBoxPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    field: OcorrenciaFieldSpec
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectField(field.id);

    const svg = svgRef.current;
    if (svg) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Ignore pointer capture errors
      }
    }

    setInteraction({
      mode: 'move',
      fieldId: field.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialRect: [...field.rect] as [Mm, Mm, Mm, Mm],
    });
  };

  const handleResizePointerDown = (
    e: React.PointerEvent<SVGRectElement>,
    field: OcorrenciaFieldSpec
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectField(field.id);

    const svg = svgRef.current;
    if (svg) {
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }

    setInteraction({
      mode: 'resize',
      fieldId: field.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialRect: [...field.rect] as [Mm, Mm, Mm, Mm],
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interaction) return;
    e.preventDefault();

    if (interaction.mode === 'move') {
      const { dxMm, dyMm } = clientDeltaToMm(
        e.clientX - interaction.startClientX,
        e.clientY - interaction.startClientY
      );
      const [ix, iy, iw, ih] = interaction.initialRect;
      const nx = roundMm(Math.max(0, Math.min(widthMm - iw, ix + dxMm)));
      const ny = roundMm(Math.max(0, Math.min(heightMm - ih, iy + dyMm)));
      onUpdateFieldRect(interaction.fieldId, [nx, ny, iw, ih], pageNumber);
      return;
    }

    if (interaction.mode === 'resize') {
      const { dxMm, dyMm } = clientDeltaToMm(
        e.clientX - interaction.startClientX,
        e.clientY - interaction.startClientY
      );
      const [ix, iy, iw, ih] = interaction.initialRect;
      const nw = roundMm(Math.max(4, Math.min(widthMm - ix, iw + dxMm)));
      const nh = roundMm(Math.max(4, Math.min(heightMm - iy, ih + dyMm)));
      onUpdateFieldRect(interaction.fieldId, [ix, iy, nw, nh], pageNumber);
      return;
    }

    if (interaction.mode === 'draw') {
      const { xMm, yMm } = clientToMm(e.clientX, e.clientY);
      const rx = roundMm(Math.min(interaction.startXMm, xMm));
      const ry = roundMm(Math.min(interaction.startYMm, yMm));
      const rw = roundMm(Math.max(4, Math.abs(xMm - interaction.startXMm)));
      const rh = roundMm(Math.max(4, Math.abs(yMm - interaction.startYMm)));
      setInteraction({
        ...interaction,
        currentRect: [rx, ry, rw, rh],
      });
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interaction) return;
    e.preventDefault();

    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (interaction.mode === 'draw') {
      const [rx, ry, rw, rh] = interaction.currentRect;
      if (rw >= 4 && rh >= 4) {
        onUpdateFieldRect(interaction.fieldId, [rx, ry, rw, rh], pageNumber);
      }
    }

    setInteraction(null);
  };

  return (
    <svg
      ref={svgRef}
      className={`oc-svg-overlay ${drawModeActive ? 'oc-svg-overlay--crosshair' : ''}`}
      viewBox={`0 0 ${widthMm} ${heightMm}`}
      preserveAspectRatio="none"
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
    >
      {/* 1. Paint Live DisplayList Primitives (Whiteout rects + Stamped Text Lines) */}
      {displayPage?.ops.map((op) => renderDisplayOpSvg(op))}

      {/* 2. Interactive Field Bounding Boxes (when showFieldFrames is enabled) */}
      {showFieldFrames &&
        fieldsOnPage.map((field) => {
          const [x, y, w, h] = field.rect;
          const isSelected = field.id === selectedFieldId;
          const metrics = fieldMetrics[field.id];
          const isOverflow = Boolean(metrics?.overflowed);
          const isAutoFitted = Boolean(metrics?.autoFitted);
          const isContinued = Boolean(metrics?.continuedOnAnnex);

          let strokeColor = isSelected ? '#10b981' : '#6366f1';
          let fillColor = isSelected
            ? 'rgba(16, 185, 129, 0.10)'
            : 'rgba(99, 102, 241, 0.06)';

          if (isOverflow) {
            strokeColor = '#ef4444';
            fillColor = 'rgba(239, 68, 68, 0.12)';
          } else if (isContinued) {
            strokeColor = '#0284c7';
            fillColor = 'rgba(2, 132, 199, 0.09)';
          } else if (isAutoFitted && isSelected) {
            strokeColor = '#f59e0b';
          }

          const badgeText = isOverflow
            ? `${field.label} · OVERFLOW`
            : isContinued
            ? `${field.label} · +Anexo Pág. 2 (+${metrics?.continuationLineCount || 0}L)`
            : isAutoFitted && metrics
            ? `${field.label} · Auto ${metrics.fontSizePt}pt`
            : field.label;

          const labelWidthMm = Math.min(Math.max(w, 28), Math.max(32, badgeText.length * 1.45));
          const labelYMm = y >= 4.5 ? y - 4.2 : y;

          return (
            <g
              key={field.id}
              className="oc-svg-field-group"
              onPointerDown={(e) => handleBoxPointerDown(e, field)}
              style={{ cursor: 'move' }}
            >
              {/* Bounding Box Frame */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isSelected ? 0.55 : 0.35}
                strokeDasharray={isSelected ? undefined : '1.4 0.9'}
                rx={0.6}
              />

              {/* Top Tag Pill (Always visible on selected or hovered/overflowed fields, or subtle on all) */}
              {(isSelected || isOverflow || w >= 18) && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={x}
                    y={labelYMm}
                    width={labelWidthMm}
                    height={4.0}
                    rx={0.7}
                    fill={strokeColor}
                    fillOpacity={isSelected || isOverflow ? 0.95 : 0.78}
                  />
                  <text
                    x={x + 1.2}
                    y={labelYMm + 2.85}
                    fill="#ffffff"
                    fontSize={2.35}
                    fontFamily="Helvetica, Arial, sans-serif"
                    fontWeight={700}
                  >
                    {badgeText.slice(0, 38)}
                  </text>
                </g>
              )}

              {/* Bottom-Right Interactive Resize Handle */}
              {isSelected && (
                <rect
                  x={x + w - 2.6}
                  y={y + h - 2.6}
                  width={3.2}
                  height={3.2}
                  rx={0.5}
                  fill="#ffffff"
                  stroke={strokeColor}
                  strokeWidth={0.55}
                  style={{ cursor: 'nwse-resize' }}
                  onPointerDown={(e) => handleResizePointerDown(e, field)}
                />
              )}
            </g>
          );
        })}

      {/* 3. Active Rubberband Box while Drawing */}
      {interaction?.mode === 'draw' && (
        <rect
          x={interaction.currentRect[0]}
          y={interaction.currentRect[1]}
          width={interaction.currentRect[2]}
          height={interaction.currentRect[3]}
          fill="rgba(16, 185, 129, 0.18)"
          stroke="#10b981"
          strokeWidth={0.55}
          strokeDasharray="1.5 1"
          rx={0.6}
        />
      )}
    </svg>
  );
};

/**
 * Renders a single `ResolvedOp` inside the millimeter SVG coordinate space,
 * matching `pdfClientPainter.ts` line-by-line and baseline-by-baseline.
 */
function renderDisplayOpSvg(op: ResolvedOp): React.ReactNode {
  if (op.kind === 'rect') {
    return (
      <rect
        key={op.id}
        x={op.x}
        y={op.y}
        width={op.w}
        height={op.h}
        fill={op.fill || '#ffffff'}
        fillOpacity={op.fillOpacity ?? 0.88}
        stroke={op.stroke || 'none'}
        strokeWidth={op.strokeWidthMm || 0}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  if (op.kind === 'signature') {
    return (
      <path
        key={op.id}
        d={op.svgPathMm}
        fill="none"
        stroke={op.color || '#0F296B'}
        strokeWidth={op.strokeWidthMm || 0.42}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  if (op.kind === 'text') {
    const fontSizeMm = ptToMm(op.sizePt || 10);
    const capHeightMm = (op.sizePt * 0.72) / (72 / 25.4);
    const isSingleLineCentered = op.lines.length === 1 && op.h <= capHeightMm * 3.2;
    const baselineOffsetMm = isSingleLineCentered
      ? (op.h + capHeightMm) / 2
      : (op.sizePt * 0.85) / (72 / 25.4);

    let textAnchor: 'start' | 'middle' | 'end' = 'start';
    let baseX = op.x;
    if (op.align === 'center') {
      textAnchor = 'middle';
      baseX = op.x + op.w / 2;
    } else if (op.align === 'right') {
      textAnchor = 'end';
      baseX = op.x + op.w;
    }

    return (
      <g key={op.id} style={{ pointerEvents: 'none' }}>
        {op.lines.map((line, idx) => {
          if (!line) return null;
          const lineYMm = op.y + baselineOffsetMm + idx * op.lineHeightMm;
          return (
            <text
              key={`${op.id}-L${idx}`}
              x={baseX}
              y={lineYMm}
              fontSize={fontSizeMm}
              fontFamily="Helvetica, Arial, sans-serif"
              fontWeight={op.weight === 'bold' ? 700 : 400}
              fill={op.color || '#0F172A'}
              textAnchor={textAnchor}
              xmlSpace="preserve"
            >
              {line}
            </text>
          );
        })}
      </g>
    );
  }

  return null;
}

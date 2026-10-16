import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Svg, { Rect, Line, Path, Text as SvgText, G, Circle, Image as SvgImage } from 'react-native-svg';
import { DisplayPage, ResolvedOp, SdocPrimitive, mmToPx, pxToMm, ptToMm } from '@sekundo/core';
import { MmGridSvgLayer } from './MmRulers';

export interface SvgPainterProps {
  page: DisplayPage;
  primitives?: SdocPrimitive[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdatePrimitive: (id: string, patch: Record<string, unknown>) => void;
  snapMm?: number;
  showGrid?: boolean;
  zoom?: number;
  underlayDataUrl?: string | null;
}

interface DragState {
  id: string;
  mode: 'move' | 'resize-br' | 'line-p1' | 'line-p2' | 'path-vertex';
  vertexIdx?: number;
  startClientX: number;
  startClientY: number;
  lastDelta: { dxMm: number; dyMm: number };
  initialPrim: SdocPrimitive;
}

function snapValue(val: number, step: number): number {
  if (!step || step <= 0) return Math.round(val * 100) / 100;
  return Math.round(val / step) * step;
}

export function extractBasePrimitiveId(opId: string): string {
  return opId.replace(/_p\d+(_s\d+)?$/, '').replace(/_(cell|txt)_\d+_\d+$/, '');
}

function getPointerCoords(e: any): { x: number; y: number } {
  const ne = e?.nativeEvent ?? e;
  const touch = ne?.touches?.[0] ?? ne?.changedTouches?.[0] ?? e?.touches?.[0] ?? e?.changedTouches?.[0] ?? ne;
  return {
    x: touch?.clientX ?? touch?.pageX ?? touch?.locationX ?? 0,
    y: touch?.clientY ?? touch?.pageY ?? touch?.locationY ?? 0,
  };
}

export function SvgPainter({
  page, primitives = [], selectedId, onSelect, onUpdatePrimitive,
  snapMm = 1, showGrid = true, zoom = 1, underlayDataUrl = null,
}: SvgPainterProps) {
  const widthPx = mmToPx(page.widthMm, zoom);
  const heightPx = mmToPx(page.heightMm, zoom);
  const [dragPreview, setDragPreview] = useState<{ dxMm: number; dyMm: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const findPrimitive = useCallback(
    (sourceId: string): SdocPrimitive | undefined => primitives.find((p) => p.id === sourceId),
    [primitives]
  );

  const startPointerDrag = useCallback(
    (e: any, sourceId: string, mode: DragState['mode'] = 'move', vertexIdx?: number) => {
      if (e?.stopPropagation) e.stopPropagation();
      onSelect(sourceId);
      const prim = findPrimitive(sourceId);
      if (!prim) return;
      const { x, y } = getPointerCoords(e);
      dragRef.current = {
        id: sourceId, mode, vertexIdx, startClientX: x, startClientY: y,
        lastDelta: { dxMm: 0, dyMm: 0 },
        initialPrim: JSON.parse(JSON.stringify(prim)),
      };
      setDragPreview({ dxMm: 0, dyMm: 0 });
    },
    [findPrimitive, onSelect]
  );

  const handlePointerMove = useCallback(
    (e: any) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (e?.stopPropagation) e.stopPropagation();
      const { x, y } = getPointerCoords(e);
      const dxMm = pxToMm(x - drag.startClientX, zoom);
      const dyMm = pxToMm(y - drag.startClientY, zoom);
      drag.lastDelta = { dxMm, dyMm };
      setDragPreview({ dxMm, dyMm });
    },
    [zoom]
  );

  const handlePointerUp = useCallback((e?: any) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (e?.stopPropagation) e.stopPropagation();
    dragRef.current = null;
    const delta = drag.lastDelta;
    setDragPreview(null);
    if (!delta || (Math.abs(delta.dxMm) < 0.05 && Math.abs(delta.dyMm) < 0.05)) {
      return;
    }

    const prim = drag.initialPrim as any;
    if (drag.mode === 'move') {
      if (prim.type === 'line') {
        onUpdatePrimitive(drag.id, {
          x1: snapValue(prim.x1 + delta.dxMm, snapMm),
          y1: snapValue(prim.y1 + delta.dyMm, snapMm),
          x2: snapValue(prim.x2 + delta.dxMm, snapMm),
          y2: snapValue(prim.y2 + delta.dyMm, snapMm),
        });
      } else if (prim.type === 'path' && Array.isArray(prim.points)) {
        onUpdatePrimitive(drag.id, {
          points: prim.points.map(([px, py]: [number, number]) => [
            snapValue(px + delta.dxMm, snapMm),
            snapValue(py + delta.dyMm, snapMm),
          ]),
        });
      } else if (typeof prim.x === 'number' && typeof prim.y === 'number') {
        onUpdatePrimitive(drag.id, {
          x: snapValue(prim.x + delta.dxMm, snapMm),
          y: snapValue(prim.y + delta.dyMm, snapMm),
        });
      }
    } else if (drag.mode === 'resize-br' && typeof prim.w === 'number') {
      onUpdatePrimitive(drag.id, {
        w: Math.max(2, snapValue(prim.w + delta.dxMm, snapMm)),
        ...(typeof prim.h === 'number'
          ? { h: Math.max(2, snapValue(prim.h + delta.dyMm, snapMm)) }
          : {}),
      });
    } else if (drag.mode === 'line-p1' && prim.type === 'line') {
      onUpdatePrimitive(drag.id, {
        x1: snapValue(prim.x1 + delta.dxMm, snapMm),
        y1: snapValue(prim.y1 + delta.dyMm, snapMm),
      });
    } else if (drag.mode === 'line-p2' && prim.type === 'line') {
      onUpdatePrimitive(drag.id, {
        x2: snapValue(prim.x2 + delta.dxMm, snapMm),
        y2: snapValue(prim.y2 + delta.dyMm, snapMm),
      });
    } else if (
      drag.mode === 'path-vertex' &&
      prim.type === 'path' &&
      typeof drag.vertexIdx === 'number'
    ) {
      const nextPts = prim.points.map((pt: [number, number], i: number) =>
        i === drag.vertexIdx
          ? [snapValue(pt[0] + delta.dxMm, snapMm), snapValue(pt[1] + delta.dyMm, snapMm)]
          : pt
      );
      onUpdatePrimitive(drag.id, { points: nextPts });
    }
  }, [onUpdatePrimitive, snapMm]);

  const bindDrag = (
    sourceId: string,
    mode: DragState['mode'] = 'move',
    vertexIdx?: number
  ): Record<string, any> =>
    Platform.OS === 'web'
      ? {
          onMouseDown: (e: any) => startPointerDrag(e, sourceId, mode, vertexIdx),
          onPointerDown: (e: any) => startPointerDrag(e, sourceId, mode, vertexIdx),
          onTouchStart: (e: any) => startPointerDrag(e, sourceId, mode, vertexIdx),
        }
      : { onPressIn: (e: any) => startPointerDrag(e, sourceId, mode, vertexIdx) };

  const renderOp = (op: ResolvedOp, idx: number) => {
    const sourceId = extractBasePrimitiveId(op.id);
    const isSelected = selectedId === sourceId;
    const isDraggingThis = dragRef.current?.id === sourceId && dragPreview;
    const dx = isDraggingThis && dragRef.current?.mode === 'move' ? dragPreview.dxMm : 0;
    const dy = isDraggingThis && dragRef.current?.mode === 'move' ? dragPreview.dyMm : 0;

    if (op.kind === 'rect') {
      const strokeW = op.strokeWidthMm ?? 0.25;
      return (
        <G key={`${op.id}-${idx}`} {...bindDrag(sourceId, 'move')}>
          <Rect
            x={op.x + dx}
            y={op.y + dy}
            width={op.w}
            height={op.h}
            fill={op.fill || 'none'}
            stroke={isSelected ? '#2563EB' : op.stroke || 'none'}
            strokeWidth={isSelected ? Math.max(strokeW, 0.5) : strokeW}
            rx={op.radiusMm || 0}
            ry={op.radiusMm || 0}
          />
          {isSelected && (
            <Rect
              x={op.x + dx + op.w - 1.5}
              y={op.y + dy + op.h - 1.5}
              width={3}
              height={3}
              fill="#2563EB"
              {...bindDrag(sourceId, 'resize-br')}
            />
          )}
        </G>
      );
    }

    if (op.kind === 'line') {
      const strokeW = op.strokeWidthMm ?? 0.35;
      return (
        <G key={`${op.id}-${idx}`} {...bindDrag(sourceId, 'move')}>
          <Line
            x1={op.x1 + dx}
            y1={op.y1 + dy}
            x2={op.x2 + dx}
            y2={op.y2 + dy}
            stroke={isSelected ? '#2563EB' : op.stroke || '#0F172A'}
            strokeWidth={isSelected ? Math.max(strokeW, 0.6) : strokeW}
            strokeDasharray={op.dash ? op.dash.join(',') : undefined}
          />
          {isSelected && (
            <>
              <Circle
                cx={op.x1 + dx}
                cy={op.y1 + dy}
                r={1.6}
                fill="#2563EB"
                {...bindDrag(sourceId, 'line-p1')}
              />
              <Circle
                cx={op.x2 + dx}
                cy={op.y2 + dy}
                r={1.6}
                fill="#2563EB"
                {...bindDrag(sourceId, 'line-p2')}
              />
            </>
          )}
        </G>
      );
    }

    if (op.kind === 'path' && op.points.length >= 2) {
      const d =
        op.points
          .map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px + dx} ${py + dy}`)
          .join(' ') + (op.closed ? ' Z' : '');
      const strokeW = op.strokeWidthMm ?? 0.35;
      return (
        <G key={`${op.id}-${idx}`} {...bindDrag(sourceId, 'move')}>
          <Path
            d={d}
            fill={op.fill || 'none'}
            stroke={isSelected ? '#2563EB' : op.stroke || '#0F172A'}
            strokeWidth={isSelected ? Math.max(strokeW, 0.6) : strokeW}
          />
          {isSelected &&
            op.points.map(([px, py], vIdx) => (
              <Circle
                key={`v-${vIdx}`}
                cx={px + dx}
                cy={py + dy}
                r={1.5}
                fill="#2563EB"
                {...bindDrag(sourceId, 'path-vertex', vIdx)}
              />
            ))}
        </G>
      );
    }

    if (op.kind === 'text') {
      const fontSizeMm = ptToMm(op.sizePt);
      const lineStepMm = op.lineHeightMm || fontSizeMm * 1.25;
      const anchor =
        op.align === 'center' ? 'middle' : op.align === 'right' ? 'end' : 'start';
      const textX =
        op.align === 'center'
          ? op.x + dx + op.w / 2
          : op.align === 'right'
          ? op.x + dx + op.w
          : op.x + dx;
      const isCenteredField =
        op.layerId === 'fields' && op.lines.length === 1 && op.h > fontSizeMm;
      const firstLineY = isCenteredField
        ? op.y + dy + (op.h + fontSizeMm * 0.72) / 2
        : op.y + dy + 0.82 * lineStepMm;

      return (
        <G key={`${op.id}-${idx}`} {...bindDrag(sourceId, 'move')}>
          {isSelected && (
            <Rect
              x={op.x + dx - 0.5}
              y={op.y + dy - 0.5}
              width={op.w + 1}
              height={Math.max(op.h, lineStepMm) + 1}
              fill="rgba(37, 99, 235, 0.08)"
              stroke="#2563EB"
              strokeWidth={0.35}
              strokeDasharray="1,1"
            />
          )}
          {op.lines.map((line, lIdx) => (
            <SvgText
              key={`${op.id}-l-${lIdx}`}
              x={textX}
              y={lIdx === 0 ? firstLineY : op.y + dy + (lIdx + 0.82) * lineStepMm}
              fontSize={fontSizeMm}
              fontWeight={op.weight === 'bold' ? 'bold' : 'normal'}
              fill={op.color || '#0F172A'}
              textAnchor={anchor}
              fontFamily="Helvetica, Arial, sans-serif"
            >
              {line}
            </SvgText>
          ))}
        </G>
      );
    }

    return null;
  };

  return (
    <View
      testID="studio-svg-canvas"
      style={[
        styles.canvasSheet,
        { width: widthPx, height: heightPx },
        Platform.OS === 'web' ? ({ touchAction: 'none' } as any) : null,
      ]}
      {...(Platform.OS === 'web'
        ? {
            onMouseMove: handlePointerMove,
            onMouseUp: handlePointerUp,
            onMouseLeave: handlePointerUp,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerUp,
            onTouchMove: handlePointerMove,
            onTouchEnd: handlePointerUp,
            onTouchCancel: handlePointerUp,
          }
        : {
            onStartShouldSetResponder: () => true,
            onResponderMove: handlePointerMove,
            onResponderRelease: handlePointerUp,
          })}
    >
      <Svg
        width={widthPx}
        height={heightPx}
        viewBox={`0 0 ${page.widthMm} ${page.heightMm}`}
      >
        <Rect
          x={0}
          y={0}
          width={page.widthMm}
          height={page.heightMm}
          fill={page.background || '#FFFFFF'}
          {...(Platform.OS === 'web'
            ? {
                onMouseDown: () => onSelect(null),
                onPointerDown: () => onSelect(null),
              }
            : { onPressIn: () => onSelect(null) })}
        />
        {underlayDataUrl && (
          <SvgImage
            href={underlayDataUrl}
            x={0}
            y={0}
            width={page.widthMm}
            height={page.heightMm}
            preserveAspectRatio="none"
          />
        )}
        {showGrid && <MmGridSvgLayer widthMm={page.widthMm} heightMm={page.heightMm} />}
        {page.ops.map((op, i) => renderOp(op, i))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasSheet: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});

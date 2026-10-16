/**
 * Ocorrências 3.0 (Phase 2) — Interactive Vector Handwritten Signature & Rubric Pad
 * (`SignaturePadModal.tsx`)
 *
 * Captures mouse, touch, or stylus trajectories using unified PointerEvents,
 * normalizes coordinates into `[0..1, 0..1]` Euclidean space, and encodes them
 * into `sigv1:...` vector paths rendered identically in SVG, `pdf-lib`, and `PyMuPDF`.
 * Zero raster PNG bloat (~600 bytes per signature) and 100% Zero-Storage LGPD compliant.
 */

import React, { useEffect, useRef, useState } from 'react';
import { encodeSignatureVector, parseSignatureVector } from './engine';

export interface SignaturePadModalProps {
  isOpen: boolean;
  fieldLabel: string;
  initialValue?: string;
  onClose: () => void;
  onApplySignature: (encodedSig: string) => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  fieldLabel,
  initialValue = '',
  onClose,
  onApplySignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Array<Array<[number, number]>>>([]);
  const [activeStroke, setActiveStroke] = useState<Array<[number, number]> | null>(null);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseSignatureVector(initialValue);
      setStrokes(parsed);
      setActiveStroke(null);
    }
  }, [isOpen, initialValue]);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle baseline guide
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(24, h * 0.78);
    ctx.lineTo(w - 24, h * 0.78);
    ctx.stroke();
    ctx.restore();

    // Draw all strokes
    const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;
    ctx.save();
    ctx.strokeStyle = '#0F296B';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0] * w, stroke[0][1] * h);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0] * w, stroke[i][1] * h);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, [isOpen, strokes, activeStroke]);

  if (!isOpen) return null;

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
    return [nx, ny];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    setActiveStroke([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke) return;
    e.preventDefault();
    const pt = getNormalizedPoint(e);
    const last = activeStroke[activeStroke.length - 1];
    const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
    if (dist >= 0.008) {
      setActiveStroke((prev) => (prev ? [...prev, pt] : [pt]));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStroke) return;
    e.preventDefault();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    if (activeStroke.length >= 2) {
      setStrokes((prev) => [...prev, activeStroke]);
    } else if (activeStroke.length === 1) {
      const [x, y] = activeStroke[0];
      setStrokes((prev) => [...prev, [[x, y], [Math.min(1, x + 0.01), y]]]);
    }
    setActiveStroke(null);
  };

  const handleGenerateDemoRubric = () => {
    // Generates a realistic calligraphic rubric trajectory in normalized [0..1] space
    const rubricStroke1: Array<[number, number]> = [];
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const nx = 0.08 + t * 0.78;
      const ny =
        0.58 -
        Math.sin(t * Math.PI * 3.5) * 0.26 * (1 - t * 0.45) -
        t * 0.12;
      rubricStroke1.push([Number(nx.toFixed(3)), Number(Math.max(0.12, Math.min(0.88, ny)).toFixed(3))]);
    }
    const underlineStroke: Array<[number, number]> = [
      [0.14, 0.76],
      [0.48, 0.72],
      [0.86, 0.74],
    ];
    setStrokes([rubricStroke1, underlineStroke]);
  };

  const handleClear = () => {
    setStrokes([]);
    setActiveStroke(null);
  };

  const handleConfirm = () => {
    const encoded = encodeSignatureVector(strokes);
    onApplySignature(encoded);
    onClose();
  };

  const totalPoints = strokes.reduce((acc, s) => acc + s.length, 0);

  return (
    <div
      className="oc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Coletar Assinatura Vetorial: ${fieldLabel}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 6, 23, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="oc-signature-modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.32)',
          borderRadius: '14px',
          padding: '1.25rem',
          color: '#f8fafc',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#38bdf8' }}>
              ✍️ Assinatura / Rubrica Vetorial Manuscrita
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Campo: <strong>{fieldLabel}</strong> · Traços gravados em curvas vetoriais puras no PDF (0 bytes em nuvem)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="oc-btn oc-btn--ghost"
            style={{ padding: '0.3rem 0.6rem' }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '2px solid #cbd5e1',
            overflow: 'hidden',
            position: 'relative',
            touchAction: 'none',
          }}
        >
          <canvas
            ref={canvasRef}
            width={520}
            height={170}
            data-testid="signature-pad-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              width: '100%',
              height: '170px',
              display: 'block',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          />
          {strokes.length === 0 && !activeStroke && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
              }}
            >
              Assine aqui com o mouse, dedo ou caneta stylus...
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <button
              type="button"
              className="oc-btn oc-btn--ghost"
              onClick={handleClear}
              data-testid="sig-clear-btn"
            >
              🗑️ Limpar
            </button>
            <button
              type="button"
              className="oc-btn oc-btn--ghost"
              onClick={handleGenerateDemoRubric}
              data-testid="sig-demo-rubric-btn"
              title="Gera uma rubrica caligráfica vetorial de demonstração"
            >
              ✨ Gerar Rubrica Demo
            </button>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {strokes.length} traço(s) · {totalPoints} vértices vetoriais
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="oc-btn oc-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="oc-btn oc-btn--primary"
              onClick={handleConfirm}
              disabled={strokes.length === 0}
              data-testid="sig-apply-btn"
            >
              ✓ Aplicar Assinatura Vetorial no PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

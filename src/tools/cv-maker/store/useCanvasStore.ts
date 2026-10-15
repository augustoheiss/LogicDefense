/**
 * useCanvasStore.ts
 * Store reativa centralizada para o Canvas do CV Maker construída com Zustand.
 * Centraliza a seleção de caixas, zonas customizadas, elementos ricos (Docx TextRun),
 * réguas/grade AutoCAD, Pintor de Estilo (MS Paint) e guias magnéticas (OSNAP),
 * eliminando a dispersão de CustomEvents manuais e garantindo tipagem estrita.
 */

import { create } from 'zustand'
import type { CopiedSpanStyle } from '../types/canvasStudio'

export interface SnapLineGuide {
  type: 'x' | 'y'
  posPct: number
  label?: string
}

export interface CanvasState {
  selectedBoxId: string | null
  selectedZoneId: string | null
  selectedElementId: string | null
  selectedSpanId: string | null
  activeDrawingMode: 'rect' | 'polygon' | null
  boxMoveNonce: number

  // Modos AutoCAD & MS Paint
  showCadRulers: boolean
  showCadGrid: boolean
  snapEnabled: boolean
  stylePainterFormat: CopiedSpanStyle | null
  activeSnapLines: SnapLineGuide[]

  // Ações
  selectBox: (id: string | null) => void
  selectZone: (id: string | null) => void
  selectElement: (elementId: string | null, spanId?: string | null) => void
  selectSpan: (spanId: string | null) => void
  setDrawingMode: (mode: 'rect' | 'polygon' | null) => void
  toggleCadRulers: () => void
  toggleCadGrid: () => void
  toggleSnap: () => void
  setStylePainterFormat: (format: CopiedSpanStyle | null) => void
  setActiveSnapLines: (lines: SnapLineGuide[]) => void
  notifyBoxMoved: () => void
  resetCanvasState: () => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedBoxId: null,
  selectedZoneId: null,
  selectedElementId: null,
  selectedSpanId: null,
  activeDrawingMode: null,
  boxMoveNonce: 0,

  showCadRulers: true,
  showCadGrid: false,
  snapEnabled: true,
  stylePainterFormat: null,
  activeSnapLines: [],

  selectBox: (id: string | null) => {
    set({ selectedBoxId: id })
    // Event bridge para compatibilidade com listeners legados
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id } }))
    }
  },

  selectZone: (id: string | null) => {
    set({ selectedZoneId: id })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: id } }))
      window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: id } }))
    }
  },

  selectElement: (elementId: string | null, spanId?: string | null) => {
    set({
      selectedElementId: elementId,
      selectedSpanId: spanId !== undefined ? spanId : null
    })
  },

  selectSpan: (spanId: string | null) => {
    set({ selectedSpanId: spanId })
  },

  setDrawingMode: (mode: 'rect' | 'polygon' | null) => {
    set({ activeDrawingMode: mode })
    if (typeof window !== 'undefined') {
      if (mode) {
        window.dispatchEvent(new CustomEvent('cv-canvas-start-draw', { detail: { mode } }))
      } else {
        window.dispatchEvent(new CustomEvent('cv-canvas-cancel-draw'))
      }
    }
  },

  toggleCadRulers: () => set((s) => ({ showCadRulers: !s.showCadRulers })),
  toggleCadGrid: () => set((s) => ({ showCadGrid: !s.showCadGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  setStylePainterFormat: (format: CopiedSpanStyle | null) => {
    set({ stylePainterFormat: format })
  },

  setActiveSnapLines: (lines: SnapLineGuide[]) => {
    set({ activeSnapLines: lines })
  },

  notifyBoxMoved: () => {
    set((state) => ({ boxMoveNonce: state.boxMoveNonce + 1 }))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-box-moved'))
    }
  },

  resetCanvasState: () => {
    set({
      selectedBoxId: null,
      selectedZoneId: null,
      selectedElementId: null,
      selectedSpanId: null,
      activeDrawingMode: null,
      stylePainterFormat: null,
      activeSnapLines: []
    })
  }
}))

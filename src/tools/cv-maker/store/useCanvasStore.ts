/**
 * useCanvasStore.ts
 * Store reativa centralizada para o Canvas do CV Maker construída com Zustand.
 * Garante exclusão mútua estrita entre seleção de caixas (StructuralBoxWrapper),
 * zonas/sidebars (CanvasContainerFrame), elementos de texto rico (InlineRichSpanEditor)
 * e modo de desenho (activeDrawingMode), impedindo sobreposição de menus.
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

  showCadRulers: false,
  showCadGrid: false,
  snapEnabled: true,
  stylePainterFormat: null,
  activeSnapLines: [],

  selectBox: (id: string | null) => {
    set((state) => ({
      selectedBoxId: id,
      // Exclusão mútua: ao selecionar um bloco do currículo, fecha barras de zona, texto livre e modo de desenho
      selectedZoneId: id ? null : state.selectedZoneId,
      selectedElementId: id ? null : state.selectedElementId,
      selectedSpanId: id ? null : state.selectedSpanId,
      activeDrawingMode: id ? null : state.activeDrawingMode
    }))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id } }))
      if (id) {
        window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: null } }))
        window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: null } }))
      }
    }
  },

  selectZone: (id: string | null) => {
    set((state) => ({
      selectedZoneId: id,
      // Exclusão mútua: ao selecionar uma zona/sidebar, desmarca blocos do currículo e cancela modo de desenho
      selectedBoxId: id ? null : state.selectedBoxId,
      selectedElementId: id ? null : state.selectedElementId,
      selectedSpanId: id ? null : state.selectedSpanId,
      activeDrawingMode: id ? null : state.activeDrawingMode
    }))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: id } }))
      window.dispatchEvent(new CustomEvent('cv-canvas-zone-selected', { detail: { zoneId: id } }))
      if (id) {
        window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: null } }))
      }
    }
  },

  selectElement: (elementId: string | null, spanId?: string | null) => {
    set((state) => ({
      selectedElementId: elementId,
      selectedSpanId: spanId !== undefined ? spanId : null,
      // Exclusão mútua: ao editar uma frase/título rico, desmarca blocos do currículo e cancela modo de desenho
      selectedBoxId: elementId ? null : state.selectedBoxId,
      activeDrawingMode: elementId ? null : state.activeDrawingMode
    }))
    if (typeof window !== 'undefined' && elementId) {
      window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: null } }))
    }
  },

  selectSpan: (spanId: string | null) => {
    set({ selectedSpanId: spanId })
  },

  setDrawingMode: (mode: 'rect' | 'polygon' | null) => {
    set({
      activeDrawingMode: mode,
      // Ao entrar em modo de desenho, fecha popovers abertos para não poluir a tela
      selectedBoxId: null,
      selectedZoneId: null,
      selectedElementId: null,
      selectedSpanId: null
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: null } }))
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cv-select-box', { detail: { id: null } }))
      window.dispatchEvent(new CustomEvent('cv-canvas-select-zone', { detail: { zoneId: null } }))
    }
  }
}))

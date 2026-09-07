/**
 * useCanvasStore.ts
 * Store reativa centralizada para o Canvas do CV Maker construída com Zustand.
 * Centraliza a seleção de caixas, zonas customizadas, modos de desenho e reordenação,
 * eliminando a dispersão de CustomEvents manuais e garantindo tipagem estrita.
 */

import { create } from 'zustand'

export interface CanvasState {
  selectedBoxId: string | null
  selectedZoneId: string | null
  activeDrawingMode: 'rect' | 'polygon' | null
  boxMoveNonce: number

  // Ações
  selectBox: (id: string | null) => void
  selectZone: (id: string | null) => void
  setDrawingMode: (mode: 'rect' | 'polygon' | null) => void
  notifyBoxMoved: () => void
  resetCanvasState: () => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedBoxId: null,
  selectedZoneId: null,
  activeDrawingMode: null,
  boxMoveNonce: 0,

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
      activeDrawingMode: null
    })
  }
}))

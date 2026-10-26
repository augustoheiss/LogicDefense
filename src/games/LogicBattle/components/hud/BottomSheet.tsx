// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/BottomSheet.tsx — Gaveta Inferior Deslizante
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  testId?: string
  children: React.ReactNode
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  testId,
  children,
}) => {
  if (!open) return null

  return (
    <div
      className="lb-bottom-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      data-testid={testId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="lb-bottom-sheet">
        <div className="lb-bottom-sheet__handle-bar">
          <div className="lb-bottom-sheet__grabber" />
          {title && <h2 className="lb-bottom-sheet__title">{title}</h2>}
          <button
            type="button"
            className="lb-bottom-sheet__close"
            onClick={onClose}
            aria-label="Fechar painel"
          >
            ✕
          </button>
        </div>
        <div className="lb-bottom-sheet__body">{children}</div>
      </div>
    </div>
  )
}

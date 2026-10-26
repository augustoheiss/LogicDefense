// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/IconButton.tsx — Botão 3D Compacto de Ícone
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  variant?: 'blue' | 'slate' | 'gold' | 'teal'
  badge?: string | number
  testId?: string
}

export const IconButton: React.FC<IconButtonProps> = ({
  active = false,
  variant = 'blue',
  badge,
  testId,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`lb-icon-btn lb-icon-btn--${variant} ${active ? 'is-active' : ''} ${className}`.trim()}
      {...rest}
    >
      <span className="lb-icon-btn__content">{children}</span>
      {badge !== undefined && badge !== null && (
        <span className="lb-icon-btn__badge">{badge}</span>
      )}
    </button>
  )
}

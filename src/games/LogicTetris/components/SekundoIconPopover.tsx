import React, { useEffect } from 'react'

export interface SekundoRevealSpec {
  id: string
  icon: string
  title: string
  shortcut?: string
  badge?: string
  description: string
  oracleHint?: string
  accentColor?: 'cyan' | 'amber' | 'purple' | 'emerald'
  actionLabel?: string
  onAction?: () => void
  customContent?: React.ReactNode
}

export interface SekundoIconPopoverProps {
  spec: SekundoRevealSpec | null
  onClose: () => void
  dockPosition?: 'top' | 'bottom'
}

const ACCENT_STYLES: Record<
  NonNullable<SekundoRevealSpec['accentColor']>,
  {
    border: string
    badge: string
    button: string
    iconBox: string
  }
> = {
  cyan: {
    border: 'border-cyan-400/80 shadow-[0_12px_36px_rgba(6,182,212,0.32)]',
    badge: 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200',
    button:
      'bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950',
    iconBox: 'bg-cyan-950/90 border-cyan-400/60 text-cyan-200',
  },
  amber: {
    border: 'border-amber-400/80 shadow-[0_12px_36px_rgba(251,191,36,0.32)]',
    badge: 'bg-amber-500/20 border-amber-400/50 text-amber-200',
    button:
      'bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950',
    iconBox: 'bg-amber-950/90 border-amber-400/60 text-amber-200',
  },
  purple: {
    border: 'border-purple-400/80 shadow-[0_12px_36px_rgba(168,85,247,0.32)]',
    badge: 'bg-purple-500/20 border-purple-400/50 text-purple-200',
    button:
      'bg-gradient-to-r from-purple-500 to-fuchsia-400 hover:from-purple-400 hover:to-fuchsia-300 text-slate-950',
    iconBox: 'bg-purple-950/90 border-purple-400/60 text-purple-200',
  },
  emerald: {
    border: 'border-emerald-400/80 shadow-[0_12px_36px_rgba(16,185,129,0.32)]',
    badge: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
    button:
      'bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950',
    iconBox: 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200',
  },
}

/**
 * `<SekundoIconPopover />` — Progressive Disclosure ("Click-to-Reveal") Popover Engine
 * modeled after Sekundo's `CadToolDock.tsx`.
 *
 * Keeps the main game arena 100% free of permanent text paragraphs:
 * - Dock buttons display ONLY their icon + optional micro-badge.
 * - Clicking any icon reveals this anchored floating card explaining its function,
 *   keyboard shortcut, live Oracle insight, and optional action trigger.
 */
export const SekundoIconPopover: React.FC<SekundoIconPopoverProps> = ({
  spec,
  onClose,
  dockPosition = 'top',
}) => {
  useEffect(() => {
    if (!spec) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === ' '
      ) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [spec, onClose])

  if (!spec) return null

  const theme = ACCENT_STYLES[spec.accentColor ?? 'cyan']
  const positionClasses =
    dockPosition === 'top'
      ? 'top-full mt-1.5 left-1/2 -translate-x-1/2'
      : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'

  return (
    <div
      className={`absolute ${positionClasses} z-40 w-[min(420px,92vw)] rounded-2xl bg-slate-950/95 backdrop-blur-xl border-2 ${theme.border} p-3 text-left animate-fadeIn`}
      data-testid="sekundo-icon-reveal-popover"
      data-reveal-id={spec.id}
      role="dialog"
      aria-label={spec.title}
    >
      {/* Header Row: Icon + Title + Shortcut + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-8 h-8 rounded-xl border flex items-center justify-center text-base shrink-0 ${theme.iconBox}`}
          >
            {spec.icon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                {spec.title}
              </h3>
              {spec.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded-full border text-[9px] font-mono font-bold ${theme.badge}`}
                >
                  {spec.badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
              {spec.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {spec.shortcut && (
            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300">
              {spec.shortcut}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            data-testid="sekundo-popover-close"
            title="Fechar [Esc]"
            className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-300 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Optional Oracle Live Insight */}
      {spec.oracleHint && (
        <div
          className="mt-[8px] rounded-xl bg-slate-900/95 border border-amber-400/50 px-2.5 py-1.5 text-[11px] text-amber-100 leading-snug"
          style={{ color: '#fef3c7' }}
          data-testid="oracle-recommendation-reason"
        >
          <span className="text-amber-300 font-bold">💡 Oráculo: </span>
          <span className="text-amber-100 font-medium" style={{ color: '#fef3c7' }}>
            {spec.oracleHint}
          </span>
        </div>
      )}

      {/* Optional Custom Sub-Controls */}
      {spec.customContent && <div className="mt-[8px]">{spec.customContent}</div>}

      {/* Optional 2nd-Click Action Button (Sekundo CAD Flow) */}
      {spec.actionLabel && spec.onAction && (
        <button
          type="button"
          onClick={() => {
            spec.onAction?.()
            onClose()
          }}
          data-testid="sekundo-popover-confirm"
          className={`mt-[10px] w-full py-1.5 px-3 rounded-xl font-mono font-extrabold text-xs transition cursor-pointer shadow ${theme.button}`}
        >
          {spec.actionLabel}
        </button>
      )}
    </div>
  )
}

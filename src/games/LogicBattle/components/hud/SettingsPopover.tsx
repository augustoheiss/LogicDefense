// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/SettingsPopover.tsx — Popover de Ajustes (⚙)
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BIOME_LIST } from '../../config/biomes'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'

export const SettingsPopover: React.FC = () => {
  const settingsPopoverOpen = useLogicBattleStore((s) => s.settingsPopoverOpen)
  const toggleSettingsPopover = useLogicBattleStore((s) => s.toggleSettingsPopover)
  const save = useLogicBattleStore((s) => s.save)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const recoveredFromBackup = useLogicBattleStore((s) => s.recoveredFromBackup)
  const toggleNotationMode = useLogicBattleStore((s) => s.toggleNotationMode)
  const toggleCalmMode = useLogicBattleStore((s) => s.toggleCalmMode)
  const toggleSimpleTapMode = useLogicBattleStore((s) => s.toggleSimpleTapMode)
  const toggleSound = useLogicBattleStore((s) => s.toggleSound)
  const toggleReducedMotion = useLogicBattleStore((s) => s.toggleReducedMotion)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)

  if (!settingsPopoverOpen) return null

  return (
    <div
      className="lb-settings-popover-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleSettingsPopover(false)
      }}
    >
      <div className="lb-settings-popover" data-testid="lb-settings-popover">
        <div className="lb-settings-popover__header">
          <strong>⚙ Opções de Jogo</strong>
          <button
            type="button"
            className="lb-settings-popover__close"
            onClick={() => toggleSettingsPopover(false)}
            aria-label="Fechar opções"
          >
            ✕
          </button>
        </div>

        <div className="lb-settings-popover__grid">
          <button
            type="button"
            className={`lb-settings-row ${save.settings.notationMode === 'scientific' ? 'is-on' : ''}`}
            onClick={toggleNotationMode}
            data-testid="lb-toggle-notation"
          >
            <span>🔢 Notação</span>
            <strong>{save.settings.notationMode === 'compact' ? '1,2k' : '10ⁿ'}</strong>
          </button>

          <button
            type="button"
            className={`lb-settings-row ${save.settings.soundEnabled ? 'is-on' : ''}`}
            onClick={toggleSound}
            data-testid="lb-toggle-sound"
          >
            <span>🔊 Áudio</span>
            <strong>{save.settings.soundEnabled ? 'ON' : 'OFF'}</strong>
          </button>

          <button
            type="button"
            className={`lb-settings-row ${save.settings.calmMode ? 'is-on' : ''}`}
            onClick={toggleCalmMode}
            data-testid="lb-toggle-calm"
          >
            <span>🐢 Modo Calmo (Sem Pressa)</span>
            <strong>{save.settings.calmMode ? 'ON' : 'OFF'}</strong>
          </button>

          <button
            type="button"
            className={`lb-settings-row ${save.settings.simpleTapMode ? 'is-on' : ''}`}
            onClick={toggleSimpleTapMode}
            data-testid="lb-toggle-simple-tap"
          >
            <span>👆 Modo Toque Simples</span>
            <strong>{save.settings.simpleTapMode ? 'ON' : 'OFF'}</strong>
          </button>

          <button
            type="button"
            className={`lb-settings-row ${save.settings.reducedMotion ? 'is-on' : ''}`}
            onClick={toggleReducedMotion}
          >
            <span>✨ Movimento Reduzido</span>
            <strong>{save.settings.reducedMotion ? 'ON' : 'OFF'}</strong>
          </button>

          <button
            type="button"
            className="lb-settings-row"
            data-testid="lb-open-album"
            onClick={() => {
              toggleSettingsPopover(false)
              openAlbumDrawer(true)
            }}
          >
            <span>📖 Álbum & Códice</span>
            <strong>Abrir</strong>
          </button>
        </div>

        <div className="lb-settings-popover__biomes">
          <span className="lb-settings-popover__label">Bioma da Ponte:</span>
          <div className="lb-settings-popover__biome-list">
            {BIOME_LIST.map((b) => (
              <button
                key={b.id}
                type="button"
                data-testid={`lb-biome-btn-${b.id}`}
                className={`lb-settings-biome-pill ${runPlan.biomeId === b.id ? 'is-active' : ''}`}
                onClick={() => {
                  startNewRun({ biomeId: b.id })
                  toggleSettingsPopover(false)
                }}
              >
                B{b.order} · {b.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {recoveredFromBackup && (
          <div className="lb-settings-popover__backup-note">
            🛡 Save restaurado automaticamente do backup (.bak)
          </div>
        )}
      </div>
    </div>
  )
}

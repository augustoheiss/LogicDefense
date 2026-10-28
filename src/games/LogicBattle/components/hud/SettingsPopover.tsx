// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/SettingsPopover.tsx — Popover de Ajustes (⚙)
// V8: Bioma Único da Ponte (Sem Reset) + Auto-Save IndexedDB/Cache + Extração para a Base
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { formatArmy } from '../../domain/notation'
import { buildScoreCacheFromSave } from '../../state/persistence'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'

export const SettingsPopover: React.FC = () => {
  const settingsPopoverOpen = useLogicBattleStore((s) => s.settingsPopoverOpen)
  const toggleSettingsPopover = useLogicBattleStore((s) => s.toggleSettingsPopover)
  const save = useLogicBattleStore((s) => s.save)
  const bridgeSectorIndex = useLogicBattleStore((s) => s.bridgeSectorIndex)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const recoveredFromBackup = useLogicBattleStore((s) => s.recoveredFromBackup)
  const toggleNotationMode = useLogicBattleStore((s) => s.toggleNotationMode)
  const toggleCalmMode = useLogicBattleStore((s) => s.toggleCalmMode)
  const toggleSimpleTapMode = useLogicBattleStore((s) => s.toggleSimpleTapMode)
  const toggleSound = useLogicBattleStore((s) => s.toggleSound)
  const toggleReducedMotion = useLogicBattleStore((s) => s.toggleReducedMotion)
  const extractRunToBase = useLogicBattleStore((s) => s.extractRunToBase)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)

  if (!settingsPopoverOpen) return null

  const scoreCache = buildScoreCacheFromSave(save)
  const notation = save.settings.notationMode
  const liveScore = Math.max(scoreCache.playerScore, save.reserveTroops + currentArmy)
  const highestSector = Math.max(scoreCache.highestSectorReached, bridgeSectorIndex)

  return (
    <div
      className="lb-settings-popover-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) toggleSettingsPopover(false)
      }}
    >
      <div className="lb-settings-popover" data-testid="lb-settings-popover">
        <div className="lb-settings-popover__header">
          <strong>⚙ Opções & Progresso Salvo</strong>
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

        <div
          className="lb-settings-popover__biomes"
          data-testid="lb-single-biome-persistence-panel"
        >
          <span
            className="lb-settings-popover__label"
            data-testid="lb-biome-btn-planicie_pedra"
          >
            🌉 Bioma Único da Ponte: <strong>Planície de Pedra (Progresso Contínuo)</strong>
          </span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '6px',
              padding: '8px 10px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>💾 Auto-Save (IndexedDB + Cache):</span>
              <strong style={{ color: '#34d399' }}>ATIVO</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🏆 Pontuação Salva no Cache:</span>
              <strong
                data-testid="lb-cached-player-score"
                style={{ color: '#facc15' }}
              >
                {formatArmy(liveScore, notation)} pts
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>♾️ Setor Atual / Recorde:</span>
              <strong>
                S{bridgeSectorIndex} / S{highestSector}
              </strong>
            </div>
            <button
              type="button"
              data-testid="lb-settings-extract-base-btn"
              className="lb-settings-biome-pill is-active"
              style={{
                marginTop: '4px',
                width: '100%',
                padding: '8px 12px',
                fontWeight: 800,
                textAlign: 'center',
                cursor: 'pointer',
              }}
              onClick={() => {
                extractRunToBase()
              }}
            >
              🏰 Salvar & Voltar para a Base com Pontuação
            </button>
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

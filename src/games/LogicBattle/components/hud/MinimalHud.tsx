// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/MinimalHud.tsx — HUD Minimalista 3D (Mundo 1 & 2)
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BIOME_LIST } from '../../config/biomes'
import { formatArmy } from '../../domain/notation'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import { SettingsPopover } from './SettingsPopover'

export const MinimalHud: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const snapshot = useLogicBattleStore((s) => s.snapshot)
  const save = useLogicBattleStore((s) => s.save)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const tokensInRun = useLogicBattleStore((s) => s.tokensInRun)
  const recoveredFromBackup = useLogicBattleStore((s) => s.recoveredFromBackup)
  const switchWorld = useLogicBattleStore((s) => s.switchWorld)
  const togglePauseRun = useLogicBattleStore((s) => s.togglePauseRun)
  const toggleCalmMode = useLogicBattleStore((s) => s.toggleCalmMode)
  const toggleNotationMode = useLogicBattleStore((s) => s.toggleNotationMode)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)
  const toggleSettingsPopover = useLogicBattleStore((s) => s.toggleSettingsPopover)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)

  const unusedTokens = tokensInRun.filter((t) => !t.used).length
  const notation = save.settings.notationMode
  const isPaused = snapshot.phase === 'PAUSED'

  const primaryCount =
    world === 'run' ? snapshot.currentArmy : save.reserveTroops

  return (
    <>
      <header
        className={`lb-minimal-hud ${world === 'run' ? 'is-run-world' : 'is-realm-world'}`}
        data-testid="logic-battle-hud"
      >
        {/* Linha Principal 1:1 com mundo1_ponte_conceito.jpg: [←] ... [🛡️ 347] ... [🎟️ 1] [⚙️] */}
        <div className="lb-minimal-hud__main-row">
          <div className="lb-minimal-hud__left">
            {world === 'run' ? (
              <button
                type="button"
                className="lb-hud-3d-btn lb-hud-3d-btn--back"
                onClick={() => switchWorld('realm')}
                data-testid="lb-tab-world-realm"
                aria-label="Voltar ao Mapa do Reino"
                title="Mapa do Reino (Mundo 2)"
              >
                <span data-testid="lb-hud-back">←</span>
              </button>
            ) : (
              <button
                type="button"
                className="lb-hud-3d-btn lb-hud-3d-btn--back"
                onClick={() => switchWorld('run')}
                data-testid="lb-tab-world-run"
                aria-label="Ir para A Ponte"
                title="A Ponte (Mundo 1)"
              >
                <span>⚔</span>
              </button>
            )}
          </div>

          {/* Centro: Pílula Azul 3D do Exército [🛡️ 347] */}
          <div
            className="lb-hud-shield-pill"
            data-testid="lb-hud-army"
            title={world === 'run' ? 'Soldados na Ponte' : 'Tropas na Reserva do Reino'}
          >
            <span className="lb-hud-shield-pill__icon" aria-hidden="true">
              🛡️
            </span>
            <strong
              className="lb-hud-shield-pill__value"
              data-testid={world === 'run' ? 'lb-current-army-value' : 'lb-reserve-troops-value'}
            >
              {formatArmy(primaryCount, notation)}
            </strong>
          </div>

          {/* Direita: Pílula Dourada de Fichas [🎟️ 1] + Engrenagem [⚙️] */}
          <div className="lb-minimal-hud__right">
            {recoveredFromBackup && (
              <span
                className="lb-hud-backup-badge"
                data-testid="lb-backup-recovered-strip"
                title="Save recuperado do backup automático (.bak)"
              >
                🛡
              </span>
            )}

            <div
              className="lb-hud-ticket-pill"
              data-testid="lb-hud-tokens"
              title="Fichas de Resgate disponíveis"
            >
              <span className="lb-hud-ticket-pill__icon" aria-hidden="true">
                🎟️
              </span>
              <strong className="lb-hud-ticket-pill__value">{unusedTokens}</strong>
            </div>

            <button
              type="button"
              className="lb-hud-3d-btn lb-hud-3d-btn--gear"
              onClick={() => toggleSettingsPopover()}
              data-testid="lb-hud-settings"
              title="Configurações"
              aria-label="Configurações"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Micro-barra discreta de atalhos rápidos (sem overflow em 360px) */}
        <div className="lb-minimal-hud__sub-row">
          <div className="lb-hud-biome-dots" role="group" aria-label="Biomas">
            {BIOME_LIST.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`lb-hud-biome-dot ${runPlan.biomeId === b.id ? 'is-active' : ''}`}
                onClick={() => startNewRun({ biomeId: b.id })}
                data-testid={`lb-biome-btn-${b.id}`}
                title={`${b.name} (${b.laneCount} faixas)`}
                aria-label={b.name}
              >
                {b.order}
              </button>
            ))}
          </div>

          <div className="lb-hud-quick-pills">
            {world === 'run' && (
              <button
                type="button"
                className={`lb-hud-mini-icon-btn ${isPaused ? 'is-active' : ''}`}
                onClick={togglePauseRun}
                data-testid="lb-toggle-pause"
                title={isPaused ? 'Retomar Corrida' : 'Pausar Corrida'}
                aria-label={isPaused ? 'Retomar' : 'Pausar'}
              >
                {isPaused ? '▶ Retomar' : '⏸'}
              </button>
            )}

            <button
              type="button"
              className={`lb-hud-mini-icon-btn ${save.settings.calmMode ? 'is-active' : ''}`}
              onClick={toggleCalmMode}
              data-testid="lb-toggle-calm"
              title="Modo Calmo (para antes de cada portão)"
              aria-label="Modo Calmo"
            >
              {save.settings.calmMode ? '🐢 ON' : '🐢'}
            </button>

            <button
              type="button"
              className={`lb-hud-mini-icon-btn ${notation === 'scientific' ? 'is-active' : ''}`}
              onClick={toggleNotationMode}
              data-testid="lb-toggle-notation"
              title="Alternar Notação (1,2k / ×10ⁿ)"
              aria-label="Alternar Notação"
            >
              {notation === 'scientific' ? '10ⁿ' : '1k'}
            </button>

            <button
              type="button"
              className="lb-hud-mini-icon-btn"
              onClick={() => openAlbumDrawer(true)}
              data-testid="lb-open-album"
              title="Álbum de Pegadinhas & Gêmeos"
              aria-label="Álbum"
            >
              📖
            </button>
          </div>
        </div>
      </header>
      <SettingsPopover />
    </>
  )
}

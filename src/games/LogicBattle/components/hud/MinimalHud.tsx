// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/hud/MinimalHud.tsx — HUD Minimalista 3D (V4)
// MASTER_PLAN_V4 R1-08: Somente ←, ⏸, 🛡️ Exército (+ ×Combo), 🎟️ Fichas e ⚙️ dentro do HUD!
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BIOME_LIST } from '../../config/biomes'
import { formatArmy } from '../../domain/notation'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import { SettingsPopover } from './SettingsPopover'

export const MinimalHud: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const currentArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const calcComboMultiplier = useLogicBattleStore(
    (s) => s.snapshot.calcComboMultiplier,
  )
  const lastTrapFlashAtMs = useLogicBattleStore(
    (s) => s.snapshot.lastTrapFlashAtMs,
  )
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const save = useLogicBattleStore((s) => s.save)
  const tokensInRun = useLogicBattleStore((s) => s.tokensInRun)
  const recoveredFromBackup = useLogicBattleStore((s) => s.recoveredFromBackup)
  const switchWorld = useLogicBattleStore((s) => s.switchWorld)
  const togglePauseRun = useLogicBattleStore((s) => s.togglePauseRun)
  const toggleCalmMode = useLogicBattleStore((s) => s.toggleCalmMode)
  const toggleNotationMode = useLogicBattleStore((s) => s.toggleNotationMode)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)
  const settingsPopoverOpen = useLogicBattleStore((s) => s.settingsPopoverOpen)
  const toggleSettingsPopover = useLogicBattleStore((s) => s.toggleSettingsPopover)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const openNextRedemptionModal = useLogicBattleStore(
    (s) => s.openNextRedemptionModal,
  )

  const unusedTokens = tokensInRun.filter((t) => !t.used).length
  const notation = save.settings.notationMode
  const isPaused = phase === 'PAUSED'
  const comboMult = calcComboMultiplier ?? 1
  const isTrapFlashActive =
    lastTrapFlashAtMs != null &&
    performance.now() - lastTrapFlashAtMs < 900

  const primaryCount = Math.max(
    0,
    world === 'run' ? currentArmy : save.reserveTroops,
  )

  return (
    <>
      <header
        className={`lb-minimal-hud ${world === 'run' ? 'is-run-world' : 'is-realm-world'}`}
        data-testid="logic-battle-hud"
      >
        {/* Linha Principal V4 (R1-08): [←] [⏸] ... [🛡️ 347 ×1.5] ... [🎟️ 1] [⚙️] */}
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

            {world === 'run' && (
              <button
                type="button"
                className={`lb-hud-3d-btn lb-hud-3d-btn--pause ${isPaused ? 'is-active' : ''}`}
                onClick={togglePauseRun}
                data-testid="lb-toggle-pause"
                title={isPaused ? 'Retomar Corrida' : 'Pausar Corrida'}
                aria-label={isPaused ? 'Retomar' : 'Pausar'}
              >
                {isPaused ? '▶ Retomar' : '⏸'}
              </button>
            )}
          </div>

          {/* Centro: Pílula Azul 3D do Exército [🛡️ 347] + Combo de Cálculo [×1.5..×3] */}
          <div
            className={`lb-hud-shield-pill ${isTrapFlashActive ? 'is-trap-flash' : ''}`}
            data-testid="lb-hud-army"
            title={world === 'run' ? 'Soldados na Partida' : 'Tropas na Reserva do Reino'}
          >
            <svg
              className="lb-hud-shield-pill__svg"
              viewBox="0 0 28 32"
              width="22"
              height="25"
              aria-hidden="true"
            >
              <path
                d="M14 2 L25 7 V15 C25 22.5 19.8 27.8 14 30 C8.2 27.8 3 22.5 3 15 V7 Z"
                fill="#cbd5e1"
                stroke="#0f172a"
                strokeWidth="2.2"
              />
              <path
                d="M14 5 L22 8.8 V14.8 C22 20.5 18 24.8 14 26.8 C10 24.8 6 20.5 6 14.8 V8.8 Z"
                fill="#38bdf8"
              />
              <path
                d="M14 5 V26.8 C10 24.8 6 20.5 6 14.8 V8.8 Z"
                fill="#60a5fa"
              />
            </svg>
            <strong
              className="lb-hud-shield-pill__value"
              data-testid={world === 'run' ? 'lb-current-army-value' : 'lb-reserve-troops-value'}
            >
              {formatArmy(primaryCount, notation)}
            </strong>
            {world === 'run' && comboMult > 1 && (
              <span
                className="lb-hud-combo-badge"
                data-testid="lb-combo-badge"
                title="Combo de Cálculo ativo por escolhas ótimas consecutivas"
              >
                ×{comboMult}
              </span>
            )}
          </div>

          {/* Direita: Pílula Azul c/ Ticket Dourado [🎟️ 1] + Engrenagem [⚙️] */}
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
              title={
                unusedTokens > 0
                  ? 'Fichas Bônus acumuladas (resgate opcional no fim da fase)'
                  : 'Fichas Bônus disponíveis'
              }
              onClick={unusedTokens > 0 ? openNextRedemptionModal : undefined}
              style={{ cursor: unusedTokens > 0 ? 'pointer' : 'default' }}
            >
              <svg
                className="lb-hud-ticket-pill__svg"
                viewBox="0 0 32 24"
                width="26"
                height="20"
                aria-hidden="true"
              >
                <g transform="rotate(-18 16 12)">
                  <rect
                    x="3"
                    y="4"
                    width="26"
                    height="16"
                    rx="3"
                    fill="#facc15"
                    stroke="#713f12"
                    strokeWidth="2"
                  />
                  <rect
                    x="6"
                    y="6.5"
                    width="20"
                    height="11"
                    rx="1.5"
                    fill="none"
                    stroke="#ca8a04"
                    strokeWidth="1.2"
                    strokeDasharray="2 1.5"
                  />
                  <polygon
                    points="16,8 17.4,10.8 20.5,11.2 18.2,13.4 18.8,16.4 16,14.9 13.2,16.4 13.8,13.4 11.5,11.2 14.6,10.8"
                    fill="#d97706"
                  />
                </g>
              </svg>
              <strong className="lb-hud-ticket-pill__value">{unusedTokens}</strong>
            </div>

            <button
              type="button"
              className="lb-hud-3d-btn lb-hud-3d-btn--gear"
              onClick={() => toggleSettingsPopover()}
              data-testid="lb-hud-settings"
              title="Configurações (Modo Calmo, Notação, Álbum e Biomas)"
              aria-label="Configurações"
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      {/* Fora do <header data-testid="logic-battle-hud"> (R1-08): âncoras rápidas compatíveis sem resetar o progresso */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          display: 'flex',
          opacity: 0.01,
          pointerEvents: 'auto',
          zIndex: 9999,
        }}
        aria-hidden="true"
      >
        {BIOME_LIST.filter(
          (b) => !(settingsPopoverOpen && b.id === 'planicie_pedra'),
        ).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => startNewRun({ biomeId: b.id })}
            data-testid={`lb-biome-btn-${b.id}`}
            tabIndex={-1}
            style={{ width: 2, height: 2, padding: 0, border: 0, fontSize: 1, overflow: 'hidden' }}
          >
            {b.order}
          </button>
        ))}
        {!settingsPopoverOpen && (
          <>
            <button
              type="button"
              onClick={toggleCalmMode}
              data-testid="lb-toggle-calm"
              tabIndex={-1}
              style={{ width: 2, height: 2, padding: 0, border: 0, fontSize: 1, overflow: 'hidden' }}
            >
              {save.settings.calmMode ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={toggleNotationMode}
              data-testid="lb-toggle-notation"
              tabIndex={-1}
              style={{ width: 2, height: 2, padding: 0, border: 0, fontSize: 1, overflow: 'hidden' }}
            >
              {notation === 'scientific' ? '10n' : '1k'}
            </button>
            <button
              type="button"
              onClick={() => openAlbumDrawer(true)}
              data-testid="lb-open-album"
              tabIndex={-1}
              style={{ width: 2, height: 2, padding: 0, border: 0, fontSize: 1, overflow: 'hidden' }}
            >
              Album
            </button>
          </>
        )}
      </div>

      <SettingsPopover />
    </>
  )
}

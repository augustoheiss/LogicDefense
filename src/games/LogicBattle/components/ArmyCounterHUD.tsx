// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/ArmyCounterHUD.tsx — HUD de Notação & Pelotões
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BIOMES, BIOME_LIST } from '../config/biomes'
import { REGIONS } from '../config/regions'
import { decomposeTiers, formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const ArmyCounterHUD: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const save = useLogicBattleStore((s) => s.save)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const snapshot = useLogicBattleStore((s) => s.snapshot)
  const tokensInRun = useLogicBattleStore((s) => s.tokensInRun)
  const debugMode = useLogicBattleStore((s) => s.debugMode)
  const oracle = useLogicBattleStore((s) => s.oracle)

  const switchWorld = useLogicBattleStore((s) => s.switchWorld)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)
  const togglePauseRun = useLogicBattleStore((s) => s.togglePauseRun)
  const toggleNotationMode = useLogicBattleStore((s) => s.toggleNotationMode)
  const toggleCalmMode = useLogicBattleStore((s) => s.toggleCalmMode)
  const toggleSound = useLogicBattleStore((s) => s.toggleSound)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)
  const recoveredFromBackup = useLogicBattleStore((s) => s.recoveredFromBackup)

  const biome = BIOMES[runPlan.biomeId] ?? BIOMES.planicie_pedra
  const region = REGIONS[runPlan.regionId] ?? REGIONS.r01_ponte_aurora
  const decomposed = decomposeTiers(snapshot.currentArmy, 24)
  const unredeemedTokens = tokensInRun.filter((t) => !t.used)

  const tamedTotal = Object.values(save.album).filter((a) => a.tamedCount > 0).length

  return (
    <header className="lb-hud-header" data-testid="logic-battle-hud">
      {/* Linha 1: Comutador Mundo 1 (A Ponte) <-> Mundo 2 (O Reino) + Álbum + Ajustes */}
      <div className="lb-hud-top-row">
        <div className="lb-world-tabs" role="tablist" aria-label="Alternar entre Mundo 1 e Mundo 2">
          <button
            type="button"
            role="tab"
            aria-selected={world === 'run'}
            data-testid="lb-tab-world-run"
            className={`lb-world-tab ${world === 'run' ? 'is-active' : ''}`}
            onClick={() => switchWorld('run')}
          >
            🌉 Mundo 1 · A Ponte
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={world === 'realm'}
            data-testid="lb-tab-world-realm"
            className={`lb-world-tab ${world === 'realm' ? 'is-active' : ''}`}
            onClick={() => switchWorld('realm')}
          >
            🏰 Mundo 2 · O Reino ({save.conqueredRegionIds.length}/12)
          </button>
        </div>

        <div className="lb-hud-actions">
          <button
            type="button"
            data-testid="lb-toggle-notation"
            className="lb-chip-btn"
            onClick={toggleNotationMode}
            title="Alternar entre Notação Compacta (1,2k) e Notação Científica (1,2 × 10³)"
          >
            🔢 {save.settings.notationMode === 'compact' ? '1,2k' : '10ⁿ'}
          </button>

          {world === 'run' &&
            (snapshot.phase === 'RUNNING' ||
              snapshot.phase === 'CALM_WAIT' ||
              snapshot.phase === 'PAUSED') && (
              <button
                type="button"
                data-testid="lb-toggle-pause"
                className={`lb-chip-btn ${snapshot.phase === 'PAUSED' ? 'is-on' : ''}`}
                onClick={togglePauseRun}
                title="Pausar ou retomar a marcha na ponte"
              >
                {snapshot.phase === 'PAUSED' ? '▶ Retomar' : '⏸ Pausar'}
              </button>
            )}

          <button
            type="button"
            data-testid="lb-toggle-calm"
            className={`lb-chip-btn ${save.settings.calmMode ? 'is-on' : ''}`}
            onClick={toggleCalmMode}
            title="Modo Calmo: os portões aguardam sua decisão sem pressa"
          >
            🧘 {save.settings.calmMode ? 'Modo Calmo: ON' : 'Modo Calmo'}
          </button>

          <button
            type="button"
            data-testid="lb-toggle-sound"
            className="lb-chip-btn"
            onClick={toggleSound}
            aria-label={save.settings.soundEnabled ? 'Desativar som' : 'Ativar som'}
          >
            {save.settings.soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            type="button"
            data-testid="lb-open-album"
            className="lb-chip-btn lb-album-btn"
            onClick={() => openAlbumDrawer(true)}
          >
            📖 Álbum ({tamedTotal}/20)
          </button>
        </div>
      </div>

      {/* Linha 2: Seletor Rápido de Bioma + Métricas Vivas do Exército */}
      <div className="lb-hud-metrics-row">
        <div className="lb-army-card" data-testid="lb-army-counter">
          <span className="lb-metric-label">SEU EXÉRCITO (N)</span>
          <strong className="lb-metric-value" data-testid="lb-current-army-value">
            {formatArmy(snapshot.currentArmy, save.settings.notationMode)}
          </strong>
          <span className="lb-metric-sub">
            {save.settings.notationMode === 'compact'
              ? formatArmy(snapshot.currentArmy, 'scientific')
              : `${snapshot.currentArmy.toLocaleString('pt-BR')} soldados`}
          </span>
        </div>

        <div className="lb-tier-breakdown" data-testid="lb-tier-breakdown">
          <span className="lb-metric-label">PELOTÕES POSICIONAIS (BASE 10)</span>
          <div className="lb-tier-pills">
            {decomposed.map(({ tier, count }) => (
              <span
                key={tier.tierIndex}
                className="lb-tier-pill"
                style={{ borderColor: tier.primaryColor }}
                title={`${tier.unitName}: ${tier.etymologyPt}`}
              >
                <strong>{count}×</strong> [{tier.denominationLabel}] {tier.unitName}
              </span>
            ))}
          </div>
        </div>

        <div className="lb-enemy-card" data-testid="lb-enemy-counter">
          <span className="lb-metric-label">GUARNIÇÃO + CHEFE ({region.name})</span>
          <strong className="lb-metric-value lb-enemy-val">
            ⚔ {formatArmy(snapshot.enemy.totalForce, save.settings.notationMode)}
          </strong>
          <span className="lb-metric-sub">
            Reserva do Reino: {formatArmy(save.reserveTroops, save.settings.notationMode)} · ★{' '}
            {save.wisdomStars}
          </span>
        </div>
      </div>

      {/* Linha 3: Seletor de Bioma & Fichas de Resgate Ativas */}
      <div className="lb-hud-sub-row">
        <div className="lb-biome-pills" role="group" aria-label="Biomas Matemáticos">
          {BIOME_LIST.map((b) => (
            <button
              key={b.id}
              type="button"
              data-testid={`lb-biome-btn-${b.id}`}
              className={`lb-biome-pill ${biome.id === b.id ? 'is-current' : ''}`}
              onClick={() => startNewRun({ biomeId: b.id })}
            >
              {b.order}. {b.name}
            </button>
          ))}
        </div>

        {unredeemedTokens.length > 0 && (
          <button
            type="button"
            data-testid="lb-hud-redeem-token-btn"
            className="lb-token-badge-btn"
            onClick={() => {
              useLogicBattleStore.setState({
                activeRedemptionTokenId: unredeemedTokens[0].id,
                snapshot: {
                  ...snapshot,
                  phase: 'REDEMPTION_CHALLENGE',
                },
              })
            }}
          >
            ★ {unredeemedTokens.length} Ficha(s) de Resgate Pronta(s)
          </button>
        )}
      </div>

      {recoveredFromBackup && (
        <div className="lb-backup-recovered-strip" data-testid="lb-backup-recovered-strip">
          🛡️ Save restaurado automaticamente a partir do slot de segurança (.bak).
        </div>
      )}

      {debugMode && (
        <div className="lb-debug-strip" data-testid="lb-debug-strip">
          <span>SEED: {runPlan.seed}</span>
          <span>ORACLE BEST: {oracle.best}</span>
          <span>ORACLE WORST: {oracle.worst}</span>
          <span>ENEMY: {runPlan.enemy.totalForce}</span>
          <span>PROGRESS: {(snapshot.progress * 100).toFixed(0)}%</span>
        </div>
      )}
    </header>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/LogicBattleGame.tsx — Orquestrador Full-Screen (Mundo 1, 6 Engines & Mundo 2)
// MASTER_PLAN_V4: Rota dedicada para SerpentCanvas (Labirinto Toroidal 48×48) + ArcadeEnginesCanvas
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BattleOverlay } from './components/BattleOverlay'
import { CaptainVirgula } from './components/CaptainVirgula'
import { CodexDrawer } from './components/CodexDrawer'
import { BottomSheet } from './components/hud/BottomSheet'
import { MinimalHud } from './components/hud/MinimalHud'
import { MathChallengeModal } from './components/MathChallengeModal'
import { RedemptionChallengeModal } from './components/RedemptionChallengeModal'
import { TrapAlbumDrawer } from './components/TrapAlbumDrawer'
import { TrapAlertOverlay } from './components/TrapAlertOverlay'
import { REGIONS } from './config/regions'
import { ArcadeEnginesCanvas } from './engines/ArcadeEnginesCanvas'
import { ENGINE_CATALOG } from './engines/engineContract'
import { SerpentCanvas } from './engines/serpent/SerpentCanvas'
import './logic-battle.css'
import { CitadelPanel } from './realm/CitadelPanel'
import { RealmMap } from './realm/RealmMap'
import { RegionPanel } from './realm/RegionPanel'
import { RunCanvas } from './run/RunCanvas'
import { useLogicBattleStore } from './state/useLogicBattleStore'

export const LogicBattleGame: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const debugMode = useLogicBattleStore((s) => s.debugMode)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const oracle = useLogicBattleStore((s) => s.oracle)
  const debugProgress = useLogicBattleStore((s) =>
    s.debugMode ? Math.round(s.snapshot.progress * 100) : 0,
  )
  const selectedRegionId = useLogicBattleStore((s) => s.save.selectedRegionId)
  const activeRealmSheet = useLogicBattleStore((s) => s.activeRealmSheet)
  const setActiveRealmSheet = useLogicBattleStore((s) => s.setActiveRealmSheet)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)
  const startNewRun = useLogicBattleStore((s) => s.startNewRun)

  const selectedRegion =
    REGIONS[selectedRegionId] ?? REGIONS.r01_ponte_aurora
  const activeEngineMeta =
    ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.ponte_portoes

  return (
    <div className="lb-game-shell" data-testid="logic-battle-game">
      <MinimalHud />
      <CaptainVirgula />

      {debugMode && (
        <div className="lb-debug-strip" data-testid="lb-debug-strip">
          <span>SEED: {runPlan.seed}</span>
          <span>ORACLE BEST: {oracle.best}</span>
          <span>ORACLE WORST: {oracle.worst}</span>
          <span>ENEMY: {runPlan.enemy.totalForce}</span>
          <span>PROGRESS: {debugProgress}%</span>
        </div>
      )}

      {world === 'run' ? (
        activeEngineId === 'ponte_portoes' ? (
          <RunCanvas />
        ) : activeEngineId === 'serpente_numeros' ? (
          <SerpentCanvas />
        ) : (
          <ArcadeEnginesCanvas />
        )
      ) : (
        <div className="lb-realm-workspace" data-testid="logic-battle-realm-stage">
          <RealmMap />

          {/* Barra Inferior 3D do Reino (idêntica a mundo2_reino_conceito.jpg: [🗺️] [🏰] [📖] + [Atacar ▶]) */}
          <footer className="lb-realm-bottom-dock" data-testid="lb-realm-bottom-dock">
            <div className="lb-realm-bottom-dock__icons">
              <button
                type="button"
                className={`lb-dock-square-btn ${activeRealmSheet === 'region' ? 'is-active' : ''}`}
                onClick={() =>
                  setActiveRealmSheet(activeRealmSheet === 'region' ? 'none' : 'region')
                }
                data-testid="lb-dock-region-btn"
                title={`Província Selecionada: ${selectedRegion.name}`}
                aria-label="Detalhes da Província"
              >
                🗺️
              </button>

              <button
                type="button"
                className={`lb-dock-square-btn ${activeRealmSheet === 'citadel' ? 'is-active' : ''}`}
                onClick={() =>
                  setActiveRealmSheet(activeRealmSheet === 'citadel' ? 'none' : 'citadel')
                }
                data-testid="lb-dock-citadel-btn"
                title="Construções da Cidadela & Cofre da Mina"
                aria-label="Cidadela"
              >
                🏰
              </button>

              <button
                type="button"
                className="lb-dock-square-btn"
                onClick={() => openAlbumDrawer(true)}
                data-testid="lb-dock-album-btn"
                title="Álbum de Pegadinhas & Códice"
                aria-label="Álbum e Códice"
              >
                📖
              </button>
            </div>

            <button
              type="button"
              className="lb-realm-attack-cta"
              data-testid="lb-realm-attack-cta"
              onClick={() => startNewRun({ regionId: selectedRegion.id })}
              title={`Iniciar ${activeEngineMeta.name} em ${selectedRegion.name}`}
            >
              <span>Atacar</span>
              <span className="lb-realm-attack-cta__arrow">▶</span>
            </button>
          </footer>

          <BottomSheet
            open={activeRealmSheet === 'region'}
            onClose={() => setActiveRealmSheet('none')}
            title={`🗺️ ${selectedRegion.name}`}
            testId="lb-region-bottom-sheet"
          >
            <RegionPanel />
          </BottomSheet>

          <BottomSheet
            open={activeRealmSheet === 'citadel'}
            onClose={() => setActiveRealmSheet('none')}
            title="🏰 Cidadela & Mina do Resto"
            testId="lb-citadel-bottom-sheet"
          >
            <CitadelPanel />
          </BottomSheet>
        </div>
      )}

      {/* Overlays e Gavetas Socráticas */}
      <TrapAlertOverlay />
      <RedemptionChallengeModal />
      <MathChallengeModal />
      <BattleOverlay />
      <TrapAlbumDrawer />
      <CodexDrawer />
    </div>
  )
}

export default LogicBattleGame

// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/LogicBattleGame.tsx — Orquestrador Principal do Jogo
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { ArmyCounterHUD } from './components/ArmyCounterHUD'
import { BattleOverlay } from './components/BattleOverlay'
import { CaptainVirgula } from './components/CaptainVirgula'
import { CodexDrawer } from './components/CodexDrawer'
import { RedemptionChallengeModal } from './components/RedemptionChallengeModal'
import { TrapAlbumDrawer } from './components/TrapAlbumDrawer'
import { TrapAlertOverlay } from './components/TrapAlertOverlay'
import './logic-battle.css'
import { CitadelPanel } from './realm/CitadelPanel'
import { RealmMap } from './realm/RealmMap'
import { RegionPanel } from './realm/RegionPanel'
import { RunCanvas } from './run/RunCanvas'
import { useLogicBattleStore } from './state/useLogicBattleStore'

export const LogicBattleGame: React.FC = () => {
  const world = useLogicBattleStore((s) => s.world)

  return (
    <div className="lb-game-shell" data-testid="logic-battle-game">
      <ArmyCounterHUD />
      <CaptainVirgula />

      {world === 'run' ? (
        <RunCanvas />
      ) : (
        <div className="lb-realm-workspace" data-testid="logic-battle-realm-stage">
          <div className="lb-realm-top-split">
            <RealmMap />
            <RegionPanel />
          </div>
          <CitadelPanel />
        </div>
      )}

      {/* Overlays e Gavetas Socráticas */}
      <TrapAlertOverlay />
      <RedemptionChallengeModal />
      <BattleOverlay />
      <TrapAlbumDrawer />
      <CodexDrawer />
    </div>
  )
}

export default LogicBattleGame

// ──────────────────────────────────────────────────────────────────────────────
// src/pages/LogicBattlePage.tsx — Página Full-Screen (100dvh) do Logic Battle
// Decisão D-V2-3: Sem blocos de marketing; foco 100% na experiência de jogo!
// ──────────────────────────────────────────────────────────────────────────────
import { LogicBattleGame } from '../games/LogicBattle/LogicBattleGame'

export function LogicBattlePage() {
  return (
    <main className="lb-page-fullscreen" id="logic-battle-arena">
      <h1 className="sr-only">
        Logic Battle · A Ponte dos Portões & O Reino
      </h1>
      <LogicBattleGame />
    </main>
  )
}

export default LogicBattlePage

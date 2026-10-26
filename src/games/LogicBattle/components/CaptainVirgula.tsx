// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/CaptainVirgula.tsx — Coach Marks Visuais sob Demanda
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const CaptainVirgula: React.FC = () => {
  const dismissCoachMarks = useLogicBattleStore((s) => s.dismissCoachMarks)
  const [openHelp, setOpenHelp] = useState(false)

  if (!openHelp) {
    return null
  }

  return (
    <div
      className="lb-coach-overlay"
      data-testid="lb-captain-virgula"
      onClick={() => {
        setOpenHelp(false)
        dismissCoachMarks()
      }}
    >
      <div className="lb-coach-card">
        <strong>🧭 Guia Rápido</strong>
        <div className="lb-coach-steps">
          <span>1. ↔ Arraste para escolher o portão</span>
          <span>2. ⚠ Pegadinha dá 🎟️ Ficha de Resgate</span>
          <span>3. 🏰 Supere a força do Chefe!</span>
        </div>
      </div>
    </div>
  )
}

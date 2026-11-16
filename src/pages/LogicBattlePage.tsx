// ──────────────────────────────────────────────────────────────────────────────
// src/pages/LogicBattlePage.tsx — Página Full-Screen (100dvh) do Logic Battle
// Decisão D-V2-3: Sem blocos de marketing; aviso claro de Em Construção no topo.
// ──────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
import { IlhaRua } from '../games/LogicBattle/ilha/IlhaRua'

export function LogicBattlePage() {
  return (
    <main className="lb-page-fullscreen" id="logic-battle-arena">
      <h1 className="sr-only">A rua da Ponte · Logic Battle (Em Construção)</h1>
      <header className="lb-wip-banner" role="status">
        <div className="lb-wip-banner__info">
          <span className="lb-wip-banner__badge">🚧 Em Construção</span>
          <span className="lb-wip-banner__text">
            Protótipo 3D jogável em desenvolvimento — alguns recursos ainda estão sendo finalizados.
          </span>
        </div>
        <Link to="/jogos" className="lb-wip-banner__back">
          ← Voltar aos Jogos
        </Link>
      </header>
      <IlhaRua />
    </main>
  )
}

export default LogicBattlePage

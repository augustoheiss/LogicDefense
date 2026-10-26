// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/TrapAlbumDrawer.tsx — Álbum de Pegadinhas Domadas
// Exibe as 20 Pegadinhas (T01..T20) e 6 Gêmeos (G01..G06) com link direto ao Códice
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { ALL_TRAP_LIST, ALL_TWIN_LIST } from '../config/trapCatalog'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const TrapAlbumDrawer: React.FC = () => {
  const isOpen = useLogicBattleStore((s) => s.albumDrawerOpen)
  const album = useLogicBattleStore((s) => s.save.album)
  const twinsDiscovered = useLogicBattleStore((s) => s.save.twinsDiscovered)
  const openAlbumDrawer = useLogicBattleStore((s) => s.openAlbumDrawer)
  const openCodexForSlug = useLogicBattleStore((s) => s.openCodexForSlug)

  const [activeTab, setActiveTab] = useState<'traps' | 'twins'>('traps')

  if (!isOpen) return null

  const tamedCount = ALL_TRAP_LIST.filter(
    (t) => (album[t.id]?.tamedCount ?? 0) > 0,
  ).length

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-album-title"
      data-testid="lb-trap-album-drawer"
    >
      <div className="lb-drawer-card">
        <div className="lb-drawer-header">
          <div>
            <span className="lb-badge-token">COLEÇÃO METACOGNITIVA HEISS-LAB</span>
            <h3 id="lb-album-title" className="lb-modal-title">
              📖 Álbum de Pegadinhas Domadas ({tamedCount}/20) & Gêmeos ({twinsDiscovered.length}/6)
            </h3>
          </div>
          <button
            type="button"
            data-testid="lb-close-album-btn"
            className="lb-close-icon-btn"
            onClick={() => openAlbumDrawer(false)}
            aria-label="Fechar Álbum"
          >
            ✕
          </button>
        </div>

        <div className="lb-album-tabs">
          <button
            type="button"
            data-testid="lb-album-tab-traps"
            className={`lb-world-tab ${activeTab === 'traps' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('traps')}
          >
            ⚡ 20 Pegadinhas da Intuição
          </button>
          <button
            type="button"
            data-testid="lb-album-tab-twins"
            className={`lb-world-tab ${activeTab === 'twins' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('twins')}
          >
            🪞 6 Portões Gêmeos (Equivalências)
          </button>
        </div>

        <div className="lb-album-scroll">
          {activeTab === 'traps' ? (
            <div className="lb-album-grid" data-testid="lb-album-traps-grid">
              {ALL_TRAP_LIST.map((trap) => {
                const rec = album[trap.id] ?? {
                  trapId: trap.id,
                  encounteredCount: 0,
                  tamedCount: 0,
                }
                const isTamed = rec.tamedCount > 0

                return (
                  <article
                    key={trap.id}
                    data-testid={`lb-album-card-${trap.id}`}
                    className={`lb-album-item ${isTamed ? 'is-tamed' : ''}`}
                  >
                    <div className="lb-album-item-top">
                      <span className="lb-trap-code">{trap.id}</span>
                      <span className={`lb-trap-status ${isTamed ? 'tamed' : ''}`}>
                        {isTamed
                          ? `★ Domada (${rec.tamedCount}×)`
                          : rec.encounteredCount > 0
                            ? `Vista (${rec.encounteredCount}×)`
                            : 'Descoberta Aberta'}
                      </span>
                    </div>
                    <h4>{trap.name}</h4>
                    <div className="lb-album-gates-pill">{trap.summaryGatesPt}</div>
                    <p className="lb-album-example">{trap.verifiedExamplePt}</p>
                    <p className="lb-album-luz">💡 {trap.luzGuiaPt}</p>
                    <button
                      type="button"
                      data-testid={`lb-album-codex-btn-${trap.id}`}
                      className="lb-btn-ghost lb-btn-sm"
                      onClick={() => openCodexForSlug(trap.codexSlug)}
                    >
                      📚 Abrir Aula ({trap.codexSlug})
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="lb-album-grid" data-testid="lb-album-twins-grid">
              {ALL_TWIN_LIST.map((twin) => {
                const found = twinsDiscovered.includes(twin.id)
                return (
                  <article
                    key={twin.id}
                    data-testid={`lb-album-twin-${twin.id}`}
                    className={`lb-album-item ${found ? 'is-tamed' : ''}`}
                  >
                    <div className="lb-album-item-top">
                      <span className="lb-trap-code">{twin.id}</span>
                      <span className={`lb-trap-status ${found ? 'tamed' : ''}`}>
                        {found ? '★ Equivalência Descoberta' : 'Par Gêmeo'}
                      </span>
                    </div>
                    <h4>{twin.name}</h4>
                    <div className="lb-album-gates-pill">{twin.equivalencePt}</div>
                    <button
                      type="button"
                      className="lb-btn-ghost lb-btn-sm"
                      onClick={() => openCodexForSlug(twin.codexSlug)}
                    >
                      📚 Abrir Aula ({twin.codexSlug})
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

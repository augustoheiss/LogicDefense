// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/CodexDrawer.tsx — Gaveta do Códice Heiss-Lab
// Conecta cada pegadinha à apostila real verificada em src/data/content.ts
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { Link } from 'react-router-dom'
import { lessonPlans } from '../../../data/content'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const CodexDrawer: React.FC = () => {
  const slug = useLogicBattleStore((s) => s.codexDrawerSlug)
  const openCodexForSlug = useLogicBattleStore((s) => s.openCodexForSlug)

  if (!slug) return null

  const lesson =
    lessonPlans.find((l) => l.slug === slug) ?? lessonPlans[0]

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-codex-title"
      data-testid="lb-codex-drawer"
    >
      <div className="lb-drawer-card lb-codex-card">
        <div className="lb-drawer-header">
          <div>
            <span className="lb-badge-token">
              CÓDICE HEISS-LAB · {lesson.subject.toUpperCase()} ({lesson.grade})
            </span>
            <h3 id="lb-codex-title" className="lb-modal-title">
              📚 {lesson.title}
            </h3>
          </div>
          <button
            type="button"
            data-testid="lb-close-codex-btn"
            className="lb-close-icon-btn"
            onClick={() => openCodexForSlug(null)}
            aria-label="Fechar Códice"
          >
            ✕
          </button>
        </div>

        <div className="lb-codex-body">
          <p className="lb-codex-desc">{lesson.description}</p>

          <div className="lb-codex-meta-row">
            <span>📄 {lesson.pages} páginas diagramadas em LaTeX</span>
            <span>🔓 Licença CC BY-NC-SA 4.0</span>
          </div>

          <div className="lb-codex-actions">
            <Link
              to={`/repositorio/${lesson.slug}`}
              className="lb-btn-primary"
              data-testid="lb-codex-full-page-link"
            >
              📖 Ler Aula Interativa Completa no Repositório
            </Link>

            {lesson.pdfPath && (
              <a
                href={lesson.pdfPath}
                target="_blank"
                rel="noopener noreferrer"
                className="lb-btn-secondary"
              >
                ⬇ Baixar Apostila em PDF
              </a>
            )}

            <button
              type="button"
              className="lb-btn-ghost"
              onClick={() => openCodexForSlug(null)}
            >
              Voltar para a Partida
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

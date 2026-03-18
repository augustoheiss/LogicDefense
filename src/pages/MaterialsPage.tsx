import { useState } from 'react'
import { LessonSidebar } from '../components/lesson/LessonSidebar'
import { LessonContent } from '../components/lesson/LessonContent'
import { lessonPlans } from '../data/content'
import type { LessonPlan } from '../data/content'

export function MaterialsPage() {
  const [selected, setSelected] = useState<LessonPlan | null>(null)

  // Stats for the hero area
  const totalPages = lessonPlans.reduce((acc, p) => acc + p.pages, 0)
  const availableCount = lessonPlans.filter((p) => p.available).length

  return (
    <div className="repo-layout">
      {/* ── Hero strip ── */}
      <div className="repo-hero">
        <p className="repo-hero__eyebrow">Portal Educacional · Repositório</p>
        <h1 className="repo-hero__title">Repositório Didático</h1>
        <p className="repo-hero__sub">
          Planos de aula organizados em trilhas de aprendizagem. Leia online com equações
          matemáticas renderizadas, ou baixe o PDF para imprimir.
        </p>
        <div className="repo-hero__stats">
          <div className="repo-stat">
            <span className="repo-stat__value">{lessonPlans.length}</span>
            <span className="repo-stat__label">Aulas</span>
          </div>
          <div className="repo-stat">
            <span className="repo-stat__value">{availableCount}</span>
            <span className="repo-stat__label">Com PDF</span>
          </div>
          <div className="repo-stat">
            <span className="repo-stat__value">{totalPages}</span>
            <span className="repo-stat__label">Páginas</span>
          </div>
          <div className="repo-stat">
            <span className="repo-stat__value">LaTeX</span>
            <span className="repo-stat__label">Equações</span>
          </div>
        </div>
      </div>

      {/* ── Two-panel workspace ── */}
      <div className="repo-workspace">
        <LessonSidebar
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
        <main className="repo-main" id="main-content">
          <LessonContent lesson={selected} />
        </main>
      </div>
    </div>
  )
}

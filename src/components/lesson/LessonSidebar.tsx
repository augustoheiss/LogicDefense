import { useState } from 'react'
import { lessonCategories, lessonPlans } from '../../data/content'
import type { LessonPlan } from '../../data/content'

interface LessonSidebarProps {
  selectedId: string | null
  onSelect: (lesson: LessonPlan) => void
}

export function LessonSidebar({ selectedId, onSelect }: LessonSidebarProps) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    () => new Set([lessonCategories[0]?.id ?? ''])
  )

  function toggleCategory(catId: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) {
        next.delete(catId)
      } else {
        next.add(catId)
      }
      return next
    })
  }

  return (
    <aside className="lesson-sidebar" aria-label="Trilhas de aprendizagem">
      <div className="lesson-sidebar__header">
        <span className="lesson-sidebar__header-eyebrow">Repositório Didático</span>
        <h2 className="lesson-sidebar__header-title">Trilhas de Aprendizagem</h2>
      </div>

      <nav className="lesson-sidebar__nav">
        {lessonCategories.map((cat) => {
          const isOpen = openCategories.has(cat.id)
          const lessons = lessonPlans.filter((p) => cat.slugs.includes(p.slug))

          return (
            <div key={cat.id} className={`lesson-cat${isOpen ? ' lesson-cat--open' : ''}`}>
              <button
                className="lesson-cat__toggle"
                onClick={() => toggleCategory(cat.id)}
                aria-expanded={isOpen}
              >
                <span className="lesson-cat__icon" aria-hidden="true">{cat.icon}</span>
                <span className="lesson-cat__title">{cat.title}</span>
                <span className="lesson-cat__chevron" aria-hidden="true">
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {isOpen && (
                <div className="lesson-cat__desc">{cat.description}</div>
              )}

              <ul className="lesson-cat__list" role="list">
                {lessons.map((lesson) => {
                  const isSelected = lesson.id === selectedId
                  return (
                    <li key={lesson.id}>
                      <button
                        className={`lesson-cat__item${isSelected ? ' lesson-cat__item--active' : ''}`}
                        onClick={() => {
                          if (!isOpen) toggleCategory(cat.id)
                          onSelect(lesson)
                        }}
                        title={lesson.description}
                      >
                        <span className="lesson-cat__item-title">{lesson.title}</span>
                        <span className="lesson-cat__item-meta">{lesson.grade}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

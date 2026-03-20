import type { LessonPlan } from '../../data/content'
import type { Topic } from '../../data/topics'

interface LessonSidebarProps {
  topic: Topic
  selectedLessonId: string | null
  onSelectLesson: (lesson: LessonPlan) => void
  onBack: () => void
}

export function LessonSidebar({
  topic,
  selectedLessonId,
  onSelectLesson,
  onBack,
}: LessonSidebarProps) {
  const lessonCount = topic.items.filter((i) => i.type === 'lesson').length
  const videoCount  = topic.items.filter((i) => i.type === 'video').length

  return (
    <aside className="lesson-sidebar" aria-label="Materiais da trilha">

      {/* ── Back navigation ── */}
      <button className="lesson-sidebar__back" onClick={onBack} aria-label="Voltar para todas as trilhas">
        ‹ Todas as Trilhas
      </button>

      {/* ── Topic header ── */}
      <div className="lesson-sidebar__header">
        <span className="lesson-sidebar__header-eyebrow">
          {topic.icon} Trilha selecionada
        </span>
        <h2 className="lesson-sidebar__header-title">{topic.title}</h2>
        <p className="lesson-sidebar__header-count">
          {lessonCount > 0 && `${lessonCount} aula${lessonCount !== 1 ? 's' : ''}`}
          {lessonCount > 0 && videoCount > 0 && ' · '}
          {videoCount > 0 && `${videoCount} vídeo${videoCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Items list ── */}
      <nav className="lesson-sidebar__nav" aria-label="Materiais da trilha">
        <ul className="lesson-cat__list" role="list">
          {topic.items.map((item) => {
            if (item.type === 'video') {
              return (
                <li key={item.id}>
                  <a
                    href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lesson-cat__item lesson-cat__item--video"
                    title={item.description}
                  >
                    <span className="lesson-cat__item-title">{item.title}</span>
                    <span className="lesson-cat__item-meta lesson-cat__item-meta--video">
                      ▶ {item.meta} ↗
                    </span>
                  </a>
                </li>
              )
            }

            const isActive = item.lessonData?.id === selectedLessonId
            return (
              <li key={item.id}>
                <button
                  className={`lesson-cat__item${isActive ? ' lesson-cat__item--active' : ''}`}
                  onClick={() => item.lessonData && onSelectLesson(item.lessonData)}
                  title={item.description}
                >
                  <span className="lesson-cat__item-title">{item.title}</span>
                  <span className="lesson-cat__item-meta">{item.meta}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

    </aside>
  )
}

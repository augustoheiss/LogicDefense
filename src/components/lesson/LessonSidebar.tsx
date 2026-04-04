import type { TopicItem, Topic } from '../../data/topics'

interface LessonSidebarProps {
  topic: Topic
  selectedItemId: string | null
  onSelectItem: (item: TopicItem) => void
  onBack: () => void
}

export function LessonSidebar({
  topic,
  selectedItemId,
  onSelectItem,
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
            const isActive = item.id === selectedItemId

            if (item.type === 'video') {
              return (
                <li key={item.id}>
                  <button
                    className={`lesson-cat__item lesson-cat__item--video${isActive ? ' lesson-cat__item--active' : ''}`}
                    onClick={() => onSelectItem(item)}
                    title={item.description}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="lesson-cat__item-title">{item.title}</span>
                    <span className="lesson-cat__item-meta lesson-cat__item-meta--video">
                      ▶ {item.meta}
                    </span>
                  </button>
                </li>
              )
            }

            return (
              <li key={item.id}>
                <button
                  className={`lesson-cat__item${isActive ? ' lesson-cat__item--active' : ''}`}
                  onClick={() => onSelectItem(item)}
                  title={item.description}
                  aria-current={isActive ? 'true' : undefined}
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

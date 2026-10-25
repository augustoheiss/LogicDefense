import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { LessonSidebar } from '../components/lesson/LessonSidebar'
import { LessonContent } from '../components/lesson/LessonContent'
import { lessonPlans } from '../data/content'
import { TOPICS } from '../data/topics'
import type { Topic, TopicItem } from '../data/topics'

export function MaterialsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedItem, setSelectedItem]   = useState<TopicItem | null>(null)

  // ── Auto-select from URL query param ?v=vid-XX on first load ────────────
  useEffect(() => {
    const videoId = searchParams.get('v')
    if (!videoId) return

    // Search all topics for the item with this id
    for (const topic of TOPICS) {
      const item = topic.items.find((i) => i.id === videoId)
      if (item) {
        setSelectedTopic(topic)
        setSelectedItem(item)
        break
      }
    }

    // Clear the query param so the URL stays clean after auto-selection
    setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages      = lessonPlans.reduce((acc, p) => acc + p.pages, 0)
  const availableCount  = lessonPlans.filter((p) => p.available).length

  function handleTopicSelect(topic: Topic) {
    setSelectedTopic(topic)
    setSelectedItem(null)
  }

  function handleBack() {
    setSelectedTopic(null)
    setSelectedItem(null)
  }

  return (
    <div className="repo-layout">

      {/* ── Hero strip ── */}
      <div className="repo-hero">
        <p className="repo-hero__eyebrow">Portal Educacional · Repositório</p>
        <h1 className="repo-hero__title">Repositório Didático</h1>
        <p className="repo-hero__sub">
          {selectedTopic
            ? selectedTopic.description
            : 'Escolha uma trilha temática para explorar as aulas, exercícios e vídeos disponíveis.'}
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

      {/* ── MASTER VIEW: Topics grid + Direct Lesson Links Index ── */}
      {!selectedTopic && (
        <div className="repo-topics">
          <div className="repo-topics__grid">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                className={`topic-card topic-card--${topic.color}`}
                onClick={() => handleTopicSelect(topic)}
                aria-label={`Abrir trilha: ${topic.title}`}
              >
                <div className="topic-card__top">
                  <span className="topic-card__icon" aria-hidden="true">
                    {topic.icon}
                  </span>
                  {topic.isMock && (
                    <span className="topic-card__badge">Demo</span>
                  )}
                </div>

                <div className="topic-card__body">
                  <h2 className="topic-card__title">{topic.title}</h2>
                  <p className="topic-card__desc">{topic.description}</p>
                </div>

                <div className="topic-card__footer">
                  <span className="topic-card__count">
                    {topic.items.length} material{topic.items.length !== 1 ? 'is' : ''}
                  </span>
                  <span className="topic-card__arrow">Explorar →</span>
                </div>
              </button>
            ))}
          </div>

          {/* ── Índice Direto de Aulas & Apostilas (Links compartilháveis & SEO Deep-Links) ── */}
          <section
            aria-label="Índice direto de todas as aulas e apostilas"
            style={{
              marginTop: 48,
              paddingTop: 32,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8, color: 'var(--text, #f8fafc)' }}>
              📐 Índice Direto de Apostilas e Aulas (Links Compartilháveis)
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #94a3b8)', marginBottom: 20 }}>
              Cada aula possui uma página exclusiva com preview próprio e download em PDF:
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 12,
              }}
            >
              {lessonPlans.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/repositorio/${lesson.slug}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(56, 189, 248, 0.18)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.2s, transform 0.2s',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {lesson.grade} · {lesson.pages} págs
                    </span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '6px 0 4px', color: '#f8fafc' }}>
                      {lesson.title}
                    </h3>
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                    Abrir página da aula ↗
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── DETAIL VIEW: Sidebar + Content ── */}
      {selectedTopic && (
        <div className="repo-workspace">
          <LessonSidebar
            topic={selectedTopic}
            selectedItemId={selectedItem?.id ?? null}
            onSelectItem={setSelectedItem}
            onBack={handleBack}
          />
          <main className="repo-main" id="main-content">
            <LessonContent item={selectedItem} />
          </main>
        </div>
      )}

    </div>
  )
}

import { useState } from 'react'
import { LessonSidebar } from '../components/lesson/LessonSidebar'
import { LessonContent } from '../components/lesson/LessonContent'
import { lessonPlans } from '../data/content'
import { TOPICS } from '../data/topics'
import type { Topic } from '../data/topics'
import type { LessonPlan } from '../data/content'

export function MaterialsPage() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<LessonPlan | null>(null)

  const totalPages = lessonPlans.reduce((acc, p) => acc + p.pages, 0)
  const availableCount = lessonPlans.filter((p) => p.available).length

  function handleTopicSelect(topic: Topic) {
    setSelectedTopic(topic)
    setSelectedLesson(null)
  }

  function handleBack() {
    setSelectedTopic(null)
    setSelectedLesson(null)
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

      {/* ── MASTER VIEW: Topics grid ── */}
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
        </div>
      )}

      {/* ── DETAIL VIEW: Sidebar + Content ── */}
      {selectedTopic && (
        <div className="repo-workspace">
          <LessonSidebar
            topic={selectedTopic}
            selectedLessonId={selectedLesson?.id ?? null}
            onSelectLesson={setSelectedLesson}
            onBack={handleBack}
          />
          <main className="repo-main" id="main-content">
            <LessonContent lesson={selectedLesson} />
          </main>
        </div>
      )}

    </div>
  )
}

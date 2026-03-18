import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cleanRichContent } from '../../data/content'
import type { LessonPlan } from '../../data/content'

interface LessonContentProps {
  lesson: LessonPlan | null
}

export function LessonContent({ lesson }: LessonContentProps) {
  if (!lesson) {
    return (
      <div className="lesson-content lesson-content--empty">
        <div className="lesson-content__placeholder">
          <span className="lesson-content__placeholder-icon" aria-hidden="true">📖</span>
          <h2 className="lesson-content__placeholder-title">Selecione uma aula</h2>
          <p className="lesson-content__placeholder-desc">
            Escolha uma trilha e uma aula no menu ao lado para começar a leitura.
          </p>
        </div>
      </div>
    )
  }

  const SUBJECT_ICONS: Record<string, string> = {
    'Matemática': '📐',
    'Tecnologia & Pedagogia': '🤖',
    'Matemática + Lógica': '🧩',
    'Tecnologia': '💡',
  }
  const icon = SUBJECT_ICONS[lesson.subject] ?? '📄'
  const cleanContent = cleanRichContent(lesson.richContent)

  return (
    <div className="lesson-content">
      {/* ── Article Header ── */}
      <header className="lesson-content__header">
        <div className="lesson-content__subject">
          <span aria-hidden="true">{icon}</span>
          {lesson.subject}
        </div>

        <h1 className="lesson-content__title">{lesson.title}</h1>
        <p className="lesson-content__desc">{lesson.description}</p>

        <div className="lesson-content__meta">
          <span className="lesson-content__meta-item">🎓 {lesson.grade}</span>
          <span className="lesson-content__meta-item">📄 {lesson.pages} páginas</span>
          {lesson.available && (
            <span className="lesson-content__meta-item lesson-content__meta-item--green">
              ✅ PDF disponível
            </span>
          )}
        </div>
      </header>

      {/* ── Rich Content (Markdown + KaTeX) ── */}
      <article className="lesson-prose">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {cleanContent}
        </ReactMarkdown>
      </article>

      {/* ── PDF CTA ── */}
      {lesson.available && (
        <div className="lesson-cta lesson-cta--inline">
          <span className="lesson-cta__eyebrow">📥 Material Imprimível</span>
          <h2 className="lesson-cta__title">Gostou desta aula?</h2>
          <p className="lesson-cta__desc">
            Baixe o material original em PDF para imprimir ou usar com seus alunos.
          </p>
          <div className="lesson-cta__actions">
            <a
              href={lesson.pdfPath}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              ⬇ Baixar PDF Completo
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

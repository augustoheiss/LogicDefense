import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { cleanRichContent } from '../../data/content'
import type { TopicItem } from '../../data/topics'

interface LessonContentProps {
  item: TopicItem | null
}

export function LessonContent({ item }: LessonContentProps) {
  // ── Empty state ────────────────────────────────────────────────────────────
  if (!item) {
    return (
      <div className="lesson-content lesson-content--empty">
        <div className="lesson-content__placeholder">
          <span className="lesson-content__placeholder-icon" aria-hidden="true">📖</span>
          <h2 className="lesson-content__placeholder-title">Selecione um material</h2>
          <p className="lesson-content__placeholder-desc">
            Escolha uma trilha e um material no menu ao lado para começar.
          </p>
        </div>
      </div>
    )
  }

  // ── Video player ────────────────────────────────────────────────────────────
  if (item.type === 'video') {
    return (
      <div className="lesson-content lesson-content--video">
        <header className="lesson-content__header">
          <div className="lesson-content__subject">
            <span aria-hidden="true">▶</span>
            Vídeo · YouTube
          </div>
          <h1 className="lesson-content__title">{item.title}</h1>
          <p className="lesson-content__desc">{item.description}</p>
          <div className="lesson-content__meta">
            <span className="lesson-content__meta-item">🎬 {item.meta}</span>
          </div>
        </header>

        <div className="lesson-video-embed">
          <iframe
            src={`https://www.youtube.com/embed/${item.youtubeId}?rel=0&modestbranding=1&autoplay=1`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="lesson-cta lesson-cta--inline">
          <span className="lesson-cta__eyebrow">🔗 Link Externo</span>
          <h2 className="lesson-cta__title">Assistir no YouTube</h2>
          <p className="lesson-cta__desc">
            Abra diretamente no YouTube para comentar, curtir ou salvar na sua playlist.
          </p>
          <div className="lesson-cta__actions">
            <a
              href={`https://www.youtube.com/watch?v=${item.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              ↗ Abrir no YouTube
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Lesson plan ────────────────────────────────────────────────────────────
  const lesson = item.lessonData
  if (!lesson) {
    return (
      <div className="lesson-content lesson-content--empty">
        <div className="lesson-content__placeholder">
          <span className="lesson-content__placeholder-icon" aria-hidden="true">⚠️</span>
          <h2 className="lesson-content__placeholder-title">Conteúdo indisponível</h2>
          <p className="lesson-content__placeholder-desc">
            Os dados desta aula não foram encontrados.
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

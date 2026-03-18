import { useParams, Link, Navigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { lessonPlans, cleanRichContent } from '../data/content'

// ── Subject icon map (same as MaterialsPage) ──────────────────────────────────
const SUBJECT_ICONS: Record<string, string> = {
  'Matemática': '📐',
  'Tecnologia & Pedagogia': '🤖',
  'Matemática + Lógica': '🧩',
  'Tecnologia': '💡',
}
function getIcon(subject: string): string {
  return SUBJECT_ICONS[subject] ?? '📄'
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LessonPage() {
  const { slug } = useParams<{ slug: string }>()
  const lesson = lessonPlans.find((p) => p.slug === slug)

  // 404 — redirect back to the repository index
  if (!lesson) return <Navigate to="/repositorio" replace />

  return (
    <div className="lesson-page">

      {/* ── Breadcrumb ── */}
      <nav className="lesson-page__breadcrumb" aria-label="Navegação">
        <Link to="/">Início</Link>
        <span className="lesson-page__breadcrumb-sep">›</span>
        <Link to="/repositorio">Repositório</Link>
        <span className="lesson-page__breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-muted)' }}>{lesson.title}</span>
      </nav>

      {/* ── Article Header ── */}
      <header className="lesson-page__header">
        <div className="lesson-page__subject">
          <span>{getIcon(lesson.subject)}</span>
          {lesson.subject}
        </div>

        <h1 className="lesson-page__title">{lesson.title}</h1>
        <p className="lesson-page__desc">{lesson.description}</p>

        <div className="lesson-page__meta">
          <span className="lesson-page__meta-item">
            🎓 {lesson.grade}
          </span>
          <span className="lesson-page__meta-item">
            📄 {lesson.pages} páginas
          </span>
          {lesson.available && (
            <span className="lesson-page__meta-item" style={{ color: 'var(--green)' }}>
              ✅ PDF disponível
            </span>
          )}
        </div>
      </header>

      {/* ── Rich Content (Markdown + KaTeX) ── */}
      <article className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {cleanRichContent(lesson.richContent)}
        </ReactMarkdown>
      </article>

      {/* ── PDF CTA ── */}
      <div className="lesson-cta">
        <span className="lesson-cta__eyebrow">📥 Material Imprimível</span>
        <h2 className="lesson-cta__title">
          Gostou desta aula?
        </h2>
        <p className="lesson-cta__desc">
          Baixe o material original em PDF para imprimir ou usar com seus alunos.
          {!lesson.available && ' Este PDF está em preparação — deixe seu contato e avise quando estiver pronto.'}
        </p>

        <div className="lesson-cta__actions">
          {lesson.available ? (
            <a
              href={lesson.pdfPath}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              ⬇ Baixar PDF Completo
            </a>
          ) : (
            <a
              href="mailto:augustoheiss@gmail.com?subject=Interesse no PDF: ${lesson.title}"
              className="btn-outline"
            >
              ✉ Avise-me quando estiver pronto
            </a>
          )}
          <Link to="/repositorio" className="btn-outline">
            ← Ver todos os materiais
          </Link>
        </div>
      </div>

    </div>
  )
}

import { Link, Navigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { findDiaryEntry } from '../data/diary'
import { diaryDateLabel } from '../data/diarySearch'

export function DiarioPostPage() {
  const { slug } = useParams()
  const entry = findDiaryEntry(slug)

  if (!entry) return <Navigate to="/diario" replace />

  return (
    <article className="diario diario-post">
      <p className="diario-post__crumb">
        <Link to="/">Início</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/diario">Diário de bordo</Link>
        <span aria-hidden="true"> · </span>
        <span>{entry.edition}</span>
      </p>

      <header className="diario-post__header">
        <p className="diario-filter__meta">
          {entry.edition} · {diaryDateLabel(entry.date)} · {entry.readingMinutes} min de leitura
        </p>
        <h1>{entry.title}</h1>
        <p className="diario-hero__sub">{entry.subtitle}</p>
        <ul className="diario-axes" aria-label="Eixos">
          {entry.axes.map((axis) => (
            <li key={axis}>{axis}</li>
          ))}
        </ul>
      </header>

      <aside className="diario-seal">
        <p className="diario-seal__label">Selo do martelo</p>
        <p>{entry.disclosure}</p>
      </aside>

      <div className="prose diario-article">
        <ReactMarkdown>{entry.body}</ReactMarkdown>
      </div>

      <p className="diario-post__back">
        <Link to="/diario">← Todos os diários</Link>
      </p>
    </article>
  )
}

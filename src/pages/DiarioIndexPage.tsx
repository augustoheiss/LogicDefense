import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DIARY_ENTRIES } from '../data/diary'
import { diaryDateLabel, searchDiary, type DiaryMatchKind } from '../data/diarySearch'

const KIND_LABEL: Record<DiaryMatchKind, string> = {
  titulo: 'Título',
  data: 'Data',
  citacao: 'Citação no texto',
}

export function DiarioIndexPage() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'rotulos' | 'completo'>('rotulos')

  const matches = useMemo(
    () => searchDiary(DIARY_ENTRIES, query, scope),
    [query, scope],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setScope('completo')
  }

  const trimmed = query.trim()
  const emptyBrowse = trimmed.length > 0 && scope === 'rotulos' && matches.length === 0
  const emptySubmit = trimmed.length > 0 && scope === 'completo' && matches.length === 0

  return (
    <div className="diario">
      <header className="diario-hero">
        <p className="hero__eyebrow">Heiss-Lab · Diário de bordo</p>
        <h1>Notas entre a bancada, a sala e o código</h1>
        <p className="diario-hero__sub">
          Reflexões honestas sobre IA, Matemática, limites e fé.
        </p>
      </header>

      <div className="diario-layout">
        <form className="diario-search" role="search" onSubmit={onSubmit}>
          <label className="diario-search__label" htmlFor="diario-lupa">
            Pesquisar por título, data ou citação
          </label>
          <div className="diario-search__row">
            <input
              id="diario-lupa"
              className="diario-search__input"
              type="search"
              value={query}
              placeholder="Título, 15/11/2026, Salmo 119…"
              autoComplete="off"
              aria-describedby="diario-lupa-hint"
              onChange={(event) => {
                setQuery(event.target.value)
                setScope('rotulos')
              }}
            />
            <button className="diario-search__submit" type="submit">
              <span aria-hidden="true">🔍</span>
              <span className="diario-search__submit-text">Pesquisar</span>
            </button>
          </div>
          <p className="diario-search__hint" id="diario-lupa-hint">
            A lista mostra título e data. Enter na lupa também procura citações no corpo do texto.
          </p>
        </form>

        <section className="diario-filter" aria-labelledby="diario-filter-heading">
          <h2 id="diario-filter-heading" className="diario-filter__heading">
            Entradas
          </h2>
          <p className="diario-filter__count" aria-live="polite">
            {matches.length === 1 ? '1 diário' : `${matches.length} diários`}
            {scope === 'completo' && trimmed ? ' · título, data e citação' : ''}
          </p>

          {emptyBrowse && (
            <p className="diario-filter__empty">
              Nenhum título ou data com esse texto. Enter na lupa procura também dentro dos diários.
            </p>
          )}
          {emptySubmit && (
            <p className="diario-filter__empty">
              Nenhuma entrada com esse título, essa data ou essa citação.
            </p>
          )}

          <ul className="diario-filter__list">
            {matches.map(({ entry, kinds }) => (
              <li key={entry.slug}>
                <Link className="diario-filter__option" to={`/diario/${entry.slug}`}>
                  <span className="diario-filter__meta">
                    {entry.edition} · {diaryDateLabel(entry.date)} · {entry.readingMinutes} min
                  </span>
                  <span className="diario-filter__title">{entry.title}</span>
                  {trimmed && kinds.length > 0 && (
                    <span className="diario-filter__kinds">
                      {kinds.map((kind) => (
                        <span key={kind} className={`diario-kind diario-kind--${kind}`}>
                          {KIND_LABEL[kind]}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

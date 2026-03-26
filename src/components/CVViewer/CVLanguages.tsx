import type { CVLanguage } from '../../types/cv'

interface Props {
  languages: CVLanguage[]
  sectionLabel: string
}

export function CVLanguages({ languages, sectionLabel }: Props) {
  if (!languages?.length) return null

  return (
    <section className="cv-section cv-languages" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <ul className="cv-languages__list">
        {languages.map((lang, i) => (
          <li key={i} className="cv-languages__item">
            <span className="cv-languages__name">{lang.language}</span>
            {lang.fluency && (
              <span className="cv-languages__fluency">{lang.fluency}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

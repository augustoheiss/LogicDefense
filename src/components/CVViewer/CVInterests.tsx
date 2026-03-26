import type { CVInterest } from '../../types/cv'

interface Props {
  interests: CVInterest[]
  sectionLabel: string
}

export function CVInterests({ interests, sectionLabel }: Props) {
  if (!interests?.length) return null

  return (
    <section className="cv-section cv-interests" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-interests__grid">
        {interests.map((item, i) => (
          <div key={i} className="cv-interests__item">
            <h3 className="cv-interests__name">{item.name}</h3>
            {item.keywords?.length ? (
              <ul className="cv-interests__keywords">
                {item.keywords.map((kw, j) => <li key={j}>{kw}</li>)}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

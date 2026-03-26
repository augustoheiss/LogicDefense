import type { CVProject } from '../../types/cv'

interface Props {
  projects: CVProject[]
  sectionLabel: string
}

export function CVProjects({ projects, sectionLabel }: Props) {
  if (!projects?.length) return null

  return (
    <section className="cv-section cv-projects" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {projects.map((proj, i) => (
          <article key={i} className="cv-item cv-item--project">
            <div className="cv-item__header">
              <h3 className="cv-item__title">
                {proj.url
                  ? <a href={proj.url} target="_blank" rel="noopener noreferrer">{proj.name}</a>
                  : proj.name
                }
              </h3>
              {(proj.startDate || proj.endDate) && (
                <span className="cv-item__date">
                  {proj.startDate ?? ''}{proj.endDate ? ` – ${proj.endDate}` : ''}
                </span>
              )}
            </div>
            {proj.description && <p className="cv-item__summary">{proj.description}</p>}
            {proj.highlights?.length ? (
              <ul className="cv-item__highlights">
                {proj.highlights.map((h, j) => <li key={j}>{h}</li>)}
              </ul>
            ) : null}
            {proj.keywords?.length ? (
              <ul className="cv-skills__tags" style={{ marginTop: 8 }}>
                {proj.keywords.map((kw, j) => (
                  <li key={j} className="cv-skills__tag">{kw}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

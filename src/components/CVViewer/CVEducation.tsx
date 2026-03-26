import type { CVEducation as CVEduItem } from '../../types/cv'

interface Props {
  education: CVEduItem[]
  sectionLabel: string
}

function formatDate(date?: string) {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  } catch {
    return date
  }
}

export function CVEducation({ education, sectionLabel }: Props) {
  if (!education?.length) return null

  return (
    <section className="cv-section cv-education" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {education.map((edu, i) => (
          <article key={i} className="cv-item cv-item--education">
            <div className="cv-item__header">
              <div>
                <h3 className="cv-item__title">
                  {[edu.studyType, edu.area].filter(Boolean).join(' · ')}
                </h3>
                <p className="cv-item__org">
                  {edu.url
                    ? <a href={edu.url} target="_blank" rel="noopener noreferrer">{edu.institution}</a>
                    : edu.institution
                  }
                </p>
              </div>
              <span className="cv-item__date">
                {edu.startDate ? `${formatDate(edu.startDate)} – ` : ''}
                {edu.endDate ? formatDate(edu.endDate) : (edu.startDate ? 'Present' : '')}
              </span>
            </div>
            {edu.score && <p className="cv-item__summary">Score: {edu.score}</p>}
            {edu.courses?.length ? (
              <ul className="cv-item__highlights">
                {edu.courses.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

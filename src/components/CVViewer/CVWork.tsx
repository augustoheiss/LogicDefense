import type { CVWork as CVWorkItem } from '../../types/cv'

interface Props {
  work: CVWorkItem[]
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

export function CVWork({ work, sectionLabel }: Props) {
  if (!work?.length) return null

  return (
    <section className="cv-section cv-work" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {work.map((job, i) => (
          <article key={i} className="cv-item cv-item--work">
            <div className="cv-item__header">
              <div>
                <h3 className="cv-item__title">{job.position ?? 'Role'}</h3>
                <p className="cv-item__org">
                  {job.url
                    ? <a href={job.url} target="_blank" rel="noopener noreferrer">{job.name}</a>
                    : job.name
                  }
                </p>
              </div>
              <span className="cv-item__date">
                {formatDate(job.startDate)}
                {(job.startDate || job.endDate) && ' – '}
                {job.endDate ? formatDate(job.endDate) : (job.startDate ? 'Present' : '')}
              </span>
            </div>
            {job.summary && <p className="cv-item__summary">{job.summary}</p>}
            {job.highlights?.length ? (
              <ul className="cv-item__highlights">
                {job.highlights.map((h, j) => <li key={j}>{h}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

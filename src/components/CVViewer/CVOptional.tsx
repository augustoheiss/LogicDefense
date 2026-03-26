import type { CVVolunteer, CVPublication, CVCertificate, CVAward } from '../../types/cv'

/* ── Volunteer ─────────────────────────────────────────────────── */
interface VolunteerProps { volunteer: CVVolunteer[]; sectionLabel: string }

export function CVVolunteerSection({ volunteer, sectionLabel }: VolunteerProps) {
  if (!volunteer?.length) return null
  return (
    <section className="cv-section cv-volunteer" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {volunteer.map((v, i) => (
          <article key={i} className="cv-item">
            <div className="cv-item__header">
              <div>
                <h3 className="cv-item__title">{v.position ?? v.organization}</h3>
                <p className="cv-item__org">{v.organization}</p>
              </div>
              {(v.startDate || v.endDate) && (
                <span className="cv-item__date">
                  {v.startDate ?? ''}{v.endDate ? ` – ${v.endDate}` : ''}
                </span>
              )}
            </div>
            {v.summary && <p className="cv-item__summary">{v.summary}</p>}
            {v.highlights?.length ? (
              <ul className="cv-item__highlights">
                {v.highlights.map((h, j) => <li key={j}>{h}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

/* ── Publications ──────────────────────────────────────────────── */
interface PubProps { publications: CVPublication[]; sectionLabel: string }

export function CVPublications({ publications, sectionLabel }: PubProps) {
  if (!publications?.length) return null
  return (
    <section className="cv-section cv-publications" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {publications.map((pub, i) => (
          <article key={i} className="cv-item">
            <div className="cv-item__header">
              <h3 className="cv-item__title">
                {pub.url
                  ? <a href={pub.url} target="_blank" rel="noopener noreferrer">{pub.name}</a>
                  : pub.name
                }
              </h3>
              {pub.releaseDate && <span className="cv-item__date">{pub.releaseDate}</span>}
            </div>
            {pub.publisher && <p className="cv-item__org">{pub.publisher}</p>}
            {pub.summary && <p className="cv-item__summary">{pub.summary}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

/* ── Certificates ──────────────────────────────────────────────── */
interface CertProps { certificates: CVCertificate[]; sectionLabel: string }

export function CVCertificates({ certificates, sectionLabel }: CertProps) {
  if (!certificates?.length) return null
  return (
    <section className="cv-section cv-certificates" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <ul className="cv-certs__list">
        {certificates.map((cert, i) => (
          <li key={i} className="cv-certs__item">
            <div className="cv-certs__name">
              {cert.url
                ? <a href={cert.url} target="_blank" rel="noopener noreferrer">{cert.name}</a>
                : cert.name
              }
            </div>
            <div className="cv-certs__meta">
              {cert.issuer && <span>{cert.issuer}</span>}
              {cert.date && <span>{cert.date}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── Awards ────────────────────────────────────────────────────── */
interface AwardsProps { awards: CVAward[]; sectionLabel: string }

export function CVAwards({ awards, sectionLabel }: AwardsProps) {
  if (!awards?.length) return null
  return (
    <section className="cv-section cv-awards" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-section__items">
        {awards.map((award, i) => (
          <article key={i} className="cv-item">
            <div className="cv-item__header">
              <h3 className="cv-item__title">{award.title}</h3>
              {award.date && <span className="cv-item__date">{award.date}</span>}
            </div>
            {award.awarder && <p className="cv-item__org">{award.awarder}</p>}
            {award.summary && <p className="cv-item__summary">{award.summary}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

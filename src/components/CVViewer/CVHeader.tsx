import type { CVBasics } from '../../types/cv'

interface Props { basics: CVBasics }

export function CVHeader({ basics }: Props) {
  const { name, label, email, phone, url, summary, location, profiles } = basics

  return (
    <header className="cv-header">
      <div className="cv-header__top">
        <div className="cv-header__identity">
          <h1 className="cv-header__name">{name}</h1>
          {label && <p className="cv-header__label">{label}</p>}
        </div>

        <div className="cv-header__contacts">
          {email && (
            <a className="cv-header__contact-item" href={`mailto:${email}`}>
              <span className="cv-contact-icon">✉</span> {email}
            </a>
          )}
          {phone && (
            <a className="cv-header__contact-item" href={`tel:${phone}`}>
              <span className="cv-contact-icon">📞</span> {phone}
            </a>
          )}
          {url && (
            <a className="cv-header__contact-item" href={url} target="_blank" rel="noopener noreferrer">
              <span className="cv-contact-icon">🔗</span> {url.replace(/^https?:\/\//, '')}
            </a>
          )}
          {location?.city && (
            <span className="cv-header__contact-item">
              <span className="cv-contact-icon">📍</span>
              {[location.city, location.region, location.countryCode].filter(Boolean).join(', ')}
            </span>
          )}
          {profiles?.map(p => (
            <a
              key={p.network}
              className="cv-header__contact-item"
              href={p.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="cv-contact-icon">◈</span> {p.network}: {p.username}
            </a>
          ))}
        </div>
      </div>

      {summary && (
        <div className="cv-header__summary">
          <p>{summary}</p>
        </div>
      )}
    </header>
  )
}

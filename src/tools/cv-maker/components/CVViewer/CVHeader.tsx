import React from 'react'
import type { CVBasics } from '../../types/cv'

interface CVHeaderProps {
  basics: CVBasics
}

export const CVHeader: React.FC<CVHeaderProps> = ({ basics }) => {
  const { name, label, image, email, phone, url, summary, location, profiles, customBadges } = basics

  const locationStr = location
    ? [location.city, location.region, location.countryCode].filter(Boolean).join(', ')
    : ''

  return (
    <header className="cv-header cv-avoid-break">
      <div className="cv-header__top">
        <div className="cv-header__profile">
          {image && (
            <div className="cv-avatar-container">
              <img src={image} alt={name} className="cv-avatar-img" />
            </div>
          )}
          <div>
            <h1 className="cv-name">{name}</h1>
            <div className="cv-label-row">
              {label && <span className="cv-label">{label}</span>}
              {customBadges && customBadges.map((badge, i) => (
                <span key={i} className="cv-badge">{badge}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="cv-contacts">
          {email && (
            <a href={`mailto:${email}`} className="cv-link" title="E-mail">
              ✉ {email}
            </a>
          )}
          {phone && (
            <span title="Telefone">
              📞 {phone}
            </span>
          )}
          {locationStr && (
            <span title="Localização">
              📍 {locationStr}
            </span>
          )}
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="cv-link">
              🌐 {url.replace(/^https?:\/\//, '')}
            </a>
          )}
          {profiles && profiles.map((p, idx) => (
            <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer" className="cv-link">
              🔗 {p.network}: {p.username || p.url.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          ))}
        </div>
      </div>

      {summary && (
        <p className="cv-summary">
          {summary}
        </p>
      )}
    </header>
  )
}

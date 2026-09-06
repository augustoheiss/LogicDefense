import React from 'react'
import type { CVBasics } from '../../types/cv'

interface BlockContactsProps {
  basics: CVBasics
  layoutStyle?: 'list' | 'row' | 'top_bar'
}

export const BlockContacts: React.FC<BlockContactsProps> = ({ basics, layoutStyle = 'list' }) => {
  const locationStr = basics.location
    ? [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')
    : ''

  if (layoutStyle === 'top_bar') {
    return (
      <div className="cv-hero-top-bar cv-top-contact-bar">
        {basics.email && <span>✉ {basics.email}</span>}
        {basics.phone && <span>📞 {basics.phone}</span>}
        {locationStr && <span>📍 {locationStr}</span>}
        {basics.url && (
          <span>
            🌐 <a href={basics.url} target="_blank" rel="noopener noreferrer" className="cv-link">{basics.url.replace(/^https?:\/\//, '')}</a>
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={`cv-contacts ${layoutStyle === 'row' ? 'cv-contacts-row' : ''}`}>
      {basics.email && (
        <div className="cv-contact-item">
          <span className="cv-contact-icon">✉</span>
          <a href={`mailto:${basics.email}`} className="cv-link">{basics.email}</a>
        </div>
      )}
      {basics.phone && (
        <div className="cv-contact-item">
          <span className="cv-contact-icon">📞</span>
          <span>{basics.phone}</span>
        </div>
      )}
      {locationStr && (
        <div className="cv-contact-item">
          <span className="cv-contact-icon">📍</span>
          <span>{locationStr}</span>
        </div>
      )}
      {basics.url && (
        <div className="cv-contact-item">
          <span className="cv-contact-icon">🌐</span>
          <a href={basics.url} target="_blank" rel="noopener noreferrer" className="cv-link">
            {basics.url.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        </div>
      )}
      {basics.profiles && basics.profiles.map((prof, idx) => (
        <div key={idx} className="cv-contact-item">
          <span className="cv-contact-icon">🔗</span>
          <a href={prof.url} target="_blank" rel="noopener noreferrer" className="cv-link">
            {prof.network}: {prof.username}
          </a>
        </div>
      ))}
    </div>
  )
}

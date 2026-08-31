import React from 'react'
import type { CVBasics } from '../../types/cv'

interface BlockHeaderProps {
  basics: CVBasics
  variant?: 'standard' | 'brand_block' | 'hero' | 'minimal'
}

export const BlockHeader: React.FC<BlockHeaderProps> = ({ basics, variant = 'standard' }) => {
  if (variant === 'brand_block') {
    return (
      <header className="cv-brand-header">
        {basics.image && (
          <div className="cv-avatar-square">
            <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
          </div>
        )}
        <div className="cv-brand-info">
          <div className="cv-brand-greeting">hello, i'm</div>
          <h1 className="cv-name" style={{ margin: '0.2rem 0', fontSize: '1.85rem', fontWeight: 800 }}>{basics.name}</h1>
          {basics.label && (
            <div className="cv-brand-label" style={{ fontSize: '0.92rem', fontWeight: 600, opacity: 0.88 }}>
              {basics.label}
            </div>
          )}
        </div>
      </header>
    )
  }

  if (variant === 'hero') {
    return (
      <div className="cv-hero-text">
        <h1 className="cv-hero-name cv-name" style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.04em' }}>{basics.name}</h1>
        {basics.label && (
          <div className="cv-hero-role" style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0.35rem 0' }}>
            {basics.label}
          </div>
        )}
        {basics.quote && <p className="cv-hero-quote" style={{ fontStyle: 'italic', opacity: 0.9 }}>"{basics.quote}"</p>}
      </div>
    )
  }

  return (
    <header className="cv-header">
      <div className="cv-header__top">
        <div className="cv-header__profile">
          {basics.image && (
            <div className="cv-avatar-container">
              <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
            </div>
          )}
          <div>
            <h1 className="cv-name">{basics.name}</h1>
            {basics.label && <div className="cv-label">{basics.label}</div>}
          </div>
        </div>
      </div>
      {basics.customBadges && basics.customBadges.length > 0 && (
        <div className="cv-badges" style={{ marginTop: '0.6rem' }}>
          {basics.customBadges.map((badge, idx) => (
            <span key={idx} className="cv-badge">{badge}</span>
          ))}
        </div>
      )}
    </header>
  )
}

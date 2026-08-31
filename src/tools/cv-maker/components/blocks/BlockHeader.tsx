import React from 'react'
import type { CVBasics } from '../../types/cv'

interface BlockHeaderProps {
  basics: CVBasics
  variant?: 'standard' | 'brand_block' | 'hero' | 'minimal'
}

export const BlockHeader: React.FC<BlockHeaderProps> = ({ basics, variant = 'standard' }) => {
  if (variant === 'brand_block') {
    return (
      <header className="cv-editorial-hero">
        <div className="cv-editorial-pretitle">Hello, I'm</div>
        <h1 className="cv-editorial-title">{basics.name}</h1>
        {basics.label && <div className="cv-editorial-label">{basics.label}</div>}
      </header>
    )
  }

  if (variant === 'hero') {
    return (
      <div className="cv-hero-text">
        <h1 className="cv-hero-name">{basics.name}</h1>
        {basics.label && <div className="cv-hero-role">{basics.label}</div>}
        {basics.quote && <p className="cv-hero-quote">"{basics.quote}"</p>}
      </div>
    )
  }

  return (
    <header className="cv-header">
      <h1 className="cv-name">{basics.name}</h1>
      {basics.label && <div className="cv-label">{basics.label}</div>}
      {basics.customBadges && basics.customBadges.length > 0 && (
        <div className="cv-badges">
          {basics.customBadges.map((badge, idx) => (
            <span key={idx} className="cv-badge">{badge}</span>
          ))}
        </div>
      )}
    </header>
  )
}

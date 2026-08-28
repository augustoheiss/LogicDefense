import React from 'react'
import type { CVInterest } from '../../types/cv'

interface CVInterestsProps {
  interests: CVInterest[]
}

export const CVInterests: React.FC<CVInterestsProps> = ({ interests }) => {
  if (!interests || interests.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h2 className="cv-section-title">
        <span>🎯</span> Interesses & Pesquisa
      </h2>

      <div className="cv-skills-masonry">
        {interests.map((interest, index) => (
          <div key={index} className="cv-skills-group">
            <h4>{interest.name}</h4>
            {interest.keywords && interest.keywords.length > 0 && (
              <div className="cv-skill-tags">
                {interest.keywords.map((kw, idx) => (
                  <span key={idx} className="cv-skill-tag">{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

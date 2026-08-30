import React from 'react'
import type { CVInterest } from '../../types/cv'
import { getGridClass } from '../../utils/gridUtils'

interface CVInterestsProps {
  interests: CVInterest[]
}

export const CVInterests: React.FC<CVInterestsProps> = ({ interests }) => {
  if (!interests || interests.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h2 className="cv-section-title">
        <span>🎯</span> Interesses & Frentes de Pesquisa
      </h2>

      <div className={`cv-interests-grid ${getGridClass(interests.length)}`}>
        {interests.map((interest, index) => (
          <div key={index} className="cv-interest-card cv-avoid-break">
            <h4 className="cv-interest-title">
              <span className="cv-geo-bullet">◈</span> {interest.name}
            </h4>
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


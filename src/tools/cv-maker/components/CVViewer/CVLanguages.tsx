import React from 'react'
import type { CVLanguage } from '../../types/cv'

interface CVLanguagesProps {
  languages: CVLanguage[]
}

export const CVLanguages: React.FC<CVLanguagesProps> = ({ languages }) => {
  if (!languages || languages.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h2 className="cv-section-title">
        <span>🌐</span> Idiomas
      </h2>

      <div className="cv-skill-tags">
        {languages.map((lang, index) => (
          <span key={index} className="cv-skill-tag" style={{ padding: '0.3rem 0.6rem' }}>
            <strong>{lang.language}:</strong> {lang.fluency}
          </span>
        ))}
      </div>
    </section>
  )
}

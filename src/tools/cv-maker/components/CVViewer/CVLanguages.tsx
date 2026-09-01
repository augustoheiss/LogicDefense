import React from 'react'
import type { CVLanguage } from '../../types/cv'
import { getGridClass } from '../../utils/gridUtils'

interface CVLanguagesProps {
  languages: CVLanguage[]
}

export const CVLanguages: React.FC<CVLanguagesProps> = ({ languages }) => {
  if (!languages || languages.length === 0) return null

  return (
    <section className="cv-section">
      <h2 className="cv-section-title">
        <span>🌐</span> Idiomas & Fluência
      </h2>

      <div className={`cv-languages-grid ${getGridClass(languages.length)}`}>
        {languages.map((lang, index) => (
          <div key={index} className="cv-language-card cv-avoid-break">
            <div className="cv-lang-name">
              <span className="cv-geo-bullet">◆</span>
              <strong>{lang.language}</strong>
            </div>
            <span className="cv-lang-fluency">{lang.fluency}</span>
          </div>
        ))}
      </div>
    </section>
  )
}


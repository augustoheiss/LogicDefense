import React from 'react'
import type { CVLanguage } from '../../types/cv'

interface BlockLanguagesProps {
  languages?: CVLanguage[]
  title?: string
}

export const BlockLanguages: React.FC<BlockLanguagesProps> = ({
  languages,
  title = 'Idiomas & Fluência'
}) => {
  if (!languages || languages.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-languages-grid">
        {languages.map((lang, idx) => (
          <div key={idx} className="cv-language-card">
            <span className="cv-lang-name">{lang.language}</span>
            <span className="cv-lang-fluency">{lang.fluency}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

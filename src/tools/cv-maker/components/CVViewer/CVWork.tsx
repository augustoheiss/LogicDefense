import React from 'react'
import type { CVWork as CVWorkType } from '../../types/cv'

interface CVWorkProps {
  work: CVWorkType[]
}

export const CVWork: React.FC<CVWorkProps> = ({ work }) => {
  if (!work || work.length === 0) return null

  return (
    <section className="cv-section">
      <h2 className="cv-section-title">
        <span>💼</span> Experiência Profissional
      </h2>

      <div className="cv-work-list">
        {work.map((item, index) => {
          const dateRange = item.endDate
            ? `${item.startDate} — ${item.endDate}`
            : `${item.startDate} — Presente`

          return (
            <div key={index} className="cv-work-item cv-avoid-break">
              <div className="cv-item-header">
                <h3 className="cv-item-title">{item.position}</h3>
                <span className="cv-item-date cv-meta-tag">{dateRange}</span>
              </div>

              <div className="cv-item-company">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                    {item.name}
                  </a>
                ) : (
                  <span>{item.name}</span>
                )}
              </div>

              {item.summary && <p className="cv-item-summary">{item.summary}</p>}

              {item.highlights && item.highlights.length > 0 && (
                <ul className="cv-bullets">
                  {item.highlights.map((bullet, bIdx) => (
                    <li key={bIdx} className="cv-bullet-item">
                      {bullet}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

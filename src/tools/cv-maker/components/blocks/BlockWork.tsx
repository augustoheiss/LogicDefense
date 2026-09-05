import React from 'react'
import type { CVWork } from '../../types/cv'

interface BlockWorkProps {
  work?: CVWork[]
  title?: string
}

export const BlockWork: React.FC<BlockWorkProps> = ({
  work,
  title = 'Experiência Profissional'
}) => {
  if (!work || work.length === 0) return null

  return (
    <section className="cv-section cv-section-work">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-items-list">
        {work.map((item, idx) => (
          <div key={idx} className="cv-item cv-avoid-break">
            <div className="cv-item-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {item.logo && (
                  <img
                    src={item.logo}
                    alt={item.name}
                    style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                  />
                )}
                <span className="cv-item-title">{item.position}</span>
              </div>
              <span className="cv-item-date">
                {item.startDate} — {item.endDate || 'Presente'}
              </span>
            </div>
            <div className="cv-item-sub">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                  {item.name}
                </a>
              ) : (
                <span>{item.name}</span>
              )}
            </div>
            {item.summary && <p className="cv-item-desc">{item.summary}</p>}
            {item.highlights && item.highlights.length > 0 && (
              <ul className="cv-bullets">
                {item.highlights.map((high, hIdx) => (
                  <li key={hIdx}>{high}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

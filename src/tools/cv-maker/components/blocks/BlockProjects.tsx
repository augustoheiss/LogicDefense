import React from 'react'
import type { CVProject } from '../../types/cv'

interface BlockProjectsProps {
  projects?: CVProject[]
  title?: string
}

export const BlockProjects: React.FC<BlockProjectsProps> = ({
  projects,
  title = 'Projetos em Destaque'
}) => {
  if (!projects || projects.length === 0) return null

  return (
    <section className="cv-section">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-projects-grid">
        {projects.map((proj, idx) => (
          <div key={idx} className="cv-project-card cv-avoid-break">
            <div className="cv-item-header">
              <span className="cv-item-title">{proj.name}</span>
              {proj.url && (
                <a href={proj.url} target="_blank" rel="noopener noreferrer" className="cv-link cv-proj-link">
                  🔗 Link
                </a>
              )}
            </div>
            {proj.description && <p className="cv-item-desc">{proj.description}</p>}
            {proj.highlights && proj.highlights.length > 0 && (
              <ul className="cv-bullets">
                {proj.highlights.map((high, hIdx) => (
                  <li key={hIdx}>{high}</li>
                ))}
              </ul>
            )}
            {proj.keywords && proj.keywords.length > 0 && (
              <div className="cv-badges" style={{ marginTop: '0.4rem' }}>
                {proj.keywords.map((kw, kIdx) => (
                  <span key={kIdx} className="cv-badge">{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

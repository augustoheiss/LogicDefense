import React from 'react'
import type { CVProject } from '../../types/cv'

interface CVProjectsProps {
  projects: CVProject[]
}

export const CVProjects: React.FC<CVProjectsProps> = ({ projects }) => {
  if (!projects || projects.length === 0) return null

  return (
    <section className="cv-section">
      <h2 className="cv-section-title">
        <span>🚀</span> Projetos em Destaque & Repositórios
      </h2>

      <div className="cv-projects-grid">
        {projects.map((project, index) => (
          <div key={index} className="cv-project-card cv-avoid-break">
            <div>
              <h4>
                {project.url ? (
                  <a href={project.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                    {project.name} ↗
                  </a>
                ) : (
                  project.name
                )}
              </h4>
              {project.description && <p>{project.description}</p>}

              {project.highlights && project.highlights.length > 0 && (
                <ul className="cv-bullets">
                  {project.highlights.map((h, hIdx) => (
                    <li key={hIdx} className="cv-bullet-item">{h}</li>
                  ))}
                </ul>
              )}
            </div>

            {project.keywords && project.keywords.length > 0 && (
              <div className="cv-skill-tags" style={{ marginTop: '0.5rem' }}>
                {project.keywords.map((k, kIdx) => (
                  <span key={kIdx} className="cv-skill-tag">{k}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

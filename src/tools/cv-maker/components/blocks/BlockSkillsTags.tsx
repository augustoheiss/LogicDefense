import React from 'react'
import type { CVSkill } from '../../types/cv'

interface BlockSkillsTagsProps {
  skills?: CVSkill[]
  title?: string
}

export const BlockSkillsTags: React.FC<BlockSkillsTagsProps> = ({
  skills,
  title = 'Competências & Tecnologias'
}) => {
  if (!skills || skills.length === 0) return null

  return (
    <section className="cv-section cv-section-skills">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-skills-grid">
        {skills.map((skill, idx) => (
          <div key={idx} className="cv-skill-group cv-avoid-break">
            <div className="cv-skill-header">
              <span className="cv-skill-title">{skill.name}</span>
              {skill.level && <span className="cv-skill-level">{skill.level}</span>}
            </div>
            {skill.keywords && skill.keywords.length > 0 && (
              <div className="cv-skill-tags">
                {skill.keywords.map((kw, kIdx) => (
                  <span key={kIdx} className="cv-skill-tag">{kw}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

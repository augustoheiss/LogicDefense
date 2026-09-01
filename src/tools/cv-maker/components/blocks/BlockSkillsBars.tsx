import React from 'react'
import type { CVSkill } from '../../types/cv'
import { getSkillPercentage } from '../../types/cv'

interface BlockSkillsBarsProps {
  skills?: CVSkill[]
  title?: string
}

export const BlockSkillsBars: React.FC<BlockSkillsBarsProps> = ({
  skills,
  title = 'Expertise'
}) => {
  if (!skills || skills.length === 0) return null

  return (
    <section className="cv-section cv-section-skills">
      {title && <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>{title}</h4>}
      <div className="cv-skills-progress-list">
        {skills.map((skill, idx) => {
          const percent = getSkillPercentage(skill.level, skill.levelPercent)
          return (
            <div key={idx} className="cv-skill-bar-wrapper cv-avoid-break">
              <div className="cv-skill-bar-label">
                <span>{skill.name}</span>
                <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>{skill.level || `${percent}%`}</span>
              </div>
              <div className="cv-skill-bar-bg">
                <div className="cv-skill-bar-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

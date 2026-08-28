import type { CVSkill } from '../../types/cv'

interface CVSkillsProps {
  skills: CVSkill[]
}

export const CVSkills: React.FC<CVSkillsProps> = ({ skills }) => {
  if (!skills || skills.length === 0) return null

  return (
    <section className="cv-section cv-section-skills cv-avoid-break">
      <h2 className="cv-section-title">
        <span>⚡</span> Competências & Habilidades Técnicas
      </h2>

      <div className="cv-skills-masonry">
        {skills.map((skillGroup, index) => (
          <div key={index} className="cv-skills-group cv-avoid-break">
            <h4>
              {skillGroup.name} {skillGroup.level && <small style={{ opacity: 0.7 }}>({skillGroup.level})</small>}
            </h4>

            {skillGroup.keywords && skillGroup.keywords.length > 0 && (
              <div className="cv-skill-tags">
                {skillGroup.keywords.map((kw, kwIdx) => (
                  <span key={kwIdx} className="cv-skill-tag">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

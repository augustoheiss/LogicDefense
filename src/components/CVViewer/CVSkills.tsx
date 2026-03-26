import type { CVSkill } from '../../types/cv'

interface Props {
  skills: CVSkill[]
  sectionLabel: string
}

export function CVSkills({ skills, sectionLabel }: Props) {
  if (!skills?.length) return null

  return (
    <section className="cv-section cv-skills" aria-label={sectionLabel}>
      <h2 className="cv-section__title">{sectionLabel}</h2>
      <div className="cv-skills__grid">
        {skills.map((skill, i) => (
          <div key={i} className="cv-skills__group">
            <h3 className="cv-skills__group-name">{skill.name}</h3>
            {skill.level && <span className="cv-skills__level">{skill.level}</span>}
            {skill.keywords?.length ? (
              <ul className="cv-skills__tags" aria-label={skill.name}>
                {skill.keywords.map((kw, j) => (
                  <li key={j} className="cv-skills__tag">{kw}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

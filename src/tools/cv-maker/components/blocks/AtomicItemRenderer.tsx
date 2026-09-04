import React from 'react'
import type { CVWork, CVEducation, CVProject, CVLanguage, CVSkill } from '../../types/cv'
import { getSkillPercentage } from '../../types/cv'

interface AtomicItemRendererProps {
  category: 'work' | 'education' | 'projects' | 'languages' | 'skills'
  item: any
  variant?: string
}

export const AtomicItemRenderer: React.FC<AtomicItemRendererProps> = ({
  category,
  item,
  variant = 'card_box'
}) => {
  if (!item) return null

  // ── Renderização de Experiência Individual (work) ──
  if (category === 'work') {
    const w = item as CVWork
    const period = [w.startDate, w.endDate || 'Presente'].filter(Boolean).join(' — ')
    const companyName = w.company || w.name

    // Variante Ultra-Compacta (One-Liner de Máxima Economia A4)
    if (variant === 'ultra_compact') {
      return (
        <div className="cv-atomic-item cv-atomic-item--ultra-compact">
          <div className="cv-one-liner">
            <strong className="cv-one-liner__main">{companyName}</strong>
            <span className="cv-one-liner__sep">•</span>
            <span className="cv-one-liner__sub">{w.position}</span>
            {period && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__date">{period}</span>
              </>
            )}
          </div>
          {w.summary && <p className="cv-one-liner__desc">{w.summary}</p>}
        </div>
      )
    }

    // Variante Timeline Clássica
    if (variant === 'timeline') {
      return (
        <div className="cv-atomic-item cv-atomic-item--timeline">
          <div className="cv-timeline-bullet" />
          <div className="cv-timeline-content">
            <div className="cv-item-header">
              <span className="cv-item-title">{w.position}</span>
              <span className="cv-item-date">{period}</span>
            </div>
            <div className="cv-item-sub">
              {companyName} {w.location && `• ${w.location}`}
            </div>
            {w.summary && <p className="cv-item-desc">{w.summary}</p>}
            {w.highlights && w.highlights.length > 0 && (
              <ul className="cv-item-bullets">
                {w.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    }

    // Variante Minimalista
    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal">
          <div className="cv-item-header">
            <div>
              <strong className="cv-item-title">{w.position}</strong>
              <div className="cv-item-sub">{companyName} {w.location && `| ${w.location}`}</div>
            </div>
            <span className="cv-item-date">{period}</span>
          </div>
          {w.summary && <p className="cv-item-desc">{w.summary}</p>}
          {w.highlights && w.highlights.length > 0 && (
            <ul className="cv-item-bullets">
              {w.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    // Variante Padrão: Card Estruturado (Box Card)
    return (
      <div className="cv-atomic-item cv-atomic-item--box">
        <div className="cv-item-header">
          <div>
            <h4 className="cv-item-title">{w.position}</h4>
            <div className="cv-item-sub">
              <span className="cv-company-name">{companyName}</span>
              {w.location && <span className="cv-location-badge">📍 {w.location}</span>}
            </div>
          </div>
          {period && <span className="cv-period-badge">{period}</span>}
        </div>
        {w.summary && <p className="cv-item-desc">{w.summary}</p>}
        {w.highlights && w.highlights.length > 0 && (
          <ul className="cv-item-bullets">
            {w.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // ── Renderização de Formação Acadêmica Individual (education) ──
  if (category === 'education') {
    const ed = item as CVEducation
    const period = [ed.startDate, ed.endDate || 'Concluído'].filter(Boolean).join(' — ')

    if (variant === 'ultra_compact') {
      return (
        <div className="cv-atomic-item cv-atomic-item--ultra-compact">
          <div className="cv-one-liner">
            <strong className="cv-one-liner__main">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area || 'Curso'}</strong>
            <span className="cv-one-liner__sep">•</span>
            <span className="cv-one-liner__sub">{ed.institution}</span>
            {period && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__date">{period}</span>
              </>
            )}
          </div>
        </div>
      )
    }

    if (variant === 'timeline') {
      return (
        <div className="cv-atomic-item cv-atomic-item--timeline">
          <div className="cv-timeline-bullet" />
          <div className="cv-timeline-content">
            <div className="cv-item-header">
              <span className="cv-item-title">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area}</span>
              <span className="cv-item-date">{period}</span>
            </div>
            <div className="cv-item-sub">{ed.institution}</div>
            {ed.score && <div className="cv-item-desc">Média/Score: {ed.score}</div>}
          </div>
        </div>
      )
    }

    return (
      <div className="cv-atomic-item cv-atomic-item--box">
        <div className="cv-item-header">
          <div>
            <h4 className="cv-item-title">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area}</h4>
            <div className="cv-item-sub">{ed.institution}</div>
          </div>
          {period && <span className="cv-period-badge">{period}</span>}
        </div>
        {ed.score && <div className="cv-item-desc">Média/Score: {ed.score}</div>}
      </div>
    )
  }

  // ── Renderização de Projeto Individual (projects) ──
  if (category === 'projects') {
    const p = item as CVProject

    if (variant === 'ultra_compact') {
      return (
        <div className="cv-atomic-item cv-atomic-item--ultra-compact">
          <div className="cv-one-liner">
            <strong className="cv-one-liner__main">{p.name}</strong>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="cv-project-link">
                🔗 Link
              </a>
            )}
            {p.keywords && p.keywords.length > 0 && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__sub">{p.keywords.slice(0, 3).join(', ')}</span>
              </>
            )}
          </div>
        </div>
      )
    }

    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal">
          <div className="cv-item-header">
            <strong className="cv-item-title">
              {p.name}
              {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="cv-project-link"> [Link]</a>}
            </strong>
          </div>
          {p.description && <p className="cv-item-desc">{p.description}</p>}
        </div>
      )
    }

    return (
      <div className="cv-atomic-item cv-atomic-item--box">
        <div className="cv-item-header">
          <h4 className="cv-item-title">{p.name}</h4>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="cv-project-link">
              🔗 Acessar Projeto
            </a>
          )}
        </div>
        {p.description && <p className="cv-item-desc">{p.description}</p>}
        {p.keywords && p.keywords.length > 0 && (
          <div className="cv-project-tags">
            {p.keywords.map((k, i) => (
              <span key={i} className="cv-project-tag">{k}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Renderização de Idioma Individual (languages) ──
  if (category === 'languages') {
    const l = item as CVLanguage
    const fluency = l.fluency || 'Básico'

    // Quantidade de bolinhas (1 a 5)
    const getDotCount = (f: string) => {
      const lower = f.toLowerCase()
      if (lower.includes('nat') || lower.includes('flu')) return 5
      if (lower.includes('ava')) return 4
      if (lower.includes('inter')) return 3
      return 2
    }

    if (variant === 'dots') {
      const dots = getDotCount(fluency)
      return (
        <div className="cv-atomic-item cv-atomic-item--lang-dots">
          <span className="cv-lang-name">{l.language}</span>
          <div className="cv-lang-dots-bar" title={fluency}>
            {[1, 2, 3, 4, 5].map(d => (
              <span key={d} className={`cv-lang-dot ${d <= dots ? 'is-filled' : ''}`} />
            ))}
          </div>
        </div>
      )
    }

    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal cv-lang-line">
          <strong>{l.language}</strong> — <span>{fluency}</span>
        </div>
      )
    }

    return (
      <div className="cv-atomic-item cv-atomic-item--pill">
        <span className="cv-lang-name">{l.language}</span>
        <span className="cv-lang-level-pill">{fluency}</span>
      </div>
    )
  }

  // ── Renderização de Grupo de Habilidades Individual (skills) ──
  if (category === 'skills') {
    const s = item as CVSkill
    const percent = getSkillPercentage(s.level, s.levelPercent)

    // Variante 1: Barras de Nível de Habilidade
    if (variant === 'bars') {
      return (
        <div className="cv-atomic-item cv-atomic-item--skill-bar">
          <div className="cv-skill-bar-header">
            <span className="cv-skill-name">{s.name}</span>
            <span className="cv-skill-level-pill">{s.level ? `${s.level} • ` : ''}{percent}%</span>
          </div>
          <div className="cv-skill-bar-track">
            <div
              className="cv-skill-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          {s.keywords && s.keywords.length > 0 && (
            <div className="cv-skill-keywords-row">
              {s.keywords.map((k, i) => (
                <span key={i} className="cv-skill-keyword-tag">{k}</span>
              ))}
            </div>
          )}
        </div>
      )
    }

    // Variante 2: Texto Simples / Minimalista
    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal cv-skill-minimal">
          <div className="cv-skill-minimal-header">
            <strong className="cv-skill-minimal-title">{s.name}</strong>
            {s.level && <span className="cv-skill-minimal-level">({s.level})</span>}
          </div>
          {s.keywords && s.keywords.length > 0 && (
            <div className="cv-skill-minimal-keywords">
              {s.keywords.join('  •  ')}
            </div>
          )}
        </div>
      )
    }

    // Variante 3: Pílulas / Badges (Default / Showcase Box)
    return (
      <div className="cv-atomic-item cv-atomic-item--box cv-skill-badges-box">
        <div className="cv-skill-badge-header">
          <h5 className="cv-skill-group-title">{s.name}</h5>
          {s.level && <span className="cv-skill-level-badge">{s.level}</span>}
        </div>
        {s.keywords && s.keywords.length > 0 && (
          <div className="cv-skill-chips-cloud">
            {s.keywords.map((k, i) => (
              <span key={i} className="cv-skill-chip-item">{k}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

import React from 'react'
import type { CVWork, CVEducation, CVProject, CVLanguage, CVSkill, CVCertificate, CVInterest, CVReference, AtomicCVItem } from '../../types/cv'
import { getSkillPercentage } from '../../types/cv'

interface AtomicItemRendererProps {
  category: 'work' | 'education' | 'projects' | 'languages' | 'skills' | 'certificates' | 'interests' | 'references'
  item: AtomicCVItem
  variant?: string
}

const renderEstimatedBadge = (isEstimated?: boolean, ...dateStrings: (string | undefined)[]) => {
  const hasEst = isEstimated || dateStrings.some(d => d && (d.includes('[ESTIMADO]') || d.toLowerCase().includes('estimad')))
  if (!hasEst) return null
  return (
    <span
      className="cv-no-print"
      data-cv-interactive="true"
      title="Data estimada ou inferida automaticamente pela IA — por favor confira antes de exportar"
      style={{
        marginLeft: '0.4rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        fontSize: '0.65rem',
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: '4px',
        backgroundColor: 'rgba(234, 179, 8, 0.15)',
        color: '#b45309',
        border: '1px solid rgba(234, 179, 8, 0.4)',
        verticalAlign: 'middle',
        cursor: 'help'
      }}
    >
      ⚠️ Estimado
    </span>
  )
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
          <div className="cv-one-liner" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
            {w.logo && (
              <img
                src={w.logo}
                alt={companyName}
                style={{ width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px', flexShrink: 0 }}
              />
            )}
            <strong className="cv-one-liner__main">{companyName}</strong>
            <span className="cv-one-liner__sep">•</span>
            <span className="cv-one-liner__sub">{w.position}</span>
            {period && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__date">
                  {period}
                  {renderEstimatedBadge(w.isEstimated, w.startDate, w.endDate)}
                </span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {w.logo && (
                  <img
                    src={w.logo}
                    alt={companyName}
                    style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                  />
                )}
                <span className="cv-item-title">{w.position}</span>
              </div>
              <span className="cv-item-date">
                {period}
                {renderEstimatedBadge(w.isEstimated, w.startDate, w.endDate)}
              </span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {w.logo && (
                <img
                  src={w.logo}
                  alt={companyName}
                  style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                />
              )}
              <div>
                <strong className="cv-item-title">{w.position}</strong>
                <div className="cv-item-sub">{companyName} {w.location && `| ${w.location}`}</div>
              </div>
            </div>
            <span className="cv-item-date">
              {period}
              {renderEstimatedBadge(w.isEstimated, w.startDate, w.endDate)}
            </span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {w.logo && (
              <img
                src={w.logo}
                alt={companyName}
                style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
              />
            )}
            <div>
              <h4 className="cv-item-title">{w.position}</h4>
              <div className="cv-item-sub">
                <span className="cv-company-name">{companyName}</span>
                {w.location && <span className="cv-location-badge">📍 {w.location}</span>}
              </div>
            </div>
          </div>
          {period && (
            <span className="cv-period-badge">
              {period}
              {renderEstimatedBadge(w.isEstimated, w.startDate, w.endDate)}
            </span>
          )}
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
          <div className="cv-one-liner" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
            {ed.logo && (
              <img
                src={ed.logo}
                alt={ed.institution}
                style={{ width: '16px', height: '16px', objectFit: 'contain', borderRadius: '3px', flexShrink: 0 }}
              />
            )}
            <strong className="cv-one-liner__main">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area || 'Curso'}</strong>
            <span className="cv-one-liner__sep">•</span>
            <span className="cv-one-liner__sub">{ed.institution}</span>
            {period && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__date">
                  {period}
                  {renderEstimatedBadge(ed.isEstimated, ed.startDate, ed.endDate)}
                </span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {ed.logo && (
                  <img
                    src={ed.logo}
                    alt={ed.institution}
                    style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                  />
                )}
                <span className="cv-item-title">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area}</span>
              </div>
              <span className="cv-item-date">
                {period}
                {renderEstimatedBadge(ed.isEstimated, ed.startDate, ed.endDate)}
              </span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {ed.logo && (
              <img
                src={ed.logo}
                alt={ed.institution}
                style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
              />
            )}
            <div>
              <h4 className="cv-item-title">{ed.studyType ? `${ed.studyType} em ${ed.area}` : ed.area}</h4>
              <div className="cv-item-sub">{ed.institution}</div>
            </div>
          </div>
          {period && (
            <span className="cv-period-badge">
              {period}
              {renderEstimatedBadge(ed.isEstimated, ed.startDate, ed.endDate)}
            </span>
          )}
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
        {p.highlights && p.highlights.length > 0 && (
          <ul className="cv-item-bullets">
            {p.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        )}
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
      if (lower.includes('ava') || lower.includes('avanç')) return 4
      if (lower.includes('inter')) return 3
      return 2
    }

    // Variante 1: Barra de Pontos (Dots)
    if (variant === 'dots') {
      const dots = getDotCount(fluency)
      return (
        <div className="cv-atomic-item cv-atomic-item--lang-dots cv-lang-dots-box">
          <div className="cv-lang-dots-header">
            <span className="cv-lang-name">{l.language}</span>
            <span className="cv-lang-level-text">{fluency}</span>
          </div>
          <div className="cv-lang-dots-bar" title={fluency}>
            {[1, 2, 3, 4, 5].map(d => (
              <span key={d} className={`cv-lang-dot ${d <= dots ? 'is-filled' : ''}`} />
            ))}
          </div>
        </div>
      )
    }

    // Variante 2: Linha Simples Minimalista
    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal cv-lang-minimal">
          <strong className="cv-lang-minimal-name">{l.language}</strong>
          <span className="cv-lang-minimal-sep">•</span>
          <span className="cv-lang-minimal-level">{fluency}</span>
        </div>
      )
    }

    // Variante 3: Pill Badge (Default)
    return (
      <div className="cv-atomic-item cv-atomic-item--pill cv-lang-pill-box">
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

  // ── Renderização de Certificação Individual (certificates) ──
  if (category === 'certificates') {
    const c = item as CVCertificate

    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal cv-cert-minimal">
          <div className="cv-one-liner">
            <strong className="cv-one-liner__main">{c.name}</strong>
            {c.issuer && (
              <>
                <span className="cv-one-liner__sep">•</span>
                <span className="cv-one-liner__sub">{c.issuer}</span>
              </>
            )}
            {c.date && <span className="cv-one-liner__date">{c.date}</span>}
          </div>
        </div>
      )
    }

    if (variant === 'pill_badge') {
      return (
        <div className="cv-atomic-item cv-cert-pill-box">
          <div className="cv-cert-pill-content">
            <span className="cv-cert-name">{c.name}</span>
            {c.issuer && <span className="cv-cert-issuer-badge">{c.issuer}</span>}
          </div>
          {c.date && <span className="cv-cert-date-tag">{c.date}</span>}
        </div>
      )
    }

    // Default: card_box
    return (
      <div className="cv-atomic-item cv-atomic-item--box cv-cert-card-box">
        <div className="cv-item-header">
          <span className="cv-item-title" style={{ fontSize: '0.86rem', fontWeight: 700 }}>{c.name}</span>
          {c.date && <span className="cv-item-date">{c.date}</span>}
        </div>
        {c.issuer && (
          <div className="cv-item-sub" style={{ marginTop: '0.2rem' }}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="cv-project-link">
                {c.issuer} 🔗
              </a>
            ) : (
              <span>{c.issuer}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Renderização de Interesses & Pesquisa (interests) ──
  if (category === 'interests') {
    const it = item as CVInterest
    const HOBBY_ICONS: Record<string, string> = {
      camera: '📷',
      palette: '🎨',
      plane: '✈️',
      book: '📚',
      code: '💻',
      music: '🎵',
      coffee: '☕',
      globe: '🌐',
      chess: '♟️',
      gym: '🏋️'
    }
    const icon = it.icon && HOBBY_ICONS[it.icon] ? HOBBY_ICONS[it.icon] : '🎯'

    if (variant === 'circles') {
      return (
        <div className="cv-atomic-item cv-interest-circle-item">
          <div className="cv-hobby-circle">{icon}</div>
          <div className="cv-hobby-label">{it.name}</div>
        </div>
      )
    }

    if (variant === 'minimal') {
      return (
        <div className="cv-atomic-item cv-atomic-item--minimal cv-interest-minimal">
          <span className="cv-interest-mini-icon">{icon}</span>
          <strong className="cv-interest-mini-title">{it.name}</strong>
          {it.keywords && it.keywords.length > 0 && (
            <span className="cv-interest-mini-kw">— {it.keywords.join(', ')}</span>
          )}
        </div>
      )
    }

    // Default: card_box
    return (
      <div className="cv-atomic-item cv-atomic-item--box cv-interest-box">
        <div className="cv-interest-header">
          <span className="cv-interest-icon">{icon}</span>
          <strong className="cv-interest-name">{it.name}</strong>
        </div>
        {it.keywords && it.keywords.length > 0 && (
          <div className="cv-interest-tags">
            {it.keywords.map((k, i) => (
              <span key={i} className="cv-interest-tag">{k}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Renderização de Referência Individual (references) ──
  if (category === 'references') {
    const r = item as CVReference
    return (
      <div className="cv-atomic-item cv-atomic-item--box cv-reference-card-box">
        <div className="cv-item-header">
          <strong className="cv-item-title" style={{ fontSize: '0.86rem' }}>{r.name}</strong>
          {r.position && <span className="cv-reference-pos" style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.position}</span>}
        </div>
        {(r.company || r.reference) && (
          <div className="cv-item-sub" style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
            {r.company || r.reference}
          </div>
        )}
        {(r.phone || r.email) && (
          <div className="cv-reference-contacts" style={{ fontSize: '0.74rem', marginTop: '0.2rem', display: 'flex', gap: '0.6rem', color: '#64748b' }}>
            {r.email && <span>✉ {r.email}</span>}
            {r.phone && <span>📞 {r.phone}</span>}
          </div>
        )}
        {r.description && (
          <p className="cv-reference-desc" style={{ fontSize: '0.76rem', fontStyle: 'italic', margin: '0.25rem 0 0 0', color: '#475569' }}>
            "{r.description}"
          </p>
        )}
      </div>
    )
  }

  return null
}

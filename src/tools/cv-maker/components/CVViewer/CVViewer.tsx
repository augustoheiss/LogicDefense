import React from 'react'
import type { CVData, ThemeVariant, LayoutVariant, ViewMode } from '../../types/cv'
import { getSkillPercentage } from '../../types/cv'
import { CVPrintContainer } from './CVPrintContainer'
import { CVHeader } from './CVHeader'
import { CVWork } from './CVWork'
import { CVEducation } from './CVEducation'
import { CVProjects } from './CVProjects'
import { CVSkills } from './CVSkills'
import { CVLanguages } from './CVLanguages'
import { CVInterests } from './CVInterests'
import { CVOptional } from './CVOptional'
import { CVCoverLetter } from './CVCoverLetter'

interface CVViewerProps {
  data: CVData | null
  theme?: ThemeVariant
  layout?: LayoutVariant
  viewMode?: ViewMode
  onRequestGenerateCoverLetter?: () => void
}

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

export const CVViewer: React.FC<CVViewerProps> = ({
  data,
  theme = 'executive',
  layout = 'modular',
  viewMode = 'cv',
  onRequestGenerateCoverLetter
}) => {
  if (!data || !data.basics) {
    return (
      <div className="cv-empty-state">
        <span className="cv-empty-state__icon">📄</span>
        <h3>Nenhum currículo carregado</h3>
        <p>Cole o texto do seu currículo ou gere novas versões com a IA no painel ao lado.</p>
      </div>
    )
  }

  const { basics } = data
  const locationStr = basics.location
    ? [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')
    : ''

  // ── Renderizadores de Seções Específicas ──

  const renderReferences = () => {
    if (!data.references || data.references.length === 0) return null
    return (
      <section className="cv-section cv-avoid-break">
        <h3 className="cv-section-title">🤝 Referências Profissionais</h3>
        <div className="cv-references-grid">
          {data.references.map((ref, idx) => (
            <div key={idx} className="cv-ref-card">
              <div className="cv-ref-name">{ref.name}</div>
              <div className="cv-ref-sub">
                {ref.position && <span>{ref.position}</span>}
                {ref.company && <span> • {ref.company}</span>}
              </div>
              <div className="cv-ref-contact">
                {ref.phone && <span>📞 {ref.phone}</span>}
                {ref.email && <span>✉ {ref.email}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  const renderSkillBars = () => {
    if (!data.skills || data.skills.length === 0) return null
    return (
      <div className="cv-skills-progress-list">
        {data.skills.map((skill, idx) => {
          const percent = getSkillPercentage(skill.level, skill.levelPercent)
          return (
            <div key={idx} className="cv-skill-bar-wrapper">
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
    )
  }

  const renderHobbies = () => {
    if (!data.interests || data.interests.length === 0) return null
    return (
      <div className="cv-hobbies-grid">
        {data.interests.map((interest, idx) => {
          const icon = interest.icon && HOBBY_ICONS[interest.icon] ? HOBBY_ICONS[interest.icon] : '🎯'
          return (
            <div key={idx}>
              <div className="cv-hobby-circle">{icon}</div>
              <div className="cv-hobby-label">{interest.name}</div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Renderizador da Página Principal do Currículo ──
  const renderResumePage = () => {
    // ── Modelo A4 04: Executive Duo (Victoria Wotton) ──
    if (layout === 'compact_split') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-duo-layout">
            <aside className="cv-duo-left">
              {basics.image && (
                <div className="cv-avatar-container">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              {basics.summary && (
                <div>
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Perfil</h4>
                  <p style={{ fontSize: '0.82rem', lineHeight: 1.5, opacity: 0.9 }}>{basics.summary}</p>
                </div>
              )}
              {data.skills && (
                <div>
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Expertise</h4>
                  {renderSkillBars()}
                </div>
              )}
              {data.interests && (
                <div>
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Hobbies & Foco</h4>
                  {renderHobbies()}
                </div>
              )}
            </aside>

            <main className="cv-main-col">
              <header className="cv-duo-header">
                <h1 className="cv-name" style={{ margin: 0, fontSize: '1.9rem' }}>{basics.name}</h1>
                {basics.label && <div style={{ fontSize: '0.95rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
                <div className="cv-duo-contacts">
                  {basics.phone && <span>📞 {basics.phone}</span>}
                  {basics.email && <span>✉ {basics.email}</span>}
                  {locationStr && <span>📍 {locationStr}</span>}
                </div>
              </header>

              {data.work && <CVWork work={data.work} />}
              {data.education && <CVEducation education={data.education} />}
              {data.projects && <CVProjects projects={data.projects} />}
              {renderReferences()}
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 05: Brand Block (Basil Hailward) ──
    if (layout === 'editorial_accent') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card">
            <header className="cv-brand-header">
              {basics.image && (
                <div className="cv-avatar-container" style={{ borderRadius: '6px' }}>
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              <div>
                <div className="cv-brand-greeting">olá, eu sou</div>
                <h1 className="cv-name" style={{ margin: 0 }}>{basics.name}</h1>
                {basics.label && <div style={{ fontSize: '0.95rem', fontWeight: 600, opacity: 0.85 }}>{basics.label}</div>}
                {basics.summary && <p style={{ fontSize: '0.82rem', marginTop: '0.4rem', opacity: 0.9 }}>{basics.summary}</p>}
              </div>
            </header>

            <div className="cv-editorial-grid">
              <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="cv-sidebar-section">
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Formação</h4>
                  {data.education && <CVEducation education={data.education} />}
                </div>
                <div className="cv-sidebar-section">
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Competências</h4>
                  {data.skills && <CVSkills skills={data.skills} />}
                </div>
                <div className="cv-sidebar-section">
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Idiomas</h4>
                  {data.languages && <CVLanguages languages={data.languages} />}
                </div>
              </aside>

              <main style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {data.work && <CVWork work={data.work} />}
                {data.projects && <CVProjects projects={data.projects} />}
                {renderReferences()}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 06: Navy Solid Timeline (Wilkins Micawber) ──
    if (layout === 'corporate_timeline') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-navy-layout">
            <aside className="cv-navy-sidebar">
              {basics.image && (
                <div className="cv-avatar-container">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>{basics.name}</h2>
                {basics.label && <div style={{ fontSize: '0.8rem', opacity: 0.8, color: '#f97316' }}>{basics.label}</div>}
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#f97316', borderBottom: '1px solid #334155', paddingBottom: '0.2rem' }}>Formação</h4>
                {data.education && <CVEducation education={data.education} />}
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#f97316', borderBottom: '1px solid #334155', paddingBottom: '0.2rem' }}>Habilidades</h4>
                {renderSkillBars()}
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#f97316', borderBottom: '1px solid #334155', paddingBottom: '0.2rem' }}>Perfil & Contato</h4>
                <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {basics.age && <div>Idade: {basics.age}</div>}
                  {basics.civilStatus && <div>Estado Civil: {basics.civilStatus}</div>}
                  {basics.nationality && <div>Nacionalidade: {basics.nationality}</div>}
                  {basics.driverLicense && <div>CNH: {basics.driverLicense}</div>}
                  {basics.email && <div>✉ {basics.email}</div>}
                  {basics.phone && <div>📞 {basics.phone}</div>}
                </div>
              </div>
            </aside>

            <main className="cv-navy-main">
              {basics.quote && (
                <div style={{ fontStyle: 'italic', fontSize: '0.88rem', borderLeft: '3px solid #f97316', paddingLeft: '0.75rem' }}>
                  "{basics.quote}"
                </div>
              )}
              {data.work && (
                <section>
                  <h3 className="cv-section-title" style={{ borderBottom: '2px solid currentColor', paddingBottom: '0.3rem' }}>
                    💼 Experiência Profissional
                  </h3>
                  <div>
                    {data.work.map((w, idx) => (
                      <div key={idx} className="cv-timeline-item">
                        <div className="cv-timeline-node" />
                        <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{w.position}</div>
                        <div style={{ fontSize: '0.82rem', opacity: 0.85, color: '#f97316', fontWeight: 600 }}>
                          {w.name} | {w.startDate} — {w.endDate || 'Presente'}
                        </div>
                        {w.summary && <p style={{ fontSize: '0.82rem', margin: '0.25rem 0' }}>{w.summary}</p>}
                        {w.highlights && (
                          <ul className="cv-bullets" style={{ fontSize: '0.8rem' }}>
                            {w.highlights.map((h, hIdx) => <li key={hIdx}>{h}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {data.projects && <CVProjects projects={data.projects} />}
              {renderReferences()}
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 08: Hero Matrix (Mary Smith) ──
    if (layout === 'hero_matrix') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card">
            <div className="cv-top-contact-bar">
              {basics.phone && <span>TELEFONE: {basics.phone}</span>}
              {basics.url && <span>WEBSITE: {basics.url.replace(/^https?:\/\//, '')}</span>}
              {basics.email && <span>EMAIL: {basics.email}</span>}
            </div>

            <header className="cv-hero-banner">
              <div>
                <h1 className="cv-name" style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.04em' }}>{basics.name}</h1>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {basics.label}
                </div>
                {basics.summary && <p style={{ fontSize: '0.84rem', lineHeight: 1.5, opacity: 0.9 }}>{basics.summary}</p>}
              </div>
              {basics.image && (
                <div className="cv-avatar-container">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>{data.work && <CVWork work={data.work} />}</div>
              <div>
                {data.education && <CVEducation education={data.education} />}
                {renderReferences()}
              </div>
            </div>

            {data.skills && (
              <div style={{ borderTop: '1px solid rgba(125,125,125,0.2)', paddingTop: '1rem' }}>
                <h3 className="cv-section-title">⚡ Matriz de Competências</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {data.skills.map((s, idx) => {
                    const percent = getSkillPercentage(s.level, s.levelPercent)
                    return (
                      <div key={idx} className="cv-skill-bar-wrapper">
                        <div className="cv-skill-bar-label">
                          <span>{s.name}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="cv-skill-bar-bg">
                          <div className="cv-skill-bar-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // ── Modelo A4 03: Sidebar ──
    if (layout === 'sidebar') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-sidebar-layout">
            <aside className="cv-sidebar-col">
              <div className="cv-sidebar-profile">
                {basics.image && (
                  <div className="cv-avatar-container">
                    <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.2rem 0', fontWeight: 800 }}>{basics.name}</h2>
                  {basics.label && <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
                </div>
              </div>

              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title">Contato</h4>
                <div className="cv-sidebar-contacts">
                  {basics.email && <span>✉ {basics.email}</span>}
                  {basics.phone && <span>📞 {basics.phone}</span>}
                  {locationStr && <span>📍 {locationStr}</span>}
                </div>
              </div>

              {data.skills && (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Competências</h4>
                  <CVSkills skills={data.skills} />
                </div>
              )}

              {data.languages && (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Idiomas</h4>
                  <CVLanguages languages={data.languages} />
                </div>
              )}
            </aside>

            <main className="cv-main-col">
              {basics.summary && (
                <section className="cv-section cv-avoid-break">
                  <h3 className="cv-section-title">Sobre Mim</h3>
                  <p className="cv-summary" style={{ margin: 0 }}>{basics.summary}</p>
                </section>
              )}
              {data.work && <CVWork work={data.work} />}
              {data.projects && <CVProjects projects={data.projects} />}
              {data.education && <CVEducation education={data.education} />}
              {renderReferences()}
              <CVOptional certificates={data.certificates} awards={data.awards} volunteer={data.volunteer} />
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 01 (Modular), 02 (Linear) e 07 (Warm Magazine) ──
    return (
      <div className="cv-page-a4">
        <div className="cv-card">
          <CVHeader basics={data.basics} />
          {data.work && <CVWork work={data.work} />}
          {data.projects && <CVProjects projects={data.projects} />}
          {data.skills && <CVSkills skills={data.skills} />}
          {data.education && <CVEducation education={data.education} />}
          {data.languages && <CVLanguages languages={data.languages} />}
          {renderReferences()}
          <CVOptional certificates={data.certificates} awards={data.awards} volunteer={data.volunteer} />
          {data.interests && <CVInterests interests={data.interests} />}
        </div>
      </div>
    )
  }

  return (
    <div className={`cv-viewer-container theme-${theme} layout-${layout} view-${viewMode}`}>
      <CVPrintContainer>
        {(viewMode === 'cv' || viewMode === 'both') && renderResumePage()}
        {(viewMode === 'cover_letter' || viewMode === 'both') && (
          <CVCoverLetter
            coverLetter={data.coverLetter}
            basics={data.basics}
            layout={layout}
            theme={theme}
            onRequestGenerate={onRequestGenerateCoverLetter}
          />
        )}
      </CVPrintContainer>
    </div>
  )
}

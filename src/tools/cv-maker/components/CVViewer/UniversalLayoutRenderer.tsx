import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode, CVDesignConfig } from '../../types/cv'
import { BlockHeader } from '../blocks/BlockHeader'
import { BlockContacts } from '../blocks/BlockContacts'
import { BlockCivilData } from '../blocks/BlockCivilData'
import { BlockSummary } from '../blocks/BlockSummary'
import { BlockWork } from '../blocks/BlockWork'
import { BlockProjects } from '../blocks/BlockProjects'
import { BlockEducation } from '../blocks/BlockEducation'
import { BlockSkillsTags } from '../blocks/BlockSkillsTags'
import { BlockSkillsBars } from '../blocks/BlockSkillsBars'
import { BlockLanguages } from '../blocks/BlockLanguages'
import { BlockCertificates } from '../blocks/BlockCertificates'
import { BlockReferences } from '../blocks/BlockReferences'
import { BlockInterests } from '../blocks/BlockInterests'
import { BlockCoverLetter } from '../blocks/BlockCoverLetter'

interface UniversalLayoutRendererProps {
  data: CVData
  blueprint: LayoutBlueprint
  theme: ThemeVariant
  viewMode: ViewMode
  designConfig?: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
}

export const UniversalLayoutRenderer: React.FC<UniversalLayoutRendererProps> = ({
  data,
  blueprint,
  theme,
  viewMode,
  designConfig,
  onRequestGenerateCoverLetter
}) => {
  const { basics } = data

  const customRootStyles: React.CSSProperties = {
    '--cv-avatar-pos-x': `${basics.imagePosX ?? 50}%`,
    '--cv-avatar-pos-y': `${basics.imagePosY ?? 50}%`,
    '--cv-avatar-scale': `${basics.imageScale ?? 1.0}`,
    ...(designConfig ? {
      '--cv-font-heading': `${designConfig.fontHeading}, sans-serif`,
      '--cv-font-body': `${designConfig.fontBody}, sans-serif`,
      '--cv-font-scale': `${designConfig.fontScale}`,
      '--cv-font-size-base': designConfig.fontSizeBase,
      '--cv-color-primary': designConfig.colorPrimary,
      '--cv-color-secondary': designConfig.colorSecondary,
      '--cv-color-text': designConfig.colorText,
      '--cv-color-text-muted': designConfig.colorTextMuted,
      '--cv-color-bg': designConfig.colorBg,
      '--cv-color-surface': designConfig.colorSurface,
      '--cv-color-border': designConfig.colorBorder,
      '--cv-color-accent': designConfig.colorAccent,
      '--cv-color-sidebar': designConfig.colorSidebar || '#0f172a',
      '--cv-color-workspace-bg': designConfig.colorWorkspaceBg || '#0b1120',
      ...(designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none' ? {
        '--cv-bg-image': `url("${designConfig.backgroundPattern}")`,
      } : {
        '--cv-bg-image': 'none'
      })
    } : {})
  } as React.CSSProperties

  const renderCVPage = () => {
    // ── Modelo A4 05: Brand Accent Block (Basil Hailward) ──
    if (blueprint.id === 'editorial_accent') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-editorial_accent">
            <BlockHeader basics={basics} variant="brand_block" />
            <div className="cv-editorial-grid">
              <aside className="cv-editorial-left cv-sidebar-stack">
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Contato</h4>
                  <BlockContacts basics={basics} layoutStyle="list" />
                </div>
                {basics.driverLicense || basics.nationality || basics.age ? (
                  <div className="cv-sidebar-section">
                    <h4 className="cv-sidebar-title">Dados Civis</h4>
                    <BlockCivilData basics={basics} />
                  </div>
                ) : null}
                {data.skills && (
                  <div className="cv-sidebar-section">
                    <BlockSkillsBars skills={data.skills} title="Expertise" />
                  </div>
                )}
                {data.languages && (
                  <div className="cv-sidebar-section">
                    <BlockLanguages languages={data.languages} />
                  </div>
                )}
                {data.certificates && (
                  <div className="cv-sidebar-section">
                    <BlockCertificates certificates={data.certificates} />
                  </div>
                )}
                {data.interests && (
                  <div className="cv-sidebar-section">
                    <BlockInterests interests={data.interests} />
                  </div>
                )}
              </aside>

              <main className="cv-editorial-main">
                {basics.summary && <BlockSummary basics={basics} title="Sobre Mim" />}
                {data.work && <BlockWork work={data.work} />}
                {data.projects && <BlockProjects projects={data.projects} />}
                {data.education && <BlockEducation education={data.education} />}
                {data.references && <BlockReferences references={data.references} />}
              </main>
            </div>
          </div>
        </div>
      )
    }

    // ── Modelo A4 06: Navy Solid Timeline (Wilkins Micawber) ──
    if (blueprint.id === 'corporate_timeline') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-navy-layout layout-corporate_timeline">
            <aside className="cv-navy-sidebar cv-sidebar-stack">
              {basics.image && (
                <div className="cv-avatar-container has-photo">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.35rem', margin: '0 0 0.25rem 0', fontWeight: 800, color: '#ffffff' }}>
                  {basics.name}
                </h2>
                {basics.label && (
                  <div style={{ fontSize: '0.85rem', color: '#f97316', fontWeight: 700, letterSpacing: '0.04em' }}>
                    {basics.label}
                  </div>
                )}
              </div>
              <BlockCivilData basics={basics} />
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title" style={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                  Contato
                </h4>
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
              {data.skills && (
                <div className="cv-sidebar-section">
                  <BlockSkillsBars skills={data.skills} title="Expertise" />
                </div>
              )}
              {data.languages && (
                <div className="cv-sidebar-section">
                  <BlockLanguages languages={data.languages} />
                </div>
              )}
              {data.interests && (
                <div className="cv-sidebar-section">
                  <BlockInterests interests={data.interests} />
                </div>
              )}
            </aside>

            <main className="cv-navy-main">
              {basics.summary && <BlockSummary basics={basics} title="Sobre Mim" />}
              {data.work && <BlockWork work={data.work} />}
              {data.education && <BlockEducation education={data.education} />}
              {data.projects && <BlockProjects projects={data.projects} />}
              {data.certificates && <BlockCertificates certificates={data.certificates} />}
              {data.references && <BlockReferences references={data.references} />}
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 08: Hero Matrix (Mary Smith) ──
    if (blueprint.id === 'hero_matrix') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-hero_matrix">
            <BlockContacts basics={basics} layoutStyle="top_bar" />
            <header className="cv-hero-banner">
              <BlockHeader basics={basics} variant="hero" />
              {basics.image && (
                <div className="cv-avatar-container cv-avatar-rect has-photo" style={{ width: '85px', height: '95px', borderRadius: '8px', overflow: 'hidden', border: '2px solid currentColor', flexShrink: 0 }}>
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                {data.work && <BlockWork work={data.work} />}
              </div>
              <div>
                {data.education && <BlockEducation education={data.education} />}
                {data.projects && <BlockProjects projects={data.projects} />}
                {data.references && <BlockReferences references={data.references} />}
              </div>
            </div>

            {data.skills && (
              <div style={{ borderTop: '1px solid rgba(125,125,125,0.2)', paddingTop: '1rem' }}>
                <h3 className="cv-section-title">⚡ Matriz de Competências</h3>
                <BlockSkillsBars skills={data.skills} title="" />
              </div>
            )}
            {data.languages && <BlockLanguages languages={data.languages} />}
            {data.certificates && <BlockCertificates certificates={data.certificates} />}
            {data.interests && <BlockInterests interests={data.interests} />}
          </div>
        </div>
      )
    }

    // ── Modelo A4 04: Split Duo (Victoria Wotton) ──
    if (blueprint.id === 'compact_split') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-duo-layout layout-compact_split">
            <aside className="cv-duo-left cv-sidebar-stack">
              {basics.image && (
                <div className="cv-avatar-container has-photo">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              {basics.summary && (
                <section className="cv-section cv-avoid-break">
                  <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Perfil</h4>
                  <p className="cv-summary-text" style={{ fontSize: '0.82rem' }}>{basics.summary}</p>
                </section>
              )}
              {data.skills && <BlockSkillsBars skills={data.skills} title="Expertise" />}
              {data.interests && <BlockInterests interests={data.interests} layoutStyle="circles" title="Hobbies" />}
              <BlockCivilData basics={basics} />
              {data.languages && <BlockLanguages languages={data.languages} />}
            </aside>

            <main className="cv-duo-right">
              <header className="cv-duo-header">
                <h1 className="cv-name">{basics.name}</h1>
                {basics.label && <div className="cv-label">{basics.label}</div>}
                <BlockContacts basics={basics} layoutStyle="row" />
              </header>
              {data.work && <BlockWork work={data.work} />}
              {data.education && <BlockEducation education={data.education} />}
              {data.projects && <BlockProjects projects={data.projects} />}
              {data.certificates && <BlockCertificates certificates={data.certificates} />}
              {data.references && <BlockReferences references={data.references} />}
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 03: Executive Sidebar ──
    if (blueprint.id === 'sidebar') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card cv-sidebar-layout layout-sidebar">
            <aside className="cv-sidebar-col cv-sidebar-stack">
              <div className="cv-sidebar-profile">
                {basics.image && (
                  <div className="cv-avatar-container has-photo">
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
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
              {data.skills && <BlockSkillsTags skills={data.skills} title="Competências" />}
              {data.languages && <BlockLanguages languages={data.languages} />}
              {data.certificates && <BlockCertificates certificates={data.certificates} />}
              {data.references && <BlockReferences references={data.references} />}
              {data.interests && <BlockInterests interests={data.interests} />}
            </aside>
            <main className="cv-main-col">
              {basics.summary && <BlockSummary basics={basics} title="Sobre Mim" />}
              {data.work && <BlockWork work={data.work} />}
              {data.projects && <BlockProjects projects={data.projects} />}
              {data.education && <BlockEducation education={data.education} />}
            </main>
          </div>
        </div>
      )
    }

    // ── Modelo A4 09: Dynamic Grid Math (Augusto Heiss / Mathematical Balance) ──
    if (blueprint.id === 'dynamic_math') {
      const getGridClass = (count: number) => {
        if (count <= 1) return 'cv-grid-1'
        if (count === 2) return 'cv-grid-2'
        if (count === 3) return 'cv-grid-3'
        if (count === 4) return 'cv-grid-4'
        if (count === 5) return 'cv-grid-5'
        if (count % 3 === 0) return 'cv-grid-3'
        if (count % 3 === 1) return 'cv-grid-2'
        return 'cv-grid-split-3-2'
      }

      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-dynamic_math">
            {/* Header: Avatar + Nome & Cargo à esquerda; Contatos e Redes à direita */}
            <header className="cv-math-header">
              <div className="cv-math-header-profile">
                {basics.image && (
                  <div className="cv-avatar-container cv-math-avatar">
                    <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                  </div>
                )}
                <div>
                  <h1 className="cv-math-name cv-name">{basics.name}</h1>
                  {basics.label && <div className="cv-math-label cv-label">{basics.label}</div>}
                </div>
              </div>

              <div className="cv-math-contacts">
                {basics.email && (
                  <div>✉ <a href={`mailto:${basics.email}`} className="cv-link">{basics.email}</a></div>
                )}
                {basics.phone && (
                  <div>📞 <a href={`tel:${basics.phone.replace(/[^\d+]/g, '')}`} className="cv-link">{basics.phone}</a></div>
                )}
                {basics.location && (
                  <div>📍 {[basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')}</div>
                )}
                {basics.url && (
                  <div>🌐 <a href={basics.url} target="_blank" rel="noreferrer" className="cv-link">{basics.url.replace(/^https?:\/\//, '')}</a></div>
                )}
                {basics.profiles && basics.profiles.length > 0 && (
                  <div className="cv-math-profiles">
                    {basics.profiles.map((p, idx) => (
                      <div key={idx}>
                        <a href={p.url} target="_blank" rel="noreferrer" className="cv-link">
                          🔗 {p.network}: {p.username}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* Resumo / Sobre Mim */}
            {basics.summary && (
              <div className="cv-math-summary">
                {basics.summary}
              </div>
            )}

            {/* Experiência Profissional */}
            {data.work && data.work.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  💼 EXPERIÊNCIA PROFISSIONAL
                </h2>
                <div className="cv-math-work-list">
                  {data.work.map((w, idx) => (
                    <div key={idx} className="cv-math-work-item cv-avoid-break">
                      <div className="cv-item-header">
                        <span className="cv-item-title">{w.position}</span>
                        <span className="cv-item-date">
                          {w.startDate} — {w.endDate || 'Presente'}
                        </span>
                      </div>
                      <div className="cv-item-sub">
                        {w.url ? (
                          <a href={w.url} target="_blank" rel="noreferrer" className="cv-link">
                            {w.name} ↗
                          </a>
                        ) : (
                          w.name
                        )}
                      </div>
                      {w.summary && <p className="cv-item-desc">{w.summary}</p>}
                      {w.highlights && w.highlights.length > 0 && (
                        <ul className="cv-math-bullets">
                          {w.highlights.map((hl, hIdx) => (
                            <li key={hIdx}>{hl}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Projetos em Destaque & Repositórios (Grid Matemático) */}
            {data.projects && data.projects.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  🚀 PROJETOS EM DESTAQUE & REPOSITÓRIOS
                </h2>
                <div className={`cv-math-grid projects-grid ${getGridClass(data.projects.length)}`}>
                  {data.projects.map((pr, idx) => (
                    <div key={idx} className="cv-math-project-card cv-avoid-break">
                      <div className="cv-item-header">
                        <span className="cv-item-title">
                          {pr.url ? (
                            <a href={pr.url} target="_blank" rel="noreferrer" className="cv-link">
                              {pr.name} ↗
                            </a>
                          ) : (
                            pr.name
                          )}
                        </span>
                      </div>
                      {pr.description && <p className="cv-item-desc">{pr.description}</p>}
                      {pr.highlights && pr.highlights.length > 0 && (
                        <ul className="cv-math-bullets">
                          {pr.highlights.map((hl, hIdx) => (
                            <li key={hIdx}>{hl}</li>
                          ))}
                        </ul>
                      )}
                      {pr.keywords && pr.keywords.length > 0 && (
                        <div className="cv-math-tags">
                          {pr.keywords.map((kw, kIdx) => (
                            <span key={kIdx} className="cv-badge">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Competências & Habilidades Técnicas (Grid Matemático) */}
            {data.skills && data.skills.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  ⚡ COMPETÊNCIAS & HABILIDADES TÉCNICAS
                </h2>
                <div className={`cv-math-grid skills-grid ${getGridClass(data.skills.length)}`}>
                  {data.skills.map((sk, idx) => (
                    <div key={idx} className="cv-math-skill-card cv-avoid-break">
                      <div className="cv-math-skill-title">
                        {sk.name.toUpperCase()} {sk.level ? `(${sk.level.toUpperCase()})` : ''}
                      </div>
                      {sk.keywords && sk.keywords.length > 0 && (
                        <div className="cv-math-tags">
                          {sk.keywords.map((kw, kIdx) => (
                            <span key={kIdx} className="cv-badge">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Formação Acadêmica (Grid Matemático) */}
            {data.education && data.education.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  🎓 FORMAÇÃO ACADÊMICA
                </h2>
                <div className={`cv-math-grid education-grid ${getGridClass(data.education.length)}`}>
                  {data.education.map((edu, idx) => (
                    <div key={idx} className="cv-math-edu-card cv-avoid-break">
                      <div className="cv-item-header" style={{ marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '1rem' }}>🏛️</span>
                        <span className="cv-item-date">{edu.startDate} — {edu.endDate || 'Presente'}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                        {edu.studyType ? `${edu.studyType} em ` : ''}{edu.area}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.85, marginTop: '0.15rem' }}>
                        {edu.institution}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Idiomas & Fluência (Grid Matemático) */}
            {data.languages && data.languages.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  🌐 IDIOMAS & FLUÊNCIA
                </h2>
                <div className={`cv-math-grid languages-grid ${getGridClass(data.languages.length)}`}>
                  {data.languages.map((l, idx) => (
                    <div key={idx} className="cv-math-lang-card cv-avoid-break">
                      <span className="cv-lang-bullet">◆</span>
                      <span style={{ fontWeight: 700 }}>{l.language}</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{l.fluency}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Certificações & Licenças (Grid Matemático) */}
            {data.certificates && data.certificates.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  📜 CERTIFICAÇÕES & LICENÇAS
                </h2>
                <div className={`cv-math-grid certs-grid ${getGridClass(data.certificates.length)}`}>
                  {data.certificates.map((c, idx) => (
                    <div key={idx} className="cv-math-cert-card cv-avoid-break">
                      <div className="cv-item-header" style={{ marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '1rem' }}>📜</span>
                        <span className="cv-item-date">{c.date}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="cv-link">
                            {c.name} ↗
                          </a>
                        ) : (
                          c.name
                        )}
                      </div>
                      {c.issuer && (
                        <div className="cv-math-issuer-tag">
                          {c.issuer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Interesses & Frentes de Pesquisa (Grid Matemático) */}
            {data.interests && data.interests.length > 0 && (
              <section className="cv-section cv-avoid-break">
                <h2 className="cv-math-section-title">
                  🎯 INTERESSES & FRENTES DE PESQUISA
                </h2>
                <div className={`cv-math-grid interests-grid ${getGridClass(data.interests.length)}`}>
                  {data.interests.map((it, idx) => (
                    <div key={idx} className="cv-math-interest-card cv-avoid-break">
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                        ◈ {it.name}
                      </div>
                      {it.keywords && it.keywords.length > 0 && (
                        <div className="cv-math-tags">
                          {it.keywords.map((kw, kIdx) => (
                            <span key={kIdx} className="cv-badge">{kw}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Referências Profissionais */}
            {data.references && data.references.length > 0 && (
              <BlockReferences references={data.references} />
            )}
          </div>
        </div>
      )
    }

    // ── Modelo A4 02 (Linear) ──
    if (blueprint.id === 'linear') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-linear">
            <BlockHeader basics={basics} variant="linear" />
            <BlockContacts basics={basics} layoutStyle="row" />
            {basics.summary && <BlockSummary basics={basics} />}
            {data.work && <BlockWork work={data.work} />}
            {data.projects && <BlockProjects projects={data.projects} />}
            {data.skills && <BlockSkillsTags skills={data.skills} />}
            {data.education && <BlockEducation education={data.education} />}
            {data.languages && <BlockLanguages languages={data.languages} />}
            {data.certificates && <BlockCertificates certificates={data.certificates} />}
            {data.references && <BlockReferences references={data.references} />}
            {data.interests && <BlockInterests interests={data.interests} />}
          </div>
        </div>
      )
    }

    // ── Modelo A4 01 (Modular) e 07 (Warm Magazine) ──
    return (
      <div className="cv-page-a4">
        <div className={`cv-card ${blueprint.customClass || ''}`}>
          <BlockHeader basics={basics} variant="standard" />
          {basics.summary && <BlockSummary basics={basics} />}
          {data.work && <BlockWork work={data.work} />}
          {data.projects && <BlockProjects projects={data.projects} />}
          {data.skills && <BlockSkillsTags skills={data.skills} />}
          {data.education && <BlockEducation education={data.education} />}
          {data.languages && <BlockLanguages languages={data.languages} />}
          {data.certificates && <BlockCertificates certificates={data.certificates} />}
          {data.references && <BlockReferences references={data.references} />}
          {data.interests && <BlockInterests interests={data.interests} />}
        </div>
      </div>
    )
  }

  const renderCoverLetterPage = () => {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card cv-cover-letter-card">
          <header className="cv-cover-letter-header">
            <h1 className="cv-name">{basics.name}</h1>
            {basics.label && <div className="cv-label">{basics.label}</div>}
            <div className="cv-contacts cv-contacts-row" style={{ marginTop: '0.4rem' }}>
              {basics.email && <span>✉ {basics.email}</span>}
              {basics.phone && <span>📞 {basics.phone}</span>}
              {basics.location && (
                <span>📍 {[basics.location.city, basics.location.region].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </header>
          <div className="cv-cover-letter-divider" />
          <BlockCoverLetter
            coverLetter={data.coverLetter}
            basics={basics}
            onRequestGenerate={onRequestGenerateCoverLetter}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`cv-root theme-${theme} ${blueprint.customClass || ''}`} style={customRootStyles}>
      {viewMode === 'cv' && renderCVPage()}
      {viewMode === 'cover_letter' && renderCoverLetterPage()}
      {viewMode === 'both' && (
        <div className="cv-dossier-wrapper">
          {renderCVPage()}
          <div className="cv-page-break-indicator">
            <span>✂ ─── Quebra de Página A4 (Dossiê de 2 Páginas) ───</span>
          </div>
          {renderCoverLetterPage()}
        </div>
      )}
    </div>
  )
}

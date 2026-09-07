import React from 'react'
import type { BaseLayoutProps } from './types'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutDynamicMath: React.FC<BaseLayoutProps> = ({
  data,
  blueprint: _blueprint,
  structureConfig,
  isFreeCanvas,
  renderers,
  renderCanvasDecorations,
  pageNumber = 1,
  totalPages = 1,
  showPageFooter,
  showContinuationHeader,
  pageLabel
}) => {
  const { basics } = data
  const {
    wrapSection,
    renderPhotoSection,
    renderWorkSection,
    renderProjectsSection,
    renderSkillsSection,
    renderEducationSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderInterestsSection,
    renderReferencesSection,
    getDynamicMathSections
  } = renderers

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
    <CVPageCard
      pageNumber={pageNumber}
      totalPages={totalPages}
      candidateName={basics.name}
      candidateLabel={basics.label}
      pageLabel={pageLabel || 'Currículo'}
      showPageFooter={showPageFooter ?? (structureConfig?.showPageNumbers ?? totalPages > 1)}
      showContinuationHeader={showContinuationHeader ?? (structureConfig?.showContinuationHeader ?? true)}
    >
      <div className="cv-card layout-dynamic_math">
        {renderCanvasDecorations()}
        {getDynamicMathSections().map(secKey => {
          switch (secKey) {
            case 'photo':
              return isFreeCanvas ? (
                <React.Fragment key="dyn_photo">
                  {renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
                </React.Fragment>
              ) : null

            case 'header':
              return (
                <React.Fragment key="dyn_header">
                  {wrapSection('header', 'Perfil & Contatos', (
                    <header className="cv-math-header">
                      <div className="cv-math-header-profile">
                        {!isFreeCanvas && basics.image && (
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
                  ))}
                </React.Fragment>
              )

            case 'summary':
              return basics.summary ? (
                <React.Fragment key="dyn_summary">
                  {wrapSection('summary', 'Resumo / Sobre Mim', (
                    <div className="cv-math-summary">
                      {basics.summary}
                    </div>
                  ))}
                </React.Fragment>
              ) : null

            case 'work':
              return (
                <React.Fragment key="dyn_work">
                  {renderWorkSection(
                    undefined,
                    undefined,
                    'EXPERIÊNCIA PROFISSIONAL',
                    <h2 className="cv-math-section-title">
                      💼 EXPERIÊNCIA PROFISSIONAL
                    </h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className="cv-math-work-list">
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'projects':
              return (
                <React.Fragment key="dyn_projects">
                  {renderProjectsSection(
                    undefined,
                    undefined,
                    'PROJETOS EM DESTAQUE & REPOSITÓRIOS',
                    <h2 className="cv-math-section-title">
                      🚀 PROJETOS EM DESTAQUE & REPOSITÓRIOS
                    </h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid projects-grid ${getGridClass(data.projects?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'skills':
            case 'skills_tags':
              return (
                <React.Fragment key="dyn_skills">
                  {renderSkillsSection(
                    undefined,
                    undefined,
                    'COMPETÊNCIAS & HABILIDADES TÉCNICAS',
                    <h2 className="cv-math-section-title">
                      ⚡ COMPETÊNCIAS & HABILIDADES TÉCNICAS
                    </h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid skills-grid ${getGridClass(data.skills?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'education':
              return (
                <React.Fragment key="dyn_education">
                  {renderEducationSection(
                    undefined,
                    undefined,
                    'FORMAÇÃO ACADÊMICA',
                    <h2 className="cv-math-section-title">
                      🎓 FORMAÇÃO ACADÊMICA
                    </h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid education-grid ${getGridClass(data.education?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'languages':
              return (
                <React.Fragment key="dyn_languages">
                  {renderLanguagesSection(
                    undefined,
                    undefined,
                    'IDIOMAS & FLUÊNCIA',
                    <h2 className="cv-math-section-title">
                      🌐 IDIOMAS & FLUÊNCIA
                    </h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid languages-grid ${getGridClass(data.languages?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'certificates':
              return (
                <React.Fragment key="dyn_certificates">
                  {renderCertificatesSection(
                    undefined,
                    undefined,
                    'CERTIFICAÇÕES & LICENÇAS',
                    <h2 className="cv-math-section-title">📜 CERTIFICAÇÕES & LICENÇAS</h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid certificates-grid ${getGridClass(data.certificates?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'interests':
              return (
                <React.Fragment key="dyn_interests">
                  {renderInterestsSection(
                    undefined,
                    undefined,
                    'INTERESSES & FRENTES DE PESQUISA',
                    <h2 className="cv-math-section-title">💡 INTERESSES & FRENTES DE PESQUISA</h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className={`cv-math-grid interests-grid ${getGridClass(data.interests?.length || 0)}`}>
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            case 'references':
              return (
                <React.Fragment key="dyn_references">
                  {renderReferencesSection(
                    undefined,
                    undefined,
                    'REFERÊNCIAS',
                    <h2 className="cv-math-section-title">👥 REFERÊNCIAS</h2>,
                    (items) => (
                      <section className="cv-section">
                        <div className="cv-math-work-list">
                          {items}
                        </div>
                      </section>
                    )
                  )}
                </React.Fragment>
              )

            default:
              return null
          }
        })}
      </div>
    </CVPageCard>
  )
}

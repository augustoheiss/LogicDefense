import React from 'react'
import type { CVData, ThemeVariant, LayoutVariant } from '../../types/cv'
import { CVPrintContainer } from './CVPrintContainer'
import { CVHeader } from './CVHeader'
import { CVWork } from './CVWork'
import { CVEducation } from './CVEducation'
import { CVProjects } from './CVProjects'
import { CVSkills } from './CVSkills'
import { CVLanguages } from './CVLanguages'
import { CVInterests } from './CVInterests'
import { CVOptional } from './CVOptional'

interface CVViewerProps {
  data: CVData | null
  theme?: ThemeVariant
  layout?: LayoutVariant
}

export const CVViewer: React.FC<CVViewerProps> = ({
  data,
  theme = 'executive',
  layout = 'modular'
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

  return (
    <div className={`cv-viewer-container theme-${theme} layout-${layout}`}>
      <CVPrintContainer>
        {layout === 'sidebar' ? (
          <div className="cv-card cv-sidebar-layout">
            {/* Coluna Lateral Esquerda */}
            <aside className="cv-sidebar-col">
              <div className="cv-sidebar-profile">
                {basics.image ? (
                  <div className="cv-avatar-container">
                    <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                  </div>
                ) : null}
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.2rem 0', fontWeight: 800 }}>{basics.name}</h2>
                  {basics.label && <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
                  {basics.customBadges && (
                    <div className="cv-label-row" style={{ justifyContent: 'center', marginTop: '0.4rem' }}>
                      {basics.customBadges.map((b, i) => (
                        <span key={i} className="cv-badge">{b}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Contatos */}
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title">Contato</h4>
                <div className="cv-sidebar-contacts">
                  {basics.email && (
                    <a href={`mailto:${basics.email}`} className="cv-link">
                      ✉ {basics.email}
                    </a>
                  )}
                  {basics.phone && <span>📞 {basics.phone}</span>}
                  {locationStr && <span>📍 {locationStr}</span>}
                  {basics.url && (
                    <a href={basics.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                      🌐 {basics.url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {basics.profiles && basics.profiles.map((p, idx) => (
                    <a key={idx} href={p.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                      🔗 {p.network}: @{p.username}
                    </a>
                  ))}
                </div>
              </div>

              {/* Skills */}
              {data.skills && data.skills.length > 0 && (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Competências</h4>
                  <CVSkills skills={data.skills} />
                </div>
              )}

              {/* Idiomas */}
              {data.languages && data.languages.length > 0 && (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Idiomas</h4>
                  <CVLanguages languages={data.languages} />
                </div>
              )}

              {/* Interesses */}
              {data.interests && data.interests.length > 0 && (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Interesses</h4>
                  <CVInterests interests={data.interests} />
                </div>
              )}
            </aside>

            {/* Coluna Principal Direita */}
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
              <CVOptional certificates={data.certificates} awards={data.awards} volunteer={data.volunteer} />
            </main>
          </div>
        ) : (
          /* Modelo A4 01 (Modular) e Modelo A4 02 (Linear) */
          <div className="cv-card">
            <CVHeader basics={data.basics} />
            {data.work && <CVWork work={data.work} />}
            {data.projects && <CVProjects projects={data.projects} />}
            {data.skills && <CVSkills skills={data.skills} />}
            {data.education && <CVEducation education={data.education} />}
            {data.languages && <CVLanguages languages={data.languages} />}
            <CVOptional certificates={data.certificates} awards={data.awards} volunteer={data.volunteer} />
            {data.interests && <CVInterests interests={data.interests} />}
          </div>
        )}
      </CVPrintContainer>
    </div>
  )
}


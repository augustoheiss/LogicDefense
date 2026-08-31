import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode } from '../../types/cv'
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
  onRequestGenerateCoverLetter?: () => void
}

export const UniversalLayoutRenderer: React.FC<UniversalLayoutRendererProps> = ({
  data,
  blueprint,
  theme,
  viewMode,
  onRequestGenerateCoverLetter
}) => {
  const { basics } = data

  const renderCVPage = () => {
    // ── Modelo A4 05: Brand Accent Block (Basil Hailward) ──
    if (blueprint.id === 'editorial_accent') {
      return (
        <div className="cv-page-a4">
          <div className="cv-card layout-editorial_accent">
            <BlockHeader basics={basics} variant="brand_block" />
            <div className="cv-editorial-grid">
              <aside className="cv-editorial-left">
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
            <aside className="cv-navy-sidebar">
              {basics.image && (
                <div className="cv-avatar-container">
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
                <div className="cv-avatar-container">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
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
            <aside className="cv-duo-left">
              {basics.image && (
                <div className="cv-avatar-container">
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

    // ── Modelo A4 01 (Modular), 02 (Linear) e 07 (Warm Magazine) ──
    return (
      <div className="cv-page-a4">
        <div className={`cv-card ${blueprint.customClass || ''}`}>
          <BlockHeader basics={basics} />
          {blueprint.id === 'linear' && <BlockContacts basics={basics} layoutStyle="row" />}
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
    <div className={`cv-root theme-${theme} ${blueprint.customClass || ''}`}>
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

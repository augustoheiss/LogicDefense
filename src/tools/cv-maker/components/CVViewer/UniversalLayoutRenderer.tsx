import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode } from '../../types/cv'
import { AtomicBlockRenderer } from '../blocks/AtomicBlockRenderer'
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
  const hasSidebar = blueprint.sidebarZone && blueprint.sidebarZone.length > 0
  const hasHero = blueprint.heroZone && blueprint.heroZone.length > 0

  const renderCVPage = () => {
    // Caso 1: Layout com Hero Banner e Grid Dividida (ex: editorial_accent, warm_magazine, hero_matrix)
    if (hasHero) {
      return (
        <div className="cv-page-a4">
          <div className={`cv-card ${blueprint.customClass || ''}`}>
            {blueprint.id === 'hero_matrix' ? (
              <>
                {/* Top Contact Bar */}
                <AtomicBlockRenderer
                  blockId="contacts"
                  data={data}
                  blueprint={blueprint}
                  zoneName="hero"
                />
                <div className="cv-hero-banner">
                  <AtomicBlockRenderer
                    blockId="header"
                    data={data}
                    blueprint={blueprint}
                    zoneName="hero"
                  />
                  {data.basics.image && (
                    <div className="cv-hero-photo-wrap">
                      <img src={data.basics.image} alt={data.basics.name} className="cv-hero-photo" />
                    </div>
                  )}
                </div>
                <div className="cv-matrix-body">
                  {blueprint.mainZone.map((blockId) => (
                    <AtomicBlockRenderer
                      key={blockId}
                      blockId={blockId}
                      data={data}
                      blueprint={blueprint}
                      zoneName="main"
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="cv-editorial-grid">
                  {blueprint.heroZone?.map((blockId) => (
                    <AtomicBlockRenderer
                      key={blockId}
                      blockId={blockId}
                      data={data}
                      blueprint={blueprint}
                      zoneName="hero"
                    />
                  ))}
                  {hasSidebar && (
                    <aside className="cv-editorial-left">
                      {blueprint.sidebarZone?.map((blockId) => (
                        <AtomicBlockRenderer
                          key={blockId}
                          blockId={blockId}
                          data={data}
                          blueprint={blueprint}
                          zoneName="sidebar"
                        />
                      ))}
                    </aside>
                  )}
                  <main className="cv-editorial-main">
                    {blueprint.mainZone.map((blockId) => (
                      <AtomicBlockRenderer
                        key={blockId}
                        blockId={blockId}
                        data={data}
                        blueprint={blueprint}
                        zoneName="main"
                      />
                    ))}
                  </main>
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    // Caso 2: Layout com Barra Lateral (ex: sidebar, compact_split, corporate_timeline)
    if (hasSidebar) {
      const layoutClass =
        blueprint.id === 'compact_split'
          ? 'cv-duo-layout'
          : blueprint.id === 'corporate_timeline'
          ? 'cv-navy-layout'
          : 'cv-sidebar-layout'

      const sidebarClass =
        blueprint.id === 'compact_split'
          ? 'cv-duo-left'
          : blueprint.id === 'corporate_timeline'
          ? 'cv-navy-sidebar'
          : 'cv-sidebar-col'

      const mainClass =
        blueprint.id === 'compact_split'
          ? 'cv-duo-right'
          : blueprint.id === 'corporate_timeline'
          ? 'cv-navy-main'
          : 'cv-main-col'

      return (
        <div className="cv-page-a4">
          <div className={`cv-card ${layoutClass} ${blueprint.customClass || ''}`}>
            <aside className={sidebarClass}>
              {blueprint.sidebarZone?.map((blockId) => (
                <AtomicBlockRenderer
                  key={blockId}
                  blockId={blockId}
                  data={data}
                  blueprint={blueprint}
                  zoneName="sidebar"
                />
              ))}
            </aside>
            <main className={mainClass}>
              {blueprint.mainZone.map((blockId) => (
                <AtomicBlockRenderer
                  key={blockId}
                  blockId={blockId}
                  data={data}
                  blueprint={blueprint}
                  zoneName="main"
                />
              ))}
            </main>
          </div>
        </div>
      )
    }

    // Caso 3: Layout 1 Coluna Centralizada (ex: modular, linear)
    return (
      <div className="cv-page-a4">
        <div className={`cv-card ${blueprint.customClass || ''}`}>
          {blueprint.mainZone.map((blockId) => (
            <AtomicBlockRenderer
              key={blockId}
              blockId={blockId}
              data={data}
              blueprint={blueprint}
              zoneName="main"
            />
          ))}
        </div>
      </div>
    )
  }

  const renderCoverLetterPage = () => {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card cv-cover-letter-card">
          <header className="cv-cover-letter-header">
            <h1 className="cv-name">{data.basics.name}</h1>
            {data.basics.label && <div className="cv-label">{data.basics.label}</div>}
            <div className="cv-contacts cv-contacts-row" style={{ marginTop: '0.4rem' }}>
              {data.basics.email && <span>✉ {data.basics.email}</span>}
              {data.basics.phone && <span>📞 {data.basics.phone}</span>}
              {data.basics.location && (
                <span>📍 {[data.basics.location.city, data.basics.location.region].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </header>
          <div className="cv-cover-letter-divider" />
          <BlockCoverLetter
            coverLetter={data.coverLetter}
            basics={data.basics}
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

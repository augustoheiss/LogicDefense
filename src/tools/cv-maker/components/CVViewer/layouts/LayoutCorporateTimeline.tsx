import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { BlockSummary } from '../../blocks/BlockSummary'
import { ColumnSplitterHandle } from '../../CanvasBuilder/ColumnSplitterHandle'

export const LayoutCorporateTimeline: React.FC<BaseLayoutProps> = ({
  data,
  blueprint: _blueprint,
  structureConfig,
  isFreeCanvas,
  renderers,
  handleUpdateSplitRatio,
  renderCanvasDecorations
}) => {
  const { basics } = data
  const {
    renderZoneSection,
    renderPhotoSection,
    renderSkillsSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderInterestsSection,
    renderWorkSection,
    renderEducationSection,
    renderProjectsSection,
    renderReferencesSection
  } = renderers

  const splitRatio = structureConfig?.columnSplitRatio || 32

  const renderProfileBox = () => (
    <div>
      {!isFreeCanvas && basics.image && (
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
    </div>
  )

  return (
    <div className="cv-page-a4">
      <div className="cv-card layout-corporate_timeline cv-bleed-card">
        {renderCanvasDecorations()}
        <div
          className="cv-navy-layout"
          style={{
            display: 'grid',
            position: 'relative',
            ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
          }}
        >
          <ColumnSplitterHandle
            splitRatio={splitRatio}
            onUpdateSplitRatio={handleUpdateSplitRatio}
            isFreeCanvasActive={isFreeCanvas}
          />
          <aside className="cv-navy-sidebar cv-sidebar-stack">
            {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
            {renderZoneSection('header_profile', 'left', 'left', 'Perfil & Foto', renderProfileBox())}
            {renderZoneSection('contacts', 'left', 'left', 'Contatos', (
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title" style={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                  Contato
                </h4>
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
            ))}
            {renderSkillsSection('left', 'left', 'Expertise')}
            {renderLanguagesSection('left', 'left', 'Idiomas')}
            {renderInterestsSection('left', 'left', 'Interesses')}
            {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('left', 'right')}
            {renderEducationSection('left', 'right')}
            {renderProjectsSection('left', 'right')}
            {renderCertificatesSection('left', 'right', 'Certificações')}
            {renderReferencesSection('left', 'right', 'Referências')}
          </aside>

          <main className="cv-navy-main">
            {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
            {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('right', 'right')}
            {renderEducationSection('right', 'right')}
            {renderProjectsSection('right', 'right')}
            {renderCertificatesSection('right', 'right', 'Certificações')}
            {renderReferencesSection('right', 'right', 'Referências')}
            {renderZoneSection('header_profile', 'right', 'left', 'Perfil & Foto', renderProfileBox())}
            {renderZoneSection('contacts', 'right', 'left', 'Contatos', (
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title" style={{ color: '#f8fafc', borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                  Contato
                </h4>
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
            ))}
            {renderSkillsSection('right', 'left', 'Expertise')}
            {renderLanguagesSection('right', 'left', 'Idiomas')}
            {renderInterestsSection('right', 'left', 'Interesses')}
          </main>
        </div>
      </div>
    </div>
  )
}

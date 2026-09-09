import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockSkillsTags } from '../../blocks/BlockSkillsTags'
import { BlockSummary } from '../../blocks/BlockSummary'
import { ColumnSplitterHandle } from '../../CanvasBuilder/ColumnSplitterHandle'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutSidebar: React.FC<BaseLayoutProps> = ({
  data,
  blueprint: _blueprint,
  structureConfig,
  isFreeCanvas,
  renderers,
  handleUpdateSplitRatio,
  renderCanvasDecorations,
  pageNumber = 1,
  totalPages = 1,
  showPageFooter,
  showContinuationHeader,
  pageLabel
}) => {
  const { basics } = data
  const {
    renderZoneSection,
    renderPhotoSection,
    renderSkillsSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderReferencesSection,
    renderInterestsSection,
    renderWorkSection,
    renderProjectsSection,
    renderEducationSection
  } = renderers

  const splitRatio = structureConfig?.columnSplitRatio || 32

  const renderProfileBox = () => (
    <div className="cv-sidebar-profile">
      {!isFreeCanvas && basics.image && (
        <div className="cv-avatar-container has-photo">
          <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.2rem 0', fontWeight: 800 }}>{basics.name}</h2>
        {basics.label && <div style={{ fontSize: '0.85rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
      </div>
    </div>
  )

  const renderContactsBox = () => (
    <div className="cv-sidebar-section">
      <h4 className="cv-sidebar-title">Contato</h4>
      <BlockContacts basics={basics} layoutStyle="list" />
    </div>
  )

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
      <div className="cv-card layout-sidebar">
        {renderCanvasDecorations()}
        <div
          className="cv-sidebar-layout"
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
          <aside className="cv-sidebar-col cv-sidebar-stack">
            {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
            {renderZoneSection('header_profile', 'left', 'left', 'Perfil & Foto', renderProfileBox())}
            {renderZoneSection('contacts', 'left', 'left', 'Contatos', renderContactsBox())}
            {renderSkillsSection('left', 'left', 'Competências', <BlockSkillsTags skills={data.skills} title="Competências" />)}
            {renderLanguagesSection('left', 'left', 'Idiomas')}
            {renderCertificatesSection('left', 'left', 'Certificações')}
            {renderReferencesSection('left', 'left', 'Referências')}
            {renderInterestsSection('left', 'left', 'Interesses')}
            {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('left', 'right')}
            {renderProjectsSection('left', 'right')}
            {renderEducationSection('left', 'right')}
            {renderers.renderCustomAstSections?.('left', 'left')}
          </aside>
          <main className="cv-main-col">
            {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
            {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('right', 'right')}
            {renderProjectsSection('right', 'right')}
            {renderEducationSection('right', 'right')}
            {renderZoneSection('header_profile', 'right', 'left', 'Perfil & Foto', renderProfileBox())}
            {renderZoneSection('contacts', 'right', 'left', 'Contatos', renderContactsBox())}
            {renderSkillsSection('right', 'left', 'Competências', <BlockSkillsTags skills={data.skills} title="Competências" />)}
            {renderLanguagesSection('right', 'left', 'Idiomas')}
            {renderCertificatesSection('right', 'left', 'Certificações')}
            {renderReferencesSection('right', 'left', 'Referências')}
            {renderInterestsSection('right', 'left', 'Interesses')}
            {renderers.renderCustomAstSections?.('right', 'right')}
          </main>
        </div>
      </div>
    </CVPageCard>
  )
}

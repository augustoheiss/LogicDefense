import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { ColumnSplitterHandle } from '../../CanvasBuilder/ColumnSplitterHandle'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutCompactSplit: React.FC<BaseLayoutProps> = ({
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
    renderInterestsSection,
    renderWorkSection,
    renderEducationSection,
    renderProjectsSection,
    renderReferencesSection
  } = renderers

  const splitRatio = structureConfig?.columnSplitRatio || 34

  const renderHeaderBox = () => (
    <header className="cv-duo-header">
      <h1 className="cv-name">{basics.name}</h1>
      {basics.label && <div className="cv-label">{basics.label}</div>}
      <BlockContacts basics={basics} layoutStyle="row" />
    </header>
  )

  const renderSummaryBox = () => (
    <section className="cv-section cv-avoid-break">
      <h4 className="cv-section-title" style={{ fontSize: '0.88rem' }}>Perfil</h4>
      <p className="cv-summary-text" style={{ fontSize: '0.82rem' }}>{basics.summary}</p>
    </section>
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
      <div className="cv-card layout-compact_split">
        {renderCanvasDecorations()}
        <div
          className="cv-duo-layout"
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
          <aside className="cv-duo-left cv-sidebar-stack">
            {renderPhotoSection('left', 'left', 'Foto de Perfil', false)}
            {basics.summary && renderZoneSection('summary', 'left', 'left', 'Perfil / Resumo', renderSummaryBox())}
            {renderSkillsSection('left', 'left', 'Expertise')}
            {renderInterestsSection('left', 'left', 'Hobbies')}
            {renderZoneSection('civil', 'left', 'left', 'Dados Civis', <BlockCivilData basics={basics} />)}
            {renderLanguagesSection('left', 'left', 'Idiomas')}
            {renderZoneSection('header', 'left', 'right', 'Identificação & Contatos', renderHeaderBox())}
            {renderWorkSection('left', 'right')}
            {renderEducationSection('left', 'right')}
            {renderProjectsSection('left', 'right')}
            {renderCertificatesSection('left', 'right', 'Certificações')}
            {renderReferencesSection('left', 'right', 'Referências')}
          </aside>

          <main className="cv-duo-right">
            {renderZoneSection('header', 'right', 'right', 'Identificação & Contatos', renderHeaderBox())}
            {renderPhotoSection('right', 'left', 'Foto de Perfil', false)}
            {basics.summary && renderZoneSection('summary', 'right', 'left', 'Perfil / Resumo', renderSummaryBox())}
            {renderSkillsSection('right', 'left', 'Expertise')}
            {renderWorkSection('right', 'right')}
            {renderEducationSection('right', 'right')}
            {renderProjectsSection('right', 'right')}
            {renderCertificatesSection('right', 'right', 'Certificações')}
            {renderZoneSection('civil', 'right', 'left', 'Dados Civis', <BlockCivilData basics={basics} />)}
            {renderLanguagesSection('right', 'left', 'Idiomas')}
            {renderInterestsSection('right', 'left', 'Hobbies')}
            {renderReferencesSection('right', 'right', 'Referências')}
          </main>
        </div>
      </div>
    </CVPageCard>
  )
}

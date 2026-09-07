import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutHeroMatrix: React.FC<BaseLayoutProps> = ({
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
    renderSkillsSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderInterestsSection,
    renderWorkSection,
    renderProjectsSection,
    renderEducationSection,
    renderReferencesSection
  } = renderers

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
      <div className="cv-card layout-hero_matrix">
        {renderCanvasDecorations()}
        {wrapSection('contacts_top', 'Contatos no Topo', <BlockContacts basics={basics} layoutStyle="top_bar" />)}
        {wrapSection('hero_banner', 'Banner Principal', (
          <header className="cv-hero-banner">
            <BlockHeader basics={basics} variant="hero" />
            {!isFreeCanvas && basics.image && (
              <div className="cv-avatar-container cv-avatar-rect has-photo" style={{ width: '85px', height: '95px', borderRadius: '8px', overflow: 'hidden', border: '2px solid currentColor', flexShrink: 0 }}>
                <img src={basics.image} alt={basics.name} className="cv-avatar-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </header>
        ))}
        {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}

        <div className="cv-hero-matrix-grid">
          <div>
            {renderWorkSection()}
          </div>
          <div>
            {renderEducationSection()}
            {renderProjectsSection()}
            {renderReferencesSection()}
          </div>
        </div>

        {renderSkillsSection(undefined, undefined, 'Matriz de Competências')}
        {renderLanguagesSection()}
        {renderCertificatesSection()}
        {renderInterestsSection()}
      </div>
    </CVPageCard>
  )
}

import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'

export const LayoutHeroMatrix: React.FC<BaseLayoutProps> = ({
  data,
  blueprint: _blueprint,
  isFreeCanvas,
  renderers,
  renderCanvasDecorations
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
    <div className="cv-page-a4">
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
    </div>
  )
}

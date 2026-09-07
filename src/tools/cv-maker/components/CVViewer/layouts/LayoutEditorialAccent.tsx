import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { BlockSummary } from '../../blocks/BlockSummary'
import { ColumnSplitterHandle } from '../../CanvasBuilder/ColumnSplitterHandle'

export const LayoutEditorialAccent: React.FC<BaseLayoutProps> = ({
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
    wrapSection,
    renderZoneSection,
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

  const splitRatio = structureConfig?.columnSplitRatio || 34

  return (
    <div className="cv-page-a4">
      <div className="cv-card layout-editorial_accent">
        {renderCanvasDecorations()}
        {wrapSection('header', 'Cabeçalho / Identificação', <BlockHeader basics={basics} variant="brand_block" hideImage={isFreeCanvas} />)}
        <div
          className="cv-editorial-grid"
          style={{
            position: 'relative',
            ...(structureConfig?.columnSplitRatio ? { gridTemplateColumns: `${structureConfig.columnSplitRatio}% 1fr` } : {})
          }}
        >
          <ColumnSplitterHandle
            splitRatio={splitRatio}
            onUpdateSplitRatio={handleUpdateSplitRatio}
            isFreeCanvasActive={isFreeCanvas}
          />
          <aside className="cv-editorial-left cv-sidebar-stack">
            {renderPhotoSection('left', 'left', 'Foto de Perfil', true)}
            {renderZoneSection('contacts', 'left', 'left', 'Contatos', (
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title">Contato</h4>
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
            ))}
            {basics.driverLicense || basics.nationality || basics.age ? (
              renderZoneSection('civil', 'left', 'left', 'Dados Civis', (
                <div className="cv-sidebar-section">
                  <h4 className="cv-sidebar-title">Dados Civis</h4>
                  <BlockCivilData basics={basics} />
                </div>
              ))
            ) : null}
            {renderSkillsSection('left', 'left', 'Expertise')}
            {renderLanguagesSection('left', 'left', 'Idiomas')}
            {renderCertificatesSection('left', 'left', 'Certificações')}
            {renderInterestsSection('left', 'left', 'Interesses')}
            {basics.summary && renderZoneSection('summary', 'left', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('left', 'right')}
            {renderProjectsSection('left', 'right')}
            {renderEducationSection('left', 'right')}
            {renderReferencesSection('left', 'right', 'Referências')}
          </aside>

          <main className="cv-editorial-main">
            {renderPhotoSection('right', 'left', 'Foto de Perfil', true)}
            {basics.summary && renderZoneSection('summary', 'right', 'right', 'Sobre Mim', <BlockSummary basics={basics} title="Sobre Mim" />)}
            {renderWorkSection('right', 'right')}
            {renderProjectsSection('right', 'right')}
            {renderEducationSection('right', 'right')}
            {renderReferencesSection('right', 'right', 'Referências')}
            {renderZoneSection('contacts', 'right', 'left', 'Contatos', (
              <div className="cv-sidebar-section">
                <h4 className="cv-sidebar-title">Contato</h4>
                <BlockContacts basics={basics} layoutStyle="list" />
              </div>
            ))}
            {renderSkillsSection('right', 'left', 'Expertise')}
            {renderLanguagesSection('right', 'left', 'Idiomas')}
            {renderCertificatesSection('right', 'left', 'Certificações')}
            {renderInterestsSection('right', 'left', 'Interesses')}
          </main>
        </div>
      </div>
    </div>
  )
}

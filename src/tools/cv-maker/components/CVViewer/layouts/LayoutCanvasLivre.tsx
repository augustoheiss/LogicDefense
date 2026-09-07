import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { BlockSummary } from '../../blocks/BlockSummary'
import { BlockSkillsTags } from '../../blocks/BlockSkillsTags'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutCanvasLivre: React.FC<BaseLayoutProps> = ({
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
    renderEducationSection,
    renderProjectsSection,
    renderSkillsSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderInterestsSection,
    renderReferencesSection
  } = renderers

  const hasAnyContent = (
    (structureConfig?.sectionOrder && structureConfig.sectionOrder.length > 0) ||
    ((structureConfig?.customZones || []).length > 0)
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
      <div className="cv-card layout-canvas_livre" style={{ minHeight: '100%', position: 'relative' }}>
        {renderCanvasDecorations()}

        {/* Renderizar seções que o usuário adicionar ao canvas livre */}
        {(structureConfig?.sectionOrder || []).map((secId) => {
          if (secId === 'photo') return renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)
          if (secId === 'header') return wrapSection('header', 'Cabeçalho', <BlockHeader basics={basics} variant="standard" hideImage={isFreeCanvas} />)
          if (secId === 'summary' && basics.summary) return wrapSection('summary', 'Resumo Profissional', <BlockSummary basics={basics} />)
          if (secId === 'contacts') return wrapSection('contacts', 'Contatos', <BlockContacts basics={basics} layoutStyle="row" />)
          if (secId === 'civil') return wrapSection('civil', 'Dados Civis', <BlockCivilData basics={basics} />)
          if (secId.startsWith('work')) return renderWorkSection()
          if (secId.startsWith('education')) return renderEducationSection()
          if (secId.startsWith('projects')) return renderProjectsSection()
          if (secId.startsWith('skills')) return renderSkillsSection(undefined, undefined, 'Competências', <BlockSkillsTags skills={data.skills} />)
          if (secId.startsWith('languages')) return renderLanguagesSection()
          if (secId.startsWith('certificates')) return renderCertificatesSection()
          if (secId.startsWith('interests')) return renderInterestsSection()
          if (secId.startsWith('references')) return renderReferencesSection()
          return null
        })}

        {/* Placeholder de folha em branco quando nada foi adicionado ainda */}
        {!hasAnyContent && (
          <div className="cv-canvas-blank-placeholder cv-no-print" data-cv-interactive="true">
            <div className="cv-blank-icon">🎨</div>
            <h3>Folha em Branco - Canvas Livre</h3>
            <p>
              Sua página está pronta para criação! Use o menu lateral <strong>"🎨 Elementos (Canvas)"</strong> para:
            </p>
            <div className="cv-canvas-blank-tips">
              <div className="cv-blank-tip-item">
                <span>📐</span>
                <strong>Zonas & Sidebars:</strong> Desenhe caixas, colunas ou sidebars arrastando com o mouse.
              </div>
              <div className="cv-blank-tip-item">
                <span>🖼️</span>
                <strong>Fundos & Texturas:</strong> Aplique cores elegantes ou texturas IA com opacidade.
              </div>
              <div className="cv-blank-tip-item">
                <span>🧱</span>
                <strong>Blocos de Conteúdo:</strong> Ative seções de Experiência, Formação e Habilidades.
              </div>
            </div>
          </div>
        )}
      </div>
    </CVPageCard>
  )
}

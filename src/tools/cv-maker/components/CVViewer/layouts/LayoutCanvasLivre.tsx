import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { BlockSummary } from '../../blocks/BlockSummary'
import { BlockSkillsTags } from '../../blocks/BlockSkillsTags'
import { CVPageCard } from '../renderers/CVPageCard'
import { UniversalSectionDispatcher } from '../../UniversalRenderers/UniversalSectionDispatcher'

export const LayoutCanvasLivre: React.FC<BaseLayoutProps> = ({
  data,
  blueprint: _blueprint,
  structureConfig,
  onUpdateStructureConfig,
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

  const astBlocks = data.meta?.universalAST?.blocks || []
  const astBlockMap = new Map(astBlocks.map(b => [b.key, b]))
  const renderedAstKeys = new Set<string>()

  // Seções processadas pela ordem definida no layout
  const orderedNodes = (structureConfig?.sectionOrder || []).map((secId) => {
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

    // Seção customizada do AST incluída no sectionOrder
    if (astBlockMap.has(secId)) {
      renderedAstKeys.add(secId)
      const block = astBlockMap.get(secId)!
      return (
        <UniversalSectionDispatcher
          key={block.key}
          block={block}
          structureConfig={structureConfig}
          onUpdateStructureConfig={onUpdateStructureConfig}
          isFreeCanvas={isFreeCanvas}
          onMoveUp={() => renderers.handleMoveStep?.(block.key, -1)}
          onMoveDown={() => renderers.handleMoveStep?.(block.key, 1)}
        />
      )
    }

    return null
  })

  // Seções customizadas que o usuário recém-adicionou no YAML e ainda não estão no sectionOrder
  const standardKeys = new Set([
    'basics', 'meta', 'document_title', 'title', 'themeConfig',
    'work', 'education', 'projects', 'skills', 'languages',
    'certificates', 'interests', 'references', 'photo', 'summary',
    'resumo', 'contacts', 'civil', 'header', 'cover_letter'
  ])

  const newCustomAstNodes = astBlocks
    .filter(b => !standardKeys.has(b.key) && !renderedAstKeys.has(b.key))
    .map(block => (
      <UniversalSectionDispatcher
        key={block.key}
        block={block}
        structureConfig={structureConfig}
        onUpdateStructureConfig={onUpdateStructureConfig}
        isFreeCanvas={isFreeCanvas}
        onMoveUp={() => renderers.handleMoveStep?.(block.key, -1)}
        onMoveDown={() => renderers.handleMoveStep?.(block.key, 1)}
      />
    ))

  const hasAnyContent = (
    (structureConfig?.sectionOrder && structureConfig.sectionOrder.length > 0) ||
    ((structureConfig?.customZones || []).length > 0) ||
    newCustomAstNodes.length > 0
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

        {/* Renderizar seções ordenadas */}
        {orderedNodes}

        {/* Renderizar seções recém-adicionadas no YAML dinamicamente */}
        {newCustomAstNodes}

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

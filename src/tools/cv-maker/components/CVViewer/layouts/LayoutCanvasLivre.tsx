import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockContacts } from '../../blocks/BlockContacts'
import { BlockCivilData } from '../../blocks/BlockCivilData'
import { BlockSummary } from '../../blocks/BlockSummary'
import { BlockSkillsTags } from '../../blocks/BlockSkillsTags'
import { CVPageCard } from '../renderers/CVPageCard'
import { UniversalSectionDispatcher } from '../../UniversalRenderers/UniversalSectionDispatcher'
import { useCanvasStore } from '../../../store/useCanvasStore'

const DEFAULT_CANVAS_LIVRE_SECTIONS = [
  'photo',
  'header',
  'contacts',
  'summary',
  'work',
  'education',
  'projects',
  'skills',
  'languages',
  'certificates',
  'interests',
  'references'
]

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
  pageLabel,
  onReorderSequenceItem
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
  const astBlockMap = new Map(astBlocks.map((b) => [b.key, b]))
  const renderedAstKeys = new Set<string>()
  const renderedCanonicalGroups = new Set<string>()

  // Constrói a lista efetiva de seções garantindo que TODAS as seções padrão do currículo
  // sempre carreguem no Canvas Livre, mesmo quando sectionOrder ainda não foi customizado
  const effectiveSectionOrder = React.useMemo(() => {
    const customOrder = structureConfig?.sectionOrder || []
    if (customOrder.length === 0) {
      return DEFAULT_CANVAS_LIVRE_SECTIONS
    }
    const merged = [...customOrder]
    for (const defSec of DEFAULT_CANVAS_LIVRE_SECTIONS) {
      const base = defSec.split('_')[0]
      const alreadyHas = merged.some((s) => s === defSec || s.startsWith(base))
      if (!alreadyHas) {
        merged.push(defSec)
      }
    }
    return merged
  }, [structureConfig?.sectionOrder])

  // Seções processadas pela ordem definida no layout
  const orderedNodes = effectiveSectionOrder.map((secId) => {
    if (secId === 'photo') {
      if (!basics.image) return null
      return renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)
    }
    if (secId === 'header' || secId === 'basics') {
      if (renderedCanonicalGroups.has('header')) return null
      renderedCanonicalGroups.add('header')
      return wrapSection(
        'header',
        'Cabeçalho',
        <BlockHeader basics={basics} variant="standard" hideImage={isFreeCanvas} />
      )
    }
    if ((secId === 'summary' || secId === 'resumo') && basics.summary) {
      if (renderedCanonicalGroups.has('summary')) return null
      renderedCanonicalGroups.add('summary')
      return wrapSection('summary', 'Resumo Profissional', <BlockSummary basics={basics} />)
    }
    if (secId === 'contacts') {
      if (renderedCanonicalGroups.has('contacts')) return null
      renderedCanonicalGroups.add('contacts')
      return wrapSection('contacts', 'Contatos', <BlockContacts basics={basics} layoutStyle="row" />)
    }
    if (secId === 'civil') {
      if (renderedCanonicalGroups.has('civil')) return null
      renderedCanonicalGroups.add('civil')
      return wrapSection('civil', 'Dados Civis', <BlockCivilData basics={basics} />)
    }
    if (secId.startsWith('work')) {
      if (renderedCanonicalGroups.has('work')) return null
      renderedCanonicalGroups.add('work')
      return renderWorkSection()
    }
    if (secId.startsWith('education')) {
      if (renderedCanonicalGroups.has('education')) return null
      renderedCanonicalGroups.add('education')
      return renderEducationSection()
    }
    if (secId.startsWith('projects')) {
      if (renderedCanonicalGroups.has('projects')) return null
      renderedCanonicalGroups.add('projects')
      return renderProjectsSection()
    }
    if (secId.startsWith('skills')) {
      if (renderedCanonicalGroups.has('skills')) return null
      renderedCanonicalGroups.add('skills')
      return renderSkillsSection(
        undefined,
        undefined,
        'Competências',
        <BlockSkillsTags skills={data.skills} />
      )
    }
    if (secId.startsWith('languages')) {
      if (renderedCanonicalGroups.has('languages')) return null
      renderedCanonicalGroups.add('languages')
      return renderLanguagesSection()
    }
    if (secId.startsWith('certificates')) {
      if (renderedCanonicalGroups.has('certificates')) return null
      renderedCanonicalGroups.add('certificates')
      return renderCertificatesSection()
    }
    if (secId.startsWith('interests')) {
      if (renderedCanonicalGroups.has('interests')) return null
      renderedCanonicalGroups.add('interests')
      return renderInterestsSection()
    }
    if (secId.startsWith('references')) {
      if (renderedCanonicalGroups.has('references')) return null
      renderedCanonicalGroups.add('references')
      return renderReferencesSection()
    }

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
          onReorderSequenceItem={onReorderSequenceItem}
        />
      )
    }

    return null
  })

  // Seções extras do YAML (ex: awards, volunteer, publications ou chaves customizadas)
  const standardKeys = new Set([
    'basics',
    'meta',
    'document_title',
    'title',
    'themeConfig',
    'work',
    'education',
    'projects',
    'skills',
    'languages',
    'certificates',
    'interests',
    'references',
    'photo',
    'summary',
    'resumo',
    'contacts',
    'civil',
    'header',
    'cover_letter',
    'coverLetter'
  ])

  const newCustomAstNodes = astBlocks
    .filter((b) => !standardKeys.has(b.key) && !renderedAstKeys.has(b.key))
    .map((block) => (
      <UniversalSectionDispatcher
        key={block.key}
        block={block}
        structureConfig={structureConfig}
        onUpdateStructureConfig={onUpdateStructureConfig}
        isFreeCanvas={isFreeCanvas}
        onMoveUp={() => renderers.handleMoveStep?.(block.key, -1)}
        onMoveDown={() => renderers.handleMoveStep?.(block.key, 1)}
        onReorderSequenceItem={onReorderSequenceItem}
      />
    ))

  return (
    <CVPageCard
      pageNumber={pageNumber}
      totalPages={totalPages}
      candidateName={basics.name}
      candidateLabel={basics.label}
      pageLabel={pageLabel || 'Currículo'}
      showPageFooter={showPageFooter ?? (structureConfig?.showPageNumbers ?? totalPages > 1)}
      showContinuationHeader={
        showContinuationHeader ?? (structureConfig?.showContinuationHeader ?? true)
      }
    >
      <div
        className="cv-card layout-canvas_livre"
        style={{ minHeight: '100%', position: 'relative' }}
        onClick={() => {
          useCanvasStore.getState().resetCanvasState()
        }}
      >
        {renderCanvasDecorations()}

        <div className="cv-canvas-livre-flow" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Renderizar todas as seções padrão e ordenadas do currículo */}
          {orderedNodes}

          {/* Renderizar seções extras do YAML dinamicamente */}
          {newCustomAstNodes}
        </div>
      </div>
    </CVPageCard>
  )
}

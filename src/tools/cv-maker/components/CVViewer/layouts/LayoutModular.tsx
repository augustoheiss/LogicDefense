import React from 'react'
import type { BaseLayoutProps } from './types'
import { BlockHeader } from '../../blocks/BlockHeader'
import { BlockSummary } from '../../blocks/BlockSummary'
import { BlockSkillsTags } from '../../blocks/BlockSkillsTags'
import { CVPageCard } from '../renderers/CVPageCard'

export const LayoutModular: React.FC<BaseLayoutProps> = ({
  data,
  blueprint,
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
    renderProjectsSection,
    renderSkillsSection,
    renderEducationSection,
    renderLanguagesSection,
    renderCertificatesSection,
    renderReferencesSection,
    renderInterestsSection
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
      <div className={`cv-card ${blueprint.customClass || ''}`}>
        {renderCanvasDecorations()}
        {isFreeCanvas && renderPhotoSection(undefined, undefined, 'Foto de Perfil', true)}
        {wrapSection('header', 'Cabeçalho Padrão', <BlockHeader basics={basics} variant="standard" hideImage={isFreeCanvas} />)}
        {basics.summary && wrapSection('summary', 'Resumo', <BlockSummary basics={basics} />)}
        {renderWorkSection()}
        {renderProjectsSection()}
        {renderSkillsSection(undefined, undefined, 'Competências', <BlockSkillsTags skills={data.skills} />)}
        {renderEducationSection()}
        {renderLanguagesSection()}
        {renderCertificatesSection()}
        {renderReferencesSection()}
        {renderInterestsSection()}
      </div>
    </CVPageCard>
  )
}

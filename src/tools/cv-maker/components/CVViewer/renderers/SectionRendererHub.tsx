import React from 'react'
import type { CVData, LayoutStructureConfig } from '../../../types/cv'
import { BlockPhoto } from '../../blocks/BlockPhoto'
import { AtomicItemRenderer } from '../../blocks/AtomicItemRenderer'
import { SectionWrapper } from './SectionWrapper'
import { getAtomicItemId } from '../../../utils/atomicIdUtils'
import type { SectionRenderers } from '../layouts/types'

interface UseSectionRenderersProps {
  data: CVData
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  isFreeCanvas: boolean
  isMultiColumnLayout: boolean
  handleMoveStep: (secId: string, direction: -1 | 1) => void
  handleSwapOrder: (sourceId: string, targetId: string) => void
  handleSwitchZone: (sectionId: string, defaultZone: 'left' | 'right') => void
  getSectionZone: (sectionId: string, defaultZone: 'left' | 'right') => 'left' | 'right'
  getSortedItems: <T>(
    category: string,
    items: T[] | undefined,
    getId: (item: T, index: number) => string
  ) => { item: T; originalIndex: number; itemId: string }[]
  getDynamicMathSections: () => string[]
}

export function useSectionRenderers({
  data,
  structureConfig,
  onUpdateStructureConfig,
  isFreeCanvas,
  isMultiColumnLayout,
  handleMoveStep,
  handleSwapOrder,
  handleSwitchZone,
  getSectionZone,
  getSortedItems,
  getDynamicMathSections
}: UseSectionRenderersProps): SectionRenderers {
  const { basics } = data

  const wrapSection = (
    sectionId: string,
    title: string,
    node: React.ReactNode,
    defaultZone?: 'left' | 'right',
    category?: string
  ): React.ReactNode => {
    const canSwitch = isMultiColumnLayout && Boolean(defaultZone)
    const currentZone = defaultZone ? getSectionZone(sectionId, defaultZone) : undefined

    return (
      <SectionWrapper
        key={sectionId}
        sectionId={sectionId}
        title={title}
        category={category}
        defaultZone={defaultZone}
        isMultiColumnLayout={isMultiColumnLayout}
        isFreeCanvas={isFreeCanvas}
        structureConfig={structureConfig}
        onUpdateStructureConfig={onUpdateStructureConfig}
        onMoveStep={handleMoveStep}
        onSwapWithSection={(targetId) => handleSwapOrder(sectionId, targetId)}
        onSwitchZone={canSwitch && defaultZone ? () => handleSwitchZone(sectionId, defaultZone) : undefined}
        currentZone={currentZone}
      >
        {node}
      </SectionWrapper>
    )
  }

  const renderZoneSection = (
    secId: string,
    targetZone: 'left' | 'right',
    defZone: 'left' | 'right',
    title: string,
    node: React.ReactNode,
    category?: string
  ): React.ReactNode => {
    if (!node) return null
    if (getSectionZone(secId, defZone) !== targetZone) return null
    return wrapSection(secId, title, node, defZone, category)
  }

  const renderPhotoSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Foto de Perfil',
    onlyInFreeCanvas = false
  ): React.ReactNode => {
    const photoDims = structureConfig?.sectionDimensions?.['photo']
    if (photoDims?.hidden) return null

    if (isFreeCanvas) {
      const photoContent = (
        <BlockPhoto
          image={basics.image}
          altName={basics.name}
          shape={photoDims?.photoShape || 'circle'}
          size={photoDims?.photoSize ?? 96}
          borderWidth={photoDims?.photoBorderWidth ?? 0}
          borderColor={photoDims?.photoBorderColor || '#0284c7'}
          shadow={photoDims?.photoShadow ?? true}
          align={photoDims?.photoAlign || 'center'}
          posX={basics.imagePosX ?? 50}
          posY={basics.imagePosY ?? 50}
          scale={basics.imageScale ?? 1.0}
        />
      )

      return targetZone
        ? renderZoneSection('photo', targetZone, defZone, fallbackTitle, photoContent, 'photo')
        : wrapSection('photo', fallbackTitle, photoContent, defZone, 'photo')
    }

    if (onlyInFreeCanvas || !basics.image) return null
    const standardNode = (
      <BlockPhoto
        image={basics.image}
        altName={basics.name}
        shape="circle"
        size={96}
        borderWidth={0}
        shadow={false}
        align="center"
        posX={basics.imagePosX ?? 50}
        posY={basics.imagePosY ?? 50}
        scale={basics.imageScale ?? 1.0}
      />
    )
    if (targetZone) {
      return getSectionZone('photo', defZone) === targetZone ? standardNode : null
    }
    return standardNode
  }

  const renderWorkSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Experiência Profissional',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.work || data.work.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">💼 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('work_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'work')
      : wrapSection('work_title', `Título: ${titleText}`, titleNode, defZone, 'work')

    const sorted = getSortedItems('work', data.work, (w, i) => getAtomicItemId('work', w, i))
    const itemBoxes = sorted.map(({ item: w, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const companyName = w.company || w.name
      const boxTitle = companyName ? `${w.position ? `${w.position} • ` : ''}${companyName}` : `Experiência #${idx + 1}`
      const content = <AtomicItemRenderer category="work" item={w} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'work')
        : wrapSection(itemId, boxTitle, content, defZone, 'work')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-work-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="work_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderEducationSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Formação Acadêmica',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.education || data.education.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">🎓 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('education_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'education')
      : wrapSection('education_title', `Título: ${titleText}`, titleNode, defZone, 'education')

    const sorted = getSortedItems('education', data.education, (ed, i) => getAtomicItemId('education', ed, i))
    const itemBoxes = sorted.map(({ item: ed, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = ed.institution ? `${ed.area || ed.studyType || 'Formação'} • ${ed.institution}` : `Formação #${idx + 1}`
      const content = <AtomicItemRenderer category="education" item={ed} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'education')
        : wrapSection(itemId, boxTitle, content, defZone, 'education')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-education-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="education_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderProjectsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Projetos em Destaque',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.projects || data.projects.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">🚀 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('projects_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'projects')
      : wrapSection('projects_title', `Título: ${titleText}`, titleNode, defZone, 'projects')

    const sorted = getSortedItems('projects', data.projects, (p, i) => getAtomicItemId('projects', p, i))
    const itemBoxes = sorted.map(({ item: p, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = p.name ? `Projeto: ${p.name}` : `Projeto #${idx + 1}`
      const content = <AtomicItemRenderer category="projects" item={p} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'projects')
        : wrapSection(itemId, boxTitle, content, defZone, 'projects')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-projects-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="projects_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderLanguagesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Idiomas',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.languages || data.languages.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">🌐 {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('languages_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'languages')
      : wrapSection('languages_title', `Título: ${titleText}`, titleNode, defZone, 'languages')

    const sorted = getSortedItems('languages', data.languages, (l, i) => getAtomicItemId('languages', l, i))
    const itemBoxes = sorted.map(({ item: l, originalIndex: _idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'pill_badge'
      const boxTitle = `Idioma: ${l.language}`
      const content = <AtomicItemRenderer category="languages" item={l} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'languages')
        : wrapSection(itemId, boxTitle, content, defZone, 'languages')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-languages-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="languages_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderSkillsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Competências',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.skills || data.skills.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">⚡ {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('skills_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'skills')
      : wrapSection('skills_title', `Título: ${titleText}`, titleNode, defZone, 'skills')

    const sorted = getSortedItems('skills', data.skills, (s, i) => getAtomicItemId('skills', s, i))
    const itemBoxes = sorted.map(({ item: s, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'badges'
      const boxTitle = s.name ? `Competência: ${s.name}` : `Skill #${idx + 1}`
      const content = <AtomicItemRenderer category="skills" item={s} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'skills')
        : wrapSection(itemId, boxTitle, content, defZone, 'skills')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-skills-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="skills_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderCertificatesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Licenças & Certificações',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.certificates || data.certificates.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">📜 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('certificates_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'certificates')
      : wrapSection('certificates_title', `Título: ${titleText}`, titleNode, defZone, 'certificates')

    const sorted = getSortedItems('certificates', data.certificates, (c, i) => getAtomicItemId('certificates', c, i))
    const itemBoxes = sorted.map(({ item: c, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'card_box'
      const boxTitle = c.name ? `Certificação: ${c.name}` : `Certificação #${idx + 1}`
      const content = <AtomicItemRenderer category="certificates" item={c} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'certificates')
        : wrapSection(itemId, boxTitle, content, defZone, 'certificates')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-certificates-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="certificates_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderInterestsSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'left',
    fallbackTitle = 'Interesses & Pesquisa',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.interests || data.interests.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h4 className="cv-sidebar-title">💡 {titleText}</h4>
    const titleBox = targetZone
      ? renderZoneSection('interests_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'interests')
      : wrapSection('interests_title', `Título: ${titleText}`, titleNode, defZone, 'interests')

    const sorted = getSortedItems('interests', data.interests, (it, i) => getAtomicItemId('interests', it, i))
    const itemBoxes = sorted.map(({ item: it, originalIndex: idx, itemId }) => {
      const itemDims = structureConfig?.sectionDimensions?.[itemId]
      const variant = itemDims?.variant || 'pill_badge'
      const boxTitle = it.name ? `Interesse: ${it.name}` : `Interesse #${idx + 1}`
      const content = <AtomicItemRenderer category="interests" item={it} variant={variant} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'interests')
        : wrapSection(itemId, boxTitle, content, defZone, 'interests')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-interests-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="interests_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  const renderReferencesSection = (
    targetZone?: 'left' | 'right',
    defZone: 'left' | 'right' = 'right',
    fallbackTitle = 'Referências',
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ): React.ReactNode => {
    if (!data.references || data.references.length === 0) return null

    const titleText = fallbackTitle
    const titleNode = customTitleNode || <h3 className="cv-section-title">👥 {titleText}</h3>
    const titleBox = targetZone
      ? renderZoneSection('references_title', targetZone, defZone, `Título: ${titleText}`, titleNode, 'references')
      : wrapSection('references_title', `Título: ${titleText}`, titleNode, defZone, 'references')

    const sorted = getSortedItems('references', data.references, (r, i) => getAtomicItemId('references', r, i))
    const itemBoxes = sorted.map(({ item: r, originalIndex: idx, itemId }) => {
      const boxTitle = r.name ? `Referência: ${r.name}` : `Referência #${idx + 1}`
      const content = <AtomicItemRenderer category="references" item={r} />

      return targetZone
        ? renderZoneSection(itemId, targetZone, defZone, boxTitle, content, 'references')
        : wrapSection(itemId, boxTitle, content, defZone, 'references')
    })

    const wrappedItems = containerWrapper
      ? containerWrapper(itemBoxes)
      : (
        <div className="cv-atomic-items-container cv-references-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {itemBoxes}
        </div>
      )

    return (
      <React.Fragment key="references_atomic_group">
        {titleBox}
        {wrappedItems}
      </React.Fragment>
    )
  }

  return {
    wrapSection,
    renderZoneSection,
    renderPhotoSection,
    renderWorkSection,
    renderEducationSection,
    renderProjectsSection,
    renderLanguagesSection,
    renderSkillsSection,
    renderCertificatesSection,
    renderInterestsSection,
    renderReferencesSection,
    getDynamicMathSections
  }
}

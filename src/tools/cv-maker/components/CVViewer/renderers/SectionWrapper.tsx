import React from 'react'
import type { LayoutStructureConfig, SectionBoxDimensions } from '../../../types/cv'
import { StructuralBoxWrapper } from '../../CanvasBuilder/StructuralBoxWrapper'

interface SectionWrapperProps {
  sectionId: string
  title: string
  children: React.ReactNode
  category?: 'work' | 'education' | 'projects' | 'languages' | 'skills' | 'identity' | 'summary' | 'photo' | 'certificates' | 'interests' | 'references' | string
  defaultZone?: 'left' | 'right'
  isMultiColumnLayout?: boolean
  isFreeCanvas: boolean
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  onMoveStep: (secId: string, direction: -1 | 1) => void
  onSwapWithSection: (targetId: string) => void
  onSwitchZone?: () => void
  currentZone?: 'left' | 'right'
}

export function getSectionBaseCategory(sectionId: string, category?: string): string {
  if (category) return category
  if (sectionId.endsWith('_title')) return sectionId.replace('_title', '')
  if (sectionId.startsWith('work')) return 'work'
  if (sectionId.startsWith('education')) return 'education'
  if (sectionId.startsWith('projects') || sectionId.startsWith('project')) return 'projects'
  if (sectionId.startsWith('skills') || sectionId.startsWith('skill')) return 'skills'
  if (sectionId.startsWith('languages') || sectionId.startsWith('language')) return 'languages'
  if (sectionId.startsWith('certificates') || sectionId.startsWith('cert')) return 'certificates'
  if (sectionId.startsWith('interests') || sectionId.startsWith('interest')) return 'interests'
  if (sectionId.startsWith('references') || sectionId.startsWith('reference')) return 'references'
  if (sectionId.startsWith('header')) return 'header'
  if (sectionId.startsWith('contact')) return 'contacts'
  if (sectionId.startsWith('summary')) return 'summary'
  if (sectionId.startsWith('cover')) return 'cover_letter'
  return sectionId
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  sectionId,
  title,
  children,
  category,
  defaultZone,
  isMultiColumnLayout,
  isFreeCanvas,
  structureConfig,
  onUpdateStructureConfig,
  onMoveStep,
  onSwapWithSection,
  onSwitchZone,
  currentZone
}) => {
  const baseCategory = getSectionBaseCategory(sectionId, category)
  const rawDims = structureConfig?.sectionDimensions?.[sectionId]
  const parentDims = baseCategory && baseCategory !== sectionId ? structureConfig?.sectionDimensions?.[baseCategory] : undefined
  const hiddenSet = new Set(structureConfig?.hiddenSections || [])
  const isBasicsGroup = baseCategory === 'header' || baseCategory === 'contacts' || baseCategory === 'summary'

  const isHiddenByDims =
    rawDims?.hidden !== undefined
      ? rawDims.hidden
      : parentDims?.hidden !== undefined
      ? parentDims.hidden
      : isBasicsGroup
      ? structureConfig?.sectionDimensions?.['basics']?.hidden
      : undefined

  const isHiddenByList =
    hiddenSet.has(sectionId) ||
    hiddenSet.has(baseCategory) ||
    (isBasicsGroup && hiddenSet.has('basics'))

  const effectiveHidden = isHiddenByDims !== undefined ? isHiddenByDims : isHiddenByList

  const effectiveDims: SectionBoxDimensions = {
    ...parentDims,
    ...rawDims,
    fontFamily: rawDims?.fontFamily || parentDims?.fontFamily,
    fontSizeScale: rawDims?.fontSizeScale ?? parentDims?.fontSizeScale,
    variant: rawDims?.variant || parentDims?.variant,
    hidden: effectiveHidden
  }

  if (effectiveDims.hidden && !isFreeCanvas) {
    return null
  }

  if (!isFreeCanvas) {
    const widthPercent = effectiveDims.widthPercent
    const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
    const hasCustomFont = Boolean(effectiveDims.fontFamily)
    const hasCustomScale = typeof effectiveDims.fontSizeScale === 'number' && effectiveDims.fontSizeScale !== 1
    const fontScaleVal = effectiveDims.fontSizeScale ?? 1.0
    const alignment = effectiveDims.alignment

    const marginLeftStyle = alignment === 'center' || alignment === 'right' ? 'auto' : undefined
    const marginRightStyle = alignment === 'center' ? 'auto' : alignment === 'right' ? '0' : undefined

    return (
      <div
        key={sectionId}
        className={`cv-atomic-box-wrapper cv-section-${baseCategory} cv-avoid-break`}
        style={{
          width: hasCustomWidth ? `${widthPercent}%` : undefined,
          display: hasCustomWidth ? 'inline-block' : undefined,
          verticalAlign: hasCustomWidth ? 'top' : undefined,
          boxSizing: 'border-box',
          marginLeft: marginLeftStyle,
          marginRight: marginRightStyle,
          order: effectiveDims.order,
          fontFamily: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined,
          fontSize: hasCustomScale ? `${effectiveDims.fontSizeScale}em` : undefined,
          ['--cv-box-font-scale' as any]: fontScaleVal,
          ['--cv-box-font-family' as any]: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined,
          ['--cv-font-heading' as any]: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined,
          ['--cv-font-body' as any]: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined
        }}
        data-section-id={sectionId}
        data-category={baseCategory}
        data-has-custom-font={hasCustomFont ? 'true' : undefined}
        data-has-custom-scale={hasCustomScale ? 'true' : undefined}
      >
        {children}
      </div>
    )
  }

  const canSwitch = Boolean(isMultiColumnLayout && defaultZone && onSwitchZone)

  return (
    <StructuralBoxWrapper
      key={sectionId}
      sectionId={sectionId}
      title={title}
      category={category || baseCategory}
      isFreeCanvasActive={isFreeCanvas}
      dimensions={effectiveDims}
      canSwitchZone={canSwitch}
      currentZone={currentZone}
      onSwitchZone={canSwitch ? onSwitchZone : undefined}
      onSelectVariant={(variantId) => {
        if (!structureConfig || !onUpdateStructureConfig) return
        const cur = structureConfig.sectionDimensions?.[sectionId] || {}
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [sectionId]: { ...cur, variant: variantId }
          }
        })
      }}
      onToggleHide={() => {
        if (!structureConfig || !onUpdateStructureConfig) return
        const cur = structureConfig.sectionDimensions?.[sectionId] || {}
        const nextHidden = !effectiveHidden
        const nextHiddenSet = new Set(structureConfig.hiddenSections || [])
        if (nextHidden) {
          if (sectionId === baseCategory) nextHiddenSet.add(baseCategory)
          if (sectionId === 'header') nextHiddenSet.add('basics')
        } else {
          nextHiddenSet.delete(sectionId)
          nextHiddenSet.delete(baseCategory)
          if (isBasicsGroup) nextHiddenSet.delete('basics')
        }
        onUpdateStructureConfig({
          ...structureConfig,
          hiddenSections: Array.from(nextHiddenSet),
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [sectionId]: { ...cur, hidden: nextHidden }
          }
        })
      }}
      onUpdateDimensions={(dims: SectionBoxDimensions) => {
        if (!structureConfig || !onUpdateStructureConfig) return
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [sectionId]: dims
          }
        })
      }}
      onMoveUp={() => onMoveStep(sectionId, -1)}
      onMoveDown={() => onMoveStep(sectionId, +1)}
      onSwapWithSection={(targetId) => onSwapWithSection(targetId)}
      onResetDimensions={() => {
        if (!structureConfig || !onUpdateStructureConfig) return
        const next = { ...structureConfig.sectionDimensions }
        delete next[sectionId]
        const nextZones = { ...(structureConfig.sectionZone || {}) }
        delete nextZones[sectionId]
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: next,
          sectionZone: nextZones
        })
      }}
    >
      {children}
    </StructuralBoxWrapper>
  )
}

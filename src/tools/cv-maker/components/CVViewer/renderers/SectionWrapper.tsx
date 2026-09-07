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
  const baseCategory = category || (sectionId.endsWith('_title') ? sectionId.replace('_title', '') : undefined)
  const rawDims = structureConfig?.sectionDimensions?.[sectionId]
  const parentDims = baseCategory ? structureConfig?.sectionDimensions?.[baseCategory] : undefined
  const effectiveDims: SectionBoxDimensions = {
    ...parentDims,
    ...rawDims,
    fontFamily: rawDims?.fontFamily || parentDims?.fontFamily,
    fontSizeScale: rawDims?.fontSizeScale ?? parentDims?.fontSizeScale,
    variant: rawDims?.variant || parentDims?.variant,
    hidden: rawDims?.hidden ?? parentDims?.hidden
  }

  if (effectiveDims.hidden && !isFreeCanvas) {
    return null
  }

  if (!isFreeCanvas) {
    const widthPercent = effectiveDims.widthPercent
    const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
    const hasCustomFont = Boolean(effectiveDims.fontFamily)
    const hasCustomScale = typeof effectiveDims.fontSizeScale === 'number' && effectiveDims.fontSizeScale !== 1
    const alignment = effectiveDims.alignment

    if (hasCustomWidth || hasCustomFont || hasCustomScale || alignment || effectiveDims.order !== undefined) {
      const marginLeftStyle = alignment === 'center' || alignment === 'right' ? 'auto' : undefined
      const marginRightStyle = alignment === 'center' ? 'auto' : alignment === 'right' ? '0' : undefined

      return (
        <div
          key={sectionId}
          className="cv-atomic-box-wrapper cv-avoid-break"
          style={{
            width: hasCustomWidth ? `${widthPercent}%` : undefined,
            display: hasCustomWidth ? 'inline-block' : undefined,
            verticalAlign: hasCustomWidth ? 'top' : undefined,
            boxSizing: 'border-box',
            marginLeft: marginLeftStyle,
            marginRight: marginRightStyle,
            order: effectiveDims.order,
            fontFamily: effectiveDims.fontFamily ? `"${effectiveDims.fontFamily}", sans-serif` : undefined,
            fontSize: hasCustomScale ? `${effectiveDims.fontSizeScale}em` : undefined
          }}
          data-section-id={sectionId}
        >
          {children}
        </div>
      )
    }
    return <React.Fragment key={sectionId}>{children}</React.Fragment>
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
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [sectionId]: { ...cur, hidden: !cur.hidden }
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

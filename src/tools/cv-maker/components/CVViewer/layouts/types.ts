import React from 'react'
import type { CVData, LayoutBlueprint, LayoutStructureConfig } from '../../../types/cv'

export interface SectionRenderers {
  wrapSection: (
    sectionId: string,
    title: string,
    node: React.ReactNode,
    defaultZone?: 'left' | 'right',
    category?: string
  ) => React.ReactNode

  renderZoneSection: (
    secId: string,
    targetZone: 'left' | 'right',
    defZone: 'left' | 'right',
    title: string,
    node: React.ReactNode,
    category?: string
  ) => React.ReactNode

  renderPhotoSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    onlyInFreeCanvas?: boolean
  ) => React.ReactNode

  renderWorkSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderEducationSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderProjectsSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderLanguagesSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderSkillsSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderCertificatesSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderInterestsSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderReferencesSection: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right',
    fallbackTitle?: string,
    customTitleNode?: React.ReactNode,
    containerWrapper?: (items: React.ReactNode) => React.ReactNode
  ) => React.ReactNode

  renderCustomAstSections?: (
    targetZone?: 'left' | 'right',
    defZone?: 'left' | 'right'
  ) => React.ReactNode

  handleMoveStep?: (secId: string, direction: -1 | 1) => void

  getDynamicMathSections: () => string[]
}

export interface BaseLayoutProps {
  data: CVData
  blueprint: LayoutBlueprint
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  isFreeCanvas: boolean
  renderers: SectionRenderers
  handleUpdateSplitRatio: (ratio: number) => void
  renderCanvasDecorations: () => React.ReactNode
  pageNumber?: number
  totalPages?: number
  showPageFooter?: boolean
  showContinuationHeader?: boolean
  pageLabel?: string
}

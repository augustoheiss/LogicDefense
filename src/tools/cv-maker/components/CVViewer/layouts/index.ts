import React from 'react'
import type { BaseLayoutProps } from './types'
import { LayoutEditorialAccent } from './LayoutEditorialAccent'
import { LayoutCorporateTimeline } from './LayoutCorporateTimeline'
import { LayoutHeroMatrix } from './LayoutHeroMatrix'
import { LayoutCompactSplit } from './LayoutCompactSplit'
import { LayoutSidebar } from './LayoutSidebar'
import { LayoutDynamicMath } from './LayoutDynamicMath'
import { LayoutLinear } from './LayoutLinear'
import { LayoutCanvasLivre } from './LayoutCanvasLivre'
import { LayoutModular } from './LayoutModular'

export * from './types'
export * from './LayoutEditorialAccent'
export * from './LayoutCorporateTimeline'
export * from './LayoutHeroMatrix'
export * from './LayoutCompactSplit'
export * from './LayoutSidebar'
export * from './LayoutDynamicMath'
export * from './LayoutLinear'
export * from './LayoutCanvasLivre'
export * from './LayoutModular'

const layoutMap: Record<string, React.FC<BaseLayoutProps>> = {
  editorial_accent: LayoutEditorialAccent,
  corporate_timeline: LayoutCorporateTimeline,
  hero_matrix: LayoutHeroMatrix,
  compact_split: LayoutCompactSplit,
  sidebar: LayoutSidebar,
  dynamic_math: LayoutDynamicMath,
  linear: LayoutLinear,
  canvas_livre: LayoutCanvasLivre,
  modular: LayoutModular
}

export function getLayoutComponent(blueprintId: string): React.FC<BaseLayoutProps> {
  return layoutMap[blueprintId] || LayoutModular
}

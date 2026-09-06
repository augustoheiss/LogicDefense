import React from 'react'
import type { CVData, ThemeVariant, LayoutVariant, ViewMode, CVDesignConfig, LayoutStructureConfig, PageFormat, ZoomMode } from '../../types/cv'
import { getLayoutBlueprint } from '../../engine/blueprints'
import { PageFormatEngine } from '../../engine/PageFormatEngine'
import { CVPrintContainer } from './CVPrintContainer'
import { UniversalLayoutRenderer } from './UniversalLayoutRenderer'
import { CVPageViewportScaler } from './CVPageViewportScaler'

interface CVViewerProps {
  data: CVData | null
  theme?: ThemeVariant
  layout?: LayoutVariant
  viewMode?: ViewMode
  designConfig?: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  pageFormat?: PageFormat
  zoomMode?: ZoomMode
  onScaleChange?: (currentScale: number) => void
}

export const CVViewer: React.FC<CVViewerProps> = ({
  data,
  theme = 'executive',
  layout = 'modular',
  viewMode = 'cv',
  designConfig,
  onRequestGenerateCoverLetter,
  structureConfig,
  onUpdateStructureConfig,
  pageFormat = 'a4',
  zoomMode = 'auto',
  onScaleChange
}) => {
  if (!data || !data.basics) {
    return (
      <div className="cv-empty-state">
        <span className="cv-empty-state__icon">📄</span>
        <h3>Nenhum currículo carregado</h3>
        <p>Cole o texto do seu currículo ou gere novas versões com a IA no painel ao lado.</p>
      </div>
    )
  }

  const blueprint = getLayoutBlueprint(layout)
  const dimension = PageFormatEngine.getDimension(pageFormat)

  return (
    <CVPageViewportScaler
      pageWidthPx={dimension.widthPx}
      pageHeightPx={dimension.heightPx}
      zoomMode={zoomMode}
      onScaleChange={onScaleChange}
    >
      <CVPrintContainer>
        <UniversalLayoutRenderer
          data={data}
          blueprint={blueprint}
          theme={theme}
          viewMode={viewMode}
          designConfig={designConfig}
          onRequestGenerateCoverLetter={onRequestGenerateCoverLetter}
          structureConfig={structureConfig}
          onUpdateStructureConfig={onUpdateStructureConfig}
        />
      </CVPrintContainer>
    </CVPageViewportScaler>
  )
}


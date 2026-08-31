import React from 'react'
import type { CVData, ThemeVariant, LayoutVariant, ViewMode, CVDesignConfig } from '../../types/cv'
import { getLayoutBlueprint } from '../../engine/blueprints'
import { CVPrintContainer } from './CVPrintContainer'
import { UniversalLayoutRenderer } from './UniversalLayoutRenderer'

interface CVViewerProps {
  data: CVData | null
  theme?: ThemeVariant
  layout?: LayoutVariant
  viewMode?: ViewMode
  designConfig?: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
}

export const CVViewer: React.FC<CVViewerProps> = ({
  data,
  theme = 'executive',
  layout = 'modular',
  viewMode = 'cv',
  designConfig,
  onRequestGenerateCoverLetter
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

  return (
    <CVPrintContainer>
      <UniversalLayoutRenderer
        data={data}
        blueprint={blueprint}
        theme={theme}
        viewMode={viewMode}
        designConfig={designConfig}
        onRequestGenerateCoverLetter={onRequestGenerateCoverLetter}
      />
    </CVPrintContainer>
  )
}

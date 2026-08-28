import React from 'react'
import type { CVData, ThemeVariant } from '../../types/cv'
import { CVPrintContainer } from './CVPrintContainer'
import { CVHeader } from './CVHeader'
import { CVWork } from './CVWork'
import { CVEducation } from './CVEducation'
import { CVProjects } from './CVProjects'
import { CVSkills } from './CVSkills'
import { CVLanguages } from './CVLanguages'
import { CVInterests } from './CVInterests'
import { CVOptional } from './CVOptional'

interface CVViewerProps {
  data: CVData | null
  theme?: ThemeVariant
}

export const CVViewer: React.FC<CVViewerProps> = ({ data, theme = 'executive' }) => {
  if (!data || !data.basics) {
    return (
      <div className="cv-empty-state">
        <span className="cv-empty-state__icon">📄</span>
        <h3>Nenhum currículo carregado</h3>
        <p>Cole o texto do seu currículo ou gere novas versões com a IA no painel ao lado.</p>
      </div>
    )
  }

  return (
    <div className={`cv-viewer-container theme-${theme}`}>
      <CVPrintContainer>
        <div className="cv-card">
          <CVHeader basics={data.basics} />
          {data.work && <CVWork work={data.work} />}
          {data.projects && <CVProjects projects={data.projects} />}
          {data.skills && <CVSkills skills={data.skills} />}
          {data.education && <CVEducation education={data.education} />}
          {data.languages && <CVLanguages languages={data.languages} />}
          <CVOptional certificates={data.certificates} awards={data.awards} volunteer={data.volunteer} />
          {data.interests && <CVInterests interests={data.interests} />}
        </div>
      </CVPrintContainer>
    </div>
  )
}

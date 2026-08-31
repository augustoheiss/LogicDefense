import React from 'react'
import type { BlockIdentifier, CVData, LayoutBlueprint } from '../../types/cv'
import { BlockHeader } from './BlockHeader'
import { BlockContacts } from './BlockContacts'
import { BlockCivilData } from './BlockCivilData'
import { BlockPhoto } from './BlockPhoto'
import { BlockSummary } from './BlockSummary'
import { BlockWork } from './BlockWork'
import { BlockProjects } from './BlockProjects'
import { BlockEducation } from './BlockEducation'
import { BlockSkillsTags } from './BlockSkillsTags'
import { BlockSkillsBars } from './BlockSkillsBars'
import { BlockLanguages } from './BlockLanguages'
import { BlockCertificates } from './BlockCertificates'
import { BlockReferences } from './BlockReferences'
import { BlockInterests } from './BlockInterests'
import { BlockCoverLetter } from './BlockCoverLetter'

interface AtomicBlockRendererProps {
  blockId: BlockIdentifier
  data: CVData
  blueprint: LayoutBlueprint
  zoneName: 'hero' | 'sidebar' | 'main' | 'footer'
  onRequestGenerateCoverLetter?: () => void
}

export const AtomicBlockRenderer: React.FC<AtomicBlockRendererProps> = ({
  blockId,
  data,
  blueprint,
  zoneName,
  onRequestGenerateCoverLetter
}) => {
  const { basics } = data
  const isSidebar = zoneName === 'sidebar'

  switch (blockId) {
    case 'header':
      return (
        <BlockHeader
          basics={basics}
          variant={
            blueprint.id === 'editorial_accent' || blueprint.id === 'warm_magazine'
              ? 'brand_block'
              : blueprint.id === 'hero_matrix'
              ? 'hero'
              : 'standard'
          }
        />
      )

    case 'photo':
      return (
        <BlockPhoto
          image={basics.image}
          altName={basics.name}
          shape={
            blueprint.id === 'editorial_accent'
              ? 'vertical'
              : blueprint.id === 'corporate_timeline'
              ? 'square'
              : 'circle'
          }
        />
      )

    case 'contacts':
      return (
        <BlockContacts
          basics={basics}
          layoutStyle={
            blueprint.id === 'hero_matrix' && zoneName === 'hero'
              ? 'top_bar'
              : isSidebar
              ? 'list'
              : 'row'
          }
        />
      )

    case 'civil':
      return <BlockCivilData basics={basics} />

    case 'summary':
      return (
        <BlockSummary
          basics={basics}
          title={isSidebar ? 'Perfil' : 'Sobre Mim'}
          showQuote={!isSidebar}
        />
      )

    case 'quote':
      return basics.quote ? (
        <blockquote className="cv-quote">"{basics.quote}"</blockquote>
      ) : null

    case 'work':
      return <BlockWork work={data.work} />

    case 'projects':
      return <BlockProjects projects={data.projects} />

    case 'education':
      return <BlockEducation education={data.education} />

    case 'skills_tags':
      return <BlockSkillsTags skills={data.skills} />

    case 'skills_bars':
      return <BlockSkillsBars skills={data.skills} title={isSidebar ? 'Expertise' : 'Habilidades'} />

    case 'languages':
      return <BlockLanguages languages={data.languages} />

    case 'certificates':
      return <BlockCertificates certificates={data.certificates} />

    case 'references':
      return <BlockReferences references={data.references} />

    case 'interests':
      return (
        <BlockInterests
          interests={data.interests}
          layoutStyle={blueprint.id === 'compact_split' ? 'circles' : 'grid'}
        />
      )

    case 'cover_letter':
      return (
        <BlockCoverLetter
          coverLetter={data.coverLetter}
          basics={basics}
          onRequestGenerate={onRequestGenerateCoverLetter}
        />
      )

    default:
      return null
  }
}

import type { CVData, TextVariant } from '../../types/cv'
import { TEXT_LABELS } from '../../types/cv'
import { CVHeader } from './CVHeader'
import { CVWork } from './CVWork'
import { CVEducation } from './CVEducation'
import { CVSkills } from './CVSkills'
import { CVProjects } from './CVProjects'
import { CVLanguages } from './CVLanguages'
import { CVInterests } from './CVInterests'
import {
  CVVolunteerSection,
  CVPublications,
  CVCertificates,
  CVAwards,
} from './CVOptional'
import './CVViewer.css'
import './CVPrint.css'

interface Props {
  data: CVData
  activeText: TextVariant
}

export function CVViewer({ data, activeText }: Props) {
  const labels = TEXT_LABELS[activeText]

  return (
    <div className="cv-document" id="cv-print-root">
      <CVHeader basics={data.basics} />

      {data.work?.length ? (
        <CVWork work={data.work} sectionLabel={labels.work} />
      ) : null}

      {data.projects?.length ? (
        <CVProjects projects={data.projects} sectionLabel={labels.projects} />
      ) : null}

      {data.education?.length ? (
        <CVEducation education={data.education} sectionLabel={labels.education} />
      ) : null}

      {data.skills?.length ? (
        <CVSkills skills={data.skills} sectionLabel={labels.skills} />
      ) : null}

      {data.certificates?.length ? (
        <CVCertificates certificates={data.certificates} sectionLabel={labels.certificates} />
      ) : null}

      {data.languages?.length ? (
        <CVLanguages languages={data.languages} sectionLabel={labels.languages} />
      ) : null}

      {data.interests?.length ? (
        <CVInterests interests={data.interests} sectionLabel={labels.interests} />
      ) : null}

      {data.volunteer?.length ? (
        <CVVolunteerSection volunteer={data.volunteer} sectionLabel={labels.volunteer} />
      ) : null}

      {data.publications?.length ? (
        <CVPublications publications={data.publications} sectionLabel={labels.publications} />
      ) : null}

      {data.awards?.length ? (
        <CVAwards awards={data.awards} sectionLabel={labels.awards} />
      ) : null}
    </div>
  )
}

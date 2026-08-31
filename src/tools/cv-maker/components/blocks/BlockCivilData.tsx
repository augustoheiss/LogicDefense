import React from 'react'
import type { CVBasics } from '../../types/cv'

interface BlockCivilDataProps {
  basics: CVBasics
}

export const BlockCivilData: React.FC<BlockCivilDataProps> = ({ basics }) => {
  const hasCivil = basics.age || basics.civilStatus || basics.nationality || basics.driverLicense
  if (!hasCivil) return null

  return (
    <div className="cv-navy-civildata">
      <div className="cv-navy-civilitem">
        {basics.age && <span>{basics.age}</span>}
        {basics.civilStatus && <span> • {basics.civilStatus}</span>}
      </div>
      <div className="cv-navy-civilitem">
        {basics.nationality && <span>{basics.nationality}</span>}
        {basics.driverLicense && <span> • {basics.driverLicense}</span>}
      </div>
    </div>
  )
}

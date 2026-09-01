import React from 'react'
import type { CVReference } from '../../types/cv'

interface BlockReferencesProps {
  references?: CVReference[]
  title?: string
}

export const BlockReferences: React.FC<BlockReferencesProps> = ({
  references,
  title = 'Referências Profissionais'
}) => {
  if (!references || references.length === 0) return null

  return (
    <section className="cv-section">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-references-grid">
        {references.map((ref, idx) => (
          <div key={idx} className="cv-ref-card cv-avoid-break">
            <div className="cv-ref-name">{ref.name}</div>
            <div className="cv-ref-sub">
              {ref.position && <span>{ref.position}</span>}
              {ref.company && <span> • {ref.company}</span>}
            </div>
            <div className="cv-ref-contact">
              {ref.phone && <span>📞 {ref.phone}</span>}
              {ref.email && <span>✉ {ref.email}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

import React from 'react'
import type { CVCertificate, CVAward, CVVolunteer } from '../../types/cv'

interface CVOptionalProps {
  certificates?: CVCertificate[]
  awards?: CVAward[]
  volunteer?: CVVolunteer[]
}

export const CVOptional: React.FC<CVOptionalProps> = ({ certificates, awards, volunteer }) => {
  return (
    <>
      {certificates && certificates.length > 0 && (
        <section className="cv-section cv-avoid-break">
          <h2 className="cv-section-title">
            <span>📜</span> Certificações & Licenças
          </h2>
          <div className="cv-grid-2col">
            {certificates.map((cert, idx) => (
              <div key={idx} className="cv-simple-item">
                <h4 className="cv-item-title">
                  {cert.url ? (
                    <a href={cert.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                      {cert.name} ↗
                    </a>
                  ) : (
                    cert.name
                  )}
                </h4>
                <p>
                  {cert.issuer} {cert.date && <span className="cv-meta-tag">{cert.date}</span>}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {awards && awards.length > 0 && (
        <section className="cv-section cv-avoid-break">
          <h2 className="cv-section-title">
            <span>🏆</span> Reconhecimentos & Prêmios
          </h2>
          <div className="cv-grid-2col">
            {awards.map((award, idx) => (
              <div key={idx} className="cv-simple-item">
                <h4 className="cv-item-title">{award.title}</h4>
                <p>
                  {award.awarder} {award.date && <span className="cv-meta-tag">{award.date}</span>}
                </p>
                {award.summary && <p className="cv-item-summary">{award.summary}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {volunteer && volunteer.length > 0 && (
        <section className="cv-section cv-avoid-break">
          <h2 className="cv-section-title">
            <span>🤝</span> Voluntariado & Comunidade
          </h2>
          <div className="cv-work-list">
            {volunteer.map((item, idx) => (
              <div key={idx} className="cv-work-item cv-avoid-break">
                <div className="cv-item-header">
                  <h3 className="cv-item-title">{item.position}</h3>
                  <span className="cv-item-date cv-meta-tag">
                    {item.startDate} {item.endDate ? `— ${item.endDate}` : ''}
                  </span>
                </div>
                <div className="cv-item-company">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                      {item.organization}
                    </a>
                  ) : (
                    <span>{item.organization}</span>
                  )}
                </div>
                {item.summary && <p className="cv-item-summary">{item.summary}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

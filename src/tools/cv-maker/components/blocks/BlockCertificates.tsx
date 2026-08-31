import React from 'react'
import type { CVCertificate } from '../../types/cv'

interface BlockCertificatesProps {
  certificates?: CVCertificate[]
  title?: string
}

export const BlockCertificates: React.FC<BlockCertificatesProps> = ({
  certificates,
  title = 'Licenças & Certificações'
}) => {
  if (!certificates || certificates.length === 0) return null

  return (
    <section className="cv-section cv-avoid-break">
      <h3 className="cv-section-title">{title}</h3>
      <div className="cv-items-list">
        {certificates.map((cert, idx) => (
          <div key={idx} className="cv-item" style={{ marginBottom: '0.4rem' }}>
            <div className="cv-item-header">
              <span className="cv-item-title" style={{ fontSize: '0.85rem' }}>{cert.name}</span>
              {cert.date && <span className="cv-item-date">{cert.date}</span>}
            </div>
            {cert.issuer && (
              <div className="cv-item-sub">
                {cert.url ? (
                  <a href={cert.url} target="_blank" rel="noopener noreferrer" className="cv-link">
                    {cert.issuer}
                  </a>
                ) : (
                  <span>{cert.issuer}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

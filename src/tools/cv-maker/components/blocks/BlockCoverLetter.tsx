import React from 'react'
import type { CoverLetter, CVBasics } from '../../types/cv'

interface BlockCoverLetterProps {
  coverLetter?: CoverLetter
  basics: CVBasics
  onRequestGenerate?: () => void
}

export const BlockCoverLetter: React.FC<BlockCoverLetterProps> = ({
  coverLetter,
  basics,
  onRequestGenerate
}) => {
  if (!coverLetter) {
    return (
      <div className="cv-cover-letter-placeholder">
        <span style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✉️</span>
        <h3>Nenhuma Carta de Apresentação Gerada</h3>
        <p>
          Adicione a seção <code>coverLetter:</code> ao seu YAML ou utilize a nossa IA para redigir
          uma carta de apresentação altamente persuasiva e personalizada.
        </p>
        {onRequestGenerate && (
          <button
            onClick={onRequestGenerate}
            className="cv-btn cv-btn-primary"
            style={{ marginTop: '1rem' }}
          >
            ✨ Gerar Cover Letter com IA
          </button>
        )}
      </div>
    )
  }

  const { recipient, date, subject, salutation, paragraphs, closing, signature, signatureImage } = coverLetter

  return (
    <article className="cv-cover-letter-body">
      {recipient && (
        <div className="cv-cover-recipient">
          {recipient.name && <div className="cv-cover-recipient-name">{recipient.name}</div>}
          {recipient.title && <div className="cv-cover-recipient-title">{recipient.title}</div>}
          {recipient.company && <div className="cv-cover-recipient-company">{recipient.company}</div>}
          {recipient.address && <div className="cv-cover-recipient-address">{recipient.address}</div>}
        </div>
      )}

      {date && <div className="cv-cover-date">{date}</div>}
      {subject && <div className="cv-cover-subject"><strong>Assunto:</strong> {subject}</div>}
      {salutation && <div className="cv-cover-salutation">{salutation}</div>}

      <div className="cv-cover-paragraphs">
        {paragraphs && paragraphs.map((para, idx) => (
          <p key={idx} className="cv-cover-para">{para}</p>
        ))}
      </div>

      <div className="cv-cover-closing-block">
        <div className="cv-cover-closing">{closing || 'Atenciosamente,'}</div>
        {signatureImage && (
          <div className="cv-cover-sig-image-wrap">
            <img src={signatureImage} alt="Assinatura" className="cv-cover-sig-image" />
          </div>
        )}
        <div className="cv-cover-signature">{signature || basics.name}</div>
        {basics.label && <div className="cv-cover-signer-label">{basics.label}</div>}
      </div>
    </article>
  )
}

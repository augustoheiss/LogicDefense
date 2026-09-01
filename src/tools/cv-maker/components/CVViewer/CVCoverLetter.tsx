import React from 'react'
import type { CoverLetter, CVBasics, LayoutVariant, ThemeVariant } from '../../types/cv'

interface CVCoverLetterProps {
  coverLetter?: CoverLetter
  basics: CVBasics
  layout: LayoutVariant
  theme: ThemeVariant
  onRequestGenerate?: () => void
}

export const CVCoverLetter: React.FC<CVCoverLetterProps> = ({
  coverLetter,
  basics,
  layout,
  onRequestGenerate
}) => {
  const paragraphs = coverLetter?.paragraphs && coverLetter.paragraphs.length > 0
    ? coverLetter.paragraphs
    : (coverLetter?.body ? coverLetter.body.split('\n\n').map(p => p.trim()).filter(Boolean) : [])

  if (!coverLetter || paragraphs.length === 0) {
    return (
      <div className="cv-page-a4 cv-cover-letter-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="cv-card" style={{ textAlign: 'center', maxWidth: '480px', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>Carta de Apresentação não configurada</h3>
          <p style={{ fontSize: '0.88rem', opacity: 0.8, lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Personalize uma carta de apresentação elegante e direcionada para a vaga sem alterar seus dados do currículo.
          </p>
          {onRequestGenerate && (
            <button
              onClick={onRequestGenerate}
              className="no-print"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              ✨ Gerar Carta de Apresentação com IA
            </button>
          )}
        </div>
      </div>
    )
  }

  const { date, subject, salutation, closing, signature, signatureImage } = coverLetter
  const rawRecipient = coverLetter.recipient
  const recipient = typeof rawRecipient === 'string'
    ? { name: rawRecipient, company: coverLetter.company }
    : (rawRecipient ? { ...rawRecipient, company: rawRecipient.company || coverLetter.company } : undefined)
  const locationStr = basics.location
    ? [basics.location.city, basics.location.region, basics.location.countryCode].filter(Boolean).join(', ')
    : ''

  const renderSignature = () => {
    if (signatureImage) {
      return (
        <div className="cv-signature-box">
          <img src={signatureImage} alt="Assinatura" className="cv-signature-img" />
          <div className="cv-signature-printed">{signature || basics.name}</div>
        </div>
      )
    }
    return (
      <div className="cv-signature-box">
        <div className="cv-signature-cursive">{signature || basics.name}</div>
        <div className="cv-signature-printed">{signature || basics.name}</div>
      </div>
    )
  }

  // ── Renderização com Paridade de Wireframe para cada Layout ──

  // Layout 04: Executive Duo (Victoria Wotton)
  if (layout === 'compact_split') {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card cv-duo-layout">
          <aside className="cv-duo-left">
            {basics.image && (
              <div className="cv-avatar-container">
                <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
              </div>
            )}
            {recipient && (
              <div className="cv-cover-recipient-block">
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>DESTINATÁRIO</div>
                <div style={{ fontWeight: 700 }}>{recipient.name}</div>
                {recipient.title && <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{recipient.title}</div>}
                {recipient.company && <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{recipient.company}</div>}
                {recipient.address && <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{recipient.address}</div>}
              </div>
            )}
            {date && <div className="cv-cover-date">📅 {date}</div>}
          </aside>

          <main className="cv-main-col">
            <header className="cv-duo-header">
              <h1 className="cv-name" style={{ margin: 0, fontSize: '1.8rem' }}>{basics.name}</h1>
              {basics.label && <div style={{ fontSize: '0.9rem', opacity: 0.85, fontWeight: 600 }}>{basics.label}</div>}
              <div className="cv-duo-contacts">
                {basics.email && <span>✉ {basics.email}</span>}
                {basics.phone && <span>📞 {basics.phone}</span>}
                {locationStr && <span>📍 {locationStr}</span>}
              </div>
            </header>

            <div className="cv-cover-letter-body">
              <h3 className="cv-section-title" style={{ borderBottom: '1px solid rgba(125,125,125,0.2)', paddingBottom: '0.25rem' }}>
                Carta de Apresentação
              </h3>
              {subject && <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.92rem' }}>{subject}</div>}
              {salutation && <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{salutation}</div>}
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {closing && <div style={{ marginTop: '1.25rem', fontWeight: 600 }}>{closing}</div>}
              {renderSignature()}
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Layout 06: Corporate Navy Timeline (Wilkins Micawber)
  if (layout === 'corporate_timeline') {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card cv-navy-layout">
          <aside className="cv-navy-sidebar">
            {basics.image && (
              <div className="cv-avatar-container">
                <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>{basics.name}</h2>
              {basics.label && <div style={{ fontSize: '0.8rem', opacity: 0.8, color: '#f97316' }}>{basics.label}</div>}
            </div>

            {recipient && (
              <div style={{ marginTop: '1.5rem', borderLeft: '2px solid #f97316', paddingLeft: '0.65rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#f97316' }}>PARA:</div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{recipient.name}</div>
                {recipient.title && <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>{recipient.title}</div>}
                {recipient.company && <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{recipient.company}</div>}
              </div>
            )}

            {date && <div style={{ fontSize: '0.78rem', opacity: 0.75, marginTop: '0.5rem' }}>{date}</div>}
          </aside>

          <main className="cv-navy-main">
            <h2 className="cv-section-title" style={{ borderBottom: '2px solid currentColor', paddingBottom: '0.3rem' }}>
              Carta de Apresentação
            </h2>
            <div className="cv-cover-letter-body" style={{ borderLeft: '2px solid #f97316', paddingLeft: '1.25rem' }}>
              {subject && <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.92rem' }}>{subject}</div>}
              {salutation && <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{salutation}</div>}
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {closing && <div style={{ marginTop: '1.25rem', fontWeight: 600 }}>{closing}</div>}
              {renderSignature()}
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Layout 05: Brand Block (Basil Hailward)
  if (layout === 'editorial_accent') {
    return (
      <div className="cv-page-a4 cv-cover-letter-page">
        <div className="cv-card">
          <header className="cv-brand-header">
            {basics.image && (
              <div className="cv-avatar-container" style={{ borderRadius: '6px' }}>
                <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
              </div>
            )}
            <div>
              <div className="cv-brand-greeting">olá, eu sou</div>
              <h1 className="cv-name" style={{ margin: 0 }}>{basics.name}</h1>
              {basics.label && <div style={{ fontSize: '0.95rem', fontWeight: 600, opacity: 0.85 }}>{basics.label}</div>}
            </div>
          </header>

          <div className="cv-editorial-grid">
            <aside>
              {recipient && (
                <div className="cv-cover-recipient-block">
                  <div style={{ fontWeight: 700 }}>{recipient.name}</div>
                  {recipient.title && <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{recipient.title}</div>}
                  {recipient.company && <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{recipient.company}</div>}
                </div>
              )}
              {date && <div className="cv-cover-date">📅 {date}</div>}
            </aside>

            <main className="cv-cover-letter-body">
              <h3 className="cv-section-title">Carta de Apresentação</h3>
              {subject && <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.92rem' }}>{subject}</div>}
              {salutation && <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{salutation}</div>}
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {closing && <div style={{ marginTop: '1.25rem', fontWeight: 600 }}>{closing}</div>}
              {renderSignature()}
            </main>
          </div>
        </div>
      </div>
    )
  }

  // Padrão Geral (Modular, Linear, Sidebar, Warm Magazine, Hero Matrix)
  return (
    <div className="cv-page-a4 cv-cover-letter-page">
      <div className="cv-card">
        <header className="cv-header">
          <div className="cv-header__top">
            <div className="cv-header__profile">
              {basics.image && (
                <div className="cv-avatar-container">
                  <img src={basics.image} alt={basics.name} className="cv-avatar-img" />
                </div>
              )}
              <div>
                <h1 className="cv-name">{basics.name}</h1>
                <div className="cv-label-row">
                  {basics.label && <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{basics.label}</span>}
                </div>
              </div>
            </div>

            <div className="cv-contacts">
              {basics.email && <a href={`mailto:${basics.email}`}>✉ {basics.email}</a>}
              {basics.phone && <span>📞 {basics.phone}</span>}
              {locationStr && <span>📍 {locationStr}</span>}
              {basics.url && <a href={basics.url} target="_blank" rel="noopener noreferrer">🌐 {basics.url.replace(/^https?:\/\//, '')}</a>}
            </div>
          </div>
        </header>

        {recipient && (
          <div className="cv-cover-recipient-block">
            <div style={{ fontWeight: 700 }}>{recipient.name}</div>
            {recipient.title && <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{recipient.title}</div>}
            {recipient.company && <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{recipient.company}</div>}
            {recipient.address && <div style={{ fontSize: '0.78rem', opacity: 0.75 }}>{recipient.address}</div>}
          </div>
        )}

        {date && <div className="cv-cover-date">📅 {date}</div>}

        <main className="cv-cover-letter-body">
          <h2 className="cv-section-title">Carta de Apresentação</h2>
          {subject && <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.95rem' }}>{subject}</div>}
          {salutation && <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{salutation}</div>}
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {closing && <div style={{ marginTop: '1.5rem', fontWeight: 600 }}>{closing}</div>}
          {renderSignature()}
        </main>
      </div>
    </div>
  )
}

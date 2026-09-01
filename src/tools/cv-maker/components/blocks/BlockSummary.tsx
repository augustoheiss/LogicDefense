import React from 'react'
import type { CVBasics } from '../../types/cv'

interface BlockSummaryProps {
  basics: CVBasics
  title?: string
  showQuote?: boolean
}

export const BlockSummary: React.FC<BlockSummaryProps> = ({
  basics,
  title = 'Sobre Mim',
  showQuote = true
}) => {
  if (!basics.summary && !basics.quote) return null

  return (
    <section className="cv-section cv-section-summary cv-avoid-break">
      <h3 className="cv-section-title">{title}</h3>
      {basics.summary && <p className="cv-summary-text">{basics.summary}</p>}
      {showQuote && basics.quote && (
        <blockquote className="cv-quote">"{basics.quote}"</blockquote>
      )}
    </section>
  )
}

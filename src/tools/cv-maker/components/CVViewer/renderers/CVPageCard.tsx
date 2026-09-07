import React from 'react'

export interface CVPageCardProps {
  pageNumber: number
  totalPages: number
  candidateName?: string
  candidateLabel?: string
  pageLabel?: string
  showContinuationHeader?: boolean
  showPageFooter?: boolean
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export const CVPageCard: React.FC<CVPageCardProps> = ({
  pageNumber,
  totalPages,
  candidateName,
  candidateLabel,
  pageLabel,
  showContinuationHeader = true,
  showPageFooter = true,
  className = '',
  style,
  children
}) => {
  const isMultiPage = totalPages > 1
  const isContinuation = pageNumber > 1

  return (
    <div
      className={`cv-page-a4 cv-page-card ${className}`}
      data-page-number={pageNumber}
      data-total-pages={totalPages}
      style={style}
    >
      {/* Badge visual do editor (Figma / Docs style) — invisível na impressão */}
      {isMultiPage && (
        <div className="cv-page-indicator-badge cv-no-print" data-cv-interactive="true">
          <span className="cv-page-badge-icon">📄</span>
          <span className="cv-page-badge-text">Folha {pageNumber} de {totalPages}</span>
          {pageLabel && <span className="cv-page-badge-sub">• {pageLabel}</span>}
        </div>
      )}

      {/* Cabeçalho de continuação automático na Folha 2+ */}
      {isContinuation && showContinuationHeader && candidateName && (
        <header className="cv-continuation-header cv-avoid-break">
          <div className="cv-continuation-inner">
            <span className="cv-continuation-name">{candidateName}</span>
            {candidateLabel && <span className="cv-continuation-label"> • {candidateLabel}</span>}
            <span className="cv-continuation-tag">— Continuação</span>
          </div>
          <div className="cv-continuation-rule" />
        </header>
      )}

      {/* Conteúdo principal da folha */}
      <div className="cv-page-content">
        {children}
      </div>

      {/* Rodapé numerado oficial para documentos multi-páginas */}
      {isMultiPage && showPageFooter && (
        <footer className="cv-page-footer cv-avoid-break">
          <div className="cv-footer-rule" />
          <div className="cv-footer-inner">
            <span className="cv-footer-candidate">{candidateName || ''}</span>
            <span className="cv-footer-pagination">Página {pageNumber} de {totalPages}</span>
          </div>
        </footer>
      )}
    </div>
  )
}

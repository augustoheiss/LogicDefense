import React from 'react'
import type { CVData, LayoutArchetype } from '../../types/cv'
import { CVPageCard } from '../CVViewer/renderers/CVPageCard'
import { UniversalSectionDispatcher } from './UniversalSectionDispatcher'

interface UniversalDocumentRendererProps {
  data: CVData
  onUpdateArchetype?: (sectionKey: string, newArchetype: LayoutArchetype) => void
  pageNumber?: number
  totalPages?: number
}

export const UniversalDocumentRenderer: React.FC<UniversalDocumentRendererProps> = ({
  data,
  onUpdateArchetype,
  pageNumber = 1,
  totalPages = 1
}) => {
  const ast = data.meta?.universalAST
  const blocks = ast?.blocks || []
  const { basics } = data

  // Filtra blocos: seções padrão de contato/basics são sintetizadas no cabeçalho executivo
  const bodyBlocks = blocks.filter(b => b.key !== 'basics' && b.key !== 'meta' && b.key !== 'document_title' && b.key !== 'title')

  return (
    <CVPageCard
      pageNumber={pageNumber}
      totalPages={totalPages}
      candidateName={basics.name || 'Documento Universal'}
      candidateLabel={basics.label}
      pageLabel="Documento Executivo"
      showPageFooter={true}
      showContinuationHeader={pageNumber > 1}
    >
      <div
        className="cv-card cv-universal-document-card"
        style={{
          padding: '2.2rem 2.4rem',
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
      >
        {/* Cabeçalho Executivo do Documento Universal */}
        <header
          className="cv-universal-header"
          style={{
            marginBottom: '1.6rem',
            paddingBottom: '1.2rem',
            borderBottom: '2.5px solid var(--cv-color-primary, #0f172a)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <h1
                className="cv-universal-title"
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  letterSpacing: '-0.025em',
                  color: 'var(--cv-color-primary, #0f172a)',
                  margin: '0 0 0.4rem 0',
                  lineHeight: 1.2
                }}
              >
                {basics.name || 'Documento Técnico Universal'}
              </h1>

              {basics.label && (
                <div
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 600,
                    color: 'var(--cv-color-secondary, #2563eb)',
                    marginBottom: '0.5rem'
                  }}
                >
                  {basics.label}
                </div>
              )}

              {basics.summary && (
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--cv-color-text, #334155)',
                    lineHeight: 1.5,
                    margin: '0.5rem 0 0 0',
                    maxWidth: '680px'
                  }}
                >
                  {basics.summary}
                </p>
              )}
            </div>

            {/* Metadados de Contato / Emissão */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                fontSize: '0.78rem',
                color: 'var(--cv-color-text-muted, #64748b)',
                textAlign: 'right'
              }}
            >
              {basics.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <span>✉</span>
                  <span>{basics.email}</span>
                </div>
              )}
              {basics.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <span>📞</span>
                  <span>{basics.phone}</span>
                </div>
              )}
              {basics.url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <span>🌐</span>
                  <span>{basics.url}</span>
                </div>
              )}
              {data.meta?.lastModified && (
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Atualizado em: {new Date(data.meta.lastModified).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Corpo com Todas as Seções do AST Universal */}
        <main className="cv-universal-body" style={{ flex: 1 }}>
          {bodyBlocks.map((block) => (
            <UniversalSectionDispatcher
              key={block.key}
              block={block}
              onUpdateArchetype={onUpdateArchetype}
            />
          ))}

          {bodyBlocks.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              <p>Nenhuma seção adicional detectada no documento.</p>
            </div>
          )}
        </main>
      </div>
    </CVPageCard>
  )
}

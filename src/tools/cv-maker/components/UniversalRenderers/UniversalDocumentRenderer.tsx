import React from 'react'
import type { CVData, LayoutArchetype, LayoutStructureConfig, SectionBoxDimensions } from '../../types/cv'
import { CVPageCard } from '../CVViewer/renderers/CVPageCard'
import { UniversalSectionDispatcher } from './UniversalSectionDispatcher'
import { StructuralBoxWrapper } from '../CanvasBuilder/StructuralBoxWrapper'
import { BlockPhoto } from '../blocks/BlockPhoto'

interface UniversalDocumentRendererProps {
  data: CVData
  onUpdateArchetype?: (sectionKey: string, newArchetype: LayoutArchetype) => void
  pageNumber?: number
  totalPages?: number
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (cfg: LayoutStructureConfig) => void
  isFreeCanvas?: boolean
  onReorderSections?: (sourceIndex: number, targetIndex: number) => void
  onReorderSectionKey?: (sectionKey: string, direction: 'up' | 'down') => void
}

export const UniversalDocumentRenderer: React.FC<UniversalDocumentRendererProps> = ({
  data,
  onUpdateArchetype,
  pageNumber = 1,
  totalPages = 1,
  structureConfig,
  onUpdateStructureConfig,
  isFreeCanvas = false,
  onReorderSections,
  onReorderSectionKey
}) => {
  const ast = data.meta?.universalAST
  const blocks = ast?.blocks || []
  const { basics } = data

  const headerDims = structureConfig?.sectionDimensions?.['header'] || structureConfig?.sectionDimensions?.['basics']
  const summaryDims = structureConfig?.sectionDimensions?.['summary'] || structureConfig?.sectionDimensions?.['resumo']
  const photoDims = structureConfig?.sectionDimensions?.['photo']

  const summaryBlock = blocks.find(b => b.key === 'summary' || b.key === 'resumo')
  const summaryText = basics.summary || (typeof summaryBlock?.raw === 'string' ? summaryBlock.raw : '')

  // Filtra blocos: header (basics), meta e summary/resumo são renderizados com caixas dedicadas estruturais
  let bodyBlocks = blocks.filter(b =>
    b.key !== 'basics' &&
    b.key !== 'meta' &&
    b.key !== 'document_title' &&
    b.key !== 'title' &&
    b.key !== 'themeConfig' &&
    b.key !== 'summary' &&
    b.key !== 'resumo' &&
    b.key !== 'photo'
  )

  const bodyBlockMap = new Map(bodyBlocks.map(b => [b.key, b]))

  // Se structureConfig.sectionOrder foi definido, prioriza a ordenação personalizada do usuário
  if (structureConfig?.sectionOrder && structureConfig.sectionOrder.length > 0) {
    const orderMap = new Map<string, number>()
    structureConfig.sectionOrder.forEach((key, idx) => orderMap.set(key, idx))
    bodyBlocks = [...bodyBlocks].sort((a, b) => {
      const idxA = orderMap.has(a.key) ? (orderMap.get(a.key) as number) : 9999
      const idxB = orderMap.has(b.key) ? (orderMap.get(b.key) as number) : 9999
      return idxA - idxB
    })
  }

  // ── Renderizador do Cabeçalho Executivo com Caixa Estrutural ──
  const renderHeaderContent = () => (
    <header
      className="cv-universal-header"
      style={{
        marginBottom: isFreeCanvas ? 0 : '1.4rem',
        paddingBottom: '1.2rem',
        borderBottom: '2.5px solid var(--sec-header-border, var(--cv-color-primary, #0f172a))',
        backgroundColor: 'var(--sec-header-bg, transparent)',
        backgroundImage: 'var(--sec-header-bg-image, none)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'var(--sec-header-text, inherit)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h1
            className="cv-universal-title"
            style={{
              fontSize: '1.75rem',
              fontWeight: 900,
              letterSpacing: '-0.025em',
              color: 'var(--sec-header-title, var(--cv-color-primary, #0f172a))',
              margin: '0 0 0.4rem 0',
              lineHeight: 1.2
            }}
          >
            {basics.name || ast?.meta?.title || 'Documento Técnico Universal'}
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
          {basics.location && (basics.location.city || basics.location.region) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <span>📍</span>
              <span>{[basics.location.city, basics.location.region].filter(Boolean).join(', ')}</span>
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
  )

  const renderHeaderBox = () => {
    if (headerDims?.hidden && !isFreeCanvas) return null

    if (!isFreeCanvas) {
      const widthPercent = headerDims?.widthPercent
      const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
      const hasCustomScale = typeof headerDims?.fontSizeScale === 'number' && headerDims.fontSizeScale !== 1
      const fontScaleVal = headerDims?.fontSizeScale ?? 1.0

      return (
        <div
          key="header"
          className="cv-atomic-box-wrapper cv-section-header cv-avoid-break"
          style={{
            width: hasCustomWidth ? `${widthPercent}%` : undefined,
            display: hasCustomWidth ? 'inline-block' : undefined,
            verticalAlign: hasCustomWidth ? 'top' : undefined,
            boxSizing: 'border-box',
            order: headerDims?.order,
            fontFamily: headerDims?.fontFamily ? `"${headerDims.fontFamily}", sans-serif` : undefined,
            fontSize: hasCustomScale ? `${headerDims.fontSizeScale}em` : undefined,
            ['--cv-box-font-scale' as any]: fontScaleVal,
            ['--cv-box-font-family' as any]: headerDims?.fontFamily ? `"${headerDims.fontFamily}", sans-serif` : undefined,
          }}
          data-section-id="header"
        >
          {renderHeaderContent()}
        </div>
      )
    }

    return (
      <StructuralBoxWrapper
        key="header"
        sectionId="header"
        title="Identificação & Cabeçalho"
        category="header"
        isFreeCanvasActive={isFreeCanvas}
        dimensions={headerDims}
        onMoveUp={() => onReorderSectionKey?.('basics', 'up')}
        onMoveDown={() => onReorderSectionKey?.('basics', 'down')}
        onToggleHide={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.['header'] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              header: { ...cur, hidden: !cur.hidden },
              basics: { ...cur, hidden: !cur.hidden }
            }
          })
        }}
        onUpdateDimensions={(newDims: SectionBoxDimensions) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              header: newDims,
              basics: newDims
            }
          })
        }}
        onResetDimensions={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const next = { ...structureConfig.sectionDimensions }
          delete next['header']
          delete next['basics']
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: next
          })
        }}
      >
        {renderHeaderContent()}
      </StructuralBoxWrapper>
    )
  }

  // ── Renderizador do Resumo / Sumário com Caixa Estrutural ──
  const renderSummaryContent = () => (
    <div
      className="cv-universal-summary-box cv-section-summary"
      style={{
        marginBottom: isFreeCanvas ? 0 : '1.4rem',
        padding: '0.85rem 1.1rem',
        borderRadius: '6px',
        backgroundColor: 'var(--sec-summary-bg, #f8fafc)',
        border: '1px solid var(--sec-summary-border, #e2e8f0)',
        borderLeft: '4px solid var(--sec-summary-accent, var(--cv-color-primary, #0f172a))'
      }}
    >
      <div
        style={{
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--sec-summary-title, var(--cv-color-primary, #0f172a))',
          marginBottom: '0.35rem'
        }}
      >
        Resumo Executivo
      </div>
      <p
        style={{
          fontSize: '0.86rem',
          color: 'var(--sec-summary-text, var(--cv-color-text, #334155))',
          lineHeight: 1.6,
          margin: 0
        }}
      >
        {summaryText}
      </p>
    </div>
  )

  const renderSummaryBox = () => {
    if (!summaryText) return null
    if (summaryDims?.hidden && !isFreeCanvas) return null

    if (!isFreeCanvas) {
      const widthPercent = summaryDims?.widthPercent
      const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
      const hasCustomScale = typeof summaryDims?.fontSizeScale === 'number' && summaryDims.fontSizeScale !== 1
      const fontScaleVal = summaryDims?.fontSizeScale ?? 1.0

      return (
        <div
          key="summary"
          className="cv-atomic-box-wrapper cv-section-summary cv-avoid-break"
          style={{
            width: hasCustomWidth ? `${widthPercent}%` : undefined,
            display: hasCustomWidth ? 'inline-block' : undefined,
            verticalAlign: hasCustomWidth ? 'top' : undefined,
            boxSizing: 'border-box',
            order: summaryDims?.order,
            fontFamily: summaryDims?.fontFamily ? `"${summaryDims.fontFamily}", sans-serif` : undefined,
            fontSize: hasCustomScale ? `${summaryDims.fontSizeScale}em` : undefined,
            ['--cv-box-font-scale' as any]: fontScaleVal,
            ['--cv-box-font-family' as any]: summaryDims?.fontFamily ? `"${summaryDims.fontFamily}", sans-serif` : undefined,
          }}
          data-section-id="summary"
        >
          {renderSummaryContent()}
        </div>
      )
    }

    return (
      <StructuralBoxWrapper
        key="summary"
        sectionId="summary"
        title="Resumo Executivo"
        category="summary"
        isFreeCanvasActive={isFreeCanvas}
        dimensions={summaryDims}
        onMoveUp={() => onReorderSectionKey?.('summary', 'up')}
        onMoveDown={() => onReorderSectionKey?.('summary', 'down')}
        onToggleHide={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.['summary'] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              summary: { ...cur, hidden: !cur.hidden },
              resumo: { ...cur, hidden: !cur.hidden }
            }
          })
        }}
        onUpdateDimensions={(newDims: SectionBoxDimensions) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              summary: newDims,
              resumo: newDims
            }
          })
        }}
        onResetDimensions={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const next = { ...structureConfig.sectionDimensions }
          delete next['summary']
          delete next['resumo']
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: next
          })
        }}
      >
        {renderSummaryContent()}
      </StructuralBoxWrapper>
    )
  }

  // ── Renderizador de Foto / Logo com Caixa Estrutural ──
  const renderPhotoBox = () => {
    const showPhoto = Boolean(basics.image || photoDims?.variant || isFreeCanvas)
    if (!showPhoto) return null
    if (photoDims?.hidden && !isFreeCanvas) return null

    const photoNode = (
      <BlockPhoto
        image={basics.image}
        altName={basics.name}
        shape={(photoDims?.photoShape || photoDims?.variant || 'circle') as any}
        size={photoDims?.photoSize}
        borderWidth={photoDims?.photoBorderWidth}
        borderColor={photoDims?.photoBorderColor}
        shadow={photoDims?.photoShadow}
        align={photoDims?.alignment || photoDims?.photoAlign}
        posX={photoDims?.photoPosX ?? basics.imagePosX}
        posY={photoDims?.photoPosY ?? basics.imagePosY}
        scale={photoDims?.photoScale ?? basics.imageScale}
      />
    )

    if (!isFreeCanvas) {
      return (
        <div key="photo" className="cv-atomic-box-wrapper cv-section-photo" data-section-id="photo">
          {photoNode}
        </div>
      )
    }

    return (
      <StructuralBoxWrapper
        key="photo"
        sectionId="photo"
        title="Foto / Logo"
        category="photo"
        isFreeCanvasActive={isFreeCanvas}
        dimensions={photoDims}
        onToggleHide={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.['photo'] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              photo: { ...cur, hidden: !cur.hidden }
            }
          })
        }}
        onUpdateDimensions={(newDims: SectionBoxDimensions) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              photo: newDims
            }
          })
        }}
        onResetDimensions={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const next = { ...structureConfig.sectionDimensions }
          delete next['photo']
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: next
          })
        }}
      >
        {photoNode}
      </StructuralBoxWrapper>
    )
  }

  // ── Renderiza Seções Ordenadas ou Padrão ──
  const renderAllSections = () => {
    // Se há uma ordem explícita no layout
    if (structureConfig?.sectionOrder && structureConfig.sectionOrder.length > 0) {
      const renderedKeys = new Set<string>()
      const orderedNodes: React.ReactNode[] = []

      structureConfig.sectionOrder.forEach((secKey) => {
        if (secKey === 'photo') {
          renderedKeys.add('photo')
          orderedNodes.push(renderPhotoBox())
        } else if (secKey === 'header' || secKey === 'basics') {
          renderedKeys.add('header')
          renderedKeys.add('basics')
          orderedNodes.push(renderHeaderBox())
        } else if (secKey === 'summary' || secKey === 'resumo') {
          renderedKeys.add('summary')
          renderedKeys.add('resumo')
          orderedNodes.push(renderSummaryBox())
        } else if (bodyBlockMap.has(secKey)) {
          renderedKeys.add(secKey)
          const block = bodyBlockMap.get(secKey)!
          orderedNodes.push(
            <UniversalSectionDispatcher
              key={block.key}
              block={block}
              onUpdateArchetype={onUpdateArchetype}
              structureConfig={structureConfig}
              onUpdateStructureConfig={onUpdateStructureConfig}
              isFreeCanvas={isFreeCanvas}
              onMoveUp={() => onReorderSectionKey?.(block.key, 'up')}
              onMoveDown={() => onReorderSectionKey?.(block.key, 'down')}
            />
          )
        }
      })

      // Blocos remanescentes que não estavam no sectionOrder (adicionados no YAML recentemente)
      bodyBlocks.forEach((block) => {
        if (!renderedKeys.has(block.key)) {
          orderedNodes.push(
            <UniversalSectionDispatcher
              key={block.key}
              block={block}
              onUpdateArchetype={onUpdateArchetype}
              structureConfig={structureConfig}
              onUpdateStructureConfig={onUpdateStructureConfig}
              isFreeCanvas={isFreeCanvas}
              onMoveUp={() => onReorderSectionKey?.(block.key, 'up')}
              onMoveDown={() => onReorderSectionKey?.(block.key, 'down')}
            />
          )
        }
      })

      return orderedNodes
    }

    // Ordem padrão: Foto -> Cabeçalho -> Resumo -> Demais Seções do AST
    return (
      <>
        {renderPhotoBox()}
        {renderHeaderBox()}
        {renderSummaryBox()}
        <main className="cv-universal-body" style={{ flex: 1 }}>
          {bodyBlocks.map((block, idx) => (
            <UniversalSectionDispatcher
              key={block.key}
              block={block}
              onUpdateArchetype={onUpdateArchetype}
              structureConfig={structureConfig}
              onUpdateStructureConfig={onUpdateStructureConfig}
              isFreeCanvas={isFreeCanvas}
              onMoveUp={idx > 0 ? () => {
                if (onReorderSectionKey) {
                  onReorderSectionKey(block.key, 'up')
                } else if (onReorderSections) {
                  onReorderSections(idx, idx - 1)
                }
              } : undefined}
              onMoveDown={idx < bodyBlocks.length - 1 ? () => {
                if (onReorderSectionKey) {
                  onReorderSectionKey(block.key, 'down')
                } else if (onReorderSections) {
                  onReorderSections(idx, idx + 1)
                }
              } : undefined}
            />
          ))}

          {bodyBlocks.length === 0 && !summaryText && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              <p>Nenhuma seção adicional detectada no documento.</p>
            </div>
          )}
        </main>
      </>
    )
  }

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
        {renderAllSections()}
      </div>
    </CVPageCard>
  )
}

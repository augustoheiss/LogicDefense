import React from 'react'
import type { CVData, LayoutBlueprint, ThemeVariant, ViewMode, CVDesignConfig, LayoutStructureConfig } from '../../types/cv'
import { BlockCoverLetter } from '../blocks/BlockCoverLetter'
import { CanvasDecorations } from './renderers/CanvasDecorations'
import { CVPageCard } from './renderers/CVPageCard'
import { useSectionOrdering } from './hooks/useSectionOrdering'
import { useSectionRenderers } from './renderers/SectionRendererHub'
import { getLayoutComponent } from './layouts'
import { UniversalDocumentRenderer } from '../UniversalRenderers/UniversalDocumentRenderer'
import type { LayoutArchetype } from '../../types/universalAST'

interface UniversalLayoutRendererProps {
  data: CVData
  blueprint: LayoutBlueprint
  theme: ThemeVariant
  viewMode: ViewMode
  designConfig?: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  onUpdateArchetype?: (sectionKey: string, newArchetype: LayoutArchetype) => void
  onReorderSections?: (sourceIndex: number, targetIndex: number) => void
  onReorderSectionKey?: (sectionKey: string, direction: 'up' | 'down') => void
  onReorderSequenceItem?: (parentKey: string, sourceIndex: number, targetIndex: number) => void
}

export const UniversalLayoutRenderer: React.FC<UniversalLayoutRendererProps> = ({
  data,
  blueprint,
  theme,
  viewMode,
  designConfig,
  onRequestGenerateCoverLetter,
  structureConfig,
  onUpdateStructureConfig,
  onUpdateArchetype,
  onReorderSections,
  onReorderSectionKey,
  onReorderSequenceItem
}) => {
  const { basics } = data
  const isFreeCanvas = Boolean(structureConfig?.isFreeCanvasActive)
  const isMultiColumnLayout = ['compact_split', 'sidebar', 'editorial_accent', 'corporate_timeline'].includes(blueprint.id)
  const pageRef = React.useRef<HTMLDivElement>(null)

  const [hasPageOverflow, setHasPageOverflow] = React.useState<boolean>(false)
  const [isOverflowBannerDismissed, setIsOverflowBannerDismissed] = React.useState<boolean>(false)
  const [isTemporalBannerDismissed, setIsTemporalBannerDismissed] = React.useState<boolean>(false)
  const [isTemporalExpanded, setIsTemporalExpanded] = React.useState<boolean>(false)

  // Sincroniza em tempo real as variáveis de fundo no :root (<html>)
  React.useEffect(() => {
    const root = document.documentElement
    const themeDefaultBg = theme === 'terminal' ? '#090d16' : '#ffffff'
    const effectiveBgColor = designConfig?.colorBg || themeDefaultBg
    const effectiveBgPattern = designConfig?.backgroundPattern && designConfig.backgroundPattern !== 'none'
      ? `url("${designConfig.backgroundPattern}")`
      : 'none'

    root.style.setProperty('--cv-color-bg', effectiveBgColor)
    root.style.setProperty('--cv-bg-image', effectiveBgPattern)

    return () => {
      root.style.removeProperty('--cv-color-bg')
      root.style.removeProperty('--cv-bg-image')
    }
  }, [designConfig?.colorBg, designConfig?.backgroundPattern, theme])

  // Monitora se o conteúdo acumulado excede a altura útil da folha A4 (1122px)
  React.useEffect(() => {
    if (!isFreeCanvas) {
      setHasPageOverflow(false)
      setIsOverflowBannerDismissed(false)
      return
    }

    const checkPageHeight = () => {
      const cardEl = pageRef.current?.querySelector('.cv-card') as HTMLElement | null
      if (cardEl) {
        const activeBoxes = cardEl.querySelectorAll('.cv-structural-box--active')
        const boxCount = activeBoxes.length
        const editorOverhead = Math.round(boxCount * 22)
        const dynamicThreshold = 1180 + editorOverhead

        setHasPageOverflow(cardEl.scrollHeight > dynamicThreshold)
      } else if (pageRef.current) {
        setHasPageOverflow(pageRef.current.scrollHeight > 1250)
      }
    }

    checkPageHeight()
    const observer = new ResizeObserver(() => checkPageHeight())
    if (pageRef.current) observer.observe(pageRef.current)
    return () => observer.disconnect()
  }, [isFreeCanvas, structureConfig])

  // Hook isolado para gerenciar ordenação e movimentação de caixas estruturais
  const {
    handleSwapOrder,
    handleMoveStep,
    getSortedItems,
    getDynamicMathSections,
    handleSwitchZone,
    getSectionZone,
    handleUpdateSplitRatio
  } = useSectionOrdering({
    data,
    structureConfig,
    onUpdateStructureConfig
  })

  // Hub isolado com os renderizadores de seções atômicas
  const renderers = useSectionRenderers({
    data,
    structureConfig,
    onUpdateStructureConfig,
    isFreeCanvas,
    isMultiColumnLayout,
    handleMoveStep,
    handleSwapOrder,
    handleSwitchZone,
    getSectionZone,
    getSortedItems,
    getDynamicMathSections
  })

  const customRootStyles: React.CSSProperties = ({
    '--cv-avatar-pos-x': `${basics.imagePosX ?? 50}%`,
    '--cv-avatar-pos-y': `${basics.imagePosY ?? 50}%`,
    '--cv-avatar-scale': `${basics.imageScale ?? 1.0}`,
    ...(designConfig ? {
      '--cv-font-heading': `${designConfig.fontHeading}, sans-serif`,
      '--cv-font-body': `${designConfig.fontBody}, sans-serif`,
      '--cv-font-scale': `${designConfig.fontScale}`,
      '--cv-font-size-base': designConfig.fontSizeBase,
      '--cv-color-primary': designConfig.colorPrimary,
      '--cv-color-secondary': designConfig.colorSecondary,
      '--cv-color-text': designConfig.colorText,
      '--cv-color-text-muted': designConfig.colorTextMuted,
      '--cv-color-bg': designConfig.colorBg,
      '--cv-color-surface': designConfig.colorSurface,
      '--cv-color-border': designConfig.colorBorder,
      '--cv-color-accent': designConfig.colorAccent,
      '--cv-color-sidebar': designConfig.colorSidebar || '#f8fafc',
      '--cv-color-workspace-bg': designConfig.colorWorkspaceBg || '#0b1120',
      ...(designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none' ? {
        '--cv-bg-image': `url("${designConfig.backgroundPattern}")`,
      } : {
        '--cv-bg-image': 'none'
      }),
      ...(designConfig.sectionOverrides ? Object.entries(designConfig.sectionOverrides).reduce((acc, [secId, override]) => {
        if (override.textColor) acc[`--sec-${secId}-text`] = override.textColor
        if (override.titleColor) acc[`--sec-${secId}-title`] = override.titleColor
        if (override.bgColor) acc[`--sec-${secId}-bg`] = override.bgColor
        if (override.borderColor) acc[`--sec-${secId}-border`] = override.borderColor
        if (override.accentColor) acc[`--sec-${secId}-accent`] = override.accentColor
        if (override.bgImage && override.bgImage !== 'none') {
          acc[`--sec-${secId}-bg-image`] = override.bgImage.startsWith('url(') ? override.bgImage : `url("${override.bgImage}")`
        }
        return acc
      }, {} as Record<string, string>) : {})
    } : {})
  } as React.CSSProperties)

  const renderCanvasDecorations = () => (
    <CanvasDecorations
      structureConfig={structureConfig}
      onUpdateStructureConfig={onUpdateStructureConfig}
      isFreeCanvas={isFreeCanvas}
      containerRef={pageRef}
    />
  )

  const renderCVPage = (pageNumber = 1, totalPages = 1) => {
    if (data.meta?.isUniversalDocument) {
      return (
        <UniversalDocumentRenderer
          data={data}
          onUpdateArchetype={onUpdateArchetype}
          pageNumber={pageNumber}
          totalPages={totalPages}
          structureConfig={structureConfig}
          onUpdateStructureConfig={onUpdateStructureConfig}
          isFreeCanvas={isFreeCanvas}
          onReorderSections={onReorderSections}
          onReorderSectionKey={onReorderSectionKey}
          onReorderSequenceItem={onReorderSequenceItem}
        />
      )
    }

    const LayoutComponent = getLayoutComponent(blueprint.id)
    return (
      <LayoutComponent
        data={data}
        blueprint={blueprint}
        structureConfig={structureConfig}
        onUpdateStructureConfig={onUpdateStructureConfig}
        isFreeCanvas={isFreeCanvas}
        renderers={renderers}
        handleUpdateSplitRatio={handleUpdateSplitRatio}
        renderCanvasDecorations={renderCanvasDecorations}
        pageNumber={pageNumber}
        totalPages={totalPages}
        pageLabel="Currículo"
        onReorderSequenceItem={onReorderSequenceItem}
      />
    )
  }

  const renderCoverLetterPage = (pageNumber = 1, totalPages = 1) => {
    return (
      <CVPageCard
        pageNumber={pageNumber}
        totalPages={totalPages}
        candidateName={basics.name}
        candidateLabel={basics.label}
        pageLabel="Carta de Apresentação"
        showPageFooter={structureConfig?.showPageNumbers ?? totalPages > 1}
        showContinuationHeader={false}
      >
        <div className="cv-card cv-cover-letter-card">
          {renderers.wrapSection('cover_header', 'Cabeçalho da Carta', (
            <header className="cv-cover-letter-header">
              <h1 className="cv-name">{basics.name}</h1>
              {basics.label && <div className="cv-label">{basics.label}</div>}
              <div className="cv-contacts cv-contacts-row" style={{ marginTop: '0.4rem' }}>
                {basics.email && <span>✉ {basics.email}</span>}
                {basics.phone && <span>📞 {basics.phone}</span>}
                {basics.location && (
                  <span>📍 {[basics.location.city, basics.location.region].filter(Boolean).join(', ')}</span>
                )}
              </div>
            </header>
          ))}
          <div className="cv-cover-letter-divider" />
          {renderers.wrapSection('cover_body', 'Corpo da Carta de Apresentação', (
            <BlockCoverLetter
              coverLetter={data.coverLetter}
              basics={basics}
              onRequestGenerate={onRequestGenerateCoverLetter}
            />
          ))}
        </div>
      </CVPageCard>
    )
  }

  return (
    <div className={`cv-root theme-${theme} ${blueprint.customClass || ''}`} style={customRootStyles}>
      {hasPageOverflow && isFreeCanvas && !isOverflowBannerDismissed && (
        <div className="cv-page-overflow-banner cv-no-print" data-cv-interactive="true">
          <span className="cv-page-overflow-icon">⚠️</span>
          <div className="cv-page-overflow-text">
            <strong>Atenção à Altura A4:</strong> O conteúdo reorganizado ultrapassou a altura física de 1 folha A4.
            Encurte caixas ou reduza margens para evitar que o conteúdo vaze para uma página extra na impressão/PDF.
          </div>
          <button
            type="button"
            className="cv-page-overflow-close"
            onClick={() => setIsOverflowBannerDismissed(true)}
            title="Dispensar aviso de altura A4"
          >
            ✕
          </button>
        </div>
      )}

      {data.meta?.temporalWarnings && data.meta.temporalWarnings.length > 0 && !isTemporalBannerDismissed && (
        <div
          className="cv-page-temporal-banner cv-no-print"
          data-cv-interactive="true"
          style={{
            margin: '0.75rem auto',
            maxWidth: '210mm',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(254, 243, 199, 0.95)',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            fontSize: '0.82rem',
            color: '#92400e',
            lineHeight: 1.4
          }}
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#78350f' }}>
              Auditoria de Datas e Integridade Temporal ({data.meta.temporalWarnings.length} {data.meta.temporalWarnings.length === 1 ? 'alerta' : 'alertas'})
            </strong>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              A IA identificou datas ausentes ou potencialmente estimadas no documento. Por favor, confira os itens antes de exportar:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {data.meta.temporalWarnings.slice(0, isTemporalExpanded ? undefined : 2).map((w, idx) => (
                <li key={idx} style={{ marginBottom: '0.15rem' }}>{w}</li>
              ))}
            </ul>
            {data.meta.temporalWarnings.length > 2 && (
              <button
                type="button"
                onClick={() => setIsTemporalExpanded(!isTemporalExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#b45309',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  marginTop: '0.25rem'
                }}
              >
                {isTemporalExpanded ? 'Mostrar menos' : `Ver todos os ${data.meta.temporalWarnings.length} alertas...`}
              </button>
            )}
          </div>
          <button
            type="button"
            className="cv-page-overflow-close"
            onClick={() => setIsTemporalBannerDismissed(true)}
            title="Dispensar aviso temporal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#92400e',
              padding: '0 0.25rem'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div ref={pageRef} className="cv-render-wrapper">
        <div className="cv-print-page-background" aria-hidden="true" />
        {viewMode === 'cv' && renderCVPage(1, 1)}
        {viewMode === 'cover_letter' && renderCoverLetterPage(1, 1)}
        {viewMode === 'both' && (
          <div className="cv-dossier-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center' }}>
            {renderCVPage(1, 2)}
            {renderCoverLetterPage(2, 2)}
          </div>
        )}
      </div>
    </div>
  )
}

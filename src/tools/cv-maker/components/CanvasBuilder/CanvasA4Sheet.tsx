import React, { useRef, useEffect, useState } from 'react'
import type { CanvasBlockConfig, CanvasColSpan, CVData, CVDesignConfig } from '../../types/cv'
import { CanvasBlockWrapper } from './CanvasBlockWrapper'

interface CanvasA4SheetProps {
  blocks: CanvasBlockConfig[]
  data: CVData | null
  designConfig: CVDesignConfig
  selectedBlockId: string | null
  onSelectBlock: (block: CanvasBlockConfig | null) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onChangeColSpan: (id: string, colSpan: CanvasColSpan) => void
  onOpenInspector: (block: CanvasBlockConfig) => void
  onDeleteBlock: (id: string) => void
  onRequestGenerateCoverLetter?: () => void
  onLoadPreset: (presetId: string) => void
  onUpdateBlock?: (updated: CanvasBlockConfig) => void
}

export const CanvasA4Sheet: React.FC<CanvasA4SheetProps> = ({
  blocks,
  data,
  designConfig,
  selectedBlockId,
  onSelectBlock,
  onMoveUp,
  onMoveDown,
  onChangeColSpan,
  onOpenInspector,
  onDeleteBlock,
  onRequestGenerateCoverLetter,
  onLoadPreset,
  onUpdateBlock
}) => {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [sheetHeight, setSheetHeight] = useState<number>(0)
  const A4_MAX_HEIGHT_PX = 1160

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    const updateHeight = () => {
      setSheetHeight(el.scrollHeight)
    }

    updateHeight()
    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [blocks, data])

  const isPageOverflown = sheetHeight > A4_MAX_HEIGHT_PX + 20
  const heightPercent = Math.min(100, Math.round((sheetHeight / A4_MAX_HEIGHT_PX) * 100))

  return (
    <div className="cv-canvas-center-stage">
      {/* Top Status & Height Budget Bar */}
      <div className="cv-canvas-sheet-info-bar cv-no-print" data-cv-interactive="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>📄 <strong>Folha A4 Livre</strong> (210 × 297 mm)</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{blocks.length} {blocks.length === 1 ? 'bloco adicionado' : 'blocos adicionados'}</span>
        </div>

        {/* Height Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.74rem', color: isPageOverflown ? '#f87171' : '#34d399', fontWeight: 700 }}>
            {isPageOverflown ? `⚠️ Ultrapassou 1 Página A4 (${sheetHeight}px)` : `Ocupação A4: ${heightPercent}%`}
          </span>
          <div style={{ width: '80px', height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, heightPercent)}%`,
                height: '100%',
                background: isPageOverflown ? '#ef4444' : '#10b981',
                borderRadius: '999px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>
      </div>

      {/* A4 Sheet Container */}
      <div className="cv-canvas-sheet-wrapper">
        <div className="cv-print-page-background" aria-hidden="true" />
        <div
          id="cv-canvas-sheet"
          ref={sheetRef}
          className={`cv-canvas-sheet ${blocks.length === 0 ? 'cv-canvas-sheet--empty' : ''}`}
          style={{
            fontFamily: `"${designConfig.fontBody}", sans-serif`,
            backgroundColor: designConfig.colorBg || '#ffffff',
            color: designConfig.colorText || '#0f172a',
            backgroundImage: designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none'
              ? `url("${designConfig.backgroundPattern}")`
              : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            ['--cv-font-heading' as any]: `"${designConfig.fontHeading}", sans-serif`,
            ['--cv-font-body' as any]: `"${designConfig.fontBody}", sans-serif`,
            ['--cv-font-scale' as any]: designConfig.fontScale,
            ['--cv-color-primary' as any]: designConfig.colorPrimary,
            ['--cv-color-secondary' as any]: designConfig.colorSecondary,
            ['--cv-color-accent' as any]: designConfig.colorAccent,
            ['--cv-color-surface' as any]: designConfig.colorSurface,
            ['--cv-color-bg' as any]: designConfig.colorBg,
            ['--cv-color-text' as any]: designConfig.colorText,
            ['--cv-bg-image' as any]: designConfig.backgroundPattern && designConfig.backgroundPattern !== 'none'
              ? `url("${designConfig.backgroundPattern}")`
              : 'none',
            ...(designConfig.sectionOverrides ? Object.entries(designConfig.sectionOverrides).reduce((acc, [secId, override]) => {
              if (override.textColor) acc[`--sec-${secId}-text`] = override.textColor
              if (override.titleColor) acc[`--sec-${secId}-title`] = override.titleColor
              if (override.bgColor) acc[`--sec-${secId}-bg`] = override.bgColor
              if (override.borderColor) acc[`--sec-${secId}-border`] = override.borderColor
              if (override.accentColor) acc[`--sec-${secId}-accent`] = override.accentColor
              if (override.bgImage && override.bgImage !== 'none') acc[`--sec-${secId}-bg-image`] = `url("${override.bgImage}")`
              return acc
            }, {} as Record<string, string>) : {})
          }}
          onClick={() => onSelectBlock(null)}
        >
          {blocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', maxWidth: '420px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📄✨</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#334155' }}>
                Folha A4 em Branco
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Clique nos campos da barra lateral esquerda para adicionar blocos à folha ou escolha um modelo inicial abaixo.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="cv-btn-primary"
                  onClick={() => onLoadPreset('executive_balanced')}
                >
                  👔 Carregar Modelo Balanceado
                </button>
                <button
                  type="button"
                  className="cv-btn-secondary"
                  onClick={() => onLoadPreset('two_column_modern')}
                >
                  📑 2 Colunas Modernas
                </button>
              </div>
            </div>
          ) : (
            data && blocks.map((block, idx) => (
              <CanvasBlockWrapper
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={blocks.length}
                data={data}
                isSelected={selectedBlockId === block.id}
                onSelect={b => onSelectBlock(b)}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onChangeColSpan={onChangeColSpan}
                onOpenInspector={onOpenInspector}
                onDelete={onDeleteBlock}
                onRequestGenerateCoverLetter={onRequestGenerateCoverLetter}
                onUpdateBlock={onUpdateBlock}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

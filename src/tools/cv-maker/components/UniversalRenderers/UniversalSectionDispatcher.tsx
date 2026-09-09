import React, { useState } from 'react'
import type { UniversalBlockNode, LayoutArchetype } from '../../types/universalAST'
import type { LayoutStructureConfig, SectionBoxDimensions } from '../../types/cv'
import { ARCHETYPE_DEFINITIONS, ALL_CANONICAL_ARCHETYPES } from '../../types/universalAST'
import { StructuralBoxWrapper } from '../CanvasBuilder/StructuralBoxWrapper'
import { CardGridRenderer } from './CardGridRenderer'
import { TimelineRenderer } from './TimelineRenderer'
import { BadgeListRenderer } from './BadgeListRenderer'
import { KeyValueTableRenderer } from './KeyValueTableRenderer'
import { ProseFlowRenderer } from './ProseFlowRenderer'
import { UniversalSingleItemRenderer } from './UniversalSingleItemRenderer'

interface UniversalSectionDispatcherProps {
  block: UniversalBlockNode
  onUpdateArchetype?: (sectionKey: string, newArchetype: LayoutArchetype) => void
  isEditable?: boolean
  structureConfig?: LayoutStructureConfig
  onUpdateStructureConfig?: (newConfig: LayoutStructureConfig) => void
  isFreeCanvas?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onReorderSequenceItem?: (parentKey: string, sourceIndex: number, targetIndex: number) => void
}

export const UniversalSectionDispatcher: React.FC<UniversalSectionDispatcherProps> = ({
  block,
  onUpdateArchetype,
  isEditable = true,
  structureConfig,
  onUpdateStructureConfig,
  isFreeCanvas = false,
  onMoveUp,
  onMoveDown,
  onReorderSequenceItem
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const effectiveArchetype = block.classification.effective
  const archetypeDef = ARCHETYPE_DEFINITIONS[effectiveArchetype] || ARCHETYPE_DEFINITIONS.card_grid

  const pointerKey = block.pointer.semanticPath || `/[section='${block.key}']`
  const rawDims = structureConfig?.sectionDimensions?.[block.key] || structureConfig?.sectionDimensions?.[pointerKey]
  const dims: SectionBoxDimensions | undefined = rawDims

  const handleSelectArchetype = (arch: LayoutArchetype) => {
    setIsMenuOpen(false)
    if (onUpdateArchetype) {
      onUpdateArchetype(block.key, arch)
    }
  }

  const hasMultipleItems = Boolean(block.items && block.items.length > 1)

  // ── CABEÇALHO DA SEÇÃO (Título, Botão YAML e Seletor do Arquétipo) ──
  const renderHeaderContent = () => (
    <div
      className="cv-universal-section-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '0.4rem',
        borderBottom: `1.5px solid var(--sec-${block.key}-border, var(--cv-color-border, #cbd5e1))`,
        marginBottom: isFreeCanvas ? 0 : '0.6rem'
      }}
    >
      <h2
        style={{
          fontSize: '1.05rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: `var(--sec-${block.key}-title, var(--cv-color-primary, #0f172a))`,
          margin: 0
        }}
      >
        {block.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} className="cv-no-print">
        {/* Botão de Localização Bidirecional no YAML */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('cv_locate_yaml_key', { detail: { key: block.key } }))}
          title={`Localizar "${block.key}" no editor de código YAML`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.64rem',
            fontWeight: 600,
            padding: '0.15rem 0.45rem',
            borderRadius: '4px',
            background: 'var(--cv-color-surface, #f8fafc)',
            color: 'var(--cv-color-text-muted, #64748b)',
            border: '1px solid var(--cv-color-border, #cbd5e1)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span>📝</span>
          <span>YAML</span>
        </button>

        {/* Badge do Arquétipo com Menu Suspenso Interativo (Soberania do Usuário) */}
        {isEditable && onUpdateArchetype && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title={`Arquétipo: ${archetypeDef.label} (Confiança: ${(block.classification.confidence * 100).toFixed(0)}%). Clique para alternar.`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                background: block.classification.userOverride ? '#eff6ff' : 'var(--cv-color-surface, #f8fafc)',
                color: block.classification.userOverride ? '#2563eb' : 'var(--cv-color-text-muted, #64748b)',
                border: block.classification.userOverride ? '1px solid #93c5fd' : '1px solid var(--cv-color-border, #e2e8f0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{archetypeDef.icon}</span>
              <span>{archetypeDef.label}</span>
              {block.classification.userOverride && (
                <span style={{ fontSize: '0.6rem', color: '#3b82f6' }}>★</span>
              )}
              <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>▼</span>
            </button>

            {/* Menu Dropdown dos 5 Arquétipos Canônicos */}
            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 100,
                  minWidth: '200px',
                  overflow: 'hidden',
                  padding: '0.3rem'
                }}
              >
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    padding: '0.3rem 0.5rem',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  Arquétipos Disponíveis
                </div>

                {ALL_CANONICAL_ARCHETYPES.map((arch) => {
                  const def = ARCHETYPE_DEFINITIONS[arch]
                  const isSelected = arch === effectiveArchetype
                  const isInferred = arch === block.classification.inferred

                  return (
                    <button
                      key={arch}
                      type="button"
                      onClick={() => handleSelectArchetype(arch)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.74rem',
                        fontWeight: isSelected ? 700 : 500,
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        color: isSelected ? '#166534' : '#1e293b',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.4rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{def.icon}</span>
                        <span>{def.label}</span>
                      </div>
                      {isInferred && (
                        <span style={{ fontSize: '0.62rem', color: '#64748b', background: '#f1f5f9', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                          IA
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // ── CASO A: SETOR COM MÚLTIPLOS ITENS (CADA ITEM TEM SEU PRÓPRIO BOX) ──
  if (hasMultipleItems) {
    const titleKey = `${block.key}_title`
    const titleDims = structureConfig?.sectionDimensions?.[titleKey] || structureConfig?.sectionDimensions?.[block.key]

    const headerBox = isFreeCanvas ? (
      <StructuralBoxWrapper
        key={titleKey}
        sectionId={titleKey}
        title={`Título: ${block.title}`}
        category={effectiveArchetype}
        isFreeCanvasActive={isFreeCanvas}
        dimensions={titleDims}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onToggleHide={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const cur = structureConfig.sectionDimensions?.[titleKey] || {}
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              [titleKey]: { ...cur, hidden: !cur.hidden }
            }
          })
        }}
        onUpdateDimensions={(newDims) => {
          if (!structureConfig || !onUpdateStructureConfig) return
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: {
              ...structureConfig.sectionDimensions,
              [titleKey]: newDims
            }
          })
        }}
        onResetDimensions={() => {
          if (!structureConfig || !onUpdateStructureConfig) return
          const next = { ...structureConfig.sectionDimensions }
          delete next[titleKey]
          onUpdateStructureConfig({
            ...structureConfig,
            sectionDimensions: next
          })
        }}
      >
        {renderHeaderContent()}
      </StructuralBoxWrapper>
    ) : titleDims?.hidden ? null : (
      <div
        key={titleKey}
        className={`cv-atomic-box-wrapper cv-section-${block.key}-title cv-avoid-break`}
        style={{
          width: titleDims?.widthPercent ? `${titleDims.widthPercent}%` : undefined,
          display: titleDims?.widthPercent ? 'inline-block' : undefined,
          marginLeft: titleDims?.alignment === 'center' || titleDims?.alignment === 'right' ? 'auto' : undefined,
          marginRight: titleDims?.alignment === 'center' ? 'auto' : titleDims?.alignment === 'right' ? '0' : undefined,
          fontFamily: titleDims?.fontFamily ? `"${titleDims.fontFamily}", sans-serif` : undefined,
          fontSize: titleDims?.fontSizeScale ? `${titleDims.fontSizeScale}em` : undefined,
          order: titleDims?.order
        }}
        data-section-id={titleKey}
      >
        {renderHeaderContent()}
      </div>
    )

    // Renderiza cada item individual em seu próprio box estrutural
    const itemBoxes = block.items.map((item, idx) => {
      const itemId = `${block.key}_item_${idx}`
      const itemDims = structureConfig?.sectionDimensions?.[itemId] || (item.id ? structureConfig?.sectionDimensions?.[`${block.key}_${item.id}`] : undefined)
      const itemTitle = item.title ? `${item.title} (${block.title})` : `${block.title} #${idx + 1}`

      if (itemDims?.hidden && !isFreeCanvas) {
        return null
      }

      const singleItemNode = (
        <UniversalSingleItemRenderer
          item={item}
          index={idx}
          archetype={effectiveArchetype}
          sectionKey={block.key}
          isFreeCanvas={isFreeCanvas}
        />
      )

      if (!isFreeCanvas) {
        const widthPercent = itemDims?.widthPercent
        const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
        const hasCustomScale = typeof itemDims?.fontSizeScale === 'number' && itemDims.fontSizeScale !== 1
        const fontScaleVal = itemDims?.fontSizeScale ?? 1.0

        const marginLeftStyle = itemDims?.alignment === 'center' || itemDims?.alignment === 'right' ? 'auto' : undefined
        const marginRightStyle = itemDims?.alignment === 'center' ? 'auto' : itemDims?.alignment === 'right' ? '0' : undefined

        return (
          <div
            key={itemId}
            className={`cv-atomic-box-wrapper cv-section-${block.key}-item cv-avoid-break`}
            style={{
              width: hasCustomWidth ? `${widthPercent}%` : (effectiveArchetype === 'card_grid' ? undefined : undefined),
              flex: effectiveArchetype === 'card_grid' && !hasCustomWidth ? '1 1 260px' : undefined,
              boxSizing: 'border-box',
              marginLeft: marginLeftStyle,
              marginRight: marginRightStyle,
              order: itemDims?.order,
              fontFamily: itemDims?.fontFamily ? `"${itemDims.fontFamily}", sans-serif` : undefined,
              fontSize: hasCustomScale ? `${itemDims.fontSizeScale}em` : undefined,
              ['--cv-box-font-scale' as any]: fontScaleVal,
              ['--cv-box-font-family' as any]: itemDims?.fontFamily ? `"${itemDims.fontFamily}", sans-serif` : undefined,
            }}
            data-section-id={itemId}
          >
            {singleItemNode}
          </div>
        )
      }

      return (
        <StructuralBoxWrapper
          key={itemId}
          sectionId={itemId}
          title={itemTitle}
          category={effectiveArchetype}
          isFreeCanvasActive={isFreeCanvas}
          dimensions={itemDims}
          onMoveUp={idx > 0 ? () => onReorderSequenceItem?.(block.key, idx, idx - 1) : undefined}
          onMoveDown={idx < block.items.length - 1 ? () => onReorderSequenceItem?.(block.key, idx, idx + 1) : undefined}
          onToggleHide={() => {
            if (!structureConfig || !onUpdateStructureConfig) return
            const cur = structureConfig.sectionDimensions?.[itemId] || {}
            onUpdateStructureConfig({
              ...structureConfig,
              sectionDimensions: {
                ...structureConfig.sectionDimensions,
                [itemId]: { ...cur, hidden: !cur.hidden }
              }
            })
          }}
          onUpdateDimensions={(newDims) => {
            if (!structureConfig || !onUpdateStructureConfig) return
            onUpdateStructureConfig({
              ...structureConfig,
              sectionDimensions: {
                ...structureConfig.sectionDimensions,
                [itemId]: newDims
              }
            })
          }}
          onResetDimensions={() => {
            if (!structureConfig || !onUpdateStructureConfig) return
            const next = { ...structureConfig.sectionDimensions }
            delete next[itemId]
            onUpdateStructureConfig({
              ...structureConfig,
              sectionDimensions: next
            })
          }}
        >
          {singleItemNode}
        </StructuralBoxWrapper>
      )
    })

    const renderItemsContainer = () => {
      switch (effectiveArchetype) {
        case 'timeline':
          return (
            <div
              className="cv-universal-items-container cv-timeline-items"
              style={{
                position: 'relative',
                paddingLeft: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '6px',
                  top: '12px',
                  bottom: '12px',
                  width: '2px',
                  background: 'var(--cv-color-border, #cbd5e1)',
                  borderRadius: '1px'
                }}
                aria-hidden="true"
              />
              {itemBoxes}
            </div>
          )
        case 'badge_list':
          return (
            <div
              className="cv-universal-items-container cv-badge-items"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                alignItems: 'flex-start'
              }}
            >
              {itemBoxes}
            </div>
          )
        case 'key_value_table':
        case 'prose_flow':
          return (
            <div
              className="cv-universal-items-container cv-vertical-items"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              {itemBoxes}
            </div>
          )
        case 'card_grid':
        default:
          return (
            <div
              className="cv-universal-items-container cv-card-grid-items"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.85rem',
                alignItems: 'stretch'
              }}
            >
              {itemBoxes}
            </div>
          )
      }
    }

    return (
      <section
        key={block.key}
        className={`cv-universal-section cv-section-${block.key} cv-section-multi-items`}
        data-section-key={block.key}
        data-archetype={effectiveArchetype}
        style={{
          position: 'relative',
          marginBottom: isFreeCanvas ? '0' : '1.4rem'
        }}
      >
        {headerBox}
        {renderItemsContainer()}
      </section>
    )
  }

  // ── CASO B: SETOR DE ITEM ÚNICO OU ESCALAR (UM ÚNICO BOX INTEGRADO) ──
  const renderContent = () => {
    switch (effectiveArchetype) {
      case 'card_grid':
        return <CardGridRenderer items={block.items} sectionKey={block.key} />
      case 'timeline':
        return <TimelineRenderer items={block.items} sectionKey={block.key} />
      case 'badge_list':
        return <BadgeListRenderer items={block.items} sectionKey={block.key} />
      case 'key_value_table':
        return <KeyValueTableRenderer items={block.items} sectionKey={block.key} />
      case 'prose_flow':
        return <ProseFlowRenderer items={block.items} sectionKey={block.key} />
      default:
        return <CardGridRenderer items={block.items} sectionKey={block.key} />
    }
  }

  if (dims?.hidden && !isFreeCanvas) {
    return null
  }

  const sectionContent = (
    <section
      className={`cv-universal-section cv-section-${block.key}`}
      data-section-key={block.key}
      data-archetype={effectiveArchetype}
      style={{
        position: 'relative',
        marginBottom: isFreeCanvas ? '0' : '1.4rem',
        backgroundColor: `var(--sec-${block.key}-bg, transparent)`,
        backgroundImage: `var(--sec-${block.key}-bg-image, none)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: `var(--sec-${block.key}-text, inherit)`,
        borderRadius: '6px',
        border: isFreeCanvas ? 'none' : `1px solid var(--sec-${block.key}-border, transparent)`,
        ['--cv-color-primary' as any]: `var(--sec-${block.key}-title, var(--cv-color-primary, #0f172a))`,
        ['--cv-color-text' as any]: `var(--sec-${block.key}-text, var(--cv-color-text, #334155))`,
        ['--cv-color-border' as any]: `var(--sec-${block.key}-border, var(--cv-color-border, #cbd5e1))`,
        ['--cv-color-accent' as any]: `var(--sec-${block.key}-accent, var(--cv-color-accent, #f97316))`,
      }}
    >
      {renderHeaderContent()}
      {renderContent()}
    </section>
  )

  if (!isFreeCanvas) {
    const widthPercent = dims?.widthPercent
    const hasCustomWidth = typeof widthPercent === 'number' && widthPercent > 0 && widthPercent < 100
    const hasCustomScale = typeof dims?.fontSizeScale === 'number' && dims.fontSizeScale !== 1
    const fontScaleVal = dims?.fontSizeScale ?? 1.0

    const marginLeftStyle = dims?.alignment === 'center' || dims?.alignment === 'right' ? 'auto' : undefined
    const marginRightStyle = dims?.alignment === 'center' ? 'auto' : dims?.alignment === 'right' ? '0' : undefined

    return (
      <div
        key={block.key}
        className={`cv-atomic-box-wrapper cv-section-${block.key} cv-avoid-break`}
        style={{
          width: hasCustomWidth ? `${widthPercent}%` : undefined,
          display: hasCustomWidth ? 'inline-block' : undefined,
          verticalAlign: hasCustomWidth ? 'top' : undefined,
          boxSizing: 'border-box',
          marginLeft: marginLeftStyle,
          marginRight: marginRightStyle,
          order: dims?.order,
          fontFamily: dims?.fontFamily ? `"${dims.fontFamily}", sans-serif` : undefined,
          fontSize: hasCustomScale ? `${dims.fontSizeScale}em` : undefined,
          ['--cv-box-font-scale' as any]: fontScaleVal,
          ['--cv-box-font-family' as any]: dims?.fontFamily ? `"${dims.fontFamily}", sans-serif` : undefined,
        }}
        data-section-id={block.key}
      >
        {sectionContent}
      </div>
    )
  }

  return (
    <StructuralBoxWrapper
      key={block.key}
      sectionId={block.key}
      title={block.title}
      category={effectiveArchetype}
      isFreeCanvasActive={isFreeCanvas}
      dimensions={dims}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onToggleHide={() => {
        if (!structureConfig || !onUpdateStructureConfig) return
        const cur = structureConfig.sectionDimensions?.[block.key] || {}
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [block.key]: { ...cur, hidden: !cur.hidden },
            [pointerKey]: { ...cur, hidden: !cur.hidden }
          }
        })
      }}
      onUpdateDimensions={(newDims) => {
        if (!structureConfig || !onUpdateStructureConfig) return
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: {
            ...structureConfig.sectionDimensions,
            [block.key]: newDims,
            [pointerKey]: newDims
          }
        })
      }}
      onResetDimensions={() => {
        if (!structureConfig || !onUpdateStructureConfig) return
        const next = { ...structureConfig.sectionDimensions }
        delete next[block.key]
        delete next[pointerKey]
        onUpdateStructureConfig({
          ...structureConfig,
          sectionDimensions: next
        })
      }}
    >
      {sectionContent}
    </StructuralBoxWrapper>
  )
}

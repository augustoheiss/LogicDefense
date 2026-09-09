import React, { useState } from 'react'
import type { UniversalBlockNode, LayoutArchetype } from '../../types/universalAST'
import { ARCHETYPE_DEFINITIONS, ALL_CANONICAL_ARCHETYPES } from '../../types/universalAST'
import { CardGridRenderer } from './CardGridRenderer'
import { TimelineRenderer } from './TimelineRenderer'
import { BadgeListRenderer } from './BadgeListRenderer'
import { KeyValueTableRenderer } from './KeyValueTableRenderer'
import { ProseFlowRenderer } from './ProseFlowRenderer'

interface UniversalSectionDispatcherProps {
  block: UniversalBlockNode
  onUpdateArchetype?: (sectionKey: string, newArchetype: LayoutArchetype) => void
  isEditable?: boolean
}

export const UniversalSectionDispatcher: React.FC<UniversalSectionDispatcherProps> = ({
  block,
  onUpdateArchetype,
  isEditable = true
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)
  const effectiveArchetype = block.classification.effective
  const archetypeDef = ARCHETYPE_DEFINITIONS[effectiveArchetype] || ARCHETYPE_DEFINITIONS.card_grid

  const handleSelectArchetype = (arch: LayoutArchetype) => {
    setIsMenuOpen(false)
    if (onUpdateArchetype) {
      onUpdateArchetype(block.key, arch)
    }
  }

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

  return (
    <section
      className={`cv-universal-section cv-section-${block.key}`}
      data-section-key={block.key}
      data-archetype={effectiveArchetype}
      style={{
        position: 'relative',
        marginBottom: '1.4rem',
        backgroundColor: `var(--sec-${block.key}-bg, transparent)`,
        backgroundImage: `var(--sec-${block.key}-bg-image, none)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: `var(--sec-${block.key}-text, inherit)`,
        borderRadius: '6px',
        border: `1px solid var(--sec-${block.key}-border, transparent)`,
        ['--cv-color-primary' as any]: `var(--sec-${block.key}-title, var(--cv-color-primary, #0f172a))`,
        ['--cv-color-text' as any]: `var(--sec-${block.key}-text, var(--cv-color-text, #334155))`,
        ['--cv-color-border' as any]: `var(--sec-${block.key}-border, var(--cv-color-border, #cbd5e1))`,
        ['--cv-color-accent' as any]: `var(--sec-${block.key}-accent, var(--cv-color-accent, #f97316))`,
      }}
    >
      {/* Cabeçalho da Seção com Título, Botão YAML e Seletor do Arquétipo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.4rem',
          borderBottom: `1.5px solid var(--sec-${block.key}-border, var(--cv-color-border, #cbd5e1))`,
          marginBottom: '0.5rem'
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

      {/* Conteúdo do Arquétipo */}
      {renderContent()}
    </section>
  )
}

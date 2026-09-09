import React, { useState } from 'react'
import type { UniversalDocumentAST, LayoutArchetype } from '../../types/universalAST'
import { ARCHETYPE_DEFINITIONS, ALL_CANONICAL_ARCHETYPES } from '../../types/universalAST'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  LayersIcon,
  SearchIcon,
  SparklesIcon
} from '../Icons/ProIcons'

interface UniversalLayerTreeProps {
  ast: UniversalDocumentAST | undefined
  onUpdateArchetypeOverride: (sectionKey: string, archetype: LayoutArchetype) => void
  hiddenSections?: Set<string>
  onToggleSectionVisibility?: (sectionKey: string) => void
}

export const UniversalLayerTree: React.FC<UniversalLayerTreeProps> = ({
  ast,
  onUpdateArchetypeOverride,
  hiddenSections = new Set(),
  onToggleSectionVisibility
}) => {
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({})
  const [activeMenuBlockKey, setActiveMenuBlockKey] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState<string>('')

  const blocks = ast?.blocks || []

  const toggleExpand = (key: string) => {
    setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredBlocks = blocks.filter((b) => {
    if (!filterQuery) return true
    const q = filterQuery.toLowerCase()
    return (
      b.title.toLowerCase().includes(q) ||
      b.key.toLowerCase().includes(q) ||
      b.classification.effective.toLowerCase().includes(q)
    )
  })

  if (!ast || blocks.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
        <LayersIcon size={28} />
        <p style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>Nenhum nó de documento carregado no AST.</p>
      </div>
    )
  }

  return (
    <div className="cv-universal-layer-tree" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Barra de Filtro e Estatística */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <SearchIcon
            size={13}
            style={{ position: 'absolute', left: '0.6rem', color: '#64748b', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Filtrar camadas do documento..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '0.4rem 0.6rem 0.4rem 2rem',
              fontSize: '0.74rem',
              color: '#e2e8f0',
              outline: 'none'
            }}
          />
        </div>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#38bdf8',
            background: 'rgba(56, 189, 248, 0.1)',
            padding: '0.35rem 0.6rem',
            borderRadius: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          {blocks.length} {blocks.length === 1 ? 'seção' : 'seções'}
        </span>
      </div>

      {/* Lista de Blocos do Documento */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filteredBlocks.map((block) => {
          const isExpanded = Boolean(expandedBlocks[block.key])
          const isHidden = hiddenSections.has(block.key)
          const isMenuOpen = activeMenuBlockKey === block.key
          const effectiveArchetype = block.classification.effective
          const archetypeDef = ARCHETYPE_DEFINITIONS[effectiveArchetype] || ARCHETYPE_DEFINITIONS.card_grid
          const confidencePercent = Math.round(block.classification.confidence * 100)

          return (
            <div
              key={block.key}
              style={{
                background: '#0f172a',
                border: isHidden ? '1px solid #1e293b' : '1px solid #334155',
                borderRadius: '8px',
                overflow: 'visible',
                transition: 'all 0.15s ease',
                opacity: isHidden ? 0.6 : 1
              }}
            >
              {/* Cabeçalho da Camada */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  cursor: 'pointer',
                  gap: '0.5rem'
                }}
                onClick={() => toggleExpand(block.key)}
              >
                {/* Ícone de Expansão + Nome da Camada */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: isHidden ? '#64748b' : '#f8fafc',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {block.title}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      <code>/{block.key}</code> • {block.items.length} {block.items.length === 1 ? 'item' : 'itens'}
                    </div>
                  </div>
                </div>

                {/* Controles da Camada (Arquétipo Dropdown + Visibilidade) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {/* Botão Seletor de Arquétipo com Popover */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setActiveMenuBlockKey(isMenuOpen ? null : block.key)}
                      title={`Arquétipo: ${archetypeDef.label} (${confidencePercent}% confiança). Clique para trocar.`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '5px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: block.classification.userOverride ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                        color: block.classification.userOverride ? '#38bdf8' : '#cbd5e1',
                        border: block.classification.userOverride ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #334155',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{archetypeDef.icon}</span>
                      <span style={{ maxWidth: '75px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {archetypeDef.label}
                      </span>
                      <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>▼</span>
                    </button>

                    {/* Menu Popover dos 5 Arquétipos Canônicos */}
                    {isMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: '4px',
                          background: '#090d16',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                          zIndex: 150,
                          minWidth: '220px',
                          padding: '0.35rem'
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#64748b',
                            padding: '0.3rem 0.5rem',
                            borderBottom: '1px solid #1e293b',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <span>Arquétipo de Layout</span>
                          <span style={{ color: '#38bdf8' }}>5 Opções</span>
                        </div>

                        {ALL_CANONICAL_ARCHETYPES.map((arch) => {
                          const def = ARCHETYPE_DEFINITIONS[arch]
                          const isSelected = arch === effectiveArchetype
                          const isInferred = arch === block.classification.inferred

                          return (
                            <button
                              key={arch}
                              type="button"
                              onClick={() => {
                                onUpdateArchetypeOverride(block.key, arch)
                                setActiveMenuBlockKey(null)
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.45rem 0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: isSelected ? 700 : 500,
                                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                color: isSelected ? '#38bdf8' : '#e2e8f0',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.4rem',
                                marginBottom: '0.15rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <span>{def.icon}</span>
                                <div>
                                  <div>{def.label}</div>
                                  <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 400 }}>
                                    {def.bestFor}
                                  </div>
                                </div>
                              </div>
                              {isInferred && (
                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    color: '#10b981',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px'
                                  }}
                                >
                                  IA
                                </span>
                              )}
                            </button>
                          )
                        })}

                        {block.classification.userOverride && (
                          <div style={{ borderTop: '1px solid #1e293b', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateArchetypeOverride(block.key, block.classification.inferred)
                                setActiveMenuBlockKey(null)
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '0.68rem',
                                padding: '0.3rem 0.5rem',
                                cursor: 'pointer',
                                borderRadius: '4px'
                              }}
                            >
                              <RotateCcwIcon size={12} />
                              <span>Restaurar recomendação da IA</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Toggle Visibilidade (Olho) */}
                  {onToggleSectionVisibility && (
                    <button
                      type="button"
                      onClick={() => onToggleSectionVisibility(block.key)}
                      title={isHidden ? 'Exibir seção no documento' : 'Ocultar seção'}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '0.2rem',
                        color: isHidden ? '#64748b' : '#38bdf8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {isHidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Detalhes Expandidos da Camada (Itens Filhos & Racional da IA) */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderTop: '1px solid #1e293b',
                    background: 'rgba(15, 23, 42, 0.5)',
                    fontSize: '0.72rem'
                  }}
                >
                  {/* Racional Algorítmico da IA */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.4rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '5px',
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(51, 65, 85, 0.3)',
                      marginBottom: '0.6rem'
                    }}
                  >
                    <SparklesIcon size={13} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>Diagnóstico da IA: </span>
                      <span style={{ color: '#94a3b8' }}>{block.classification.reason}</span>
                    </div>
                  </div>

                  {/* Prévia dos Itens Filhos */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                      Nós Contidos ({block.items.length})
                    </div>
                    {block.items.slice(0, 6).map((it, idx) => (
                      <div
                        key={it.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.25rem 0.45rem',
                          background: '#1e293b',
                          borderRadius: '4px',
                          color: '#e2e8f0',
                          fontSize: '0.7rem'
                        }}
                      >
                        <span style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                          {it.title || `Item #${idx + 1}`}
                        </span>
                        {it.date && (
                          <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>{it.date}</span>
                        )}
                        {it.badges && it.badges.length > 0 && (
                          <span style={{ fontSize: '0.64rem', color: '#38bdf8' }}>{it.badges.length} tags</span>
                        )}
                      </div>
                    ))}
                    {block.items.length > 6 && (
                      <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center', marginTop: '0.2rem' }}>
                        + {block.items.length - 6} itens adicionais ocultos na prévia
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

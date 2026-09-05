import React, { useState } from 'react'
import type { LayoutVariant } from '../../types/cv'
import { LAYOUT_BLUEPRINTS } from '../../engine/blueprints'

interface LandingGallerySectionProps {
  activeLayout: LayoutVariant
  onSelectLayout: (layoutId: LayoutVariant) => void
}

type CategoryFilter = 'all' | 'ats' | 'sidebar' | 'hero' | 'canvas'

interface TemplateCardMeta {
  id: LayoutVariant
  category: CategoryFilter
  tags: string[]
  recommendedFor: string
  schematic: {
    hasHero?: boolean
    hasSidebar?: 'left' | 'right' | 'none'
    layoutType: '1col' | '2col' | 'hero' | 'grid'
  }
}

const TEMPLATE_METADATA: Record<LayoutVariant, TemplateCardMeta> = {
  modular: {
    id: 'modular',
    category: 'ats',
    tags: ['ATS Friendly', 'Cartões Modulares', 'Equilibrado'],
    recommendedFor: 'Engenheiros, Tech Leads, Gerentes de Projetos',
    schematic: { hasSidebar: 'none', layoutType: '1col' }
  },
  linear: {
    id: 'linear',
    category: 'ats',
    tags: ['100% ATS Safe', 'Máxima Densidade', 'Clássico'],
    recommendedFor: 'Consultorias, Vagas Corporativas, Triagens Automáticas',
    schematic: { hasSidebar: 'none', layoutType: '1col' }
  },
  sidebar: {
    id: 'sidebar',
    category: 'sidebar',
    tags: ['2 Colunas', 'Coluna Lateral Dark', 'Executivo'],
    recommendedFor: 'C-Level, Diretores, Especialistas Sênior',
    schematic: { hasSidebar: 'left', layoutType: '2col' }
  },
  compact_split: {
    id: 'compact_split',
    category: 'sidebar',
    tags: ['Split Duo', 'Barras de Nível', 'Interesses'],
    recommendedFor: 'Designers de Produto, UX/UI, Arquitetos de Software',
    schematic: { hasSidebar: 'left', layoutType: '2col' }
  },
  editorial_accent: {
    id: 'editorial_accent',
    category: 'sidebar',
    tags: ['Brand Accent', 'Foto Vertical', 'Destaque de Ano'],
    recommendedFor: 'Marketing, Comunicação, Criativos e Estrategistas',
    schematic: { hasHero: true, hasSidebar: 'left', layoutType: 'hero' }
  },
  corporate_timeline: {
    id: 'corporate_timeline',
    category: 'sidebar',
    tags: ['Navy Timeline', 'Nós Conectados', 'Dados Civis'],
    recommendedFor: 'Bancos, Finanças, Engenharia Civil e Infraestrutura',
    schematic: { hasSidebar: 'left', layoutType: '2col' }
  },
  warm_magazine: {
    id: 'warm_magazine',
    category: 'sidebar',
    tags: ['Warm Editorial', 'Selo Circular', 'Cores Neutras'],
    recommendedFor: 'Advocacia, Pesquisa, Saúde e Moda',
    schematic: { hasHero: true, hasSidebar: 'left', layoutType: 'hero' }
  },
  hero_matrix: {
    id: 'hero_matrix',
    category: 'hero',
    tags: ['Hero Banner', 'Matriz de Skills', 'Contatos Topo'],
    recommendedFor: 'Desenvolvedores Full Stack, DevOps, Data Scientists',
    schematic: { hasHero: true, hasSidebar: 'none', layoutType: 'hero' }
  },
  dynamic_math: {
    id: 'dynamic_math',
    category: 'hero',
    tags: ['Grid Matemático', 'Equilíbrio 3x2', 'Alta Informação'],
    recommendedFor: 'Cientistas, Matemáticos, Analistas Quantitativos',
    schematic: { hasHero: true, hasSidebar: 'none', layoutType: 'grid' }
  },
  canvas_livre: {
    id: 'canvas_livre',
    category: 'canvas',
    tags: ['Modo Livre', '12 Colunas', 'Arrastar & Soltar'],
    recommendedFor: 'Quem deseja liberdade total para compor qualquer layout',
    schematic: { hasSidebar: 'none', layoutType: 'grid' }
  }
}

export const LandingGallerySection: React.FC<LandingGallerySectionProps> = ({
  activeLayout,
  onSelectLayout
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('all')

  const blueprintsList = Object.values(LAYOUT_BLUEPRINTS)

  const filteredList = blueprintsList.filter(bp => {
    if (filter === 'all') return true
    const meta = TEMPLATE_METADATA[bp.id]
    return meta?.category === filter
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Filtros */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc' }}>
                Galeria de Modelos & Blueprints A4
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              10 modelos arquitetados com proporções milimétricas para impressão e exportação em PDF A4 sem quebras indesejadas. Clique em qualquer modelo para aplicá-lo instantaneamente ao seu currículo!
            </p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginRight: '0.3rem' }}>
            Filtrar:
          </span>
          {[
            { id: 'all', label: 'Todos (10)', icon: '🌟' },
            { id: 'ats', label: 'ATS Clássicos & Clean', icon: '📄' },
            { id: 'sidebar', label: '2 Colunas / Sidebar', icon: '📑' },
            { id: 'hero', label: 'Hero Banner & Matriz', icon: '🖼️' },
            { id: 'canvas', label: 'Modo Livre (Canvas)', icon: '🎨' }
          ].map(f => {
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as CategoryFilter)}
                style={{
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                  background: isActive ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{f.icon}</span> {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid de Modelos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}
      >
        {filteredList.map(bp => {
          const meta = TEMPLATE_METADATA[bp.id]
          const isSelected = activeLayout === bp.id

          return (
            <div
              key={bp.id}
              onClick={() => onSelectLayout(bp.id)}
              style={{
                background: isSelected ? 'rgba(14, 165, 233, 0.08)' : 'rgba(15, 23, 42, 0.7)',
                border: isSelected ? '2px solid #38bdf8' : '1px solid #1e293b',
                borderRadius: '16px',
                padding: '1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
                boxShadow: isSelected ? '0 0 25px rgba(56, 189, 248, 0.25)' : '0 4px 15px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Topo do Card */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{bp.icon}</span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                      {bp.name}
                    </h3>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                    {bp.description}
                  </p>
                </div>

                {isSelected ? (
                  <span
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ✓ ATIVO
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    A4 NATIVO
                  </span>
                )}
              </div>

              {/* Miniatura Esquemática A4 */}
              <div
                style={{
                  height: '130px',
                  background: '#020617',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  display: 'flex',
                  padding: '8px',
                  gap: '6px',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
              >
                {meta?.schematic.hasSidebar === 'left' && (
                  <div
                    style={{
                      width: '32%',
                      height: '100%',
                      background: '#1e293b',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '6px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#38bdf8', alignSelf: 'center' }} />
                    <div style={{ height: '4px', width: '70%', background: '#475569', borderRadius: '2px' }} />
                    <div style={{ height: '4px', width: '90%', background: '#334155', borderRadius: '2px' }} />
                    <div style={{ height: '4px', width: '80%', background: '#334155', borderRadius: '2px' }} />
                  </div>
                )}

                <div
                  style={{
                    flex: 1,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px'
                  }}
                >
                  {meta?.schematic.hasHero && (
                    <div
                      style={{
                        height: '24px',
                        background: 'linear-gradient(90deg, #0284c7, #6366f1)',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ height: '4px', width: '50%', background: '#ffffff', borderRadius: '2px' }} />
                    </div>
                  )}
                  <div style={{ height: '6px', width: '60%', background: '#64748b', borderRadius: '2px' }} />
                  <div style={{ height: '4px', width: '90%', background: '#334155', borderRadius: '2px' }} />
                  <div style={{ height: '4px', width: '80%', background: '#334155', borderRadius: '2px' }} />
                  <div style={{ height: '4px', width: '70%', background: '#334155', borderRadius: '2px' }} />
                  <div style={{ height: '5px', width: '40%', background: '#0284c7', borderRadius: '2px', marginTop: '3px' }} />
                  <div style={{ height: '4px', width: '85%', background: '#334155', borderRadius: '2px' }} />
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {meta?.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      background: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Recomendado para & Botão */}
              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: '0.6rem',
                  borderTop: '1px solid #1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                  <strong style={{ color: '#94a3b8' }}>Ideal para:</strong> {meta?.recommendedFor}
                </div>

                <button
                  type="button"
                  style={{
                    padding: '0.45rem 0.95rem',
                    background: isSelected ? '#10b981' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  {isSelected ? '✓ Em Uso' : '✨ Selecionar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

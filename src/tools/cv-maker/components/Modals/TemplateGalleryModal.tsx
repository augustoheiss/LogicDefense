import React, { useState } from 'react'
import type { LayoutVariant } from '../../types/cv'
import { LAYOUT_BLUEPRINTS } from '../../engine/blueprints'

interface TemplateGalleryModalProps {
  isOpen: boolean
  onClose: () => void
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

export const TemplateGalleryModal: React.FC<TemplateGalleryModalProps> = ({
  isOpen,
  onClose,
  activeLayout,
  onSelectLayout
}) => {
  const [filter, setFilter] = useState<CategoryFilter>('all')

  if (!isOpen) return null

  const blueprintsList = Object.values(LAYOUT_BLUEPRINTS)

  const filteredList = blueprintsList.filter(bp => {
    if (filter === 'all') return true
    const meta = TEMPLATE_METADATA[bp.id]
    return meta?.category === filter
  })

  return (
    <div
      className="cv-modal-backdrop cv-no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.82)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        className="cv-modal-card"
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #0f172a, #1e293b)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🖼️</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Galeria de Modelos & Layouts A4
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              10 modelos arquitetados com proporções milimétricas para impressão e PDF A4 sem quebras indesejadas.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter Pills Bar */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid #1e293b',
            background: '#0b1120',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
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
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                  background: isActive ? 'rgba(56, 189, 248, 0.18)' : '#1e293b',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{f.icon}</span> {f.label}
              </button>
            )
          })}
        </div>

        {/* Grid of Cards */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem'
          }}
        >
          {filteredList.map(bp => {
            const meta = TEMPLATE_METADATA[bp.id]
            const isSelected = activeLayout === bp.id

            return (
              <div
                key={bp.id}
                style={{
                  background: isSelected ? 'rgba(14, 165, 233, 0.08)' : '#1e293b',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #334155',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onClick={() => {
                  onSelectLayout(bp.id)
                  onClose()
                }}
              >
                {/* Active Indicator Badge */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      background: '#0284c7',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px'
                    }}
                  >
                    ✓ Ativo Agora
                  </div>
                )}

                {/* Schematic A4 Thumbnail Miniature */}
                <div
                  style={{
                    height: '85px',
                    background: '#0f172a',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    overflow: 'hidden'
                  }}
                >
                  {/* Hero Bar if applicable */}
                  {meta?.schematic.hasHero && (
                    <div style={{ height: '18px', background: '#38bdf8', borderRadius: '3px', opacity: 0.85 }} />
                  )}

                  <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                    {/* Sidebar column if applicable */}
                    {meta?.schematic.hasSidebar === 'left' && (
                      <div style={{ width: '32%', background: '#334155', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '3px', padding: '3px' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#64748b' }} />
                        <div style={{ height: '4px', width: '80%', background: '#475569', borderRadius: '2px' }} />
                        <div style={{ height: '4px', width: '60%', background: '#475569', borderRadius: '2px' }} />
                      </div>
                    )}

                    {/* Main content column */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px', padding: '2px' }}>
                      <div style={{ height: '6px', width: '50%', background: '#e2e8f0', borderRadius: '2px' }} />
                      <div style={{ height: '4px', width: '100%', background: '#64748b', borderRadius: '2px' }} />
                      <div style={{ height: '4px', width: '90%', background: '#64748b', borderRadius: '2px' }} />
                      <div style={{ height: '4px', width: '75%', background: '#64748b', borderRadius: '2px' }} />
                    </div>
                  </div>
                </div>

                {/* Title & Icon */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{bp.icon}</span>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                      {bp.name}
                    </h3>
                  </div>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.45 }}>
                    {bp.description}
                  </p>
                </div>

                {/* Tags */}
                {meta?.tags && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {meta.tags.map(t => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.68rem',
                          background: '#0f172a',
                          color: '#93c5fd',
                          border: '1px solid #1e293b',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px'
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Recommended For */}
                {meta?.recommendedFor && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    🎯 <strong>Ideal para:</strong> {meta.recommendedFor}
                  </div>
                )}

                {/* Apply Button */}
                <button
                  type="button"
                  style={{
                    marginTop: 'auto',
                    padding: '0.45rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: isSelected ? '1px solid #0284c7' : '1px solid #475569',
                    background: isSelected ? '#0284c7' : '#0f172a',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isSelected ? '✓ Modelo Selecionado' : 'Aplicar Este Modelo'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid #1e293b',
            background: '#0b1120',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: '#94a3b8'
          }}
        >
          <div>
            💡 Dica: Você pode combinar qualquer modelo com texturas de fundo IA e paletas no botão <strong>🎨 Design & Estilo</strong>.
          </div>
          <button
            type="button"
            className="cv-btn-secondary"
            onClick={onClose}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

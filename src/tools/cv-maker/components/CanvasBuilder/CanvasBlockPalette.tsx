import React from 'react'
import type { BlockIdentifier, CanvasBlockConfig, CVData } from '../../types/cv'
import {
  AVAILABLE_PALETTE_ITEMS,
  CANVAS_PRESETS,
  createBlockFromType
} from '../../services/canvasBuilderService'

interface CanvasBlockPaletteProps {
  data: CVData | null
  onAddBlock: (block: CanvasBlockConfig) => void
  onApplyPreset: (presetId: string) => void
  onClearCanvas: () => void
  activeBlockCount: number
}

export const CanvasBlockPalette: React.FC<CanvasBlockPaletteProps> = ({
  data,
  onAddBlock,
  onApplyPreset,
  onClearCanvas,
  activeBlockCount
}) => {
  // Helper para contar dados presentes no YAML
  const getFieldCount = (type: BlockIdentifier): string => {
    if (!data) return ''
    switch (type) {
      case 'work':
        return data.work?.length ? `${data.work.length} exp.` : 'vazio'
      case 'projects':
        return data.projects?.length ? `${data.projects.length} proj.` : 'vazio'
      case 'education':
        return data.education?.length ? `${data.education.length} cursos` : 'vazio'
      case 'skills_tags':
      case 'skills_bars':
        return data.skills?.length ? `${data.skills.length} grupos` : 'vazio'
      case 'certificates':
        return data.certificates?.length ? `${data.certificates.length} cert.` : 'vazio'
      case 'languages':
        return data.languages?.length ? `${data.languages.length} id.` : 'vazio'
      case 'interests':
        return data.interests?.length ? `${data.interests.length} int.` : 'vazio'
      case 'photo':
        return data.basics?.image ? 'com foto' : 'sem foto'
      case 'summary':
        return data.basics?.summary ? 'preenchido' : 'vazio'
      default:
        return ''
    }
  }

  const categories = [
    { id: 'identity', label: '👤 Identidade & Contato' },
    { id: 'content', label: '📝 Trajetória & Conteúdo' },
    { id: 'skills', label: '⚡ Competências & Níveis' },
    { id: 'academic', label: '🎓 Formação & Certificações' },
    { id: 'extras', label: '🌐 Idiomas & Interesses' }
  ] as const

  return (
    <aside className="cv-canvas-palette" aria-label="Paleta de Blocos do YAML">
      <div className="cv-canvas-palette__header">
        <h3 className="cv-canvas-palette__title">
          <span>📦</span> Campos do YAML
        </h3>
        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
          {activeBlockCount} {activeBlockCount === 1 ? 'bloco' : 'blocos'}
        </span>
      </div>

      {/* Body com Scroll Independente e Suave */}
      <div className="cv-canvas-palette__body">
        {/* Modelos / Presets de Partida */}
        <div className="cv-canvas-palette__presets">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Templates Rápidos
            </span>
            <button
              type="button"
              onClick={onClearCanvas}
              style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600 }}
              title="Limpa todos os blocos para começar do zero"
            >
              🗑️ Limpar
            </button>
          </div>
          {CANVAS_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className="cv-canvas-preset-btn"
              onClick={() => onApplyPreset(preset.id)}
              title={preset.description}
            >
              <span>{preset.icon} {preset.name}</span>
              <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>
                {preset.blocks.length ? `${preset.blocks.length} blocos` : '0 blocos'}
              </span>
            </button>
          ))}
        </div>

        {/* Categorias de Blocos */}
        {categories.map(cat => {
          const items = AVAILABLE_PALETTE_ITEMS.filter(item => item.category === cat.id)
          if (!items.length) return null

          return (
            <div key={cat.id} className="cv-canvas-palette__section">
              <div className="cv-canvas-palette__sec-title">{cat.label}</div>
              {items.map(item => {
                const countBadge = getFieldCount(item.type)
                return (
                  <button
                    key={item.type}
                    type="button"
                    className="cv-canvas-item-btn"
                    onClick={() => onAddBlock(createBlockFromType(item.type))}
                    title={`Adicionar ${item.label} à folha A4`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <span className="item-icon">{item.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '0.78rem', color: '#f1f5f9', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {item.label}
                        </span>
                        {countBadge && (
                          <span style={{ fontSize: '0.66rem', color: countBadge === 'vazio' || countBadge === 'sem foto' ? '#64748b' : '#38bdf8' }}>
                            {countBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="item-add-plus">+</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

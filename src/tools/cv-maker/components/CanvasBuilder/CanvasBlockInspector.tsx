import React from 'react'
import type { CanvasBlockConfig } from '../../types/cv'

interface CanvasBlockInspectorProps {
  block: CanvasBlockConfig | null
  onClose: () => void
  onUpdateBlock: (updated: CanvasBlockConfig) => void
  onDeleteBlock: (id: string) => void
}

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans (Moderno Executivo)', value: 'Plus Jakarta Sans' },
  { label: 'Inter (Alta Legibilidade ATS)', value: 'Inter' },
  { label: 'Roboto (Google Clean)', value: 'Roboto' },
  { label: 'Lora (Editorial Serif Elegante)', value: 'Lora' },
  { label: 'Merriweather (Serif Literária)', value: 'Merriweather' },
  { label: 'Montserrat (Geométrico Forte)', value: 'Montserrat' },
  { label: 'Outfit (Tech & Modern)', value: 'Outfit' },
  { label: 'Cinzel (Clássico Romano)', value: 'Cinzel' },
  { label: 'Courier Prime (Terminal Monospaced)', value: 'Courier Prime' },
  { label: 'Fira Code (Desenvolvedor Mono)', value: 'Fira Code' }
]

const COLOR_SWATCHES = [
  '#0f172a', // Slate 900
  '#0284c7', // Sky 600
  '#059669', // Emerald 600
  '#7c3aed', // Violet 600
  '#d97706', // Amber 600
  '#dc2626', // Red 600
  '#475569', // Slate 600
  '#2563eb'  // Blue 600
]

const BG_SWATCHES = [
  { label: 'Transparente', value: 'transparent' },
  { label: 'Branco', value: '#ffffff' },
  { label: 'Cinza Suave', value: '#f8fafc' },
  { label: 'Azul Claro', value: '#f0f9ff' },
  { label: 'Verde Suave', value: '#f0fdf4' },
  { label: 'Dark Navy', value: '#0f172a' }
]

export const CanvasBlockInspector: React.FC<CanvasBlockInspectorProps> = ({
  block,
  onClose,
  onUpdateBlock,
  onDeleteBlock
}) => {
  if (!block) return null

  const handleChange = <K extends keyof CanvasBlockConfig>(key: K, value: CanvasBlockConfig[K]) => {
    onUpdateBlock({
      ...block,
      [key]: value
    })
  }

  return (
    <div className="cv-canvas-inspector-backdrop" onClick={onClose}>
      <aside className="cv-canvas-inspector" onClick={e => e.stopPropagation()}>
        <div className="cv-canvas-inspector__header">
          <h3 className="cv-canvas-inspector__title">
            ⚙️ Personalizar Bloco
          </h3>
          <button
            type="button"
            className="cv-modal-close"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Título do Bloco */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Título do Bloco (Opcional)</label>
          <input
            type="text"
            className="cv-canvas-inspector__input"
            value={block.customTitle || ''}
            onChange={e => handleChange('customTitle', e.target.value)}
            placeholder="Ex: Experiência Profissional"
          />
        </div>

        {/* Largura da Coluna (12-Col Grid) */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Largura na Folha A4</label>
          <select
            className="cv-canvas-inspector__select"
            value={block.colSpan}
            onChange={e => handleChange('colSpan', Number(e.target.value) as any)}
          >
            <option value={12}>100% (Largura Total - 12 colunas)</option>
            <option value={8}>66.6% (2/3 da folha - 8 colunas)</option>
            <option value={6}>50% (Metade da folha - 6 colunas)</option>
            <option value={4}>33.3% (1/3 da folha - 4 colunas)</option>
            <option value={3}>25% (1/4 da folha - 3 colunas)</option>
          </select>
        </div>

        {/* Tipografia / Fonte */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Família da Fonte</label>
          <select
            className="cv-canvas-inspector__select"
            value={block.fontFamily || 'inherit'}
            onChange={e => handleChange('fontFamily', e.target.value)}
          >
            <option value="inherit">Padrão do Tema Global</option>
            {FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Escala de Fonte */}
        <div className="cv-canvas-inspector__group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="cv-canvas-inspector__label">Tamanho da Fonte</label>
            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
              {(block.fontSizeScale || 1.0).toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.4"
            step="0.05"
            value={block.fontSizeScale || 1.0}
            onChange={e => handleChange('fontSizeScale', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>

        {/* Cores do Texto */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Cor do Texto Principal</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {COLOR_SWATCHES.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => handleChange('customTextColor', color)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: color,
                  border: block.customTextColor === color ? '2px solid #38bdf8' : '1px solid #475569',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Fundo do Bloco */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Cor de Fundo do Bloco</label>
          <select
            className="cv-canvas-inspector__select"
            value={block.customBgColor || 'transparent'}
            onChange={e => handleChange('customBgColor', e.target.value)}
          >
            {BG_SWATCHES.map(bg => (
              <option key={bg.value} value={bg.value}>{bg.label}</option>
            ))}
          </select>
        </div>

        {/* Espaçamento / Padding */}
        <div className="cv-canvas-inspector__group">
          <label className="cv-canvas-inspector__label">Espaçamento Interno (Padding)</label>
          <select
            className="cv-canvas-inspector__select"
            value={block.padding || 'normal'}
            onChange={e => handleChange('padding', e.target.value as any)}
          >
            <option value="none">Nenhum (0px)</option>
            <option value="compact">Compacto (0.35rem)</option>
            <option value="normal">Normal (0.75rem)</option>
            <option value="spacious">Espaçoso (1.25rem)</option>
          </select>
        </div>

        {/* Ações Inferiores */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #1e293b' }}>
          <button
            type="button"
            className="cv-btn-secondary"
            style={{ color: '#f87171', borderColor: '#ef4444', flex: 1 }}
            onClick={() => {
              onDeleteBlock(block.id)
              onClose()
            }}
          >
            🗑️ Excluir Bloco
          </button>
          <button
            type="button"
            className="cv-btn-primary"
            style={{ flex: 1 }}
            onClick={onClose}
          >
            ✓ Concluir
          </button>
        </div>
      </aside>
    </div>
  )
}

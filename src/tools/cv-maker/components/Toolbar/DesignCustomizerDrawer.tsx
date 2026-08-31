import React from 'react'
import type { CVDesignConfig } from '../../types/cv'
import { DEFAULT_DESIGN_CONFIG } from '../../types/cv'

interface DesignCustomizerDrawerProps {
  isOpen: boolean
  onClose: () => void
  config: CVDesignConfig
  onChangeConfig: (newConfig: CVDesignConfig) => void
}

interface FontPairPreset {
  name: string
  label: string
  heading: string
  body: string
  description: string
}

const FONT_PRESETS: FontPairPreset[] = [
  {
    name: 'tech_modern',
    label: '🚀 Tech & Modern',
    heading: 'Plus Jakarta Sans',
    body: 'Inter',
    description: 'Silicon Valley, Startups, ATS-Friendly & Clean'
  },
  {
    name: 'executive_editorial',
    label: '🏛️ Executive Luxury',
    heading: 'Cinzel',
    body: 'Roboto',
    description: 'C-Level, Jurídico, Consultoria & Finanças'
  },
  {
    name: 'hacker_engineering',
    label: '💻 Hacker & Terminal',
    heading: 'Courier Prime',
    body: 'Courier Prime',
    description: 'Cybersecurity, DevOps, Infra & Sistemas'
  },
  {
    name: 'creative_design',
    label: '🎨 Creative & Product',
    heading: 'Poppins',
    body: 'Plus Jakarta Sans',
    description: 'UX/UI, Agências, Marketing & Growth'
  },
  {
    name: 'humanist_academic',
    label: '📖 Humanist & Academic',
    heading: 'Lora',
    body: 'Open Sans',
    description: 'Medicina, Pesquisa, Educação & Literatura'
  },
  {
    name: 'classic_editorial',
    label: '📰 Classic Editorial',
    heading: 'Merriweather',
    body: 'Inter',
    description: 'Imprensa, Gestão Tradicional & Consultoria'
  }
]

const COLOR_PRESETS = [
  {
    name: 'IBM Blue Executive',
    primary: '#0284c7',
    secondary: '#0369a1',
    accent: '#f97316',
    surface: '#f8fafc',
    bg: '#ffffff',
    text: '#0f172a'
  },
  {
    name: 'Emerald Matrix',
    primary: '#059669',
    secondary: '#047857',
    accent: '#10b981',
    surface: '#f0fdf4',
    bg: '#ffffff',
    text: '#064e3b'
  },
  {
    name: 'Cyber Violet',
    primary: '#7c3aed',
    secondary: '#6d28d9',
    accent: '#ec4899',
    surface: '#faf5ff',
    bg: '#ffffff',
    text: '#1e1b4b'
  },
  {
    name: 'Obsidian Gold',
    primary: '#b45309',
    secondary: '#92400e',
    accent: '#f59e0b',
    surface: '#fffbeb',
    bg: '#ffffff',
    text: '#1c1917'
  },
  {
    name: 'Slate Minimalist',
    primary: '#334155',
    secondary: '#475569',
    accent: '#0284c7',
    surface: '#f1f5f9',
    bg: '#ffffff',
    text: '#0f172a'
  },
  {
    name: 'Burgundy Prestige',
    primary: '#9f1239',
    secondary: '#881337',
    accent: '#e11d48',
    surface: '#fff1f2',
    bg: '#ffffff',
    text: '#1c1917'
  }
]

const BACKGROUND_OPTIONS = [
  {
    id: 'none',
    name: 'Branco Puro (ATS Clean)',
    url: 'none',
    previewColor: '#ffffff'
  },
  {
    id: 'bg-minimalist-gold',
    name: 'Minimalist Luxury Gold',
    url: '/cv-backgrounds/Minimalist_luxury_resume_stationery_bac_202608312017.jpeg',
    previewColor: '#fefce8'
  },
  {
    id: 'bg-abstract-blue',
    name: 'Abstract Corporate Blue',
    url: '/cv-backgrounds/Abstract_corporate_A4_background._202608312017.jpeg',
    previewColor: '#f0f9ff'
  },
  {
    id: 'bg-engineering-grid',
    name: 'Engineering Blueprint Grid',
    url: '/cv-backgrounds/Engineering_resume_background_grid_202608312017.jpeg',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-geometric-lines',
    name: 'Geometric Line Art',
    url: '/cv-backgrounds/Geometric_line_art_resume_statio._202608312017.jpeg',
    previewColor: '#f5f3ff'
  },
  {
    id: 'bg-corporate-curved',
    name: 'Corporate Curved Wave',
    url: '/cv-backgrounds/Corporate_background_with_curved._202608312017.jpeg',
    previewColor: '#f0fdf4'
  }
]

export const DesignCustomizerDrawer: React.FC<DesignCustomizerDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig
}) => {
  if (!isOpen) return null

  const handleFontPreset = (preset: FontPairPreset) => {
    onChangeConfig({
      ...config,
      fontHeading: preset.heading,
      fontBody: preset.body
    })
  }

  const handleColorPreset = (palette: typeof COLOR_PRESETS[0]) => {
    onChangeConfig({
      ...config,
      colorPrimary: palette.primary,
      colorSecondary: palette.secondary,
      colorAccent: palette.accent,
      colorSurface: palette.surface,
      colorBg: palette.bg,
      colorText: palette.text
    })
  }

  const handleReset = () => {
    onChangeConfig(DEFAULT_DESIGN_CONFIG)
  }

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div
        className="cv-modal-card"
        style={{
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🎨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Customização de Design & Estilo</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>Personalize fontes, cores, escala e fundos com aplicação em tempo real.</p>
            </div>
          </div>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Scrollable Content */}
        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
          
          {/* ── 1. Tipografia & Escala de Fonte ── */}
          <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🔤 Tipografia & Tamanho da Fonte
            </h4>

            {/* Escala de Fonte (Slider) */}
            <div style={{ marginBottom: '1rem', background: '#06090f', padding: '0.85rem', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                  📏 Tamanho / Escala Global do Texto: <strong>{Math.round(config.fontScale * 100)}%</strong>
                </label>
                <span style={{ fontSize: '0.72rem', color: config.fontScale < 0.95 ? '#38bdf8' : config.fontScale > 1.05 ? '#f59e0b' : '#10b981' }}>
                  {config.fontScale <= 0.9 ? 'Compacto A4 (Mais Conteúdo)' : config.fontScale >= 1.1 ? 'Amplo / Confortável' : 'Equilibrado'}
                </span>
              </div>
              <input
                type="range"
                min="0.80"
                max="1.25"
                step="0.05"
                value={config.fontScale}
                onChange={e => onChangeConfig({ ...config, fontScale: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
              />
            </div>

            {/* Presets de Pareamento Tipográfico */}
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '0.5rem' }}>
              Pareamentos Recomendados:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {FONT_PRESETS.map(preset => {
                const isActive = config.fontHeading === preset.heading && config.fontBody === preset.body
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleFontPreset(preset)}
                    style={{
                      background: isActive ? 'rgba(56, 189, 248, 0.15)' : '#06090f',
                      border: isActive ? '1.5px solid #38bdf8' : '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '0.6rem 0.5rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? '#38bdf8' : '#f1f5f9' }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      {preset.heading} + {preset.body}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── 2. Paleta Cromática ── */}
          <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🌈 Paletas de Cores Semânticas
            </h4>

            {/* Presets Cromáticos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
              {COLOR_PRESETS.map(palette => {
                const isActive = config.colorPrimary === palette.primary
                return (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() => handleColorPreset(palette)}
                    style={{
                      background: isActive ? 'rgba(16, 185, 129, 0.15)' : '#06090f',
                      border: isActive ? '1.5px solid #10b981' : '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: palette.primary, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f1f5f9' }}>{palette.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Pickers Manuais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#06090f', padding: '0.75rem', borderRadius: '6px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Cor Primária (Títulos/Bordas):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="color"
                    value={config.colorPrimary}
                    onChange={e => onChangeConfig({ ...config, colorPrimary: e.target.value })}
                    style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorPrimary}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Cor de Destaque / Badges:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="color"
                    value={config.colorAccent}
                    onChange={e => onChangeConfig({ ...config, colorAccent: e.target.value })}
                    style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorAccent}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 3. Fundos Gráficos & Texturas ── */}
          <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🖼️ Fundo da Folha & Texturas Gráficas
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
              {BACKGROUND_OPTIONS.map(bg => {
                const isActive = (config.backgroundPattern || 'none') === bg.url
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => onChangeConfig({ ...config, backgroundPattern: bg.url })}
                    style={{
                      background: isActive ? 'rgba(245, 158, 11, 0.15)' : '#06090f',
                      border: isActive ? '1.5px solid #f59e0b' : '1px solid #1e293b',
                      borderRadius: '6px',
                      padding: '0.6rem 0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ width: '100%', height: '40px', borderRadius: '4px', background: bg.previewColor, border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {bg.id === 'none' ? (
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Branco Puro</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#0f172a', fontWeight: 600 }}>Textura IA</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: isActive ? '#f59e0b' : '#f1f5f9' }}>
                      {bg.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="cv-modal-footer" style={{ borderTop: '1px solid #1e293b', padding: '1rem' }}>
          <button className="cv-btn-secondary" onClick={handleReset} style={{ color: '#f87171' }}>
            🔄 Resetar Padrões
          </button>
          <button className="cv-btn-primary" onClick={onClose}>
            ✓ Concluir Edição
          </button>
        </div>
      </div>
    </div>
  )
}

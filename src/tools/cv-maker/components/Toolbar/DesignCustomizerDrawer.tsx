import React, { useState } from 'react'
import type { CVDesignConfig, SectionStyleOverride } from '../../types/cv'
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
    id: 'bg-grid-tech',
    name: 'Grade Técnica & Engenharia',
    url: '/cv-backgrounds/bg-grid-tech.jpg',
    previewColor: '#f8fafc'
  },
  {
    id: 'bg-luxury-minimal',
    name: 'Minimalista Luxo Dourado',
    url: '/cv-backgrounds/bg-luxury-minimal.jpg',
    previewColor: '#fefce8'
  },
  {
    id: 'bg-geometric-line',
    name: 'Geométrico Poligonal Suave',
    url: '/cv-backgrounds/bg-geometric-line.jpg',
    previewColor: '#f5f3ff'
  },
  {
    id: 'bg-corporate-waves',
    name: 'Corporativo Ondas Executivas',
    url: '/cv-backgrounds/bg-corporate-waves.jpg',
    previewColor: '#f0f9ff'
  },
  {
    id: 'bg-stationery-clean',
    name: 'Papelaria Editorial Cream',
    url: '/cv-backgrounds/bg-stationery-clean.jpg',
    previewColor: '#fdfbf7'
  },
  {
    id: 'bg-technical-blueprint',
    name: 'Blueprint Arquitetura',
    url: '/cv-backgrounds/bg-technical-blueprint.jpg',
    previewColor: '#f1f5f9'
  }
]

interface SectionMeta {
  id: string
  name: string
  icon: string
  description: string
}

const SECTIONS_LIST: SectionMeta[] = [
  { id: 'sidebar', name: 'Lateral / Sidebar', icon: '🌑', description: 'Coluna lateral escura ou com contraste' },
  { id: 'header', name: 'Cabeçalho / Header', icon: '👤', description: 'Nome, cargo, contatos e topo' },
  { id: 'work', name: 'Experiência Profissional', icon: '💼', description: 'Cards e listas de experiências' },
  { id: 'education', name: 'Formação Acadêmica', icon: '🎓', description: 'Faculdades, cursos e graduação' },
  { id: 'skills', name: 'Competências / Skills', icon: '⚡', description: 'Badges, tags e barras de nível' },
  { id: 'projects', name: 'Projetos Relevantes', icon: '🚀', description: 'Cards e links de projetos' },
  { id: 'languages', name: 'Idiomas & Fluência', icon: '🗣️', description: 'Cards de línguas e níveis' },
  { id: 'certificates', name: 'Certificações', icon: '📜', description: 'Licenças e certificados' },
  { id: 'interests', name: 'Interesses & Hobbies', icon: '🎯', description: 'Hobbies, ícones e interesses' },
  { id: 'cover_letter', name: 'Carta de Apresentação', icon: '✉️', description: 'Corpo e assinatura da Cover Letter' }
]

export const DesignCustomizerDrawer: React.FC<DesignCustomizerDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onChangeConfig
}) => {
  const [activeTab, setActiveTab] = useState<'global' | 'sections'>('global')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('sidebar')

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
      colorText: palette.text,
      colorSidebar: palette.primary === '#334155' ? '#1e293b' : palette.primary === '#9f1239' ? '#4c0519' : palette.primary === '#059669' ? '#064e3b' : '#0f172a'
    })
  }

  const handleReset = () => {
    onChangeConfig(DEFAULT_DESIGN_CONFIG)
  }

  const handleUpdateSectionOverride = (secId: string, field: keyof SectionStyleOverride, value: string) => {
    const currentOverrides = config.sectionOverrides || {}
    const currentSec = currentOverrides[secId] || {}
    onChangeConfig({
      ...config,
      sectionOverrides: {
        ...currentOverrides,
        [secId]: {
          ...currentSec,
          [field]: value
        }
      }
    })
  }

  const handleResetSectionOverride = (secId: string) => {
    const currentOverrides = { ...(config.sectionOverrides || {}) }
    delete currentOverrides[secId]
    onChangeConfig({
      ...config,
      sectionOverrides: currentOverrides
    })
  }

  const activeOverridesCount = Object.keys(config.sectionOverrides || {}).length
  const currentSectionMeta = SECTIONS_LIST.find(s => s.id === selectedSectionId) || SECTIONS_LIST[0]
  const currentSectionOverride = config.sectionOverrides?.[selectedSectionId] || {}

  return (
    <div className="cv-modal-backdrop" onClick={onClose}>
      <div
        className="cv-modal-card"
        style={{
          maxWidth: '640px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="cv-modal-header" style={{ paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>🎨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>Design, Estilo & Ambiente</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Personalize tipografia, cores globais ou configure cada seção individualmente.
              </p>
            </div>
          </div>
          <button className="cv-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#080d1a', padding: '0.4rem 1rem 0' }}>
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            style={{
              padding: '0.6rem 1rem',
              background: activeTab === 'global' ? '#0f172a' : 'transparent',
              color: activeTab === 'global' ? '#38bdf8' : '#94a3b8',
              borderTop: activeTab === 'global' ? '2px solid #38bdf8' : '2px solid transparent',
              borderLeft: activeTab === 'global' ? '1px solid #1e293b' : 'none',
              borderRight: activeTab === 'global' ? '1px solid #1e293b' : 'none',
              borderBottom: 'none',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>🌐</span> Modo Geral (Folha & Ambiente)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sections')}
            style={{
              padding: '0.6rem 1rem',
              background: activeTab === 'sections' ? '#0f172a' : 'transparent',
              color: activeTab === 'sections' ? '#10b981' : '#94a3b8',
              borderTop: activeTab === 'sections' ? '2px solid #10b981' : '2px solid transparent',
              borderLeft: activeTab === 'sections' ? '1px solid #1e293b' : 'none',
              borderRight: activeTab === 'sections' ? '1px solid #1e293b' : 'none',
              borderBottom: 'none',
              borderTopLeftRadius: '6px',
              borderTopRightRadius: '6px',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <span>🎯</span> Personalização por Seção
            {activeOverridesCount > 0 && (
              <span
                style={{
                  background: '#10b981',
                  color: '#064e3b',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}
              >
                {activeOverridesCount}
              </span>
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="cv-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', padding: '1rem', paddingRight: '0.6rem' }}>
          
          {/* ═══════════════════════════════════════════════════════
              ABA 1: MODO GERAL (FOLHA, AMBIENTE, FONTES, PRESETS)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'global' && (
            <>
              {/* 1. Tipografia & Escala de Fonte */}
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
                    max="1.30"
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
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

              {/* 2. Cores Gerais da Folha, Boxes, Laterais & Ambiente */}
              <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🌈 Cores Gerais (Geralzão)
                </h4>

                {/* Presets Cromáticos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
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

                {/* Pickers Manuais Detalhados */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#06090f', padding: '0.85rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🎨 Cor da Folha A4:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorBg || '#ffffff'}
                        onChange={e => onChangeConfig({ ...config, colorBg: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorBg || '#ffffff'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🖼️ Cor do Fundo do Ambiente:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorWorkspaceBg || '#0b1120'}
                        onChange={e => onChangeConfig({ ...config, colorWorkspaceBg: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorWorkspaceBg || '#0b1120'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🏢 Cor dos Boxes / Cards (Geral):</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorSurface || '#f8fafc'}
                        onChange={e => onChangeConfig({ ...config, colorSurface: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorSurface || '#f8fafc'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🌑 Cor da Lateral / Sidebar (Geral):</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorSidebar || '#0f172a'}
                        onChange={e => onChangeConfig({ ...config, colorSidebar: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorSidebar || '#0f172a'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🔤 Cor Primária (Títulos/Destaques):</label>
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
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>⚡ Cor de Acento / Badges (Geral):</label>
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

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>✍️ Cor do Texto Principal:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorText || '#0f172a'}
                        onChange={e => onChangeConfig({ ...config, colorText: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorText || '#0f172a'}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>🔲 Cor das Bordas & Divisores:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={config.colorBorder || '#e2e8f0'}
                        onChange={e => onChangeConfig({ ...config, colorBorder: e.target.value })}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>{config.colorBorder || '#e2e8f0'}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 3. Fundos Gráficos & Texturas */}
              <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🖼️ Fundo da Folha & Texturas Gráficas (IA)
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
                        <div
                          style={{
                            width: '100%',
                            height: '46px',
                            borderRadius: '4px',
                            background: bg.url === 'none' ? '#ffffff' : `url(${bg.url}) center/cover no-repeat`,
                            backgroundColor: bg.previewColor,
                            border: '1px solid #334155',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)'
                          }}
                        >
                          {bg.id === 'none' && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Branco Puro</span>
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
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              ABA 2: PERSONALIZAÇÃO POR SEÇÃO (MENU GRANULAR)
             ═══════════════════════════════════════════════════════ */}
          {activeTab === 'sections' && (
            <section style={{ background: '#0b1120', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  📌 Escolha a Seção para Customizar:
                </label>
                <select
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#06090f',
                    color: '#f8fafc',
                    border: '1.5px solid #10b981',
                    borderRadius: '6px',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {SECTIONS_LIST.map(sec => {
                    const hasOverride = Boolean(config.sectionOverrides?.[sec.id])
                    return (
                      <option key={sec.id} value={sec.id}>
                        {sec.icon} {sec.name} {hasOverride ? '✨ (Customizado)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Informações da Seção Selecionada */}
              <div style={{ background: '#06090f', padding: '0.85rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{currentSectionMeta.icon}</span> {currentSectionMeta.name}
                    </h5>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                      {currentSectionMeta.description}
                    </p>
                  </div>

                  {Boolean(config.sectionOverrides?.[selectedSectionId]) && (
                    <button
                      type="button"
                      onClick={() => handleResetSectionOverride(selectedSectionId)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        fontSize: '0.72rem',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      ↺ Restaurar ao Padrão
                    </button>
                  )}
                </div>

                {/* Controles da Seção */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  
                  {/* Cor do Texto da Seção */}
                  <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                      ✍️ Cor do Texto:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={currentSectionOverride.textColor || (selectedSectionId === 'sidebar' ? '#cbd5e1' : config.colorText || '#0f172a')}
                        onChange={e => handleUpdateSectionOverride(selectedSectionId, 'textColor', e.target.value)}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {currentSectionOverride.textColor || 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Cor dos Títulos da Seção */}
                  <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                      🔤 Cor do Título / H2:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={currentSectionOverride.titleColor || (selectedSectionId === 'sidebar' ? '#38bdf8' : config.colorPrimary || '#0284c7')}
                        onChange={e => handleUpdateSectionOverride(selectedSectionId, 'titleColor', e.target.value)}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {currentSectionOverride.titleColor || 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Cor de Fundo / Box da Seção */}
                  <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                      🏢 Cor de Fundo / Box:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={currentSectionOverride.bgColor || (selectedSectionId === 'sidebar' ? config.colorSidebar || '#0f172a' : config.colorSurface || '#f8fafc')}
                        onChange={e => handleUpdateSectionOverride(selectedSectionId, 'bgColor', e.target.value)}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {currentSectionOverride.bgColor || 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Cor da Borda da Seção */}
                  <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                      🔲 Bordas & Divisores:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={currentSectionOverride.borderColor || config.colorBorder || '#e2e8f0'}
                        onChange={e => handleUpdateSectionOverride(selectedSectionId, 'borderColor', e.target.value)}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {currentSectionOverride.borderColor || 'Padrão'}
                      </span>
                    </div>
                  </div>

                  {/* Cor de Acento / Badges da Seção */}
                  <div style={{ background: '#0b1120', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b', gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                      ⚡ Cor de Acento / Badges / Barras da Seção:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="color"
                        value={currentSectionOverride.accentColor || config.colorAccent || '#f97316'}
                        onChange={e => handleUpdateSectionOverride(selectedSectionId, 'accentColor', e.target.value)}
                        style={{ width: '32px', height: '28px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {currentSectionOverride.accentColor || 'Padrão'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dica de Navegação Rápida entre Seções */}
              <div>
                <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '0.4rem' }}>
                  Atalhos Rápidos de Seções:
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {SECTIONS_LIST.map(sec => {
                    const isSelected = sec.id === selectedSectionId
                    const isOverridden = Boolean(config.sectionOverrides?.[sec.id])
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setSelectedSectionId(sec.id)}
                        style={{
                          background: isSelected ? '#10b981' : isOverridden ? 'rgba(16, 185, 129, 0.2)' : '#06090f',
                          color: isSelected ? '#064e3b' : isOverridden ? '#34d399' : '#94a3b8',
                          border: isSelected ? '1px solid #10b981' : isOverridden ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #1e293b',
                          borderRadius: '4px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <span>{sec.icon}</span>
                        <span>{sec.name}</span>
                        {isOverridden && !isSelected && <span>✨</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="cv-modal-footer" style={{ borderTop: '1px solid #1e293b', padding: '0.85rem 1rem' }}>
          <button className="cv-btn-secondary" onClick={handleReset} style={{ color: '#f87171' }}>
            🔄 Resetar Tudo (Padrões)
          </button>
          <button className="cv-btn-primary" onClick={onClose}>
            ✓ Concluir Edição
          </button>
        </div>
      </div>
    </div>
  )
}

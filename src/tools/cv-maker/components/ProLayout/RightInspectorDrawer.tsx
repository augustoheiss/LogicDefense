import React from 'react'
import type { LayoutVariant, CVDesignConfig, PageFormat, CustomPageDimensions, CVData } from '../../types/cv'
import { LAYOUT_OPTIONS } from '../../types/cv'
import { PAGE_FORMATS } from '../../engine/PageFormatEngine'
import { calculateAtsReport } from '../../engine/AtsEngine'
import {
  CloseIcon,
  LayoutIcon,
  PaletteIcon,
  TargetIcon,
  CheckIcon,
  FileTextIcon,
  SlidersIcon
} from '../Icons/ProIcons'

export type InspectorTab = 'templates' | 'design' | 'ats' | 'format'

interface RightInspectorDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  activeLayout: LayoutVariant
  onLayoutChange: (layout: LayoutVariant) => void
  designConfig: CVDesignConfig
  onChangeDesignConfig: (newConfig: CVDesignConfig) => void
  cvData: CVData | null
  jdText: string
  onJdTextChange: (text: string) => void
  isVisualHeatmapActive: boolean
  onToggleVisualHeatmap: () => void
  activePageFormat: PageFormat
  customPageDimensions?: CustomPageDimensions
  onPageFormatChange: (format: PageFormat, customDims?: CustomPageDimensions) => void
  onCustomPageDimensionsChange?: (dims: CustomPageDimensions) => void
  onOpenFullscreenGallery?: () => void
}

// Miniaturas em SVG com esqueleto arquitetônico dos layouts
const LayoutSkeletonPreview: React.FC<{ layoutId: string }> = ({ layoutId }) => {
  switch (layoutId) {
    case 'sidebar':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="4" y="4" width="30" height="62" rx="2" fill="#1e293b" />
          <circle cx="19" cy="14" r="5" fill="#38bdf8" opacity="0.6" />
          <rect x="8" y="24" width="22" height="3" rx="1.5" fill="#64748b" />
          <rect x="8" y="30" width="16" height="2" rx="1" fill="#475569" />
          <rect x="8" y="35" width="20" height="2" rx="1" fill="#475569" />
          <rect x="38" y="6" width="40" height="5" rx="2" fill="#38bdf8" />
          <rect x="38" y="14" width="56" height="2" rx="1" fill="#64748b" />
          <rect x="38" y="22" width="56" height="12" rx="2" fill="#1e293b" />
          <rect x="38" y="38" width="56" height="12" rx="2" fill="#1e293b" />
          <rect x="38" y="54" width="56" height="10" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'linear':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="25" y="6" width="50" height="5" rx="2" fill="#38bdf8" />
          <rect x="20" y="14" width="60" height="2" rx="1" fill="#64748b" />
          <line x1="8" y1="20" x2="92" y2="20" stroke="#334155" strokeWidth="1" />
          <rect x="8" y="24" width="84" height="12" rx="2" fill="#1e293b" />
          <rect x="8" y="39" width="84" height="12" rx="2" fill="#1e293b" />
          <rect x="8" y="54" width="84" height="10" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'compact_split':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="88" height="10" rx="2" fill="#1e293b" />
          <rect x="6" y="20" width="42" height="44" rx="2" fill="#1e293b" />
          <rect x="52" y="20" width="42" height="44" rx="2" fill="#1e293b" />
        </svg>
      )
    case 'canvas_livre':
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="46" height="18" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="56" y="6" width="38" height="28" rx="2" fill="#1e293b" />
          <rect x="6" y="28" width="46" height="36" rx="2" fill="#1e293b" />
          <rect x="56" y="38" width="38" height="26" rx="2" fill="#1e293b" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      )
    default:
      // Modular / Executivo padrão
      return (
        <svg viewBox="0 0 100 70" width="100%" height="100%" fill="none">
          <rect width="100" height="70" rx="4" fill="#0f172a" />
          <rect x="6" y="6" width="88" height="14" rx="2" fill="#1e293b" />
          <circle cx="15" cy="13" r="4" fill="#38bdf8" opacity="0.7" />
          <rect x="23" y="10" width="40" height="3" rx="1.5" fill="#38bdf8" />
          <rect x="23" y="14" width="25" height="2" rx="1" fill="#64748b" />
          <rect x="6" y="24" width="56" height="20" rx="2" fill="#1e293b" />
          <rect x="66" y="24" width="28" height="20" rx="2" fill="#1e293b" />
          <rect x="6" y="48" width="88" height="16" rx="2" fill="#1e293b" />
        </svg>
      )
  }
}

const FONT_PRESETS = [
  { id: 'tech_modern', label: 'Tech & Modern', heading: 'Plus Jakarta Sans', body: 'Inter' },
  { id: 'executive_editorial', label: 'Executive Luxury', heading: 'Cinzel', body: 'Roboto' },
  { id: 'hacker_engineering', label: 'Hacker Terminal', heading: 'Courier Prime', body: 'Courier Prime' },
  { id: 'creative_design', label: 'Creative & Product', heading: 'Poppins', body: 'Plus Jakarta Sans' },
  { id: 'humanist_academic', label: 'Humanist & Academic', heading: 'Lora', body: 'Open Sans' },
  { id: 'classic_editorial', label: 'Classic Editorial', heading: 'Merriweather', body: 'Inter' },
]

const COLOR_PRESETS = [
  { name: 'IBM Blue Executive', primary: '#0284c7', secondary: '#0369a1', accent: '#f97316' },
  { name: 'Emerald Matrix', primary: '#059669', secondary: '#047857', accent: '#10b981' },
  { name: 'Cyber Violet', primary: '#7c3aed', secondary: '#6d28d9', accent: '#ec4899' },
  { name: 'Obsidian Gold', primary: '#b45309', secondary: '#92400e', accent: '#f59e0b' },
  { name: 'Slate Minimal', primary: '#334155', secondary: '#475569', accent: '#64748b' },
]

export const RightInspectorDrawer: React.FC<RightInspectorDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  activeLayout,
  onLayoutChange,
  designConfig,
  onChangeDesignConfig,
  cvData,
  jdText,
  onJdTextChange,
  isVisualHeatmapActive,
  onToggleVisualHeatmap,
  activePageFormat,
  customPageDimensions,
  onPageFormatChange,
  onCustomPageDimensionsChange,
  onOpenFullscreenGallery
}) => {
  if (!isOpen) return null

  const atsReport = calculateAtsReport(cvData, jdText)
  const scoreColor = atsReport.overallScore >= 80 ? '#22c55e' : atsReport.overallScore >= 60 ? '#eab308' : '#ef4444'

  return (
    <aside className="cv-pro-inspector" aria-label="Inspetor de Propriedades">
      {/* Cabeçalho do Inspetor */}
      <div className="cv-pro-inspector__header">
        <div className="cv-pro-inspector__title">
          <SlidersIcon size={16} />
          <span>Inspetor de Propriedades</span>
        </div>
        <button
          className="cv-pro-btn"
          onClick={onClose}
          style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
          title="Fechar Inspetor (Esc)"
        >
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Navegação por Abas do Inspetor */}
      <div className="cv-pro-inspector__tabs">
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'templates' ? 'is-active' : ''}`}
          onClick={() => onTabChange('templates')}
        >
          <LayoutIcon size={14} />
          <span>Modelos</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'design' ? 'is-active' : ''}`}
          onClick={() => onTabChange('design')}
        >
          <PaletteIcon size={14} />
          <span>Estilo</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'ats' ? 'is-active' : ''}`}
          onClick={() => onTabChange('ats')}
        >
          <TargetIcon size={14} />
          <span>ATS ({atsReport.overallScore}%)</span>
        </button>
        <button
          className={`cv-pro-inspector__tab ${activeTab === 'format' ? 'is-active' : ''}`}
          onClick={() => onTabChange('format')}
        >
          <FileTextIcon size={14} />
          <span>Papel</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico por Aba */}
      <div className="cv-pro-inspector__content">
        {/* ── ABA 1: MODELOS & TEMPLATES ── */}
        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                10 Modelos A4 Declarativos
              </span>
              {onOpenFullscreenGallery && (
                <button
                  type="button"
                  className="cv-pro-btn"
                  onClick={onOpenFullscreenGallery}
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                >
                  Tela Cheia
                </button>
              )}
            </div>

            <div className="cv-pro-template-grid">
              {LAYOUT_OPTIONS.map((layout) => {
                const isSelected = activeLayout === layout.id
                return (
                  <div
                    key={layout.id}
                    className={`cv-pro-template-card ${isSelected ? 'is-active' : ''}`}
                    onClick={() => onLayoutChange(layout.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div style={{ width: '100%', height: '70px', borderRadius: '4px', overflow: 'hidden' }}>
                      <LayoutSkeletonPreview layoutId={layout.id} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="cv-pro-template-card__name">{layout.name}</span>
                        {isSelected && <CheckIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />}
                      </div>
                      <div className="cv-pro-template-card__desc">
                        {layout.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ABA 2: DESIGN & ESTILO ── */}
        {activeTab === 'design' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Família de Fontes */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.4rem' }}>
                Combinação Tipográfica Executiva
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {FONT_PRESETS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    className="cv-pro-btn"
                    onClick={() => {
                      onChangeDesignConfig({
                        ...designConfig,
                        fontHeading: font.heading,
                        fontBody: font.body
                      })
                    }}
                    style={{
                      justifyContent: 'flex-start',
                      background: designConfig.fontHeading === font.heading ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                      borderColor: designConfig.fontHeading === font.heading ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{font.label}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 'auto' }}>
                      {font.heading} / {font.body}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Escala de Fontes (slider) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
                  Escala de Texto
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--cv-pro-sky)', fontWeight: 700 }}>
                  {Math.round((designConfig.fontScale || 1.0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.25"
                step="0.02"
                value={designConfig.fontScale || 1.0}
                onChange={(e) => {
                  onChangeDesignConfig({
                    ...designConfig,
                    fontScale: parseFloat(e.target.value)
                  })
                }}
                style={{ width: '100%', accentColor: '#38bdf8' }}
              />
            </div>

            {/* Paletas de Cores Executivas */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.4rem' }}>
                Paletas Cromáticas
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    className="cv-pro-btn"
                    onClick={() => {
                      onChangeDesignConfig({
                        ...designConfig,
                        colorPrimary: color.primary,
                        colorSecondary: color.secondary,
                        colorAccent: color.accent
                      })
                    }}
                    style={{
                      justifyContent: 'space-between',
                      background: designConfig.colorPrimary === color.primary ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                      borderColor: designConfig.colorPrimary === color.primary ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)'
                    }}
                  >
                    <span>{color.name}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: color.primary }} />
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: color.secondary }} />
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: color.accent }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 3: AUDITORIA ATS ── */}
        {activeTab === 'ats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#0f172a', borderRadius: '8px', border: '1px solid var(--cv-pro-border)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor }}>
                {atsReport.overallScore}%
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                  Score de Aderência ATS
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {atsReport.overallScore >= 80 ? 'Excelente alinhamento para triagem' : 'Requer inclusão de termos-chave da vaga'}
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.35rem' }}>
                Descrição da Vaga Alvo (Job Description):
              </label>
              <textarea
                value={jdText}
                onChange={(e) => onJdTextChange(e.target.value)}
                placeholder="Cole o texto da vaga aqui para comparar palavras-chave em tempo real..."
                style={{
                  width: '100%',
                  height: '110px',
                  background: '#070a12',
                  border: '1px solid var(--cv-pro-border)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  fontSize: '0.76rem',
                  padding: '0.5rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="button"
              className={`cv-pro-btn ${isVisualHeatmapActive ? 'cv-pro-btn--hero' : ''}`}
              onClick={onToggleVisualHeatmap}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <TargetIcon size={14} />
              <span>{isVisualHeatmapActive ? 'Desativar Heatmap na Folha' : 'Ativar Heatmap Visual na Folha'}</span>
            </button>

            {atsReport.keywordAnalysis.missingKeywords.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5' }}>
                  Palavras-chave ausentes ({atsReport.keywordAnalysis.missingKeywords.length}):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {atsReport.keywordAnalysis.missingKeywords.slice(0, 12).map((kw) => (
                    <span
                      key={kw}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5'
                      }}
                    >
                      +{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA 4: FORMATO & GEOMETRIA DO PAPEL ── */}
        {activeTab === 'format' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
              Padrões Físicos de Impressão
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.values(PAGE_FORMATS).map((pf) => {
                const isSelected = activePageFormat === pf.id
                return (
                  <button
                    key={pf.id}
                    type="button"
                    className="cv-pro-btn"
                    onClick={() => onPageFormatChange(pf.id)}
                    style={{
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                      borderColor: isSelected ? 'var(--cv-pro-sky)' : 'rgba(51, 65, 85, 0.4)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, textAlign: 'left' }}>{pf.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'left' }}>
                        {pf.widthMm} × {pf.heightMm} mm
                      </div>
                    </div>
                    {isSelected && <CheckIcon size={14} style={{ color: 'var(--cv-pro-sky)' }} />}
                  </button>
                )
              })}
            </div>

            {activePageFormat === 'custom' && customPageDimensions && onCustomPageDimensionsChange && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Largura (mm)</label>
                  <input
                    type="number"
                    value={customPageDimensions.widthMm}
                    onChange={(e) => onCustomPageDimensionsChange({
                      ...customPageDimensions,
                      widthMm: Number(e.target.value) || 210
                    })}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: '4px',
                      color: '#f8fafc',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Altura (mm)</label>
                  <input
                    type="number"
                    value={customPageDimensions.heightMm}
                    onChange={(e) => onCustomPageDimensionsChange({
                      ...customPageDimensions,
                      heightMm: Number(e.target.value) || 297
                    })}
                    style={{
                      width: '100%',
                      background: '#090d16',
                      border: '1px solid rgba(51, 65, 85, 0.4)',
                      borderRadius: '4px',
                      color: '#f8fafc',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

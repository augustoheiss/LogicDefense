import React, { useState, useRef, useEffect } from 'react'
import type { TextVariant, ThemeVariant, LayoutVariant, ViewMode } from '../../types/cv'
import { LAYOUT_OPTIONS } from '../../types/cv'

interface CVToolbarProps {
  isFreeCanvasActive?: boolean
  onToggleFreeCanvas?: () => void
  onResetStructure?: () => void
  activePersona: TextVariant
  onPersonaChange: (p: TextVariant) => void
  activeLayout: LayoutVariant
  onLayoutChange: (l: LayoutVariant) => void
  activeTheme?: ThemeVariant
  onThemeChange?: (t: ThemeVariant) => void
  activeViewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
  onOpenCoverLetterModal?: () => void
  hasCoverLetter?: boolean
  onDownloadYaml: () => void
  onDownloadHtml?: () => void
  onDownloadCoverLetterHtml?: () => void
  onDownloadZip?: () => void
  onPrintPdf: () => void
  onOpenDesignModal?: () => void
  onOpenApiKeyModal: () => void
  hasActiveKey: boolean
  isPro?: boolean
  tokenBalance?: number
  onOpenStoreModal?: () => void
}

const PERSONAS: { id: TextVariant; label: string; icon: string; desc: string }[] = [
  { id: 'professional', label: 'Executivo IBM', icon: '💼', desc: 'Foco em governança, KPIs e impacto corporativo' },
  { id: 'architect',    label: 'AI Architect', icon: '🧠', desc: 'Foco em engenharia, algoritmos e arquitetura' },
  { id: 'historian',    label: 'Biógrafo',     icon: '📜', desc: 'Narrativa cronológica detalhada e marcos' },
  { id: 'didactic',     label: 'Didático',     icon: '🎓', desc: 'Clareza pedagógica, liderança e mentoria' },
  { id: 'alien',        label: 'Observador',   icon: '🤖', desc: 'Visão sistêmica, lógica matemática e síntese' },
]


const VIEW_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'cv',           label: 'Currículo A4',         icon: '📄' },
  { id: 'cover_letter', label: 'Cover Letter',         icon: '✉️' },
  { id: 'both',         label: 'Dossiê (2 Páginas)',   icon: '📑' },
]

export const CVToolbar: React.FC<CVToolbarProps> = ({
  isFreeCanvasActive = false,
  onToggleFreeCanvas,
  onResetStructure,
  activePersona,
  onPersonaChange,
  activeLayout,
  onLayoutChange,
  activeTheme: _activeTheme,
  onThemeChange: _onThemeChange,
  activeViewMode,
  onViewModeChange,
  onOpenCoverLetterModal,
  hasCoverLetter: _hasCoverLetter = false,
  onDownloadYaml,
  onDownloadZip,
  onPrintPdf,
  onOpenDesignModal,
  onOpenApiKeyModal,
  hasActiveKey,
  isPro = false,
  tokenBalance = 0,
  onOpenStoreModal,
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Fecha qualquer dropdown ao clicar fora da toolbar
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name))
  }

  const closeDropdowns = () => setOpenDropdown(null)

  const formattedBalance = tokenBalance >= 1000000
    ? `${(tokenBalance / 1000000).toFixed(1)}M`
    : tokenBalance >= 1000
    ? `${(tokenBalance / 1000).toFixed(0)}k`
    : tokenBalance.toString()

  const currentPersonaObj = PERSONAS.find(p => p.id === activePersona) || PERSONAS[0]
  const currentLayoutObj = LAYOUT_OPTIONS.find(l => l.id === activeLayout) || LAYOUT_OPTIONS[0]
  const currentViewModeObj = VIEW_MODES.find(v => v.id === activeViewMode) || VIEW_MODES[0]

  return (
    <div className="cv-preview-toolbar cv-no-print" ref={toolbarRef}>
      {/* LINHA 1: Menus de Seleção & Configuração Declarativa */}
      <div className="cv-toolbar-row">
        {/* 1. Botão Canvas Livre Universal (Ativa manipulação livre no layout atual) */}
        <div className="cv-toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            className={`cv-btn-canvas-toggle ${isFreeCanvasActive ? 'is-active' : ''}`}
            onClick={onToggleFreeCanvas}
            title={isFreeCanvasActive ? 'Desativar Canvas Livre (Travar layout estrutural)' : 'Ativar Canvas Livre (Destravar redimensionamento livre de blocos e colunas)'}
          >
            <span>{isFreeCanvasActive ? '🔓' : '🔒'}</span>
            <span>{isFreeCanvasActive ? 'Canvas Livre: Ativo' : 'Destravar Estrutura (Canvas)'}</span>
          </button>

          {isFreeCanvasActive && onResetStructure && (
            <button
              type="button"
              className="cv-btn-canvas-reset"
              onClick={onResetStructure}
              title="Restaurar proporções e dimensões padrão deste modelo"
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#fca5a5',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ↺ Resetar
            </button>
          )}
        </div>

        {/* 2. Menu Modelo A4 (Modelos 01 a 09) */}
        <div className="cv-toolbar-group">
          <span className="cv-toolbar-label">Modelo A4:</span>
          <div className={`cv-dropdown-wrapper ${openDropdown === 'layout' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cv-dropdown-trigger"
              onClick={() => toggleDropdown('layout')}
              title={`Modelo Atual: ${currentLayoutObj.label}`}
            >
              <span className="cv-dropdown-trigger__icon">{currentLayoutObj.icon}</span>
              <span className="cv-dropdown-trigger__text">{currentLayoutObj.name}</span>
              <span className="cv-dropdown-trigger__chevron">▼</span>
            </button>

            {openDropdown === 'layout' && (
              <div className="cv-dropdown-menu" style={{ minWidth: '280px', maxHeight: '380px', overflowY: 'auto' }}>
                {LAYOUT_OPTIONS.map(l => {
                  const isSelected = activeLayout === l.id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className={`cv-dropdown-item ${isSelected ? 'cv-dropdown-item--active' : ''}`}
                      onClick={() => {
                        onLayoutChange(l.id)
                        closeDropdowns()
                      }}
                    >
                      <div className="cv-dropdown-item__content">
                        <div className="cv-dropdown-item__title">
                          <span>{l.icon}</span> <strong>{l.name}</strong>
                        </div>
                        <div className="cv-dropdown-item__desc">{l.label}</div>
                      </div>
                      {isSelected && <span className="cv-dropdown-item__check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>


        {/* 4. Menu Persona IA */}
        <div className="cv-toolbar-group">
          <span className="cv-toolbar-label">Persona IA:</span>
          <div className={`cv-dropdown-wrapper ${openDropdown === 'persona' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cv-dropdown-trigger"
              onClick={() => toggleDropdown('persona')}
              title={`Persona Ativa: ${currentPersonaObj.label}`}
            >
              <span className="cv-dropdown-trigger__icon">{currentPersonaObj.icon}</span>
              <span className="cv-dropdown-trigger__text">{currentPersonaObj.label}</span>
              <span className="cv-dropdown-trigger__chevron">▼</span>
            </button>

            {openDropdown === 'persona' && (
              <div className="cv-dropdown-menu" style={{ minWidth: '270px' }}>
                {PERSONAS.map(p => {
                  const isSelected = activePersona === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`cv-dropdown-item ${isSelected ? 'cv-dropdown-item--active' : ''}`}
                      onClick={() => {
                        onPersonaChange(p.id)
                        closeDropdowns()
                      }}
                    >
                      <div className="cv-dropdown-item__content">
                        <div className="cv-dropdown-item__title">
                          <span>{p.icon}</span> <strong>{p.label}</strong>
                        </div>
                        <div className="cv-dropdown-item__desc">{p.desc}</div>
                      </div>
                      {isSelected && <span className="cv-dropdown-item__check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 5. Menu Modo de Visualização (Currículo / Carta / Dossiê) */}
        <div className="cv-toolbar-group">
          <span className="cv-toolbar-label">Visualização:</span>
          <div className={`cv-dropdown-wrapper ${openDropdown === 'viewmode' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cv-dropdown-trigger"
              onClick={() => toggleDropdown('viewmode')}
              title={`Visualização: ${currentViewModeObj.label}`}
            >
              <span className="cv-dropdown-trigger__icon">{currentViewModeObj.icon}</span>
              <span className="cv-dropdown-trigger__text">{currentViewModeObj.label}</span>
              <span className="cv-dropdown-trigger__chevron">▼</span>
            </button>

            {openDropdown === 'viewmode' && (
              <div className="cv-dropdown-menu" style={{ minWidth: '220px' }}>
                {VIEW_MODES.map(v => {
                  const isSelected = activeViewMode === v.id
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`cv-dropdown-item ${isSelected ? 'cv-dropdown-item--active' : ''}`}
                      onClick={() => {
                        onViewModeChange(v.id)
                        closeDropdowns()
                      }}
                    >
                      <div className="cv-dropdown-item__title">
                        <span>{v.icon}</span> <strong>{v.label}</strong>
                      </div>
                      {isSelected && <span className="cv-dropdown-item__check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LINHA 2: Ações Rápidas, Design & Estilo e Menu Exportar & PDF */}
      <div className="cv-toolbar-row cv-toolbar-row--actions">
        {/* Design & Estilo Modal (Acessível em ambos os modos: Templates e Canvas Livre) */}
        {onOpenDesignModal && (
          <button
            type="button"
            className="cv-btn-secondary"
            onClick={onOpenDesignModal}
            title="Personalizar fontes, escala tipográfica, paleta de cores e texturas de fundo IA"
            style={{ borderColor: '#f59e0b', color: '#fcd34d', background: 'rgba(245, 158, 11, 0.12)', fontWeight: 700 }}
          >
            🎨 Design & Estilo
          </button>
        )}

        {/* Adaptar Carta de Apresentação com IA */}
        {onOpenCoverLetterModal && (
          <button
            type="button"
            className="cv-btn-secondary"
            onClick={onOpenCoverLetterModal}
            title="Adaptar carta de apresentação sob medida com IA (Pro)"
            style={{ borderColor: '#6366f1', color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.15)', fontWeight: 600 }}
          >
            ✨ Adaptar Carta
          </button>
        )}


        {/* Licença Pro */}
        {onOpenStoreModal && (
          <button
            type="button"
            className="cv-btn-secondary"
            onClick={onOpenStoreModal}
            title={isPro ? `Licença Pro Ativa: ${tokenBalance.toLocaleString()} tokens` : 'Desbloquear IA Pro'}
            style={
              isPro
                ? { borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', fontWeight: 600 }
                : { borderColor: '#818cf8', color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.15)', fontWeight: 600 }
            }
          >
            {isPro ? `💎 Pro (${formattedBalance})` : '💎 Ativar Pro'}
          </button>
        )}

        {/* Hub do Agente de IA, Prompts & API */}
        <button
          type="button"
          className="cv-btn-secondary"
          onClick={onOpenApiKeyModal}
          title="Abrir Hub de Agentes de IA, Prompts Mestre Nível 2, OpenAPI e Chaves de API"
          style={
            hasActiveKey
              ? { borderColor: '#10b981', color: '#34d399', fontWeight: 600 }
              : { borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 600 }
          }
        >
          🤖 {hasActiveKey ? 'Agente & API (Ativo)' : 'Hub Agente & API'}
        </button>

        {/* Menu Unificado: Exportar & PDF */}
        <div className={`cv-dropdown-wrapper ${openDropdown === 'exports' ? 'is-open' : ''}`} style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            className="cv-dropdown-trigger"
            onClick={() => toggleDropdown('exports')}
            title="Exportar em PDF, YAML, HTML Standalone ou Pacote ZIP"
            style={{
              background: '#047857',
              borderColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              padding: '0.42rem 0.85rem',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
            }}
          >
            <span className="cv-dropdown-trigger__icon">📥</span>
            <span className="cv-dropdown-trigger__text">Exportar & PDF</span>
            <span className="cv-dropdown-trigger__chevron" style={{ color: '#ffffff' }}>▼</span>
          </button>

          {openDropdown === 'exports' && (
            <div className="cv-dropdown-menu cv-dropdown-menu--right" style={{ minWidth: '270px' }}>
              {/* Opção Principal: Imprimir / Salvar PDF */}
              <button
                type="button"
                className="cv-dropdown-item"
                onClick={() => {
                  closeDropdowns()
                  onPrintPdf()
                }}
                style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', fontWeight: 700 }}
              >
                <div className="cv-dropdown-item__content">
                  <div className="cv-dropdown-item__title">
                    <span>🖨️</span> <strong>Imprimir / Salvar PDF</strong>
                  </div>
                  <div className="cv-dropdown-item__desc" style={{ color: '#a7f3d0' }}>
                    Exportação nativa A4 (1 ou 2 páginas sem corte)
                  </div>
                </div>
              </button>

              <div className="cv-dropdown-divider" />

              {/* Baixar .yaml */}
              <button
                type="button"
                className="cv-dropdown-item"
                onClick={() => {
                  closeDropdowns()
                  onDownloadYaml()
                }}
              >
                <div className="cv-dropdown-item__content">
                  <div className="cv-dropdown-item__title">
                    <span>⬇️</span> <strong>Baixar .yaml</strong>
                  </div>
                  <div className="cv-dropdown-item__desc">Arquivo fonte estruturado pronto para IA</div>
                </div>
              </button>

              {/* Baixar Pacote de Dados .zip */}
              {onDownloadZip && (
                <button
                  type="button"
                  className="cv-dropdown-item"
                  onClick={() => {
                    closeDropdowns()
                    onDownloadZip()
                  }}
                >
                  <div className="cv-dropdown-item__content">
                    <div className="cv-dropdown-item__title">
                      <span>📦</span> <strong>Baixar Pacote .zip</strong>
                    </div>
                    <div className="cv-dropdown-item__desc">Dados estruturados prontos para IA (.yaml + carta + guia)</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


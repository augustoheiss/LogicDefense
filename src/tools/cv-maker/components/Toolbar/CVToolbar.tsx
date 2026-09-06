import React, { useState, useRef, useEffect } from 'react'
import type { TextVariant, ThemeVariant, LayoutVariant, ViewMode, PageFormat, ZoomMode } from '../../types/cv'
import { LAYOUT_OPTIONS } from '../../types/cv'
import { PAGE_FORMATS } from '../../engine/PageFormatEngine'

interface CVToolbarProps {
  isFreeCanvasActive?: boolean
  onToggleFreeCanvas?: () => void
  onResetStructure?: () => void
  onAutoPackBlocks?: () => void
  activePersona: TextVariant
  onPersonaChange: (p: TextVariant) => void
  activeLayout: LayoutVariant
  onLayoutChange: (l: LayoutVariant) => void
  activeTheme?: ThemeVariant
  onThemeChange?: (t: ThemeVariant) => void
  activeViewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
  activePageFormat?: PageFormat
  onPageFormatChange?: (format: PageFormat) => void
  activeZoomMode?: ZoomMode
  onZoomModeChange?: (zoom: ZoomMode | number) => void
  currentScale?: number
  onOpenCoverLetterModal?: () => void
  hasCoverLetter?: boolean
  onDownloadYaml: () => void
  onDownloadZip?: () => void
  onPrintPdf: () => void
  onAutoFitSinglePage?: () => void
  onOpenDesignModal?: () => void
  onOpenApiKeyModal: () => void
  hasActiveKey: boolean
  isPro?: boolean
  tokenBalance?: number
  onOpenStoreModal?: () => void
  onOpenTemplateGallery?: () => void
  onOpenAcademy?: () => void
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
  onAutoPackBlocks,
  activePersona,
  onPersonaChange,
  activeLayout,
  onLayoutChange,
  activeTheme: _activeTheme,
  onThemeChange: _onThemeChange,
  activeViewMode,
  onViewModeChange,
  activePageFormat = 'a4',
  onPageFormatChange,
  activeZoomMode = 'auto',
  onZoomModeChange,
  currentScale = 1.0,
  onOpenCoverLetterModal,
  hasCoverLetter: _hasCoverLetter = false,
  onDownloadYaml,
  onDownloadZip,
  onPrintPdf,
  onAutoFitSinglePage,
  onOpenDesignModal,
  onOpenApiKeyModal,
  hasActiveKey,
  isPro = false,
  tokenBalance = 0,
  onOpenStoreModal,
  onOpenTemplateGallery,
  onOpenAcademy,
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
  const currentPageFormatObj = PAGE_FORMATS[activePageFormat] || PAGE_FORMATS.a4

  const handleZoomIn = () => {
    const nextScale = Math.min(1.5, Math.round(((currentScale || 1.0) + 0.1) * 10) / 10)
    onZoomModeChange?.(nextScale)
  }

  const handleZoomOut = () => {
    const nextScale = Math.max(0.4, Math.round(((currentScale || 1.0) - 0.1) * 10) / 10)
    onZoomModeChange?.(nextScale)
  }

  return (
    <div className="cv-preview-toolbar cv-no-print" ref={toolbarRef}>
      {/* LINHA 1: Menus de Seleção & Configuração Declarativa */}
      <div className="cv-toolbar-row">
        {/* 1. Botão Canvas Livre Universal */}
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
                border: '1px solid rgba(248, 113, 113, 0.4)',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ↩ Reset
            </button>
          )}

          {isFreeCanvasActive && onAutoPackBlocks && (
            <button
              type="button"
              className="cv-btn-canvas-autopack"
              onClick={onAutoPackBlocks}
              title="Auto-organizar blocos sem sobreposição no espaço disponível"
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#7dd3fc',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              📦 Empacotar
            </button>
          )}
        </div>

        {/* 2. Menu Layouts & Modelos */}
        <div className="cv-toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="cv-toolbar-label">Modelo:</span>
          <div className={`cv-dropdown-wrapper ${openDropdown === 'layout' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cv-dropdown-trigger"
              onClick={() => toggleDropdown('layout')}
              title={`Modelo Ativo: ${currentLayoutObj.name}`}
            >
              <span className="cv-dropdown-trigger__icon">{currentLayoutObj.icon}</span>
              <span className="cv-dropdown-trigger__text">{currentLayoutObj.name}</span>
              <span className="cv-dropdown-trigger__chevron">▼</span>
            </button>

            {openDropdown === 'layout' && (
              <div className="cv-dropdown-menu" style={{ minWidth: '260px' }}>
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

          {onOpenTemplateGallery && (
            <button
              type="button"
              className="cv-btn-secondary"
              onClick={onOpenTemplateGallery}
              title="Abrir Galeria Visual com 10 Modelos A4"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.78rem',
                borderColor: '#38bdf8',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.1)',
                fontWeight: 600
              }}
            >
              🖼️ Galeria
            </button>
          )}
        </div>

        {/* 3. Menu Persona IA */}
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

        {/* 4. Menu Modo de Visualização (Currículo / Carta / Dossiê) */}
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

        {/* 5. Formato de Folha Física: A4 vs US Letter */}
        <div className="cv-toolbar-group">
          <span className="cv-toolbar-label">Folha:</span>
          <div className={`cv-dropdown-wrapper ${openDropdown === 'pageformat' ? 'is-open' : ''}`}>
            <button
              type="button"
              className="cv-dropdown-trigger"
              onClick={() => toggleDropdown('pageformat')}
              title={`Formato Físico Ativo: ${currentPageFormatObj.label}`}
              style={{ fontWeight: 600 }}
            >
              <span className="cv-dropdown-trigger__icon">{currentPageFormatObj.id === 'letter' ? '🇺🇸' : '📄'}</span>
              <span className="cv-dropdown-trigger__text">{currentPageFormatObj.name}</span>
              <span className="cv-dropdown-trigger__chevron">▼</span>
            </button>

            {openDropdown === 'pageformat' && (
              <div className="cv-dropdown-menu" style={{ minWidth: '220px' }}>
                {Object.values(PAGE_FORMATS).map(pf => {
                  const isSelected = activePageFormat === pf.id
                  return (
                    <button
                      key={pf.id}
                      type="button"
                      className={`cv-dropdown-item ${isSelected ? 'cv-dropdown-item--active' : ''}`}
                      onClick={() => {
                        onPageFormatChange?.(pf.id)
                        closeDropdowns()
                      }}
                    >
                      <div className="cv-dropdown-item__content">
                        <div className="cv-dropdown-item__title">
                          <span>{pf.id === 'letter' ? '🇺🇸' : '📄'}</span> <strong>{pf.name}</strong>
                        </div>
                        <div className="cv-dropdown-item__desc">{pf.widthMm} × {pf.heightMm} mm</div>
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
        {/* Design & Estilo Modal */}
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

        {/* Hub do Agente de IA */}
        <button
          type="button"
          className="cv-btn-secondary"
          onClick={onOpenApiKeyModal}
          title="Abrir Hub de Agentes de IA, Prompts Mestre Nível 2, OpenAPI e Chaves de API na Landing Page"
          style={
            hasActiveKey
              ? { borderColor: '#10b981', color: '#34d399', fontWeight: 600 }
              : { borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', fontWeight: 600 }
          }
        >
          🤖 {hasActiveKey ? 'Agente & API (Ativo)' : 'Hub Agente & API'}
        </button>

        {/* Academia de Bastidores */}
        {onOpenAcademy && (
          <button
            type="button"
            className="cv-btn-secondary"
            onClick={onOpenAcademy}
            title="Abrir Academia de Bastidores de Engenharia e Certificados"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: '#fbbf24',
              background: 'rgba(245, 158, 11, 0.08)',
              fontWeight: 600
            }}
          >
            🎓 Academia & Bastidores
          </button>
        )}

        {/* Controles de Zoom Óptico do Preview */}
        <div
          className="cv-toolbar-group cv-zoom-controls"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'rgba(15, 23, 42, 0.65)',
            padding: '0.15rem 0.35rem',
            borderRadius: '6px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            marginLeft: 'auto'
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, paddingLeft: '0.15rem' }}>Zoom:</span>
          <button
            type="button"
            className="cv-zoom-btn"
            onClick={() => onZoomModeChange?.('auto')}
            title="Ajustar automaticamente à largura livre do monitor (Fit Width)"
            style={{
              padding: '0.22rem 0.45rem',
              fontSize: '0.74rem',
              borderRadius: '4px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: (activeZoomMode === 'auto' || activeZoomMode === 'fit-width') ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
              color: (activeZoomMode === 'auto' || activeZoomMode === 'fit-width') ? '#38bdf8' : '#cbd5e1',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Ajustar
          </button>
          <button
            type="button"
            className="cv-zoom-btn"
            onClick={() => onZoomModeChange?.('100')}
            title="Zoom 100% Real (Dimensão Física 1:1)"
            style={{
              padding: '0.22rem 0.45rem',
              fontSize: '0.74rem',
              borderRadius: '4px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: activeZoomMode === '100' ? 'rgba(56, 189, 248, 0.22)' : 'transparent',
              color: activeZoomMode === '100' ? '#38bdf8' : '#cbd5e1',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            100%
          </button>
          <button
            type="button"
            className="cv-zoom-btn"
            onClick={handleZoomOut}
            title="Diminuir Zoom (-10%)"
            style={{
              padding: '0.22rem 0.4rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'transparent',
              color: '#cbd5e1',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#38bdf8',
              minWidth: '2.5rem',
              textAlign: 'center'
            }}
            title="Fator de escala óptico aplicado"
          >
            {Math.round((currentScale || 1.0) * 100)}%
          </span>
          <button
            type="button"
            className="cv-zoom-btn"
            onClick={handleZoomIn}
            title="Aumentar Zoom (+10%)"
            style={{
              padding: '0.22rem 0.4rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'transparent',
              color: '#cbd5e1',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            +
          </button>
        </div>

        {/* Menu Unificado: Exportar & PDF */}
        <div className={`cv-dropdown-wrapper ${openDropdown === 'exports' ? 'is-open' : ''}`} style={{ marginLeft: '0.4rem' }}>
          <button
            type="button"
            className="cv-dropdown-trigger"
            onClick={() => toggleDropdown('exports')}
            title="Exportar em PDF A4, YAML ou Pacote ZIP"
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
                    Exportação nativa {currentPageFormatObj.name} vetorial (Engine P3 sem corte)
                  </div>
                </div>
              </button>

              {/* Opção 2: Auto-ajustar 1 Página (P3 Real-DOM) */}
              {onAutoFitSinglePage && (
                <button
                  type="button"
                  className="cv-dropdown-item"
                  onClick={() => {
                    closeDropdowns()
                    onAutoFitSinglePage()
                  }}
                  style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', fontWeight: 600 }}
                >
                  <div className="cv-dropdown-item__content">
                    <div className="cv-dropdown-item__title">
                      <span>⚡</span> <strong>Auto-ajustar 1 Página A4</strong>
                    </div>
                    <div className="cv-dropdown-item__desc" style={{ color: '#bae6fd' }}>
                      Bissecção Real-DOM para caber perfeitamente em 1 folha
                    </div>
                  </div>
                </button>
              )}

              {/* Opção 3: Compactar Blocos (Eliminar Vácuos e Espaços Vazios) */}
              {onAutoPackBlocks && (
                <button
                  type="button"
                  className="cv-dropdown-item"
                  onClick={() => {
                    closeDropdowns()
                    onAutoPackBlocks()
                  }}
                  style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontWeight: 600 }}
                >
                  <div className="cv-dropdown-item__content">
                    <div className="cv-dropdown-item__title">
                      <span>⚡</span> <strong>Compactar Blocos (Eliminar Vácuos)</strong>
                    </div>
                    <div className="cv-dropdown-item__desc" style={{ color: '#a7f3d0' }}>
                      Remove alturas e margens forçadas, unindo blocos automaticamente
                    </div>
                  </div>
                </button>
              )}

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


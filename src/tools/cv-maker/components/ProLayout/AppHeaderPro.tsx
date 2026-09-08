import React, { useState, useRef, useEffect } from 'react'
import type { ViewMode } from '../../types/cv'
import {
  FileTextIcon,
  MailIcon,
  LayersIcon,
  SlidersIcon,
  DownloadIcon,
  KeyIcon,
  PrinterIcon,
  CheckIcon,
  CloseIcon,
  ChevronDownIcon,
  RefreshCwIcon,
  TargetIcon
} from '../Icons/ProIcons'
import { CVPrintEngine } from '../../services/CVPrintEngine'

interface AppHeaderProProps {
  documentTitle: string
  onTitleChange?: (title: string) => void
  activeViewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onOpenInspector: (tab?: 'templates' | 'design' | 'ats' | 'format') => void
  isInspectorOpen: boolean
  atsScore?: number
  onOpenApiKeyModal: () => void
  hasActiveKey: boolean
  onDownloadYaml: () => void
  onDownloadZip?: () => void
  onPrintPdf: () => void
  onDownloadDirectPdf: () => void
  isGeneratingPdf: boolean
  pdfProgressStatus?: string
  isSaved?: boolean
  onToggleMobileDrawer?: () => void
  onCancelDirectPdf?: () => void
}

export const AppHeaderPro: React.FC<AppHeaderProProps> = ({
  documentTitle,
  onTitleChange,
  activeViewMode,
  onViewModeChange,
  onOpenInspector,
  isInspectorOpen,
  atsScore,
  onOpenApiKeyModal,
  hasActiveKey,
  onDownloadYaml,
  onDownloadZip,
  onPrintPdf,
  onDownloadDirectPdf,
  isGeneratingPdf,
  pdfProgressStatus = '',
  isSaved = true,
  onToggleMobileDrawer,
  onCancelDirectPdf
}) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <header className="cv-pro-header cv-no-print" aria-label="Navegação Principal">
      {/* ── Lado Esquerdo: Marca & Modos de Visualização ── */}
      <div className="cv-pro-header__left">
        {onToggleMobileDrawer && (
          <button
            className="cv-pro-btn cv-mobile-open-menu-btn"
            onClick={onToggleMobileDrawer}
            title="Abrir Menu Lateral"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            ☰
          </button>
        )}

        <div className="cv-pro-brand">
          <span>CV MAKER</span>
          <span className="cv-pro-brand__badge">PRO</span>
        </div>

        <div className="cv-pro-header__divider" />

        {/* Seletor Triplo de Visualização */}
        <div className="cv-pro-viewmodes">
          <button
            type="button"
            className={`cv-pro-viewmode-btn ${activeViewMode === 'cv' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('cv')}
            title="Visualizar Folha Principal do Currículo"
          >
            <FileTextIcon size={13} />
            <span>Currículo A4</span>
          </button>
          <button
            type="button"
            className={`cv-pro-viewmode-btn ${activeViewMode === 'cover_letter' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('cover_letter')}
            title="Visualizar Carta de Apresentação"
          >
            <MailIcon size={13} />
            <span>Cover Letter</span>
          </button>
          <button
            type="button"
            className={`cv-pro-viewmode-btn ${activeViewMode === 'both' ? 'is-active' : ''}`}
            onClick={() => onViewModeChange('both')}
            title="Visualizar Dossiê Completo (2 Páginas)"
          >
            <LayersIcon size={13} />
            <span>Dossiê (2 Páginas)</span>
          </button>
        </div>
      </div>

      {/* ── Centro: Nome do Documento & Status de Sincronização ── */}
      <div className="cv-pro-header__center">
        <input
          type="text"
          className="cv-pro-doc-title-input"
          value={documentTitle}
          onChange={(e) => onTitleChange?.(e.target.value)}
          placeholder="Nome do Documento"
          title="Clique para renomear este currículo"
          readOnly={!onTitleChange}
        />
        <div className="cv-pro-sync-status">
          <CheckIcon size={13} strokeWidth={2.5} />
          <span>{isSaved ? 'Salvo localmente' : 'Salvando...'}</span>
        </div>
      </div>

      {/* ── Lado Direito: Gatilhos do Inspector & Ação Hero de Exportação ── */}
      <div className="cv-pro-header__right">
        {/* Gatilho Rápido para Auditoria ATS com Badge Numérico */}
        <button
          type="button"
          className="cv-pro-btn"
          onClick={() => onOpenInspector('ats')}
          title="Abrir Auditoria ATS no Inspetor"
          style={{ gap: '0.45rem' }}
        >
          <TargetIcon size={14} style={{ color: atsScore && atsScore >= 80 ? '#4ade80' : '#facc15' }} />
          <span>ATS</span>
          {atsScore !== undefined && (
            <span
              className="cv-pro-badge-count"
              style={{
                color: atsScore >= 80 ? '#4ade80' : '#facc15',
                background: atsScore >= 80 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(250, 204, 21, 0.15)'
              }}
            >
              {atsScore}%
            </span>
          )}
        </button>

        {/* Hub do Agente & API */}
        <button
          type="button"
          className="cv-pro-btn"
          onClick={onOpenApiKeyModal}
          title="Abrir Hub de Prompts de IA, OpenAPI e Chaves BYOK"
        >
          <KeyIcon size={14} style={{ color: hasActiveKey ? '#34d399' : '#94a3b8' }} />
          <span>{hasActiveKey ? 'Agente & API' : 'Hub Agente'}</span>
        </button>

        {/* Botão de Propriedades / Inspetor (Figma Style) */}
        <button
          type="button"
          className={`cv-pro-btn ${isInspectorOpen ? 'cv-pro-btn--active' : ''}`}
          onClick={() => onOpenInspector()}
          title="Abrir ou fechar o painel lateral de propriedades e estilos"
        >
          <SlidersIcon size={14} />
          <span>Inspetor</span>
        </button>

        {/* Menu Dropdown de Exportações Secundárias */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="cv-pro-btn"
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            title="Opções adicionais de exportação"
          >
            <span>Exportar</span>
            <ChevronDownIcon size={13} />
          </button>

          {isExportMenuOpen && (
            <div
              className="cv-dropdown-menu cv-dropdown-menu--right"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: '220px',
                zIndex: 100
              }}
            >
              <button
                type="button"
                className="cv-dropdown-item"
                onClick={() => {
                  setIsExportMenuOpen(false)
                  onPrintPdf()
                }}
              >
                <div className="cv-dropdown-item__content">
                  <div className="cv-dropdown-item__title">
                    <PrinterIcon size={14} />
                    <strong>Diálogo de Impressão</strong>
                  </div>
                  <div className="cv-dropdown-item__desc">Ctrl+P / Diálogo nativo do navegador</div>
                </div>
              </button>

              <button
                type="button"
                className="cv-dropdown-item"
                onClick={() => {
                  setIsExportMenuOpen(false)
                  onDownloadYaml()
                }}
              >
                <div className="cv-dropdown-item__content">
                  <div className="cv-dropdown-item__title">
                    <DownloadIcon size={14} />
                    <strong>Baixar YAML Puro</strong>
                  </div>
                  <div className="cv-dropdown-item__desc">Fonte de verdade estruturada JSON Resume</div>
                </div>
              </button>

              {onDownloadZip && (
                <button
                  type="button"
                  className="cv-dropdown-item"
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    onDownloadZip()
                  }}
                >
                  <div className="cv-dropdown-item__content">
                    <div className="cv-dropdown-item__title">
                      <DownloadIcon size={14} />
                      <strong>Baixar Pacote .zip</strong>
                    </div>
                    <div className="cv-dropdown-item__desc">Pacote HTML estático + dados YAML</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── BOTÃO HERO PRINCIPAL: BAIXAR PDF DIRETO (Playwright Engine) ── */}
        <button
          type="button"
          className="cv-pro-btn cv-pro-btn--hero"
          onClick={onDownloadDirectPdf}
          onMouseEnter={() => CVPrintEngine.prewarmWorkers()}
          title={isGeneratingPdf ? pdfProgressStatus || 'Compilando no Playwright...' : 'Download direto do PDF compilado via Playwright Headless (Ctrl+P)'}
        >
          {isGeneratingPdf ? (
            <>
              <RefreshCwIcon size={14} className="cv-spin-animation" />
              <span>Compilando...</span>
            </>
          ) : (
            <>
              <DownloadIcon size={14} />
              <span>Baixar PDF Direto</span>
            </>
          )}
        </button>

        {isGeneratingPdf && onCancelDirectPdf && (
          <button
            type="button"
            className="cv-pro-btn"
            onClick={onCancelDirectPdf}
            title="Cancelar compilação"
            style={{ padding: '0.35rem 0.6rem', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <CloseIcon size={13} />
            <span style={{ fontSize: '0.72rem' }}>Cancelar</span>
          </button>
        )}
      </div>
    </header>
  )
}

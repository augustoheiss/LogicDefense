import React from 'react'
import type { TextVariant, ThemeVariant, LayoutVariant } from '../../types/cv'
import { LAYOUT_OPTIONS } from '../../types/cv'

interface CVToolbarProps {
  activePersona: TextVariant
  onPersonaChange: (p: TextVariant) => void
  activeLayout: LayoutVariant
  onLayoutChange: (l: LayoutVariant) => void
  activeTheme: ThemeVariant
  onThemeChange: (t: ThemeVariant) => void
  onDownloadYaml: () => void
  onDownloadHtml?: () => void
  onDownloadZip?: () => void
  onPrintPdf: () => void
  onOpenPhotoModal: () => void
  onOpenApiKeyModal: () => void
  hasActiveKey: boolean
  isPro?: boolean
  tokenBalance?: number
  onOpenStoreModal?: () => void
}

const PERSONAS: { id: TextVariant; label: string; icon: string }[] = [
  { id: 'professional', label: 'Executivo IBM', icon: '💼' },
  { id: 'architect',    label: 'AI Architect', icon: '🧠' },
  { id: 'historian',    label: 'Biógrafo',     icon: '📜' },
  { id: 'didactic',     label: 'Didático',     icon: '🎓' },
  { id: 'alien',        label: 'Observador',   icon: '🤖' },
]

const THEMES: { id: ThemeVariant; label: string; icon: string }[] = [
  { id: 'executive',  label: 'Executivo',   icon: '👔' },
  { id: 'creative',   label: 'Criativo',    icon: '🎨' },
  { id: 'minimalist', label: 'Minimalista', icon: '🔹' },
  { id: 'white',      label: 'White',       icon: '📄' },
  { id: 'terminal',   label: 'Terminal',    icon: '>_' },
]

export const CVToolbar: React.FC<CVToolbarProps> = ({
  activePersona,
  onPersonaChange,
  activeLayout,
  onLayoutChange,
  activeTheme,
  onThemeChange,
  onDownloadYaml,
  onDownloadHtml,
  onDownloadZip,
  onPrintPdf,
  onOpenPhotoModal,
  onOpenApiKeyModal,
  hasActiveKey,
  isPro = false,
  tokenBalance = 0,
  onOpenStoreModal,
}) => {
  const formattedBalance = tokenBalance >= 1000000
    ? `${(tokenBalance / 1000000).toFixed(1)}M`
    : tokenBalance >= 1000
    ? `${(tokenBalance / 1000).toFixed(0)}k`
    : tokenBalance.toString()

  return (
    <div className="cv-preview-toolbar cv-no-print">
      {/* Grupo de Personas de IA */}
      <div className="cv-toolbar-group">
        <span className="cv-toolbar-label">Persona IA</span>
        <div className="cv-btn-pill-group">
          {PERSONAS.map(p => (
            <button
              key={p.id}
              className={`cv-btn-pill ${activePersona === p.id ? 'cv-btn-pill--active' : ''}`}
              onClick={() => onPersonaChange(p.id)}
              title={`Ver versão com a persona ${p.label}`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grupo de Modelos de Layout A4 */}
      <div className="cv-toolbar-group">
        <span className="cv-toolbar-label">Modelo A4</span>
        <div className="cv-btn-pill-group">
          {LAYOUT_OPTIONS.map(l => (
            <button
              key={l.id}
              className={`cv-btn-pill ${activeLayout === l.id ? 'cv-btn-pill--active' : ''}`}
              onClick={() => onLayoutChange(l.id)}
              title={`${l.label} — ${l.description}`}
            >
              <span>{l.icon}</span> {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grupo de Temas Visuais / Cores */}
      <div className="cv-toolbar-group">
        <span className="cv-toolbar-label">Tema Visual</span>
        <div className="cv-btn-pill-group">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`cv-btn-pill ${activeTheme === t.id ? 'cv-btn-pill--active' : ''}`}
              onClick={() => onThemeChange(t.id)}
              title={`Aplicar tema visual ${t.label} no PDF`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="cv-toolbar-group">
        {onOpenStoreModal && (
          <button
            className="cv-btn-secondary"
            onClick={onOpenStoreModal}
            title={isPro ? `Licença Pro Ativa: ${tokenBalance.toLocaleString()} tokens` : 'Desbloquear IA Pro e Geração de Arquétipos'}
            style={
              isPro
                ? { borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', fontWeight: 600 }
                : { borderColor: '#818cf8', color: '#c7d2fe', background: 'rgba(99, 102, 241, 0.15)', fontWeight: 600 }
            }
          >
            {isPro ? `💎 Pro (${formattedBalance})` : '💎 Ativar Pro'}
          </button>
        )}

        <button
          className="cv-btn-secondary"
          onClick={onOpenPhotoModal}
          title="Adicionar ou alterar foto de perfil"
        >
          📷 Foto
        </button>

        <button
          className="cv-btn-secondary"
          onClick={onOpenApiKeyModal}
          title="Gerenciar Chave de API para agentes externos"
          style={hasActiveKey ? { borderColor: '#10b981', color: '#34d399' } : {}}
        >
          🔑 {hasActiveKey ? 'Chave API' : 'API Key'}
        </button>

        <button
          className="cv-btn-secondary"
          onClick={onDownloadYaml}
          title="Baixar arquivo estruturado .yaml"
        >
          ⬇ .yaml
        </button>

        {onDownloadHtml && (
          <button
            className="cv-btn-secondary"
            onClick={onDownloadHtml}
            title="Baixar currículo em HTML Standalone (com temas e impressão A4)"
          >
            🌐 .html
          </button>
        )}

        {onDownloadZip && (
          <button
            className="cv-btn-secondary"
            onClick={onDownloadZip}
            title="Baixar pacote completo em ZIP (HTML + YAML)"
          >
            📦 .zip
          </button>
        )}

        <button
          className="cv-btn-primary"
          onClick={onPrintPdf}
          title="Exportar para PDF formatado em A4"
        >
          🖨️ Imprimir PDF
        </button>
      </div>
    </div>
  )
}

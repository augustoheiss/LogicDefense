import React from 'react'
import type { TextVariant, ThemeVariant } from '../../types/cv'

interface CVToolbarProps {
  activePersona: TextVariant
  onPersonaChange: (p: TextVariant) => void
  activeTheme: ThemeVariant
  onThemeChange: (t: ThemeVariant) => void
  onDownloadYaml: () => void
  onPrintPdf: () => void
  onOpenPhotoModal: () => void
  onOpenApiKeyModal: () => void
  hasActiveKey: boolean
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
  activeTheme,
  onThemeChange,
  onDownloadYaml,
  onPrintPdf,
  onOpenPhotoModal,
  onOpenApiKeyModal,
  hasActiveKey,
}) => {
  return (
    <div className="cv-preview-toolbar cv-no-print">
      {/* Grupo de Personas de IA */}
      <div className="cv-toolbar-group">
        <span className="cv-toolbar-label">Persona</span>
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

      {/* Grupo de Temas Visuais */}
      <div className="cv-toolbar-group">
        <span className="cv-toolbar-label">Tema</span>
        <div className="cv-btn-pill-group">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`cv-btn-pill ${activeTheme === t.id ? 'cv-btn-pill--active' : ''}`}
              onClick={() => onThemeChange(t.id)}
              title={`Aplicar tema visual ${t.label}`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="cv-toolbar-group">
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
          🔑 {hasActiveKey ? 'Chave Ativa' : 'API Key'}
        </button>

        <button
          className="cv-btn-secondary"
          onClick={onDownloadYaml}
          title="Baixar arquivo estruturado .yaml"
        >
          ⬇ .yaml
        </button>

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

import React, { useRef } from 'react'
import type { CVHistoryItem } from '../../services/historyService'
import type { TextVariant } from '../../types/cv'
import { exportHistoryAsJSON, importHistoryFromJSON } from '../../services/historyService'
import { downloadCVHtmlFile, downloadCVZipPackage } from '../../services/standaloneHtmlService'

interface CVHistoryTabProps {
  history: CVHistoryItem[]
  onSelectVersion: (item: CVHistoryItem) => void
  onDeleteVersion: (id: string) => void
  onWipeAllLGPD: () => void
  onHistoryUpdated: () => void
  onSaveCurrentVersion: () => void
  activeYaml: string
}

const PERSONA_INFO: Record<TextVariant, { icon: string; label: string; color: string }> = {
  professional: { icon: '💼', label: 'Profissional Executivo', color: '#0284c7' },
  architect: { icon: '🧠', label: 'Arquiteto Técnico', color: '#6366f1' },
  historian: { icon: '📜', label: 'Narrativa & Histórico', color: '#d97706' },
  didactic: { icon: '🎓', label: 'Didático & Educacional', color: '#10b981' },
  alien: { icon: '🤖', label: 'Vanguarda & Inovação', color: '#8b5cf6' },
}

const SOURCE_INFO: Record<CVHistoryItem['source'], { icon: string; label: string }> = {
  ai_generated: { icon: '✨', label: 'IA Gemini' },
  yaml_editor: { icon: '📝', label: 'Editor Manual' },
  file_upload: { icon: '📁', label: 'Arquivo Importado' },
  backup_restore: { icon: '📦', label: 'Restaurado de Backup' },
}

export const CVHistoryTab: React.FC<CVHistoryTabProps> = ({
  history,
  onSelectVersion,
  onDeleteVersion,
  onWipeAllLGPD,
  onHistoryUpdated,
  onSaveCurrentVersion,
  activeYaml,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Download individual YAML from history
  const handleDownloadYaml = (item: CVHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const blob = new Blob([item.yaml], { type: 'text/yaml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `curriculo-${item.name.toLowerCase().replace(/\s+/g, '-')}-${item.persona}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download Standalone HTML file for a specific history item
  const handleDownloadHtml = (item: CVHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    downloadCVHtmlFile({
      yaml: item.yaml,
      name: item.name,
      persona: item.persona,
      theme: item.theme,
    })
  }

  // Download ZIP package (Standalone HTML + YAML) for a specific history item
  const handleDownloadZip = async (item: CVHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    await downloadCVZipPackage({
      yaml: item.yaml,
      name: item.name,
      persona: item.persona,
      theme: item.theme,
    })
  }

  // Export Full History Backup as JSON
  const handleExportBackup = () => {
    if (history.length === 0) {
      alert('Seu histórico está vazio no momento.')
      return
    }
    const jsonStr = exportHistoryAsJSON()
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-curriculos-logicdefense-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import Backup from JSON
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = evt => {
      const content = evt.target?.result as string
      if (!content) return
      const res = importHistoryFromJSON(content)
      if (res.success) {
        alert(`✅ Sucesso! ${res.count} versões foram importadas para o seu histórico local.`)
        onHistoryUpdated()
      } else {
        alert(`❌ Erro ao importar: ${res.error}`)
      }
    }
    reader.readAsText(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="cv-history-container">
      {/* ── Top Header & Stats ── */}
      <div className="cv-history-header">
        <div className="cv-history-header__title-row">
          <div>
            <h4 className="cv-history-header__title">
              📜 Histórico Local-First
            </h4>
            <p className="cv-history-header__subtitle">
              Até 20 versões salvas manualmente por você ou geradas pela IA, guardadas no seu navegador.
            </p>
          </div>
          <span className="cv-history-counter">
            {history.length} / 20
          </span>
        </div>

        {/* ── LGPD / Privacy Banner ── */}
        <div className="cv-history-privacy-banner">
          <span>🔒</span>
          <p>
            <strong>Privacidade & LGPD:</strong> Seus currículos estão gravados apenas localmente neste dispositivo. Nada fica armazenado em nossos servidores.
          </p>
        </div>

        {/* ── Global Toolbar Actions ── */}
        <div className="cv-history-actions-bar">
          <button
            className="cv-history-btn cv-history-btn--primary"
            onClick={onSaveCurrentVersion}
            title="Salva a versão atual do editor no histórico local"
          >
            💾 Salvar Versão Atual
          </button>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              className="cv-history-btn cv-history-btn--secondary"
              onClick={handleExportBackup}
              title="Exportar arquivo JSON com todos os 20 currículos"
            >
              📤 Backup
            </button>
            <button
              className="cv-history-btn cv-history-btn--secondary"
              onClick={() => fileInputRef.current?.click()}
              title="Importar arquivo JSON de backup"
            >
              📥 Importar
            </button>
            <button
              className="cv-history-btn cv-history-btn--danger"
              onClick={onWipeAllLGPD}
              title="Exclui todos os currículos e rascunhos salvos, restaurando o modelo padrão"
            >
              🗑️ Limpar Tudo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>

      {/* ── List of 20 History Cards ── */}
      <div className="cv-history-list">
        {history.length === 0 ? (
          <div className="cv-history-empty">
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</span>
            <h4>Nenhum histórico registrado</h4>
            <p>
              Gere novas versões com a <strong>Assistente IA</strong> ou edite e importe no <strong>Editor YAML</strong> para registrar automaticamente suas versões aqui.
            </p>
          </div>
        ) : (
          history.map((item, index) => {
            const personaInfo = PERSONA_INFO[item.persona] || PERSONA_INFO.professional
            const sourceInfo = SOURCE_INFO[item.source] || SOURCE_INFO.yaml_editor
            const isActive = activeYaml.trim() === item.yaml.trim()

            return (
              <div
                key={item.id}
                className={`cv-history-card ${isActive ? 'cv-history-card--active' : ''}`}
                onClick={() => onSelectVersion(item)}
              >
                <div className="cv-history-card__top">
                  <div className="cv-history-card__info">
                    <div className="cv-history-card__name-row">
                      <span className="cv-history-card__index">#{index + 1}</span>
                      <h5 className="cv-history-card__name">{item.name}</h5>
                      {isActive && <span className="cv-history-pill-active">Ativo Agora</span>}
                    </div>
                    <p className="cv-history-card__label">{item.label}</p>
                  </div>
                  <span className="cv-history-card__date">{item.formattedDate}</span>
                </div>

                <div className="cv-history-card__badges">
                  <span
                    className="cv-history-badge"
                    style={{ borderColor: personaInfo.color, color: personaInfo.color }}
                  >
                    {personaInfo.icon} {personaInfo.label}
                  </span>
                  <span className="cv-history-badge cv-history-badge--source">
                    {sourceInfo.icon} {sourceInfo.label}
                  </span>
                </div>

                <div className="cv-history-card__footer">
                  <button
                    className={`cv-history-card-btn ${isActive ? 'cv-history-card-btn--current' : 'cv-history-card-btn--primary'}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectVersion(item)
                    }}
                  >
                    {isActive ? '✓ Versão Ativa' : '👁️ Ativar / Visualizar'}
                  </button>

                  <div className="cv-history-card__quick-actions">
                    <button
                      className="cv-history-icon-btn"
                      onClick={(e) => handleDownloadYaml(item, e)}
                      title="Baixar arquivo estruturado .yaml"
                    >
                      📄 .yaml
                    </button>
                    <button
                      className="cv-history-icon-btn"
                      onClick={(e) => handleDownloadHtml(item, e)}
                      title="Baixar currículo em HTML Standalone (com temas e impressão A4)"
                    >
                      🌐 .html
                    </button>
                    <button
                      className="cv-history-icon-btn"
                      onClick={(e) => handleDownloadZip(item, e)}
                      title="Baixar pacote ZIP completo (HTML + YAML)"
                    >
                      📦 .zip
                    </button>
                    <button
                      className="cv-history-icon-btn cv-history-icon-btn--delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Deseja remover "${item.name} (${personaInfo.label})" do histórico?`)) {
                          onDeleteVersion(item.id)
                        }
                      }}
                      title="Excluir esta versão do histórico"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

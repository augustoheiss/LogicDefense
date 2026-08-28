import React, { useState } from 'react'
import type { CVVersions } from '../../types/cv'
import { generateCVFromText } from '../../services/cvService'

interface ChatInterfaceProps {
  onCVGenerated: (versions: CVVersions) => void
  hasGeneratedCVs: boolean
  onReset: () => void
  onOpenStoreModal?: () => void
}

const QUICK_SUGGESTIONS = [
  '🎯 Tailor para Senior Architect na IBM',
  '⚡ Quantificar conquistas com Fórmula X-Y-Z',
  '🧠 Focar em watsonx, Cloud Híbrida & AI Governance',
  '📊 Destacar liderança técnica de squads e escala',
]

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onCVGenerated,
  hasGeneratedCVs,
  onReset,
  onOpenStoreModal,
}) => {
  const [inputText, setInputText] = useState<string>('')
  const [jobDescription, setJobDescription] = useState<string>('')
  const [showJobDescField, setShowJobDescField] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLicenseError, setIsLicenseError] = useState<boolean>(false)

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setErrorMsg('Cole o texto do seu currículo ou trajetória antes de gerar.')
      setIsLicenseError(false)
      return
    }

    if (inputText.trim().length < 40) {
      setErrorMsg('O texto fornecido é muito curto. Forneça ao menos seu histórico profissional básico.')
      setIsLicenseError(false)
      return
    }

    // Verificação proativa de Licença Pro no Client-Side
    const hasLicenseKey = Boolean(
      localStorage.getItem('ld_pro_license_key') || localStorage.getItem('am_license_key')
    )
    if (!hasLicenseKey) {
      setErrorMsg('Recurso Pro: É necessária uma Chave de Licença Pro ativa para utilizar o Motor de IA.')
      setIsLicenseError(true)
      if (onOpenStoreModal) {
        onOpenStoreModal()
      }
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setIsLicenseError(false)

    try {
      const versions = await generateCVFromText({
        raw_text: inputText.trim(),
        job_description: jobDescription.trim() || undefined,
      })
      onCVGenerated(versions)
    } catch (err) {
      const msg = (err as Error).message || 'Falha ao processar currículo com a IA.'
      setErrorMsg(msg)
      if (
        msg.toLowerCase().includes('licença') ||
        msg.toLowerCase().includes('tokens') ||
        msg.includes('401') ||
        msg.includes('402')
      ) {
        setIsLicenseError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleApplySuggestion = (suggestion: string) => {
    if (!inputText.includes(suggestion)) {
      setInputText(prev => prev ? `${prev}\n\n[Diretriz Adicional]: ${suggestion}` : `[Diretriz]: ${suggestion}`)
    }
  }

  return (
    <div className="cv-chat-container">
      <div className="cv-chat-card">
        <div className="cv-chat-card__header">
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <div>
            <h4 className="cv-chat-card__title">Assistente de Carreira & IA Pro</h4>
            <p className="cv-chat-card__desc">
              Cole seu currículo bruto, PDF do LinkedIn ou anotações para gerar 5 arquétipos estilizados em paralelo.
            </p>
          </div>
        </div>

        <div className="cv-chat-input-area">
          <textarea
            className="cv-chat-textarea"
            placeholder="Cole aqui seu currículo atual, experiências, projetos e tecnologias..."
            value={inputText}
            onChange={e => {
              setInputText(e.target.value)
              if (errorMsg) setErrorMsg(null)
            }}
            disabled={loading}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="cv-btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => setShowJobDescField(prev => !prev)}
            >
              {showJobDescField ? '− Ocultar Vaga Alvo' : '+ Adicionar Descrição da Vaga (ATS Match)'}
            </button>
            {inputText && (
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                {inputText.length} caracteres
              </span>
            )}
          </div>

          {showJobDescField && (
            <textarea
              className="cv-chat-textarea"
              style={{ minHeight: '80px', borderColor: '#38bdf8' }}
              placeholder="Cole aqui a descrição completa da vaga desejada (requisitos, diferenciais e palavras-chave ATS)..."
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              disabled={loading}
            />
          )}

          {errorMsg && (
            <div className="cv-error-banner" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span>⚠️ {errorMsg}</span>
              {(isLicenseError || !localStorage.getItem('ld_pro_license_key')) && onOpenStoreModal && (
                <button
                  type="button"
                  onClick={onOpenStoreModal}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'linear-gradient(90deg, #38bdf8, #3b82f6)',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  💎 Abrir Planos e Ativar Chave Pro ↗
                </button>
              )}
            </div>
          )}

          <div className="cv-chat-actions">
            {hasGeneratedCVs && (
              <button
                type="button"
                className="cv-btn-secondary"
                onClick={onReset}
                disabled={loading}
              >
                🔄 Recomeçar
              </button>
            )}

            <button
              type="button"
              className="cv-btn-primary"
              style={{ flex: hasGeneratedCVs ? 'none' : 1, justifyContent: 'center' }}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Processando 5 Arquétipos...' : '✨ Gerar 5 Arquétipos com IA (Pro)'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="cv-loading-indicator">
            <div className="cv-spinner" />
            <div>
              <strong>Executando 5 chamadas concorrentes ao Gemini 3.7...</strong>
              <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}>
                Formatando JSON Resume, aplicando métricas X-Y-Z e normalizando YAMLs.
              </div>
            </div>
          </div>
        )}

        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Sugestões Rápidas:
          </span>
          <div className="cv-chat-suggestions">
            {QUICK_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                className="cv-suggestion-chip"
                onClick={() => handleApplySuggestion(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

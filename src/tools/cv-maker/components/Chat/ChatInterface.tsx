import React, { useState } from 'react'
import type { CVVersions } from '../../types/cv'
import { generateCVFromText } from '../../services/cvService'

interface ChatInterfaceProps {
  onCVGenerated: (versions: CVVersions) => void
  hasGeneratedCVs: boolean
  onReset: () => void
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
}) => {
  const [inputText, setInputText] = useState<string>('')
  const [jobDescription, setJobDescription] = useState<string>('')
  const [showJobDescField, setShowJobDescField] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setErrorMsg('Cole o texto do seu currículo ou trajetória antes de gerar.')
      return
    }

    if (inputText.trim().length < 40) {
      setErrorMsg('O texto fornecido é muito curto. Forneça ao menos seu histórico profissional básico.')
      return
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      const versions = await generateCVFromText({
        raw_text: inputText.trim(),
        job_description: jobDescription.trim() || undefined,
      })
      onCVGenerated(versions)
    } catch (err) {
      setErrorMsg((err as Error).message || 'Falha ao processar currículo com a IA.')
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
            <h4 className="cv-chat-card__title">Assistente de Carreira & IA</h4>
            <p className="cv-chat-card__desc">
              Cole seu currículo bruto, PDF do LinkedIn ou anotações para gerar 4 arquétipos estilizados.
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
              style={{ minHeight: '80px', borderColor: '#3b82f6' }}
              placeholder="Cole aqui os requisitos da vaga (ex: Senior Software Architect na IBM) para alfaiataria de palavras-chave..."
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              disabled={loading}
            />
          )}

          {errorMsg && (
            <div className="cv-editor-error">
              {errorMsg}
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
              {loading ? 'Processando 4 Arquétipos...' : '✨ Gerar Currículos com IA'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="cv-loading-indicator">
            <div className="cv-spinner" />
            <div>
              <strong>Executando 4 chamadas concorrentes ao Gemini 2.5...</strong>
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

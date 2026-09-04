import React, { useState } from 'react'
import type { CoverLetter, CVData } from '../../types/cv'

interface GenerateCoverLetterModalProps {
  isOpen: boolean
  onClose: () => void
  cvData: CVData
  onCoverLetterGenerated: (coverLetter: CoverLetter) => void
  onOpenStoreModal?: () => void
}

export const GenerateCoverLetterModal: React.FC<GenerateCoverLetterModalProps> = ({
  isOpen,
  onClose,
  cvData,
  onCoverLetterGenerated,
  onOpenStoreModal
}) => {
  const [jobDescription, setJobDescription] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [tone, setTone] = useState<'professional' | 'enthusiastic' | 'direct'>('professional')
  const [language, setLanguage] = useState<string>('pt')
  const [customLanguage, setCustomLanguage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleGenerate = async () => {
    setLoading(true)
    setErrorMsg(null)

    const effectiveLanguage = language === 'custom' ? (customLanguage.trim() || 'Português') : language

    try {
      const apiKey = localStorage.getItem('ld_pro_license_key') || 
                     localStorage.getItem('am_user_license_key') || 
                     localStorage.getItem('am_license_key') || 
                     localStorage.getItem('ld_universal_api_key')
      const geminiKey = localStorage.getItem('gemini_api_key')

      if (!apiKey && !geminiKey) {
        throw new Error('A adaptação de Carta com IA requer uma Chave de Licença Pro (Turso) ativada ou Chave Gemini própria (BYOK). Ative sua chave Pro para prosseguir.')
      }

      const response = await fetch('/api/v1/cv/generate-cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'X-License-Key': apiKey, 'X-API-Key': apiKey } : {}),
          ...(geminiKey ? { 'X-Gemini-API-Key': geminiKey, 'X-Gemini-Key': geminiKey } : {})
        },
        body: JSON.stringify({
          cv_data: cvData,
          job_description: jobDescription.trim() || undefined,
          target_company: companyName.trim() || undefined,
          recipient_name: recipientName.trim() || undefined,
          tone,
          language: effectiveLanguage
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Falha ao gerar carta de apresentação com IA (${response.status}).`)
      }

      const generatedLetter: CoverLetter = await response.json()
      onCoverLetterGenerated(generatedLetter)
      onClose()
    } catch (err: any) {
      console.warn('Erro na geração da Cover Letter com IA:', err)
      setErrorMsg(err.message || 'Falha ao conectar com o serviço de IA. Verifique sua chave de licença Pro.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '1rem',
        maxWidth: '560px',
        width: '100%',
        padding: '1.5rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.3rem' }}>✨</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Adaptar Carta de Apresentação com IA (Pro)</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.2rem', lineHeight: 1.4 }}>
          A inteligência artificial analisará seu currículo atual e a descrição da vaga para redigir uma carta de apresentação altamente persuasiva em <strong>qualquer idioma</strong>, inserindo-a diretamente no seu YAML sem alterar suas experiências prévias.
        </p>

        {errorMsg && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.82rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
            {onOpenStoreModal && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenStoreModal()
                }}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
              Descrição da Vaga / Requisitos (Job Description):
            </label>
            <textarea
              rows={4}
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Cole os requisitos da vaga aqui para que a IA alinhe suas habilidades com perfeição..."
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.65rem',
                color: '#f8fafc',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
                Empresa Contratante:
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ex: Google / Nubank"
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
                Nome do Recrutador / Gestor:
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                placeholder="Ex: Comitê de Seleção"
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: language === 'custom' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
                Tom de Voz:
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value="professional">💼 Profissional Executivo</option>
                <option value="enthusiastic">🚀 Entusiasta & Inovador</option>
                <option value="direct">🎯 Direto & Objetivo (Impacto)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
                Idioma:
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value="pt">🇧🇷 Português</option>
                <option value="en">🇺🇸 Inglês (English)</option>
                <option value="es">🇪🇸 Espanhol (Español)</option>
                <option value="de">🇩🇪 Alemão (Deutsch)</option>
                <option value="fr">🇫🇷 Francês (Français)</option>
                <option value="it">🇮🇹 Italiano (Italiano)</option>
                <option value="ja">🇯🇵 Japonês (日本語)</option>
                <option value="zh">🇨🇳 Mandarim (中文)</option>
                <option value="custom">🌍 Outro Idioma...</option>
              </select>
            </div>

            {language === 'custom' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#cbd5e1' }}>
                  Qual idioma?
                </label>
                <input
                  type="text"
                  value={customLanguage}
                  onChange={e => setCustomLanguage(e.target.value)}
                  placeholder="Ex: Holandês, Russo, Sueco..."
                  style={{
                    width: '100%',
                    backgroundColor: '#0f172a',
                    border: '1px solid #38bdf8',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.65rem',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1.1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            {loading ? '✨ Adaptando com IA...' : '✨ Adaptar Carta com IA'}
          </button>
        </div>

      </div>
    </div>
  )
}

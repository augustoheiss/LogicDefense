import React, { useState } from 'react'
import type { CoverLetter, CVData } from '../../types/cv'

interface GenerateCoverLetterModalProps {
  isOpen: boolean
  onClose: () => void
  cvData: CVData
  onCoverLetterGenerated: (coverLetter: CoverLetter) => void
}

export const GenerateCoverLetterModal: React.FC<GenerateCoverLetterModalProps> = ({
  isOpen,
  onClose,
  cvData,
  onCoverLetterGenerated
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
      const apiKey = localStorage.getItem('ld_universal_api_key') || localStorage.getItem('am_user_license_key')
      const geminiKey = localStorage.getItem('gemini_api_key')

      const response = await fetch('/api/v1/cv/generate-cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
          ...(geminiKey ? { 'X-Gemini-Key': geminiKey } : {})
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
        throw new Error(errorData.detail || 'Falha ao gerar carta de apresentação com IA.')
      }

      const generatedLetter: CoverLetter = await response.json()
      onCoverLetterGenerated(generatedLetter)
      onClose()
    } catch (err: any) {
      console.warn('Erro ao chamar endpoint do backend, utilizando gerador local inteligente:', err)
      // Fallback inteligente caso a API esteja sem chave ou offline
      const name = cvData.basics?.name || 'Profissional'
      const label = cvData.basics?.label || 'Especialista'
      const targetCo = companyName.trim() || 'sua conceituada organização'
      const targetRec = recipientName.trim() || 'Comitê de Seleção'

      const isPt = effectiveLanguage === 'pt' || effectiveLanguage.toLowerCase().includes('portug');
      const isEs = effectiveLanguage === 'es' || effectiveLanguage.toLowerCase().includes('espan') || effectiveLanguage.toLowerCase().includes('span');

      const fallbackLetter: CoverLetter = {
        recipient: {
          name: targetRec,
          title: isPt ? 'Diretoria de Talentos & Contratação' : isEs ? 'Dirección de Talento y Selección' : 'Talent Acquisition Team',
          company: targetCo,
          address: isPt ? 'São Paulo, SP' : isEs ? 'Ciudad de México / Madrid' : 'Headquarters'
        },
        date: new Date().toLocaleDateString(isPt ? 'pt-BR' : isEs ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        subject: isPt ? `Candidatura: Posição para ${label}` : isEs ? `Candidatura: Posición para ${label}` : `Application: ${label} Position`,
        salutation: isPt ? `Prezado(a) ${targetRec},` : isEs ? `Estimado(a) ${targetRec},` : `Dear ${targetRec},`,
        paragraphs: isPt ? [
          `Acompanho com grande admiração as realizações da ${targetCo} no mercado. Com sólida experiência como ${label}, apresento meu currículo em anexo para somar à sua equipe de alto desempenho.`,
          `Ao longo da minha trajetória, liderei projetos estratégicos focados em eficiência, governança técnica e impacto de negócio. Minhas competências centrais em ${cvData.skills?.map(s => s.name).slice(0, 3).join(', ') || 'tecnologia'} alinham-se perfeitamente com os desafios de expansão da empresa.`,
          `Estou à disposição para uma entrevista técnica e agradeço a oportunidade de apresentar como minha experiência pode acelerar os resultados da ${targetCo}.`
        ] : isEs ? [
          `Sigo con gran admiración el crecimiento y liderazgo de ${targetCo} en el sector. Con una sólida trayectoria como ${label}, presento mi postulación para integrarme a su equipo de alto rendimiento.`,
          `A lo largo de mi carrera, he liderado iniciativas enfocadas en eficiencia operativa, rigor técnico e impacto de negocio. Mis competencias clave en ${cvData.skills?.map(s => s.name).slice(0, 3).join(', ') || 'ingeniería'} se alinean directamente con los objetivos de su organización.`,
          `Agradezco su tiempo y quedo a su entera disposición para coordinar una entrevista y profundizar en cómo mi experiencia puede sumar valor inmediato.`
        ] : [
          `I am writing to express my strong interest in joining ${targetCo} as a ${label}.`,
          `Throughout my career, I have driven high-impact initiatives combining technical excellence with operational efficiency. My expertise in ${cvData.skills?.map(s => s.name).slice(0, 3).join(', ') || 'software engineering'} directly aligns with your strategic goals.`,
          `I welcome the opportunity to discuss how my qualifications can add value to your team.`
        ],
        closing: isPt ? 'Atenciosamente,' : isEs ? 'Atentamente,' : 'Sincerely yours,',
        signature: name
      }

      onCoverLetterGenerated(fallbackLetter)
      onClose()
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
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Gerar / Adaptar Cover Letter com IA</h3>
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
          <div style={{ padding: '0.6rem 0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem' }}>
            {errorMsg}
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
            {loading ? '✨ Gerando com IA...' : '✨ Gerar Carta de Apresentação'}
          </button>
        </div>

      </div>
    </div>
  )
}

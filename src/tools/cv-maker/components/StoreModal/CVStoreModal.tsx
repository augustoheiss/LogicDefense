import React, { useState, useEffect } from 'react'
import { validateLicenseKey, recoverLicenseKey } from '../../services/cvService'

interface CVStoreModalProps {
  isOpen: boolean
  onClose: () => void
  onLicenseActivated?: (key: string, tier: string, tokens: number) => void
}

export const CVStoreModal: React.FC<CVStoreModalProps> = ({
  isOpen,
  onClose,
  onLicenseActivated,
}) => {
  const [activeKey, setActiveKey] = useState<string>(() => {
    return localStorage.getItem('ld_pro_license_key') || localStorage.getItem('am_license_key') || ''
  })
  const [licenseData, setLicenseData] = useState<{
    valid: boolean
    tier: string
    token_balance: number
    token_cap: number
    expires_at?: string | null
  } | null>(null)

  const [inputKey, setInputKey] = useState<string>('')
  const [validating, setValidating] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Recovery state
  const [showRecovery, setShowRecovery] = useState<boolean>(false)
  const [recoveryEmail, setRecoveryEmail] = useState<string>('')
  const [recovering, setRecovering] = useState<boolean>(false)

  // Load and validate existing key on open
  useEffect(() => {
    if (!isOpen) return
    const stored = localStorage.getItem('ld_pro_license_key') || localStorage.getItem('am_license_key')
    if (stored) {
      setActiveKey(stored)
      validateStoredKey(stored)
    } else {
      setLicenseData(null)
    }
  }, [isOpen])

  const validateStoredKey = async (key: string) => {
    setValidating(true)
    try {
      const res = await validateLicenseKey(key)
      if (res.valid) {
        setLicenseData({
          valid: true,
          tier: res.tier || 'pro',
          token_balance: res.token_balance ?? res.tokenBalance ?? 0,
          token_cap: res.token_cap ?? res.tokenCap ?? 1000000,
          expires_at: res.expires_at,
        })
      } else {
        setLicenseData(null)
      }
    } catch {
      // Ignora erro de validação silenciosa
    } finally {
      setValidating(false)
    }
  }

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = inputKey.trim()
    if (!cleanKey) {
      setFeedback({ type: 'error', message: 'Por favor, insira sua chave de licença.' })
      return
    }

    setValidating(true)
    setFeedback(null)

    try {
      const res = await validateLicenseKey(cleanKey)
      if (res.valid) {
        localStorage.setItem('ld_pro_license_key', cleanKey)
        localStorage.setItem('am_license_key', cleanKey) // Unificação com Assistente Moeda
        setActiveKey(cleanKey)
        const bal = res.token_balance ?? res.tokenBalance ?? 0
        const cap = res.token_cap ?? res.tokenCap ?? 1000000
        setLicenseData({
          valid: true,
          tier: res.tier || 'pro',
          token_balance: bal,
          token_cap: cap,
          expires_at: res.expires_at,
        })
        setInputKey('')
        setFeedback({ type: 'success', message: `Licença ${res.tier.toUpperCase()} ativada com sucesso! (${bal.toLocaleString()} tokens)` })
        if (onLicenseActivated) {
          onLicenseActivated(cleanKey, res.tier, bal)
        }
      } else {
        setFeedback({ type: 'error', message: res.message || 'Chave de licença inválida ou expirada.' })
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Erro ao conectar ao servidor.' })
    } finally {
      setValidating(false)
    }
  }

  const handleDeactivate = () => {
    localStorage.removeItem('ld_pro_license_key')
    localStorage.removeItem('am_license_key')
    setActiveKey('')
    setLicenseData(null)
    setFeedback({ type: 'info', message: 'Chave desativada deste navegador.' })
  }

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Insira um e-mail válido.' })
      return
    }

    setRecovering(true)
    setFeedback(null)

    try {
      const res = await recoverLicenseKey(recoveryEmail.trim())
      setFeedback({ type: 'success', message: res.message })
      setShowRecovery(false)
      setRecoveryEmail('')
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message || 'Erro ao recuperar chave.' })
    } finally {
      setRecovering(false)
    }
  }

  if (!isOpen) return null

  // URLs de pagamento (configuráveis via variáveis de ambiente ou com fallback seguro)
  const MONTHLY_CHECKOUT_URL = (import.meta as any).env?.VITE_STRIPE_MONTHLY_URL || ''
  const YEARLY_CHECKOUT_URL = (import.meta as any).env?.VITE_STRIPE_YEARLY_URL || ''
  const RECHARGE_CHECKOUT_URL = (import.meta as any).env?.VITE_STRIPE_TOKENS_URL || ''

  const handleCheckoutClick = (planName: string, directUrl?: string) => {
    if (directUrl && !directUrl.includes('mock-')) {
      window.open(directUrl, '_blank', 'noopener,noreferrer')
      return
    }
    // Redireciona diretamente para suporte/pagamento rápido via WhatsApp/Pix
    const msg = encodeURIComponent(
      `Olá Augusto! Gostaria de adquirir uma Chave de Licença Pro para o CV Maker / Assistente Moeda no Plano ${planName}. Poderia me enviar os detalhes de ativação via Pix/Cartão?`
    )
    window.open(`https://wa.me/5511981355495?text=${msg}`, '_blank', 'noopener,noreferrer')
  }

  const tokenPercent = licenseData && licenseData.token_cap > 0
    ? Math.min(100, Math.max(0, (licenseData.token_balance / licenseData.token_cap) * 100))
    : 0

  return (
    <div className="cv-modal-overlay" onClick={onClose}>
      <div
        className="cv-modal-content"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc' }}>
              💎 CV Maker Pro <span style={{ fontSize: '0.75rem', background: '#38bdf8', color: '#0f172a', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>IA & LICENÇAS</span>
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
              Potencialize sua carreira com 5 arquétipos de IA, alfaiataria ATS sob medida e cotas unificadas.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar Modal"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            background: feedback.type === 'success' ? '#064e3b' : feedback.type === 'error' ? '#7f1d1d' : '#1e293b',
            color: feedback.type === 'success' ? '#a7f3d0' : feedback.type === 'error' ? '#fecaca' : '#94a3b8',
            border: `1px solid ${feedback.type === 'success' ? '#059669' : feedback.type === 'error' ? '#dc2626' : '#334155'}`
          }}>
            {feedback.message}
          </div>
        )}

        {/* ── 1. BLOCO DE ATIVAÇÃO / CÓDIGO PROMO NO TOPO ── */}
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '1.25rem', border: '1px solid #334155', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🔑</span>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              Ativar Chave de Licença ou Código Promocional
            </h4>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            Se você já possui uma chave de compra, código de promoção ou sua chave do Assistente Moeda, cole abaixo para desbloquear a IA instantaneamente:
          </p>

          <form onSubmit={handleActivateKey} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Cole sua chave aqui (ex: am_pro_...)"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              disabled={validating}
              style={{ flex: '1 1 240px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '0.6rem 0.85rem', color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'monospace' }}
            />
            <button
              type="submit"
              disabled={validating || !inputKey.trim()}
              style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: validating || !inputKey.trim() ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
            >
              {validating ? 'Validando...' : 'Ativar Chave'}
            </button>
          </form>

          <div style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowRecovery(prev => !prev)}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.78rem', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              {showRecovery ? 'Ocultar formulário de recuperação' : 'Perdeu sua chave? Recuperar por e-mail'}
            </button>
          </div>

          {/* Recovery Form */}
          {showRecovery && (
            <form onSubmit={handleRecover} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #334155', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Seu e-mail da compra..."
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                disabled={recovering}
                style={{ flex: '1 1 200px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#f8fafc', fontSize: '0.8rem' }}
              />
              <button
                type="submit"
                disabled={recovering || !recoveryEmail}
                style={{ background: '#475569', color: '#f8fafc', border: 'none', borderRadius: '8px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {recovering ? 'Enviando...' : 'Enviar para meu E-mail'}
              </button>
            </form>
          )}
        </div>

        {/* ── 2. CARD DE LICENÇA ATIVA (SE LOGADO) ── */}
        {licenseData && licenseData.valid && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(99, 102, 241, 0.12))',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '1.2rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>✨</span>
                <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>Plano {licenseData.tier.toUpperCase()} Ativo</strong>
              </div>
              <button
                onClick={handleDeactivate}
                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '6px', cursor: 'pointer' }}
              >
                Desconectar Chave
              </button>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                <span>Saldo de Tokens de IA:</span>
                <strong style={{ color: '#38bdf8' }}>{licenseData.token_balance.toLocaleString()} / {licenseData.token_cap.toLocaleString()}</strong>
              </div>
              <div style={{ height: '8px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${tokenPercent}%`, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span>Chave: <code>{activeKey.slice(0, 10)}...{activeKey.slice(-6)}</code></span>
              {licenseData.expires_at && <span>Expira em: {new Date(licenseData.expires_at).toLocaleDateString()}</span>}
            </div>
          </div>
        )}

        {/* ── 3. PLANOS DE AQUISIÇÃO / ASSINATURA ── */}
        <div style={{ marginBottom: '0.5rem' }}>
          <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ou Escolha um Plano de IA para Começar:
          </h4>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Card Mensal */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mensal</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>R$ 20<span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>/mês</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0', fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>✓ <strong>1.000.000</strong> tokens/mês</li>
                <li>✓ 5 Arquétipos com Gemini 3.7</li>
                <li>✓ Alfaiataria ATS Automática</li>
                <li>✓ Compartilhado com Assistente Moeda</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckoutClick('Mensal (R$ 20/mês)', MONTHLY_CHECKOUT_URL)}
              style={{ display: 'block', width: '100%', textAlign: 'center', background: '#3b82f6', color: '#ffffff', border: 'none', padding: '0.55rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.75rem', cursor: 'pointer' }}
            >
              Assinar Mensal ↗
            </button>
          </div>

          {/* Card Anual */}
          <div style={{ background: 'linear-gradient(180deg, #1e293b, #0f172a)', border: '2px solid #38bdf8', borderRadius: '12px', padding: '1.1rem', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#38bdf8', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
              50% OFF • MELHOR VALOR
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Anual</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>R$ 120<span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>/ano</span></div>
              <div style={{ fontSize: '0.72rem', color: '#34d399', marginBottom: '0.5rem' }}>Equivalente a apenas R$ 10/mês</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0', fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>✓ <strong>12.000.000</strong> tokens no ano</li>
                <li>✓ Prioridade na fila do Gemini 3.7</li>
                <li>✓ Todas as Personas Liberadas</li>
                <li>✓ Licença Universal Pro</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckoutClick('Anual Pro (R$ 120/ano)', YEARLY_CHECKOUT_URL)}
              style={{ display: 'block', width: '100%', textAlign: 'center', background: 'linear-gradient(90deg, #38bdf8, #2563eb)', color: '#ffffff', border: 'none', padding: '0.55rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, marginTop: '0.75rem', cursor: 'pointer' }}
            >
              Garantir Anual Pro ↗
            </button>
          </div>

          {/* Card Recarga */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recarga Avulsa</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>R$ 9,90</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0', fontSize: '0.78rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>✓ <strong>100.000</strong> tokens adicionais</li>
                <li>✓ Não expira</li>
                <li>✓ Acumula com seu saldo</li>
                <li>✓ Sem mensalidade</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckoutClick('Recarga 100k (R$ 9,90)', RECHARGE_CHECKOUT_URL)}
              style={{ display: 'block', width: '100%', textAlign: 'center', background: '#7c3aed', color: '#ffffff', border: 'none', padding: '0.55rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, marginTop: '0.75rem', cursor: 'pointer' }}
            >
              Comprar 100k ↗
            </button>
          </div>
        </div>

        {/* Free Tier Reminder Banner */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
          💡 <strong>Camada 100% Gratuita e Local:</strong> A edição manual, importação de YAML/JSON, preview dos 5 modelos e impressão em PDF continuam 100% gratuitos e ilimitados. A chave Pro é necessária apenas para a IA interna de geração concorrente e ATS match.
        </div>
      </div>
    </div>
  )
}


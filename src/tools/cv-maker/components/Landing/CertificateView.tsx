import React, { useState } from 'react'

interface CertificateViewProps {
  onBackToAcademy?: () => void
  onReturnToEditor?: () => void
}

export const CertificateView: React.FC<CertificateViewProps> = ({
  onBackToAcademy,
  onReturnToEditor
}) => {
  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem('ld_cert_student_name') || 'Engenheiro de Software & Prompt Architect'
  })
  const [isEditing, setIsEditing] = useState<boolean>(false)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStudentName(val)
    localStorage.setItem('ld_cert_student_name', val)
  }

  const currentDateFormatted = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <div className="cv-certificate-wrapper">
      {/* Barra de Ações & Configuração */}
      <div className="cv-certificate-actions cv-no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {isEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                Nome no Certificado:
              </label>
              <input
                type="text"
                value={studentName}
                onChange={handleNameChange}
                placeholder="Seu Nome Completo"
                style={{
                  background: '#020617',
                  border: '1px solid #38bdf8',
                  color: '#f8fafc',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  minWidth: '280px'
                }}
              />
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Salvar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                Nome: <strong style={{ color: '#38bdf8' }}>{studentName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  background: 'rgba(51, 65, 85, 0.5)',
                  color: '#cbd5e1',
                  border: '1px solid #475569',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                ✏️ Alterar Nome
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.25rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}
          >
            🖨️ Imprimir / Salvar PDF
          </button>

          {onBackToAcademy && (
            <button
              type="button"
              onClick={onBackToAcademy}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                padding: '0.55rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              📚 Ver Aulas
            </button>
          )}

          {onReturnToEditor && (
            <button
              type="button"
              onClick={onReturnToEditor}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.55rem 1rem',
                borderRadius: '9999px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ⬅️ Ir ao Editor
            </button>
          )}
        </div>
      </div>

      {/* Diploma Impresso / Visual */}
      <div className="cv-certificate-frame">
        <div className="cv-cert-ornament" />

        <div className="cv-cert-logo-badge">🏛️ 🎓 ⚡</div>

        <h1 className="cv-cert-main-title">Certificado de Conclusão</h1>
        <p className="cv-cert-subtitle">
          ACADEMIA DE ARQUITETURA & ENGENHARIA DE DOCUMENTOS A4
        </p>

        <p className="cv-cert-awarded-to">Certificamos solenemente que</p>

        <div className="cv-cert-student-name">{studentName}</div>

        <p className="cv-cert-statement">
          concluiu com êxito todos os módulos da trilha intensiva de{' '}
          <strong>Engenharia de Documentos A4, Compilação Vetorial Skia em Headless Chromium, Orçamento Matemático de Altura por Bisseção</strong> e{' '}
          <strong>Orquestração Multi-Agente com Síntese Magna de Currículos</strong> no ecossistema{' '}
          <strong>LogicDefense / HeissLab</strong>, demonstrando proficiência no uso de agentes de IA avançados e padrões de Zero Fabricação documental.
        </p>

        <div className="cv-cert-footer-grid">
          <div className="cv-cert-signature-box">
            <div className="cv-cert-signature-line" />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              Augusto Heiss
            </span>
            <span className="cv-cert-signer-title">
              Arquiteto Líder • HeissLab & LogicDefense
            </span>
          </div>

          <div className="cv-cert-gold-seal">
            <span>HEISSLAB</span>
            <span style={{ fontSize: '1.2rem', margin: '2px 0' }}>★</span>
            <span>VERIFIED</span>
          </div>

          <div className="cv-cert-signature-box">
            <div className="cv-cert-signature-line" />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
              {currentDateFormatted}
            </span>
            <span className="cv-cert-signer-title">
              Data de Expedição • Local-First
            </span>
          </div>
        </div>

        {/* Nota de Governança & LGPD */}
        <div
          style={{
            marginTop: '2.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.7rem',
            color: '#64748b',
            lineHeight: 1.4
          }}
        >
          <strong>Aviso de Conformidade LGPD & Governança por Design:</strong> Este certificado é um documento de capacitação técnica informal e aberta (Open-Source / HeissLab). Todos os dados preenchidos permanecem estritamente na memória e no armazenamento local do seu navegador, com zero transmissão ou coleta por servidores de terceiros.
        </div>
      </div>
    </div>
  )
}

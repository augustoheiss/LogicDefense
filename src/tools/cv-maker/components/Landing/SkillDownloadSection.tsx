import React, { useState } from 'react'
import { SKILLS_CATALOG, SkillItem } from './skillsData'

export const SkillDownloadSection: React.FC = () => {
  const [selectedSkillId, setSelectedSkillId] = useState<string>('pdf-engine-architect')
  const [copied, setCopied] = useState<boolean>(false)

  const currentSkill: SkillItem =
    SKILLS_CATALOG.find(s => s.id === selectedSkillId) || SKILLS_CATALOG[0]

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSkill.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleDownload = () => {
    const blob = new Blob([currentSkill.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = currentSkill.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="cv-skill-container">
      {/* Seletor de Skills Disponíveis */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem'
        }}
      >
        {SKILLS_CATALOG.map(skill => {
          const isSelected = skill.id === currentSkill.id
          return (
            <div
              key={skill.id}
              onClick={() => setSelectedSkillId(skill.id)}
              style={{
                background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'rgba(15, 23, 42, 0.75)',
                border: isSelected ? '2px solid #38bdf8' : '1px solid #1e293b',
                borderRadius: '14px',
                padding: '1.25rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
                boxShadow: isSelected ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{skill.emoji}</span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                      {skill.name}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
                      {skill.filename}
                    </span>
                  </div>
                </div>

                <span
                  style={{
                    background: isSelected ? '#0284c7' : '#1e293b',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px'
                  }}
                >
                  {skill.badge}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                {skill.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Barra de Ações Rápidas da Skill Selecionada */}
      <div className="cv-skill-toolbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>{currentSkill.emoji}</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800 }}>
              Skill Ativa: <code>{currentSkill.filename}</code>
            </h3>
          </div>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Copie o markdown ou baixe o arquivo para integrar em Claude Desktop, Cursor, Antigravity ou outros agentes de IA.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.15rem',
              background: copied ? '#059669' : '#1e293b',
              color: '#f8fafc',
              border: copied ? '1px solid #10b981' : '1px solid #475569',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copied ? '✅ Copiado com Sucesso!' : '📋 Copiar Markdown'}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.25rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            💾 Baixar {currentSkill.filename}
          </button>
        </div>
      </div>

      {/* Como Usar em 3 Passos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>1️⃣ No Claude Desktop</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Salve o arquivo como <code>SKILL.md</code> na pasta de skills do Claude ou anexe nas diretrizes de Projeto para instruir o modelo.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>2️⃣ No Cursor / Windsurf</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Copie o conteúdo e cole dentro de <code>.cursor/rules/{currentSkill.filename}</code> para transformar seu assistente num especialista sênior.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '1.1rem'
          }}
        >
          <div style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>3️⃣ No Antigravity IDE</div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Invoque diretamente no chat com <code>/{currentSkill.id}</code> para acionar a persona com todas as ferramentas e guardrails ativos.
          </p>
        </div>
      </div>

      {/* Visualizador de Código da Skill Selecionada */}
      <div className="cv-skill-code-box">
        {currentSkill.content}
      </div>
    </div>
  )
}

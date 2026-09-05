import React, { useState } from 'react'
import { SKILLS_CATALOG, SkillItem } from './skillsData'

export const SkillDownloadSection: React.FC = () => {
  const [selectedSkillId, setSelectedSkillId] = useState<string>('pdf-engine-architect')
  const [copied, setCopied] = useState<boolean>(false)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)

  const currentSkill: SkillItem =
    SKILLS_CATALOG.find(s => s.id === selectedSkillId) || SKILLS_CATALOG[0]

  const handleCopy = () => {
    navigator.clipboard.writeText(currentSkill.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleCopyRawUrl = () => {
    navigator.clipboard.writeText(currentSkill.rawUrl).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2500)
    })
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
              Skill Canônica: <code>{currentSkill.filename}</code>
            </h3>
          </div>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
            Hospedada oficialmente em <code>src/tools/cv-maker/skills/</code> no GitHub para garantir versionamento contínuo e atualizações em tempo real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href={currentSkill.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.25rem',
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <svg
              height="16"
              width="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ display: 'inline-block' }}
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Ver no GitHub ↗
          </a>

          <button
            type="button"
            onClick={handleCopyRawUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.05rem',
              background: copiedLink ? '#0284c7' : '#1e293b',
              color: '#f8fafc',
              border: copiedLink ? '1px solid #38bdf8' : '1px solid #475569',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copiedLink ? '✅ Link Raw Copiado!' : '🌐 Copiar Link Raw'}
          </button>

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
            {copied ? '✅ Markdown Copiado!' : '📋 Copiar Markdown'}
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
            Clone ou copie de <code>src/tools/cv-maker/skills/{currentSkill.filename}</code> no GitHub para sua pasta de skills ou anexe nas diretrizes de Projeto.
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
            Aponte suas regras de projeto para <code>src/tools/cv-maker/skills/{currentSkill.filename}</code> para manter a persona sincronizada com o GitHub.
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
            Invoque diretamente no chat digitando <code>/{currentSkill.id}</code> para acionar a persona com todas as ferramentas e guardrails ativos.
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

import React, { useState } from 'react'
import { PromptPersonaKey } from '../types'
import { PERSONAS_LIBRARY } from '../data/personasLibrary'

export const PromptsLibraryTab: React.FC = () => {
  const [activePersonaTab, setActivePersonaTab] = useState<PromptPersonaKey>('base')
  const [copied, setCopied] = useState<boolean>(false)

  const currentPersonaData = PERSONAS_LIBRARY[activePersonaTab]

  const getFullPromptText = (): string => {
    if (
      activePersonaTab === 'base' ||
      activePersonaTab === 'cover_letter' ||
      activePersonaTab === 'master_synthesis'
    ) {
      return currentPersonaData.content
    }
    return `/* =========================================================================\n   1. INSTRUÇÃO BASE & REGRAS ENTERPRISE\n   ========================================================================= */\n${PERSONAS_LIBRARY.base.content}\n\n/* =========================================================================\n   2. DIRETRIZES DO ARQUÉTIPO (${currentPersonaData.title.toUpperCase()})\n   ========================================================================= */\n${currentPersonaData.content}`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getFullPromptText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Agency Resume Tailor Official Skill Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.85rem 1.15rem',
          background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span style={{ fontSize: '1.6rem' }}>🎯</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>
                Agency Resume Tailor Skill
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem', background: '#0284c7', color: '#fff', borderRadius: '4px', fontWeight: 600 }}>
                GitHub • Open Source
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.3 }}>
              Skill de engenharia de carreira: fórmula Google/IBM X-Y-Z, ATS alignment e blindagem contra alucinações.
            </p>
          </div>
        </div>
        <a
          href="https://github.com/msitarzewski/agency-agents/blob/main/specialized/resume-tailor.md"
          target="_blank"
          rel="noopener noreferrer"
          className="cv-btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#38bdf8',
            borderColor: '#38bdf8',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            borderRadius: '6px',
            transition: 'all 0.15s ease',
          }}
        >
          <span>Ver Skill no GitHub</span> <span>↗</span>
        </a>
      </div>

      {/* Subtabs das Personas */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          borderBottom: '1px solid #1e293b',
        }}
      >
        {(Object.keys(PERSONAS_LIBRARY) as PromptPersonaKey[]).map((pKey) => {
          const pData = PERSONAS_LIBRARY[pKey]
          const isSelected = activePersonaTab === pKey
          return (
            <button
              key={pKey}
              type="button"
              className={`cv-btn-secondary ${isSelected ? 'cv-sidebar-tab--active' : ''}`}
              style={{
                padding: '0.35rem 0.7rem',
                fontSize: '0.78rem',
                whiteSpace: 'nowrap',
                fontWeight: isSelected ? 700 : 500,
                borderColor: isSelected ? '#38bdf8' : undefined,
                color: isSelected ? '#38bdf8' : undefined,
              }}
              onClick={() => setActivePersonaTab(pKey)}
            >
              <span>{pData.icon}</span> <span>{pData.title.split('.')[0].replace('Instrução ', '')}</span>
            </button>
          )
        })}
      </div>

      {/* Header do Prompt Selecionado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: '#040714',
          padding: '0.85rem 1rem',
          borderRadius: '6px',
          border: '1px solid #1e293b',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>
              {currentPersonaData.icon} {currentPersonaData.title}
            </h4>
            <span
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {currentPersonaData.badge}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            {currentPersonaData.desc}
          </p>
        </div>

        <button
          type="button"
          className="cv-btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', fontWeight: 700 }}
          onClick={handleCopy}
        >
          {copied ? '✅ Copiado!' : '📋 Copiar Prompt Completo'}
        </button>
      </div>

      {/* Codeblock */}
      <pre
        style={{
          background: '#040714',
          padding: '1rem',
          borderRadius: '6px',
          border: '1px solid #1e293b',
          color: '#e2e8f0',
          fontSize: '0.78rem',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          lineHeight: 1.5,
          maxHeight: '360px',
          overflowY: 'auto',
        }}
      >
        {getFullPromptText()}
      </pre>
    </div>
  )
}

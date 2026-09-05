import React, { useState } from 'react'
import { getMasterAgentPromptText } from '../data/agentPromptTemplates'

interface AgentPromptTabProps {
  currentKeyDisplay: string
}

export const AgentPromptTab: React.FC<AgentPromptTabProps> = ({ currentKeyDisplay }) => {
  const [copied, setCopied] = useState<boolean>(false)

  const masterAgentPromptText = getMasterAgentPromptText(currentKeyDisplay)

  const handleCopy = () => {
    navigator.clipboard.writeText(masterAgentPromptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⚡</span>
            <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>
              Prompt Mestre do Agente (Nível 2 Completo)
            </strong>
            <span
              style={{
                background: '#eab308',
                color: '#000000',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              6 VERSÕES OFICIAIS
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Copie com 1 clique e cole no <strong>Cursor</strong>, <strong>Claude Code</strong>,{' '}
            <strong>Antigravity</strong>, <strong>ChatGPT</strong> ou <strong>n8n</strong>. O agente fará todo o
            trabalho de gerar os 5 arquétipos + a 6ª Versão Oficial Master e compilar o Super Dashboard HTML.
          </p>
        </div>

        <button
          type="button"
          className={`cv-btn-primary ${copied ? 'cv-prompts-copy-btn--copied' : ''}`}
          style={{
            background: copied
              ? '#10b981'
              : 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: 800,
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          }}
          onClick={handleCopy}
        >
          {copied ? '✅ Prompt Copiado com Sucesso!' : '📋 Copiar Prompt Mestre para o Agente'}
        </button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
            Conteúdo Exato do Prompt para o seu Agente:
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>100% Agent-Native • Zero Custo de Servidor</span>
        </div>
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
            maxHeight: '380px',
            overflowY: 'auto',
          }}
        >
          {masterAgentPromptText}
        </pre>
      </div>
    </div>
  )
}

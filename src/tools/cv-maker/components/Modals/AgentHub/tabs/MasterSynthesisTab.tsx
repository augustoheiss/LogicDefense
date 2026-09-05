import React, { useState } from 'react'
import { PERSONAS_LIBRARY } from '../data/personasLibrary'

export const MasterSynthesisTab: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false)

  const synthesisContent = PERSONAS_LIBRARY.master_synthesis.content

  const handleCopy = () => {
    navigator.clipboard.writeText(synthesisContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          background: 'rgba(234, 179, 8, 0.08)',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid rgba(234, 179, 8, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: '#fde047', fontSize: '1rem' }}>
              🏆 Nível 2 — Multi-Agent Ensemble & Master Synthesis (Magnum Opus)
            </strong>
            <p style={{ margin: '0.35rem 0 0 0', color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.5 }}>
              Em vez de ter apenas 5 personas especializadas separadas, o <strong>Nível 2</strong> instrui o Agente
              (ou o endpoint <code>/api/v1/cv/synthesize</code>) a analisar os 5 arquétipos em conjunto e extrair as
              frases de maior impacto, métricas quantificadas e palavras-chave de ouro para gerar a{' '}
              <strong>6ª Versão Oficial Definitiva</strong>.
            </p>
          </div>
          <button
            type="button"
            className="cv-btn-secondary"
            style={{
              borderColor: '#eab308',
              color: '#fde047',
              background: 'rgba(234, 179, 8, 0.15)',
              fontWeight: 700,
              fontSize: '0.82rem',
            }}
            onClick={handleCopy}
          >
            {copied ? '✅ Copiado!' : '📋 Copiar Prompt Síntese Master'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
          <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.78rem' }}>💼 Do Executivo IBM:</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>ROI de negócio, governança, KPIs e liderança enterprise.</div>
          </div>
          <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <div style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.78rem' }}>🧠 Do Arquiteto de IA:</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Densidade técnica, RAG, latência, throughput e stack moderno.</div>
          </div>
          <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.78rem' }}>📜 Do Historiador:</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Coerência narrativa, evolução madura e legado de estabilidade.</div>
          </div>
          <div style={{ background: '#020617', padding: '0.6rem', borderRadius: '6px', border: '1px solid #1e293b' }}>
            <div style={{ color: '#34d399', fontWeight: 700, fontSize: '0.78rem' }}>🎓 Do Didático:</div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Decomposição lógica clara e velocidade de aprendizado ágil.</div>
          </div>
        </div>
      </div>

      <div>
        <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
          System Prompt de Síntese Magna (Nível 2):
        </span>
        <pre
          style={{
            background: '#040714',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid #1e293b',
            color: '#fef08a',
            fontSize: '0.78rem',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
            lineHeight: 1.5,
            marginTop: '0.4rem',
          }}
        >
          {synthesisContent}
        </pre>
      </div>
    </div>
  )
}

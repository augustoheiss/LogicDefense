import React, { useState, useMemo } from 'react'
import type { CVData } from '../../types/cv'
import { calculateAtsReport, AtsAuditReport } from '../../engine/AtsEngine'

interface AtsInspectorDrawerProps {
  isOpen: boolean
  onClose: () => void
  cvData: CVData | null
  jdText: string
  onJdTextChange: (text: string) => void
  isVisualHeatmapActive: boolean
  onToggleVisualHeatmap: () => void
}

export const AtsInspectorDrawer: React.FC<AtsInspectorDrawerProps> = ({
  isOpen,
  onClose,
  cvData,
  jdText,
  onJdTextChange,
  isVisualHeatmapActive,
  onToggleVisualHeatmap
}) => {
  const [activeTab, setActiveTab] = useState<'keywords' | 'bullets' | 'structure' | 'export'>('keywords')
  const [copiedNotification, setCopiedNotification] = useState(false)
  const [byokKey, setByokKey] = useState<string>(() => localStorage.getItem('cv_byok_gemini_key') || '')
  const [byokSaved, setByokSaved] = useState(false)

  // Cálculo reativo e instantâneo da auditoria (< 5ms)
  const report: AtsAuditReport = useMemo(() => {
    return calculateAtsReport(cvData, jdText)
  }, [cvData, jdText])

  if (!isOpen) return null

  // Cores de Score
  const scoreColor = report.overallScore >= 80 ? '#22c55e' : report.overallScore >= 60 ? '#eab308' : '#ef4444'

  // Salvar BYOK
  const handleSaveByok = () => {
    localStorage.setItem('cv_byok_gemini_key', byokKey.trim())
    setByokSaved(true)
    setTimeout(() => setByokSaved(false), 2500)
  }

  // Copiar Relatório Estruturado para o Agente do Usuário (Agent-Native)
  const handleCopyAgentPrompt = () => {
    const missingKeywordsList = report.keywordAnalysis.missingKeywords.slice(0, 15).join(', ')
    const weakBullets = report.bulletAnalyses
      .filter(b => b.analysis.status !== 'excellent')
      .map(b => `- [${b.company}] "${b.bullet}" -> Problema: ${b.analysis.feedback}`)
      .join('\n')

    const promptText = `# RELATÓRIO DE AUDITORIA ATS — SOLICITAÇÃO DE REESCRITA CIRÚRGICA

VOCÊ É O RESUME TAILOR & RECRUITMENT ARCHITECT.
Analise os resultados do validador ATS abaixo e reescreva os bullets fracos utilizando estritamente a fórmula Google/IBM X-Y-Z ("Atingiu [X], medido por [Y], fazendo [Z]").

## 1. DADOS DA VAGA ALVO (JOB DESCRIPTION):
${jdText ? jdText.slice(0, 1500) : 'Alinhamento geral para o cargo declarado no currículo.'}

## 2. GAPS DE PALAVRAS-CHAVE IDENTIFICADOS:
${missingKeywordsList || 'Nenhuma palavra-chave crítica ausente.'}

## 3. BULLETS QUE PRECISAM DE FORTALECIMENTO (X-Y-Z):
${weakBullets || 'Todos os bullets possuem estrutura quantificada adequada.'}

## 4. DIRETRIZES RÍGIDAS DE REESCRITA (ANTI-FABRICATION):
1. Jamais invente ferramentas, cargos ou empresas que não constam no histórico.
2. Inicie cada bullet com verbo de ação forte no passado.
3. Adicione métricas plausíveis e quantificadas de resultado (tempo, volumetria, %, escala).
4. Retorne apenas a lista de bullets reescritos prontos para substituição.
`

    navigator.clipboard.writeText(promptText)
    setCopiedNotification(true)
    setTimeout(() => setCopiedNotification(false), 3000)
  }

  const handleLoadSampleJd = () => {
    const sample = `Requisitos para Senior Software Engineer:
- Mais de 5 anos de experiência com React, TypeScript, Node.js e Python.
- Vivência sólida em Cloud Architecture (AWS ou GCP), Docker, Kubernetes e CI/CD pipelines.
- Domínio de bancos de dados relacionais (PostgreSQL) e NoSQL (Redis, MongoDB).
- Prática comprovada em Clean Architecture, Microservices, Testes Automatizados (Jest, Cypress) e TDD.
- Capacidade de liderar equipes ágeis (Scrum), otimizar latência de APIs e monitorar sistemas com Prometheus e Grafana.
- Forte foco em entrega de valor com impacto quantificado e alta disponibilidade de sistemas.`
    onJdTextChange(sample)
  }

  return (
    <div
      className="cv-drawer-overlay cv-no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="cv-ats-drawer"
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '100%',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #1e293b'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#090d16'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.35rem' }}>🎯</span>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Painel de Inteligência ATS
              </h2>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Algoritmo estatístico 0-token (Workday, Taleo & Google X-Y-Z)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.35rem',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px'
            }}
            title="Fechar Painel ATS"
          >
            ✕
          </button>
        </div>

        {/* Score Card Hero Banner */}
        <div
          style={{
            padding: '1.25rem',
            background: 'linear-gradient(180deg, #131d31 0%, #0f172a 100%)',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Circular Score Gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                border: `4px solid ${scoreColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                boxShadow: `0 0 15px ${scoreColor}33`
              }}
            >
              <span style={{ fontSize: '1.35rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                {report.overallScore}%
              </span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '2px' }}>
                Nota {report.grade}
              </span>
            </div>

            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                {report.overallScore >= 80
                  ? 'Altamente Competitivo'
                  : report.overallScore >= 60
                  ? 'Aderência Moderada'
                  : 'Necessita Otimizações'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                {report.keywordAnalysis.allJdKeywords.length > 0
                  ? `${report.keywordAnalysis.matchedKeywords.length} de ${report.keywordAnalysis.allJdKeywords.length} termos da vaga detectados`
                  : `${report.keywordAnalysis.preloadedTechFound.length} tecnologias de mercado identificadas`}
              </div>
            </div>
          </div>

          {/* Toggle Heatmap Visual */}
          <button
            onClick={onToggleVisualHeatmap}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: isVisualHeatmapActive ? 'rgba(34, 197, 94, 0.2)' : '#1e293b',
              color: isVisualHeatmapActive ? '#4ade80' : '#94a3b8',
              border: `1px solid ${isVisualHeatmapActive ? '#22c55e' : '#334155'}`,
              transition: 'all 0.2s ease'
            }}
            title="Alterna exibição dos badges de impacto nos bullets do Canvas"
          >
            <span>{isVisualHeatmapActive ? '👁️ Heatmap Ativo' : '👁️ Ligar Heatmap'}</span>
          </button>
        </div>

        {/* 4 Pillars Mini-Dashboard */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #1e293b'
          }}
        >
          <div style={{ padding: '0.55rem 0.35rem', backgroundColor: '#0f172a', textAlign: 'center' }}>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Keywords (40%)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
              {report.pillars.keywordsScore}%
            </div>
          </div>
          <div style={{ padding: '0.55rem 0.35rem', backgroundColor: '#0f172a', textAlign: 'center' }}>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Impacto (30%)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#facc15' }}>
              {report.pillars.xyzScore}%
            </div>
          </div>
          <div style={{ padding: '0.55rem 0.35rem', backgroundColor: '#0f172a', textAlign: 'center' }}>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Estrutura (15%)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4ade80' }}>
              {report.pillars.structureScore}%
            </div>
          </div>
          <div style={{ padding: '0.55rem 0.35rem', backgroundColor: '#0f172a', textAlign: 'center' }}>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8' }}>Densidade (15%)</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc' }}>
              {report.pillars.densityScore}%
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1e293b',
            backgroundColor: '#090d16'
          }}
        >
          <button
            onClick={() => setActiveTab('keywords')}
            style={{
              flex: 1,
              padding: '0.65rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'keywords' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'keywords' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🎯 Vaga & Keywords
          </button>
          <button
            onClick={() => setActiveTab('bullets')}
            style={{
              flex: 1,
              padding: '0.65rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'bullets' ? '2px solid #facc15' : '2px solid transparent',
              color: activeTab === 'bullets' ? '#facc15' : '#94a3b8',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ⚡ Bullets X-Y-Z
          </button>
          <button
            onClick={() => setActiveTab('structure')}
            style={{
              flex: 1,
              padding: '0.65rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'structure' ? '2px solid #4ade80' : '2px solid transparent',
              color: activeTab === 'structure' ? '#4ade80' : '#94a3b8',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🏛️ Estrutura
          </button>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              flex: 1,
              padding: '0.65rem 0.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'export' ? '2px solid #a855f7' : '2px solid transparent',
              color: activeTab === 'export' ? '#a855f7' : '#94a3b8',
              fontSize: '0.76rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🤖 Agentes / BYOK
          </button>
        </div>

        {/* Tab Body Contents */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {/* ABA 1: KEYWORDS & JOB DESCRIPTION */}
          {activeTab === 'keywords' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                    Descrição da Vaga Alvo (Job Description):
                  </label>
                  <button
                    onClick={handleLoadSampleJd}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Carregar Exemplo Tech
                  </button>
                </div>
                <textarea
                  value={jdText}
                  onChange={(e) => onJdTextChange(e.target.value)}
                  placeholder="Cole aqui a descrição completa da vaga (requisitos, diferenciais e tecnologias) para auditoria de aderência..."
                  rows={5}
                  style={{
                    width: '100%',
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '0.65rem',
                    fontSize: '0.76rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Gaps de Palavras-Chave Faltantes */}
              {report.keywordAnalysis.missingKeywords.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', marginBottom: '0.4rem' }}>
                    ⚠️ Palavras-Chave Relevantes Ausentes no Currículo ({report.keywordAnalysis.missingKeywords.length}):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {report.keywordAnalysis.missingKeywords.slice(0, 20).map((kw, i) => (
                      <span
                        key={i}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 500
                        }}
                      >
                        + {kw}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                    💡 <em>Regra Anti-Fabricação: Adicione apenas competências que você de fato utilizou em projetos reais.</em>
                  </p>
                </div>
              )}

              {/* Palavras-Chave Alinhadas */}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.4rem' }}>
                  ✅ Competências e Termos Alinhados ({report.keywordAnalysis.matchedKeywords.length}):
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {report.keywordAnalysis.matchedKeywords.map((kw, i) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 500
                      }}
                    >
                      ✓ {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: BULLETS X-Y-Z */}
          {activeTab === 'bullets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.4 }}>
                A fórmula canônica do Google/IBM recomenda: <strong>"Atingiu [X], medido pelo resultado numérico [Y], fazendo [Z]"</strong>.
              </div>

              {report.bulletAnalyses.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#1e293b',
                    border: `1px solid ${item.analysis.status === 'excellent' ? '#22c55e44' : item.analysis.status === 'partial' ? '#eab30844' : '#ef444444'}`,
                    borderRadius: '6px',
                    padding: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#38bdf8' }}>
                      {item.company}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.analysis.status === 'excellent' ? 'rgba(34, 197, 94, 0.2)' : item.analysis.status === 'partial' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: item.analysis.status === 'excellent' ? '#4ade80' : item.analysis.status === 'partial' ? '#facc15' : '#f87171'
                      }}
                    >
                      {item.analysis.status === 'excellent' ? '🟢 X-Y-Z Completo' : item.analysis.status === 'partial' ? '🟡 Parcial' : '🔴 Passivo'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.75rem', color: '#f8fafc', margin: '0 0 0.4rem 0', lineHeight: 1.35 }}>
                    "{item.bullet}"
                  </p>

                  <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                    {item.analysis.feedback}
                  </div>

                  {item.analysis.suggestions.length > 0 && (
                    <div style={{ fontSize: '0.66rem', color: '#facc15', marginTop: '0.25rem' }}>
                      👉 {item.analysis.suggestions[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ABA 3: ESTRUTURA E PARSEABILIDADE */}
          {activeTab === 'structure' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
                  Higiene de Contato & Parseabilidade
                </h4>
                {report.structureIssues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                    {report.structureIssues.map((issue, idx) => (
                      <div key={idx} style={{ fontSize: '0.74rem', color: '#f87171', display: 'flex', gap: '0.35rem' }}>
                        <span>❌</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {report.structurePassed.map((passed, idx) => (
                    <div key={idx} style={{ fontSize: '0.74rem', color: '#4ade80', display: 'flex', gap: '0.35rem' }}>
                      <span>✅</span>
                      <span>{passed}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.85rem' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
                  Orçamento de Leitura (Volume A4)
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  • Total de palavras no currículo: <strong>{report.densityStats.totalWords} palavras</strong><br />
                  • Total de bullets cadastrados: <strong>{report.densityStats.totalBullets} tópicos</strong><br />
                  • Páginas estimadas: <strong>~{report.densityStats.pageEstimate} página(s)</strong><br />
                  • Diagnóstico: <em>{report.densityStats.feedback}</em>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: AGENTES EXTERNOS & BYOK */}
          {activeTab === 'export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Opção Agent-Native First */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
                    Agent-Native First (100% Gratuito)
                  </strong>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.85rem 0', lineHeight: 1.4 }}>
                  Exporte o diagnóstico e as lacunas do ATS para que seu modelo preferido (Claude, ChatGPT ou Cursor) reescreva os bullets fracos sem nenhum custo para você no site.
                </p>
                <button
                  onClick={handleCopyAgentPrompt}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    backgroundColor: copiedNotification ? '#15803d' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedNotification ? '✓ Diagnóstico Copiado!' : '📋 Copiar Diagnóstico para Claude / ChatGPT'}
                </button>
              </div>

              {/* Opção BYOK */}
              <div
                style={{
                  backgroundColor: '#1e293b',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔑</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>
                    BYOK (Bring Your Own Key)
                  </strong>
                </div>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 0.65rem 0', lineHeight: 1.4 }}>
                  Insira sua própria chave de API pessoal (ex: chave gratuita do Google Gemini AI Studio). A chave fica estritamente no <code>localStorage</code> do seu navegador. O desenvolvedor nunca acessa ou fatura nada.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="password"
                    value={byokKey}
                    onChange={(e) => setByokKey(e.target.value)}
                    placeholder="AIzaSy... (Chave Gemini Pessoal)"
                    style={{
                      flex: 1,
                      backgroundColor: '#0f172a',
                      color: '#f8fafc',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.75rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSaveByok}
                    style={{
                      padding: '0.5rem 0.85rem',
                      borderRadius: '6px',
                      backgroundColor: byokSaved ? '#15803d' : '#334155',
                      color: '#f8fafc',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {byokSaved ? 'Salva!' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

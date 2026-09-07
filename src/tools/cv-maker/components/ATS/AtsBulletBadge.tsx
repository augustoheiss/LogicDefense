import React, { useState } from 'react'
import { analyzeXYZBullet, XyzAnalysisResult } from '../../engine/AtsEngine'

interface AtsBulletBadgeProps {
  bullet: string
  isActive?: boolean
}

export const AtsBulletBadge: React.FC<AtsBulletBadgeProps> = ({ bullet, isActive = false }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!isActive || !bullet) return null

  const analysis: XyzAnalysisResult = analyzeXYZBullet(bullet)

  // Cores e ícones por status
  const config = {
    excellent: {
      icon: '🟢',
      label: 'X-Y-Z',
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.4)',
      text: '#15803d',
      title: 'Fórmula X-Y-Z Completa: Verbo de Ação + Métrica Quantificada + Contexto'
    },
    partial: {
      icon: '🟡',
      label: analysis.hasMetric ? 'Verbo?' : 'Métrica?',
      bg: 'rgba(234, 179, 8, 0.15)',
      border: 'rgba(234, 179, 8, 0.4)',
      text: '#b45309',
      title: analysis.feedback
    },
    weak: {
      icon: '🔴',
      label: 'Passivo',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.4)',
      text: '#b91c1c',
      title: 'Descrição passiva. Transforme em conquista com números e verbo de ação.'
    }
  }[analysis.status]

  return (
    <span
      className="cv-no-print ats-bullet-indicator"
      data-cv-interactive="true"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        marginLeft: '0.45rem',
        fontSize: '0.66rem',
        fontWeight: 700,
        fontFamily: 'monospace',
        padding: '1px 5px',
        borderRadius: '4px',
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        cursor: 'pointer',
        verticalAlign: 'middle',
        userSelect: 'none',
        lineHeight: 1.2
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowTooltip(!showTooltip)
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={config.title}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>

      {/* Tooltip Interativo Flutuante */}
      {showTooltip && (
        <div
          className="cv-no-print ats-bullet-tooltip"
          style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '240px',
            padding: '0.55rem 0.65rem',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderRadius: '6px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            fontSize: '0.72rem',
            lineHeight: 1.35,
            border: '1px solid #334155',
            pointerEvents: 'none',
            textAlign: 'left'
          }}
        >
          <div style={{ fontWeight: 700, color: analysis.status === 'excellent' ? '#4ade80' : analysis.status === 'partial' ? '#facc15' : '#f87171', marginBottom: '0.2rem' }}>
            {config.icon} Score ATS: {analysis.score}%
          </div>
          <div style={{ color: '#cbd5e1', marginBottom: '0.35rem' }}>
            {analysis.feedback}
          </div>
          {analysis.suggestions.length > 0 && (
            <div style={{ borderTop: '1px solid #334155', paddingTop: '0.3rem', color: '#94a3b8', fontSize: '0.67rem' }}>
              💡 <strong>Dica:</strong> {analysis.suggestions[0]}
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/MathChallengeModal.tsx — MASTER PLAN V6
// Altar do Sábio / Modo de Contas Infinitas (4 Graus: Fácil, Médio, Difícil, Problema)
// Baseado nas 18 apostilas e listas de problemas de src/data/content.ts
// ──────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import {
  MATH_CHALLENGE_TIER_POLICIES,
  MathDifficultyTier,
} from '../domain/infiniteMathEngine'
import { ENGINE_CATALOG } from '../engines/engineContract'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

const TIER_ORDER: MathDifficultyTier[] = [1, 2, 3, 4]

export const MathChallengeModal: React.FC = () => {
  const challenge = useLogicBattleStore((s) => s.activeMathChallenge)
  const scaffoldLevel = useLogicBattleStore((s) => s.activeMathChallengeScaffold)
  const diagnostic = useLogicBattleStore((s) => s.activeMathChallengeDiagnostic)
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const solvedCount = useLogicBattleStore((s) => s.mathChallengesSolvedInRun)
  const switchTier = useLogicBattleStore((s) => s.switchMathChallengeTier)
  const submitChoice = useLogicBattleStore((s) => s.submitMathChallengeChoice)
  const closeModal = useLogicBattleStore((s) => s.closeMathChallengeModal)
  const openCodexForSlug = useLogicBattleStore((s) => s.openCodexForSlug)

  const [showMethodsOverride, setShowMethodsOverride] = useState(false)

  if (!challenge) return null

  const activePolicy = MATH_CHALLENGE_TIER_POLICIES[challenge.tier]
  const engineMeta = ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.ponte_portoes
  const rewardForEngine =
    activePolicy.engineRewardSummary[activeEngineId] ?? activePolicy.titlePt

  return (
    <div
      className="lb-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lb-math-modal-title"
      data-testid="lb-math-challenge-modal"
    >
      <div
        className="lb-modal-card lb-redemption-card"
        style={{
          maxWidth: '640px',
          border: '2px solid rgba(250, 204, 21, 0.55)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.78)',
        }}
      >
        {/* Seletor dos 4 Graus de Dificuldade (Fácil, Médio, Difícil, Problema) */}
        <div
          data-testid="lb-math-tier-selector"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '6px',
            marginBottom: '10px',
          }}
        >
          {TIER_ORDER.map((t) => {
            const pol = MATH_CHALLENGE_TIER_POLICIES[t]
            const isSelected = challenge.tier === t
            return (
              <button
                key={t}
                type="button"
                data-testid={`lb-math-tier-btn-${t}`}
                onClick={() => {
                  setShowMethodsOverride(false)
                  switchTier(t)
                }}
                style={{
                  padding: '7px 6px',
                  borderRadius: '10px',
                  border: isSelected
                    ? '2px solid #facc15'
                    : '1px solid rgba(148, 163, 184, 0.35)',
                  background: isSelected
                    ? 'linear-gradient(135deg, rgba(250,204,21,0.28), rgba(30,41,59,0.95))'
                    : 'rgba(15, 23, 42, 0.78)',
                  color: isSelected ? '#fef08a' : '#cbd5e1',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>
                  {pol.badgePt}
                </span>
                <small style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                  +{pol.coinsBonus}🪙 · ×{pol.armyMultiplier}
                </small>
              </button>
            )
          })}
        </div>

        <div className="lb-modal-badge-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
          <span className="lb-badge-token" data-testid="lb-math-lesson-badge">
            📚 {challenge.lensTitlePt} · Resolvidas: {solvedCount}
          </span>
          <span
            className="lb-badge-reward"
            data-testid="lb-math-reward-preview"
            style={{
              background: 'rgba(22, 101, 52, 0.45)',
              borderColor: '#4ade80',
              color: '#bbf7d0',
            }}
          >
            🎁 {engineMeta.icon} {rewardForEngine}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '4px',
          }}
        >
          <h3 id="lb-math-modal-title" className="lb-modal-title" style={{ margin: 0 }}>
            {activePolicy.icon} {activePolicy.titlePt} — {activePolicy.subtitlePt}
          </h3>
          <button
            type="button"
            data-testid="lb-math-reroll-btn"
            className="lb-btn-ghost"
            onClick={() => {
              setShowMethodsOverride(false)
              switchTier(challenge.tier)
            }}
            style={{ fontSize: '0.75rem', padding: '4px 9px', whiteSpace: 'nowrap' }}
            title="Sortear outra conta inédita deste mesmo grau"
          >
            🎲 Outra Conta
          </button>
        </div>

        {/* Placa da Expressão / Conta */}
        <div
          data-testid="lb-math-challenge-expr"
          style={{
            margin: '8px 0 6px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.45)',
            color: '#7dd3fc',
            fontWeight: 900,
            fontSize: '0.98rem',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          {challenge.expressionBadge}
        </div>

        <p
          className="lb-redemption-question"
          data-testid="lb-math-challenge-question"
          style={{ fontSize: '0.96rem', lineHeight: 1.45, marginBottom: '8px' }}
        >
          {challenge.questionPt}
        </p>

        {/* Andaime Nível 1: Luz-Guia Socrática + Dica de Vida Real */}
        <div className="lb-scaffold-panel lb-scaffold-1" data-testid="lb-math-scaffold-1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>💡 Luz-Guia Socrática:</strong>
            <button
              type="button"
              data-testid="lb-math-toggle-methods-btn"
              onClick={() => setShowMethodsOverride((v) => !v)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(250, 204, 21, 0.5)',
                color: '#fde047',
                borderRadius: '6px',
                fontSize: '0.7rem',
                padding: '2px 7px',
                cursor: 'pointer',
              }}
            >
              {showMethodsOverride ? 'Ocultar 3 Caminhos' : '🧠 Ver 3 Caminhos Mentais'}
            </button>
          </div>
          <p style={{ margin: '4px 0 2px' }}>{challenge.luzGuiaPt}</p>
          <small style={{ color: '#93c5fd', display: 'block', fontSize: '0.74rem' }}>
            🌍 {challenge.realLifeTipPt}
          </small>
        </div>

        {/* Andaime Nível 2: Passo a Passo */}
        {scaffoldLevel >= 2 && (
          <div className="lb-scaffold-panel lb-scaffold-2" data-testid="lb-math-scaffold-2">
            <strong>🧭 Decomposição Passo a Passo (Nível 2):</strong>
            <p>{challenge.stepByStepPt}</p>
          </div>
        )}

        {/* Andaime Nível 3 ou Botão de 3 Caminhos Mentais */}
        {(scaffoldLevel >= 3 || showMethodsOverride) && (
          <div
            className="lb-scaffold-panel lb-scaffold-3"
            data-testid="lb-math-scaffold-3"
            style={{ maxHeight: '150px', overflowY: 'auto' }}
          >
            <strong>🔓 3 Caminhos de Resolução Mental (Apostila Heiss-Lab):</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: '16px', fontSize: '0.78rem' }}>
              {challenge.methods.map((m, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <strong style={{ color: '#fde047' }}>{m.badge}:</strong>{' '}
                  <span>{m.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {diagnostic && (
          <div className="lb-diagnostic-banner" data-testid="lb-math-diagnostic">
            {diagnostic}
          </div>
        )}

        <div className="lb-choices-grid" data-testid="lb-math-choices">
          {challenge.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`lb-math-choice-${c.id}`}
              className="lb-choice-btn"
              onClick={() => submitChoice(c.id)}
            >
              <span className="lb-choice-label">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="lb-modal-footer">
          <button
            type="button"
            className="lb-btn-ghost"
            data-testid="lb-math-open-codex-btn"
            onClick={() => openCodexForSlug(challenge.codexSlug)}
          >
            📖 Abrir Apostila ({challenge.lensTitlePt})
          </button>
          <button
            type="button"
            data-testid="lb-math-close-btn"
            className="lb-btn-secondary"
            onClick={closeModal}
          >
            Voltar à Batalha
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/components/CaptainVirgula.tsx — Mascote SVG Capitã Vírgula
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const CaptainVirgula: React.FC = () => {
  const speech = useLogicBattleStore((s) => s.captainSpeech)

  const badgeColors: Record<typeof speech.mood, string> = {
    excited: '#facc15',
    proud: '#34d399',
    curious: '#38bdf8',
    calm: '#a855f7',
  }

  const accent = badgeColors[speech.mood]

  return (
    <div className="lb-captain-bar" data-testid="lb-captain-virgula">
      <div className="lb-captain-avatar" style={{ borderColor: accent }}>
        <svg
          width="36"
          height="36"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="24" cy="24" r="22" fill="#0f172a" stroke={accent} strokeWidth="2.5" />
          {/* Chapéu Tricorne de Capitã com uma Vírgula Dourada */}
          <path
            d="M8 19L24 9L40 19L35 22H13L8 19Z"
            fill="#1e293b"
            stroke="#facc15"
            strokeWidth="1.8"
          />
          {/* Rosto */}
          <circle cx="24" cy="28" r="10" fill="#fde68a" />
          {/* Olhos expressivos */}
          <circle cx="20.5" cy="26.5" r="1.6" fill="#0f172a" />
          <circle cx="27.5" cy="26.5" r="1.6" fill="#0f172a" />
          {/* Sorriso */}
          <path
            d="M20 31.5C21.5 33.2 26.5 33.2 28 31.5"
            stroke="#0f172a"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Emblema da Vírgula Dourada no chapéu */}
          <path
            d="M25.5 13.5C25.5 15 24 17 22.5 18"
            stroke="#facc15"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="25.2" cy="13.2" r="1.8" fill="#facc15" />
        </svg>
      </div>
      <div className="lb-captain-speech">
        <span className="lb-captain-name">Capitã Vírgula</span>
        <p className="lb-captain-text">{speech.text}</p>
      </div>
    </div>
  )
}

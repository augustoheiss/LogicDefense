// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/RealmMap.tsx — Mapa Vetorial Interativo do Mundo 2
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { BIOMES } from '../config/biomes'
import { REGION_LIST, REGIONS } from '../config/regions'
import { canAttackRegion } from '../domain/economy'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'

export const RealmMap: React.FC = () => {
  const conqueredIds = useLogicBattleStore((s) => s.save.conqueredRegionIds)
  const selectedRegionId = useLogicBattleStore((s) => s.save.selectedRegionId)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const selectRegion = useLogicBattleStore((s) => s.selectRegion)

  return (
    <div className="lb-realm-map-box" data-testid="lb-realm-map">
      <div className="lb-realm-map-header">
        <div>
          <span className="lb-metric-label">MUNDO 2 · ESTRATÉGIA TERRITORIAL</span>
          <h3 className="lb-realm-title">
            🗺️ Atlas das 12 Províncias ({conqueredIds.length}/12 Conquistadas)
          </h3>
        </div>
        <div className="lb-map-legend">
          <span className="lb-legend-dot is-conquered">● Conquistada</span>
          <span className="lb-legend-dot is-available">◎ Fronteira Atacável</span>
          <span className="lb-legend-dot is-locked">🔒 Bloqueada</span>
        </div>
      </div>

      <svg
        viewBox="0 0 800 500"
        className="lb-realm-svg"
        role="img"
        aria-label="Mapa das 12 províncias do Reino Matemático"
      >
        <defs>
          <radialGradient id="lbMapBg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" rx="16" fill="url(#lbMapBg)" />

        {/* Conexões entre regiões vizinhas */}
        {REGION_LIST.map((reg) =>
          reg.neighbors.map((nId) => {
            const nb = REGIONS[nId]
            if (!nb || reg.id > nb.id) return null
            return (
              <line
                key={`edge_${reg.id}_${nb.id}`}
                x1={reg.labelAnchor.x}
                y1={reg.labelAnchor.y}
                x2={nb.labelAnchor.x}
                y2={nb.labelAnchor.y}
                stroke="rgba(148, 163, 184, 0.28)"
                strokeWidth="2"
                strokeDasharray="5 5"
              />
            )
          }),
        )}

        {/* Polígonos e Rótulos das 12 Regiões */}
        {REGION_LIST.map((reg) => {
          const isConquered = conqueredIds.includes(reg.id)
          const isAvailable = canAttackRegion(reg.id, conqueredIds)
          const isSelected = selectedRegionId === reg.id
          const biome = BIOMES[reg.biomeId]

          const fill = isConquered
            ? 'rgba(16, 185, 129, 0.28)'
            : isAvailable
              ? 'rgba(56, 189, 248, 0.2)'
              : 'rgba(30, 41, 59, 0.55)'

          const stroke = isSelected
            ? '#facc15'
            : isConquered
              ? '#10b981'
              : isAvailable
                ? biome.bridgeEdgeColor
                : '#475569'

          return (
            <g
              key={reg.id}
              data-testid={`lb-region-node-${reg.id}`}
              className="lb-region-group"
              onClick={() => selectRegion(reg.id)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={reg.svgPath}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 3.2 : 1.8}
              />
              <circle
                cx={reg.labelAnchor.x}
                cy={reg.labelAnchor.y - 12}
                r={isSelected ? 9 : 7}
                fill={isConquered ? '#10b981' : isAvailable ? '#38bdf8' : '#64748b'}
                stroke="#0f172a"
                strokeWidth="2"
              />
              <text
                x={reg.labelAnchor.x}
                y={reg.labelAnchor.y + 6}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="11"
                fontWeight="700"
              >
                {reg.name}
              </text>
              <text
                x={reg.labelAnchor.x}
                y={reg.labelAnchor.y + 20}
                textAnchor="middle"
                fill={isConquered ? '#6ee7b7' : '#bae6fd'}
                fontSize="10"
                fontWeight="600"
              >
                {isConquered
                  ? `✓ +${formatArmy(reg.tributePerRun, notationMode)}/corrida`
                  : `⚔ Guarnição: ${formatArmy(reg.garrison, notationMode)}`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

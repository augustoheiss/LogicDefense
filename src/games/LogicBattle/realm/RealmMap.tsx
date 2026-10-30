// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/RealmMap.tsx — Mapa Isométrico 3D Full-Screen (Mundo 2)
// Fiel ao conceito: master-plan/conceitos/mundo2_reino_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { REGION_LIST, REGIONS } from '../config/regions'
import { CITADEL_BUILDING_LIST, getUpgradeCost } from '../config/upgrades'
import { canAttackRegion } from '../domain/economy'
import { formatArmy } from '../domain/notation'
import { ENGINE_LIST } from '../engines/engineContract'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { CitadelBuildingId } from '../types'
import { OpenWorldBase3D } from './openworld3d/OpenWorldBase3D'

// Posições isométricas das 5 construções da Cidadela na zona verde-menta (fiel a mundo2_reino_conceito.jpg)
const CITADEL_MAP_SPOTS: Record<
  CitadelBuildingId,
  {
    x: number
    y: number
    pinTone: 'teal' | 'gold'
    shortLabel: string
    pinIcon: string
    pinOffsetY: number
  }
> = {
  quartel: {
    x: 138,
    y: 325,
    pinTone: 'teal',
    shortLabel: 'Quartel',
    pinIcon: '⚔️',
    pinOffsetY: -80,
  },
  observatorio: {
    x: 310,
    y: 292,
    pinTone: 'teal',
    shortLabel: 'Observatório',
    pinIcon: '🔭',
    pinOffsetY: -82,
  },
  forja: {
    x: 348,
    y: 412,
    pinTone: 'teal',
    shortLabel: 'Códice',
    pinIcon: '📖',
    pinOffsetY: -74,
  },
  academia: {
    x: 145,
    y: 492,
    pinTone: 'teal',
    shortLabel: 'Academia',
    pinIcon: '🎓',
    pinOffsetY: -74,
  },
  mina_resto: {
    x: 438,
    y: 495,
    pinTone: 'gold',
    shortLabel: 'Mina',
    pinIcon: '🪙',
    pinOffsetY: -74,
  },
}

// Coordenadas isométricas bem espaçadas: Bastiao da Fronteira na saída da Cidadela e as 11 províncias inimigas no platô terracota
const ISOMETRIC_REGION_ANCHORS: Record<string, { x: number; y: number }> = {
  reg_cidadela_origem: { x: 422, y: 352 },
  reg_ponte_leste: { x: 528, y: 358 },
  reg_vila_balanca: { x: 562, y: 468 },
  reg_forte_esteiras: { x: 545, y: 235 },
  reg_bastião_pedra: { x: 652, y: 418 },
  reg_porto_fiorde: { x: 622, y: 150 },
  reg_glaciar_meio: { x: 658, y: 282 },
  reg_pico_precedencia: { x: 728, y: 112 },
  reg_oasis_decimais: { x: 752, y: 222 },
  reg_dunas_ioio: { x: 838, y: 158 },
  reg_trono_solar: { x: 765, y: 360 },
  reg_cratera_sinais: { x: 842, y: 286 },
}

/**
 * Desenha um pelotão de soldadinhos 3D turquesa estacionados nas estradas da Cidadela
 * com balão branco de contagem ("1,2k", "340"), exatamente como em `mundo2_reino_conceito.jpg`.
 */
function renderGarrisonPlatoon(
  key: string,
  cx: number,
  cy: number,
  label: string,
): React.ReactNode {
  const offsets = [
    [-14, 4],
    [-5, 6],
    [5, 5],
    [14, 3],
    [-10, 12],
    [0, 13],
    [10, 11],
  ]
  return (
    <g key={key} transform={`translate(${cx}, ${cy})`}>
      <ellipse cx="0" cy="12" rx="22" ry="9" fill="rgba(15, 23, 42, 0.22)" />
      {offsets.map(([ox, oy], idx) => (
        <g key={idx} transform={`translate(${ox}, ${oy})`}>
          <rect
            x="-3.8"
            y="-4"
            width="7.6"
            height="8.5"
            rx="3"
            fill="#0d9488"
            stroke="#134e4a"
            strokeWidth="1.1"
          />
          <circle
            cx="0"
            cy="-6.5"
            r="4.2"
            fill="#2dd4bf"
            stroke="#134e4a"
            strokeWidth="1.1"
          />
        </g>
      ))}
      {/* Balão branco com ponta (Speech-Bubble Counter) */}
      <g transform="translate(0, -21)">
        <rect
          x="-22"
          y="-10"
          width="44"
          height="19"
          rx="6"
          fill="#f8fafc"
          stroke="#134e4a"
          strokeWidth="1.6"
        />
        <polygon points="-4,9 4,9 0,14" fill="#f8fafc" stroke="#134e4a" strokeWidth="1.2" />
        <text
          x="0"
          y="3"
          textAnchor="middle"
          fill="#0f172a"
          fontSize="10.5"
          fontWeight="900"
        >
          {label}
        </text>
      </g>
    </g>
  )
}

/**
 * Desenha a arquitetura isométrica 3D detalhada de cada uma das 5 construções da Cidadela
 * fiel a `mundo2_reino_conceito.jpg` (Quartel c/ bandeira, Observatório c/ luneta dourada,
 * Academia, Códice e Mina na rocha com pepitas de ouro).
 */
function renderCitadelBuildingSvg(id: CitadelBuildingId, x: number, y: number): React.ReactNode {
  if (id === 'quartel') {
    return (
      <g key={id} transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="14" rx="38" ry="16" fill="rgba(15, 23, 42, 0.25)" />
        {/* Paredes de pedra creme */}
        <polygon points="-28,6 0,18 28,6 28,-14 0,-2 -28,-14" fill="#e7dcc8" stroke="#1e293b" strokeWidth="1.8" />
        <polygon points="0,18 28,6 28,-14 0,-2" fill="#cbbba0" stroke="#1e293b" strokeWidth="1.8" />
        {/* Porta arqueada de madeira */}
        <path d="M 8,14 L 8,3 A 5,5 0 0,1 18,3 L 18,10 Z" fill="#78350f" stroke="#1e293b" strokeWidth="1.3" />
        {/* Telhado verde-ardósia 3D */}
        <polygon points="-32,-12 0,-28 32,-12 0,1" fill="#4d9078" stroke="#1e293b" strokeWidth="1.8" />
        <polygon points="0,-28 32,-12 0,1" fill="#3b7360" stroke="#1e293b" strokeWidth="1.8" />
        {/* Mastro e Bandeira Real */}
        <line x1="-18" y1="-19" x2="-18" y2="-48" stroke="#451a03" strokeWidth="2.8" />
        <polygon points="-18,-46 2,-41 -18,-35" fill="#52b788" stroke="#1e293b" strokeWidth="1.5" />
      </g>
    )
  }

  if (id === 'observatorio') {
    return (
      <g key={id} transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="14" rx="34" ry="15" fill="rgba(15, 23, 42, 0.26)" />
        {/* Base octogonal de madeira escura */}
        <polygon points="-24,8 0,17 24,8 20,-4 0,3 -20,-4" fill="#78350f" stroke="#1e293b" strokeWidth="1.8" />
        {/* Torre de alvenaria clara */}
        <polygon points="-17,4 0,10 17,4 14,-24 0,-18 -14,-24" fill="#e7dcc8" stroke="#1e293b" strokeWidth="1.8" />
        <polygon points="0,10 17,4 14,-24 0,-18" fill="#c4b396" stroke="#1e293b" strokeWidth="1.8" />
        {/* Plataforma superior de madeira */}
        <ellipse cx="0" cy="-24" rx="18" ry="8" fill="#92400e" stroke="#1e293b" strokeWidth="1.8" />
        {/* Luneta Dourada Gigante apontada para o território inimigo (idêntica a mundo2_reino_conceito.jpg) */}
        <g transform="translate(2, -31) rotate(-18)">
          <polygon points="-16,-4 14,-8 14,6 -16,3" fill="#eab308" stroke="#1e293b" strokeWidth="1.8" />
          <ellipse cx="14" cy="-1" rx="4" ry="7" fill="#fef08a" stroke="#1e293b" strokeWidth="1.6" />
        </g>
      </g>
    )
  }

  if (id === 'mina_resto') {
    return (
      <g key={id} transform={`translate(${x}, ${y})`}>
        <ellipse cx="0" cy="14" rx="40" ry="16" fill="rgba(15, 23, 42, 0.26)" />
        {/* Rocha isométrica da montanha da mina */}
        <polygon points="-32,10 -18,-22 8,-28 34,6 6,18" fill="#8d775f" stroke="#1e293b" strokeWidth="1.8" />
        <polygon points="8,-28 34,6 6,18 -2,-6" fill="#6b5844" stroke="#1e293b" strokeWidth="1.8" />
        {/* Entrada escura do túnel com vigas de madeira */}
        <polygon points="-4,14 -4,-4 14,-8 14,10" fill="#0f172a" stroke="#451a03" strokeWidth="2.5" />
        {/* Telhado de apoio lateral */}
        <polygon points="-30,2 -8,-10 -2,-2 -22,8" fill="#475569" stroke="#1e293b" strokeWidth="1.6" />
        {/* Pepitas de Ouro Brilhantes na boca da mina */}
        <circle cx="-8" cy="12" r="4.5" fill="#facc15" stroke="#713f12" strokeWidth="1.3" />
        <circle cx="15" cy="8" r="5" fill="#fde047" stroke="#713f12" strokeWidth="1.3" />
      </g>
    )
  }

  // Academia & Códice (Salões Reais de Sabedoria com múltiplos telhados verdes e paredes creme)
  return (
    <g key={id} transform={`translate(${x}, ${y})`}>
      <ellipse cx="0" cy="14" rx="38" ry="16" fill="rgba(15, 23, 42, 0.25)" />
      <polygon points="-28,6 0,18 28,6 28,-12 0,0 -28,-12" fill="#e7dcc8" stroke="#1e293b" strokeWidth="1.8" />
      <polygon points="0,18 28,6 28,-12 0,0" fill="#cbbba0" stroke="#1e293b" strokeWidth="1.8" />
      <path d="M 6,14 L 6,3 A 4.5,4.5 0 0,1 15,3 L 15,10 Z" fill="#78350f" stroke="#1e293b" strokeWidth="1.3" />
      <polygon points="-32,-10 0,-27 32,-10 0,3" fill="#4d9078" stroke="#1e293b" strokeWidth="1.8" />
      <polygon points="0,-27 32,-10 0,3" fill="#3b7360" stroke="#1e293b" strokeWidth="1.8" />
    </g>
  )
}

export const RealmMap: React.FC = () => {
  const save = useLogicBattleStore((s) => s.save)
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const conqueredIds = save.conqueredRegionIds
  const selectedRegionId = save.selectedRegionId
  const notationMode = save.settings.notationMode
  const selectRegion = useLogicBattleStore((s) => s.selectRegion)
  const selectEngine = useLogicBattleStore((s) => s.selectEngine)
  const upgradeCitadelBuilding = useLogicBattleStore((s) => s.upgradeCitadelBuilding)
  const setActiveRealmSheet = useLogicBattleStore((s) => s.setActiveRealmSheet)

  const mainReserveLabel = formatArmy(Math.max(340, save.reserveTroops), notationMode)
  const vanguardLabel = formatArmy(Math.max(1200, save.reserveTroops * 10), notationMode)

  return (
    <div className="lb-realm-map-box" data-testid="lb-realm-map">
      <OpenWorldBase3D />
      <svg
        viewBox="0 0 900 620"
        preserveAspectRatio="xMidYMid meet"
        className="lb-realm-svg"
        style={{ position: 'relative', zIndex: 2 }}
        role="img"
        aria-label="Mapa Isométrico do Reino e Cidadela"
      >
        <defs>
          {/* Fundo Diurno Vibrante dividindo o Vale Alpino Esquerdo e o Deserto Terracota Direito */}
          <linearGradient id="lbRealmDayBg" x1="0%" y1="0%" x2="100%" y2="25%">
            <stop offset="0%" stopColor="#357a68" />
            <stop offset="46%" stopColor="#2f6f5e" />
            <stop offset="54%" stopColor="#d96b52" />
            <stop offset="100%" stopColor="#c85a42" />
          </linearGradient>

          {/* Platô Aliado Verde-Menta Luminoso (fiel a mundo2_reino_conceito.jpg) */}
          <linearGradient id="lbGreenZone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#74d3ae" />
            <stop offset="55%" stopColor="#5cc49b" />
            <stop offset="100%" stopColor="#43aa82" />
          </linearGradient>

          {/* Platô Inimigo Terracota / Coral Quente (fiel a mundo2_reino_conceito.jpg) */}
          <linearGradient id="lbRedZone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2846b" />
            <stop offset="55%" stopColor="#e06d53" />
            <stop offset="100%" stopColor="#c9563c" />
          </linearGradient>

          <filter id="lbNeonGreenGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="lbNeonRedGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Terreno Base Diurno */}
        <rect width="900" height="620" fill="url(#lbRealmDayBg)" />

        {/* 2. Cordilheira de Montanhas 3D com Picos Nevados Encaixados no canto superior esquerdo */}
        <g className="lb-map-mountains">
          {/* Montanha Esquerda */}
          <polygon points="-5,212 76,74 162,212" fill="#78879b" />
          <polygon points="76,74 162,212 84,212" fill="#526277" />
          <polygon
            points="76,74 109,130 92,140 76,126 60,138 44,129"
            fill="#f8fafc"
          />

          {/* Montanha Direita */}
          <polygon points="152,208 244,64 336,208" fill="#78879b" />
          <polygon points="244,64 336,208 252,208" fill="#526277" />
          <polygon
            points="244,64 280,120 262,132 244,118 226,130 209,120"
            fill="#f8fafc"
          />

          {/* Montanha Central Principal (Mais Alta) */}
          <polygon points="52,198 148,28 244,198" fill="#8596ab" />
          <polygon points="148,28 244,198 156,198" fill="#5b6b82" />
          <polygon
            points="148,28 188,99 168,112 148,95 128,110 108,99"
            fill="#f8fafc"
          />
        </g>

        {/* Bosques de Pinheiros Cônicos 3D ao pé das montanhas e no canto inferior direito */}
        {[
          [35, 205],
          [68, 215],
          [102, 202],
          [138, 214],
          [175, 204],
          [212, 215],
          [252, 202],
          [288, 194],
          [28, 365],
          [42, 415],
          [25, 455],
          [755, 515],
          [790, 502],
          [825, 518],
          [858, 500],
          [775, 540],
          [815, 545],
          [852, 535],
        ].map(([tx, ty], i) => (
          <g key={`tree_${i}`} transform={`translate(${tx}, ${ty})`}>
            <ellipse cx="0" cy="5" rx="15" ry="6" fill="rgba(15, 23, 42, 0.28)" />
            <polygon points="0,-28 -15,2 15,2" fill="#1b4d3e" />
            <polygon points="0,-28 -15,2 -2,2" fill="#2d6a4f" />
            <polygon points="0,-40 -12,-10 12,-10" fill="#2d6a4f" />
            <polygon points="0,-40 -12,-10 -1,-10" fill="#40916c" />
            <polygon points="0,-50 -8,-24 8,-24" fill="#52b788" />
          </g>
        ))}

        {/* 3. Platô Verde-Menta Aliado (Cidadela) com Borda Neon Verde Vibrante */}
        <path
          d="M 45,275 Q 165,215 325,225 Q 435,245 435,345 Q 445,425 525,465 Q 545,535 425,555 Q 215,570 65,535 Q 20,425 45,275 Z"
          fill="url(#lbGreenZone)"
          stroke="#a7f3d0"
          strokeWidth="6.5"
          filter="url(#lbNeonGreenGlow)"
        />

        {/* 4. Platô Inimigo Terracota / Coral com Borda Neon Vermelha-Dourada */}
        <path
          d="M 445,85 Q 525,15 885,20 L 890,465 Q 725,495 565,505 Q 475,445 455,345 Q 445,235 375,185 Q 345,135 445,85 Z"
          fill="url(#lbRedZone)"
          stroke="#fca5a5"
          strokeWidth="5.5"
          filter="url(#lbNeonRedGlow)"
        />

        {/* Mesas rochosas decorativas no território terracota (como em mundo2_reino_conceito.jpg) */}
        <ellipse cx="515" cy="95" rx="68" ry="30" fill="#b84a39" stroke="#8c2d19" strokeWidth="2" />
        <ellipse cx="835" cy="425" rx="46" ry="22" fill="#b84a39" stroke="#8c2d19" strokeWidth="2" />

        {/* 5. Estradas Orgânicas Cor de Areia conectando Cidadela e Fortalezas Inimigas */}
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Rotas secundárias de areia entre as fortalezas inimigas */}
          {REGION_LIST.map((reg) => {
            const a1 = ISOMETRIC_REGION_ANCHORS[reg.id] ?? reg.labelAnchor
            return reg.neighbors.map((nId) => {
              const nb = REGIONS[nId]
              if (!nb || reg.id > nb.id) return null
              const a2 = ISOMETRIC_REGION_ANCHORS[nb.id] ?? nb.labelAnchor
              const midX = (a1.x + a2.x) * 0.5
              const midY = (a1.y + a2.y) * 0.5 - 8
              const pathD = `M ${a1.x},${a1.y} Q ${midX},${midY} ${a2.x},${a2.y}`
              return (
                <g key={`edge_${reg.id}_${nb.id}`}>
                  <path d={pathD} stroke="#a35139" strokeWidth="11" opacity="0.65" />
                  <path d={pathD} stroke="#d6b88c" strokeWidth="7" opacity="0.72" />
                </g>
              )
            })
          })}

          {/* Borda escura da estrada principal da Cidadela */}
          <path
            d="M 138,332 Q 215,375 265,395 M 310,302 Q 280,350 265,395 M 145,492 Q 210,440 265,395 M 265,395 Q 315,445 438,495 M 265,395 Q 355,365 422,352 Q 475,355 528,358"
            stroke="#9c7e54"
            strokeWidth="18"
          />
          {/* Leito de areia clara da estrada principal */}
          <path
            d="M 138,332 Q 215,375 265,395 M 310,302 Q 280,350 265,395 M 145,492 Q 210,440 265,395 M 265,395 Q 315,445 438,495 M 265,395 Q 355,365 422,352 Q 475,355 528,358"
            stroke="#d6b88c"
            strokeWidth="13"
          />
        </g>

        {/* 6. As 5 Construções Isométricas 3D da Cidadela na Zona Verde */}
        {Object.entries(CITADEL_MAP_SPOTS).map(([id, spot]) =>
          renderCitadelBuildingSvg(id as CitadelBuildingId, spot.x, spot.y - 8),
        )}

        {/* 7. Pelotões de Soldadinhos Turquesa nas Estradas com Balões Brancos (1,2k / 340) */}
        {renderGarrisonPlatoon('platoon_1', 182, 385, vanguardLabel)}
        {renderGarrisonPlatoon('platoon_2', 262, 345, mainReserveLabel)}
        {renderGarrisonPlatoon('platoon_3', 212, 445, mainReserveLabel)}
        {renderGarrisonPlatoon('platoon_4', 318, 472, mainReserveLabel)}

        {/* 8. As 12 Províncias como Castelos Fortificados Isométricos 3D de 4 Torres Ameadas */}
        {REGION_LIST.map((reg) => {
          const isConquered = conqueredIds.includes(reg.id)
          const isAvailable = canAttackRegion(reg.id, conqueredIds)
          const isSelected = selectedRegionId === reg.id
          const pos = ISOMETRIC_REGION_ANCHORS[reg.id] ?? reg.labelAnchor
          const isBossCapital = reg.type === 'capital_chefe'
          const totalEnemy = reg.garrison + reg.bossHp
          const cs = isBossCapital ? 1.2 : reg.id === 'reg_cidadela_origem' ? 0.86 : 0.98

          const wallFill = isConquered ? '#2dd4bf' : '#e05344'
          const wallDark = isConquered ? '#0d9488' : '#b8372a'
          const towerTop = isConquered ? '#99f6e4' : '#fca5a5'
          const courtyardFill = isConquered ? '#115e59' : '#691911'

          return (
            <g
              key={reg.id}
              data-testid={`lb-region-node-${reg.id}`}
              className="lb-region-group"
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => selectRegion(reg.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Sombra projetada do castelo */}
              <ellipse
                cx="0"
                cy={9 * cs}
                rx={33 * cs}
                ry={15 * cs}
                fill="rgba(69, 10, 10, 0.34)"
              />

              {/* Halo dourado pulsante na província selecionada */}
              {isSelected && (
                <ellipse
                  cx="0"
                  cy={5 * cs}
                  rx={39 * cs}
                  ry={19 * cs}
                  fill="rgba(250, 204, 21, 0.34)"
                  stroke="#fef08a"
                  strokeWidth="3.2"
                />
              )}

              {/* Pátio interno escuro da fortaleza */}
              <polygon
                points={`${-20 * cs},${-4 * cs} 0,${-13 * cs} ${20 * cs},${-4 * cs} 0,${5 * cs}`}
                fill={courtyardFill}
                stroke="#450a0a"
                strokeWidth="1.2"
              />

              {/* Muralhas de cortina isométricas do castelo (face esquerda clara + face direita sombreada) */}
              <polygon
                points={`${-22 * cs},${4 * cs} 0,${15 * cs} 0,${-3 * cs} ${-22 * cs},${-13 * cs}`}
                fill={wallFill}
                stroke="#450a0a"
                strokeWidth="1.6"
              />
              <polygon
                points={`0,${15 * cs} ${22 * cs},${4 * cs} ${22 * cs},${-13 * cs} 0,${-3 * cs}`}
                fill={wallDark}
                stroke="#450a0a"
                strokeWidth="1.6"
              />

              {/* Portão arqueado escuro na muralha frontal */}
              <path
                d={`M ${-12 * cs},${9 * cs} L ${-12 * cs},${1 * cs} A ${3.8 * cs},${3.8 * cs} 0 0,1 ${-5 * cs},${1 * cs} L ${-5 * cs},${12 * cs} Z`}
                fill="#2a0808"
              />

              {/* 4 Torres de Canto Ameadas 3D (fiel a mundo2_reino_conceito.jpg) */}
              {[
                [-21, -4],
                [0, -14],
                [21, -4],
                [0, 6],
              ].map(([tx, ty], tIdx) => (
                <g key={tIdx} transform={`translate(${tx * cs}, ${ty * cs})`}>
                  <rect
                    x={-6.5 * cs}
                    y={-14 * cs}
                    width={13 * cs}
                    height={16 * cs}
                    rx={2.5 * cs}
                    fill={tIdx === 2 ? wallDark : wallFill}
                    stroke="#450a0a"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="0"
                    cy={-14 * cs}
                    rx={7 * cs}
                    ry={3.8 * cs}
                    fill={towerTop}
                    stroke="#450a0a"
                    strokeWidth="1.3"
                  />
                  {/* Dentes das ameias 3D no topo de cada torre */}
                  {[-5, -1.5, 2, 5].map((mx, mIdx) => (
                    <rect
                      key={mIdx}
                      x={mx * cs - 1.2 * cs}
                      y={-17.5 * cs}
                      width={2.4 * cs}
                      height={3.2 * cs}
                      rx={0.6 * cs}
                      fill={wallFill}
                      stroke="#450a0a"
                      strokeWidth="0.9"
                    />
                  ))}
                  {/* Flâmula rubra nas torres das Capitais de Chefe */}
                  {isBossCapital && !isConquered && (
                    <g transform={`translate(0, ${-17 * cs})`}>
                      <line x1="0" y1="0" x2="0" y2={-7 * cs} stroke="#450a0a" strokeWidth="1.2" />
                      <polygon
                        points={`0,${-7 * cs} ${6 * cs},${-5 * cs} 0,${-3 * cs}`}
                        fill="#ef4444"
                      />
                    </g>
                  )}
                </g>
              ))}

              {/* Torre de Menagem Central Alta nas Capitais de Chefe */}
              {isBossCapital && (
                <g transform={`translate(0, ${-10 * cs})`}>
                  <rect
                    x={-9 * cs}
                    y={-22 * cs}
                    width={18 * cs}
                    height={22 * cs}
                    rx={4 * cs}
                    fill={wallFill}
                    stroke="#450a0a"
                    strokeWidth="1.6"
                  />
                  <ellipse
                    cx="0"
                    cy={-22 * cs}
                    rx={9.5 * cs}
                    ry={4.8 * cs}
                    fill={towerTop}
                    stroke="#450a0a"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* Pin Teardrop de Coroa acima das Capitais de Chefe (idêntico a mundo2_reino_conceito.jpg) */}
              {isBossCapital && !isConquered && (
                <g transform={`translate(0, ${-50 * cs})`}>
                  <polygon
                    points="-6,9 6,9 0,17"
                    fill="#e06d53"
                    stroke="#450a0a"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="13.5"
                    fill="#e06d53"
                    stroke="#450a0a"
                    strokeWidth="2"
                  />
                  <polygon
                    points="-7,4 -8,-4 -3,-1 0,-6 3,-1 8,-4 7,4"
                    fill="#fef3c7"
                    stroke="#450a0a"
                    strokeWidth="1.3"
                  />
                </g>
              )}

              {/* Balão Coral/Verde de Força Militar ("70", "520", "1,1k", "2,7k") */}
              <g
                transform={`translate(0, ${
                  isBossCapital ? 24 : isConquered ? 22 : -36
                })`}
              >
                {!isBossCapital && !isConquered && (
                  <polygon
                    points="-4,9 4,9 0,14"
                    fill={isAvailable ? '#e05344' : '#b8372a'}
                    stroke="#450a0a"
                    strokeWidth="1.4"
                  />
                )}
                <rect
                  x="-25"
                  y="-9.5"
                  width="50"
                  height="19"
                  rx="6.5"
                  fill={
                    isConquered
                      ? '#15803d'
                      : isAvailable
                        ? '#e05344'
                        : '#b8372a'
                  }
                  stroke={isConquered ? '#bbf7d0' : '#450a0a'}
                  strokeWidth="1.8"
                />
                <text
                  x="0"
                  y="3.8"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="900"
                >
                  {isConquered
                    ? `✓ +${formatArmy(reg.tributePerRun, notationMode)}`
                    : formatArmy(totalEnemy, notationMode)}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      {/* 9. Pins Teardrop Acima do Telhado + Pílulas [Nv X] na Base das 5 Construções da Cidadela */}
      <div
        className="lb-map-citadel-overlay"
        data-testid="lb-buildings-grid"
        style={{ zIndex: 12 }}
      >
        {CITADEL_BUILDING_LIST.map((b) => {
          const spot = CITADEL_MAP_SPOTS[b.id]
          const currentLevel = save.citadelLevels[b.id] ?? 0
          const isMax = currentLevel >= b.maxLevel
          const cost = getUpgradeCost(b.id, currentLevel)
          const canAfford = !isMax && save.reserveTroops >= cost

          return (
            <div
              key={b.id}
              data-testid={`lb-building-card-${b.id}`}
              className="lb-map-building-node"
              style={{
                left: `${(spot.x / 900) * 100}%`,
                top: `${(spot.y / 620) * 100}%`,
              }}
            >
              <button
                type="button"
                className={`lb-map-building-pin lb-map-building-pin--${spot.pinTone}`}
                style={{ transform: `translate(-50%, ${spot.pinOffsetY}px)` }}
                onClick={() => setActiveRealmSheet('citadel')}
                title={`${b.name} — ${b.descriptionPt}`}
                aria-label={b.name}
              >
                <span className="lb-map-building-pin__icon">{spot.pinIcon}</span>
              </button>

              <button
                type="button"
                data-testid={`lb-upgrade-btn-${b.id}`}
                className={`lb-map-building-lvl-pill ${canAfford ? 'can-upgrade' : ''}`}
                disabled={!canAfford || isMax}
                onClick={() => upgradeCitadelBuilding(b.id)}
                title={
                  isMax
                    ? 'Nível Máximo'
                    : `Evoluir ${spot.shortLabel} por ${formatArmy(cost, notationMode)} soldados`
                }
              >
                Nv {currentLevel} {!isMax && canAfford ? '⬆' : ''}
              </button>
            </div>
          )
        })}
      </div>

      {/* 10. Seletor Flutuante das 6 Engines do Reino (fiel a hub_reino_cidadela_engines.jpg & §3) */}
      <div
        className="lb-realm-engines-bar"
        data-testid="lb-engine-selector"
        role="group"
        aria-label="Selecionar Modo de Jogo (6 Engines do Reino)"
        style={{ zIndex: 20 }}
      >
        {ENGINE_LIST.map((eng) => {
          const isCurrent = activeEngineId === eng.id
          return (
            <button
              key={eng.id}
              type="button"
              data-testid={`lb-engine-btn-${eng.id}`}
              className={`lb-realm-engine-pill ${isCurrent ? 'is-active' : ''}`}
              onClick={() => selectEngine(eng.id)}
              title={`${eng.name} — ${eng.mechanicSummaryPt}`}
            >
              <span className="lb-realm-engine-pill__icon">{eng.icon}</span>
              <span className="lb-realm-engine-pill__label">{eng.shortName}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

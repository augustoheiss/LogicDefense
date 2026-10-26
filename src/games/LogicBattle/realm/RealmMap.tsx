// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/realm/RealmMap.tsx — Mapa Isométrico 3D Full-Screen (Mundo 2)
// Fiel ao conceito: master-plan/conceitos/mundo2_reino_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import React from 'react'
import { REGION_LIST, REGIONS } from '../config/regions'
import { CITADEL_BUILDING_LIST, getUpgradeCost } from '../config/upgrades'
import { canAttackRegion } from '../domain/economy'
import { formatArmy } from '../domain/notation'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { CitadelBuildingId } from '../types'

// Posições isométricas das 5 construções da Cidadela na zona verde-menta (fiel a mundo2_reino_conceito.jpg)
const CITADEL_MAP_SPOTS: Record<
  CitadelBuildingId,
  { x: number; y: number; pinTone: 'teal' | 'gold'; shortLabel: string }
> = {
  quartel: {
    x: 135,
    y: 330,
    pinTone: 'teal',
    shortLabel: 'Quartel',
  },
  observatorio: {
    x: 295,
    y: 295,
    pinTone: 'teal',
    shortLabel: 'Observatório',
  },
  forja: {
    x: 345,
    y: 410,
    pinTone: 'teal',
    shortLabel: 'Códice',
  },
  academia: {
    x: 145,
    y: 485,
    pinTone: 'teal',
    shortLabel: 'Academia',
  },
  mina_resto: {
    x: 445,
    y: 490,
    pinTone: 'gold',
    shortLabel: 'Mina',
  },
}

// Coordenadas isométricas bem espaçadas: Cidadela da Origem na fronteira verde e as 11 províncias inimigas no platô terracota
const ISOMETRIC_REGION_ANCHORS: Record<string, { x: number; y: number }> = {
  reg_cidadela_origem: { x: 255, y: 515 },
  reg_ponte_leste: { x: 525, y: 365 },
  reg_vila_balanca: { x: 555, y: 475 },
  reg_forte_esteiras: { x: 545, y: 245 },
  reg_bastião_pedra: { x: 645, y: 410 },
  reg_porto_fiorde: { x: 625, y: 165 },
  reg_glaciar_meio: { x: 660, y: 290 },
  reg_pico_precedencia: { x: 725, y: 115 },
  reg_oasis_decimais: { x: 755, y: 225 },
  reg_dunas_ioio: { x: 835, y: 155 },
  reg_trono_solar: { x: 765, y: 360 },
  reg_cratera_sinais: { x: 840, y: 285 },
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
        <line x1="-10" y1="-22" x2="-10" y2="-52" stroke="#451a03" strokeWidth="2.8" />
        <polygon points="-10,-50 12,-45 -10,-38" fill="#52b788" stroke="#1e293b" strokeWidth="1.5" />
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
  const conqueredIds = save.conqueredRegionIds
  const selectedRegionId = save.selectedRegionId
  const notationMode = save.settings.notationMode
  const selectRegion = useLogicBattleStore((s) => s.selectRegion)
  const upgradeCitadelBuilding = useLogicBattleStore((s) => s.upgradeCitadelBuilding)
  const setActiveRealmSheet = useLogicBattleStore((s) => s.setActiveRealmSheet)

  const mainReserveLabel = formatArmy(Math.max(340, save.reserveTroops), notationMode)
  const vanguardLabel = formatArmy(Math.max(1200, save.reserveTroops * 10), notationMode)

  return (
    <div className="lb-realm-map-box" data-testid="lb-realm-map">
      <svg
        viewBox="0 0 900 620"
        preserveAspectRatio="xMidYMid meet"
        className="lb-realm-svg"
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
          {/* Borda escura da estrada de terra */}
          <path
            d="M 135,335 Q 215,375 265,395 M 295,305 Q 280,350 265,395 M 145,485 Q 210,440 265,395 M 265,395 Q 315,445 445,495 M 265,395 Q 415,345 525,365 Q 635,380 765,360 M 525,365 Q 535,305 545,245 Q 635,205 725,115 M 525,365 Q 585,420 645,410"
            stroke="#9c7e54"
            strokeWidth="18"
          />
          {/* Leito de areia clara da estrada */}
          <path
            d="M 135,335 Q 215,375 265,395 M 295,305 Q 280,350 265,395 M 145,485 Q 210,440 265,395 M 265,395 Q 315,445 445,495 M 265,395 Q 415,345 525,365 Q 635,380 765,360 M 525,365 Q 535,305 545,245 Q 635,205 725,115 M 525,365 Q 585,420 645,410"
            stroke="#d6b88c"
            strokeWidth="13"
          />
        </g>

        {/* Rotas táticas secundárias entre os castelos inimigos */}
        {REGION_LIST.map((reg) => {
          const a1 = ISOMETRIC_REGION_ANCHORS[reg.id] ?? reg.labelAnchor
          return reg.neighbors.map((nId) => {
            const nb = REGIONS[nId]
            if (!nb || reg.id > nb.id) return null
            const a2 = ISOMETRIC_REGION_ANCHORS[nb.id] ?? nb.labelAnchor
            return (
              <line
                key={`edge_${reg.id}_${nb.id}`}
                x1={a1.x}
                y1={a1.y}
                x2={a2.x}
                y2={a2.y}
                stroke="rgba(124, 45, 18, 0.35)"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
            )
          })
        })}

        {/* 6. As 5 Construções Isométricas 3D da Cidadela na Zona Verde */}
        {Object.entries(CITADEL_MAP_SPOTS).map(([id, spot]) =>
          renderCitadelBuildingSvg(id as CitadelBuildingId, spot.x, spot.y - 12),
        )}

        {/* 7. Pelotões de Soldadinhos Turquesa nas Estradas com Balões Brancos (1,2k / 340) */}
        {renderGarrisonPlatoon('platoon_1', 175, 385, vanguardLabel)}
        {renderGarrisonPlatoon('platoon_2', 265, 345, mainReserveLabel)}
        {renderGarrisonPlatoon('platoon_3', 205, 445, mainReserveLabel)}
        {renderGarrisonPlatoon('platoon_4', 315, 470, mainReserveLabel)}

        {/* 8. As 12 Províncias como Castelos Fortificados Isométricos 3D de 4 Torres */}
        {REGION_LIST.map((reg) => {
          const isConquered = conqueredIds.includes(reg.id)
          const isAvailable = canAttackRegion(reg.id, conqueredIds)
          const isSelected = selectedRegionId === reg.id
          const pos = ISOMETRIC_REGION_ANCHORS[reg.id] ?? reg.labelAnchor
          const isBossCapital = reg.type === 'capital_chefe'
          const totalEnemy = reg.garrison + reg.bossHp
          const cs = isBossCapital ? 1.22 : 0.96

          const wallFill = isConquered ? '#38bdf8' : '#d9483b'
          const wallDark = isConquered ? '#0284c7' : '#a83228'
          const towerTop = isConquered ? '#7dd3fc' : '#f87171'

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
                cy={8 * cs}
                rx={32 * cs}
                ry={15 * cs}
                fill="rgba(69, 10, 10, 0.32)"
              />

              {/* Halo dourado pulsante na província selecionada */}
              {isSelected && (
                <ellipse
                  cx="0"
                  cy={4 * cs}
                  rx={38 * cs}
                  ry={19 * cs}
                  fill="rgba(250, 204, 21, 0.32)"
                  stroke="#fef08a"
                  strokeWidth="3.2"
                />
              )}

              {/* Muralhas de cortina isométricas do castelo */}
              <polygon
                points={`${-22 * cs},${4 * cs} 0,${14 * cs} ${22 * cs},${4 * cs} ${22 * cs},${-14 * cs} 0,${-4 * cs} ${-22 * cs},${-14 * cs}`}
                fill={wallFill}
                stroke="#450a0a"
                strokeWidth="1.6"
              />
              <polygon
                points={`0,${14 * cs} ${22 * cs},${4 * cs} ${22 * cs},${-14 * cs} 0,${-4 * cs}`}
                fill={wallDark}
                stroke="#450a0a"
                strokeWidth="1.6"
              />

              {/* Portão arqueado escuro na muralha frontal */}
              <path
                d={`M ${-12 * cs},${9 * cs} L ${-12 * cs},${1 * cs} A ${4 * cs},${4 * cs} 0 0,1 ${-5 * cs},${1 * cs} L ${-5 * cs},${12 * cs} Z`}
                fill="#2a0808"
              />

              {/* 4 Torres de Canto Ameadas (estilo mundo2_reino_conceito.jpg) */}
              {[
                [-21, -4],
                [0, -13],
                [21, -4],
                [0, 6],
              ].map(([tx, ty], tIdx) => (
                <g key={tIdx} transform={`translate(${tx * cs}, ${ty * cs})`}>
                  <rect
                    x={-6.5 * cs}
                    y={-14 * cs}
                    width={13 * cs}
                    height={16 * cs}
                    rx={3 * cs}
                    fill={wallFill}
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

              {/* Pin Circular de Coroa acima das Capitais de Chefe (idêntico a mundo2_reino_conceito.jpg) */}
              {isBossCapital && !isConquered && (
                <g transform={`translate(0, ${-50 * cs})`}>
                  <circle
                    cx="0"
                    cy="0"
                    r="13"
                    fill="#e06d53"
                    stroke="#450a0a"
                    strokeWidth="2"
                  />
                  <text x="0" y="4.5" textAnchor="middle" fontSize="13">
                    👑
                  </text>
                </g>
              )}

              {/* Balão Coral/Verde de Força Militar ("70", "520", "1,1k", "2,7k") */}
              <g transform={`translate(0, ${isBossCapital ? 24 : 21})`}>
                <rect
                  x="-26"
                  y="-9.5"
                  width="52"
                  height="19"
                  rx="7"
                  fill={
                    isConquered
                      ? '#15803d'
                      : isAvailable
                        ? '#e11d48'
                        : '#991b1b'
                  }
                  stroke={
                    isConquered
                      ? '#bbf7d0'
                      : isAvailable
                        ? '#fecdd3'
                        : '#fca5a5'
                  }
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

      {/* 9. Pins Circulares de Telhado + Pílulas [Nv X] das 5 Construções da Cidadela */}
      <div className="lb-map-citadel-overlay" data-testid="lb-buildings-grid">
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
                onClick={() => setActiveRealmSheet('citadel')}
                title={`${b.name} — ${b.descriptionPt}`}
                aria-label={b.name}
              >
                <span className="lb-map-building-pin__icon">{b.icon}</span>
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
    </div>
  )
}

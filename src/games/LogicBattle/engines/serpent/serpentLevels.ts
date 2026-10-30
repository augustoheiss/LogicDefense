// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/serpentLevels.ts — S2/S4: Gerador por Seed
// MASTER_PLAN_V4 §2.2, §2.3 & §2.5: Segmentos numerados, Placas Opcionais, Alvo Dourado e TNT
// ──────────────────────────────────────────────────────────────────────────────
import { createRng } from '../../domain/rng'
import { TrapId } from '../../types'
import { findToroidalChasePath } from './chasePath'
import {
  generateToroidalMaze,
  GridCoord,
  SERPENT_GRID_SIZE,
  torusManhattan,
  TorusMazeGrid,
} from './torusGrid'

export interface DragonSegmentSpec {
  id: string
  index: number
  hp: number
  maxHp: number
  isHead: boolean
  isGolden: boolean
}

export interface SerpentMathPad {
  id: string
  x: number
  y: number
  label: string
  op: '×' | '+' | '÷' | '−' | '^2'
  operand: number
  isOptimal: boolean
  isTrap: boolean
  trapId?: TrapId
  trapName?: string
  luzGuiaPt?: string
  used: boolean
}

export interface SerpentTntBarrel {
  id: string
  x: number
  y: number
  damage: number
  label: string
  radiusCells: number
  exploded: boolean
}

export interface SerpentCoinNode {
  id: string
  x: number
  y: number
  value: number
  collected: boolean
}

export interface SerpentLevelConfig {
  seed: number
  level: number
  grid: TorusMazeGrid
  heroStart: GridCoord
  dragonStart: GridCoord
  initialArrowDamage: number
  initialArmyPower: number
  segments: DragonSegmentSpec[]
  pads: SerpentMathPad[]
  tnts: SerpentTntBarrel[]
  coins: SerpentCoinNode[]
}

export function generateSerpentLevel(
  seed: number,
  level = 1,
  initialArmyPower = 12,
): SerpentLevelConfig {
  const rng = createRng(seed ^ (level * 0x9e3779b9))
  const grid = generateToroidalMaze(seed, SERPENT_GRID_SIZE, SERPENT_GRID_SIZE)

  // Posicionar o herói próximo ao centro do mapa (sempre em célula 'floor')
  const heroStart =
    grid.floorCells.find((c) => c.x >= 22 && c.x <= 26 && c.y >= 22 && c.y <= 26) ??
    grid.floorCells[0]

  // Posicionar a cabeça do dragão no corredor superior visível (3 a 5 células acima do herói)
  // Fiel ao conceito engine_F_serpente_labirinto_infinito.jpg: serpente visível na tela desde t=0s!
  let dragonStart =
    grid.floorCells.find(
      (c) =>
        Math.abs(c.x - heroStart.x) <= 3 &&
        c.y >= heroStart.y - 5 &&
        c.y <= heroStart.y - 3,
    ) ?? grid.floorCells[Math.floor(grid.floorCells.length / 3)]

  for (const cand of rng.shuffle([...grid.floorCells])) {
    const dx = Math.abs(cand.x - heroStart.x)
    const dy = heroStart.y - cand.y
    if (dx <= 3 && dy >= 3 && dy <= 5) {
      const pathCheck = findToroidalChasePath(grid, cand, heroStart, false)
      if (pathCheck.steps >= 5 && pathCheck.steps <= 12) {
        dragonStart = cand
        break
      }
    }
  }

  // Segmentos numerados da Serpente (da cabeça no índice 0 até a ponta da cauda no final)
  // Os últimos segmentos da cauda têm HP pequeno (4, 6) para que o tiro automático
  // desde t=0s destrua elos já nos primeiros segundos mesmo sem input!
  const scale = Math.max(1, 1 + Math.floor((level - 1) * 0.25))
  const baseValues = [
    48 * scale, // Cabeça (vulnerável quando a cauda zera)
    36 * scale, // Segmento-alvo dourado (divisibilidade exata)
    24 * scale,
    24 * scale,
    12 * scale,
    6,
    4,
  ]

  const segments: DragonSegmentSpec[] = baseValues.map((val, idx) => ({
    id: `seg_${idx}`,
    index: idx,
    hp: val,
    maxHp: val,
    isHead: idx === 0,
    isGolden: idx === 1,
  }))

  // Gerar placas matemáticas opcionais espalhadas pelos corredores próximos ao herói
  const padTemplates: Omit<SerpentMathPad, 'id' | 'x' | 'y' | 'used'>[] = rng.shuffle([
    {
      label: '×2',
      op: '×',
      operand: 2,
      isOptimal: true,
      isTrap: false,
    },
    {
      label: '+5',
      op: '+',
      operand: 5,
      isOptimal: true,
      isTrap: false,
    },
    {
      label: '÷2',
      op: '÷',
      operand: 2,
      isOptimal: false,
      isTrap: true,
      trapId: 'T06',
      trapName: 'Placa Divisora no Labirinto',
      luzGuiaPt: 'Pisar em ÷2 reduz o dano da flecha pela metade; contorne pelo corredor lateral!',
    },
    {
      label: '×2',
      op: '×',
      operand: 2,
      isOptimal: true,
      isTrap: false,
    },
    {
      label: '+3',
      op: '+',
      operand: 3,
      isOptimal: true,
      isTrap: false,
    },
    {
      label: '−3',
      op: '−',
      operand: 3,
      isOptimal: false,
      isTrap: true,
      trapId: 'T02',
      trapName: 'Placa de Drenagem (−3)',
      luzGuiaPt: 'Placas negativas subtraem poder de fogo; priorize placas + e ×!',
    },
    {
      label: '²',
      op: '^2',
      operand: 2,
      isOptimal: true,
      isTrap: false,
    },
  ])

  const occupied = new Set<string>([
    `${heroStart.x},${heroStart.y}`,
    `${dragonStart.x},${dragonStart.y}`,
  ])
  // Priorizar células dentro do quadro visível da câmera (|dx|<=3, |dy|<=5) para que placas e TNTs apareçam imediatamente na tela
  const viewportFloor = rng.shuffle(
    grid.floorCells.filter((c) => {
      const dx = Math.abs(c.x - heroStart.x)
      const dy = Math.abs(c.y - heroStart.y)
      const d = torusManhattan(heroStart.x, heroStart.y, c.x, c.y)
      return d >= 2 && dx <= 3 && dy <= 5
    }),
  )
  const outerFloor = rng.shuffle(
    grid.floorCells.filter((c) => {
      const d = torusManhattan(heroStart.x, heroStart.y, c.x, c.y)
      return d >= 6 && d <= 16
    }),
  )
  const nearFloor = [...viewportFloor, ...outerFloor]

  const pads: SerpentMathPad[] = []
  let cellCursor = 0
  // Intercalar colocação de 4 placas visíveis e 2 TNTs visíveis perto do herói/dragão
  const takeNextSpot = (): GridCoord | null => {
    while (
      cellCursor < nearFloor.length &&
      occupied.has(`${nearFloor[cellCursor].x},${nearFloor[cellCursor].y}`)
    ) {
      cellCursor++
    }
    if (cellCursor >= nearFloor.length) return null
    const spot = nearFloor[cellCursor++]
    occupied.add(`${spot.x},${spot.y}`)
    return spot
  }

  for (let i = 0; i < Math.min(4, padTemplates.length); i++) {
    const spot = takeNextSpot()
    if (!spot) break
    pads.push({
      ...padTemplates[i],
      id: `pad_${i}`,
      x: spot.x,
      y: spot.y,
      used: false,
    })
  }

  // Barris de TNT numerados (−12, −18) visíveis nos corredores perto da rota do dragão
  const tnts: SerpentTntBarrel[] = []
  const tntDamages = [12, 18, 12]
  for (let i = 0; i < tntDamages.length; i++) {
    const spot = takeNextSpot()
    if (!spot) break
    const dmg = tntDamages[i]
    tnts.push({
      id: `tnt_${i}`,
      x: spot.x,
      y: spot.y,
      damage: dmg,
      label: `−${dmg}`,
      radiusCells: 5,
      exploded: false,
    })
  }

  // Demais placas matemáticas nos corredores adjacentes
  for (let i = 4; i < padTemplates.length; i++) {
    const spot = takeNextSpot()
    if (!spot) break
    pads.push({
      ...padTemplates[i],
      id: `pad_${i}`,
      x: spot.x,
      y: spot.y,
      used: false,
    })
  }

  // Moedas douradas nos corredores
  const coins: SerpentCoinNode[] = []
  for (let i = 0; i < 16; i++) {
    const spot = takeNextSpot()
    if (!spot) break
    coins.push({
      id: `coin_${i}`,
      x: spot.x,
      y: spot.y,
      value: 2,
      collected: false,
    })
  }

  return {
    seed,
    level,
    grid,
    heroStart,
    dragonStart,
    initialArrowDamage: 2,
    initialArmyPower: Math.max(5, initialArmyPower),
    segments,
    pads,
    tnts,
    coins,
  }
}

import React, { useEffect, useRef } from 'react'
import {
  ActivePiece,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CascadeWave,
  FruitCoord,
  FruitKind,
  GridCell,
  StageViewportMetrics,
  SubGameStyle,
} from '../types'
import { computeGhostY } from '../engine/gridEngine'
import {
  FRUIT_CATALOG,
  FRUIT_GRID_COLS,
  FRUIT_GRID_ROWS,
  inferFruitKindFromCell,
} from '../engine/fruitMatchEngine'
import {
  canPlaceTactilePieceAt,
  getTactilePieceCells,
  TACTILE_ROW_END,
  TACTILE_ROW_START,
} from '../engine/tactileGridEngine'
import { getPieceDefinition, getPieceOccupiedCells } from '../engine/tetrominoes'
import {
  getSubGameStyleLabelPt,
  getSubGameStylePedagogicalSubtitle,
  LOCK_DELAY_LIMIT_MS,
  STYLE_TRANSITION_DURATION_MS,
  useLogicTetrisStore,
} from '../state/useLogicTetrisStore'

interface CanvasParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  decay: number
  shape: 'square' | 'diamond' | 'spark'
}

interface CanvasBlockShard {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rotation: number
  vRot: number
  color: string
  borderColor: string
  glowColor: string
  symbol?: string
  emoji?: string
  alpha: number
  decay: number
}

interface CanvasShockwaveRing {
  x: number
  y: number
  radius: number
  maxRadius: number
  color: string
  lineWidth: number
  alpha: number
}

interface CanvasFloatingCallout {
  x: number
  y: number
  vy: number
  text: string
  subtext?: string
  color: string
  borderColor: string
  scale: number
  alpha: number
  decay: number
}

interface BlockRenderTransform {
  offsetX?: number
  offsetY?: number
  scaleX?: number
  scaleY?: number
  alpha?: number
  flashIntensity?: number
  fractureProgress?: number
  rotationRad?: number
}

const MAX_CANVAS_PARTICLES = 180
const MAX_CANVAS_SHARDS = 160
const MAX_CANVAS_SHOCKWAVES = 28
const MAX_CANVAS_CALLOUTS = 24

export interface TetrisCanvasProps {
  className?: string
  /** Optional click callback on a buried cavity cell to trigger [B] Tapar Buraco directly */
  onCavityClick?: () => void
}

const LEFT_GUTTER = 30
const RIGHT_GUTTER = 56
const TOP_RULER = 30
const BOTTOM_RULER = 30

export const CLASSIC_CELL_SIZE = 40
export const ARENA_10X10_CELL_SIZE = 64

export const CANVAS_LOGICAL_WIDTH =
  LEFT_GUTTER + BOARD_WIDTH * CLASSIC_CELL_SIZE + RIGHT_GUTTER
export const CANVAS_LOGICAL_HEIGHT =
  TOP_RULER + BOARD_HEIGHT * CLASSIC_CELL_SIZE + BOTTOM_RULER

/**
 * Retorna a geometria proporcional do palco conforme o estilo ativo:
 * - `TETRIS_CLASSIC`: Torre vertical `20×10` (`cellSizePx = 34`, `426 × 740`)
 * - `FRUIT_MATCH` & `TACTILE_GRID`: Arena quadrada `10×10` de palco inteiro sem cortes (`cellSizePx = 50`, `586 × 560`)
 */
export function getStageViewportMetrics(style: SubGameStyle): StageViewportMetrics {
  if (style === 'TETRIS_CLASSIC') {
    const cellSizePx = CLASSIC_CELL_SIZE
    return {
      style,
      activeRows: 20,
      activeCols: 10,
      cellSizePx,
      canvasWidthPx: LEFT_GUTTER + 10 * cellSizePx + RIGHT_GUTTER,
      canvasHeightPx: TOP_RULER + 20 * cellSizePx + BOTTOM_RULER,
    }
  }

  const cellSizePx = ARENA_10X10_CELL_SIZE
  return {
    style,
    activeRows: 10,
    activeCols: 10,
    cellSizePx,
    canvasWidthPx: LEFT_GUTTER + 10 * cellSizePx + RIGHT_GUTTER,
    canvasHeightPx: TOP_RULER + 10 * cellSizePx + BOTTOM_RULER,
  }
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w * 0.5, h * 0.5)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function drawBlockFractureCracks(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  fractureProgress: number
): void {
  if (fractureProgress <= 0.02) return
  const p = Math.min(1, fractureProgress)
  const cx = x + cellSize * 0.5
  const cy = y + cellSize * 0.5
  const reach = cellSize * 0.44 * p

  context.save()
  context.strokeStyle = '#ffffff'
  context.shadowColor = '#fef08a'
  context.shadowBlur = 8
  context.lineWidth = Math.max(1.5, 2.6 * p)
  context.lineCap = 'round'
  context.lineJoin = 'round'

  // 4 jagged diagonal fracture branches radiating from center
  const branches: ReadonlyArray<Array<[number, number]>> = [
    [
      [-0.38, -0.25],
      [-0.65, -0.62],
      [-0.95, -0.88],
    ],
    [
      [0.34, -0.28],
      [0.58, -0.68],
      [0.92, -0.85],
    ],
    [
      [-0.32, 0.36],
      [-0.68, 0.55],
      [-0.9, 0.92],
    ],
    [
      [0.36, 0.3],
      [0.62, 0.68],
      [0.92, 0.88],
    ],
  ]

  for (const branch of branches) {
    context.beginPath()
    context.moveTo(cx, cy)
    for (const [bx, by] of branch) {
      context.lineTo(cx + bx * reach, cy + by * reach)
    }
    context.stroke()
  }
  context.restore()
}

/**
 * Neon Genesis Polymorphic 3-in-1 2D Canvas Renderer for Logic Tetris (V4 Cinematic Choreography Edition).
 *
 * - `TETRIS_CLASSIC`: Palco `20×10` vertical com blocos de `34px`, interpolação suave 60fps, feixe de Hard-Drop,
 *   laser de limpeza horizontal, estilhaços físicos 2D e colapso gravitacional da pilha superior.
 * - `FRUIT_MATCH`: Arena `10×10` cheia com 100 frutas de `50px`, deslizamento físico de troca, trincamento e
 *   quebra visível dos blocos em estilhaços deixando espaço vazio, queda física por gravidade e ondas automáticas sequenciais!
 * - `TACTILE_GRID`: Arena `10×10` inteira sem cortes (`rows 0..9, cols 0..9`) com blocos de `50px`,
 *   animação spring-pop de encaixe, conexão energética 10/10 e quebra em onda dominó com choque duplo H×V.
 */
export const TetrisCanvas: React.FC<TetrisCanvasProps> = ({
  className = '',
  onCavityClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<CanvasParticle[]>([])
  const shardsRef = useRef<CanvasBlockShard[]>([])
  const shockwavesRef = useRef<CanvasShockwaveRing[]>([])
  const calloutsRef = useRef<CanvasFloatingCallout[]>([])
  const triggeredEventsSetRef = useRef<Set<string>>(new Set())
  const pieceVisualRef = useRef<{
    x: number
    y: number
    type: string
    lastUpdateMs: number
  }>({ x: 3, y: 0, type: 'I', lastUpdateMs: 0 })
  const lastProcessedEventRef = useRef<number>(0)
  const lastProcessedShiftRef = useRef<number>(0)
  const lastMorphedPieceStateRef = useRef<string>('')
  const dragStartFruitRef = useRef<FruitCoord | null>(null)

  const floatingFeedbacks = useLogicTetrisStore((s) => s.floatingFeedbacks)
  const buriedCount = useLogicTetrisStore((s) => s.topology.buriedCavities.length)
  const phase = useLogicTetrisStore((s) => s.phase)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const styleRotationMode = useLogicTetrisStore((s) => s.styleRotationMode)
  const combo = useLogicTetrisStore((s) => s.combo)
  const lastMathResonanceFormula = useLogicTetrisStore((s) => s.lastMathResonanceFormula)
  const validSwapsCount = useLogicTetrisStore(
    (s) => s.fruitOracle.validSwapsCount ?? s.fruitOracle.readyPairsCount
  )
  const classicGraceMs = useLogicTetrisStore((s) => s.activePiece.graceFloatMs ?? 0)
  const graceFloatMs = activeSubGameStyle === 'TETRIS_CLASSIC' ? classicGraceMs : 0

  const stageMetrics = getStageViewportMetrics(activeSubGameStyle)
  const is10x10Stage = stageMetrics.activeRows === 10

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number | null = null
    let isUnmounted = false

    const pushBoundedParticle = (p: CanvasParticle) => {
      if (particlesRef.current.length >= MAX_CANVAS_PARTICLES) {
        particlesRef.current.shift()
      }
      particlesRef.current.push(p)
    }

    const pushBoundedShard = (s: CanvasBlockShard) => {
      if (shardsRef.current.length >= MAX_CANVAS_SHARDS) {
        shardsRef.current.shift()
      }
      shardsRef.current.push(s)
    }

    const pushBoundedShockwave = (ring: CanvasShockwaveRing) => {
      if (shockwavesRef.current.length >= MAX_CANVAS_SHOCKWAVES) {
        shockwavesRef.current.shift()
      }
      shockwavesRef.current.push(ring)
    }

    const pushBoundedCallout = (callout: CanvasFloatingCallout) => {
      if (calloutsRef.current.length >= MAX_CANVAS_CALLOUTS) {
        calloutsRef.current.shift()
      }
      calloutsRef.current.push(callout)
    }

    /**
     * Spawns 4 physical rotating 2D block fragments (`CanvasBlockShard`) + sparkles
     * when a fruit or block breaks apart on the board!
     */
    const spawnBlockShatterShards = (
      col: number,
      row: number,
      cellSize: number,
      color: string,
      borderColor: string,
      glowColor: string,
      symbol?: string,
      emoji?: string
    ) => {
      const cx = LEFT_GUTTER + col * cellSize + cellSize * 0.5
      const cy = TOP_RULER + row * cellSize + cellSize * 0.5
      const shardSize = Math.max(9, cellSize * 0.34)
      const quadrants: ReadonlyArray<[number, number]> = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]

      quadrants.forEach(([qx, qy], idx) => {
        const vx = qx * (1.5 + Math.random() * 2.4) + (Math.random() - 0.5) * 0.8
        const vy = qy * 1.3 - (1.8 + Math.random() * 2.2)
        pushBoundedShard({
          x: cx + qx * (cellSize * 0.18),
          y: cy + qy * (cellSize * 0.18),
          vx,
          vy,
          w: shardSize,
          h: shardSize * (0.78 + (idx % 2) * 0.22),
          rotation: (idx * Math.PI) / 4,
          vRot: qx * (0.09 + Math.random() * 0.12),
          color,
          borderColor,
          glowColor,
          symbol: idx === 0 ? symbol : undefined,
          emoji: idx === 1 ? emoji : undefined,
          alpha: 1,
          decay: 0.022 + Math.random() * 0.01,
        })
      })

      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.4
        const speed = 1.4 + Math.random() * 3.0
        pushBoundedParticle({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size: 3.0 + Math.random() * 3.2,
          color: i % 2 === 0 ? '#fef08a' : borderColor,
          alpha: 1,
          decay: 0.022 + Math.random() * 0.012,
          shape: i % 2 === 0 ? 'spark' : 'diamond',
        })
      }
    }

    const spawnRowClearParticles = (rows: number[], cellSize: number) => {
      const palette = ['#22d3ee', '#fbbf24', '#34d399', '#a855f7', '#fef08a']
      for (const row of rows) {
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.9 + Math.random() * 3.5
            pushBoundedParticle({
              x: xCenter + (Math.random() - 0.5) * 14,
              y: yCenter + (Math.random() - 0.5) * 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.7,
              size: 2.8 + Math.random() * 3.6,
              color: palette[(col + i) % palette.length],
              alpha: 1,
              decay: 0.018 + Math.random() * 0.016,
              shape: i % 2 === 0 ? 'diamond' : 'square',
            })
          }
        }
      }
    }

    const spawnColumnClearParticles = (cols: number[], cellSize: number) => {
      const palette = ['#10b981', '#fbbf24', '#34d399', '#67e8f9', '#fef08a']
      for (const col of cols) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        for (let row = TACTILE_ROW_START; row <= TACTILE_ROW_END; row++) {
          const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.9 + Math.random() * 3.2
            pushBoundedParticle({
              x: xCenter + (Math.random() - 0.5) * 10,
              y: yCenter + (Math.random() - 0.5) * 14,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.8,
              size: 2.8 + Math.random() * 3.4,
              color: palette[(row + i) % palette.length],
              alpha: 1,
              decay: 0.017 + Math.random() * 0.015,
              shape: 'diamond',
            })
          }
        }
      }
    }

    const spawnFruitCascadeParticles = (waves: CascadeWave[], cellSize: number) => {
      for (const wave of waves) {
        for (const popped of wave.poppedCells) {
          const xCenter = LEFT_GUTTER + popped.col * cellSize + cellSize * 0.5
          const yCenter = TOP_RULER + popped.row * cellSize + cellSize * 0.5
          for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.35
            const speed = 1.2 + Math.random() * 3.0
            pushBoundedParticle({
              x: xCenter,
              y: yCenter,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.6,
              size: 3.0 + Math.random() * 3.4,
              color: i % 2 === 0 ? '#fef08a' : popped.color,
              alpha: 1,
              decay: 0.019 + Math.random() * 0.014,
              shape: i % 2 === 0 ? 'spark' : 'diamond',
            })
          }
        }
      }
    }

    const spawnTransitionPurgeFireworks = (
      boardW: number,
      boardH: number,
      purgedCount: number
    ) => {
      const palette = ['#fbbf24', '#a855f7', '#22d3ee', '#34d399', '#f43f5e', '#fef08a']
      const burstCount = Math.min(65, Math.max(24, purgedCount * 2))
      for (let i = 0; i < burstCount; i++) {
        const x = LEFT_GUTTER + Math.random() * boardW
        const y = TOP_RULER + Math.random() * boardH
        const angle = Math.random() * Math.PI * 2
        const speed = 1.2 + Math.random() * 3.8
        pushBoundedParticle({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.9,
          size: 3.2 + Math.random() * 4.2,
          color: palette[i % palette.length],
          alpha: 1,
          decay: 0.015 + Math.random() * 0.014,
          shape: i % 2 === 0 ? 'diamond' : 'spark',
        })
      }
    }

    const spawnLegendaryStreakFireworks = (cellSize: number) => {
      const palette = ['#fbbf24', '#f43f5e', '#22d3ee', '#a855f7', '#34d399', '#fef08a']
      for (let col = 1; col < BOARD_WIDTH; col += 2) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const yCenter = TOP_RULER + 42
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.2
          const speed = 1.4 + Math.random() * 3.4
          pushBoundedParticle({
            x: xCenter,
            y: yCenter,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.5,
            size: 3.2 + Math.random() * 3.8,
            color: palette[(col + i) % palette.length],
            alpha: 1,
            decay: 0.014 + Math.random() * 0.012,
            shape: 'diamond',
          })
        }
      }
    }

    const spawnSealedCavityParticles = (
      coords: Array<{ row: number; col: number }>,
      cellSize: number
    ) => {
      for (const { row, col } of coords) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.25
          const speed = 1.0 + Math.random() * 2.8
          pushBoundedParticle({
            x: xCenter,
            y: yCenter,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.4,
            size: 3 + Math.random() * 3.5,
            color: i % 2 === 0 ? '#fbbf24' : '#fef08a',
            alpha: 1,
            decay: 0.016 + Math.random() * 0.014,
            shape: 'diamond',
          })
        }
      }
    }

    const spawnMorphBurstParticles = (piece: ActivePiece, cellSize: number) => {
      const cells = getPieceOccupiedCells(piece)
      const def = getPieceDefinition(piece.type)
      for (const { row, col } of cells) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 0.9 + Math.random() * 2.4
          pushBoundedParticle({
            x: xCenter,
            y: yCenter,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2.5 + Math.random() * 3,
            color: i % 2 === 0 ? def.borderColor : '#fbbf24',
            alpha: 1,
            decay: 0.02 + Math.random() * 0.015,
            shape: 'spark',
          })
        }
      }
    }

    const drawFruitBlock = (
      context: CanvasRenderingContext2D,
      col: number,
      row: number,
      fruitKind: FruitKind,
      pulsePhase: number,
      cellSize: number,
      isMorphed?: boolean,
      isSelected?: boolean,
      offsetX: number = 0,
      offsetY: number = 0,
      transform?: BlockRenderTransform
    ) => {
      const meta = FRUIT_CATALOG[fruitKind] ?? FRUIT_CATALOG.APPLE_RUBY
      const baseX = LEFT_GUTTER + col * cellSize + (transform?.offsetX ?? offsetX)
      const baseY = TOP_RULER + row * cellSize + (transform?.offsetY ?? offsetY)
      const scaleX = transform?.scaleX ?? 1
      const scaleY = transform?.scaleY ?? 1
      const alpha = transform?.alpha ?? 1
      const flashIntensity = transform?.flashIntensity ?? 0
      const fractureProgress = transform?.fractureProgress ?? 0
      const rotationRad = transform?.rotationRad ?? 0

      const pad = isSelected ? 1.5 : 3
      const w = cellSize - pad * 2
      const h = cellSize - pad * 2
      const isStar = fruitKind === 'STAR_PRISM'

      context.save()
      if (alpha < 0.999) {
        context.globalAlpha = Math.max(0, alpha)
      }

      let x = baseX
      let y = baseY
      if (scaleX !== 1 || scaleY !== 1 || rotationRad !== 0) {
        context.translate(baseX + cellSize * 0.5, baseY + cellSize * 0.5)
        if (rotationRad !== 0) {
          context.rotate(rotationRad)
        }
        context.scale(scaleX, scaleY)
        x = -cellSize * 0.5
        y = -cellSize * 0.5
      }

      const shimmer = 0.8 + 0.2 * Math.sin(pulsePhase * 4.5 + col + row)
      const grad = context.createRadialGradient(
        x + cellSize * 0.38,
        y + cellSize * 0.35,
        3,
        x + cellSize * 0.5,
        y + cellSize * 0.5,
        cellSize * 0.65
      )
      grad.addColorStop(0, isStar ? '#fef9c3' : meta.borderColor)
      grad.addColorStop(0.58, meta.color)
      grad.addColorStop(1, '#0f172a')

      const cornerRadius = Math.max(7, cellSize * 0.22)
      drawRoundedRectPath(context, x + pad, y + pad, w, h, cornerRadius)
      context.fillStyle = grad
      context.shadowColor = isSelected ? '#fef08a' : meta.glowColor
      context.shadowBlur = isSelected ? 16 : isStar ? 14 * shimmer : 8
      context.fill()

      context.strokeStyle =
        flashIntensity > 0.25
          ? '#ffffff'
          : isSelected
            ? '#fef08a'
            : isStar
              ? '#fef08a'
              : meta.borderColor
      context.lineWidth =
        flashIntensity > 0.25 ? 3.2 : isSelected ? 2.8 : isStar || isMorphed ? 2.0 : 1.4
      context.stroke()

      // Glossy top-left highlight orb
      context.shadowBlur = 0
      context.fillStyle = 'rgba(255, 255, 255, 0.34)'
      context.beginPath()
      context.ellipse(
        x + cellSize * 0.35,
        y + cellSize * 0.26,
        cellSize * 0.17,
        cellSize * 0.08,
        -0.35,
        0,
        Math.PI * 2
      )
      context.fill()

      // Fruit Emoji + Accessibility Symbol (Proportional to cellSize 50px vs 34px)
      const emojiFontPx = Math.round(cellSize * 0.44)
      context.font = `${emojiFontPx}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#ffffff'
      context.fillText(meta.emoji, x + cellSize * 0.46, y + cellSize * 0.52)

      const symFontPx = Math.max(8, Math.round(cellSize * 0.2))
      context.font = `bold ${symFontPx}px "JetBrains Mono", monospace`
      context.fillStyle = isStar ? '#451a03' : '#f8fafc'
      context.fillText(
        meta.symbol,
        x + cellSize - symFontPx * 0.75,
        y + cellSize - symFontPx * 0.7
      )

      if (flashIntensity > 0.02) {
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cornerRadius)
        context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.82, flashIntensity * 0.8)})`
        context.fill()
      }

      if (fractureProgress > 0.02) {
        drawBlockFractureCracks(context, x, y, cellSize, fractureProgress)
      }

      context.restore()
    }

    const drawGridBlock = (
      context: CanvasRenderingContext2D,
      col: number,
      row: number,
      cell: GridCell,
      pulsePhase: number,
      currentStyle: SubGameStyle,
      cellSize: number,
      isSelectedFruit: boolean = false,
      offsetX: number = 0,
      offsetY: number = 0,
      transform?: BlockRenderTransform
    ) => {
      if (cell.fruitKind || currentStyle === 'FRUIT_MATCH') {
        const inferredKind = cell.fruitKind ?? inferFruitKindFromCell(cell)
        drawFruitBlock(
          context,
          col,
          row,
          inferredKind,
          pulsePhase,
          cellSize,
          cell.isMorphedBlock,
          isSelectedFruit,
          offsetX,
          offsetY,
          transform
        )
        return
      }

      const baseX = LEFT_GUTTER + col * cellSize + (transform?.offsetX ?? offsetX)
      const baseY = TOP_RULER + row * cellSize + (transform?.offsetY ?? offsetY)
      const scaleX = transform?.scaleX ?? 1
      const scaleY = transform?.scaleY ?? 1
      const alpha = transform?.alpha ?? 1
      const flashIntensity = transform?.flashIntensity ?? 0
      const fractureProgress = transform?.fractureProgress ?? 0
      const rotationRad = transform?.rotationRad ?? 0

      const pad = cellSize >= 46 ? 2.2 : 1.5
      const w = cellSize - pad * 2
      const h = cellSize - pad * 2

      context.save()
      if (alpha < 0.999) {
        context.globalAlpha = Math.max(0, alpha)
      }

      let x = baseX
      let y = baseY
      if (scaleX !== 1 || scaleY !== 1 || rotationRad !== 0) {
        context.translate(baseX + cellSize * 0.5, baseY + cellSize * 0.5)
        if (rotationRad !== 0) {
          context.rotate(rotationRad)
        }
        context.scale(scaleX, scaleY)
        x = -cellSize * 0.5
        y = -cellSize * 0.5
      }

      const isGoldenCrystal = cell.type === 'SEALED_GOLD' || Boolean(cell.isSealedHole)
      const cornerRadius = cellSize >= 46 ? 6 : 3

      if (isGoldenCrystal) {
        const shimmer = 0.78 + 0.22 * Math.sin(pulsePhase * 4 + col + row)
        const grad = context.createLinearGradient(x, y, x + cellSize, y + cellSize)
        grad.addColorStop(0, '#fef08a')
        grad.addColorStop(0.5, '#fbbf24')
        grad.addColorStop(1, '#d97706')

        context.fillStyle = grad
        context.shadowColor = `rgba(251, 191, 36, ${0.55 * shimmer})`
        context.shadowBlur = 10
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cornerRadius)
        context.fill()

        context.strokeStyle = '#fef9c3'
        context.lineWidth = 1.8
        context.stroke()

        // Inner diamond facet
        context.beginPath()
        context.moveTo(x + cellSize * 0.5, y + 5)
        context.lineTo(x + cellSize - 5, y + cellSize * 0.5)
        context.lineTo(x + cellSize * 0.5, y + cellSize - 5)
        context.lineTo(x + 5, y + cellSize * 0.5)
        context.closePath()
        context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
        context.lineWidth = 1.1
        context.stroke()
      } else {
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cornerRadius)
        context.fillStyle = cell.color
        context.fill()

        // Top-left inner bevel highlight
        context.fillStyle = 'rgba(255, 255, 255, 0.24)'
        context.fillRect(x + pad + 2, y + pad + 1, w - 4, Math.max(3.5, cellSize * 0.1))
        context.fillRect(x + pad + 1, y + pad + 2, Math.max(3.5, cellSize * 0.1), h - 4)

        // Bottom-right inner shadow
        context.fillStyle = 'rgba(15, 23, 42, 0.36)'
        context.fillRect(
          x + pad + 2,
          y + pad + h - Math.max(3.5, cellSize * 0.1) - 1,
          w - 4,
          Math.max(3.5, cellSize * 0.1)
        )

        // Outer neon border
        context.strokeStyle = flashIntensity > 0.25 ? '#ffffff' : (cell.borderColor ?? '#e2e8f0')
        context.lineWidth = flashIntensity > 0.25 ? 2.6 : cell.isMorphedBlock ? 1.8 : 1.3
        context.stroke()

        if (cell.isMorphedBlock) {
          context.fillStyle = '#fef08a'
          context.beginPath()
          context.arc(x + cellSize - 6.5, y + 6.5, 2.4, 0, Math.PI * 2)
          context.fill()
        }
      }

      // Accessibility Geometric Symbol
      context.shadowBlur = 0
      context.fillStyle = isGoldenCrystal ? '#451a03' : 'rgba(255, 255, 255, 0.94)'
      const symFontPx = Math.round(cellSize * 0.36)
      context.font = `bold ${symFontPx}px "JetBrains Mono", monospace`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(cell.symbol || '■', x + cellSize * 0.5, y + cellSize * 0.5 + 0.5)

      if (flashIntensity > 0.02) {
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cornerRadius)
        context.fillStyle = `rgba(255, 255, 255, ${Math.min(0.82, flashIntensity * 0.8)})`
        context.fill()
      }

      if (fractureProgress > 0.02) {
        drawBlockFractureCracks(context, x, y, cellSize, fractureProgress)
      }

      context.restore()
    }

    const renderFrame = (nowMs: number) => {
      if (isUnmounted) return

      const state = useLogicTetrisStore.getState()
      const {
        grid,
        activePiece,
        fruitOracle,
        selectedFruitCell,
        fruitCursor,
        lastSwappedCells,
        invalidSwapBounceUntil,
        lastPurgedBlocksCount,
        tactileTray,
        selectedTraySlot,
        tactileCursorCol,
        tactileCursorRow,
        tactileTopology,
        topology,
        phase: currentPhase,
        activeSubGameStyle: currentStyle,
        isStyleTransitioning,
        styleTransitionRemainingMs,
        styleTransitionTo,
        totalStyleShiftsCount,
        combo: currentCombo,
        lastDopamineTier,
        lastEventCounter,
        lastClearedRows,
        lastClearedCols,
        lastCascadeWaves,
        lastSealedCoords,
        lockDelayMs,
        selectedMiracleTier,
        activeBoardAnimation,
        lastHardDropTrail,
      } = state

      const wallNowMs = Date.now()
      if (triggeredEventsSetRef.current.size > 240) {
        triggeredEventsSetRef.current.clear()
      }

      const metrics = getStageViewportMetrics(currentStyle)
      const cellSize = metrics.cellSizePx
      const activeRows = metrics.activeRows
      const activeCols = metrics.activeCols
      const boardPixelWidth = activeCols * cellSize
      const boardPixelHeight = activeRows * cellSize
      const canvasW = metrics.canvasWidthPx
      const canvasH = metrics.canvasHeightPx

      if (canvas.width !== canvasW || canvas.height !== canvasH) {
        canvas.width = canvasW
        canvas.height = canvasH
      }

      const pulsePhase = nowMs * 0.001

      // Detect scenario shift to spawn majority-block-elimination fireworks
      if (totalStyleShiftsCount !== lastProcessedShiftRef.current) {
        lastProcessedShiftRef.current = totalStyleShiftsCount
        spawnTransitionPurgeFireworks(
          boardPixelWidth,
          boardPixelHeight,
          lastPurgedBlocksCount || 20
        )
      }

      // Detect new line-clear, column-clear, fruit-cascade or hole-seal events
      if (lastEventCounter !== lastProcessedEventRef.current) {
        lastProcessedEventRef.current = lastEventCounter
        if (lastClearedRows.length > 0) {
          spawnRowClearParticles(lastClearedRows, cellSize)
        }
        if (lastClearedCols.length > 0) {
          spawnColumnClearParticles(lastClearedCols, cellSize)
        }
        if (lastCascadeWaves.length > 0) {
          spawnFruitCascadeParticles(lastCascadeWaves, cellSize)
        }
        if (lastSealedCoords.length > 0) {
          spawnSealedCavityParticles(lastSealedCoords, cellSize)
        }
        if (currentCombo >= 12) {
          spawnLegendaryStreakFireworks(cellSize)
        }
      }

      const morphSignature = activePiece.isMorphed
        ? `${activePiece.type}_${activePiece.graceFloatMs && activePiece.graceFloatMs > 900 ? 'fresh' : 'settled'}`
        : ''
      if (
        morphSignature.endsWith('_fresh') &&
        lastMorphedPieceStateRef.current !== morphSignature
      ) {
        spawnMorphBurstParticles(activePiece, cellSize)
      }
      lastMorphedPieceStateRef.current = morphSignature

      // 1. Clear full logical canvas
      ctx.clearRect(0, 0, canvasW, canvasH)

      // 2. Draw outer background & proportional board well (100% uncut!)
      ctx.fillStyle = '#060b16'
      ctx.fillRect(0, 0, canvasW, canvasH)

      const boardGrad = ctx.createLinearGradient(
        LEFT_GUTTER,
        TOP_RULER,
        LEFT_GUTTER,
        TOP_RULER + boardPixelHeight
      )
      if (currentStyle === 'FRUIT_MATCH') {
        boardGrad.addColorStop(0, '#140b29')
        boardGrad.addColorStop(0.5, '#1b1035')
        boardGrad.addColorStop(1, '#231342')
      } else if (currentStyle === 'TACTILE_GRID') {
        boardGrad.addColorStop(0, '#06151c')
        boardGrad.addColorStop(0.5, '#092028')
        boardGrad.addColorStop(1, '#0c2b35')
      } else {
        boardGrad.addColorStop(0, '#091122')
        boardGrad.addColorStop(0.5, '#0b1528')
        boardGrad.addColorStop(1, '#0f1c36')
      }
      ctx.fillStyle = boardGrad
      ctx.fillRect(LEFT_GUTTER, TOP_RULER, boardPixelWidth, boardPixelHeight)

      const isInteractivePhase =
        currentPhase === 'PLAYING' ||
        currentPhase === 'MATH_MORPH' ||
        currentPhase === 'MATH_FILL_HOLE' ||
        currentPhase === 'PAUSED'

      let activeColsSet = new Set<number>()
      let classicActiveCells: Array<{ row: number; col: number }> = []
      let tactilePreviewCells: Array<{ row: number; col: number }> = []

      if (isInteractivePhase) {
        if (currentStyle === 'FRUIT_MATCH') {
          const focusCol = selectedFruitCell ? selectedFruitCell.col : fruitCursor.col
          activeColsSet = new Set<number>([focusCol])
        } else if (currentStyle === 'TACTILE_GRID') {
          const selectedOpt = tactileTray[selectedTraySlot]
          if (selectedOpt && !selectedOpt.isUsed) {
            tactilePreviewCells = getTactilePieceCells(
              selectedOpt.type,
              selectedOpt.rotation,
              tactileCursorCol,
              tactileCursorRow
            )
            activeColsSet = new Set<number>(tactilePreviewCells.map((c) => c.col))
          } else {
            activeColsSet = new Set<number>([tactileCursorCol])
          }
        } else {
          classicActiveCells = getPieceOccupiedCells(activePiece)
          activeColsSet = new Set<number>(classicActiveCells.map((c) => c.col))
        }
      }

      // 3. Draw column bands & Base-10 Grid Lines across the proportional stage
      for (let col = 0; col <= activeCols; col++) {
        const x = LEFT_GUTTER + col * cellSize

        if (col < activeCols && activeColsSet.has(col)) {
          ctx.fillStyle =
            currentStyle === 'FRUIT_MATCH'
              ? 'rgba(168, 85, 247, 0.08)'
              : currentStyle === 'TACTILE_GRID'
                ? 'rgba(16, 185, 129, 0.07)'
                : 'rgba(34, 211, 238, 0.05)'
          ctx.fillRect(x, TOP_RULER, cellSize, boardPixelHeight)
        }

        ctx.beginPath()
        ctx.moveTo(x, TOP_RULER)
        ctx.lineTo(x, TOP_RULER + boardPixelHeight)
        if (col === 5) {
          // Central Subitizing Axis 5 | 6 (5 + 5 = 10)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
          ctx.lineWidth = 2.0
        } else if (col === 0 || col === activeCols) {
          ctx.strokeStyle =
            currentStyle === 'TACTILE_GRID'
              ? 'rgba(52, 211, 153, 0.65)'
              : currentStyle === 'FRUIT_MATCH'
                ? 'rgba(192, 132, 252, 0.65)'
                : 'rgba(148, 163, 184, 0.45)'
          ctx.lineWidth = 1.8
        } else {
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.38)'
          ctx.lineWidth = 0.9
        }
        ctx.stroke()
      }

      for (let row = 0; row <= activeRows; row++) {
        const y = TOP_RULER + row * cellSize
        ctx.beginPath()
        ctx.moveTo(LEFT_GUTTER, y)
        ctx.lineTo(LEFT_GUTTER + boardPixelWidth, y)

        if (
          row === 5 &&
          topology.isDangerZone &&
          currentStyle === 'TETRIS_CLASSIC'
        ) {
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + 0.25 * Math.sin(pulsePhase * 5)})`
          ctx.lineWidth = 1.6
        } else if (row === 0 || row === activeRows) {
          ctx.strokeStyle =
            currentStyle === 'TACTILE_GRID'
              ? 'rgba(52, 211, 153, 0.65)'
              : currentStyle === 'FRUIT_MATCH'
                ? 'rgba(192, 132, 252, 0.65)'
                : 'rgba(148, 163, 184, 0.45)'
          ctx.lineWidth = 1.8
        } else if (row % 5 === 0) {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)'
          ctx.lineWidth = 1.3
        } else {
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)'
          ctx.lineWidth = 0.9
        }
        ctx.stroke()
      }

      // 4. Draw Top & Bottom Base-10 Column Rulers `1..10` + Vertical Complement Badges
      ctx.font = 'bold 12px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let col = 0; col < activeCols; col++) {
        const colNumber = col + 1
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const isActiveCol = activeColsSet.has(col)
        const isLeftFive = col < 5

        if (isActiveCol) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.22)'
          ctx.fillRect(LEFT_GUTTER + col * cellSize + 2, 4, cellSize - 4, TOP_RULER - 8)
          ctx.fillRect(
            LEFT_GUTTER + col * cellSize + 2,
            TOP_RULER + boardPixelHeight + 4,
            cellSize - 4,
            BOTTOM_RULER - 8
          )
        }

        ctx.fillStyle = isActiveCol
          ? '#67e8f9'
          : isLeftFive
            ? 'rgba(125, 211, 252, 0.82)'
            : 'rgba(110, 231, 183, 0.82)'

        // Top Ruler 1..10
        ctx.fillText(String(colNumber), xCenter, TOP_RULER * 0.5)

        // Bottom Ruler: In TACTILE_GRID, if colComplements[col] is 1..3, draw a glowing +1/+2/+3 badge!
        const missingInCol =
          currentStyle === 'TACTILE_GRID'
            ? tactileTopology.colComplements[col]
            : undefined

        if (missingInCol !== undefined && missingInCol >= 1 && missingInCol <= 3) {
          const bX = LEFT_GUTTER + col * cellSize + 2
          const bY = TOP_RULER + boardPixelHeight + 3
          const bW = cellSize - 4
          const bH = BOTTOM_RULER - 6

          ctx.save()
          ctx.fillStyle =
            missingInCol === 1
              ? 'rgba(251, 191, 36, 0.28)'
              : missingInCol === 2
                ? 'rgba(16, 185, 129, 0.24)'
                : 'rgba(14, 165, 233, 0.20)'
          ctx.strokeStyle =
            missingInCol === 1
              ? '#fbbf24'
              : missingInCol === 2
                ? '#34d399'
                : '#38bdf8'
          ctx.lineWidth = 1.3
          ctx.fillRect(bX, bY, bW, bH)
          ctx.strokeRect(bX, bY, bW, bH)

          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          ctx.fillStyle =
            missingInCol === 1
              ? '#fef08a'
              : missingInCol === 2
                ? '#6ee7b7'
                : '#7dd3fc'
          ctx.fillText(
            `+${missingInCol}`,
            xCenter,
            TOP_RULER + boardPixelHeight + BOTTOM_RULER * 0.5
          )
          ctx.restore()
        } else {
          ctx.fillText(
            String(colNumber),
            xCenter,
            TOP_RULER + boardPixelHeight + BOTTOM_RULER * 0.5
          )
        }
      }

      // Draw "5|5" subitizing marker on top and bottom axis divider
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(LEFT_GUTTER + 5 * cellSize, TOP_RULER - 2, 2.5, 0, Math.PI * 2)
      ctx.arc(
        LEFT_GUTTER + 5 * cellSize,
        TOP_RULER + boardPixelHeight + 2,
        2.5,
        0,
        Math.PI * 2
      )
      ctx.fill()

      // 5. Draw Left Gutter Row Markers & Right Gutter Base-10 Complement Badges (`+1, +2, +3`)
      const rowComplementsMap =
        currentStyle === 'TACTILE_GRID'
          ? tactileTopology.rowComplements
          : topology.rowComplements

      for (let row = 0; row < activeRows; row++) {
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5

        if (currentStyle === 'TETRIS_CLASSIC') {
          const stackLevelFromBottom = activeRows - row
          if (stackLevelFromBottom % 5 === 0) {
            ctx.font = '10px "JetBrains Mono", monospace'
            ctx.fillStyle =
              stackLevelFromBottom >= 15 && topology.isDangerZone
                ? '#fb7185'
                : 'rgba(148, 163, 184, 0.6)'
            ctx.textAlign = 'right'
            ctx.fillText(`${stackLevelFromBottom}`, LEFT_GUTTER - 6, yCenter)
          }
        } else {
          // Em modos 10×10 (FRUIT_MATCH e TACTILE_GRID), mostra o índice Base-10 da linha 1..10 na esquerda!
          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          ctx.fillStyle =
            row < 5 ? 'rgba(125, 211, 252, 0.72)' : 'rgba(110, 231, 183, 0.72)'
          ctx.textAlign = 'right'
          ctx.fillText(`L${row + 1}`, LEFT_GUTTER - 6, yCenter)
        }

        const missingCount =
          currentStyle === 'FRUIT_MATCH' ? undefined : rowComplementsMap[row]
        if (missingCount !== undefined && missingCount >= 1 && missingCount <= 3) {
          const badgeX = LEFT_GUTTER + boardPixelWidth + 6
          const badgeY = TOP_RULER + row * cellSize + 4
          const badgeW = RIGHT_GUTTER - 10
          const badgeH = cellSize - 8

          ctx.fillStyle =
            missingCount === 1
              ? 'rgba(251, 191, 36, 0.08)'
              : missingCount === 2
                ? 'rgba(52, 211, 153, 0.06)'
                : 'rgba(56, 189, 248, 0.05)'
          ctx.fillRect(LEFT_GUTTER, TOP_RULER + row * cellSize, boardPixelWidth, cellSize)

          ctx.fillStyle =
            missingCount === 1
              ? 'rgba(251, 191, 36, 0.22)'
              : missingCount === 2
                ? 'rgba(16, 185, 129, 0.20)'
                : 'rgba(14, 165, 233, 0.18)'
          ctx.strokeStyle =
            missingCount === 1
              ? '#fbbf24'
              : missingCount === 2
                ? '#34d399'
                : '#38bdf8'
          ctx.lineWidth = 1.3
          ctx.fillRect(badgeX, badgeY, badgeW, badgeH)
          ctx.strokeRect(badgeX, badgeY, badgeW, badgeH)

          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          ctx.fillStyle =
            missingCount === 1
              ? '#fef08a'
              : missingCount === 2
                ? '#6ee7b7'
                : '#7dd3fc'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`+${missingCount}`, badgeX + badgeW * 0.5, yCenter)
        }
      }

      // 6. Draw Active Board Cells + Multi-Wave Cinematic Choreographies (Fruit Swap/Break/Fall, Line Clear Collapse, Tactile Domino Shatter)
      const isEnteringFruit =
        isStyleTransitioning &&
        styleTransitionRemainingMs > 0 &&
        (styleTransitionTo ?? currentStyle) === 'FRUIT_MATCH'
      const transitionProgress =
        isStyleTransitioning && styleTransitionRemainingMs > 0
          ? Math.max(
              0,
              Math.min(1, 1 - styleTransitionRemainingMs / STYLE_TRANSITION_DURATION_MS)
            )
          : 1
      const isInvalidBounceActive = wallNowMs < invalidSwapBounceUntil

      const activeAnim =
        !isEnteringFruit &&
        activeBoardAnimation !== null &&
        activeBoardAnimation.style === currentStyle &&
        wallNowMs >= activeBoardAnimation.startedAtMs &&
        wallNowMs - activeBoardAnimation.startedAtMs < activeBoardAnimation.totalDurationMs
          ? activeBoardAnimation
          : null
      const animElapsedMs = activeAnim ? wallNowMs - activeAnim.startedAtMs : 0

      // Clip board well so falling top-refill fruits (fromRow < 0) enter cleanly from the top border without overlapping Top Ruler
      ctx.save()
      ctx.beginPath()
      ctx.rect(LEFT_GUTTER, TOP_RULER, boardPixelWidth, boardPixelHeight)
      ctx.clip()

      if (
        activeAnim &&
        (activeAnim.kind === 'FRUIT_SWAP_CASCADE' ||
          activeAnim.kind === 'FRUIT_MAGNET_CASCADE') &&
        activeAnim.waves &&
        activeAnim.waveTimings &&
        activeAnim.waves.length > 0 &&
        activeAnim.waveTimings.length > 0
      ) {
        const swapDur = activeAnim.swapDurationMs ?? 0

        if (
          activeAnim.kind === 'FRUIT_SWAP_CASCADE' &&
          swapDur > 0 &&
          animElapsedMs < swapDur &&
          activeAnim.preSwapGrid &&
          activeAnim.swapFrom &&
          activeAnim.swapTo
        ) {
          // PHASE 6A-1: Physical Fruit Swap Slide (170ms) before Wave 1 breaks!
          const swapT = easeInOutCubic(Math.max(0, Math.min(1, animElapsedMs / swapDur)))
          const fromCoord = activeAnim.swapFrom
          const toCoord = activeAnim.swapTo

          for (let row = 0; row < activeRows; row++) {
            const rowCells = activeAnim.preSwapGrid[row]
            if (!rowCells) continue
            for (let col = 0; col < activeCols; col++) {
              const cell = rowCells[col]
              if (!cell) continue

              let offsetX = 0
              let offsetY = 0
              let scale = 1
              let flash = 0

              if (row === fromCoord.row && col === fromCoord.col) {
                offsetX = (toCoord.col - fromCoord.col) * cellSize * swapT
                offsetY = (toCoord.row - fromCoord.row) * cellSize * swapT
                scale = 1 + 0.16 * Math.sin(swapT * Math.PI)
                flash = 0.35 * Math.sin(swapT * Math.PI)
              } else if (row === toCoord.row && col === toCoord.col) {
                offsetX = (fromCoord.col - toCoord.col) * cellSize * swapT
                offsetY = (fromCoord.row - toCoord.row) * cellSize * swapT
                scale = 1 - 0.08 * Math.sin(swapT * Math.PI)
                flash = 0.25 * Math.sin(swapT * Math.PI)
              }

              drawGridBlock(
                ctx,
                col,
                row,
                cell,
                pulsePhase,
                currentStyle,
                cellSize,
                false,
                offsetX,
                offsetY,
                { scaleX: scale, scaleY: scale, flashIntensity: flash }
              )
            }
          }
        } else {
          // PHASE 6A-2: Sequential Multi-Wave Cascade (Swell/Crack/Break -> Empty Space -> Gravity Fall -> Auto Wave 2+)
          let activeWaveIdx = activeAnim.waveTimings.findIndex(
            (wt) => animElapsedMs >= wt.shatterStartMs && animElapsedMs < wt.gravityEndMs
          )
          if (activeWaveIdx === -1) {
            activeWaveIdx = activeAnim.waveTimings.length - 1
          }

          const wave = activeAnim.waves[activeWaveIdx]
          const timing = activeAnim.waveTimings[activeWaveIdx]

          if (wave && timing) {
            const isShatterSubphase = animElapsedMs < timing.gravityStartMs

            if (isShatterSubphase) {
              // Sub-stage: Matched 3+ fruits swell, crack, and shatter into 4 flying 2D shards leaving visible EMPTY SPACE!
              const shatterSpan = Math.max(1, timing.gravityStartMs - timing.shatterStartMs)
              const shatterT = Math.max(
                0,
                Math.min(1, (animElapsedMs - timing.shatterStartMs) / shatterSpan)
              )

              const poppedSet = new Set(
                wave.poppedCells.map((p) => `${p.row},${p.col}`)
              )
              const waveGrid = wave.prePopGrid ?? grid

              // Trigger physical 2D shard explosion once when the cracks reach critical fracture (shatterT >= 0.54)
              const shatterEventKey = `${activeAnim.id}_w${activeWaveIdx}_shatter`
              if (
                shatterT >= 0.54 &&
                !triggeredEventsSetRef.current.has(shatterEventKey)
              ) {
                triggeredEventsSetRef.current.add(shatterEventKey)

                let sumX = 0
                let sumY = 0
                for (const p of wave.poppedCells) {
                  const fruitDef = FRUIT_CATALOG[p.kind]
                  spawnBlockShatterShards(
                    p.col,
                    p.row,
                    cellSize,
                    fruitDef.color,
                    fruitDef.borderColor,
                    fruitDef.glowColor,
                    fruitDef.symbol,
                    fruitDef.emoji
                  )
                  sumX += LEFT_GUTTER + p.col * cellSize + cellSize * 0.5
                  sumY += TOP_RULER + p.row * cellSize + cellSize * 0.5
                }

                if (wave.poppedCells.length > 0) {
                  const cx = sumX / wave.poppedCells.length
                  const cy = sumY / wave.poppedCells.length
                  pushBoundedShockwave({
                    x: cx,
                    y: cy,
                    radius: cellSize * 0.35,
                    maxRadius: cellSize * (1.7 + Math.min(2.2, wave.poppedCells.length * 0.2)),
                    color: activeWaveIdx > 0 ? '#fbbf24' : '#38bdf8',
                    alpha: 0.95,
                    lineWidth: activeWaveIdx > 0 ? 3.4 : 2.6,
                  })
                  pushBoundedCallout({
                    x: Math.max(
                      LEFT_GUTTER + 85,
                      Math.min(LEFT_GUTTER + boardPixelWidth - 85, cx)
                    ),
                    y: Math.max(TOP_RULER + 28, cy - 10),
                    vy: -1.15,
                    text:
                      activeWaveIdx === 0
                        ? `💥 QUEBROU ${wave.poppedCells.length}!`
                        : `⚡ COMBO AUTOMÁTICO ×${activeWaveIdx + 1}! (+${wave.poppedCells.length})`,
                    color: activeWaveIdx === 0 ? '#fef08a' : '#67e8f9',
                    borderColor: activeWaveIdx === 0 ? '#f59e0b' : '#a855f7',
                    alpha: 1,
                    scale: activeWaveIdx > 0 ? 1.12 : 1.0,
                    decay: 0.018,
                  })
                }
              }

              for (let row = 0; row < activeRows; row++) {
                const rowCells = waveGrid[row]
                if (!rowCells) continue
                for (let col = 0; col < activeCols; col++) {
                  const cell = rowCells[col]
                  if (!cell) continue

                  const isPopping = poppedSet.has(`${row},${col}`)
                  if (!isPopping) {
                    drawGridBlock(
                      ctx,
                      col,
                      row,
                      cell,
                      pulsePhase,
                      currentStyle,
                      cellSize,
                      false
                    )
                    continue
                  }

                  if (shatterT < 0.58) {
                    // Swelling + shaking + cracking before breaking apart
                    const localCrackT = shatterT / 0.58
                    const swell = 1 + 0.24 * Math.sin(localCrackT * Math.PI * 0.85)
                    const jitterX = Math.sin(localCrackT * 42 + col) * 3.5
                    const jitterY = Math.cos(localCrackT * 38 + row) * 2.5

                    drawGridBlock(
                      ctx,
                      col,
                      row,
                      cell,
                      pulsePhase,
                      currentStyle,
                      cellSize,
                      false,
                      jitterX,
                      jitterY,
                      {
                        scaleX: swell,
                        scaleY: swell,
                        flashIntensity: localCrackT * 0.9,
                        fractureProgress: Math.min(1, localCrackT * 1.15),
                      }
                    )
                  } else {
                    // 0.58 <= shatterT <= 1.0: Block has shattered into shards! Draw visible empty socket flash
                    const emptyFade = 1 - (shatterT - 0.58) / 0.42
                    const sx = LEFT_GUTTER + col * cellSize
                    const sy = TOP_RULER + row * cellSize
                    ctx.save()
                    ctx.strokeStyle = `rgba(254, 240, 138, ${0.55 * emptyFade})`
                    ctx.lineWidth = 1.8
                    ctx.setLineDash([4, 3])
                    drawRoundedRectPath(ctx, sx + 6, sy + 6, cellSize - 12, cellSize - 12, 8)
                    ctx.stroke()
                    ctx.restore()
                  }
                }
              }
            } else {
              // Sub-stage: Surviving fruits physically fall down into the empty spaces + new fruits drop from top!
              const fallSpan = Math.max(1, timing.gravityEndMs - timing.gravityStartMs)
              const fallT = Math.max(
                0,
                Math.min(1, (animElapsedMs - timing.gravityStartMs) / fallSpan)
              )

              const postGravGrid = wave.postGravityGrid ?? grid
              const motions = wave.fallingMotions ?? []
              const movingTargets = new Map<string, (typeof motions)[number]>()
              for (const m of motions) {
                movingTargets.set(`${m.toRow},${m.col}`, m)
              }

              for (let row = 0; row < activeRows; row++) {
                const rowCells = postGravGrid[row]
                if (!rowCells) continue
                for (let col = 0; col < activeCols; col++) {
                  const cell = rowCells[col]
                  if (!cell) continue

                  const motion = movingTargets.get(`${row},${col}`)
                  if (!motion) {
                    drawGridBlock(
                      ctx,
                      col,
                      row,
                      cell,
                      pulsePhase,
                      currentStyle,
                      cellSize,
                      false
                    )
                    continue
                  }

                  // Stagger upper rows & newly spawned top fruits slightly so lower fruits start falling first
                  const stagger = Math.min(
                    0.24,
                    (activeRows - 1 - motion.toRow) * 0.018 +
                      (motion.isNewSpawn ? 0.06 : 0)
                  )
                  const localFallT = Math.max(
                    0,
                    Math.min(1, (fallT - stagger) / Math.max(0.15, 1 - stagger))
                  )

                  let offsetY = 0
                  let scaleX = 1
                  let scaleY = 1
                  let flash = 0

                  if (localFallT < 0.82) {
                    // Accelerated gravity fall from fromRow -> toRow
                    const dropNorm = localFallT / 0.82
                    const accelT = dropNorm * dropNorm * (2.1 - 1.1 * dropNorm)
                    const currentRowPos =
                      motion.fromRow + (motion.toRow - motion.fromRow) * accelT
                    offsetY = (currentRowPos - motion.toRow) * cellSize
                    scaleX = 0.94
                    scaleY = 1.07
                  } else {
                    // Landing impact bounce & squash-and-stretch!
                    const bounceNorm = (localFallT - 0.82) / 0.18
                    const squash = Math.sin(bounceNorm * Math.PI) * 0.15
                    offsetY = -Math.sin(bounceNorm * Math.PI) * 3.5
                    scaleX = 1 + squash
                    scaleY = 1 - squash
                    flash = Math.sin(bounceNorm * Math.PI) * 0.22
                  }

                  drawGridBlock(
                    ctx,
                    col,
                    row,
                    cell,
                    pulsePhase,
                    currentStyle,
                    cellSize,
                    false,
                    0,
                    offsetY,
                    { scaleX, scaleY, flashIntensity: flash }
                  )
                }
              }
            }
          }
        }
      } else if (
        activeAnim &&
        activeAnim.kind === 'CLASSIC_LINE_CLEAR' &&
        activeAnim.preClearGrid &&
        activeAnim.clearedRows &&
        activeAnim.clearedRows.length > 0
      ) {
        // PHASE 6B: TETRIS_CLASSIC Line-Clear Laser Sweep + Shatter + Upper-Stack Gravity Collapse!
        const laserSplitMs = 205
        const clearedRowSet = new Set(activeAnim.clearedRows)

        if (animElapsedMs < laserSplitMs) {
          // Sub-stage B1 (0..205ms): Horizontal Laser Sweep & Block Cracking/Shatter
          const laserT = Math.max(0, Math.min(1, animElapsedMs / laserSplitMs))
          const preGrid = activeAnim.preClearGrid

          for (let row = 0; row < activeRows; row++) {
            const rowCells = preGrid[row]
            if (!rowCells) continue
            const isRowClearing = clearedRowSet.has(row)

            for (let col = 0; col < activeCols; col++) {
              const cell = rowCells[col]
              if (!cell) continue

              if (!isRowClearing) {
                drawGridBlock(
                  ctx,
                  col,
                  row,
                  cell,
                  pulsePhase,
                  currentStyle,
                  cellSize,
                  false
                )
                continue
              }

              const colReachT = Math.max(
                0,
                Math.min(1, laserT * 1.35 - (col / activeCols) * 0.35)
              )
              const cellEventKey = `${activeAnim.id}_r${row}_c${col}`

              if (colReachT >= 0.65 && !triggeredEventsSetRef.current.has(cellEventKey)) {
                triggeredEventsSetRef.current.add(cellEventKey)
                spawnBlockShatterShards(
                  col,
                  row,
                  cellSize,
                  cell.color,
                  cell.borderColor ?? '#fef08a',
                  cell.glowColor,
                  cell.symbol
                )
              }

              if (colReachT < 0.68) {
                const crackNorm = colReachT / 0.68
                const swell = 1 + 0.18 * crackNorm
                drawGridBlock(
                  ctx,
                  col,
                  row,
                  cell,
                  pulsePhase,
                  currentStyle,
                  cellSize,
                  false,
                  0,
                  0,
                  {
                    scaleX: swell,
                    scaleY: swell,
                    flashIntensity: crackNorm * 0.92,
                    fractureProgress: crackNorm,
                  }
                )
              }
            }
          }

          // Draw horizontal neon laser beam across each cleared row
          ctx.save()
          for (const cRow of activeAnim.clearedRows) {
            const beamY = TOP_RULER + cRow * cellSize + cellSize * 0.5
            const beamW = boardPixelWidth * Math.min(1, laserT * 1.25)
            const beamGrad = ctx.createLinearGradient(
              LEFT_GUTTER,
              beamY,
              LEFT_GUTTER + beamW,
              beamY
            )
            beamGrad.addColorStop(0, 'rgba(34, 211, 238, 0.15)')
            beamGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.85)')
            beamGrad.addColorStop(1, '#ffffff')

            ctx.fillStyle = beamGrad
            ctx.shadowColor = '#22d3ee'
            ctx.shadowBlur = 14
            ctx.fillRect(LEFT_GUTTER, beamY - 4, beamW, 8)
          }
          ctx.restore()
        } else {
          // Sub-stage B2 (205..450ms): Surviving upper stack physically falls down into cleared rows!
          const fallT = Math.max(
            0,
            Math.min(
              1,
              (animElapsedMs - laserSplitMs) /
                Math.max(1, activeAnim.totalDurationMs - laserSplitMs)
            )
          )
          const preGrid = activeAnim.preClearGrid
          const dropDistances = activeAnim.rowDropDistances ?? {}

          for (let origRow = 0; origRow < activeRows; origRow++) {
            if (clearedRowSet.has(origRow)) continue
            const rowCells = preGrid[origRow]
            if (!rowCells) continue

            const dropRows = dropDistances[origRow] ?? 0
            const destRow = origRow + dropRows

            for (let col = 0; col < activeCols; col++) {
              const cell = rowCells[col]
              if (!cell) continue

              let offsetY = 0
              let scaleX = 1
              let scaleY = 1

              if (dropRows > 0) {
                if (fallT < 0.8) {
                  const dropNorm = fallT / 0.8
                  const accel = dropNorm * dropNorm * (2.1 - 1.1 * dropNorm)
                  offsetY = (origRow - destRow) * cellSize * (1 - accel)
                  scaleX = 0.96
                  scaleY = 1.05
                } else {
                  const bounceNorm = (fallT - 0.8) / 0.2
                  const squash = Math.sin(bounceNorm * Math.PI) * 0.12
                  offsetY = -Math.sin(bounceNorm * Math.PI) * 2.5
                  scaleX = 1 + squash
                  scaleY = 1 - squash
                }
              }

              drawGridBlock(
                ctx,
                col,
                destRow,
                cell,
                pulsePhase,
                currentStyle,
                cellSize,
                false,
                0,
                offsetY,
                { scaleX, scaleY }
              )
            }
          }
        }
      } else if (
        activeAnim &&
        activeAnim.kind === 'TACTILE_PLACE_AND_CLEAR' &&
        activeAnim.preClearGrid &&
        ((activeAnim.clearedRows?.length ?? 0) > 0 ||
          (activeAnim.clearedCols?.length ?? 0) > 0)
      ) {
        // PHASE 6C: TACTILE_GRID Spring-Pop Placement + 10/10 Energy Connection + Sequential Domino Shatter!
        const preGrid = activeAnim.preClearGrid
        const placedSet = new Set(
          (activeAnim.placedCells ?? []).map((c) => `${c.row},${c.col}`)
        )
        const clearedRowSet = new Set(activeAnim.clearedRows ?? [])
        const clearedColSet = new Set(activeAnim.clearedCols ?? [])

        // Spawn Golden Crossroad dual shockwave once if simultaneous H×V clear!
        const crossroadKey = `${activeAnim.id}_crossroad`
        if (
          activeAnim.isCrossClear &&
          !triggeredEventsSetRef.current.has(crossroadKey)
        ) {
          triggeredEventsSetRef.current.add(crossroadKey)
          const cRow = activeAnim.clearedRows?.[0] ?? 4
          const cCol = activeAnim.clearedCols?.[0] ?? 4
          const cx = LEFT_GUTTER + cCol * cellSize + cellSize * 0.5
          const cy = TOP_RULER + cRow * cellSize + cellSize * 0.5
          pushBoundedShockwave({
            x: cx,
            y: cy,
            radius: cellSize * 0.3,
            maxRadius: cellSize * 4.5,
            color: '#fbbf24',
            alpha: 1,
            lineWidth: 3.8,
          })
          pushBoundedCallout({
            x: Math.max(
              LEFT_GUTTER + 95,
              Math.min(LEFT_GUTTER + boardPixelWidth - 95, cx)
            ),
            y: Math.max(TOP_RULER + 30, cy - 12),
            vy: -1.1,
            text: '✚ CRUZAMENTO DOURADO 10×10!',
            color: '#fef08a',
            borderColor: '#f59e0b',
            alpha: 1,
            scale: 1.15,
            decay: 0.017,
          })
        }

        // Draw 10/10 energy connection beam behind completing rows/cols
        ctx.save()
        const beamAlpha = Math.max(0, 1 - animElapsedMs / activeAnim.totalDurationMs) * 0.36
        ctx.fillStyle = activeAnim.isCrossClear
          ? `rgba(251, 191, 36, ${beamAlpha})`
          : `rgba(16, 185, 129, ${beamAlpha})`
        for (const r of clearedRowSet) {
          ctx.fillRect(LEFT_GUTTER, TOP_RULER + r * cellSize, boardPixelWidth, cellSize)
        }
        for (const c of clearedColSet) {
          ctx.fillRect(LEFT_GUTTER + c * cellSize, TOP_RULER, cellSize, boardPixelHeight)
        }
        ctx.restore()

        for (let row = 0; row < activeRows; row++) {
          const rowCells = preGrid[row]
          if (!rowCells) continue
          for (let col = 0; col < activeCols; col++) {
            const cell = rowCells[col]
            if (!cell) continue

            const isClearingCell = clearedRowSet.has(row) || clearedColSet.has(col)
            const isPlacedCell = placedSet.has(`${row},${col}`)

            if (!isClearingCell) {
              let scale = 1
              if (isPlacedCell && animElapsedMs < 200) {
                scale = easeOutBack(Math.min(1, animElapsedMs / 200))
              }
              drawGridBlock(
                ctx,
                col,
                row,
                cell,
                pulsePhase,
                currentStyle,
                cellSize,
                false,
                0,
                0,
                { scaleX: scale, scaleY: scale }
              )
              continue
            }

            // Domino wave delay across the 10 cells of the row/col
            const dominoIdx = clearedRowSet.has(row) ? col : row
            const dominoStartMs = 95 + dominoIdx * 24
            const dominoCrackSpanMs = 115
            const localDominoT = Math.max(
              0,
              Math.min(1, (animElapsedMs - dominoStartMs) / dominoCrackSpanMs)
            )

            const shardKey = `${activeAnim.id}_tactile_${row}_${col}`
            if (localDominoT >= 0.72 && !triggeredEventsSetRef.current.has(shardKey)) {
              triggeredEventsSetRef.current.add(shardKey)
              spawnBlockShatterShards(
                col,
                row,
                cellSize,
                cell.color,
                cell.borderColor ?? '#34d399',
                cell.glowColor,
                cell.symbol
              )
            }

            if (localDominoT < 0.75) {
              const crackNorm = localDominoT / 0.75
              const popScale =
                isPlacedCell && animElapsedMs < 110
                  ? easeOutBack(Math.min(1, animElapsedMs / 110))
                  : 1 + 0.18 * crackNorm

              drawGridBlock(
                ctx,
                col,
                row,
                cell,
                pulsePhase,
                currentStyle,
                cellSize,
                false,
                0,
                0,
                {
                  scaleX: popScale,
                  scaleY: popScale,
                  flashIntensity: 0.25 + crackNorm * 0.75,
                  fractureProgress: crackNorm,
                }
              )
            }
          }
        }
      } else {
        // Default Board Render + Placement Spring-Pop (`TACTILE_PLACE_AND_CLEAR` without clear) + Piece Lock Squish (`CLASSIC_PIECE_LOCK`) + Invalid Swap Slide-and-Return
        const lockedSet = new Set(
          activeAnim?.kind === 'CLASSIC_PIECE_LOCK' && activeAnim.lockedCells
            ? activeAnim.lockedCells.map((c) => `${c.row},${c.col}`)
            : []
        )
        const placedSet = new Set(
          activeAnim?.kind === 'TACTILE_PLACE_AND_CLEAR' && activeAnim.placedCells
            ? activeAnim.placedCells.map((c) => `${c.row},${c.col}`)
            : []
        )

        for (let row = 0; row < activeRows; row++) {
          const rowCells = grid[row]
          if (!rowCells) continue
          for (let col = 0; col < activeCols; col++) {
            const cell = rowCells[col]
            if (!cell) continue

            const isSelectedFruit =
              currentStyle === 'FRUIT_MATCH' &&
              selectedFruitCell !== null &&
              selectedFruitCell.row === row &&
              selectedFruitCell.col === col

            let offsetX = 0
            let offsetY = 0
            let scaleX = 1
            let scaleY = 1
            let flashIntensity = 0

            if (isEnteringFruit) {
              const cellDelay = (col * 0.04 + (activeRows - 1 - row) * 0.03) * 0.45
              const localT = Math.max(
                0,
                Math.min(1, (transitionProgress - cellDelay) / (1 - cellDelay))
              )
              offsetY = -(1 - easeOutCubic(localT)) * (boardPixelHeight * 0.45)
            } else if (isInvalidBounceActive && lastSwappedCells) {
              // Bidirectional slide-and-return elastic bounce on invalid fruit swap!
              const [cA, cB] = lastSwappedCells
              const remMs = Math.max(0, invalidSwapBounceUntil - wallNowMs)
              const bounceT = Math.max(0, Math.min(1, (360 - remMs) / 360))
              const slideRatio = Math.sin(bounceT * Math.PI) * 0.72

              if (cA.row === row && cA.col === col) {
                offsetX = (cB.col - cA.col) * cellSize * slideRatio
                offsetY = (cB.row - cA.row) * cellSize * slideRatio
                flashIntensity = Math.sin(bounceT * Math.PI) * 0.45
              } else if (cB.row === row && cB.col === col) {
                offsetX = (cA.col - cB.col) * cellSize * slideRatio
                offsetY = (cA.row - cB.row) * cellSize * slideRatio
                flashIntensity = Math.sin(bounceT * Math.PI) * 0.45
              }
            } else if (activeAnim && lockedSet.has(`${row},${col}`)) {
              // Classic Tetromino Lock landing squish
              const lockT = Math.max(
                0,
                Math.min(1, animElapsedMs / activeAnim.totalDurationMs)
              )
              const squish = Math.sin(lockT * Math.PI) * 0.16
              scaleX = 1 + squish
              scaleY = 1 - squish
              flashIntensity = (1 - lockT) * 0.45
            } else if (activeAnim && placedSet.has(`${row},${col}`)) {
              // Tactile Polyomino Placement spring-pop
              const placeT = Math.max(
                0,
                Math.min(1, animElapsedMs / activeAnim.totalDurationMs)
              )
              const popScale = 0.55 + 0.45 * easeOutBack(placeT)
              scaleX = popScale
              scaleY = popScale
              flashIntensity = (1 - placeT) * 0.5
            }

            drawGridBlock(
              ctx,
              col,
              row,
              cell,
              pulsePhase,
              currentStyle,
              cellSize,
              isSelectedFruit,
              offsetX,
              offsetY,
              { scaleX, scaleY, flashIntensity }
            )
          }
        }
      }

      ctx.restore()

      // 7. Draw Target Reticles: Buried Cavities (`TETRIS_CLASSIC`), Golden Crossroads (`TACTILE_GRID`), or Best Swap Hint (`FRUIT_MATCH`)
      if (currentStyle === 'FRUIT_MATCH') {
        const bestSwap = fruitOracle.bestSwap
        if (bestSwap) {
          const pulse = 0.55 + 0.45 * Math.sin(pulsePhase * 5)
          const x1 = LEFT_GUTTER + bestSwap.from.col * cellSize + cellSize * 0.5
          const y1 = TOP_RULER + bestSwap.from.row * cellSize + cellSize * 0.5
          const x2 = LEFT_GUTTER + bestSwap.to.col * cellSize + cellSize * 0.5
          const y2 = TOP_RULER + bestSwap.to.row * cellSize + cellSize * 0.5

          ctx.save()
          ctx.strokeStyle = `rgba(254, 240, 138, ${0.55 + 0.4 * pulse})`
          ctx.lineWidth = 3
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)'
          ctx.shadowBlur = 10
          ctx.setLineDash([5, 4])
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.setLineDash([])

          // Small badge "⇄ 3+" at midpoint of the suggested swap
          const midX = (x1 + x2) * 0.5
          const midY = (y1 + y2) * 0.5
          ctx.fillStyle = 'rgba(120, 53, 15, 0.92)'
          ctx.strokeStyle = '#fbbf24'
          ctx.lineWidth = 1.4
          drawRoundedRectPath(ctx, midX - 18, midY - 9, 36, 18, 6)
          ctx.fill()
          ctx.stroke()

          ctx.shadowBlur = 0
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace'
          ctx.fillStyle = '#fef08a'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('⇄ 3+', midX, midY)
          ctx.restore()
        }
      } else if (currentStyle === 'TACTILE_GRID') {
        if (tactileTopology.goldenCrossroads.length > 0) {
          const pulse = 0.55 + 0.45 * Math.sin(pulsePhase * 4.5)
          for (const cross of tactileTopology.goldenCrossroads) {
            if (cross.row >= activeRows || grid[cross.row]?.[cross.col] !== null) continue
            const x = LEFT_GUTTER + cross.col * cellSize
            const y = TOP_RULER + cross.row * cellSize

            ctx.save()
            ctx.fillStyle = `rgba(251, 191, 36, ${0.15 + 0.12 * pulse})`
            ctx.fillRect(x + 3, y + 3, cellSize - 6, cellSize - 6)

            ctx.strokeStyle = `rgba(251, 191, 36, ${0.7 + 0.3 * pulse})`
            ctx.lineWidth = 1.8
            ctx.setLineDash([5, 3])
            ctx.strokeRect(x + 4, y + 4, cellSize - 8, cellSize - 8)
            ctx.setLineDash([])

            ctx.fillStyle = '#fde047'
            ctx.font = 'bold 15px "JetBrains Mono", monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('✚', x + cellSize * 0.5, y + cellSize * 0.5)
            ctx.restore()
          }
        }
      } else if (topology.buriedCavities.length > 0) {
        const pulse = 0.55 + 0.45 * Math.sin(pulsePhase * 4.5)
        const miracleMaxToSeal =
          selectedMiracleTier === 4
            ? 200
            : selectedMiracleTier === 3
              ? 10
              : selectedMiracleTier === 2
                ? 5
                : 3
        topology.buriedCavities.forEach((cavity, idx) => {
          const x = LEFT_GUTTER + cavity.col * cellSize
          const y = TOP_RULER + cavity.row * cellSize
          const isPrimaryTarget = idx < miracleMaxToSeal

          ctx.save()
          ctx.fillStyle = isPrimaryTarget
            ? `rgba(251, 191, 36, ${0.14 + 0.12 * pulse})`
            : 'rgba(245, 158, 11, 0.08)'
          ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4)

          ctx.strokeStyle = isPrimaryTarget
            ? `rgba(251, 191, 36, ${0.65 + 0.35 * pulse})`
            : 'rgba(251, 191, 36, 0.38)'
          ctx.lineWidth = isPrimaryTarget ? 1.6 : 1
          ctx.setLineDash([4, 3])
          ctx.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6)
          ctx.setLineDash([])

          ctx.fillStyle = isPrimaryTarget ? '#fde047' : 'rgba(253, 224, 71, 0.65)'
          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            idx === 0 ? '✦[B]' : '✦',
            x + cellSize * 0.5,
            y + cellSize * 0.5
          )
          ctx.restore()
        })
      }

      // 8. Polymorphic Interactive Layer: Fruit Swap Cursor & Neighbors / Tactile Macro-Preview / Classic Tetromino
      if (isInteractivePhase) {
        const isBulletTime =
          currentPhase === 'MATH_MORPH' || currentPhase === 'MATH_FILL_HOLE'

        if (currentStyle === 'FRUIT_MATCH') {
          // Draw keyboard/hover cursor reticle
          const curX = LEFT_GUTTER + fruitCursor.col * cellSize
          const curY = TOP_RULER + fruitCursor.row * cellSize
          ctx.save()
          ctx.strokeStyle = selectedFruitCell
            ? '#fef08a'
            : 'rgba(103, 232, 249, 0.85)'
          ctx.lineWidth = 2.4
          ctx.setLineDash([6, 4])
          drawRoundedRectPath(ctx, curX + 2, curY + 2, cellSize - 4, cellSize - 4, 10)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()

          // If a fruit cell is selected for swapping, highlight its 4 orthogonal neighbors with swap arrows!
          if (selectedFruitCell) {
            const selX = LEFT_GUTTER + selectedFruitCell.col * cellSize
            const selY = TOP_RULER + selectedFruitCell.row * cellSize
            ctx.save()
            ctx.strokeStyle = '#fef08a'
            ctx.lineWidth = 3.2
            ctx.shadowColor = 'rgba(251, 191, 36, 0.95)'
            ctx.shadowBlur = 14
            drawRoundedRectPath(
              ctx,
              selX + 1.5,
              selY + 1.5,
              cellSize - 3,
              cellSize - 3,
              10
            )
            ctx.stroke()

            const neighborDirs: ReadonlyArray<{
              dr: number
              dc: number
              arrow: string
            }> = [
              { dr: -1, dc: 0, arrow: '↑' },
              { dr: 1, dc: 0, arrow: '↓' },
              { dr: 0, dc: -1, arrow: '←' },
              { dr: 0, dc: 1, arrow: '→' },
            ]

            for (const { dr, dc, arrow } of neighborDirs) {
              const nr = selectedFruitCell.row + dr
              const nc = selectedFruitCell.col + dc
              if (
                nr < 0 ||
                nr >= FRUIT_GRID_ROWS ||
                nc < 0 ||
                nc >= FRUIT_GRID_COLS
              ) {
                continue
              }
              const nx = LEFT_GUTTER + nc * cellSize
              const ny = TOP_RULER + nr * cellSize

              ctx.shadowBlur = 6
              ctx.shadowColor = 'rgba(34, 211, 238, 0.8)'
              ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)'
              ctx.lineWidth = 2.2
              drawRoundedRectPath(
                ctx,
                nx + 3,
                ny + 3,
                cellSize - 6,
                cellSize - 6,
                9
              )
              ctx.stroke()

              ctx.shadowBlur = 0
              ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
              ctx.beginPath()
              ctx.arc(nx + cellSize * 0.5, ny + 10, 8, 0, Math.PI * 2)
              ctx.fill()

              ctx.font = 'bold 11px "JetBrains Mono", monospace'
              ctx.fillStyle = '#fef08a'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(arrow, nx + cellSize * 0.5, ny + 10)
            }
            ctx.restore()
          }
        } else if (currentStyle === 'TACTILE_GRID') {
          const selectedOpt = tactileTray[selectedTraySlot]
          if (selectedOpt && !selectedOpt.isUsed) {
            const def = getPieceDefinition(selectedOpt.type)
            const isValidPlacement = canPlaceTactilePieceAt(
              grid,
              selectedOpt.type,
              selectedOpt.rotation,
              tactileCursorCol,
              tactileCursorRow
            )

            // Predictive Row/Column Completion Glow when hovering a valid placement!
            if (isValidPlacement && tactilePreviewCells.length > 0) {
              const previewSet = new Set(
                tactilePreviewCells.map((c) => `${c.row},${c.col}`)
              )
              ctx.save()
              for (let r = 0; r < activeRows; r++) {
                let rowWillComplete = true
                for (let c = 0; c < activeCols; c++) {
                  if (grid[r]?.[c] === null && !previewSet.has(`${r},${c}`)) {
                    rowWillComplete = false
                    break
                  }
                }
                if (rowWillComplete) {
                  ctx.fillStyle = 'rgba(251, 191, 36, 0.22)'
                  ctx.fillRect(
                    LEFT_GUTTER,
                    TOP_RULER + r * cellSize,
                    boardPixelWidth,
                    cellSize
                  )
                }
              }

              for (let c = 0; c < activeCols; c++) {
                let colWillComplete = true
                for (let r = 0; r < activeRows; r++) {
                  if (grid[r]?.[c] === null && !previewSet.has(`${r},${c}`)) {
                    colWillComplete = false
                    break
                  }
                }
                if (colWillComplete) {
                  ctx.fillStyle = 'rgba(251, 191, 36, 0.22)'
                  ctx.fillRect(
                    LEFT_GUTTER + c * cellSize,
                    TOP_RULER,
                    cellSize,
                    boardPixelHeight
                  )
                }
              }
              ctx.restore()
            }

            ctx.save()
            for (const { row, col } of tactilePreviewCells) {
              if (row < 0 || row >= activeRows || col < 0 || col >= activeCols) {
                continue
              }
              const x = LEFT_GUTTER + col * cellSize
              const y = TOP_RULER + row * cellSize

              ctx.fillStyle = isValidPlacement
                ? 'rgba(16, 185, 129, 0.36)'
                : 'rgba(245, 158, 11, 0.28)'
              drawRoundedRectPath(ctx, x + 3, y + 3, cellSize - 6, cellSize - 6, 7)
              ctx.fill()

              ctx.strokeStyle = isValidPlacement ? '#10b981' : '#f59e0b'
              ctx.lineWidth = 2.4
              if (!isValidPlacement) {
                ctx.setLineDash([5, 3])
              }
              ctx.stroke()
              ctx.setLineDash([])

              ctx.fillStyle = isValidPlacement ? '#d1fae5' : '#fde68a'
              ctx.font = 'bold 15px "JetBrains Mono", monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(def.symbol, x + cellSize * 0.5, y + cellSize * 0.5)
            }
            ctx.restore()
          }
        } else {
          // Style #1 (`TETRIS_CLASSIC`) Hard-Drop Neon Beam, Ghost Piece & Smooth 60fps Active Tetromino
          if (
            lastHardDropTrail &&
            wallNowMs >= lastHardDropTrail.startedAtMs &&
            wallNowMs - lastHardDropTrail.startedAtMs < lastHardDropTrail.durationMs
          ) {
            const trailElapsed = wallNowMs - lastHardDropTrail.startedAtMs
            const trailFade = Math.max(
              0,
              1 - trailElapsed / Math.max(1, lastHardDropTrail.durationMs)
            )
            const trailEventKey = `hd_${lastHardDropTrail.id}`
            const trailCols = Array.from(
              new Set(lastHardDropTrail.cells.map((c) => c.col))
            )

            if (!triggeredEventsSetRef.current.has(trailEventKey)) {
              triggeredEventsSetRef.current.add(trailEventKey)
              const avgCol =
                trailCols.reduce((acc, c) => acc + c, 0) /
                Math.max(1, trailCols.length)
              pushBoundedShockwave({
                x: LEFT_GUTTER + avgCol * cellSize + cellSize * 0.5,
                y:
                  TOP_RULER +
                  Math.min(activeRows - 1, lastHardDropTrail.toY + 1) * cellSize,
                radius: cellSize * 0.3,
                maxRadius: cellSize * 2.1,
                color: lastHardDropTrail.color,
                alpha: 0.9,
                lineWidth: 2.8,
              })
            }

            ctx.save()
            for (const cCol of trailCols) {
              const beamX = LEFT_GUTTER + cCol * cellSize + 3
              const beamTopY =
                TOP_RULER + Math.max(0, lastHardDropTrail.fromY) * cellSize
              const beamBottomY =
                TOP_RULER +
                Math.min(activeRows, lastHardDropTrail.toY + 2) * cellSize
              const beamH = Math.max(cellSize, beamBottomY - beamTopY)

              const vGrad = ctx.createLinearGradient(
                beamX,
                beamTopY,
                beamX,
                beamTopY + beamH
              )
              vGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
              vGrad.addColorStop(0.55, `${lastHardDropTrail.glowColor}`)
              vGrad.addColorStop(1, `rgba(254, 240, 138, ${0.65 * trailFade})`)

              ctx.globalAlpha = trailFade * 0.72
              ctx.fillStyle = vGrad
              ctx.fillRect(beamX, beamTopY, cellSize - 6, beamH)

              // Vertical speed line
              ctx.strokeStyle = '#ffffff'
              ctx.lineWidth = 1.6
              ctx.beginPath()
              ctx.moveTo(beamX + (cellSize - 6) * 0.5, beamTopY + 6)
              ctx.lineTo(beamX + (cellSize - 6) * 0.5, beamTopY + beamH - 4)
              ctx.stroke()
            }
            ctx.restore()
          }

          const def = getPieceDefinition(activePiece.type)
          const ghostY = computeGhostY(grid, activePiece)

          // Smooth 60fps visual interpolation of activePiece (lateral glide & gravity slide)
          const pv = pieceVisualRef.current
          const dtMs = Math.min(50, Math.max(1, nowMs - (pv.lastUpdateMs || nowMs)))
          pv.lastUpdateMs = nowMs
          if (
            pv.type !== activePiece.type ||
            activePiece.y < pv.y - 0.5 ||
            Math.abs(activePiece.x - pv.x) > 4
          ) {
            pv.x = activePiece.x
            pv.y = activePiece.y
            pv.type = activePiece.type
          } else {
            const lerpFactor = 1 - Math.exp(-dtMs * 0.032)
            pv.x += (activePiece.x - pv.x) * lerpFactor
            pv.y += (activePiece.y - pv.y) * lerpFactor
          }
          const smoothOffsetX = (pv.x - activePiece.x) * cellSize
          const smoothOffsetY = (pv.y - activePiece.y) * cellSize

          if (ghostY > activePiece.y) {
            const ghostCells = getPieceOccupiedCells({
              ...activePiece,
              y: ghostY,
            })

            ctx.save()
            for (const { row, col } of ghostCells) {
              if (row < 0 || row >= activeRows || col < 0 || col >= activeCols) continue
              const x = LEFT_GUTTER + col * cellSize
              const y = TOP_RULER + row * cellSize

              ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
              ctx.fillRect(x + 3, y + 3, cellSize - 6, cellSize - 6)

              ctx.strokeStyle = def.borderColor
              ctx.lineWidth = 1.5
              ctx.setLineDash([4, 3])
              ctx.strokeRect(x + 3, y + 3, cellSize - 6, cellSize - 6)
              ctx.setLineDash([])

              ctx.fillStyle = 'rgba(255, 255, 255, 0.44)'
              ctx.font = 'bold 12px "JetBrains Mono", monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(def.symbol, x + cellSize * 0.5, y + cellSize * 0.5)
            }
            ctx.restore()
          }

          const isGraceActive = (activePiece.graceFloatMs ?? 0) > 0
          for (const { row, col } of classicActiveCells) {
            if (row < 0 || row >= activeRows || col < 0 || col >= activeCols) continue

            drawGridBlock(
              ctx,
              col,
              row,
              {
                type: activePiece.type,
                color: def.color,
                glowColor: def.glowColor,
                borderColor: def.borderColor,
                symbol: def.symbol,
                isMorphedBlock: Boolean(activePiece.isMorphed),
              },
              pulsePhase,
              'TETRIS_CLASSIC',
              cellSize,
              false,
              smoothOffsetX,
              smoothOffsetY
            )

            if (isGraceActive || isBulletTime) {
              const x = LEFT_GUTTER + col * cellSize + smoothOffsetX
              const y = TOP_RULER + row * cellSize + smoothOffsetY
              ctx.save()
              ctx.strokeStyle = isBulletTime ? '#fbbf24' : '#67e8f9'
              ctx.lineWidth = 2.2
              ctx.shadowColor = isBulletTime
                ? 'rgba(251, 191, 36, 0.85)'
                : 'rgba(34, 211, 238, 0.85)'
              ctx.shadowBlur = 12
              ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2)
              ctx.restore()
            }
          }

          if (lockDelayMs > 0 && classicActiveCells.length > 0) {
            const maxRow = Math.max(...classicActiveCells.map((c) => c.row))
            const minCol = Math.min(...classicActiveCells.map((c) => c.col))
            const maxCol = Math.max(...classicActiveCells.map((c) => c.col))
            const barX = LEFT_GUTTER + minCol * cellSize
            const barY = TOP_RULER + (maxRow + 1) * cellSize - 3
            const barWidth = (maxCol - minCol + 1) * cellSize
            const ratio = Math.max(0, Math.min(1, 1 - lockDelayMs / LOCK_DELAY_LIMIT_MS))

            ctx.save()
            ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'
            ctx.fillRect(barX, barY, barWidth, 3)
            ctx.fillStyle = isGraceActive ? '#67e8f9' : '#fbbf24'
            ctx.fillRect(barX, barY, barWidth * ratio, 3)
            ctx.restore()
          }
        }
      }

      // 9. Progressive Sequence Dopamine Board Aura
      if (
        lastDopamineTier === 'LYDIAN_7_9' ||
        lastDopamineTier === 'SUPERNOVA_10_11' ||
        lastDopamineTier === 'GENESIS_ECSTASY_12_PLUS' ||
        currentCombo >= 7
      ) {
        ctx.save()
        if (currentCombo >= 12 || lastDopamineTier === 'GENESIS_ECSTASY_12_PLUS') {
          const rainbowGrad = ctx.createLinearGradient(
            LEFT_GUTTER,
            TOP_RULER,
            LEFT_GUTTER + boardPixelWidth,
            TOP_RULER + boardPixelHeight
          )
          rainbowGrad.addColorStop(0, '#fbbf24')
          rainbowGrad.addColorStop(0.25, '#f43f5e')
          rainbowGrad.addColorStop(0.5, '#a855f7')
          rainbowGrad.addColorStop(0.75, '#22d3ee')
          rainbowGrad.addColorStop(1, '#34d399')

          ctx.strokeStyle = rainbowGrad
          ctx.lineWidth = 3.5
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)'
          ctx.shadowBlur = 14 + 6 * Math.sin(pulsePhase * 6)
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            boardPixelWidth - 2,
            boardPixelHeight - 2
          )
        } else if (currentCombo >= 10 || lastDopamineTier === 'SUPERNOVA_10_11') {
          ctx.strokeStyle = '#fbbf24'
          ctx.lineWidth = 2.6
          ctx.shadowColor = 'rgba(251, 191, 36, 0.65)'
          ctx.shadowBlur = 10
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            boardPixelWidth - 2,
            boardPixelHeight - 2
          )
        } else {
          ctx.strokeStyle = '#c084fc'
          ctx.lineWidth = 2.2
          ctx.shadowColor = 'rgba(192, 132, 252, 0.55)'
          ctx.shadowBlur = 8
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            boardPixelWidth - 2,
            boardPixelHeight - 2
          )
        }
        ctx.restore()
      }

      // 10. 900ms Smooth Proportional Stage Transition Portal (`isStyleTransitioning`)
      if (isStyleTransitioning && styleTransitionRemainingMs > 0) {
        const progress = Math.max(
          0,
          Math.min(1, 1 - styleTransitionRemainingMs / STYLE_TRANSITION_DURATION_MS)
        )
        const scanY = TOP_RULER + (1 - progress) * boardPixelHeight
        const targetStyle = styleTransitionTo ?? currentStyle
        const targetTitle = getSubGameStyleLabelPt(targetStyle).toUpperCase()
        const targetSubtitle = getSubGameStylePedagogicalSubtitle(targetStyle)

        ctx.save()

        const waveGrad = ctx.createLinearGradient(
          LEFT_GUTTER,
          scanY - 40,
          LEFT_GUTTER,
          scanY + 40
        )
        waveGrad.addColorStop(0, 'rgba(34, 211, 238, 0)')
        waveGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.45)')
        waveGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
        ctx.fillStyle = waveGrad
        ctx.fillRect(LEFT_GUTTER, TOP_RULER, boardPixelWidth, boardPixelHeight)

        ctx.strokeStyle = '#fef08a'
        ctx.lineWidth = 2.8
        ctx.shadowColor = '#22d3ee'
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.moveTo(LEFT_GUTTER, scanY)
        ctx.lineTo(LEFT_GUTTER + boardPixelWidth, scanY)
        ctx.stroke()

        const portalW = Math.min(420, boardPixelWidth - 24)
        const portalH = 98
        const portalX = LEFT_GUTTER + (boardPixelWidth - portalW) * 0.5
        const portalY = TOP_RULER + (boardPixelHeight - portalH) * 0.5

        ctx.shadowBlur = 18
        ctx.shadowColor = 'rgba(168, 85, 247, 0.78)'
        ctx.fillStyle = 'rgba(15, 23, 42, 0.93)'
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2.2
        drawRoundedRectPath(ctx, portalX, portalY, portalW, portalH, 14)
        ctx.fill()
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        ctx.fillStyle = '#67e8f9'
        ctx.fillText(
          '🌀 TROCA PROPORCIONAL DE CENÁRIO',
          LEFT_GUTTER + boardPixelWidth * 0.5,
          portalY + 22
        )

        ctx.font = 'bold 14px "JetBrains Mono", monospace'
        ctx.fillStyle = '#fef08a'
        ctx.fillText(
          targetTitle,
          LEFT_GUTTER + boardPixelWidth * 0.5,
          portalY + 46
        )

        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.fillStyle = '#a7f3d0'
        ctx.fillText(
          targetSubtitle.slice(0, 48),
          LEFT_GUTTER + boardPixelWidth * 0.5,
          portalY + 66
        )

        ctx.font = 'bold 10px "JetBrains Mono", monospace'
        ctx.fillStyle = '#fde68a'
        const purgeBannerText =
          lastPurgedBlocksCount > 0
            ? `💥 ${lastPurgedBlocksCount} Blocos Eliminados · Sequência Mantida!`
            : targetStyle === 'FRUIT_MATCH'
              ? '🍎 100 Frutas Prontas para Trocar!'
              : '✨ Palco 100% Proporcional Sem Cortes!'
        ctx.fillText(
          purgeBannerText,
          LEFT_GUTTER + boardPixelWidth * 0.5,
          portalY + 83
        )

        ctx.restore()
      }

      // 11. Update and Render 60fps Shockwaves, 2D Block Shards, Particles & Floating Callouts
      if (shockwavesRef.current.length > 0) {
        const survivingRings: CanvasShockwaveRing[] = []
        ctx.save()
        for (const ring of shockwavesRef.current) {
          ring.radius += (ring.maxRadius - ring.radius) * 0.14 + 1.6
          ring.alpha -= 0.036

          if (ring.alpha > 0.02 && ring.radius < ring.maxRadius) {
            survivingRings.push(ring)
            ctx.globalAlpha = Math.max(0, ring.alpha)
            ctx.strokeStyle = ring.color
            ctx.lineWidth = ring.lineWidth
            ctx.shadowColor = ring.color
            ctx.shadowBlur = 12
            ctx.beginPath()
            ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        ctx.restore()
        shockwavesRef.current = survivingRings
      }

      if (shardsRef.current.length > 0) {
        const survivingShards: CanvasBlockShard[] = []
        ctx.save()
        for (const s of shardsRef.current) {
          s.x += s.vx
          s.y += s.vy
          s.vy += 0.24 // physical gravity acceleration
          s.rotation += s.vRot
          s.alpha -= s.decay

          if (s.alpha > 0.03) {
            survivingShards.push(s)
            ctx.save()
            ctx.globalAlpha = Math.max(0, s.alpha)
            ctx.translate(s.x, s.y)
            ctx.rotate(s.rotation)

            ctx.fillStyle = s.color
            ctx.strokeStyle = s.borderColor
            ctx.lineWidth = 1.5
            ctx.shadowColor = s.glowColor
            ctx.shadowBlur = 8

            drawRoundedRectPath(ctx, -s.w * 0.5, -s.h * 0.5, s.w, s.h, 3.5)
            ctx.fill()
            ctx.stroke()

            // Specular highlight strip on the flying fragment
            ctx.shadowBlur = 0
            ctx.fillStyle = 'rgba(255, 255, 255, 0.34)'
            ctx.fillRect(-s.w * 0.36, -s.h * 0.36, s.w * 0.72, Math.max(2, s.h * 0.22))

            if (s.emoji || s.symbol) {
              ctx.fillStyle = '#ffffff'
              ctx.font = 'bold 9px "JetBrains Mono", monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(s.emoji ?? s.symbol ?? '', 0, 0.5)
            }
            ctx.restore()
          }
        }
        ctx.restore()
        shardsRef.current = survivingShards
      }

      if (particlesRef.current.length > 0) {
        const surviving: CanvasParticle[] = []
        ctx.save()
        for (const p of particlesRef.current) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.04
          p.alpha -= p.decay

          if (p.alpha > 0.02) {
            surviving.push(p)
            ctx.globalAlpha = Math.max(0, p.alpha)
            ctx.fillStyle = p.color
            ctx.shadowColor = p.color
            ctx.shadowBlur = 6

            if (p.shape === 'diamond') {
              ctx.beginPath()
              ctx.moveTo(p.x, p.y - p.size)
              ctx.lineTo(p.x + p.size, p.y)
              ctx.lineTo(p.x, p.y + p.size)
              ctx.lineTo(p.x - p.size, p.y)
              ctx.closePath()
              ctx.fill()
            } else if (p.shape === 'spark') {
              ctx.beginPath()
              ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2)
              ctx.fill()
            } else {
              ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size)
            }
          }
        }
        ctx.restore()
        particlesRef.current = surviving
      }

      if (calloutsRef.current.length > 0) {
        const survivingCallouts: CanvasFloatingCallout[] = []
        ctx.save()
        for (const c of calloutsRef.current) {
          c.y += c.vy
          c.alpha -= c.decay

          if (c.alpha > 0.03) {
            survivingCallouts.push(c)
            ctx.save()
            ctx.globalAlpha = Math.max(0, Math.min(1, c.alpha * 1.15))
            ctx.translate(c.x, c.y)
            ctx.scale(c.scale, c.scale)

            ctx.font = 'bold 11.5px "JetBrains Mono", monospace'
            const textW = ctx.measureText(c.text).width
            const pillW = textW + 18
            const pillH = 22

            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
            ctx.strokeStyle = c.borderColor
            ctx.lineWidth = 1.6
            ctx.shadowColor = c.borderColor
            ctx.shadowBlur = 10
            drawRoundedRectPath(ctx, -pillW * 0.5, -pillH * 0.5, pillW, pillH, 8)
            ctx.fill()
            ctx.stroke()

            ctx.shadowBlur = 0
            ctx.fillStyle = c.color
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(c.text, 0, 0.5)
            ctx.restore()
          }
        }
        ctx.restore()
        calloutsRef.current = survivingCallouts
      }

      if (!isUnmounted) {
        animationFrameId = window.requestAnimationFrame(renderFrame)
      }
    }

    animationFrameId = window.requestAnimationFrame(renderFrame)

    return () => {
      isUnmounted = true
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  const resolveCanvasCellFromPointer = (
    clientX: number,
    clientY: number
  ): { col: number; row: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const state = useLogicTetrisStore.getState()
    const metrics = getStageViewportMetrics(state.activeSubGameStyle)

    const logicalX = ((clientX - rect.left) / rect.width) * metrics.canvasWidthPx
    const logicalY = ((clientY - rect.top) / rect.height) * metrics.canvasHeightPx

    const col = Math.floor((logicalX - LEFT_GUTTER) / metrics.cellSizePx)
    const row = Math.floor((logicalY - TOP_RULER) / metrics.cellSizePx)

    if (
      col < 0 ||
      col >= metrics.activeCols ||
      row < 0 ||
      row >= metrics.activeRows
    ) {
      return null
    }
    return { col, row }
  }

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = useLogicTetrisStore.getState()
    if (state.phase !== 'PLAYING') return
    const coords = resolveCanvasCellFromPointer(event.clientX, event.clientY)
    if (!coords) return

    if (state.activeSubGameStyle === 'FRUIT_MATCH') {
      dragStartFruitRef.current = { row: coords.row, col: coords.col }
    }
  }

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = useLogicTetrisStore.getState()
    if (state.phase !== 'PLAYING') return
    const coords = resolveCanvasCellFromPointer(event.clientX, event.clientY)
    if (!coords) return

    if (state.activeSubGameStyle === 'FRUIT_MATCH') {
      // Se estiver arrastando o dedo/mouse de uma fruta para uma vizinha ortogonal, executa a troca imediatamente!
      const dragOrigin = dragStartFruitRef.current
      if (dragOrigin) {
        const manhattan =
          Math.abs(dragOrigin.row - coords.row) +
          Math.abs(dragOrigin.col - coords.col)
        if (manhattan === 1) {
          dragStartFruitRef.current = null
          state.swapFruitCells(dragOrigin, { row: coords.row, col: coords.col })
          return
        }
      }
      return
    }

    if (state.activeSubGameStyle === 'TACTILE_GRID') {
      if (coords.row >= TACTILE_ROW_START && coords.row <= TACTILE_ROW_END) {
        if (
          coords.col !== state.tactileCursorCol ||
          coords.row !== state.tactileCursorRow
        ) {
          state.setTactileCursorPosition(coords.col, coords.row)
        }
      }
    }
  }

  const handleCanvasPointerUp = () => {
    dragStartFruitRef.current = null
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = useLogicTetrisStore.getState()
    if (state.phase !== 'PLAYING') return
    const coords = resolveCanvasCellFromPointer(event.clientX, event.clientY)
    if (!coords) return

    if (state.activeSubGameStyle === 'FRUIT_MATCH') {
      dragStartFruitRef.current = null
      state.selectOrSwapFruitAt(coords.row, coords.col)
      return
    }

    if (
      state.activeSubGameStyle === 'TACTILE_GRID' &&
      coords.row >= TACTILE_ROW_START &&
      coords.row <= TACTILE_ROW_END
    ) {
      state.setTactileCursorPosition(coords.col, coords.row)
      state.placeSelectedTactilePieceAt(coords.col, coords.row)
      return
    }

    if (buriedCount > 0 && onCavityClick) {
      const clickedCavity = state.topology.buriedCavities.some(
        (c) => c.row === coords.row && c.col === coords.col
      )
      if (clickedCavity) {
        onCavityClick()
      }
    }
  }

  const visibleFeedbacks = React.useMemo(() => {
    // Filter out redundant '🌀 TROCA DE CENÁRIO' DOM toast since the Canvas 2D portal already renders it
    const nonRedundant = floatingFeedbacks.filter(
      (fb) => !fb.text.startsWith('🌀 TROCA DE CENÁRIO')
    )
    if (nonRedundant.length === 0) return []
    const hasCelebration = nonRedundant.some(
      (fb) => !fb.text.startsWith('🔄')
    )
    const filtered = hasCelebration
      ? nonRedundant.filter((fb) => !fb.text.startsWith('🔄'))
      : nonRedundant
    const deduped: typeof floatingFeedbacks = []
    for (const fb of filtered) {
      if (deduped.length === 0 || deduped[deduped.length - 1].text !== fb.text) {
        deduped.push(fb)
      }
    }
    return deduped.slice(-1)
  }, [floatingFeedbacks])

  return (
    <div className={`lt-canvas-stage relative select-none ${className}`}>
      {/* Minimal Icon-First Floating Status Badges (Zero Verbose Text Header) */}
      <div className="lt-canvas-header-strip w-full flex flex-wrap items-center justify-center gap-1.5 pb-0.5 text-[10px] font-mono leading-tight">
        {combo >= 12 && (
          <span
            className="px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-300 text-amber-100 font-bold animate-pulse"
            data-testid="canvas-legendary-streak-badge"
          >
            👑 ×{combo}
          </span>
        )}

        {lastMathResonanceFormula && (
          <span
            className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 font-semibold truncate max-w-[210px]"
            title={lastMathResonanceFormula}
            data-testid="canvas-math-resonance-badge"
          >
            ∑ {lastMathResonanceFormula.split('(')[0].trim()}
          </span>
        )}

        {activeSubGameStyle === 'FRUIT_MATCH' ? (
          <span
            className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-200 font-semibold"
            title={`${validSwapsCount} trocas válidas prontas na Arena 10×10`}
            data-testid="canvas-fruit-swaps-badge"
          >
            🍎 {validSwapsCount}
          </span>
        ) : graceFloatMs > 0 ? (
          <span
            className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-semibold animate-pulse"
            data-testid="grace-float-badge"
          >
            🛡️ {(graceFloatMs / 1000).toFixed(1)}s
          </span>
        ) : buriedCount > 0 && activeSubGameStyle === 'TETRIS_CLASSIC' ? (
          <button
            type="button"
            onClick={onCavityClick}
            className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-semibold transition cursor-pointer"
            title="Clique ou pressione [B] para tapar os buracos soterrados com Matemática!"
            data-testid="canvas-cavity-pill"
          >
            ✦ {buriedCount} [B]
          </button>
        ) : null}
      </div>

      {/* Main Proportional Base-10 Canvas (20x10 Tower OR 10x10 Full Square Stage) */}
      <div className="relative flex items-center justify-center w-full">
        <canvas
          ref={canvasRef}
          width={stageMetrics.canvasWidthPx}
          height={stageMetrics.canvasHeightPx}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onClick={handleCanvasClick}
          className={`lt-board-canvas ${
            is10x10Stage ? 'lt-board-canvas-10x10 cursor-pointer' : 'lt-board-canvas-20x10'
          } block rounded-xl border border-slate-700/80 shadow-2xl`}
          aria-label={
            is10x10Stage
              ? 'Arena Logic Tetris 10 por 10 Proporcional'
              : 'Tabuleiro Logic Tetris 20 por 10'
          }
          data-testid="logic-tetris-canvas"
          data-phase={phase}
          data-style={activeSubGameStyle}
          data-stage-rows={stageMetrics.activeRows}
          data-rotation-mode={styleRotationMode}
        />

        {/* Floating Feedbacks Overlay (Celebrations & Warm Encouragement) */}
        {visibleFeedbacks.length > 0 && (
          <div
            className="pointer-events-none absolute inset-x-3 top-9 flex flex-col items-center gap-1 z-20"
            aria-live="polite"
          >
            {visibleFeedbacks.map((fb) => (
              <div
                key={fb.id}
                className={`lt-floating-toast lt-toast-${fb.color} px-2.5 py-1 rounded-lg border backdrop-blur-md text-center shadow-lg`}
              >
                <div className="text-xs font-bold tracking-wide">{fb.text}</div>
                {fb.subtext && (
                  <div className="text-[11px] opacity-90 font-medium">{fb.subtext}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

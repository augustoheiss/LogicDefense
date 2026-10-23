import React, { useEffect, useRef } from 'react'
import {
  ActivePiece,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CascadeWave,
  FruitKind,
  GridCell,
} from '../types'
import { computeGhostY } from '../engine/gridEngine'
import {
  computeFruitPairGhostY,
  FRUIT_CATALOG,
  getFruitPairCells,
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

export interface TetrisCanvasProps {
  className?: string
  /** Optional click callback on a buried cavity cell to trigger [B] Tapar Buraco directly */
  onCavityClick?: () => void
}

const CELL_SIZE = 30
const LEFT_GUTTER = 28
const RIGHT_GUTTER = 54
const TOP_RULER = 28
const BOTTOM_RULER = 28

const BOARD_PIXEL_WIDTH = BOARD_WIDTH * CELL_SIZE
const BOARD_PIXEL_HEIGHT = BOARD_HEIGHT * CELL_SIZE

export const CANVAS_LOGICAL_WIDTH = LEFT_GUTTER + BOARD_PIXEL_WIDTH + RIGHT_GUTTER
export const CANVAS_LOGICAL_HEIGHT = TOP_RULER + BOARD_PIXEL_HEIGHT + BOTTOM_RULER

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

/**
 * Neon Genesis Polymorphic 3-in-1 2D Canvas Renderer for Logic Tetris (20×10 Base-10 Matrix).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 04-A / 05-A`: Base-10 Ruler `1..10` on top and bottom, central subitizing axis `5 | 6` ($5+5=10$),
 *   glowing `+1`, `+2`, `+3` right-margin row complement badges AND bottom-ruler vertical column complement badges,
 *   luminous fruit gems with `emoji + symbol` & `"🎯 2+1"` oracle column badge in `FRUIT_MATCH`,
 *   and `10×10` Tactile Arena boundary + Golden Crossroads (`✚`) + tray piece preview in `TACTILE_GRID`.
 * - `Melhoria 04-B / 05-B`: 900ms "Dobra do Cordão Tríplice" holographic portal transition, progressive sequence
 *   dopamine border aura (`LYDIAN_7_9`, `SUPERNOVA_10_11`, `GENESIS_ECSTASY_12_PLUS`), and 60fps polymorphic
 *   particles for rows, vertical columns, fruit cascades, and 12×+ legendary fireworks.
 * - `Melhoria 05-C`: Direct Mouse/Touch hover & click placement inside the `10×10` Tactile Arena.
 */
export const TetrisCanvas: React.FC<TetrisCanvasProps> = ({
  className = '',
  onCavityClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<CanvasParticle[]>([])
  const lastProcessedEventRef = useRef<number>(0)
  const lastMorphedPieceStateRef = useRef<string>('')

  // Subscribe to store slices needed for accessible DOM overlay & header strip
  const floatingFeedbacks = useLogicTetrisStore((s) => s.floatingFeedbacks)
  const buriedCount = useLogicTetrisStore((s) => s.topology.buriedCavities.length)
  const phase = useLogicTetrisStore((s) => s.phase)
  const activeSubGameStyle = useLogicTetrisStore((s) => s.activeSubGameStyle)
  const styleRotationMode = useLogicTetrisStore((s) => s.styleRotationMode)
  const combo = useLogicTetrisStore((s) => s.combo)
  const lastMathResonanceFormula = useLogicTetrisStore((s) => s.lastMathResonanceFormula)
  const classicGraceMs = useLogicTetrisStore((s) => s.activePiece.graceFloatMs ?? 0)
  const fruitGraceMs = useLogicTetrisStore((s) => s.activeFruitPair.graceFloatMs ?? 0)
  const graceFloatMs =
    activeSubGameStyle === 'FRUIT_MATCH'
      ? fruitGraceMs
      : activeSubGameStyle === 'TETRIS_CLASSIC'
        ? classicGraceMs
        : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number | null = null
    let isUnmounted = false

    const spawnRowClearParticles = (rows: number[]) => {
      const palette = ['#22d3ee', '#fbbf24', '#34d399', '#a855f7', '#fef08a']
      for (const row of rows) {
        const yCenter = TOP_RULER + row * CELL_SIZE + CELL_SIZE * 0.5
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.8 + Math.random() * 3.4
            particlesRef.current.push({
              x: xCenter + (Math.random() - 0.5) * 14,
              y: yCenter + (Math.random() - 0.5) * 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.7,
              size: 2.5 + Math.random() * 3.5,
              color: palette[(col + i) % palette.length],
              alpha: 1,
              decay: 0.018 + Math.random() * 0.016,
              shape: i % 2 === 0 ? 'diamond' : 'square',
            })
          }
        }
      }
    }

    const spawnColumnClearParticles = (cols: number[]) => {
      const palette = ['#10b981', '#fbbf24', '#34d399', '#67e8f9', '#fef08a']
      for (const col of cols) {
        const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
        for (let row = TACTILE_ROW_START; row <= TACTILE_ROW_END; row++) {
          const yCenter = TOP_RULER + row * CELL_SIZE + CELL_SIZE * 0.5
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.9 + Math.random() * 3.2
            particlesRef.current.push({
              x: xCenter + (Math.random() - 0.5) * 10,
              y: yCenter + (Math.random() - 0.5) * 14,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.8,
              size: 2.6 + Math.random() * 3.4,
              color: palette[(row + i) % palette.length],
              alpha: 1,
              decay: 0.017 + Math.random() * 0.015,
              shape: 'diamond',
            })
          }
        }
      }
    }

    const spawnFruitCascadeParticles = (waves: CascadeWave[]) => {
      for (const wave of waves) {
        for (const popped of wave.poppedCells) {
          const xCenter = LEFT_GUTTER + popped.col * CELL_SIZE + CELL_SIZE * 0.5
          const yCenter = TOP_RULER + popped.row * CELL_SIZE + CELL_SIZE * 0.5
          for (let i = 0; i < 7; i++) {
            const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.35
            const speed = 1.1 + Math.random() * 3.0
            particlesRef.current.push({
              x: xCenter,
              y: yCenter,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.6,
              size: 3 + Math.random() * 3.5,
              color: i % 3 === 0 ? '#fef08a' : popped.color,
              alpha: 1,
              decay: 0.017 + Math.random() * 0.014,
              shape: i % 2 === 0 ? 'spark' : 'diamond',
            })
          }
        }
      }
    }

    const spawnLegendaryStreakFireworks = () => {
      const palette = ['#fbbf24', '#f43f5e', '#22d3ee', '#a855f7', '#34d399', '#fef08a']
      for (let col = 1; col < BOARD_WIDTH; col += 2) {
        const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
        const yCenter = TOP_RULER + 42
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.2
          const speed = 1.4 + Math.random() * 3.4
          particlesRef.current.push({
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

    const spawnSealedCavityParticles = (coords: Array<{ row: number; col: number }>) => {
      for (const { row, col } of coords) {
        const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
        const yCenter = TOP_RULER + row * CELL_SIZE + CELL_SIZE * 0.5
        for (let i = 0; i < 14; i++) {
          const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.25
          const speed = 1.0 + Math.random() * 2.8
          particlesRef.current.push({
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

    const spawnMorphBurstParticles = (piece: ActivePiece) => {
      const cells = getPieceOccupiedCells(piece)
      const def = getPieceDefinition(piece.type)
      for (const { row, col } of cells) {
        const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
        const yCenter = TOP_RULER + row * CELL_SIZE + CELL_SIZE * 0.5
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 0.9 + Math.random() * 2.4
          particlesRef.current.push({
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
      isMorphed?: boolean
    ) => {
      const meta = FRUIT_CATALOG[fruitKind] ?? FRUIT_CATALOG.APPLE_RUBY
      const x = LEFT_GUTTER + col * CELL_SIZE
      const y = TOP_RULER + row * CELL_SIZE
      const pad = 2
      const w = CELL_SIZE - pad * 2
      const h = CELL_SIZE - pad * 2
      const isStar = fruitKind === 'STAR_PRISM'

      context.save()

      const shimmer = 0.8 + 0.2 * Math.sin(pulsePhase * 4.5 + col + row)
      const grad = context.createRadialGradient(
        x + CELL_SIZE * 0.38,
        y + CELL_SIZE * 0.35,
        2,
        x + CELL_SIZE * 0.5,
        y + CELL_SIZE * 0.5,
        CELL_SIZE * 0.62
      )
      grad.addColorStop(0, isStar ? '#fef9c3' : meta.borderColor)
      grad.addColorStop(0.55, meta.color)
      grad.addColorStop(1, '#0f172a')

      drawRoundedRectPath(context, x + pad, y + pad, w, h, 7)
      context.fillStyle = grad
      context.shadowColor = meta.glowColor
      context.shadowBlur = isStar ? 12 * shimmer : 7
      context.fill()

      context.strokeStyle = isStar ? '#fef08a' : meta.borderColor
      context.lineWidth = isStar || isMorphed ? 1.8 : 1.3
      context.stroke()

      // Glossy top-left highlight orb
      context.shadowBlur = 0
      context.fillStyle = 'rgba(255, 255, 255, 0.32)'
      context.beginPath()
      context.ellipse(
        x + CELL_SIZE * 0.36,
        y + CELL_SIZE * 0.28,
        5,
        2.5,
        -0.35,
        0,
        Math.PI * 2
      )
      context.fill()

      // Fruit Emoji + Accessibility Symbol
      context.font = '13px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = '#ffffff'
      context.fillText(meta.emoji, x + CELL_SIZE * 0.44, y + CELL_SIZE * 0.52)

      context.font = 'bold 8px "JetBrains Mono", monospace'
      context.fillStyle = isStar ? '#451a03' : '#f8fafc'
      context.fillText(meta.symbol, x + CELL_SIZE - 6.5, y + CELL_SIZE - 6)

      context.restore()
    }

    const drawGridBlock = (
      context: CanvasRenderingContext2D,
      col: number,
      row: number,
      cell: GridCell,
      pulsePhase: number,
      currentStyle: 'TETRIS_CLASSIC' | 'FRUIT_MATCH' | 'TACTILE_GRID'
    ) => {
      if (cell.fruitKind || currentStyle === 'FRUIT_MATCH') {
        const inferredKind = cell.fruitKind ?? inferFruitKindFromCell(cell)
        drawFruitBlock(context, col, row, inferredKind, pulsePhase, cell.isMorphedBlock)
        return
      }

      const x = LEFT_GUTTER + col * CELL_SIZE
      const y = TOP_RULER + row * CELL_SIZE
      const pad = 1.5
      const w = CELL_SIZE - pad * 2
      const h = CELL_SIZE - pad * 2

      context.save()

      const isGoldenCrystal = cell.type === 'SEALED_GOLD' || Boolean(cell.isSealedHole)

      if (isGoldenCrystal) {
        // Golden Balance Crystal (`SEALED_GOLD` — Melhoria 04-C)
        const shimmer = 0.78 + 0.22 * Math.sin(pulsePhase * 4 + col + row)
        const grad = context.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE)
        grad.addColorStop(0, '#fef08a')
        grad.addColorStop(0.5, '#fbbf24')
        grad.addColorStop(1, '#d97706')

        context.fillStyle = grad
        context.shadowColor = `rgba(251, 191, 36, ${0.55 * shimmer})`
        context.shadowBlur = 10
        context.fillRect(x + pad, y + pad, w, h)

        context.strokeStyle = '#fef9c3'
        context.lineWidth = 1.6
        context.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, h - 1)

        // Inner diamond facet
        context.beginPath()
        context.moveTo(x + CELL_SIZE * 0.5, y + 4)
        context.lineTo(x + CELL_SIZE - 4, y + CELL_SIZE * 0.5)
        context.lineTo(x + CELL_SIZE * 0.5, y + CELL_SIZE - 4)
        context.lineTo(x + 4, y + CELL_SIZE * 0.5)
        context.closePath()
        context.strokeStyle = 'rgba(255, 255, 255, 0.55)'
        context.lineWidth = 1
        context.stroke()
      } else {
        // Standard or Morphed Tetromino Cell
        context.fillStyle = cell.color
        context.fillRect(x + pad, y + pad, w, h)

        // Top-left inner bevel highlight
        context.fillStyle = 'rgba(255, 255, 255, 0.22)'
        context.fillRect(x + pad, y + pad, w, 3.5)
        context.fillRect(x + pad, y + pad, 3.5, h)

        // Bottom-right inner shadow
        context.fillStyle = 'rgba(15, 23, 42, 0.36)'
        context.fillRect(x + pad, y + pad + h - 3.5, w, 3.5)

        // Outer neon border
        context.strokeStyle = cell.borderColor ?? '#e2e8f0'
        context.lineWidth = cell.isMorphedBlock ? 1.6 : 1.1
        context.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, h - 1)

        // Small alchemy corner spark if originated from a Math Morph (`Melhoria 04-C`)
        if (cell.isMorphedBlock) {
          context.fillStyle = '#fef08a'
          context.beginPath()
          context.arc(x + CELL_SIZE - 5.5, y + 5.5, 2.1, 0, Math.PI * 2)
          context.fill()
        }
      }

      // Accessibility Geometric Symbol (`symbol`)
      context.shadowBlur = 0
      context.fillStyle = isGoldenCrystal ? '#451a03' : 'rgba(255, 255, 255, 0.92)'
      context.font = 'bold 12px "JetBrains Mono", monospace'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(cell.symbol || '■', x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5 + 0.5)

      context.restore()
    }

    const renderFrame = (nowMs: number) => {
      if (isUnmounted) return

      const state = useLogicTetrisStore.getState()
      const {
        grid,
        activePiece,
        activeFruitPair,
        fruitOracle,
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
        combo: currentCombo,
        lastDopamineTier,
        lastEventCounter,
        lastClearedRows,
        lastClearedCols,
        lastCascadeWaves,
        lastSealedCoords,
        lockDelayMs,
      } = state

      const pulsePhase = nowMs * 0.001

      // Detect new line-clear, column-clear, fruit-cascade or hole-seal events to trigger 60fps Canvas particles (`Melhoria 05-B`)
      if (lastEventCounter !== lastProcessedEventRef.current) {
        lastProcessedEventRef.current = lastEventCounter
        if (lastClearedRows.length > 0) {
          spawnRowClearParticles(lastClearedRows)
        }
        if (lastClearedCols.length > 0) {
          spawnColumnClearParticles(lastClearedCols)
        }
        if (lastCascadeWaves.length > 0) {
          spawnFruitCascadeParticles(lastCascadeWaves)
        }
        if (lastSealedCoords.length > 0) {
          spawnSealedCavityParticles(lastSealedCoords)
        }
        if (currentCombo >= 12) {
          spawnLegendaryStreakFireworks()
        }
      }

      // Detect newly morphed active piece to trigger metamorphosis spark burst (`Melhoria 04-C`)
      const morphSignature = activePiece.isMorphed
        ? `${activePiece.type}_${activePiece.graceFloatMs && activePiece.graceFloatMs > 900 ? 'fresh' : 'settled'}`
        : ''
      if (
        morphSignature.endsWith('_fresh') &&
        lastMorphedPieceStateRef.current !== morphSignature
      ) {
        spawnMorphBurstParticles(activePiece)
      }
      lastMorphedPieceStateRef.current = morphSignature

      // 1. Clear full logical canvas
      ctx.clearRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT)

      // 2. Draw outer background & board well
      ctx.fillStyle = '#060b16'
      ctx.fillRect(0, 0, CANVAS_LOGICAL_WIDTH, CANVAS_LOGICAL_HEIGHT)

      const boardGrad = ctx.createLinearGradient(
        LEFT_GUTTER,
        TOP_RULER,
        LEFT_GUTTER,
        TOP_RULER + BOARD_PIXEL_HEIGHT
      )
      if (currentStyle === 'FRUIT_MATCH') {
        boardGrad.addColorStop(0, '#130b24')
        boardGrad.addColorStop(0.5, '#190f2e')
        boardGrad.addColorStop(1, '#1f1238')
      } else if (currentStyle === 'TACTILE_GRID') {
        boardGrad.addColorStop(0, '#071318')
        boardGrad.addColorStop(0.5, '#091c22')
        boardGrad.addColorStop(1, '#0c262e')
      } else {
        boardGrad.addColorStop(0, '#091122')
        boardGrad.addColorStop(0.5, '#0b1528')
        boardGrad.addColorStop(1, '#0f1c36')
      }
      ctx.fillStyle = boardGrad
      ctx.fillRect(LEFT_GUTTER, TOP_RULER, BOARD_PIXEL_WIDTH, BOARD_PIXEL_HEIGHT)

      // Determine active occupied columns for dynamic Base-10 ruler highlight
      const isInteractivePhase =
        currentPhase === 'PLAYING' ||
        currentPhase === 'MATH_MORPH' ||
        currentPhase === 'MATH_FILL_HOLE' ||
        currentPhase === 'PAUSED'

      let activeColsSet = new Set<number>()
      let classicActiveCells: Array<{ row: number; col: number }> = []
      let fruitActiveCells: Array<{
        row: number
        col: number
        kind: FruitKind
        role: 'primary' | 'secondary'
      }> = []
      let tactilePreviewCells: Array<{ row: number; col: number }> = []

      if (isInteractivePhase) {
        if (currentStyle === 'FRUIT_MATCH') {
          fruitActiveCells = getFruitPairCells(activeFruitPair)
          activeColsSet = new Set<number>(fruitActiveCells.map((c) => c.col))
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

      // 3. Draw subtle column bands & Base-10 Grid Lines
      for (let col = 0; col <= BOARD_WIDTH; col++) {
        const x = LEFT_GUTTER + col * CELL_SIZE

        // Highlight active piece/cursor column span softly
        if (col < BOARD_WIDTH && activeColsSet.has(col)) {
          ctx.fillStyle =
            currentStyle === 'FRUIT_MATCH'
              ? 'rgba(168, 85, 247, 0.06)'
              : currentStyle === 'TACTILE_GRID'
                ? 'rgba(16, 185, 129, 0.06)'
                : 'rgba(34, 211, 238, 0.045)'
          ctx.fillRect(x, TOP_RULER, CELL_SIZE, BOARD_PIXEL_HEIGHT)
        }

        // In FRUIT_MATCH, highlight Oracle recommended column when readyPairsCount > 0 (`Melhoria 05-A`)
        if (
          currentStyle === 'FRUIT_MATCH' &&
          col < BOARD_WIDTH &&
          fruitOracle.readyPairsCount > 0 &&
          col === fruitOracle.recommendedCol
        ) {
          ctx.fillStyle = `rgba(251, 191, 36, ${0.06 + 0.04 * Math.sin(pulsePhase * 4)})`
          ctx.fillRect(x, TOP_RULER, CELL_SIZE, BOARD_PIXEL_HEIGHT)
        }

        // Vertical grid line
        ctx.beginPath()
        ctx.moveTo(x, TOP_RULER)
        ctx.lineTo(x, TOP_RULER + BOARD_PIXEL_HEIGHT)
        if (col === 5) {
          // Central Subitizing Axis 5 | 6 (5 + 5 = 10 — Melhoria 04-A)
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)'
          ctx.lineWidth = 1.8
        } else if (col === 0 || col === BOARD_WIDTH) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
          ctx.lineWidth = 1.5
        } else {
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'
          ctx.lineWidth = 0.8
        }
        ctx.stroke()
      }

      for (let row = 0; row <= BOARD_HEIGHT; row++) {
        const y = TOP_RULER + row * CELL_SIZE
        ctx.beginPath()
        ctx.moveTo(LEFT_GUTTER, y)
        ctx.lineTo(LEFT_GUTTER + BOARD_PIXEL_WIDTH, y)

        if (row === 5 && topology.isDangerZone && currentStyle !== 'TACTILE_GRID') {
          // Danger Zone threshold line (height >= 15)
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + 0.25 * Math.sin(pulsePhase * 5)})`
          ctx.lineWidth = 1.5
        } else if (row % 5 === 0) {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)'
          ctx.lineWidth = 1.1
        } else {
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)'
          ctx.lineWidth = 0.8
        }
        ctx.stroke()
      }

      // 3b. Style #3 (`TACTILE_GRID`) Upper Zone Shade & 10x10 Arena Boundary (`row 10` — Melhoria 05-A)
      if (currentStyle === 'TACTILE_GRID') {
        const arenaTopY = TOP_RULER + TACTILE_ROW_START * CELL_SIZE
        ctx.save()
        ctx.fillStyle = 'rgba(2, 6, 23, 0.62)'
        ctx.fillRect(
          LEFT_GUTTER,
          TOP_RULER,
          BOARD_PIXEL_WIDTH,
          TACTILE_ROW_START * CELL_SIZE
        )

        // Glowing Golden/Emerald Boundary at row 10
        ctx.strokeStyle = '#10b981'
        ctx.lineWidth = 2.2
        ctx.shadowColor = 'rgba(16, 185, 129, 0.75)'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(LEFT_GUTTER, arenaTopY)
        ctx.lineTo(LEFT_GUTTER + BOARD_PIXEL_WIDTH, arenaTopY)
        ctx.stroke()

        // Arena banner pill right above row 10
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(6, 78, 59, 0.88)'
        ctx.strokeStyle = '#34d399'
        ctx.lineWidth = 1.2
        drawRoundedRectPath(
          ctx,
          LEFT_GUTTER + 16,
          arenaTopY - 22,
          BOARD_PIXEL_WIDTH - 32,
          18,
          6
        )
        ctx.fill()
        ctx.stroke()

        ctx.font = 'bold 9.5px "JetBrains Mono", monospace'
        ctx.fillStyle = '#a7f3d0'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          '❖ ARENA TÁTIL BASE-10 (10×10 — LINHAS & COLUNAS) ❖',
          LEFT_GUTTER + BOARD_PIXEL_WIDTH * 0.5,
          arenaTopY - 13
        )
        ctx.restore()
      }

      // 4. Draw Top & Bottom Base-10 Column Rulers `1..10` + Vertical Complement Badges (`Melhoria 05-A`)
      ctx.font = 'bold 11px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let col = 0; col < BOARD_WIDTH; col++) {
        const colNumber = col + 1
        const xCenter = LEFT_GUTTER + col * CELL_SIZE + CELL_SIZE * 0.5
        const isActiveCol = activeColsSet.has(col)
        const isLeftFive = col < 5

        if (isActiveCol) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.22)'
          ctx.fillRect(LEFT_GUTTER + col * CELL_SIZE + 2, 4, CELL_SIZE - 4, TOP_RULER - 8)
          ctx.fillRect(
            LEFT_GUTTER + col * CELL_SIZE + 2,
            TOP_RULER + BOARD_PIXEL_HEIGHT + 4,
            CELL_SIZE - 4,
            BOTTOM_RULER - 8
          )
        }

        ctx.fillStyle = isActiveCol
          ? '#67e8f9'
          : isLeftFive
            ? 'rgba(125, 211, 252, 0.78)'
            : 'rgba(110, 231, 183, 0.78)'

        // Top Ruler 1..10
        ctx.fillText(String(colNumber), xCenter, TOP_RULER * 0.5)

        // Bottom Ruler: In TACTILE_GRID, if colComplements[col] is 1..3, draw a glowing +1/+2/+3 badge!
        const missingInCol =
          currentStyle === 'TACTILE_GRID'
            ? tactileTopology.colComplements[col]
            : undefined

        if (missingInCol !== undefined && missingInCol >= 1 && missingInCol <= 3) {
          const bX = LEFT_GUTTER + col * CELL_SIZE + 2
          const bY = TOP_RULER + BOARD_PIXEL_HEIGHT + 3
          const bW = CELL_SIZE - 4
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
          ctx.lineWidth = 1.2
          ctx.fillRect(bX, bY, bW, bH)
          ctx.strokeRect(bX, bY, bW, bH)

          ctx.font = 'bold 10px "JetBrains Mono", monospace'
          ctx.fillStyle =
            missingInCol === 1
              ? '#fef08a'
              : missingInCol === 2
                ? '#6ee7b7'
                : '#7dd3fc'
          ctx.fillText(`+${missingInCol}`, xCenter, TOP_RULER + BOARD_PIXEL_HEIGHT + BOTTOM_RULER * 0.5)
          ctx.restore()
        } else {
          ctx.fillText(
            String(colNumber),
            xCenter,
            TOP_RULER + BOARD_PIXEL_HEIGHT + BOTTOM_RULER * 0.5
          )
        }
      }

      // Draw tiny "5|5" subitizing marker on top and bottom axis divider
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(LEFT_GUTTER + 5 * CELL_SIZE, TOP_RULER - 2, 2.2, 0, Math.PI * 2)
      ctx.arc(LEFT_GUTTER + 5 * CELL_SIZE, TOP_RULER + BOARD_PIXEL_HEIGHT + 2, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // 4b. Style #2 (`FRUIT_MATCH`) Oracle `"🎯 2+1"` Top Pill on recommendedCol (`Melhoria 05-A`)
      if (currentStyle === 'FRUIT_MATCH' && fruitOracle.readyPairsCount > 0) {
        const recCol = fruitOracle.recommendedCol
        const pillX = LEFT_GUTTER + recCol * CELL_SIZE - 6
        const pillY = TOP_RULER + 4
        const pillW = CELL_SIZE + 12
        const pillH = 16

        ctx.save()
        ctx.fillStyle = 'rgba(120, 53, 15, 0.88)'
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 1.2
        drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 5)
        ctx.fill()
        ctx.stroke()

        ctx.font = 'bold 9px "JetBrains Mono", monospace'
        ctx.fillStyle = '#fef08a'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎯 2+1', LEFT_GUTTER + recCol * CELL_SIZE + CELL_SIZE * 0.5, pillY + pillH * 0.5)
        ctx.restore()
      }

      // 5. Draw Left Gutter Height Markers & Right Gutter Base-10 Complement Badges (`+1, +2, +3`)
      const rowComplementsMap =
        currentStyle === 'TACTILE_GRID'
          ? tactileTopology.rowComplements
          : topology.rowComplements

      for (let row = 0; row < BOARD_HEIGHT; row++) {
        const yCenter = TOP_RULER + row * CELL_SIZE + CELL_SIZE * 0.5
        const stackLevelFromBottom = BOARD_HEIGHT - row

        // Left gutter height markers at 5, 10, 15, 20
        if (stackLevelFromBottom % 5 === 0) {
          ctx.font = '10px "JetBrains Mono", monospace'
          ctx.fillStyle =
            stackLevelFromBottom >= 15 && topology.isDangerZone
              ? '#fb7185'
              : 'rgba(148, 163, 184, 0.55)'
          ctx.textAlign = 'right'
          ctx.fillText(`${stackLevelFromBottom}`, LEFT_GUTTER - 6, yCenter)
        }

        // Right gutter Base-10 Complement Badges (+1, +2, +3 when 7, 8, or 9 blocks are filled!)
        const missingCount = rowComplementsMap[row]
        if (missingCount !== undefined && missingCount >= 1 && missingCount <= 3) {
          const badgeX = LEFT_GUTTER + BOARD_PIXEL_WIDTH + 6
          const badgeY = TOP_RULER + row * CELL_SIZE + 4
          const badgeW = RIGHT_GUTTER - 10
          const badgeH = CELL_SIZE - 8

          // Subtle highlight across the nearly-complete row
          ctx.fillStyle =
            missingCount === 1
              ? 'rgba(251, 191, 36, 0.08)'
              : missingCount === 2
                ? 'rgba(52, 211, 153, 0.06)'
                : 'rgba(56, 189, 248, 0.05)'
          ctx.fillRect(LEFT_GUTTER, TOP_RULER + row * CELL_SIZE, BOARD_PIXEL_WIDTH, CELL_SIZE)

          // Badge pill in right gutter
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
          ctx.lineWidth = 1.2
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

      // 6. Draw Locked Grid Cells (20×10)
      for (let row = 0; row < BOARD_HEIGHT; row++) {
        const rowCells = grid[row]
        if (!rowCells) continue
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const cell = rowCells[col]
          if (cell) {
            drawGridBlock(ctx, col, row, cell, pulsePhase, currentStyle)
          }
        }
      }

      // 7. Draw Pulsing Target Reticles inside Buried Cavities (`TETRIS_CLASSIC`) OR Golden Crossroads (`TACTILE_GRID`)
      if (currentStyle === 'TACTILE_GRID') {
        if (tactileTopology.goldenCrossroads.length > 0) {
          const pulse = 0.55 + 0.45 * Math.sin(pulsePhase * 4.5)
          for (const cross of tactileTopology.goldenCrossroads) {
            if (grid[cross.row]?.[cross.col] !== null) continue
            const x = LEFT_GUTTER + cross.col * CELL_SIZE
            const y = TOP_RULER + cross.row * CELL_SIZE

            ctx.save()
            ctx.fillStyle = `rgba(251, 191, 36, ${0.15 + 0.12 * pulse})`
            ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)

            ctx.strokeStyle = `rgba(251, 191, 36, ${0.7 + 0.3 * pulse})`
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 3])
            ctx.strokeRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6)
            ctx.setLineDash([])

            ctx.fillStyle = '#fde047'
            ctx.font = 'bold 12px "JetBrains Mono", monospace'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('✚', x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5)
            ctx.restore()
          }
        }
      } else if (topology.buriedCavities.length > 0) {
        const pulse = 0.55 + 0.45 * Math.sin(pulsePhase * 4.5)
        topology.buriedCavities.forEach((cavity, idx) => {
          const x = LEFT_GUTTER + cavity.col * CELL_SIZE
          const y = TOP_RULER + cavity.row * CELL_SIZE
          const isPrimaryTarget = idx < 3

          ctx.save()
          ctx.fillStyle = isPrimaryTarget
            ? `rgba(251, 191, 36, ${0.14 + 0.12 * pulse})`
            : 'rgba(245, 158, 11, 0.08)'
          ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)

          ctx.strokeStyle = isPrimaryTarget
            ? `rgba(251, 191, 36, ${0.65 + 0.35 * pulse})`
            : 'rgba(251, 191, 36, 0.38)'
          ctx.lineWidth = isPrimaryTarget ? 1.6 : 1
          ctx.setLineDash([4, 3])
          ctx.strokeRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6)
          ctx.setLineDash([])

          ctx.fillStyle = isPrimaryTarget ? '#fde047' : 'rgba(253, 224, 71, 0.65)'
          ctx.font = 'bold 11px "JetBrains Mono", monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            idx === 0 ? '✦[B]' : '✦',
            x + CELL_SIZE * 0.5,
            y + CELL_SIZE * 0.5
          )
          ctx.restore()
        })
      }

      // 8. Polymorphic Active Piece / Fruit Pair / Tactile Preview Layer (`Melhoria 05-A`)
      if (isInteractivePhase) {
        const isBulletTime =
          currentPhase === 'MATH_MORPH' || currentPhase === 'MATH_FILL_HOLE'

        if (currentStyle === 'FRUIT_MATCH') {
          const ghostY = computeFruitPairGhostY(grid, activeFruitPair)

          // 8a. Ghost Fruit Pair
          if (ghostY > activeFruitPair.y) {
            const ghostPairCells = getFruitPairCells({
              ...activeFruitPair,
              y: ghostY,
            })
            ctx.save()
            for (const cell of ghostPairCells) {
              if (
                cell.row < 0 ||
                cell.row >= BOARD_HEIGHT ||
                cell.col < 0 ||
                cell.col >= BOARD_WIDTH
              ) {
                continue
              }
              const meta = FRUIT_CATALOG[cell.kind] ?? FRUIT_CATALOG.APPLE_RUBY
              const x = LEFT_GUTTER + cell.col * CELL_SIZE
              const y = TOP_RULER + cell.row * CELL_SIZE

              ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
              drawRoundedRectPath(ctx, x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, 6)
              ctx.fill()

              ctx.strokeStyle = meta.borderColor
              ctx.lineWidth = 1.5
              ctx.setLineDash([4, 3])
              ctx.stroke()
              ctx.setLineDash([])

              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
              ctx.font = '11px "Segoe UI Emoji", sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(meta.emoji, x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5)
            }
            ctx.restore()
          }

          // 8b. Active Fruit Pair + Energy Connector Link
          const isFruitGrace = (activeFruitPair.graceFloatMs ?? 0) > 0
          for (const cell of fruitActiveCells) {
            if (
              cell.row < 0 ||
              cell.row >= BOARD_HEIGHT ||
              cell.col < 0 ||
              cell.col >= BOARD_WIDTH
            ) {
              continue
            }
            drawFruitBlock(
              ctx,
              cell.col,
              cell.row,
              cell.kind,
              pulsePhase,
              activeFruitPair.isWildcardPair
            )

            if (isFruitGrace || isBulletTime) {
              const x = LEFT_GUTTER + cell.col * CELL_SIZE
              const y = TOP_RULER + cell.row * CELL_SIZE
              ctx.save()
              ctx.strokeStyle = isBulletTime ? '#fbbf24' : '#67e8f9'
              ctx.lineWidth = 2.2
              ctx.shadowColor = isBulletTime
                ? 'rgba(251, 191, 36, 0.85)'
                : 'rgba(34, 211, 238, 0.85)'
              ctx.shadowBlur = 12
              drawRoundedRectPath(ctx, x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 7)
              ctx.stroke()
              ctx.restore()
            }
          }

          // Energy link between primary and secondary fruit
          if (fruitActiveCells.length === 2) {
            const [c0, c1] = fruitActiveCells
            if (c0.row >= 0 && c1.row >= 0) {
              const x0 = LEFT_GUTTER + c0.col * CELL_SIZE + CELL_SIZE * 0.5
              const y0 = TOP_RULER + c0.row * CELL_SIZE + CELL_SIZE * 0.5
              const x1 = LEFT_GUTTER + c1.col * CELL_SIZE + CELL_SIZE * 0.5
              const y1 = TOP_RULER + c1.row * CELL_SIZE + CELL_SIZE * 0.5
              ctx.save()
              ctx.strokeStyle = 'rgba(254, 240, 138, 0.72)'
              ctx.lineWidth = 2.2
              ctx.setLineDash([3, 3])
              ctx.beginPath()
              ctx.moveTo(x0, y0)
              ctx.lineTo(x1, y1)
              ctx.stroke()
              ctx.setLineDash([])
              ctx.restore()
            }
          }
        } else if (currentStyle === 'TACTILE_GRID') {
          // 8c. Style #3 (`TACTILE_GRID`) Cursor & Selected Tray Piece Preview
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

            ctx.save()
            for (const { row, col } of tactilePreviewCells) {
              if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) {
                continue
              }
              const x = LEFT_GUTTER + col * CELL_SIZE
              const y = TOP_RULER + row * CELL_SIZE

              ctx.fillStyle = isValidPlacement
                ? 'rgba(16, 185, 129, 0.34)'
                : 'rgba(245, 158, 11, 0.28)'
              ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)

              ctx.strokeStyle = isValidPlacement ? '#10b981' : '#f59e0b'
              ctx.lineWidth = 2
              if (!isValidPlacement) {
                ctx.setLineDash([4, 3])
              }
              ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4)
              ctx.setLineDash([])

              ctx.fillStyle = isValidPlacement ? '#d1fae5' : '#fde68a'
              ctx.font = 'bold 11px "JetBrains Mono", monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(def.symbol, x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5)
            }
            ctx.restore()
          }
        } else {
          // 8d. Style #1 (`TETRIS_CLASSIC`) Ghost Piece & Active Tetromino
          const def = getPieceDefinition(activePiece.type)
          const ghostY = computeGhostY(grid, activePiece)

          if (ghostY > activePiece.y) {
            const ghostCells = getPieceOccupiedCells({
              ...activePiece,
              y: ghostY,
            })

            ctx.save()
            for (const { row, col } of ghostCells) {
              if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) continue
              const x = LEFT_GUTTER + col * CELL_SIZE
              const y = TOP_RULER + row * CELL_SIZE

              ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
              ctx.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6)

              ctx.strokeStyle = def.borderColor
              ctx.lineWidth = 1.4
              ctx.setLineDash([4, 3])
              ctx.strokeRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6)
              ctx.setLineDash([])

              ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
              ctx.font = 'bold 11px "JetBrains Mono", monospace'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(def.symbol, x + CELL_SIZE * 0.5, y + CELL_SIZE * 0.5)
            }
            ctx.restore()
          }

          const isGraceActive = (activePiece.graceFloatMs ?? 0) > 0
          for (const { row, col } of classicActiveCells) {
            if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) continue

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
              'TETRIS_CLASSIC'
            )

            if (isGraceActive || isBulletTime) {
              const x = LEFT_GUTTER + col * CELL_SIZE
              const y = TOP_RULER + row * CELL_SIZE
              ctx.save()
              ctx.strokeStyle = isBulletTime ? '#fbbf24' : '#67e8f9'
              ctx.lineWidth = 2.2
              ctx.shadowColor = isBulletTime
                ? 'rgba(251, 191, 36, 0.85)'
                : 'rgba(34, 211, 238, 0.85)'
              ctx.shadowBlur = 12
              ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
              ctx.restore()
            }
          }

          // Visual Lock-Delay progress indicator when piece is resting on floor (`500ms`)
          if (lockDelayMs > 0 && classicActiveCells.length > 0) {
            const maxRow = Math.max(...classicActiveCells.map((c) => c.row))
            const minCol = Math.min(...classicActiveCells.map((c) => c.col))
            const maxCol = Math.max(...classicActiveCells.map((c) => c.col))
            const barX = LEFT_GUTTER + minCol * CELL_SIZE
            const barY = TOP_RULER + (maxRow + 1) * CELL_SIZE - 3
            const barWidth = (maxCol - minCol + 1) * CELL_SIZE
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

      // 9. Progressive Sequence Dopamine Board Aura (`LYDIAN_7_9`, `SUPERNOVA_10_11`, `GENESIS_ECSTASY_12_PLUS` — Melhoria 05-B)
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
            LEFT_GUTTER + BOARD_PIXEL_WIDTH,
            TOP_RULER + BOARD_PIXEL_HEIGHT
          )
          rainbowGrad.addColorStop(0, '#fbbf24')
          rainbowGrad.addColorStop(0.25, '#f43f5e')
          rainbowGrad.addColorStop(0.5, '#a855f7')
          rainbowGrad.addColorStop(0.75, '#22d3ee')
          rainbowGrad.addColorStop(1, '#34d399')

          ctx.strokeStyle = rainbowGrad
          ctx.lineWidth = 3.2
          ctx.shadowColor = 'rgba(251, 191, 36, 0.85)'
          ctx.shadowBlur = 14 + 6 * Math.sin(pulsePhase * 6)
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            BOARD_PIXEL_WIDTH - 2,
            BOARD_PIXEL_HEIGHT - 2
          )
        } else if (currentCombo >= 10 || lastDopamineTier === 'SUPERNOVA_10_11') {
          ctx.strokeStyle = '#fbbf24'
          ctx.lineWidth = 2.4
          ctx.shadowColor = 'rgba(251, 191, 36, 0.65)'
          ctx.shadowBlur = 10
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            BOARD_PIXEL_WIDTH - 2,
            BOARD_PIXEL_HEIGHT - 2
          )
        } else {
          ctx.strokeStyle = '#c084fc'
          ctx.lineWidth = 2.0
          ctx.shadowColor = 'rgba(192, 132, 252, 0.55)'
          ctx.shadowBlur = 8
          ctx.strokeRect(
            LEFT_GUTTER + 1,
            TOP_RULER + 1,
            BOARD_PIXEL_WIDTH - 2,
            BOARD_PIXEL_HEIGHT - 2
          )
        }
        ctx.restore()
      }

      // 10. 900ms "Dobra de Cenário" Holographic Portal Animation (`isStyleTransitioning` — Melhoria 05-B)
      if (isStyleTransitioning && styleTransitionRemainingMs > 0) {
        const progress = Math.max(
          0,
          Math.min(1, 1 - styleTransitionRemainingMs / STYLE_TRANSITION_DURATION_MS)
        )
        const scanY = TOP_RULER + (1 - progress) * BOARD_PIXEL_HEIGHT
        const targetStyle = styleTransitionTo ?? currentStyle
        const targetTitle = getSubGameStyleLabelPt(targetStyle).toUpperCase()
        const targetSubtitle = getSubGameStylePedagogicalSubtitle(targetStyle)

        ctx.save()

        // Sweeping holographic scanline wave
        const waveGrad = ctx.createLinearGradient(
          LEFT_GUTTER,
          scanY - 36,
          LEFT_GUTTER,
          scanY + 36
        )
        waveGrad.addColorStop(0, 'rgba(34, 211, 238, 0)')
        waveGrad.addColorStop(0.5, 'rgba(251, 191, 36, 0.45)')
        waveGrad.addColorStop(1, 'rgba(168, 85, 247, 0)')
        ctx.fillStyle = waveGrad
        ctx.fillRect(LEFT_GUTTER, TOP_RULER, BOARD_PIXEL_WIDTH, BOARD_PIXEL_HEIGHT)

        ctx.strokeStyle = '#fef08a'
        ctx.lineWidth = 2.5
        ctx.shadowColor = '#22d3ee'
        ctx.shadowBlur = 14
        ctx.beginPath()
        ctx.moveTo(LEFT_GUTTER, scanY)
        ctx.lineTo(LEFT_GUTTER + BOARD_PIXEL_WIDTH, scanY)
        ctx.stroke()

        // Central translucent Portal Banner
        const portalW = BOARD_PIXEL_WIDTH - 24
        const portalH = 88
        const portalX = LEFT_GUTTER + 12
        const portalY = TOP_RULER + (BOARD_PIXEL_HEIGHT - portalH) * 0.5

        ctx.shadowBlur = 16
        ctx.shadowColor = 'rgba(168, 85, 247, 0.75)'
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
        ctx.strokeStyle = '#fbbf24'
        ctx.lineWidth = 2
        drawRoundedRectPath(ctx, portalX, portalY, portalW, portalH, 12)
        ctx.fill()
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        ctx.font = 'bold 11px "JetBrains Mono", monospace'
        ctx.fillStyle = '#67e8f9'
        ctx.fillText(
          '🌀 DOBRA DO CORDÃO TRÍPLICE',
          LEFT_GUTTER + BOARD_PIXEL_WIDTH * 0.5,
          portalY + 22
        )

        ctx.font = 'bold 13px "JetBrains Mono", monospace'
        ctx.fillStyle = '#fef08a'
        ctx.fillText(
          targetTitle,
          LEFT_GUTTER + BOARD_PIXEL_WIDTH * 0.5,
          portalY + 45
        )

        ctx.font = '9.5px "JetBrains Mono", monospace'
        ctx.fillStyle = '#a7f3d0'
        ctx.fillText(
          targetSubtitle.slice(0, 44),
          LEFT_GUTTER + BOARD_PIXEL_WIDTH * 0.5,
          portalY + 63
        )

        ctx.font = 'bold 9.5px "JetBrains Mono", monospace'
        ctx.fillStyle = '#e2e8f0'
        ctx.fillText(
          'Sequência e Pontuação Mantidas!',
          LEFT_GUTTER + BOARD_PIXEL_WIDTH * 0.5,
          portalY + 77
        )

        ctx.restore()
      }

      // 11. Update and Render 60fps Canvas Particles (`Melhoria 04-C / 05-B`)
      if (particlesRef.current.length > 0) {
        const surviving: CanvasParticle[] = []
        ctx.save()
        for (const p of particlesRef.current) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.04 // gentle gravity
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

  const resolveCanvasCellFromMouse = (
    event: React.MouseEvent<HTMLCanvasElement>
  ): { col: number; row: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const logicalX = ((event.clientX - rect.left) / rect.width) * CANVAS_LOGICAL_WIDTH
    const logicalY = ((event.clientY - rect.top) / rect.height) * CANVAS_LOGICAL_HEIGHT

    const col = Math.floor((logicalX - LEFT_GUTTER) / CELL_SIZE)
    const row = Math.floor((logicalY - TOP_RULER) / CELL_SIZE)

    if (col < 0 || col >= BOARD_WIDTH || row < 0 || row >= BOARD_HEIGHT) {
      return null
    }
    return { col, row }
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = useLogicTetrisStore.getState()
    if (state.phase !== 'PLAYING' || state.activeSubGameStyle !== 'TACTILE_GRID') {
      return
    }
    const coords = resolveCanvasCellFromMouse(event)
    if (!coords) return
    if (coords.row >= TACTILE_ROW_START && coords.row <= TACTILE_ROW_END) {
      if (
        coords.col !== state.tactileCursorCol ||
        coords.row !== state.tactileCursorRow
      ) {
        state.setTactileCursorPosition(coords.col, coords.row)
      }
    }
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const state = useLogicTetrisStore.getState()
    if (state.phase !== 'PLAYING') return
    const coords = resolveCanvasCellFromMouse(event)
    if (!coords) return

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

  return (
    <div className={`lt-canvas-stage relative select-none ${className}`}>
      {/* Top Pedagogical Status Pill (Grace Float / Legendary 12x+ / Math Resonance / Buried Cavity Alert) */}
      <div className="lt-canvas-header-strip flex flex-wrap items-center justify-between gap-1 px-2 py-1 text-[11px] font-mono">
        <span className="text-cyan-300/90 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{getSubGameStyleLabelPt(activeSubGameStyle)}</span>
        </span>

        <div className="flex items-center gap-1.5">
          {combo >= 12 && (
            <span
              className="px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-300 text-amber-100 font-bold animate-pulse"
              data-testid="canvas-legendary-streak-badge"
            >
              👑 SEQUÊNCIA LENDÁRIA ×{combo}
            </span>
          )}

          {lastMathResonanceFormula && (
            <span
              className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 font-semibold truncate max-w-[210px]"
              title={lastMathResonanceFormula}
              data-testid="canvas-math-resonance-badge"
            >
              ∑ {lastMathResonanceFormula}
            </span>
          )}

          {graceFloatMs > 0 ? (
            <span
              className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-semibold animate-pulse"
              data-testid="grace-float-badge"
            >
              🛡️ Flutuação Suave ({(graceFloatMs / 1000).toFixed(1)}s)
            </span>
          ) : buriedCount > 0 ? (
            <button
              type="button"
              onClick={onCavityClick}
              className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-semibold transition cursor-pointer"
              title="Clique ou pressione [B] para tapar os buracos soterrados com Matemática!"
              data-testid="canvas-cavity-pill"
            >
              ✦ {buriedCount} {buriedCount === 1 ? 'Buraco Soterrado' : 'Buracos Soterrados'} [B]
            </button>
          ) : (
            <span className="text-emerald-300/80">✦ Pilha Sem Cavidades</span>
          )}
        </div>
      </div>

      {/* Main 20x10 Base-10 Canvas */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_LOGICAL_WIDTH}
          height={CANVAS_LOGICAL_HEIGHT}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
          className={`lt-board-canvas block rounded-xl border border-slate-700/80 shadow-2xl ${
            activeSubGameStyle === 'TACTILE_GRID' ? 'cursor-pointer' : ''
          }`}
          aria-label="Tabuleiro Logic Tetris Gênesis 20 por 10"
          data-testid="logic-tetris-canvas"
          data-phase={phase}
          data-style={activeSubGameStyle}
          data-rotation-mode={styleRotationMode}
        />

        {/* Floating Feedbacks Overlay (Celebrations & Warm Encouragement) */}
        {floatingFeedbacks.length > 0 && (
          <div
            className="pointer-events-none absolute inset-x-3 top-9 flex flex-col items-center gap-1.5 z-20"
            aria-live="polite"
          >
            {floatingFeedbacks.slice(-3).map((fb) => (
              <div
                key={fb.id}
                className={`lt-floating-toast lt-toast-${fb.color} px-3 py-1.5 rounded-lg border backdrop-blur-md text-center shadow-lg`}
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

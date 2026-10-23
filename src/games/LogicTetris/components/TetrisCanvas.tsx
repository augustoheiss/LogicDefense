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

export interface TetrisCanvasProps {
  className?: string
  /** Optional click callback on a buried cavity cell to trigger [B] Tapar Buraco directly */
  onCavityClick?: () => void
}

const LEFT_GUTTER = 30
const RIGHT_GUTTER = 56
const TOP_RULER = 30
const BOTTOM_RULER = 30

export const CLASSIC_CELL_SIZE = 34
export const ARENA_10X10_CELL_SIZE = 50

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

/**
 * Neon Genesis Polymorphic 3-in-1 2D Canvas Renderer for Logic Tetris (V2 Proportional Stage Edition).
 *
 * - `TETRIS_CLASSIC`: Palco `20×10` vertical com blocos de `34px`.
 * - `FRUIT_MATCH`: Arena `10×10` cheia com 100 frutas de `50px`, troca de frutas adjacentes (clique ou arraste),
 *   cascatas com reposição pelo topo e dica Socrática do Oráculo.
 * - `TACTILE_GRID`: Arena `10×10` inteira sem cortes (`rows 0..9, cols 0..9`) com blocos de `50px`,
 *   suporte a Macro-Blocos (`Cubo 3×3` de 9 quadrados, `Esquadro 3×3`, `Viga 1×5`, `Placa 2×3`) e brilho preditivo H×V.
 */
export const TetrisCanvas: React.FC<TetrisCanvasProps> = ({
  className = '',
  onCavityClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<CanvasParticle[]>([])
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

    const spawnRowClearParticles = (rows: number[], cellSize: number) => {
      const palette = ['#22d3ee', '#fbbf24', '#34d399', '#a855f7', '#fef08a']
      for (const row of rows) {
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
        for (let col = 0; col < BOARD_WIDTH; col++) {
          const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.9 + Math.random() * 3.5
            particlesRef.current.push({
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
          for (let i = 0; i < 4; i++) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.9 + Math.random() * 3.2
            particlesRef.current.push({
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
          for (let i = 0; i < 7; i++) {
            const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.35
            const speed = 1.2 + Math.random() * 3.2
            particlesRef.current.push({
              x: xCenter,
              y: yCenter,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.6,
              size: 3.2 + Math.random() * 3.8,
              color: i % 3 === 0 ? '#fef08a' : popped.color,
              alpha: 1,
              decay: 0.017 + Math.random() * 0.014,
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
      const burstCount = Math.min(75, Math.max(24, purgedCount * 2))
      for (let i = 0; i < burstCount; i++) {
        const x = LEFT_GUTTER + Math.random() * boardW
        const y = TOP_RULER + Math.random() * boardH
        const angle = Math.random() * Math.PI * 2
        const speed = 1.2 + Math.random() * 3.8
        particlesRef.current.push({
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

    const spawnSealedCavityParticles = (
      coords: Array<{ row: number; col: number }>,
      cellSize: number
    ) => {
      for (const { row, col } of coords) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
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

    const spawnMorphBurstParticles = (piece: ActivePiece, cellSize: number) => {
      const cells = getPieceOccupiedCells(piece)
      const def = getPieceDefinition(piece.type)
      for (const { row, col } of cells) {
        const xCenter = LEFT_GUTTER + col * cellSize + cellSize * 0.5
        const yCenter = TOP_RULER + row * cellSize + cellSize * 0.5
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
      cellSize: number,
      isMorphed?: boolean,
      isSelected?: boolean,
      offsetX: number = 0,
      offsetY: number = 0
    ) => {
      const meta = FRUIT_CATALOG[fruitKind] ?? FRUIT_CATALOG.APPLE_RUBY
      const x = LEFT_GUTTER + col * cellSize + offsetX
      const y = TOP_RULER + row * cellSize + offsetY
      const pad = isSelected ? 1.5 : 3
      const w = cellSize - pad * 2
      const h = cellSize - pad * 2
      const isStar = fruitKind === 'STAR_PRISM'

      context.save()

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

      drawRoundedRectPath(context, x + pad, y + pad, w, h, Math.max(7, cellSize * 0.22))
      context.fillStyle = grad
      context.shadowColor = isSelected ? '#fef08a' : meta.glowColor
      context.shadowBlur = isSelected ? 16 : isStar ? 14 * shimmer : 8
      context.fill()

      context.strokeStyle = isSelected
        ? '#fef08a'
        : isStar
          ? '#fef08a'
          : meta.borderColor
      context.lineWidth = isSelected ? 2.8 : isStar || isMorphed ? 2.0 : 1.4
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
      offsetY: number = 0
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
          offsetY
        )
        return
      }

      const x = LEFT_GUTTER + col * cellSize + offsetX
      const y = TOP_RULER + row * cellSize + offsetY
      const pad = cellSize >= 46 ? 2.2 : 1.5
      const w = cellSize - pad * 2
      const h = cellSize - pad * 2

      context.save()

      const isGoldenCrystal = cell.type === 'SEALED_GOLD' || Boolean(cell.isSealedHole)

      if (isGoldenCrystal) {
        const shimmer = 0.78 + 0.22 * Math.sin(pulsePhase * 4 + col + row)
        const grad = context.createLinearGradient(x, y, x + cellSize, y + cellSize)
        grad.addColorStop(0, '#fef08a')
        grad.addColorStop(0.5, '#fbbf24')
        grad.addColorStop(1, '#d97706')

        context.fillStyle = grad
        context.shadowColor = `rgba(251, 191, 36, ${0.55 * shimmer})`
        context.shadowBlur = 10
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cellSize >= 46 ? 6 : 3)
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
        drawRoundedRectPath(context, x + pad, y + pad, w, h, cellSize >= 46 ? 6 : 3)
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
        context.strokeStyle = cell.borderColor ?? '#e2e8f0'
        context.lineWidth = cell.isMorphedBlock ? 1.8 : 1.3
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
      } = state

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

      // 6. Draw Active Board Cells (with cascading fruit rain animation when transitioning into FRUIT_MATCH)
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
      const isInvalidBounceActive = Date.now() < invalidSwapBounceUntil

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

          if (isEnteringFruit) {
            const cellDelay = (col * 0.04 + (activeRows - 1 - row) * 0.03) * 0.45
            const localT = Math.max(
              0,
              Math.min(1, (transitionProgress - cellDelay) / (1 - cellDelay))
            )
            offsetY = -(1 - easeOutCubic(localT)) * (boardPixelHeight * 0.45)
          } else if (
            isInvalidBounceActive &&
            lastSwappedCells &&
            ((lastSwappedCells[0].row === row && lastSwappedCells[0].col === col) ||
              (lastSwappedCells[1].row === row && lastSwappedCells[1].col === col))
          ) {
            const shake = Math.sin(nowMs * 0.045) * 6
            offsetX = shake
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
            offsetY
          )
        }
      }

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
          // Style #1 (`TETRIS_CLASSIC`) Ghost Piece & Active Tetromino
          const def = getPieceDefinition(activePiece.type)
          const ghostY = computeGhostY(grid, activePiece)

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
              cellSize
            )

            if (isGraceActive || isBulletTime) {
              const x = LEFT_GUTTER + col * cellSize
              const y = TOP_RULER + row * cellSize
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

      // 11. Update and Render 60fps Canvas Particles
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

  return (
    <div className={`lt-canvas-stage relative select-none ${className}`}>
      {/* Top Pedagogical Status Pill */}
      <div className="lt-canvas-header-strip w-full max-w-[550px] flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs font-mono">
        <span className="text-cyan-300/95 flex items-center gap-1.5 font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{getSubGameStyleLabelPt(activeSubGameStyle)}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-[10px] text-slate-300">
            {is10x10Stage ? 'Palco 10×10 (50px)' : 'Torre 20×10 (34px)'}
          </span>
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
              className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 font-semibold truncate max-w-[230px]"
              title={lastMathResonanceFormula}
              data-testid="canvas-math-resonance-badge"
            >
              ∑ {lastMathResonanceFormula}
            </span>
          )}

          {activeSubGameStyle === 'FRUIT_MATCH' ? (
            <span
              className="px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/50 text-fuchsia-200 font-semibold"
              data-testid="canvas-fruit-swaps-badge"
            >
              🍎 {validSwapsCount} Trocas Prontas (Clique ou Arraste)
            </span>
          ) : graceFloatMs > 0 ? (
            <span
              className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 font-semibold animate-pulse"
              data-testid="grace-float-badge"
            >
              🛡️ Flutuação Suave ({(graceFloatMs / 1000).toFixed(1)}s)
            </span>
          ) : buriedCount > 0 && activeSubGameStyle === 'TETRIS_CLASSIC' ? (
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
            <span className="text-emerald-300/85">
              {activeSubGameStyle === 'TACTILE_GRID'
                ? '❖ Arena 10×10 Sem Cortes'
                : '✦ Pilha Sem Cavidades'}
            </span>
          )}
        </div>
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

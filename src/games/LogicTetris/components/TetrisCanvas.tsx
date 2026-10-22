import React, { useEffect, useRef } from 'react'
import {
  ActivePiece,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GridCell,
} from '../types'
import { computeGhostY } from '../engine/gridEngine'
import { getPieceDefinition, getPieceOccupiedCells } from '../engine/tetrominoes'
import { LOCK_DELAY_LIMIT_MS, useLogicTetrisStore } from '../state/useLogicTetrisStore'

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

/**
 * Neon Genesis 2D Canvas Renderer for Logic Tetris (20×10 Base-10 Matrix).
 *
 * Incorporates Auditor Improvements:
 * - `Melhoria 04-A`: Base-10 Ruler `1..10` on top and bottom, central subitizing axis `5 | 6` ($5+5=10$),
 *   and glowing `+1`, `+2`, `+3` right-margin complement badges from `topology.rowComplements`.
 * - `Melhoria 04-B`: Protective `Grace Float` / `Bullet-Time` aura around `activePiece`, pulsing amber/gold
 *   reticles inside `topology.buriedCavities`, and dashed neon Ghost Piece with accessibility `symbol`.
 * - `Melhoria 04-C`: 60fps Canvas particle system triggered by `lastEventCounter` (`lastClearedRows`,
 *   `lastSealedCoords`, and piece metamorphosis) + crystal styling for `SEALED_GOLD` (`✦`) and `isMorphedBlock`.
 */
export const TetrisCanvas: React.FC<TetrisCanvasProps> = ({
  className = '',
  onCavityClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<CanvasParticle[]>([])
  const lastProcessedEventRef = useRef<number>(0)
  const lastMorphedPieceStateRef = useRef< string >('')

  // Subscribe to floatingFeedbacks and topology summary for accessible DOM overlay & ARIA
  const floatingFeedbacks = useLogicTetrisStore((s) => s.floatingFeedbacks)
  const buriedCount = useLogicTetrisStore((s) => s.topology.buriedCavities.length)
  const phase = useLogicTetrisStore((s) => s.phase)
  const graceFloatMs = useLogicTetrisStore((s) => s.activePiece.graceFloatMs ?? 0)

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

    const drawGridBlock = (
      context: CanvasRenderingContext2D,
      col: number,
      row: number,
      cell: GridCell,
      pulsePhase: number
    ) => {
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
        topology,
        phase: currentPhase,
        lastEventCounter,
        lastClearedRows,
        lastSealedCoords,
        lockDelayMs,
      } = state

      const pulsePhase = nowMs * 0.001

      // Detect new line-clear or hole-seal events to trigger 60fps Canvas particles (`Melhoria 04-C`)
      if (lastEventCounter !== lastProcessedEventRef.current) {
        lastProcessedEventRef.current = lastEventCounter
        if (lastClearedRows.length > 0) {
          spawnRowClearParticles(lastClearedRows)
        }
        if (lastSealedCoords.length > 0) {
          spawnSealedCavityParticles(lastSealedCoords)
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
      boardGrad.addColorStop(0, '#091122')
      boardGrad.addColorStop(0.5, '#0b1528')
      boardGrad.addColorStop(1, '#0f1c36')
      ctx.fillStyle = boardGrad
      ctx.fillRect(LEFT_GUTTER, TOP_RULER, BOARD_PIXEL_WIDTH, BOARD_PIXEL_HEIGHT)

      // Determine active piece occupied columns for dynamic Base-10 ruler highlight
      const activeCells =
        currentPhase === 'PLAYING' ||
        currentPhase === 'MATH_MORPH' ||
        currentPhase === 'MATH_FILL_HOLE' ||
        currentPhase === 'PAUSED'
          ? getPieceOccupiedCells(activePiece)
          : []
      const activeColsSet = new Set<number>(activeCells.map((c) => c.col))

      // 3. Draw subtle column bands & Base-10 Grid Lines
      for (let col = 0; col <= BOARD_WIDTH; col++) {
        const x = LEFT_GUTTER + col * CELL_SIZE

        // Highlight active piece column span softly
        if (col < BOARD_WIDTH && activeColsSet.has(col)) {
          ctx.fillStyle = 'rgba(34, 211, 238, 0.045)'
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

        if (row === 5 && topology.isDangerZone) {
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

      // 4. Draw Top & Bottom Base-10 Column Rulers `1..10` (`Melhoria 04-A`)
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
        // Bottom Ruler 1..10
        ctx.fillText(
          String(colNumber),
          xCenter,
          TOP_RULER + BOARD_PIXEL_HEIGHT + BOTTOM_RULER * 0.5
        )
      }

      // Draw tiny "5|5" subitizing marker on top and bottom axis divider
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(LEFT_GUTTER + 5 * CELL_SIZE, TOP_RULER - 2, 2.2, 0, Math.PI * 2)
      ctx.arc(LEFT_GUTTER + 5 * CELL_SIZE, TOP_RULER + BOARD_PIXEL_HEIGHT + 2, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // 5. Draw Left Gutter Height Markers & Right Gutter Base-10 Complement Badges (`+1, +2, +3` — `Melhoria 04-A`)
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
        const missingCount = topology.rowComplements[row]
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
            drawGridBlock(ctx, col, row, cell, pulsePhase)
          }
        }
      }

      // 7. Draw Pulsing Target Reticles inside Buried Cavities (`topology.buriedCavities` — `Melhoria 04-B`)
      if (topology.buriedCavities.length > 0) {
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

          // Draw target reticle symbol inside buried hole
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

      // 8. Draw Ghost Piece & Active Piece (when in active gameplay / modal phases)
      if (
        currentPhase === 'PLAYING' ||
        currentPhase === 'MATH_MORPH' ||
        currentPhase === 'MATH_FILL_HOLE' ||
        currentPhase === 'PAUSED'
      ) {
        const def = getPieceDefinition(activePiece.type)
        const ghostY = computeGhostY(grid, activePiece)

        // 8a. Ghost Piece with dashed neon border & accessibility symbol (`Melhoria 04-B`)
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

        // 8b. Active Piece + Grace Float / Bullet-Time Protective Halo (`Melhoria 04-B`)
        const isGraceActive = (activePiece.graceFloatMs ?? 0) > 0
        const isBulletTime =
          currentPhase === 'MATH_MORPH' || currentPhase === 'MATH_FILL_HOLE'

        for (const { row, col } of activeCells) {
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
            pulsePhase
          )

          // Protective Grace Float or Bullet-Time Halo around each active piece cell (`Melhoria 04-B`)
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

        // 8c. Visual Lock-Delay progress indicator when piece is resting on floor (`500ms`)
        if (lockDelayMs > 0 && activeCells.length > 0) {
          const maxRow = Math.max(...activeCells.map((c) => c.row))
          const minCol = Math.min(...activeCells.map((c) => c.col))
          const maxCol = Math.max(...activeCells.map((c) => c.col))
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

      // 9. Update and Render 60fps Canvas Particles (`Melhoria 04-C`)
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

  return (
    <div className={`lt-canvas-stage relative select-none ${className}`}>
      {/* Top Pedagogical Status Pill (Grace Float / Buried Cavity Alert) */}
      <div className="lt-canvas-header-strip flex items-center justify-between px-2 py-1 text-[11px] font-mono">
        <span className="text-cyan-300/90 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>GRADE BASE-10 (5 + 5 = 10)</span>
        </span>

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

      {/* Main 20x10 Base-10 Canvas */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_LOGICAL_WIDTH}
          height={CANVAS_LOGICAL_HEIGHT}
          className="lt-board-canvas block rounded-xl border border-slate-700/80 shadow-2xl"
          aria-label="Tabuleiro Logic Tetris Gênesis 20 por 10"
          data-testid="logic-tetris-canvas"
          data-phase={phase}
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

import { useEffect } from 'react'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../engine/constants'
import type { GameEngineState } from '../hooks/useGameEngine'

interface GameCanvasProps {
  uiState: GameEngineState
  onMouseDown: (e: MouseEvent | TouchEvent) => void
  onMouseMove: (e: MouseEvent | TouchEvent) => void
  onMouseUp: (e: MouseEvent | TouchEvent) => void
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export function GameCanvas({
  uiState,
  canvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: GameCanvasProps) {
  const { gameState } = uiState

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => { onMouseDown(e); onMouseMove(e) }
    const handleMouseMove = (e: MouseEvent) => onMouseMove(e)
    const handleMouseUp = (e: MouseEvent) => { onMouseMove(e); onMouseUp(e) }
    const handleTouchStart = (e: TouchEvent) => { e.preventDefault(); onTouchStart(e); onTouchMove(e) }
    const handleTouchMove = (e: TouchEvent) => { e.preventDefault(); onTouchMove(e) }
    const handleTouchEnd = (e: TouchEvent) => { e.preventDefault(); onTouchEnd(e) }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [canvasRef, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd])

  const isCinematic = gameState === 'CINEMATIC'

  return (
    <canvas
      ref={canvasRef}
      id="gameCanvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        display: 'block',
        cursor: 'crosshair',
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: 1,
      }}
      className={isCinematic ? 'cinematic-canvas' : ''}
    />
  )
}

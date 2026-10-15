import React from 'react'
import { useCanvasStore } from '../../store/useCanvasStore'

interface CadEuclideanRulersProps {
  isInteractive: boolean
}

const HORIZONTAL_MM_TICKS = Array.from({ length: 22 }, (_, i) => i * 10) // 0mm a 210mm
const VERTICAL_MM_TICKS = Array.from({ length: 30 }, (_, i) => i * 10)   // 0mm a 290mm

export const CadEuclideanRulers: React.FC<CadEuclideanRulersProps> = ({ isInteractive }) => {
  const { showCadRulers, showCadGrid, activeSnapLines } = useCanvasStore()

  if (!isInteractive) return null

  return (
    <div
      className="cv-cad-euclidean-overlay cv-no-print"
      data-cv-interactive="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        overflow: 'hidden'
      }}
    >
      {/* 1. Grade Técnica Milimetrada estilo AutoCAD */}
      {showCadGrid && (
        <div
          className="cv-cad-grid-mesh cv-no-print"
          data-cv-interactive="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(to right, rgba(56, 189, 248, 0.16) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.16) 1px, transparent 1px),
              linear-gradient(to right, rgba(56, 189, 248, 0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '9.5238% 6.734%, 9.5238% 6.734%, 2.3809% 1.6835%, 2.3809% 1.6835%'
          }}
        />
      )}

      {/* 2. Régua Horizontal Superior (0 a 210mm) */}
      {showCadRulers && (
        <div
          className="cv-cad-ruler-horizontal cv-no-print"
          data-cv-interactive="true"
        >
          {HORIZONTAL_MM_TICKS.map((mm) => {
            const leftPct = (mm / 210) * 100
            if (leftPct > 100) return null
            return (
              <div
                key={`h-${mm}`}
                className="cv-cad-ruler-tick-h"
                style={{ left: `${leftPct}%` }}
              >
                <span className="cv-cad-ruler-label">{mm}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Régua Vertical Esquerda (0 a 297mm) */}
      {showCadRulers && (
        <div
          className="cv-cad-ruler-vertical cv-no-print"
          data-cv-interactive="true"
        >
          {VERTICAL_MM_TICKS.map((mm) => {
            const topPct = (mm / 297) * 100
            if (topPct > 100) return null
            return (
              <div
                key={`v-${mm}`}
                className="cv-cad-ruler-tick-v"
                style={{ top: `${topPct}%` }}
              >
                <span className="cv-cad-ruler-label">{mm}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Linhas Laser de Alinhamento Magnético (OSNAP AutoCAD) */}
      {activeSnapLines.map((line, i) =>
        line.type === 'x' ? (
          <div
            key={`snap-x-${i}`}
            className="cv-cad-snap-line-x cv-no-print"
            data-cv-interactive="true"
            style={{ left: `${line.posPct}%` }}
          >
            {line.label && <span className="cv-cad-snap-badge">{line.label}</span>}
          </div>
        ) : (
          <div
            key={`snap-y-${i}`}
            className="cv-cad-snap-line-y cv-no-print"
            data-cv-interactive="true"
            style={{ top: `${line.posPct}%` }}
          >
            {line.label && <span className="cv-cad-snap-badge">{line.label}</span>}
          </div>
        )
      )}
    </div>
  )
}

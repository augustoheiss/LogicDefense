import type { Point } from '../types/game'

export type MapPath = Point[]

export let mapPaths: MapPath[] = []
export let mapPhase = 1
export let totalRotations = 0
export let currentMapAngle = 0

export function generateMapPaths(): void {
  if (mapPhase === 1) {
    mapPaths = [
      [
        { x: 0, y: 150 }, { x: 700, y: 150 }, { x: 700, y: 350 },
        { x: 100, y: 350 }, { x: 100, y: 500 }, { x: 800, y: 500 },
      ],
    ]
  } else if (mapPhase === 2) {
    mapPaths = [
      [{ x: 0, y: 300 }, { x: 200, y: 300 }, { x: 400, y: 100 }, { x: 600, y: 300 }, { x: 800, y: 300 }],
      [{ x: 0, y: 300 }, { x: 200, y: 300 }, { x: 400, y: 500 }, { x: 600, y: 300 }, { x: 800, y: 300 }],
      [{ x: 0, y: 300 }, { x: 200, y: 300 }, { x: 400, y: 300 }, { x: 600, y: 300 }, { x: 800, y: 300 }],
    ]
  } else {
    mapPaths = [
      [{ x: 0, y: 400 }, { x: 200, y: 150 }, { x: 400, y: 400 }, { x: 550, y: 250 }, { x: 700, y: 400 }, { x: 800, y: 400 }],
      [{ x: 0, y: 400 }, { x: 200, y: 150 }, { x: 400, y: 400 }, { x: 550, y: 550 }, { x: 700, y: 400 }, { x: 800, y: 400 }],
      [{ x: 0, y: 400 }, { x: 200, y: 150 }, { x: 400, y: 400 }, { x: 550, y: 400 }, { x: 700, y: 400 }, { x: 800, y: 400 }],
    ]
  }
}

export function advanceRotation(): void {
  const angle = Math.PI / 4
  currentMapAngle += angle
  totalRotations++

  if (totalRotations >= 8) {
    mapPhase++
    if (mapPhase > 3) mapPhase = 1
    totalRotations = 0
    generateMapPaths()
  }
}

export function resetMap(): void {
  mapPhase = 1
  totalRotations = 0
  currentMapAngle = 0
  generateMapPaths()
}

export function generateEnemyRoute(): Point[] {
  const routeBase = mapPaths[Math.floor(Math.random() * mapPaths.length)]
  const route: Point[] = routeBase.map(p => ({ x: p.x, y: p.y }))
  const isReverse = Math.random() > 0.5
  if (isReverse) route.reverse()

  if (currentMapAngle !== 0) {
    const cx = 400, cy = 300
    const cosA = Math.cos(currentMapAngle)
    const sinA = Math.sin(currentMapAngle)
    route.forEach(p => {
      const nx = cx + (p.x - cx) * cosA - (p.y - cy) * sinA
      const ny = cy + (p.x - cx) * sinA + (p.y - cy) * cosA
      p.x = nx
      p.y = ny
    })
  }
  return route
}

export function getRotatedPaths(): MapPath[] {
  const cx = 400, cy = 300
  const cosA = Math.cos(currentMapAngle)
  const sinA = Math.sin(currentMapAngle)
  return mapPaths.map(path =>
    path.map(p => ({
      x: cx + (p.x - cx) * cosA - (p.y - cy) * sinA,
      y: cy + (p.x - cx) * sinA + (p.y - cy) * cosA,
    }))
  )
}

export function distToSegment(
  x: number, y: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1
  const dot = A * C + B * D
  const len_sq = C * C + D * D
  let param = -1
  if (len_sq !== 0) param = dot / len_sq
  let xx: number, yy: number
  if (param < 0) { xx = x1; yy = y1 }
  else if (param > 1) { xx = x2; yy = y2 }
  else { xx = x1 + param * C; yy = y1 + param * D }
  const dx = x - xx, dy = y - yy
  return Math.sqrt(dx * dx + dy * dy)
}

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

export function isPointOnRotatedPath(x: number, y: number, clearance = 28): boolean {
  const currentPaths = getRotatedPaths()
  for (const path of currentPaths) {
    for (let i = 0; i < path.length - 1; i++) {
      if (distToSegment(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y) < clearance) {
        return true
      }
    }
  }
  return false
}

/**
 * Repositions any tower that ended up colliding with the newly rotated path
 * to the nearest valid radial coordinate, preventing unfair overlaps after map rotation.
 */
export function relocateCollidingTowers<T extends { x: number; y: number }>(
  towers: T[],
  canvasWidth = 800,
  canvasHeight = 600,
): number {
  let relocatedCount = 0
  const margin = 24

  for (const tower of towers) {
    if (!isPointOnRotatedPath(tower.x, tower.y, 28)) continue

    let found = false
    for (let radius = 18; radius <= 220 && !found; radius += 12) {
      for (let step = 0; step < 16; step++) {
        const angle = (step * Math.PI * 2) / 16
        const nx = Math.round(tower.x + Math.cos(angle) * radius)
        const ny = Math.round(tower.y + Math.sin(angle) * radius)

        if (nx < margin || nx > canvasWidth - margin || ny < margin || ny > canvasHeight - margin) {
          continue
        }
        if (isPointOnRotatedPath(nx, ny, 30)) continue

        const overlapsOther = towers.some(
          other => other !== tower && Math.hypot(other.x - nx, other.y - ny) < 35,
        )
        if (!overlapsOther) {
          tower.x = nx
          tower.y = ny
          relocatedCount++
          found = true
          break
        }
      }
    }
  }

  return relocatedCount
}


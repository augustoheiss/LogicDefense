// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/chasePath.ts — S1: BFS de Perseguição no Toro
// MASTER_PLAN_V4 §2.2, §2.5 & §5 (Mitigação Red Team de travessia de borda)
// ──────────────────────────────────────────────────────────────────────────────
import {
  getPassableNeighbors,
  GridCoord,
  torusManhattan,
  TorusMazeGrid,
  wrapCell,
} from './torusGrid'

export interface ChasePathResult {
  /** Lista ordenada de células do caminho (incluindo origem no índice 0 e destino no final) */
  path: GridCoord[]
  /** Próximo passo imediato para a cabeça do dragão */
  nextStep: GridCoord
  /** Se o caminho ótimo atravessa a emenda toroidal do mapa */
  crossesSeam: boolean
  /** Distância em passos no grafo toroidal */
  steps: number
}

function didStepCrossSeam(a: GridCoord, b: GridCoord): boolean {
  return Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1
}

/**
 * Executa BFS na grade 48×48 (2.304 nós) considerando vizinhos em módulo (toro).
 * Mitigação Red Team (§5): Se `allowBorderShortcut` for falso ou se atravessar a borda
 * colocaria a cabeça a menos de 4 células do herói logo após a costura, prefere rota interna.
 */
export function findToroidalChasePath(
  grid: TorusMazeGrid,
  fromRaw: GridCoord,
  toRaw: GridCoord,
  enforceBorderFairness = true,
): ChasePathResult {
  const start = wrapCell(fromRaw.x, fromRaw.y, grid.width, grid.height)
  const goal = wrapCell(toRaw.x, toRaw.y, grid.width, grid.height)

  if (start.x === goal.x && start.y === goal.y) {
    return {
      path: [start],
      nextStep: start,
      crossesSeam: false,
      steps: 0,
    }
  }

  const total = grid.width * grid.height
  const parent = new Int32Array(total).fill(-1)
  const visited = new Uint8Array(total)

  const startIdx = start.y * grid.width + start.x
  const goalIdx = goal.y * grid.width + goal.x

  const queue = new Int32Array(total)
  let qHead = 0
  let qTail = 0

  visited[startIdx] = 1
  queue[qTail++] = startIdx

  while (qHead < qTail) {
    const curIdx = queue[qHead++]
    if (curIdx === goalIdx) break

    const cx = curIdx % grid.width
    const cy = Math.floor(curIdx / grid.width)
    const neighbors = getPassableNeighbors(grid, cx, cy)

    for (let i = 0; i < neighbors.length; i++) {
      const nb = neighbors[i]
      // Mitigação Red Team (§5): só permite atravessar a costura da borda se
      // a célula pós-travessia estiver a >= 4 células de distância do herói
      if (enforceBorderFairness && didStepCrossSeam({ x: cx, y: cy }, nb)) {
        const distAfterCross = torusManhattan(
          nb.x,
          nb.y,
          goal.x,
          goal.y,
          grid.width,
          grid.height,
        )
        if (distAfterCross < 4) {
          continue
        }
      }

      const nbIdx = nb.y * grid.width + nb.x
      if (visited[nbIdx] === 0) {
        visited[nbIdx] = 1
        parent[nbIdx] = curIdx
        queue[qTail++] = nbIdx
      }
    }
  }

  // Caso a restrição de borda tenha bloqueado o único caminho curto, faz fallback sem restrição
  if (visited[goalIdx] === 0 && enforceBorderFairness) {
    return findToroidalChasePath(grid, start, goal, false)
  }

  if (visited[goalIdx] === 0) {
    return {
      path: [start],
      nextStep: start,
      crossesSeam: false,
      steps: 0,
    }
  }

  const revPath: GridCoord[] = []
  let cur = goalIdx
  let crossesSeam = false
  while (cur !== -1) {
    const x = cur % grid.width
    const y = Math.floor(cur / grid.width)
    revPath.push({ x, y })
    const prev = parent[cur]
    if (prev !== -1) {
      const px = prev % grid.width
      const py = Math.floor(prev / grid.width)
      if (didStepCrossSeam({ x: px, y: py }, { x, y })) {
        crossesSeam = true
      }
    }
    cur = prev
  }

  revPath.reverse()
  return {
    path: revPath,
    nextStep: revPath[1] ?? start,
    crossesSeam,
    steps: Math.max(0, revPath.length - 1),
  }
}

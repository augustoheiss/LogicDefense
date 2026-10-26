// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/serpentSim.ts — S2/S4: Simulação Pura da Serpente
// MASTER_PLAN_V4 §2.2, §2.3, §2.5 & §4: Testável sem tela (headless), 0 pausa automática
// ──────────────────────────────────────────────────────────────────────────────
import { TrapHit } from '../../types'
import { getComboMultiplier } from '../engineContract'
import { ChasePathResult, findToroidalChasePath } from './chasePath'
import {
  DragonSegmentSpec,
  generateSerpentLevel,
  SerpentCoinNode,
  SerpentLevelConfig,
  SerpentMathPad,
  SerpentTntBarrel,
} from './serpentLevels'
import {
  getPassableNeighbors,
  GridCoord,
  isWalkableCell,
  torusDelta,
  torusEuclidean,
  TorusMazeGrid,
  wrapCoord,
} from './torusGrid'

export interface ActiveDragonSegment extends DragonSegmentSpec {
  x: number
  y: number
}

export interface SerpentShotEvent {
  fromX: number
  fromY: number
  toX: number
  toY: number
  damage: number
  label: string
  isGoldenPop: boolean
  isTntBlast: boolean
}

export interface SerpentInput {
  dx: number
  dy: number
}

export class SerpentSimulation {
  public readonly grid: TorusMazeGrid
  public readonly seed: number
  public readonly level: number
  public readonly maxDurationMs = 90_000

  public hero = {
    x: 24,
    y: 24,
    hearts: 3,
    maxHearts: 3,
    invulnMs: 0,
    arrowDamage: 2,
    armyPower: 12,
    speedCellsPerSec: 4.4,
  }

  public dragon = {
    headX: 12,
    headY: 12,
    baseSpeedRatio: 0.85,
    trail: [] as GridCoord[],
    segments: [] as ActiveDragonSegment[],
    lastChasePath: null as ChasePathResult | null,
    crossedSeamRecently: false,
  }

  public pads: SerpentMathPad[]
  public tnts: SerpentTntBarrel[]
  public coins: SerpentCoinNode[]

  public elapsedMs = 0
  public chaseRecalcTimerMs = 250
  public fireTimerMs = 200
  public dragonStepProgress = 0

  public comboStreak = 0
  public comboMultiplier = 1
  public maxCombo = 1
  public optimalChoices = 0
  public coinsEarned = 0
  public tokensEarned = 0
  public segmentsDestroyed = 0
  public trapHits: TrapHit[] = []
  public recentShots: SerpentShotEvent[] = []
  public status: 'RUNNING' | 'VICTORY' | 'DEFEAT' = 'RUNNING'

  constructor(config: SerpentLevelConfig) {
    this.seed = config.seed
    this.level = config.level
    this.grid = config.grid
    this.hero.x = config.heroStart.x
    this.hero.y = config.heroStart.y
    this.hero.arrowDamage = config.initialArrowDamage
    this.hero.armyPower = config.initialArmyPower

    this.dragon.headX = config.dragonStart.x
    this.dragon.headY = config.dragonStart.y

    // Inicializar trilha inicial sem sobreposição para estender o corpo da serpente pelos corredores superiores
    const initialTrail: GridCoord[] = [{ x: config.dragonStart.x, y: config.dragonStart.y }]
    const usedTrail = new Set<string>([`${config.dragonStart.x},${config.dragonStart.y}`])
    let cur = { x: config.dragonStart.x, y: config.dragonStart.y }
    for (let i = 1; i < config.segments.length + 4; i++) {
      const nbs = getPassableNeighbors(this.grid, cur.x, cur.y)
      const unvisited = nbs.filter(
        (nb) =>
          !usedTrail.has(`${nb.x},${nb.y}`) &&
          (nb.x !== config.heroStart.x || nb.y !== config.heroStart.y),
      )
      // Preferir estender para cima/lados dentro do quadro visível da câmera
      unvisited.sort((a, b) => a.y - b.y)
      cur = unvisited[0] ?? nbs[i % Math.max(1, nbs.length)] ?? cur
      usedTrail.add(`${cur.x},${cur.y}`)
      initialTrail.push({ x: cur.x, y: cur.y })
    }
    this.dragon.trail = initialTrail
    this.dragon.segments = config.segments.map((seg, idx) => {
      const pt = initialTrail[Math.min(idx, initialTrail.length - 1)]
      return {
        ...seg,
        x: pt.x,
        y: pt.y,
      }
    })

    this.pads = config.pads.map((p) => ({ ...p }))
    this.tnts = config.tnts.map((t) => ({ ...t }))
    this.coins = config.coins.map((c) => ({ ...c }))

    // Calcular rota inicial no instante t = 0
    this.recalculateChasePath()
  }

  public static fromSeed(
    seed: number,
    level = 1,
    initialArmyPower = 12,
  ): SerpentSimulation {
    return new SerpentSimulation(
      generateSerpentLevel(seed, level, initialArmyPower),
    )
  }

  private recalculateChasePath(): void {
    const heroCell = {
      x: wrapCoord(Math.round(this.hero.x), this.grid.width),
      y: wrapCoord(Math.round(this.hero.y), this.grid.height),
    }
    const headCell = {
      x: wrapCoord(Math.round(this.dragon.headX), this.grid.width),
      y: wrapCoord(Math.round(this.dragon.headY), this.grid.height),
    }
    const res = findToroidalChasePath(this.grid, headCell, heroCell, true)
    this.dragon.lastChasePath = res
    this.dragon.crossedSeamRecently = res.crossesSeam
  }

  public getAliveSegments(): ActiveDragonSegment[] {
    return this.dragon.segments.filter((s) => s.hp > 0)
  }

  public getTotalRemainingDragonHp(): number {
    return this.dragon.segments.reduce((acc, s) => acc + Math.max(0, s.hp), 0)
  }

  /**
   * Permite ao jogador ativar ou guiar o herói até uma placa específica (acessibilidade/toque rápido)
   * ou pisar diretamente nela durante o movimento no labirinto.
   */
  public applyMathPad(pad: SerpentMathPad): void {
    if (pad.used || this.status !== 'RUNNING') return
    pad.used = true

    const prevPower = this.hero.armyPower
    const prevDmg = this.hero.arrowDamage

    if (pad.op === '×') {
      this.hero.arrowDamage = Math.min(64, Math.max(1, prevDmg * pad.operand))
      this.hero.armyPower = Math.max(0, Math.round(prevPower * pad.operand))
    } else if (pad.op === '+') {
      this.hero.arrowDamage = Math.min(64, prevDmg + pad.operand)
      this.hero.armyPower = Math.max(0, prevPower + pad.operand)
    } else if (pad.op === '^2') {
      this.hero.arrowDamage = Math.min(64, Math.max(2, prevDmg * prevDmg))
      this.hero.armyPower = Math.max(0, prevPower + prevDmg * 4)
    } else if (pad.op === '÷') {
      this.hero.arrowDamage = Math.max(1, Math.floor(prevDmg / Math.max(1, pad.operand)))
      this.hero.armyPower = Math.max(0, Math.floor(prevPower / Math.max(1, pad.operand)))
    } else if (pad.op === '−') {
      this.hero.arrowDamage = Math.max(1, prevDmg - pad.operand)
      this.hero.armyPower = Math.max(0, prevPower - pad.operand)
    }

    if (pad.isTrap) {
      this.comboStreak = 0
      this.comboMultiplier = 1
      this.tokensEarned += 1
      const loss = Math.max(1, prevPower - this.hero.armyPower)
      this.trapHits.push({
        trapId: pad.trapId ?? 'T06',
        trapName: pad.trapName ?? 'Placa Armadilha no Labirinto',
        conceptId: 'divisao_euclidiana_resto',
        segmentId: pad.id,
        chosenLane: 0,
        betterLane: 1,
        armyBefore: prevPower,
        chosenResult: this.hero.armyPower,
        counterfactualResult: prevPower * 2,
        loss,
        lossRatio: loss / Math.max(1, prevPower * 2),
        intuitionTrapPt: `Pisar na placa ${pad.label} reduziu a força de disparo.`,
        luzGuiaPt:
          pad.luzGuiaPt ??
          'Placas roxas/vermelhas dividem ou subtraem seu poder; desvie pelos corredores laterais!',
        codexSlug: 'divisao-e-multiplos',
      })
    } else {
      this.comboStreak += 1
      this.optimalChoices += 1
      this.comboMultiplier = getComboMultiplier(this.comboStreak)
      if (this.comboMultiplier > this.maxCombo) {
        this.maxCombo = this.comboMultiplier
      }
      this.coinsEarned += Math.round(5 * this.comboMultiplier)
    }
  }

  /**
   * Passo de simulação pura (headless-compatible).
   */
  public tick(dtMs: number, input: SerpentInput = { dx: 0, dy: 0 }): void {
    if (this.status !== 'RUNNING') return
    const clampedDtMs = Math.min(100, Math.max(1, dtMs))
    const dtSec = clampedDtMs / 1000
    this.elapsedMs += clampedDtMs
    this.recentShots = []

    if (this.hero.invulnMs > 0) {
      this.hero.invulnMs = Math.max(0, this.hero.invulnMs - clampedDtMs)
    }

    // 1. Movimento contínuo do Herói com wrap toroidal (x mod W, y mod H)
    const inLen = Math.hypot(input.dx, input.dy)
    if (inLen > 0.05) {
      const nx = input.dx / inLen
      const ny = input.dy / inLen
      const stepDist = this.hero.speedCellsPerSec * dtSec

      const candX = wrapCoord(this.hero.x + nx * stepDist, this.grid.width)
      const candY = wrapCoord(this.hero.y + ny * stepDist, this.grid.height)

      if (isWalkableCell(this.grid, Math.round(candX), Math.round(candY))) {
        this.hero.x = candX
        this.hero.y = candY
      } else if (isWalkableCell(this.grid, Math.round(candX), Math.round(this.hero.y))) {
        this.hero.x = candX
      } else if (isWalkableCell(this.grid, Math.round(this.hero.x), Math.round(candY))) {
        this.hero.y = candY
      }
    }

    // 2. Verificar coleta de Placas Matemáticas e Moedas pelo Herói
    for (const pad of this.pads) {
      if (pad.used) continue
      if (torusEuclidean(this.hero.x, this.hero.y, pad.x, pad.y) <= 0.85) {
        this.applyMathPad(pad)
      }
    }

    for (const coin of this.coins) {
      if (coin.collected) continue
      if (torusEuclidean(this.hero.x, this.hero.y, coin.x, coin.y) <= 0.95) {
        coin.collected = true
        this.coinsEarned += coin.value
        this.hero.armyPower += 1
      }
    }

    // 3. Recalcular BFS da Serpente a cada 250ms (§2.2 & §2.5)
    this.chaseRecalcTimerMs += clampedDtMs
    if (this.chaseRecalcTimerMs >= 250 || !this.dragon.lastChasePath) {
      this.chaseRecalcTimerMs = 0
      this.recalculateChasePath()
    }

    // 4. Avançar a Cabeça do Dragão pelo caminho mais curto no toro
    // Velocidade ≈ 85% do herói no início, sobe 2% a cada 10s (§2.2)
    const tenSecIntervals = Math.floor(this.elapsedMs / 10_000)
    const speedRatio = this.dragon.baseSpeedRatio + tenSecIntervals * 0.02
    const dragonSpeed = this.hero.speedCellsPerSec * speedRatio
    this.dragonStepProgress += dragonSpeed * dtSec

    while (this.dragonStepProgress >= 1) {
      this.dragonStepProgress -= 1
      this.recalculateChasePath()
      const nextCell = this.dragon.lastChasePath?.nextStep
      if (nextCell) {
        this.dragon.headX = nextCell.x
        this.dragon.headY = nextCell.y
        this.dragon.trail.unshift({ x: nextCell.x, y: nextCell.y })
        if (this.dragon.trail.length > 32) {
          this.dragon.trail.pop()
        }
      }
    }

    // Atualizar coordenadas dos segmentos vivos ao longo da trilha da cabeça
    const aliveSegs = this.getAliveSegments()
    for (let i = 0; i < aliveSegs.length; i++) {
      const seg = aliveSegs[i]
      if (i === 0) {
        const nextCell = this.dragon.lastChasePath?.nextStep
        if (nextCell) {
          const dx = torusDelta(this.dragon.headX, nextCell.x, this.grid.width)
          const dy = torusDelta(this.dragon.headY, nextCell.y, this.grid.height)
          seg.x = wrapCoord(this.dragon.headX + dx * this.dragonStepProgress * 0.4, this.grid.width)
          seg.y = wrapCoord(this.dragon.headY + dy * this.dragonStepProgress * 0.4, this.grid.height)
        } else {
          seg.x = this.dragon.headX
          seg.y = this.dragon.headY
        }
      } else {
        const trailPt = this.dragon.trail[Math.min(i, this.dragon.trail.length - 1)]
        seg.x = trailPt.x
        seg.y = trailPt.y
      }
    }

    // 5. Tiro automático contínuo do Herói desde o 1º segundo (§2.2 & UAT-02)
    this.fireTimerMs += clampedDtMs
    const fireIntervalMs = 210
    if (this.fireTimerMs >= fireIntervalMs && aliveSegs.length > 0) {
      this.fireTimerMs = 0

      // Verifica primeiro se há um barril de TNT perto de algum segmento do dragão
      let triggeredTnt: SerpentTntBarrel | null = null
      for (const tnt of this.tnts) {
        if (tnt.exploded) continue
        const nearDragon = aliveSegs.some(
          (s) => torusEuclidean(tnt.x, tnt.y, s.x, s.y) <= tnt.radiusCells,
        )
        const nearHero = torusEuclidean(this.hero.x, this.hero.y, tnt.x, tnt.y) <= 9
        if (nearDragon && nearHero) {
          triggeredTnt = tnt
          break
        }
      }

      if (triggeredTnt) {
        triggeredTnt.exploded = true
        for (const seg of aliveSegs) {
          if (seg.isHead && aliveSegs.length > 1) continue
          if (torusEuclidean(triggeredTnt.x, triggeredTnt.y, seg.x, seg.y) <= triggeredTnt.radiusCells) {
            seg.hp = Math.max(0, seg.hp - triggeredTnt.damage)
            if (seg.hp === 0) {
              this.onSegmentDestroyed()
            }
          }
        }
        this.recentShots.push({
          fromX: this.hero.x,
          fromY: this.hero.y,
          toX: triggeredTnt.x,
          toY: triggeredTnt.y,
          damage: triggeredTnt.damage,
          label: `💥 ${triggeredTnt.label}`,
          isGoldenPop: false,
          isTntBlast: true,
        })
      } else {
        // Cabeça só fica vulnerável quando a cauda some (§2.2)
        const nonHeadAlive = aliveSegs.filter((s) => !s.isHead)
        const targetPool = nonHeadAlive.length > 0 ? nonHeadAlive : aliveSegs
        // Prioriza o último segmento da cauda ("limpar de trás para frente") ou o mais próximo
        let target = targetPool[targetPool.length - 1]
        let bestScore = Infinity
        for (const cand of targetPool) {
          const dist = torusEuclidean(this.hero.x, this.hero.y, cand.x, cand.y)
          // Favorece limpar a ponta da cauda + proximidade
          const score = dist - cand.index * 1.15
          if (score < bestScore) {
            bestScore = score
            target = cand
          }
        }

        const dmg = Math.max(1, this.hero.arrowDamage)
        // §2.3: Segmento-alvo dourado — se o dano atual divide exatamente o número (com dmg >= 2), estoura de uma vez e dá ×3 moedas!
        const isExactGoldenDivisor =
          target.isGolden && dmg >= 2 && target.hp > dmg && target.hp % dmg === 0

        const appliedDmg = isExactGoldenDivisor ? target.hp : dmg
        target.hp = Math.max(0, target.hp - appliedDmg)

        if (target.hp === 0) {
          this.onSegmentDestroyed(isExactGoldenDivisor)
        }

        this.recentShots.push({
          fromX: this.hero.x,
          fromY: this.hero.y,
          toX: target.x,
          toY: target.y,
          damage: appliedDmg,
          label: isExactGoldenDivisor ? `★ ÷EXATO −${appliedDmg}!` : `−${appliedDmg}`,
          isGoldenPop: isExactGoldenDivisor,
          isTntBlast: false,
        })
      }
    }

    // 6. Verificar contato Dragão ↔ Herói (§2.2: perde 1 coração de 3, 1.5s invulnerável, sem pausa)
    const remainingSegs = this.getAliveSegments()
    if (remainingSegs.length > 0 && this.hero.invulnMs <= 0) {
      const headDist = torusEuclidean(
        this.hero.x,
        this.hero.y,
        this.dragon.headX,
        this.dragon.headY,
      )
      const bodyHit = remainingSegs.some(
        (s) => torusEuclidean(this.hero.x, this.hero.y, s.x, s.y) <= 0.85,
      )
      if (headDist <= 0.95 || bodyHit) {
        this.hero.hearts = Math.max(0, this.hero.hearts - 1)
        this.hero.invulnMs = 1500
        this.hero.armyPower = Math.max(0, this.hero.armyPower - 3)
        if (this.hero.hearts <= 0) {
          this.status = 'DEFEAT'
          return
        }
      }
    }

    // 7. Verificar Vitória (§2.2: zerar todos os segmentos ou sobreviver 90 s)
    if (this.getAliveSegments().length === 0 || this.elapsedMs >= this.maxDurationMs) {
      this.status = 'VICTORY'
    }
  }

  private onSegmentDestroyed(isGoldenTriple = false): void {
    this.segmentsDestroyed += 1
    const coinBonus = Math.round(
      (isGoldenTriple ? 18 : 6) * this.comboMultiplier,
    )
    this.coinsEarned += coinBonus
    this.hero.armyPower += isGoldenTriple ? 9 : 3
  }
}

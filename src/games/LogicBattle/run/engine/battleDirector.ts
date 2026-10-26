// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/engine/battleDirector.ts — Orquestrador do Combate Final (Fase BATTLE)
// ──────────────────────────────────────────────────────────────────────────────
import {
  BattleTimeline,
  BattleTimelineSample,
  buildBattleTimeline,
} from '../../domain/battleTimeline'
import { detectEmprestaUmSplit, formatArmy } from '../../domain/notation'
import {
  ArmyCount,
  BattleResolution,
  CrowdSpriteNode,
  EnemySpec,
  MergeAnimationEvent,
  NotationMode,
} from '../../types'
import { FortressRenderState } from '../renderer/battleRenderer'
import { ParticlePool } from '../renderer/fxParticles'
import { ProjectileKind, ProjectilePool } from '../renderer/projectilePool'

export interface BattleDirectorCallbacks {
  onArmyUpdate: (newArmy: ArmyCount, splitEvent: MergeAnimationEvent | null) => void
  onVolleySound?: (kind: ProjectileKind) => void
  onBattleFinished: () => void
}

export class BattleDirector {
  private timeline: BattleTimeline | null = null
  private elapsedMs = 0
  private volleyTimerMs = 0
  private enemyBoltTimerMs = 0
  private damageTextTimerMs = 0
  private armySyncTimerMs = 0
  private lastPlayerLeft: ArmyCount = 0
  private lastKillsSoFar: ArmyCount = 0
  private hitFlashAlpha = 0
  private speedMultiplier = 1
  private finishedCalled = false

  public start(
    resolution: BattleResolution,
    enemy: EnemySpec,
    reducedMotion: boolean,
    projectilePool: ProjectilePool,
  ): void {
    this.timeline = buildBattleTimeline(resolution, enemy, { reducedMotion })
    this.elapsedMs = 0
    this.volleyTimerMs = 0
    this.enemyBoltTimerMs = 120
    this.damageTextTimerMs = 0
    this.armySyncTimerMs = 0
    this.lastPlayerLeft = this.timeline.initialPlayer
    this.lastKillsSoFar = 0
    this.hitFlashAlpha = 0
    this.speedMultiplier = 1
    this.finishedCalled = false
    projectilePool.clear()
  }

  public stop(projectilePool: ProjectilePool): void {
    this.timeline = null
    this.finishedCalled = false
    projectilePool.clear()
  }

  public setFastForward(fast: boolean): void {
    this.speedMultiplier = fast ? 3 : 1
  }

  public isFastForward(): boolean {
    return this.speedMultiplier > 1
  }

  public stepAndDraw(
    ctx: CanvasRenderingContext2D,
    dtMs: number,
    playerCenter: { x: number; y: number },
    fortressTargets: { bossCenterX: number; bossCenterY: number; hordeCenterY: number },
    crowdNodes: readonly CrowdSpriteNode[],
    notationMode: NotationMode,
    reducedMotion: boolean,
    projectilePool: ProjectilePool,
    particles: ParticlePool,
    nowPerfMs: number,
    callbacks: BattleDirectorCallbacks,
  ): FortressRenderState | undefined {
    if (!this.timeline) return undefined

    const scaledDt = dtMs * this.speedMultiplier
    this.elapsedMs += scaledDt
    this.hitFlashAlpha = Math.max(0, this.hitFlashAlpha - dtMs * 0.004)

    const sample: BattleTimelineSample = this.timeline.sampleAt(this.elapsedMs)
    this.armySyncTimerMs += dtMs
    const isFinalSample = this.elapsedMs >= this.timeline.durationMs

    // 1. Re-decompor a multidão a cada 100 ms (10 Hz, §2 & §3.2) ou imediatamente em Empresta-Um / frame final
    if (
      sample.playerLeft !== this.lastPlayerLeft &&
      (this.armySyncTimerMs >= 100 || isFinalSample)
    ) {
      this.armySyncTimerMs = 0
      const splitRaw = detectEmprestaUmSplit(
        this.lastPlayerLeft,
        sample.playerLeft,
      )
      const splitEvt: MergeAnimationEvent | null = splitRaw
        ? {
            id: `split_${nowPerfMs}`,
            fromTierLabel: splitRaw.fromTier.denominationLabel,
            toTierLabel: splitRaw.toTier.denominationLabel,
            formulaLabel: splitRaw.formulaLabel,
            startedAtMs: nowPerfMs,
            direction: 'split',
          }
        : null
      this.lastPlayerLeft = sample.playerLeft
      callbacks.onArmyUpdate(sample.playerLeft, splitEvt)
    }

    // 2. Disparar salvas de projéteis dos pelotões do jogador contra a Horda / Chefe
    const volleyIntervalMs = 1000 / this.timeline.cadenceVolleysPerSec
    this.volleyTimerMs += scaledDt
    if (
      !reducedMotion &&
      sample.playerLeft > 0 &&
      sample.enemyTotalLeft > 0 &&
      this.volleyTimerMs >= volleyIntervalMs
    ) {
      this.volleyTimerMs = 0
      const shots = Math.min(3, Math.max(1, Math.ceil(crowdNodes.length / 10)))
      let dominantKind: ProjectileKind = 'arrow'

      for (let i = 0; i < shots; i++) {
        const node =
          crowdNodes.length > 0
            ? crowdNodes[(i * 7 + Math.floor(this.elapsedMs)) % crowdNodes.length]
            : null
        const tierIdx = node ? node.tierIndex : 0
        const kind: ProjectileKind =
          tierIdx >= 3 ? 'cannon' : tierIdx >= 1 ? 'spear' : 'arrow'
        if (kind === 'cannon' || (kind === 'spear' && dominantKind === 'arrow')) {
          dominantKind = kind
        }

        const jitterX = ((i - 1) * 18) + (Math.sin(this.elapsedMs * 0.03 + i) * 14)
        const targetY =
          sample.hordeLeft > 0 ? fortressTargets.hordeCenterY : fortressTargets.bossCenterY
        projectilePool.spawnProjectile(
          kind,
          playerCenter.x + jitterX,
          playerCenter.y - 16,
          fortressTargets.bossCenterX + jitterX * 0.55,
          targetY,
          kind === 'cannon' ? 310 : 260,
        )
      }
      callbacks.onVolleySound?.(dominantKind)
    }

    // 3. Disparos inimigos de resposta enquanto o inimigo ainda tiver forças
    this.enemyBoltTimerMs += scaledDt
    if (
      !reducedMotion &&
      sample.enemyTotalLeft > 0 &&
      sample.playerLeft > 0 &&
      this.enemyBoltTimerMs >= 260
    ) {
      this.enemyBoltTimerMs = 0
      const offset = Math.sin(this.elapsedMs * 0.02) * 24
      projectilePool.spawnProjectile(
        'enemy_bolt',
        fortressTargets.bossCenterX + offset,
        fortressTargets.hordeCenterY,
        playerCenter.x + offset * 0.6,
        playerCenter.y - 10,
        290,
      )
    }

    // 4. Números flutuantes de dano no inimigo
    this.damageTextTimerMs += scaledDt
    const deltaKills = sample.killsSoFar - this.lastKillsSoFar
    if (deltaKills > 0 && this.damageTextTimerMs >= 240) {
      this.damageTextTimerMs = 0
      this.lastKillsSoFar = sample.killsSoFar
      const dmgText = `−${formatArmy(deltaKills, notationMode)}`
      const jitterX = Math.sin(this.elapsedMs * 0.017) * 28
      projectilePool.spawnDamageText(
        fortressTargets.bossCenterX + jitterX,
        fortressTargets.bossCenterY - 12,
        dmgText,
        '#fef08a',
      )
    }

    // 5. Atualizar e desenhar projéteis em voo
    projectilePool.updateAndDraw(ctx, scaledDt, (impactX, impactY, kind) => {
      if (kind !== 'enemy_bolt') {
        this.hitFlashAlpha = 0.85
      }
      if (!reducedMotion) {
        particles.spawnBurst(
          impactX,
          impactY,
          kind === 'cannon' ? '#facc15' : kind === 'enemy_bolt' ? '#ef4444' : '#38bdf8',
          kind === 'cannon' ? 8 : 4,
        )
      }
    })

    // 6. Concluir a batalha ao atingir durationMs
    if (this.elapsedMs >= this.timeline.durationMs && !this.finishedCalled) {
      this.finishedCalled = true
      callbacks.onBattleFinished()
    }

    return {
      hordeLeft: sample.hordeLeft,
      bossLeft: sample.bossLeft,
      enemyTotalLeft: sample.enemyTotalLeft,
      initialEnemyTotal: this.timeline.initialEnemyTotal,
      elapsedMs: this.elapsedMs,
      isBattlePhase: true,
      hitFlashAlpha: this.hitFlashAlpha,
    }
  }
}

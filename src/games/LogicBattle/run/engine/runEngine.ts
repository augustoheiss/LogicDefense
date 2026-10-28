// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/engine/runEngine.ts — Motor Imperativo de Marcha Contínua (60 FPS)
// ──────────────────────────────────────────────────────────────────────────────
import { getLaneCenterNormX, resolveLaneIndexFromNormX } from '../renderer/perspective'

export class RunEngine {
  public laneX = -0.24
  public targetLaneX = -0.24

  public syncFromStore(storeLaneX: number): void {
    this.laneX = storeLaneX
    this.targetLaneX = storeLaneX
  }

  public setTargetNormX(normX: number): void {
    this.targetLaneX = Math.max(-1.0, Math.min(1.0, normX))
  }

  public snapToLaneIndex(laneIdx: number, laneCount: 2 | 3): void {
    const center = getLaneCenterNormX(laneIdx, laneCount)
    this.targetLaneX = center
    this.laneX = center
  }

  public stepSteering(dtMs: number): number {
    const lerpFactor = Math.min(1, dtMs * 0.018)
    this.laneX += (this.targetLaneX - this.laneX) * lerpFactor
    return this.laneX
  }

  public getCurrentLaneIndex(laneCount: 2 | 3): number {
    return resolveLaneIndexFromNormX(this.laneX, laneCount)
  }
}

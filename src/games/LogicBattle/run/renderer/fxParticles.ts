// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/fxParticles.ts — Partículas Leves sem Alocação Pesada
// ──────────────────────────────────────────────────────────────────────────────

export interface FxParticle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  lifeMs: number
  maxLifeMs: number
}

export class ParticlePool {
  private particles: FxParticle[] = []
  private readonly maxParticles = 64

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count = 14,
    reducedMotion = false,
  ): void {
    if (reducedMotion) return
    const n = Math.min(count, 20)
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift()
      }
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.3
      const speed = 45 + Math.random() * 95
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 25,
        radius: 2.5 + Math.random() * 2.5,
        color,
        alpha: 1,
        lifeMs: 0,
        maxLifeMs: 420 + Math.random() * 220,
      })
    }
  }

  public updateAndDraw(ctx: CanvasRenderingContext2D, dtMs: number): void {
    if (this.particles.length === 0) return
    const dtSec = dtMs / 1000

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.lifeMs += dtMs
      if (p.lifeMs >= p.maxLifeMs) {
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dtSec
      p.y += p.vy * dtSec
      p.vy += 120 * dtSec
      p.alpha = Math.max(0, 1 - p.lifeMs / p.maxLifeMs)

      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }
}

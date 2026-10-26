// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/projectilePool.ts — Pool Fixo de 64 Projéteis por Tier
// ──────────────────────────────────────────────────────────────────────────────

export type ProjectileKind = 'arrow' | 'spear' | 'cannon' | 'enemy_bolt'

export interface BattleProjectile {
  active: boolean
  kind: ProjectileKind
  startX: number
  startY: number
  targetX: number
  targetY: number
  arcHeight: number
  elapsedMs: number
  durationMs: number
  color: string
  glowColor: string
}

export interface FloatingDamageText {
  id: number
  x: number
  y: number
  text: string
  color: string
  elapsedMs: number
  maxLifeMs: number
}

export class ProjectilePool {
  private readonly maxProjectiles = 64
  private pool: BattleProjectile[] = []
  private floatingDamages: FloatingDamageText[] = []
  private nextDamageId = 1

  constructor() {
    for (let i = 0; i < this.maxProjectiles; i++) {
      this.pool.push({
        active: false,
        kind: 'arrow',
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: 0,
        arcHeight: 30,
        elapsedMs: 0,
        durationMs: 360,
        color: '#38bdf8',
        glowColor: '#bae6fd',
      })
    }
  }

  public clear(): void {
    for (const p of this.pool) {
      p.active = false
    }
    this.floatingDamages = []
  }

  public spawnProjectile(
    kind: ProjectileKind,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    durationMs = 340,
  ): void {
    let slot = this.pool.find((p) => !p.active)
    if (!slot) {
      slot = this.pool[0]
    }

    slot.active = true
    slot.kind = kind
    slot.startX = startX
    slot.startY = startY
    slot.targetX = targetX
    slot.targetY = targetY
    slot.arcHeight = kind === 'cannon' ? 52 : kind === 'spear' ? 38 : 26
    slot.elapsedMs = 0
    slot.durationMs = Math.max(160, durationMs)

    if (kind === 'cannon') {
      slot.color = '#facc15'
      slot.glowColor = '#fef08a'
    } else if (kind === 'spear') {
      slot.color = '#f59e0b'
      slot.glowColor = '#fde68a'
    } else if (kind === 'enemy_bolt') {
      slot.color = '#ef4444'
      slot.glowColor = '#fca5a5'
    } else {
      slot.color = '#38bdf8'
      slot.glowColor = '#e0f2fe'
    }
  }

  public spawnDamageText(x: number, y: number, text: string, color = '#fef08a'): void {
    if (this.floatingDamages.length >= 18) {
      this.floatingDamages.shift()
    }
    this.floatingDamages.push({
      id: this.nextDamageId++,
      x,
      y,
      text,
      color,
      elapsedMs: 0,
      maxLifeMs: 650,
    })
  }

  public updateAndDraw(
    ctx: CanvasRenderingContext2D,
    dtMs: number,
    onImpact?: (x: number, y: number, kind: ProjectileKind) => void,
  ): void {
    for (const p of this.pool) {
      if (!p.active) continue
      p.elapsedMs += dtMs
      const t = Math.min(1, p.elapsedMs / p.durationMs)

      const x = p.startX + (p.targetX - p.startX) * t
      const linearY = p.startY + (p.targetY - p.startY) * t
      const arcOffset = Math.sin(t * Math.PI) * p.arcHeight
      const y = linearY - arcOffset

      // Calcular ângulo tangente para orientar a flecha/lança
      const dtNext = Math.min(1, t + 0.05)
      const nextX = p.startX + (p.targetX - p.startX) * dtNext
      const nextY =
        p.startY +
        (p.targetY - p.startY) * dtNext -
        Math.sin(dtNext * Math.PI) * p.arcHeight
      const angle = Math.atan2(nextY - y, nextX - x)

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)

      if (p.kind === 'cannon') {
        // Esfera dourada de canhão / titã com trilha luminosa
        ctx.fillStyle = p.glowColor
        ctx.beginPath()
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.kind === 'spear') {
        // Lança de Centurião
        ctx.strokeStyle = p.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(-10, 0)
        ctx.lineTo(8, 0)
        ctx.stroke()
        ctx.fillStyle = p.glowColor
        ctx.beginPath()
        ctx.moveTo(11, 0)
        ctx.lineTo(5, -3.5)
        ctx.lineTo(5, 3.5)
        ctx.closePath()
        ctx.fill()
      } else if (p.kind === 'enemy_bolt') {
        // Disparo rubro da horda/chefe
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2.8
        ctx.beginPath()
        ctx.moveTo(-8, 0)
        ctx.lineTo(6, 0)
        ctx.stroke()
        ctx.fillStyle = p.glowColor
        ctx.beginPath()
        ctx.arc(6, 0, 3, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Flecha azul dos Recrutas
        ctx.strokeStyle = p.glowColor
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.moveTo(-8, 0)
        ctx.lineTo(7, 0)
        ctx.stroke()
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(10, 0)
        ctx.lineTo(5, -2.8)
        ctx.lineTo(5, 2.8)
        ctx.closePath()
        ctx.fill()
      }

      ctx.restore()

      if (t >= 1) {
        p.active = false
        onImpact?.(p.targetX, p.targetY, p.kind)
      }
    }

    // Desenhar números flutuantes de dano (-120, -1,2k)
    for (let i = this.floatingDamages.length - 1; i >= 0; i--) {
      const fd = this.floatingDamages[i]
      fd.elapsedMs += dtMs
      if (fd.elapsedMs >= fd.maxLifeMs) {
        this.floatingDamages.splice(i, 1)
        continue
      }
      const norm = fd.elapsedMs / fd.maxLifeMs
      const y = fd.y - norm * 28
      const alpha = Math.max(0, 1 - norm * 0.9)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = '900 13px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 3.5
      ctx.strokeText(fd.text, fd.x, y)
      ctx.fillStyle = fd.color
      ctx.fillText(fd.text, fd.x, y)
      ctx.restore()
    }
  }
}

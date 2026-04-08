/** Avoids circular import: Coin only needs position + magnetRadius from Hero. */
interface Attractable {
  x: number
  y: number
  magnetRadius: number
}

const LIFESPAN = 900    // 15 s @ 60 fps
const FLASH_START = 180 // last 3 s before expiry

export class Coin {
  x: number
  y: number
  vx: number
  vy: number
  readonly value: number
  active: boolean
  life: number

  constructor(x: number, y: number, value: number) {
    this.x = x
    this.y = y
    // Pop upward with slight random horizontal drift
    this.vx = (Math.random() - 0.5) * 4
    this.vy = -(1.5 + Math.random() * 2.5)
    this.value = value
    this.active = true
    this.life = LIFESPAN
  }

  update(attractors: Attractable[], onCollect: (value: number) => void): void {
    // ── Magnetic attraction from nearby Heroes ──────────────────────────
    for (const a of attractors) {
      const dx = a.x - this.x
      const dy = a.y - this.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < a.magnetRadius) {
        const force = ((a.magnetRadius - d) / a.magnetRadius) * 1.5
        this.vx += (dx / d) * force
        this.vy += (dy / d) * force
        if (d <= 14) {
          onCollect(this.value)
          this.active = false
          return
        }
      }
    }

    // ── Physics ─────────────────────────────────────────────────────────
    this.vy += 0.09        // gentle gravity
    this.vx *= 0.93        // horizontal friction
    this.vy *= 0.97        // vertical friction

    // Clamp speed
    const spd = Math.hypot(this.vx, this.vy)
    if (spd > 14) { this.vx = (this.vx / spd) * 14; this.vy = (this.vy / spd) * 14 }

    this.x += this.vx
    this.y += this.vy

    // ── Lifespan ─────────────────────────────────────────────────────────
    this.life--
    if (this.life <= 0) this.active = false
  }

  get isFlashing(): boolean {
    return this.life < FLASH_START
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return

    // Blink during final seconds
    if (this.isFlashing && Math.floor(Date.now() / 220) % 2 === 0) return

    const alpha = this.isFlashing
      ? 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 180))
      : 1

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowBlur = 14
    ctx.shadowColor = '#ffd700'

    // Coin body
    ctx.fillStyle = '#ffd700'
    ctx.strokeStyle = '#aa8800'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(this.x, this.y, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Dollar sign
    ctx.shadowBlur = 0
    ctx.fillStyle = '#5c3a00'
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', this.x, this.y + 0.5)

    ctx.restore()
  }
}

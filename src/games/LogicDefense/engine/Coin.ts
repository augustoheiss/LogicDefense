// Lock-on scanning is performed externally by useGameEngine.ts (Passes 1 & 2).
// Coin.update() handles only physics, magnetic flight, and grounded countdown.

// ─── Tuning constants ──────────────────────────────────────────────────────────
const GROUNDED_LIFESPAN_MS = 15_000   // 15 s sitting on the ground
const FLASH_START_MS       = 3_000    // start flashing 3 s before despawn
const DROP_DISTANCE        = 22       // px below spawn point before "landing"
const GRAVITY              = 0.25     // px/frame² while dropping
const MAGNETIC_SPEED       = 8        // px/frame while attracting (deterministic)
const COLLECT_RADIUS       = 14       // px — impact zone for collection

// 3-state lifecycle:
//   dropping   → coin hops down, hits groundY, becomes grounded
//   grounded   → sits still, counts down 15 s, flashes last 3 s
//   attracting → locked-on magnetic flight toward target, ignores all physics
type CoinState = 'dropping' | 'grounded' | 'attracting'

export class Coin {
  x: number
  y: number
  private vx: number
  private vy: number
  private readonly groundY: number
  private state: CoinState
  private groundedMs: number
  private targetX: number
  private targetY: number

  readonly value: number
  active: boolean

  constructor(x: number, y: number, value: number) {
    this.x          = x
    this.y          = y
    this.vx         = (Math.random() - 0.5) * 1  // tiny lateral drift
    this.vy         = 3                            // drop DOWN — no upward launch
    this.groundY    = y + DROP_DISTANCE
    this.state      = 'dropping'
    this.groundedMs = GROUNDED_LIFESPAN_MS
    this.targetX    = x
    this.targetY    = y
    this.value      = value
    this.active     = true
  }

  // ─── Public API used by useGameEngine.ts scans ───────────────────────────────

  /** True when the coin can still be claimed (not yet locked-on to an attractor). */
  get isCollectable(): boolean {
    return this.state === 'dropping' || this.state === 'grounded'
  }

  /**
   * Lock this coin onto an attractor centre (tower or hero).
   * Transitions to 'attracting' state; coin will fly at MAGNETIC_SPEED px/frame.
   * No-op if already locked or inactive.
   */
  lockOn(tx: number, ty: number): void {
    if (!this.active || this.state === 'attracting') return
    this.state   = 'attracting'
    this.targetX = tx
    this.targetY = ty
    this.vx      = 0
    this.vy      = 0
  }

  // ─── Per-frame update ─────────────────────────────────────────────────────────

  update(
    onCollect: (value: number) => void,
    dtMs: number,
  ): void {
    if (!this.active) return

    // ── STATE: attracting — deterministic flight, bypasses all physics ────
    if (this.state === 'attracting') {
      const dx   = this.targetX - this.x
      const dy   = this.targetY - this.y
      const dist = Math.hypot(dx, dy)

      if (dist < COLLECT_RADIUS) {
        onCollect(this.value)
        this.active = false
        return
      }

      this.x += (dx / dist) * MAGNETIC_SPEED
      this.y += (dy / dist) * MAGNETIC_SPEED
      return
    }

    // ── STATE: dropping — gravity + friction until groundY ───────────────
    if (this.state === 'dropping') {
      this.vy += GRAVITY
      this.vx *= 0.90
      this.vy *= 0.98

      const spd = Math.hypot(this.vx, this.vy)
      if (spd > 12) { this.vx = (this.vx / spd) * 12; this.vy = (this.vy / spd) * 12 }

      this.x += this.vx
      this.y += this.vy

      if (this.y >= this.groundY) {
        this.y     = this.groundY
        this.vx    = 0
        this.vy    = 0
        this.state = 'grounded'
      }
      return
    }

    // ── STATE: grounded — stationary countdown ────────────────────────────
    this.groundedMs -= dtMs
    if (this.groundedMs <= 0) this.active = false
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  /** True during the final 3 s — triggers flashing in draw(). */
  get isFlashing(): boolean {
    return this.state === 'grounded' && this.groundedMs <= FLASH_START_MS
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return

    // Blink at ~4.5 Hz during final seconds
    if (this.isFlashing && Math.floor(Date.now() / 220) % 2 === 0) return

    const alpha = this.isFlashing
      ? 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 180))
      : 1

    // Pulse while grounded; shrink slightly while attracting (speed illusion)
    const pulse = this.state === 'grounded'
      ? 1 + 0.06 * Math.sin(Date.now() / 400)
      : this.state === 'attracting'
        ? 0.85
        : 1
    const r = 7 * pulse

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowBlur  = this.state === 'attracting' ? 22 : 14
    ctx.shadowColor = '#ffd700'

    // Coin body
    ctx.fillStyle   = '#ffd700'
    ctx.strokeStyle = '#aa8800'
    ctx.lineWidth   = 1.5
    ctx.beginPath()
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Dollar sign
    ctx.shadowBlur   = 0
    ctx.fillStyle    = '#5c3a00'
    ctx.font         = 'bold 7px monospace'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', this.x, this.y + 0.5)

    ctx.restore()
  }
}

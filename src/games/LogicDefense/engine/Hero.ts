import type { TowerType } from '../types/game'
import { Enemy } from './Enemy'
import { Bullet } from './Bullet'
import { Particle } from './Particle'

// ── Hero type (matches + Tower base stats, cyan-coloured bullets) ─────────────
const HERO_TOWER_TYPE: TowerType = {
  name: 'Herói',
  symbol: '+',
  shape: 'circle',
  cost: 50,
  range: 120,
  damage: 25,
  rate: 25,
  color: '#00d4ff',
}

const BASE_DAMAGE = 25
const BASE_RATE   = 25
const BASE_RANGE  = 120
const BASE_COST   = 50
const MOVE_SPEED  = 2.8
export const HERO_MAGNET_RADIUS = 100

function toRoman(n: number): string {
  if (n >= 10) return 'X+'
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n]
}

export class Hero {
  x: number
  y: number
  targetX: number
  targetY: number
  level: number
  upgradeCost: number
  totalCost: number
  range: number
  lootRange: number
  currentRate: number
  cooldown: number
  magnetRadius: number
  selected: boolean

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
    this.level = 1
    this.upgradeCost = BASE_COST
    this.totalCost = BASE_COST
    this.range    = BASE_RANGE
    // MANDATORY: lootRange must always be > attackRange (Math.ceil prevents sub-range)
    this.lootRange = Math.ceil(BASE_RANGE * 1.05)
    this.currentRate = BASE_RATE
    this.cooldown = 0
    this.magnetRadius = HERO_MAGNET_RADIUS
    this.selected = false
  }

  /** Issue a move command (RTS right-click or mobile empty-ground tap). */
  moveTo(tx: number, ty: number): void {
    this.targetX = tx
    this.targetY = ty
  }

  getDamage(): number {
    return BASE_DAMAGE * (1 + 0.2 * (this.level - 1))
  }

  upgrade(onUpgrade?: (particles: Particle[]) => void): void {
    this.level++
    this.totalCost += this.upgradeCost
    this.upgradeCost = BASE_COST * Math.pow(2, this.level - 1)
    // Compound ×1.2 growth per level — Vampire Survivors feel
    this.range        = Math.floor(this.range        * 1.2)
    this.magnetRadius = Math.floor(this.magnetRadius * 1.2)
    // MANDATORY: loot zone must always be > attackRange (Math.ceil prevents sub-range)
    this.lootRange = Math.max(this.lootRange, Math.ceil(this.range * 1.05))
    // Hero is a VIP — ×2 attack speed per level (same as ÷ tower)
    this.currentRate = Math.max(1, Math.floor(this.currentRate / 2))
    if (onUpgrade) {
      const pts: Particle[] = []
      for (let i = 0; i < 15; i++) pts.push(new Particle(this.x, this.y, '#00d4ff'))
      onUpgrade(pts)
    }
  }

  update(
    enemies: Enemy[],
    onShoot: (bullet: Bullet) => void,
    onSound: (type: string) => void,
    wave: number,
  ): void {
    // ── Smooth movement towards target ──────────────────────────────────
    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > MOVE_SPEED) {
      this.x += (dx / dist) * MOVE_SPEED
      this.y += (dy / dist) * MOVE_SPEED
    } else {
      this.x = this.targetX
      this.y = this.targetY
    }

    // ── Auto-attack (identical targeting logic to Tower) ─────────────────
    if (this.cooldown > 0) { this.cooldown--; return }
    let target: Enemy | null = null
    let minDst = Infinity
    for (const e of enemies) {
      const d = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2)
      if (d < this.range && d < minDst) { minDst = d; target = e }
    }
    if (target) {
      onShoot(new Bullet(this.x, this.y, target, HERO_TOWER_TYPE, this.getDamage(), wave))
      this.cooldown = this.currentRate
      onSound('shoot')
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()

    // ── Selection rings ─────────────────────────────────────────────────
    if (this.selected) {
      // 1. Attack range (cyan solid — inner ring)
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // 2. Loot range (gold dashed — outer ring, always visually larger)
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.lootRange, 0, Math.PI * 2)
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])

      // 3. Magnet radius (faint violet dotted — outermost, the actual pull zone)
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.magnetRadius, 0, Math.PI * 2)
      ctx.setLineDash([2, 8])
      ctx.strokeStyle = 'rgba(180, 100, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Level aura ───────────────────────────────────────────────────────
    if (this.level > 1) {
      ctx.shadowBlur = 20
      ctx.shadowColor = '#00d4ff'
      ctx.strokeStyle = '#00d4ff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.x, this.y, 22 + this.level * 1.5, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ── Diamond body ────────────────────────────────────────────────────
    const r = 17
    ctx.shadowBlur = 18
    ctx.shadowColor = this.selected ? '#ffee00' : '#00d4ff'
    ctx.fillStyle = 'rgba(0, 20, 50, 0.95)'
    ctx.strokeStyle = this.selected ? '#ffee00' : '#00d4ff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(this.x,     this.y - r)   // top
    ctx.lineTo(this.x + r, this.y)       // right
    ctx.lineTo(this.x,     this.y + r)   // bottom
    ctx.lineTo(this.x - r, this.y)       // left
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // ── Inner icon ───────────────────────────────────────────────────────
    ctx.shadowBlur = 0
    ctx.fillStyle = this.selected ? '#ffee00' : '#00d4ff'
    ctx.font = 'bold 13px Courier New'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('★', this.x, this.y + 1)

    // ── Level badge ──────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 9px Arial'
    ctx.fillText(toRoman(this.level), this.x, this.y - 27)

    ctx.restore()
  }
}

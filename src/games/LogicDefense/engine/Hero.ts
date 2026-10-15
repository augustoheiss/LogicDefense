import type { ActiveBuffModifiers, TowerType } from '../types/game'
import { Enemy } from './Enemy'
import { Bullet } from './Bullet'
import { Particle } from './Particle'

const HERO_PROFILES = [
  { callsign: 'Sentinela Alfa', color: '#00d4ff', hotkey: '1' },
  { callsign: 'Vanguarda Beta', color: '#34d399', hotkey: '2' },
  { callsign: 'Oráculo Gama',   color: '#f472b6', hotkey: '3' },
] as const

const BASE_DAMAGE = 25
const BASE_RATE   = 25
const BASE_RANGE  = 120
const BASE_COST   = 50
const MOVE_SPEED  = 3.1
export const HERO_MAGNET_RADIUS = 115

function toRoman(n: number): string {
  if (n >= 10) return 'X+'
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n]
}

export class Hero {
  x: number
  y: number
  targetX: number
  targetY: number
  heroIndex: number
  callsign: string
  accentColor: string
  hotkey: string
  level: number
  upgradeCost: number
  totalCost: number
  range: number
  lootRange: number
  currentRate: number
  cooldown: number
  magnetRadius: number
  selected: boolean
  private towerType: TowerType

  constructor(x: number, y: number, heroIndex: number = 0) {
    const profile = HERO_PROFILES[heroIndex % HERO_PROFILES.length]
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
    this.heroIndex = heroIndex
    this.callsign = profile.callsign
    this.accentColor = profile.color
    this.hotkey = profile.hotkey
    this.level = 1
    this.upgradeCost = BASE_COST
    this.totalCost = BASE_COST
    this.range    = BASE_RANGE
    this.lootRange = Math.ceil(BASE_RANGE * 1.05)
    this.currentRate = BASE_RATE
    this.cooldown = 0
    this.magnetRadius = HERO_MAGNET_RADIUS
    this.selected = false
    this.towerType = {
      name: profile.callsign,
      symbol: '+',
      shape: 'circle',
      cost: BASE_COST,
      range: BASE_RANGE,
      damage: BASE_DAMAGE,
      rate: BASE_RATE,
      color: profile.color,
    }
  }

  /** Issue a move command (RTS right-click or mobile empty-ground tap). */
  moveTo(tx: number, ty: number): void {
    this.targetX = tx
    this.targetY = ty
  }

  getEffectiveUpgradeCost(discount: number = 0): number {
    return Math.max(10, Math.floor(this.upgradeCost * (1 - discount)))
  }

  getEffectiveMagnetRadius(multiplier: number = 1): number {
    return Math.floor(this.magnetRadius * multiplier)
  }

  getDamage(damageMultiplier: number = 1): number {
    return BASE_DAMAGE * (1 + 0.2 * (this.level - 1)) * damageMultiplier
  }

  upgrade(onUpgrade?: (particles: Particle[]) => void, costPaid?: number): void {
    const actualPaid = costPaid ?? this.upgradeCost
    this.level++
    this.totalCost += actualPaid
    this.upgradeCost = BASE_COST * Math.pow(2, this.level - 1)
    // Compound ×1.2 growth per level — Vampire Survivors feel
    this.range        = Math.floor(this.range        * 1.2)
    this.magnetRadius = Math.floor(this.magnetRadius * 1.2)
    this.lootRange = Math.max(this.lootRange, Math.ceil(this.range * 1.05))
    // Hero is a VIP — ×2 attack speed per level (same as ÷ tower)
    this.currentRate = Math.max(1, Math.floor(this.currentRate / 2))
    if (onUpgrade) {
      const pts: Particle[] = []
      for (let i = 0; i < 15; i++) pts.push(new Particle(this.x, this.y, this.accentColor))
      onUpgrade(pts)
    }
  }

  update(
    enemies: Enemy[],
    onShoot: (bullet: Bullet) => void,
    onSound: (type: string) => void,
    wave: number,
    buffMods?: ActiveBuffModifiers,
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
    const effectiveRange = Math.floor(this.range * (buffMods?.towerRangeMultiplier ?? 1))
    let target: Enemy | null = null
    let minDst = Infinity
    for (const e of enemies) {
      const d = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2)
      if (d < effectiveRange && d < minDst) { minDst = d; target = e }
    }
    if (target) {
      const dmg = this.getDamage(buffMods?.towerDamageMultiplier ?? 1)
      const odioActive = buffMods?.buff === 'odio'
      onShoot(new Bullet(this.x, this.y, target, this.towerType, dmg, wave, false, odioActive))
      this.cooldown = this.currentRate
      onSound('shoot')
    }
  }

  draw(ctx: CanvasRenderingContext2D, buffMods?: ActiveBuffModifiers): void {
    ctx.save()

    const effectiveRange = Math.floor(this.range * (buffMods?.towerRangeMultiplier ?? 1))
    const effectiveMagnet = this.getEffectiveMagnetRadius(buffMods?.heroMagnetMultiplier ?? 1)

    // ── Move target indicator line when moving ──────────────────────────
    if (Math.hypot(this.targetX - this.x, this.targetY - this.y) > 6) {
      ctx.beginPath()
      ctx.moveTo(this.x, this.y)
      ctx.lineTo(this.targetX, this.targetY)
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = this.selected ? 'rgba(255, 238, 0, 0.45)' : 'rgba(0, 212, 255, 0.22)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Selection rings ─────────────────────────────────────────────────
    if (this.selected) {
      // 1. Attack range (cyan solid — inner ring)
      ctx.beginPath()
      ctx.arc(this.x, this.y, effectiveRange, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // 2. Magnet radius (gold/violet dashed — actual Hero bonus coin pull zone)
      ctx.beginPath()
      ctx.arc(this.x, this.y, effectiveMagnet, 0, Math.PI * 2)
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.65)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── Level aura ───────────────────────────────────────────────────────
    if (this.level > 1) {
      ctx.shadowBlur = 20
      ctx.shadowColor = this.accentColor
      ctx.strokeStyle = this.accentColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.x, this.y, 22 + this.level * 1.5, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ── Diamond body ────────────────────────────────────────────────────
    const r = 17
    ctx.shadowBlur = 18
    ctx.shadowColor = this.selected ? '#ffee00' : this.accentColor
    ctx.fillStyle = 'rgba(0, 20, 50, 0.95)'
    ctx.strokeStyle = this.selected ? '#ffee00' : this.accentColor
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
    ctx.fillStyle = this.selected ? '#ffee00' : this.accentColor
    ctx.font = 'bold 13px Courier New'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('★', this.x, this.y + 1)

    // ── Level badge (top) & Hotkey badge (bottom) ────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 9px Arial'
    ctx.fillText(toRoman(this.level), this.x, this.y - 25)

    ctx.fillStyle = this.selected ? '#ffee00' : 'rgba(255,255,255,0.7)'
    ctx.font = 'bold 8px Courier New'
    ctx.fillText(`[${this.hotkey}]`, this.x, this.y + 25)

    ctx.restore()
  }
}


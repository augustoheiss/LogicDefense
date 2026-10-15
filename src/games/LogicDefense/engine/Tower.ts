import type { ActiveBuffModifiers, TowerType } from '../types/game'
import { TOWER_CORE_LOOT_RADIUS } from './constants'
import { Particle } from './Particle'
import { Enemy } from './Enemy'
import { Bullet } from './Bullet'

function toRoman(num: number): string {
  if (num >= 10) return 'X+'
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']
  return roman[num]
}

export class Tower {
  x: number
  y: number
  type: TowerType
  cooldown: number
  level: number
  upgradeCost: number
  totalCost: number
  range: number
  lootRange: number
  currentRate: number

  constructor(x: number, y: number, type: TowerType) {
    this.x = x
    this.y = y
    this.type = type
    this.cooldown = 0
    this.level = 1
    this.upgradeCost = type.cost
    this.totalCost = type.cost
    this.range = type.range
    // Core pickup radius: towers collect coins near their base, leaving outer coins for Heroes (+bonus gold)
    this.lootRange = TOWER_CORE_LOOT_RADIUS
    this.currentRate = type.rate
  }

  getEffectiveUpgradeCost(discount: number = 0): number {
    return Math.max(10, Math.floor(this.upgradeCost * (1 - discount)))
  }

  upgrade(onUpgrade?: (particles: Particle[]) => void, costPaid?: number): void {
    const actualPaid = costPaid ?? this.upgradeCost
    this.level++
    this.totalCost += actualPaid
    this.upgradeCost = this.type.cost * Math.pow(2, this.level - 1)
    // Compound ×1.2 range growth (Vampire Survivors feel)
    this.range = Math.floor(this.range * 1.2)
    // Core pickup radius grows modestly per level
    this.lootRange = Math.min(95, Math.floor(TOWER_CORE_LOOT_RADIUS * (1 + 0.08 * (this.level - 1))))
    // VIP speed boost: ÷ gets ×2 attack speed; all others get ×1.5
    if (this.type.symbol === '÷') {
      this.currentRate = Math.max(1, Math.floor(this.currentRate / 2))
    } else {
      this.currentRate = Math.max(1, Math.floor(this.currentRate / 1.5))
    }
    if (onUpgrade) {
      const pts: Particle[] = []
      for (let i = 0; i < 15; i++) pts.push(new Particle(this.x, this.y, '#fff'))
      onUpgrade(pts)
    }
  }

  getDamage(damageMultiplier: number = 1, isResonant: boolean = false): number {
    // ALL towers (including ÷) gain +20% damage per level
    const base = this.type.damage * (1 + 0.2 * (this.level - 1))
    const resonantBoost = isResonant ? (this.type.symbol === '+' ? 1.35 : 1.25) : 1
    return base * damageMultiplier * resonantBoost
  }

  getEffectiveRange(rangeMultiplier: number = 1, isResonant: boolean = false): number {
    return Math.floor(this.range * rangeMultiplier * (isResonant ? 1.12 : 1))
  }

  update(
    enemies: Enemy[],
    onShoot: (bullet: Bullet) => void,
    onSound: (type: string) => void,
    wave: number,
    buffMods?: ActiveBuffModifiers,
    isResonant: boolean = false,
    isHarmonyLinked: boolean = false,
  ): void {
    if (this.cooldown > 0) {
      const tickStep = isHarmonyLinked && buffMods ? 1 + buffMods.harmonyLinkSpeedBoost : 1
      this.cooldown = Math.max(0, this.cooldown - tickStep)
      return
    }
    const effectiveRange = this.getEffectiveRange(buffMods?.towerRangeMultiplier ?? 1, isResonant)
    let target: Enemy | null = null
    let minDst = Infinity
    enemies.forEach(e => {
      const dst = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2)
      if (dst < effectiveRange && dst < minDst) { minDst = dst; target = e }
    })
    if (target) {
      const dmg = this.getDamage(buffMods?.towerDamageMultiplier ?? 1, isResonant)
      const odioActive = buffMods?.buff === 'odio'
      onShoot(new Bullet(this.x, this.y, target, this.type, dmg, wave, isResonant, odioActive))
      this.cooldown = isResonant ? Math.max(1, Math.floor(this.currentRate * 0.82)) : this.currentRate
      onSound(this.type.symbol === '÷' ? 'sniper' : 'shoot')
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    mouseX: number,
    mouseY: number,
    isSelected: boolean,
    isMoving: boolean,
    canPlaceAt: (x: number, y: number, ignore: Tower) => boolean,
    buffMods?: ActiveBuffModifiers,
    isResonant: boolean = false,
    isHarmonyLinked: boolean = false,
  ): void {
    ctx.save()

    const effectiveRange = this.getEffectiveRange(buffMods?.towerRangeMultiplier ?? 1, isResonant)

    if (isMoving) {
      this.x = mouseX; this.y = mouseY
      ctx.globalAlpha = 0.5
      // Core loot zone (gold, dashed)
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.lootRange, 0, Math.PI * 2)
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
      // Attack zone (red/green tinted fill)
      ctx.beginPath()
      ctx.arc(this.x, this.y, effectiveRange, 0, Math.PI * 2)
      ctx.fillStyle = canPlaceAt(this.x, this.y, this)
        ? 'rgba(0, 255, 0, 0.2)'
        : 'rgba(255, 0, 0, 0.2)'
      ctx.fill()
    } else if (isSelected) {
      // Draw attack ring (solid white — outer)
      ctx.beginPath()
      ctx.arc(this.x, this.y, effectiveRange, 0, Math.PI * 2)
      ctx.strokeStyle = isResonant ? this.type.color : '#fff'
      ctx.lineWidth = isResonant ? 2 : 1
      ctx.stroke()
      // Draw core loot ring (gold dashed — inner base pickup zone)
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.lootRange, 0, Math.PI * 2)
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Operational Resonance pulsing harmonic ring
    if (isResonant && !isMoving) {
      const pulse = 22 + 3 * Math.sin(Date.now() / 160)
      ctx.save()
      ctx.shadowBlur = 16
      ctx.shadowColor = this.type.color
      ctx.strokeStyle = this.type.color
      ctx.lineWidth = 1.8
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(this.x, this.y, pulse, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // Harmony Link pink aura (when Hero is nearby under ❤️ Amor)
    if (isHarmonyLinked && !isMoving) {
      ctx.save()
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.65)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(this.x, this.y, 26, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    if (this.level > 1 && !isMoving) {
      ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700'
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.x, this.y, 20 + this.level, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.shadowBlur = isResonant ? 18 : 10
    ctx.shadowColor = this.type.color
    ctx.fillStyle = 'rgba(20,20,20,0.9)'
    ctx.strokeStyle = this.type.color; ctx.lineWidth = 3

    const r = 16
    ctx.beginPath()
    if (this.type.shape === 'triangle') {
      ctx.moveTo(this.x, this.y - r)
      ctx.lineTo(this.x + r, this.y + r)
      ctx.lineTo(this.x - r, this.y + r)
    } else if (this.type.shape === 'circle') {
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    } else if (this.type.shape === 'square') {
      ctx.rect(this.x - r, this.y - r, r * 2, r * 2)
    } else if (this.type.shape === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3
        const px = this.x + r * Math.cos(angle)
        const py = this.y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
    }
    ctx.closePath(); ctx.fill(); ctx.stroke()

    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 20px Courier New'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(this.type.symbol, this.x, this.y + 2)

    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = 'bold 10px Arial'
    ctx.fillText(toRoman(this.level), this.x, this.y - 25)
    ctx.restore()
  }
}


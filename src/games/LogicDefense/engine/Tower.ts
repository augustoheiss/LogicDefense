import type { TowerType } from '../types/game'
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
    this.currentRate = type.rate
  }

  upgrade(onUpgrade?: (particles: Particle[]) => void): void {
    this.level++
    this.totalCost += this.upgradeCost
    this.upgradeCost = this.type.cost * Math.pow(2, this.level - 1)
    this.range = this.type.range * (1 + 0.2 * (this.level - 1))
    // ALL towers get attack speed upgrade (+50%), ÷ gets double (+100%)
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

  getDamage(): number {
    // ALL towers (including ÷) gain +20% damage per level
    return this.type.damage * (1 + 0.2 * (this.level - 1))
  }

  update(
    enemies: Enemy[],
    onShoot: (bullet: Bullet) => void,
    onSound: (type: string) => void,
    wave: number,
  ): void {
    if (this.cooldown > 0) { this.cooldown--; return }
    let target: Enemy | null = null
    let minDst = Infinity
    enemies.forEach(e => {
      const dst = Math.sqrt((e.x - this.x) ** 2 + (e.y - this.y) ** 2)
      if (dst < this.range && dst < minDst) { minDst = dst; target = e }
    })
    if (target) {
      onShoot(new Bullet(this.x, this.y, target, this.type, this.getDamage(), wave))
      this.cooldown = this.currentRate
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
  ): void {
    ctx.save()

    if (isMoving) {
      this.x = mouseX; this.y = mouseY
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2)
      ctx.fillStyle = canPlaceAt(this.x, this.y, this)
        ? 'rgba(0, 255, 0, 0.2)'
        : 'rgba(255, 0, 0, 0.2)'
      ctx.fill()
    } else if (isSelected) {
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    if (this.level > 1 && !isMoving) {
      ctx.shadowBlur = 15; ctx.shadowColor = '#ffd700'
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(this.x, this.y, 20 + this.level, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.shadowBlur = 10; ctx.shadowColor = this.type.color
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

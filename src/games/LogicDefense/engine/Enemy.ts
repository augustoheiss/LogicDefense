import type { Point } from '../types/game'
import { generateEnemyRoute } from './mapGenerator'
import { Particle } from './Particle'

export class Enemy {
  x: number
  y: number
  myPath: Point[]
  pathIndex: number
  speed: number
  maxHp: number
  hp: number
  radius: number
  frozen: number
  active: boolean
  isGolden: boolean
  spinOffset: number
  private wave: number

  constructor(
    maxHp: number,
    isGolden: boolean,
    wave: number,
  ) {
    this.wave = wave
    this.myPath = generateEnemyRoute()
    this.x = this.myPath[0].x
    this.y = this.myPath[0].y
    this.pathIndex = 0
    this.speed = 1.5 + wave * 0.05
    this.maxHp = maxHp
    this.hp = maxHp
    this.radius = 12
    this.frozen = 0
    this.active = true
    this.isGolden = isGolden
    this.spinOffset = Math.random() * Math.PI * 2
  }

  update(
    onReachEnd: () => void,
  ): void {
    const target = this.myPath[this.pathIndex + 1]
    if (!target) return

    const actualSpeed = this.frozen > 0 ? this.speed * 0.4 : this.speed
    if (this.frozen > 0) this.frozen--

    const dx = target.x - this.x
    const dy = target.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < actualSpeed) {
      this.x = target.x
      this.y = target.y
      this.pathIndex++
      if (this.pathIndex >= this.myPath.length - 1) {
        this.active = false
        onReachEnd()
      }
    } else {
      this.x += (dx / dist) * actualSpeed
      this.y += (dy / dist) * actualSpeed
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = this.isGolden
      ? (this.frozen > 0 ? '#00ffff' : '#ffd700')
      : (this.frozen > 0 ? '#00aaff' : '#ff5555')
    ctx.fillStyle = this.isGolden
      ? (this.frozen > 0 ? '#ccffff' : '#ffd700')
      : (this.frozen > 0 ? '#88ccff' : '#ff3333')

    const sides = Math.min(3 + Math.floor((this.wave - 1) / 10), 20)
    const spin = Date.now() / 300 + this.spinOffset

    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      const a = spin + (i * Math.PI * 2) / sides
      const px = this.x + this.radius * Math.cos(a)
      const py = this.y + this.radius * Math.sin(a)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()

    ctx.shadowBlur = 0
    ctx.fillStyle = 'red'
    ctx.fillRect(this.x - 12, this.y - 20, 24, 4)
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(this.x - 12, this.y - 20, 24 * (this.hp / this.maxHp), 4)
    ctx.restore()
  }

  static spawnParticles(x: number, y: number): Particle[] {
    const result: Particle[] = []
    for (let i = 0; i < 10; i++) result.push(new Particle(x, y, '#fff'))
    return result
  }
}

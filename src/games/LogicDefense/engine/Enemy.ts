import type { EnemyArchetype, Point } from '../types/game'
import { generateEnemyRoute } from './mapGenerator'
import { Particle } from './Particle'

export interface EnemySpawnOptions {
  archetype?: EnemyArchetype
  customPath?: Point[]
  startPathIndex?: number
  startX?: number
  startY?: number
  isSplitChild?: boolean
}

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
  burnFrames: number
  burnDamage: number
  active: boolean
  isGolden: boolean
  archetype: EnemyArchetype
  isSplitChild: boolean
  spinOffset: number
  private wave: number

  constructor(
    maxHp: number,
    isGolden: boolean,
    wave: number,
    options?: EnemySpawnOptions,
  ) {
    this.wave = wave
    this.archetype = options?.archetype ?? 'standard'
    this.isSplitChild = options?.isSplitChild ?? false
    this.myPath = options?.customPath
      ? options.customPath.map(p => ({ x: p.x, y: p.y }))
      : generateEnemyRoute()
    this.pathIndex = options?.startPathIndex ?? 0
    this.x = options?.startX ?? this.myPath[0].x
    this.y = options?.startY ?? this.myPath[0].y

    const baseSpeed = 1.5 + wave * 0.05
    if (this.archetype === 'runner') {
      this.speed = baseSpeed * (this.isSplitChild ? 1.85 : 1.65)
      this.maxHp = Math.max(10, Math.floor(maxHp * (this.isSplitChild ? 0.35 : 0.58)))
      this.radius = this.isSplitChild ? 8 : 10
    } else if (this.archetype === 'tank') {
      this.speed = baseSpeed * 0.62
      this.maxHp = Math.floor(maxHp * 2.55)
      this.radius = 16
    } else if (this.archetype === 'splitter') {
      this.speed = baseSpeed * 1.05
      this.maxHp = Math.floor(maxHp * 1.15)
      this.radius = 14
    } else if (this.archetype === 'boss') {
      this.speed = Math.max(0.75, baseSpeed * 0.48)
      this.maxHp = Math.floor(maxHp * 7.5)
      this.radius = 23
    } else {
      this.speed = baseSpeed
      this.maxHp = maxHp
      this.radius = 12
    }

    this.hp = this.maxHp
    this.frozen = 0
    this.burnFrames = 0
    this.burnDamage = 0
    this.active = true
    this.isGolden = isGolden
    this.spinOffset = Math.random() * Math.PI * 2
  }

  applyBurn(frames: number, damagePerTick: number): void {
    this.burnFrames = Math.max(this.burnFrames, frames)
    this.burnDamage = Math.max(this.burnDamage, damagePerTick)
  }

  update(
    onReachEnd: () => void,
    centerSlowRadius: number = 0,
    centerSlowFactor: number = 1,
  ): void {
    const target = this.myPath[this.pathIndex + 1]
    if (!target) return

    // Burn DOT tick from Ódio buff
    if (this.burnFrames > 0) {
      this.burnFrames--
      this.hp -= this.burnDamage
    }

    let speedMult = this.frozen > 0 ? 0.4 : 1
    if (this.frozen > 0) this.frozen--

    // Gravitational Throne slow from "A Cadeira" at map center (400, 300)
    if (centerSlowRadius > 0 && centerSlowFactor < 1) {
      const distToCenter = Math.hypot(this.x - 400, this.y - 300)
      if (distToCenter <= centerSlowRadius) {
        speedMult *= centerSlowFactor
      }
    }

    const actualSpeed = this.speed * speedMult

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

    // Base color by archetype & state
    let baseFill = '#ff3333'
    let baseGlow = '#ff5555'
    if (this.archetype === 'runner') {
      baseFill = '#38bdf8'
      baseGlow = '#0ea5e9'
    } else if (this.archetype === 'tank') {
      baseFill = '#a855f7'
      baseGlow = '#c084fc'
    } else if (this.archetype === 'splitter') {
      baseFill = '#10b981'
      baseGlow = '#34d399'
    } else if (this.archetype === 'boss') {
      baseFill = '#dc2626'
      baseGlow = '#f59e0b'
    }

    if (this.isGolden) {
      baseFill = '#ffd700'
      baseGlow = '#ffd700'
    }
    if (this.frozen > 0) {
      baseFill = this.isGolden ? '#ccffff' : '#88ccff'
      baseGlow = '#00ffff'
    } else if (this.burnFrames > 0) {
      baseGlow = '#ff6600'
    }

    ctx.shadowBlur = this.archetype === 'boss' ? 20 : 10
    ctx.shadowColor = baseGlow
    ctx.fillStyle = baseFill

    const spin = Date.now() / (this.archetype === 'runner' ? 140 : 300) + this.spinOffset

    if (this.archetype === 'runner') {
      // Sleek high-speed 3-point dart
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI * 2) / 3
        const r = i === 0 ? this.radius * 1.25 : this.radius * 0.85
        const px = this.x + r * Math.cos(a)
        const py = this.y + r * Math.sin(a)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    } else if (this.archetype === 'tank') {
      // Heavy armored octagon with inner core
      const sides = 8
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const a = spin * 0.4 + (i * Math.PI * 2) / sides
        const px = this.x + this.radius * Math.cos(a)
        const py = this.y + this.radius * Math.sin(a)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#f3e8ff'
      ctx.lineWidth = 2
      ctx.stroke()
    } else if (this.archetype === 'splitter') {
      // Twin-core diamond cell
      const sides = 4
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
      // Twin nuclei
      ctx.fillStyle = '#d1fae5'
      ctx.beginPath()
      ctx.arc(this.x - 3.5, this.y, 2.5, 0, Math.PI * 2)
      ctx.arc(this.x + 3.5, this.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    } else if (this.archetype === 'boss') {
      // "O Juiz Interno" — Sacred Geometry Boss
      const outerSides = 12
      ctx.beginPath()
      for (let i = 0; i < outerSides; i++) {
        const a = spin * 0.5 + (i * Math.PI * 2) / outerSides
        const r = i % 2 === 0 ? this.radius : this.radius * 0.72
        const px = this.x + r * Math.cos(a)
        const py = this.y + r * Math.sin(a)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Inner eye core
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2)
      ctx.fill()
    } else {
      const sides = Math.min(3 + Math.floor((this.wave - 1) / 10), 20)
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
    }

    // HP Bar
    ctx.shadowBlur = 0
    const barW = this.archetype === 'boss' ? 44 : 24
    const barH = this.archetype === 'boss' ? 6 : 4
    const barY = this.y - this.radius - 10
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(this.x - barW / 2 - 1, barY - 1, barW + 2, barH + 2)
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(this.x - barW / 2, barY, barW, barH)
    ctx.fillStyle = this.archetype === 'boss' ? '#fbbf24' : '#22c55e'
    ctx.fillRect(this.x - barW / 2, barY, barW * Math.max(0, this.hp / this.maxHp), barH)

    if (this.archetype === 'boss') {
      ctx.fillStyle = '#fde047'
      ctx.font = 'bold 9px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText('O JUIZ INTERNO', this.x, barY - 5)
    }

    ctx.restore()
  }

  static spawnParticles(x: number, y: number): Particle[] {
    const result: Particle[] = []
    for (let i = 0; i < 10; i++) result.push(new Particle(x, y, '#fff'))
    return result
  }
}


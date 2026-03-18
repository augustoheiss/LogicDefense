import type { TowerType } from '../types/game'
import { Enemy } from './Enemy'
import { Particle } from './Particle'

export class Bullet {
  x: number
  y: number
  target: Enemy
  type: TowerType
  damage: number
  speed: number
  active: boolean

  constructor(
    x: number,
    y: number,
    target: Enemy,
    type: TowerType,
    damage: number,
    wave: number,
  ) {
    this.x = x
    this.y = y
    this.target = target
    this.type = type
    this.damage = damage
    this.speed = 25 + wave * 0.5
    this.active = true
  }

  update(
    enemies: Enemy[],
    onEnemyKilled: (enemy: Enemy, earned: number) => void,
    goldMultiplier: number,
    particlesOut: Particle[],
    onSound: (type: string) => void,
  ): void {
    if (!this.target || !this.target.active) { this.active = false; return }

    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= this.speed) {
      this.hit(this.target, enemies, onEnemyKilled, goldMultiplier, particlesOut, onSound)
      this.active = false
    } else {
      this.x += (dx / dist) * this.speed
      this.y += (dy / dist) * this.speed
    }
  }

  private hit(
    enemy: Enemy,
    enemies: Enemy[],
    onEnemyKilled: (enemy: Enemy, earned: number) => void,
    goldMultiplier: number,
    particlesOut: Particle[],
    onSound: (type: string) => void,
  ): void {
    enemy.hp -= this.damage

    if (this.type.slow) {
      enemy.frozen = 60
      const slowRadius = 60
      enemies.forEach(e => {
        if (e.active && Math.sqrt((e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2) <= slowRadius) e.frozen = 60
      })
      for (let i = 0; i < 15; i++) particlesOut.push(new Particle(enemy.x, enemy.y, '#00ffff'))
    }

    if (this.type.splash) {
      const splashRadius = 50
      enemies.forEach(e => {
        if (e !== enemy && e.active && Math.sqrt((e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2) <= splashRadius) {
          e.hp -= this.damage * 0.5
        }
      })
      for (let i = 0; i < 15; i++) particlesOut.push(new Particle(enemy.x, enemy.y, '#ff8800'))
    }

    for (let i = 0; i < 5; i++) particlesOut.push(new Particle(enemy.x, enemy.y, this.type.color))
    onSound('hit')

    enemies.forEach(e => {
      if (e.hp <= 0 && e.active) {
        const earned = Math.floor(3 * goldMultiplier)
        e.active = false
        onEnemyKilled(e, earned)
        if (particlesOut.length < 300) {
          for (let i = 0; i < 10; i++) particlesOut.push(new Particle(e.x, e.y, '#fff'))
        }
      }
    })
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.shadowBlur = 10; ctx.shadowColor = this.type.color
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

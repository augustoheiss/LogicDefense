import type { TowerType } from '../types/game'
import { Enemy } from './Enemy'
import { Particle } from './Particle'

/** Radius (in pixels) for the AoE nuke blast when the math buff is active */
const AOE_NUKE_RADIUS = 150
const ODIO_AOE_NUKE_RADIUS = 200

export class Bullet {
  x: number
  y: number
  target: Enemy
  type: TowerType
  damage: number
  speed: number
  active: boolean
  isResonant: boolean
  odioActive: boolean

  constructor(
    x: number,
    y: number,
    target: Enemy,
    type: TowerType,
    damage: number,
    wave: number,
    isResonant: boolean = false,
    odioActive: boolean = false,
  ) {
    this.x = x
    this.y = y
    this.target = target
    this.type = type
    this.damage = damage
    this.speed = 25 + wave * 0.5
    this.active = true
    this.isResonant = isResonant
    this.odioActive = odioActive
  }

  update(
    enemies: Enemy[],
    onEnemyKilled: (enemy: Enemy, earned: number) => void,
    goldMultiplier: number,
    particlesOut: Particle[],
    onSound: (type: string) => void,
    aoeBuffActive: boolean = false,
  ): void {
    if (!this.target || !this.target.active) { this.active = false; return }

    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist <= this.speed) {
      this.hit(this.target, enemies, onEnemyKilled, goldMultiplier, particlesOut, onSound, aoeBuffActive)
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
    aoeBuffActive: boolean = false,
  ): void {
    // ── Operational Resonance bonus for ÷ (Sniper execution vs Tanks/Bosses) ──
    let effectiveDamage = this.damage
    if (this.isResonant && this.type.symbol === '÷' && (enemy.archetype === 'tank' || enemy.archetype === 'boss')) {
      effectiveDamage *= 1.45
    }

    const nukeRadius = this.odioActive ? ODIO_AOE_NUKE_RADIUS : AOE_NUKE_RADIUS

    // ── AoE NUKE: when math buff is active, deal 100% damage to ALL enemies in blast radius ──
    if (aoeBuffActive) {
      const impactX = enemy.x
      const impactY = enemy.y
      enemies.forEach(e => {
        if (e.active && Math.sqrt((e.x - impactX) ** 2 + (e.y - impactY) ** 2) <= nukeRadius) {
          e.hp -= effectiveDamage
          if (this.odioActive) {
            e.applyBurn(120, Math.max(0.8, effectiveDamage * 0.025))
          }
        }
      })
      // Big explosion particle burst (orange/red nuke feel)
      const nukeColors = ['#ff4400', '#ff8800', '#ffcc00', '#ff0000', '#ff6600']
      for (let i = 0; i < 30; i++) {
        particlesOut.push(new Particle(
          impactX + (Math.random() - 0.5) * nukeRadius * 0.6,
          impactY + (Math.random() - 0.5) * nukeRadius * 0.6,
          nukeColors[Math.floor(Math.random() * nukeColors.length)],
        ))
      }
    } else {
      // Normal single-target damage
      enemy.hp -= effectiveDamage
      if (this.odioActive) {
        enemy.applyBurn(120, Math.max(0.8, effectiveDamage * 0.025))
      }
    }

    if (this.type.slow) {
      const freezeDuration = this.isResonant ? 95 : 60
      const slowRadius = this.isResonant ? 90 : 60
      enemy.frozen = freezeDuration
      enemies.forEach(e => {
        if (e.active && Math.sqrt((e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2) <= slowRadius) {
          e.frozen = Math.max(e.frozen, freezeDuration)
        }
      })
      for (let i = 0; i < 15; i++) particlesOut.push(new Particle(enemy.x, enemy.y, '#00ffff'))
    }

    if (this.type.splash && !aoeBuffActive) {
      // Normal splash only when AoE buff is NOT active (buff already does full AoE)
      const splashRadius = this.isResonant ? 85 : 50
      const splashRatio = this.isResonant ? 0.75 : 0.5
      enemies.forEach(e => {
        if (e !== enemy && e.active && Math.sqrt((e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2) <= splashRadius) {
          e.hp -= effectiveDamage * splashRatio
          if (this.odioActive) {
            e.applyBurn(90, Math.max(0.5, effectiveDamage * 0.015))
          }
        }
      })
      for (let i = 0; i < 15; i++) particlesOut.push(new Particle(enemy.x, enemy.y, '#ff8800'))
    }

    if (!aoeBuffActive) {
      const pCount = this.isResonant ? 9 : 5
      for (let i = 0; i < pCount; i++) particlesOut.push(new Particle(enemy.x, enemy.y, this.type.color))
    }
    onSound('hit')

    enemies.forEach(e => {
      if (e.hp <= 0 && e.active) {
        const archetypeBonus =
          e.archetype === 'boss' ? 8 :
          e.archetype === 'tank' ? 2.2 :
          e.archetype === 'splitter' ? 1.5 : 1
        const earned = Math.max(1, Math.floor(3 * goldMultiplier * archetypeBonus))
        e.active = false
        onEnemyKilled(e, earned)
        if (particlesOut.length < 300) {
          for (let i = 0; i < 10; i++) particlesOut.push(new Particle(e.x, e.y, '#fff'))
        }
      }
    })
  }

  draw(ctx: CanvasRenderingContext2D, aoeBuffActive: boolean = false): void {
    ctx.save()
    if (aoeBuffActive) {
      // Nuke visual: larger projectile with red/orange pulsing glow
      const pulse = 1 + 0.3 * Math.sin(Date.now() / 80)
      ctx.shadowBlur = 25 * pulse
      ctx.shadowColor = '#ff4400'
      ctx.fillStyle = '#ff6600'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 7 * pulse, 0, Math.PI * 2)
      ctx.fill()
      // Inner bright core
      ctx.fillStyle = '#ffcc00'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (this.isResonant) {
      ctx.shadowBlur = 16
      ctx.shadowColor = this.type.color
      ctx.fillStyle = this.type.color
      ctx.beginPath()
      ctx.arc(this.x, this.y, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.shadowBlur = 10; ctx.shadowColor = this.type.color
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}


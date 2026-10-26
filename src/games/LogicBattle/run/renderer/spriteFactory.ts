// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/spriteFactory.ts — Cache Offscreen de Pelotões 3D
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import { UNIT_TIERS } from '../../config/unitTiers'
import { UnitTierSpec } from '../../types'

const tierSpriteCache = new Map<number, HTMLCanvasElement>()

/**
 * Desenha um soldado/comandante em perspectiva 3/4 de costas (sem bandeira embutida,
 * pois os estandartes são renderizados sem colisão por `crowdRenderer.ts`).
 * - `tierIndex === 0`: Recruta Azul (capacete azul brilhante, túnica azul, botas marrons, espada erguida à direita)
 * - `tierIndex === 1 | 2`: Centurião de Bronze (capacete de bronze com crista vermelha, couraça de bronze, escudo redondo à direita, mastro à esquerda)
 * - `tierIndex >= 3`: Cavaleiro / Quiliarca Dourado Gigante (armadura dourada maciça, ombreiras largas, escudo à esquerda, lança luminosa à direita)
 */
function createSingleTierSprite(tier: UnitTierSpec): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const isKnight = tier.tierIndex >= 3
  const isCenturion = tier.tierIndex === 1 || tier.tierIndex === 2

  const w = isKnight ? 96 : isCenturion ? 76 : 54
  const h = isKnight ? 108 : isCenturion ? 88 : 62
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const cx = w / 2
  const bottomY = h - 7

  // 1. Sombra elíptica no chão da ponte
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)'
  ctx.beginPath()
  ctx.ellipse(
    cx,
    bottomY,
    isKnight ? 24 : isCenturion ? 18 : 13,
    isKnight ? 9 : isCenturion ? 7 : 5.5,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()

  if (isKnight) {
    // ── CAVALEIRO / QUILIARCA DOURADO GIGANTE (Direita da Ponte em mundo1_ponte_conceito.jpg) ──
    // Aura dourada no chão
    const aura = ctx.createRadialGradient(cx, bottomY - 2, 3, cx, bottomY - 2, 32)
    aura.addColorStop(0, 'rgba(250, 204, 21, 0.55)')
    aura.addColorStop(1, 'rgba(250, 204, 21, 0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.ellipse(cx, bottomY - 2, 32, 13, 0, 0, Math.PI * 2)
    ctx.fill()

    // Lança longa dourada à direita com ponta de luz branca/amarela
    const spearBaseX = cx + 25
    const spearTopX = cx + 31
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(spearBaseX, bottomY - 2)
    ctx.lineTo(spearTopX, bottomY - 68)
    ctx.stroke()

    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(spearBaseX, bottomY - 2)
    ctx.lineTo(spearTopX, bottomY - 68)
    ctx.stroke()

    // Ponta de lança grande reluzente
    ctx.fillStyle = '#fef9c3'
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(spearTopX + 2, bottomY - 94)
    ctx.lineTo(spearTopX + 10, bottomY - 66)
    ctx.lineTo(spearTopX, bottomY - 70)
    ctx.lineTo(spearTopX - 8, bottomY - 66)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Escudo dourado à esquerda
    ctx.fillStyle = '#ca8a04'
    ctx.strokeStyle = '#fef08a'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.ellipse(cx - 21, bottomY - 30, 8, 17, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Botas douradas pesadas
    ctx.fillStyle = '#b45309'
    ctx.strokeStyle = '#451a03'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 14, bottomY - 14, 11, 13, 4)
    ctx.roundRect(cx + 3, bottomY - 14, 11, 13, 4)
    ctx.fill()
    ctx.stroke()

    // Saiote de cota de malha escura
    ctx.fillStyle = '#475569'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 17, bottomY - 25, 34, 13, 4)
    ctx.fill()
    ctx.stroke()

    // Couraça dourada larga
    const armorGrad = ctx.createLinearGradient(cx - 20, bottomY - 54, cx + 20, bottomY - 22)
    armorGrad.addColorStop(0, '#fef08a')
    armorGrad.addColorStop(0.45, '#facc15')
    armorGrad.addColorStop(1, '#b45309')
    ctx.fillStyle = armorGrad
    ctx.strokeStyle = '#713f12'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.roundRect(cx - 19, bottomY - 52, 38, 29, 9)
    ctx.fill()
    ctx.stroke()

    // Ombreiras douradas gigantes (Pauldrons)
    for (const dir of [-1, 1]) {
      ctx.fillStyle = armorGrad
      ctx.strokeStyle = '#713f12'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(cx + dir * 20, bottomY - 42, 11, 9, dir * 0.35, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // Elmo cilíndrico/arredondado dourado
    const helmGrad = ctx.createRadialGradient(cx - 4, bottomY - 64, 2, cx, bottomY - 60, 14)
    helmGrad.addColorStop(0, '#fef9c3')
    helmGrad.addColorStop(0.55, '#facc15')
    helmGrad.addColorStop(1, '#a16207')
    ctx.fillStyle = helmGrad
    ctx.strokeStyle = '#713f12'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 11, bottomY - 70, 22, 19, 8)
    ctx.fill()
    ctx.stroke()

    return canvas
  }

  if (isCenturion) {
    // ── CENTURIÃO DE BRONZE COM CRISTA VERMELHA (Esquerda da Ponte em mundo1_ponte_conceito.jpg) ──
    // Mastro de madeira à esquerda
    ctx.strokeStyle = '#b45309'
    ctx.lineWidth = 3.2
    ctx.beginPath()
    ctx.moveTo(cx - 16, bottomY - 4)
    ctx.lineTo(cx - 18, bottomY - 68)
    ctx.stroke()

    // Escudo redondo de bronze à direita
    ctx.fillStyle = '#78350f'
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(cx + 16, bottomY - 26, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Botas marrons
    ctx.fillStyle = '#451a03'
    ctx.beginPath()
    ctx.roundRect(cx - 9, bottomY - 11, 7, 10, 3)
    ctx.roundRect(cx + 2, bottomY - 11, 7, 10, 3)
    ctx.fill()

    // Saiote azul e bronze
    ctx.fillStyle = '#1d4ed8'
    ctx.strokeStyle = '#1e3a8a'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.roundRect(cx - 11, bottomY - 20, 22, 10, 3)
    ctx.fill()
    ctx.stroke()

    // Couraça de bronze
    const bronzeGrad = ctx.createLinearGradient(cx - 12, bottomY - 42, cx + 12, bottomY - 18)
    bronzeGrad.addColorStop(0, '#f59e0b')
    bronzeGrad.addColorStop(0.5, '#b45309')
    bronzeGrad.addColorStop(1, '#78350f')
    ctx.fillStyle = bronzeGrad
    ctx.strokeStyle = '#451a03'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.roundRect(cx - 12, bottomY - 40, 24, 22, 6)
    ctx.fill()
    ctx.stroke()

    // Capacete de bronze arredondado
    const cHelm = ctx.createRadialGradient(cx - 3, bottomY - 52, 1, cx, bottomY - 48, 13)
    cHelm.addColorStop(0, '#fcd34d')
    cHelm.addColorStop(0.6, '#d97706')
    cHelm.addColorStop(1, '#78350f')
    ctx.fillStyle = cHelm
    ctx.strokeStyle = '#451a03'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(cx, bottomY - 49, 12.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Crista longitudinal vermelha (Mohican Crest — fiel a mundo1_ponte_conceito.jpg)
    ctx.fillStyle = '#ef4444'
    ctx.strokeStyle = '#991b1b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(cx - 3.5, bottomY - 66, 7, 20, 3.5)
    ctx.fill()
    ctx.stroke()

    return canvas
  }

  // ── RECRUTA AZUL (Fileiras da Legião em mundo1_ponte_conceito.jpg) ──
  // Espada curta de aço erguida verticalmente à direita
  const swordX = cx + 12
  const swordBaseY = bottomY - 16
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(swordX, swordBaseY)
  ctx.lineTo(swordX + 1.5, swordBaseY - 20)
  ctx.stroke()

  // Punho/guarda da espada
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(swordX - 3, swordBaseY - 2)
  ctx.lineTo(swordX + 3, swordBaseY - 2)
  ctx.stroke()

  // Botas marrons
  ctx.fillStyle = '#78350f'
  ctx.strokeStyle = '#290f02'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.roundRect(cx - 7.5, bottomY - 9, 6, 8, 2.5)
  ctx.roundRect(cx + 1.5, bottomY - 9, 6, 8, 2.5)
  ctx.fill()
  ctx.stroke()

  // Escudo redondo escuro/azul na esquerda
  ctx.fillStyle = '#1e3a8a'
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(cx - 10, bottomY - 19, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Túnica azul-real com barra marrom
  const tunicGrad = ctx.createLinearGradient(cx - 9, bottomY - 30, cx + 9, bottomY - 8)
  tunicGrad.addColorStop(0, '#3b82f6')
  tunicGrad.addColorStop(0.7, '#1d4ed8')
  tunicGrad.addColorStop(1, '#78350f')
  ctx.fillStyle = tunicGrad
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.roundRect(cx - 9.5, bottomY - 29, 19, 21, 5)
  ctx.fill()
  ctx.stroke()

  // Capacete azul 3D brilhante com costura central e aba traseira (idêntico a mundo1_ponte_conceito.jpg)
  const helmetR = 11.2
  const headY = bottomY - 37
  const helmetGrad = ctx.createRadialGradient(
    cx - 3.5,
    headY - 4,
    1.5,
    cx,
    headY,
    helmetR,
  )
  helmetGrad.addColorStop(0, '#93c5fd')
  helmetGrad.addColorStop(0.5, '#3b82f6')
  helmetGrad.addColorStop(1, '#1d4ed8')

  ctx.fillStyle = helmetGrad
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, headY, helmetR, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Costura vertical sutil no topo do capacete e aba inferior
  ctx.strokeStyle = 'rgba(30, 58, 138, 0.55)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx, headY - helmetR + 1.5)
  ctx.lineTo(cx, headY + 3)
  ctx.stroke()

  ctx.strokeStyle = '#93c5fd'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, headY + 1.5, helmetR * 0.88, Math.PI * 0.14, Math.PI * 0.86)
  ctx.stroke()

  return canvas
}

export function getTierSprite(tierIndex: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const clamped = Math.max(0, Math.min(UNIT_TIERS.length - 1, tierIndex))
  const cached = tierSpriteCache.get(clamped)
  if (cached) return cached

  const spec = UNIT_TIERS[clamped]
  const sprite = createSingleTierSprite(spec)
  tierSpriteCache.set(clamped, sprite)
  return sprite
}

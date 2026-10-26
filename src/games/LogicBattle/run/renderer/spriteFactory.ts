// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/spriteFactory.ts — Cache Offscreen de Pelotões
// ──────────────────────────────────────────────────────────────────────────────
import { UNIT_TIERS } from '../../config/unitTiers'
import { UnitTierSpec } from '../../types'

const tierSpriteCache = new Map<number, HTMLCanvasElement>()

function createSingleTierSprite(tier: UnitTierSpec): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const pad = 10
  const w = tier.radiusPx * 2 + pad * 2
  const h = tier.heightPx + tier.radiusPx + pad * 2
  canvas.width = w
  canvas.height = h

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const cx = w / 2
  const bottomY = h - pad

  // Sombra elíptica no chão
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)'
  ctx.beginPath()
  ctx.ellipse(cx, bottomY, tier.radiusPx * 0.95, tier.radiusPx * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()

  // Aura para unidades >= Centurião (tierIndex >= 2)
  if (tier.tierIndex >= 2) {
    const auraGrad = ctx.createRadialGradient(
      cx,
      bottomY - tier.heightPx * 0.45,
      2,
      cx,
      bottomY - tier.heightPx * 0.45,
      tier.radiusPx * 1.35,
    )
    auraGrad.addColorStop(0, tier.accentColor)
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = auraGrad
    ctx.beginPath()
    ctx.arc(cx, bottomY - tier.heightPx * 0.45, tier.radiusPx * 1.35, 0, Math.PI * 2)
    ctx.fill()
  }

  // Corpo/armadura do pelotão
  const bodyTopY = bottomY - tier.heightPx * 0.72
  ctx.fillStyle = tier.secondaryColor
  ctx.strokeStyle = tier.accentColor
  ctx.lineWidth = tier.tierIndex >= 1 ? 2 : 1.2
  ctx.beginPath()
  ctx.roundRect(
    cx - tier.radiusPx * 0.78,
    bodyTopY,
    tier.radiusPx * 1.56,
    tier.heightPx * 0.7,
    Math.max(4, tier.radiusPx * 0.35),
  )
  ctx.fill()
  ctx.stroke()

  // Capacete / Cabeça
  const headY = bodyTopY - tier.radiusPx * 0.38
  ctx.fillStyle = tier.primaryColor
  ctx.beginPath()
  ctx.arc(cx, headY, tier.radiusPx * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Estandarte / Coroa para tiers >= 1 (10, 0,1k, 1k, ...)
  if (tier.tierIndex >= 1) {
    ctx.fillStyle = '#0f172a'
    ctx.strokeStyle = tier.accentColor
    ctx.lineWidth = 1.5
    const badgeW = Math.max(20, tier.radiusPx * 1.65)
    const badgeH = 13
    const badgeY = bottomY - tier.heightPx * 0.48
    ctx.beginPath()
    ctx.roundRect(cx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(tier.denominationLabel, cx, badgeY + 0.5)
  }

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

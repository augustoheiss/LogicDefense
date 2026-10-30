// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/bridge3d/spriteAtlasCache3D.ts
// Master Plan V11: Pipeline de Sprites 2.5D HD Ilustrados (512x512 CanvasTexture)
// com Alpha Cutout e Cache GPU Imutável (Zero alocação por frame no useFrame).
// Combina arte 2.5D detalhada (capacetes, viseiras, armaduras sombreadas, runas,
// crânios e brasões) com Rigs 3D Articulados (pernas, braços e armas animados).
// ──────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three'

export type UnitSpriteArchetype3D =
  | 'HERO_COMMANDER'
  | 'ALLIED_SOLDIER'
  | 'ALLIED_DECURION_10'
  | 'ALLIED_CENTURION_100'
  | 'ALLIED_CHAMPION_1000'
  | 'ENEMY_RAIDER'
  | 'ENEMY_MINIBOSS'
  | 'ENEMY_DEMOLISHER'
  | 'BOSS_CHESTPLATE'
  | 'TOWER_EMBLEM_INTACT'
  | 'TOWER_EMBLEM_DAMAGED'
  | 'TOWER_EMBLEM_RUINED'

const spriteTextureCache = new Map<UnitSpriteArchetype3D, THREE.Texture>()
let fallbackDataTexture: THREE.DataTexture | null = null

function getFallbackTexture(): THREE.DataTexture {
  if (!fallbackDataTexture) {
    const data = new Uint8Array([255, 255, 255, 255])
    fallbackDataTexture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    fallbackDataTexture.needsUpdate = true
  }
  return fallbackDataTexture
}

function drawRoundedShield(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fillGrad: CanvasGradient | string,
  strokeColor: string,
  lineWidth = 8,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.48, cy - h * 0.45)
  ctx.lineTo(cx + w * 0.48, cy - h * 0.45)
  ctx.lineTo(cx + w * 0.44, cy + h * 0.08)
  ctx.quadraticCurveTo(cx + w * 0.35, cy + h * 0.42, cx, cy + h * 0.52)
  ctx.quadraticCurveTo(cx - w * 0.35, cy + h * 0.42, cx - w * 0.44, cy + h * 0.08)
  ctx.closePath()
  ctx.fillStyle = fillGrad
  ctx.fill()
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = strokeColor
  ctx.stroke()
  ctx.restore()
}

function renderAlliedWarriorSprite(
  ctx: CanvasRenderingContext2D,
  opts: {
    armorTop: string
    armorBot: string
    trimColor: string
    plumeColor: string
    visorGlow: string
    emblemText: string
    hasCrown?: boolean
    hasWings?: boolean
  },
): void {
  const cx = 256
  ctx.clearRect(0, 0, 512, 512)

  // Asas solares opcionais (Campeão 1k / Centurião)
  if (opts.hasWings) {
    ctx.save()
    ctx.fillStyle = opts.plumeColor
    ctx.strokeStyle = opts.trimColor
    ctx.lineWidth = 6
    for (const dir of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + dir * 70, 220)
      ctx.quadraticCurveTo(cx + dir * 215, 110, cx + dir * 235, 175)
      ctx.quadraticCurveTo(cx + dir * 190, 260, cx + dir * 85, 305)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  // Penacho / Crista Imperial no topo do capacete
  ctx.save()
  const plumeGrad = ctx.createLinearGradient(cx, 24, cx, 125)
  plumeGrad.addColorStop(0, opts.plumeColor)
  plumeGrad.addColorStop(1, opts.trimColor)
  ctx.fillStyle = plumeGrad
  ctx.beginPath()
  ctx.moveTo(cx - 56, 112)
  ctx.quadraticCurveTo(cx, 18, cx + 56, 112)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#0f172a'
  ctx.stroke()
  ctx.restore()

  // Capacete de Cavaleiro 2.5D com sombreamento metálico
  ctx.save()
  const helmGrad = ctx.createRadialGradient(cx - 24, 130, 12, cx, 150, 92)
  helmGrad.addColorStop(0, '#f8fafc')
  helmGrad.addColorStop(0.45, opts.trimColor)
  helmGrad.addColorStop(1, '#1e293b')
  ctx.fillStyle = helmGrad
  ctx.beginPath()
  ctx.arc(cx, 152, 74, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = '#0f172a'
  ctx.stroke()

  // Visor luminoso em T
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(cx - 48, 136, 96, 26)
  ctx.fillRect(cx - 10, 136, 20, 56)
  ctx.fillStyle = opts.visorGlow
  ctx.shadowColor = opts.visorGlow
  ctx.shadowBlur = 14
  ctx.fillRect(cx - 40, 142, 32, 12)
  ctx.fillRect(cx + 8, 142, 32, 12)
  ctx.restore()

  if (opts.hasCrown) {
    ctx.save()
    ctx.fillStyle = '#fde047'
    ctx.strokeStyle = '#713f12'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - 58, 106)
    ctx.lineTo(cx - 42, 64)
    ctx.lineTo(cx - 18, 92)
    ctx.lineTo(cx, 52)
    ctx.lineTo(cx + 18, 92)
    ctx.lineTo(cx + 42, 64)
    ctx.lineTo(cx + 58, 106)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // Ombreiras Blindadas (Esquerda e Direita)
  for (const dir of [-1, 1]) {
    ctx.save()
    const ox = cx + dir * 132
    const oy = 258
    const pGrad = ctx.createRadialGradient(ox - dir * 14, oy - 14, 8, ox, oy, 58)
    pGrad.addColorStop(0, opts.trimColor)
    pGrad.addColorStop(0.6, opts.armorTop)
    pGrad.addColorStop(1, '#0f172a')
    ctx.fillStyle = pGrad
    ctx.beginPath()
    ctx.arc(ox, oy, 52, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 7
    ctx.strokeStyle = '#0f172a'
    ctx.stroke()
    ctx.restore()
  }

  // Torso / Escudo Peitoral Heráldico
  const bodyGrad = ctx.createLinearGradient(cx, 200, cx, 455)
  bodyGrad.addColorStop(0, opts.armorTop)
  bodyGrad.addColorStop(1, opts.armorBot)
  drawRoundedShield(ctx, cx, 330, 224, 248, bodyGrad, opts.trimColor, 10)

  // Insígnia central no peitoral
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#000000'
  ctx.shadowBlur = 8
  ctx.font = '900 58px "Inter", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.emblemText, cx, 326)
  ctx.restore()
}

function renderEnemyMonsterSprite(
  ctx: CanvasRenderingContext2D,
  opts: {
    skinTop: string
    skinBot: string
    hornColor: string
    eyeGlow: string
    trimColor: string
    badgeText: string
    isDemolisher?: boolean
  },
): void {
  const cx = 256
  ctx.clearRect(0, 0, 512, 512)

  // Chifres curvos demoníacos/guerreiros
  ctx.save()
  ctx.fillStyle = opts.hornColor
  ctx.strokeStyle = '#090d16'
  ctx.lineWidth = 7
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + dir * 48, 128)
    ctx.quadraticCurveTo(cx + dir * 135, 92, cx + dir * 155, 34)
    ctx.quadraticCurveTo(cx + dir * 112, 138, cx + dir * 64, 166)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  // Cabeça / Elmo Sombrio da Horda
  ctx.save()
  const headGrad = ctx.createRadialGradient(cx, 138, 12, cx, 152, 82)
  headGrad.addColorStop(0, opts.skinTop)
  headGrad.addColorStop(1, '#180404')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.arc(cx, 152, 76, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = opts.trimColor
  ctx.stroke()

  // Olhos malignos brilhantes em V
  ctx.fillStyle = opts.eyeGlow
  ctx.shadowColor = opts.eyeGlow
  ctx.shadowBlur = 16
  ctx.beginPath()
  ctx.moveTo(cx - 46, 136)
  ctx.lineTo(cx - 12, 150)
  ctx.lineTo(cx - 42, 158)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx + 46, 136)
  ctx.lineTo(cx + 12, 150)
  ctx.lineTo(cx + 42, 158)
  ctx.closePath()
  ctx.fill()

  // Presas / Grade mandibular
  ctx.shadowBlur = 0
  ctx.fillStyle = '#f8fafc'
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * 16 - 6, 186)
    ctx.lineTo(cx + i * 16, 170)
    ctx.lineTo(cx + i * 16 + 6, 186)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Ombreiras com espinhos
  for (const dir of [-1, 1]) {
    ctx.save()
    const ox = cx + dir * 136
    const oy = 258
    ctx.fillStyle = opts.skinBot
    ctx.strokeStyle = opts.trimColor
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(ox, oy, 54, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Espinho da ombreira
    ctx.fillStyle = opts.hornColor
    ctx.beginPath()
    ctx.moveTo(ox + dir * 18, oy - 36)
    ctx.lineTo(ox + dir * 68, oy - 74)
    ctx.lineTo(ox + dir * 42, oy - 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // Torso blindado ou Barril Explosivo Rúnico (Demolisher)
  const chestGrad = ctx.createLinearGradient(cx, 205, cx, 460)
  chestGrad.addColorStop(0, opts.skinTop)
  chestGrad.addColorStop(1, opts.skinBot)
  drawRoundedShield(ctx, cx, 334, 232, 248, chestGrad, opts.trimColor, 10)

  if (opts.isDemolisher) {
    // Aros metálicos de barril explosivo + núcleo de magma
    ctx.save()
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(cx - 95, 285)
    ctx.lineTo(cx + 95, 285)
    ctx.moveTo(cx - 88, 375)
    ctx.lineTo(cx + 88, 375)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = '#fef08a'
  ctx.shadowColor = '#000000'
  ctx.shadowBlur = 10
  ctx.font = '900 56px "Inter", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.badgeText, cx, 330)
  ctx.restore()
}

function renderTowerFacadeSprite(
  ctx: CanvasRenderingContext2D,
  state: 'INTACT' | 'DAMAGED' | 'RUINED',
): void {
  const cx = 256
  ctx.clearRect(0, 0, 512, 512)

  const topColor =
    state === 'INTACT'
      ? '#0284c7'
      : state === 'DAMAGED'
        ? '#d97706'
        : '#7f1d1d'
  const botColor =
    state === 'INTACT'
      ? '#0f172a'
      : state === 'DAMAGED'
        ? '#451a03'
        : '#1c1917'
  const borderColor =
    state === 'INTACT'
      ? '#38bdf8'
      : state === 'DAMAGED'
        ? '#facc15'
        : '#ef4444'

  const grad = ctx.createLinearGradient(cx, 64, cx, 448)
  grad.addColorStop(0, topColor)
  grad.addColorStop(1, botColor)

  drawRoundedShield(ctx, cx, 256, 340, 360, grad, borderColor, 12)

  // Rachaduras de cerco quando danificada ou em ruína
  if (state !== 'INTACT') {
    ctx.save()
    ctx.strokeStyle = state === 'RUINED' ? '#fb923c' : '#fde047'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(cx - 80, 140)
    ctx.lineTo(cx - 15, 230)
    ctx.lineTo(cx + 55, 295)
    ctx.lineTo(cx + 15, 395)
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 68px "Inter", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    state === 'INTACT' ? '🛡️' : state === 'DAMAGED' ? '⚠️' : '🔥',
    cx,
    256,
  )
  ctx.restore()
}

export function getUnitSpriteTexture(
  archetype: UnitSpriteArchetype3D,
): THREE.Texture {
  const existing = spriteTextureCache.get(archetype)
  if (existing) {
    return existing
  }

  if (typeof document === 'undefined') {
    return getFallbackTexture()
  }

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return getFallbackTexture()
  }

  switch (archetype) {
    case 'HERO_COMMANDER':
      renderAlliedWarriorSprite(ctx, {
        armorTop: '#2563eb',
        armorBot: '#1e3a8a',
        trimColor: '#facc15',
        plumeColor: '#38bdf8',
        visorGlow: '#fef08a',
        emblemText: '⚡',
        hasCrown: true,
      })
      break
    case 'ALLIED_SOLDIER':
      renderAlliedWarriorSprite(ctx, {
        armorTop: '#3b82f6',
        armorBot: '#1d4ed8',
        trimColor: '#93c5fd',
        plumeColor: '#60a5fa',
        visorGlow: '#bae6fd',
        emblemText: '🛡️',
      })
      break
    case 'ALLIED_DECURION_10':
      renderAlliedWarriorSprite(ctx, {
        armorTop: '#06b6d4',
        armorBot: '#0e7490',
        trimColor: '#67e8f9',
        plumeColor: '#22d3ee',
        visorGlow: '#a5f3fc',
        emblemText: 'X',
      })
      break
    case 'ALLIED_CENTURION_100':
      renderAlliedWarriorSprite(ctx, {
        armorTop: '#d97706',
        armorBot: '#78350f',
        trimColor: '#fde047',
        plumeColor: '#ef4444',
        visorGlow: '#fef08a',
        emblemText: 'C',
        hasWings: true,
      })
      break
    case 'ALLIED_CHAMPION_1000':
      renderAlliedWarriorSprite(ctx, {
        armorTop: '#eab308',
        armorBot: '#854d0e',
        trimColor: '#fef08a',
        plumeColor: '#facc15',
        visorGlow: '#ffffff',
        emblemText: '👑',
        hasCrown: true,
        hasWings: true,
      })
      break
    case 'ENEMY_RAIDER':
      renderEnemyMonsterSprite(ctx, {
        skinTop: '#dc2626',
        skinBot: '#7f1d1d',
        hornColor: '#cbd5e1',
        eyeGlow: '#fef08a',
        trimColor: '#450a0a',
        badgeText: '⚔️',
      })
      break
    case 'ENEMY_MINIBOSS':
      renderEnemyMonsterSprite(ctx, {
        skinTop: '#991b1b',
        skinBot: '#450a0a',
        hornColor: '#facc15',
        eyeGlow: '#fb923c',
        trimColor: '#facc15',
        badgeText: '💀',
      })
      break
    case 'ENEMY_DEMOLISHER':
      renderEnemyMonsterSprite(ctx, {
        skinTop: '#b91c1c',
        skinBot: '#450a0a',
        hornColor: '#fb923c',
        eyeGlow: '#fde047',
        trimColor: '#f97316',
        badgeText: '💣',
        isDemolisher: true,
      })
      break
    case 'BOSS_CHESTPLATE':
      renderEnemyMonsterSprite(ctx, {
        skinTop: '#7f1d1d',
        skinBot: '#180404',
        hornColor: '#fde047',
        eyeGlow: '#ef4444',
        trimColor: '#eab308',
        badgeText: '👹',
      })
      break
    case 'TOWER_EMBLEM_INTACT':
      renderTowerFacadeSprite(ctx, 'INTACT')
      break
    case 'TOWER_EMBLEM_DAMAGED':
      renderTowerFacadeSprite(ctx, 'DAMAGED')
      break
    case 'TOWER_EMBLEM_RUINED':
      renderTowerFacadeSprite(ctx, 'RUINED')
      break
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  spriteTextureCache.set(archetype, texture)
  return texture
}

export function getSpriteAtlasCacheStats(): {
  cachedTexturesCount: number
  keys: UnitSpriteArchetype3D[]
} {
  return {
    cachedTexturesCount: spriteTextureCache.size,
    keys: Array.from(spriteTextureCache.keys()),
  }
}


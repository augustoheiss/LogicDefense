// ============================================================
// Logic Friction — 2.5D Procedural Sprite Atlas & Texture Registry
// Phase 01: Singleton GPU Texture & Geometry Cache
//
// Generates high-DPI (512x512 / 1024x1024) procedural 2D sprites
// designed for 2.5D Multi-Layer Parallax Stacking & Cross-Quad rigs.
//
// MEMORY SAFETY:
//   - Every texture is generated at most ONCE and cached in a singleton Map.
//   - Shared geometries (Unit Plane, Pedestal Disc) are allocated once.
//   - Zero network requests, zero 404s, zero per-spawn GC churn.
// ============================================================
import * as THREE from 'three'

export type SpriteEntityCategory =
  | 'FLOOR_MOTHERBOARD'
  | 'CORE_BASE_MANDALA'
  | 'CORE_ASTROLABE_BACK'
  | 'CORE_CITADEL_BODY'
  | 'CORE_CITADEL_BUFF'
  | 'CORE_SHIELD_FRONT'
  | 'PLAYER_MANTLE_BACK'
  | 'PLAYER_ARCHITECT_CLOAK'
  | 'PLAYER_DIVINE_WINGS'
  | 'PLAYER_ARCHITECT_BODY'
  | 'PLAYER_ARCHITECT_BUFF'
  | 'PLAYER_STAFF_FRONT'
  | 'PLAYER_ARCHITECT_STAFF'
  | 'PLAYER_MELEE_SLASH'
  | 'TOWER_RAPID_BASE'
  | 'TOWER_RAPID_TURRET'
  | 'TOWER_HEAVY_BASE'
  | 'TOWER_HEAVY_TURRET'
  | 'TOWER_SLOW_BASE'
  | 'TOWER_SLOW_TURRET'
  | 'TOWER_SNIPER_BASE'
  | 'TOWER_SNIPER_TURRET'
  | 'SITE_HOLOGRAM_CAGE'
  | 'ENEMY_CRAWLER_BACK'
  | 'ENEMY_CRAWLER_LEGS'
  | 'ENEMY_CRAWLER_BODY'
  | 'ENEMY_PHANTOM_BACK'
  | 'ENEMY_PHANTOM_CLOAK'
  | 'ENEMY_PHANTOM_BODY'
  | 'ENEMY_PHANTOM_MASK'
  | 'ENEMY_GOLEM_BACK'
  | 'ENEMY_GOLEM_AURA'
  | 'ENEMY_GOLEM_BODY'
  | 'ENEMY_TROJAN_BODY'
  | 'ENEMY_TROJAN_SHIELD'
  | 'ENEMY_SIEGE_OVERLAY'
  | 'ENEMY_ICE_SHARD'
  | 'BOSS_WHEEL_BACK'
  | 'BOSS_WINGS_MID'
  | 'BOSS_LEVIATHAN_BODY'
  | 'BOSS_MASK_GOLD'
  | 'BOSS_MASK_PUNISH'
  | 'BOSS_SCEPTER_FRONT'
  | 'PROP_SPAWN_PORTAL'
  | 'PORTAL_GLITCH_RIFT'
  | 'PORTAL_BASE_RING'
  | 'PROP_PERIMETER_OBELISK'
  | 'PROP_CRYSTAL_CLUSTER'
  | 'PROP_RUNE_TOTEM'
  | 'PROP_DATA_TREE'
  | 'PROP_HORIZON_MONOLITH'
  | 'MATH_PAD_RUNE_TOP'
  | 'MATH_PAD_PILLAR'
  | 'PROJECTILE_IMPACT_SPARK'

export type SpriteKey = SpriteEntityCategory

export interface LayerSpec25D {
  textureKey?: SpriteEntityCategory
  spriteKey?: SpriteEntityCategory
  zOffset: number
  yOffset?: number
  xOffset?: number
  width: number
  height: number
  alphaTest?: number
  additive?: boolean
  spinSpeed?: number
  bobAmp?: number
  bobAmplitude?: number
  bobSpeed?: number
  pulseSpeed?: number
  pulseAmplitude?: number
  flipbookFps?: number
  opacityMult?: number
  opacity?: number
}

// ── Null Raycast Helper (Prevents transparent 2.5D quads from blocking Arena floor clicks) ──
export function noRaycast(): null {
  return null
}

// ── Singleton Caches ────────────────────────────────────────────────────────────
const textureCache = new Map<SpriteEntityCategory, THREE.CanvasTexture>()
const flipbookCache = new Map<SpriteEntityCategory, THREE.CanvasTexture[]>()
let sharedPlaneGeo: THREE.PlaneGeometry | null = null
let sharedDiscGeo: THREE.RingGeometry | null = null

export function getSharedUnitPlaneGeometry(): THREE.PlaneGeometry {
  if (!sharedPlaneGeo) {
    sharedPlaneGeo = new THREE.PlaneGeometry(1, 1)
  }
  return sharedPlaneGeo
}

export const getSharedPlaneGeometry = getSharedUnitPlaneGeometry

export function getSharedPedestalDiscGeometry(): THREE.RingGeometry {
  if (!sharedDiscGeo) {
    sharedDiscGeo = new THREE.RingGeometry(0.15, 1.0, 24)
  }
  return sharedDiscGeo
}

const ALIAS_MAP: Partial<Record<SpriteEntityCategory, SpriteEntityCategory>> = {
  PLAYER_ARCHITECT_CLOAK: 'PLAYER_MANTLE_BACK',
  PLAYER_ARCHITECT_STAFF: 'PLAYER_STAFF_FRONT',
  ENEMY_CRAWLER_LEGS: 'ENEMY_CRAWLER_BACK',
  ENEMY_PHANTOM_CLOAK: 'ENEMY_PHANTOM_BACK',
  ENEMY_PHANTOM_MASK: 'ENEMY_PHANTOM_BODY',
  ENEMY_GOLEM_AURA: 'ENEMY_GOLEM_BACK',
  ENEMY_TROJAN_SHIELD: 'ENEMY_TROJAN_BODY',
  PORTAL_GLITCH_RIFT: 'PROP_SPAWN_PORTAL',
  PORTAL_BASE_RING: 'CORE_BASE_MANDALA',
}

function buildCanvasTexture(key: SpriteEntityCategory, frameIdx = 0): THREE.CanvasTexture {
  const size = key === 'FLOOR_MOTHERBOARD' ? 1024 : 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.clearRect(0, 0, size, size)
    drawSpriteArtwork(ctx, key, size, frameIdx)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

export function getSharedSpriteTexture(rawKey: SpriteEntityCategory): THREE.CanvasTexture {
  const key = ALIAS_MAP[rawKey] ?? rawKey
  const existing = textureCache.get(key)
  if (existing) return existing

  const tex = buildCanvasTexture(key, 0)
  textureCache.set(key, tex)
  return tex
}

/**
 * Returns 4 cached flipbook frames (F0..F3) for walk-cycle / idle animation
 * without mutating shared texture UV offsets across instances.
 */
export function getSharedFlipbookTextures(rawKey: SpriteEntityCategory): THREE.CanvasTexture[] {
  const key = ALIAS_MAP[rawKey] ?? rawKey
  const existing = flipbookCache.get(key)
  if (existing) return existing

  const f0 = getSharedSpriteTexture(key)
  const frames = [
    f0,
    buildCanvasTexture(key, 1),
    buildCanvasTexture(key, 2),
    buildCanvasTexture(key, 3),
  ]
  flipbookCache.set(key, frames)
  return frames
}

/** Pre-warm all core textures so wave transitions and boss spawns have 0ms frame hitch */
export function prewarmSpriteAtlas(): void {
  const allKeys: SpriteEntityCategory[] = [
    'FLOOR_MOTHERBOARD',
    'CORE_BASE_MANDALA',
    'CORE_ASTROLABE_BACK',
    'CORE_CITADEL_BODY',
    'CORE_CITADEL_BUFF',
    'CORE_SHIELD_FRONT',
    'PLAYER_MANTLE_BACK',
    'PLAYER_DIVINE_WINGS',
    'PLAYER_ARCHITECT_BODY',
    'PLAYER_ARCHITECT_BUFF',
    'PLAYER_STAFF_FRONT',
    'PLAYER_MELEE_SLASH',
    'TOWER_RAPID_BASE',
    'TOWER_RAPID_TURRET',
    'TOWER_HEAVY_BASE',
    'TOWER_HEAVY_TURRET',
    'TOWER_SLOW_BASE',
    'TOWER_SLOW_TURRET',
    'TOWER_SNIPER_BASE',
    'TOWER_SNIPER_TURRET',
    'SITE_HOLOGRAM_CAGE',
    'ENEMY_CRAWLER_BACK',
    'ENEMY_CRAWLER_BODY',
    'ENEMY_PHANTOM_BACK',
    'ENEMY_PHANTOM_BODY',
    'ENEMY_GOLEM_BACK',
    'ENEMY_GOLEM_BODY',
    'ENEMY_TROJAN_BODY',
    'ENEMY_SIEGE_OVERLAY',
    'ENEMY_ICE_SHARD',
    'BOSS_WHEEL_BACK',
    'BOSS_WINGS_MID',
    'BOSS_LEVIATHAN_BODY',
    'BOSS_MASK_GOLD',
    'BOSS_MASK_PUNISH',
    'BOSS_SCEPTER_FRONT',
    'PROP_SPAWN_PORTAL',
    'PROP_PERIMETER_OBELISK',
    'PROP_CRYSTAL_CLUSTER',
    'PROP_RUNE_TOTEM',
    'PROP_DATA_TREE',
    'PROP_HORIZON_MONOLITH',
    'MATH_PAD_RUNE_TOP',
    'MATH_PAD_PILLAR',
    'PROJECTILE_IMPACT_SPARK',
  ]
  for (const k of allKeys) {
    getSharedSpriteTexture(k)
  }
  const flipbookKeys: SpriteEntityCategory[] = [
    'PLAYER_ARCHITECT_BODY',
    'PLAYER_ARCHITECT_BUFF',
    'ENEMY_CRAWLER_BACK',
    'ENEMY_TROJAN_BODY',
  ]
  for (const fk of flipbookKeys) {
    getSharedFlipbookTextures(fk)
  }
}

export function getAtlasCacheSize(): number {
  return textureCache.size
}

// ── Procedural Drawing Primitives ───────────────────────────────────────────────

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotOffset = -Math.PI / 2,
) {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = rotOffset + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function strokeAndFill(
  ctx: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  stroke = '#050714',
  lineWidth = 8,
  glowColor?: string,
  glowBlur = 14,
) {
  ctx.save()
  if (glowColor) {
    ctx.shadowColor = glowColor
    ctx.shadowBlur = glowBlur
  }
  ctx.fillStyle = fill
  ctx.fill()
  if (lineWidth > 0) {
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = stroke
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

// ── Master Artwork Dispatcher ───────────────────────────────────────────────────

function drawSpriteArtwork(
  ctx: CanvasRenderingContext2D,
  key: SpriteEntityCategory,
  s: number,
  frameIdx = 0,
) {
  const c = s / 2
  const strideSign = frameIdx === 1 ? -1 : frameIdx === 3 ? 1 : 0

  switch (key) {
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. ARENA FLOOR MOTHERBOARD (1024x1024 Radial Circuit Citadel)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'FLOOR_MOTHERBOARD': {
      // Base cyber-obsidian radial gradient
      const bg = ctx.createRadialGradient(c, c, s * 0.02, c, c, c)
      bg.addColorStop(0, '#0f172a')
      bg.addColorStop(0.35, '#090d1a')
      bg.addColorStop(0.75, '#070a14')
      bg.addColorStop(1, '#04060c')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, s, s)

      // Subtle hex/circuit grid sectors
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.09)'
      ctx.lineWidth = 2
      const step = s / 16
      for (let i = 0; i <= 16; i++) {
        const p = i * step
        ctx.beginPath()
        ctx.moveTo(p, 0)
        ctx.lineTo(p, s)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, p)
        ctx.lineTo(s, p)
        ctx.stroke()
      }

      // Concentric motherboard bus rings
      const radii = [0.12, 0.22, 0.32, 0.42, 0.48]
      radii.forEach((rf, idx) => {
        ctx.beginPath()
        ctx.arc(c, c, s * rf, 0, Math.PI * 2)
        ctx.strokeStyle = idx % 2 === 0 ? 'rgba(0, 212, 255, 0.22)' : 'rgba(255, 215, 0, 0.14)'
        ctx.lineWidth = idx === 2 ? 5 : 3
        ctx.stroke()
      })

      // 32 Radial circuit traces with microchip solder pads
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2
        const r1 = s * (i % 2 === 0 ? 0.08 : 0.16)
        const r2 = s * (i % 4 === 0 ? 0.48 : 0.38)
        ctx.beginPath()
        ctx.moveTo(c + Math.cos(angle) * r1, c + Math.sin(angle) * r1)
        ctx.lineTo(c + Math.cos(angle) * r2, c + Math.sin(angle) * r2)
        ctx.strokeStyle = i % 4 === 0 ? 'rgba(0, 255, 204, 0.28)' : 'rgba(0, 212, 255, 0.12)'
        ctx.lineWidth = i % 4 === 0 ? 4 : 2
        ctx.stroke()

        // Solder pad node
        const px = c + Math.cos(angle) * r2
        const py = c + Math.sin(angle) * r2
        ctx.beginPath()
        ctx.arc(px, py, i % 4 === 0 ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = i % 4 === 0 ? 'rgba(255, 215, 0, 0.45)' : 'rgba(0, 255, 204, 0.35)'
        ctx.fill()
      }

      // 4 Cardinal Math Highways (N, S, E, W) with operational runes
      const dirs = [
        { a: -Math.PI / 2, sym: '+' },
        { a: Math.PI / 2, sym: '−' },
        { a: 0, sym: '×' },
        { a: Math.PI, sym: '÷' },
      ]
      dirs.forEach(({ a, sym }) => {
        const mx = c + Math.cos(a) * (s * 0.27)
        const my = c + Math.sin(a) * (s * 0.27)
        ctx.save()
        ctx.translate(mx, my)
        drawPolygon(ctx, 0, 0, 34, 6, 0)
        ctx.fillStyle = 'rgba(0, 212, 255, 0.14)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.fillStyle = 'rgba(255, 215, 0, 0.65)'
        ctx.font = 'bold 34px Orbitron, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(sym, 0, 2)
        ctx.restore()
      })
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. CENTRAL CORE ("Cidadela de Arquimedes" — 4 Layers)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'CORE_BASE_MANDALA': {
      drawPolygon(ctx, c, c, c * 0.88, 12, 0)
      strokeAndFill(ctx, 'rgba(8, 20, 44, 0.85)', '#00ffcc', 6, '#00ffcc', 18)
      drawPolygon(ctx, c, c, c * 0.68, 8, Math.PI / 8)
      strokeAndFill(ctx, 'rgba(14, 32, 68, 0.75)', '#ffd700', 5, '#ffd700', 12)
      drawPolygon(ctx, c, c, c * 0.42, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 212, 255, 0.35)', '#00d4ff', 4)
      break
    }

    case 'CORE_ASTROLABE_BACK': {
      ctx.save()
      ctx.beginPath()
      ctx.arc(c, c, c * 0.86, 0, Math.PI * 2)
      ctx.strokeStyle = '#00ffcc'
      ctx.lineWidth = 10
      ctx.shadowColor = '#00ffcc'
      ctx.shadowBlur = 20
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(c, c, c * 0.72, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 6
      ctx.stroke()

      const glyphs = ['π', '∑', 'Δ', 'Ω', '∞', '√', '∫', 'λ']
      glyphs.forEach((g, i) => {
        const a = (i / glyphs.length) * Math.PI * 2
        const gx = c + Math.cos(a) * (c * 0.79)
        const gy = c + Math.sin(a) * (c * 0.79)
        ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#00ffcc'
        ctx.font = 'bold 28px Courier New, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(g, gx, gy)
      })
      ctx.restore()
      break
    }

    case 'CORE_CITADEL_BODY':
    case 'CORE_CITADEL_BUFF': {
      const isBuff = key === 'CORE_CITADEL_BUFF'
      const primary = isBuff ? '#ffd700' : '#00d4ff'
      const secondary = isBuff ? '#00ff88' : '#00ffcc'
      const darkArmor = isBuff ? '#2a1f04' : '#0b192e'

      // Outer floating crystal monolith wings
      ctx.beginPath()
      ctx.moveTo(c, s * 0.08)
      ctx.lineTo(s * 0.82, s * 0.38)
      ctx.lineTo(s * 0.72, s * 0.88)
      ctx.lineTo(s * 0.28, s * 0.88)
      ctx.lineTo(s * 0.18, s * 0.38)
      ctx.closePath()
      const bodyGrad = ctx.createLinearGradient(c, s * 0.08, c, s * 0.88)
      bodyGrad.addColorStop(0, primary)
      bodyGrad.addColorStop(0.45, darkArmor)
      bodyGrad.addColorStop(1, '#050814')
      strokeAndFill(ctx, bodyGrad, '#040711', 10, primary, 22)

      // Inner crystal facet
      ctx.beginPath()
      ctx.moveTo(c, s * 0.16)
      ctx.lineTo(s * 0.68, s * 0.42)
      ctx.lineTo(c, s * 0.80)
      ctx.lineTo(s * 0.32, s * 0.42)
      ctx.closePath()
      strokeAndFill(ctx, isBuff ? 'rgba(255,215,0,0.35)' : 'rgba(0,212,255,0.28)', secondary, 5)

      // Archimedes Cyber Eye in center
      ctx.beginPath()
      ctx.arc(c, s * 0.44, s * 0.13, 0, Math.PI * 2)
      strokeAndFill(ctx, '#040814', primary, 6, primary, 18)

      ctx.beginPath()
      ctx.arc(c, s * 0.44, s * 0.07, 0, Math.PI * 2)
      strokeAndFill(ctx, isBuff ? '#ffffff' : secondary, primary, 3, secondary, 15)
      break
    }

    case 'CORE_SHIELD_FRONT': {
      drawPolygon(ctx, c, c * 1.05, c * 0.48, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 255, 204, 0.18)', '#00ffcc', 6, '#00ffcc', 15)
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PLAYER AVATAR ("O Arquiteto Lógico" — 4 Layers)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'PLAYER_MANTLE_BACK': {
      // Cyber-mage flowing energy cape
      ctx.beginPath()
      ctx.moveTo(c, s * 0.25)
      ctx.lineTo(s * 0.78, s * 0.45)
      ctx.lineTo(s * 0.84, s * 0.88)
      ctx.lineTo(s * 0.62, s * 0.80)
      ctx.lineTo(c, s * 0.92)
      ctx.lineTo(s * 0.38, s * 0.80)
      ctx.lineTo(s * 0.16, s * 0.88)
      ctx.lineTo(s * 0.22, s * 0.45)
      ctx.closePath()
      const capeGrad = ctx.createLinearGradient(c, s * 0.25, c, s * 0.92)
      capeGrad.addColorStop(0, '#0f2942')
      capeGrad.addColorStop(0.7, '#09192b')
      capeGrad.addColorStop(1, '#00ffcc')
      strokeAndFill(ctx, capeGrad, '#030712', 8, '#00d4ff', 14)
      break
    }

    case 'PLAYER_DIVINE_WINGS': {
      // 6-wing Archimedes Seraphic Golden Light Wings
      for (let side = -1; side <= 1; side += 2) {
        for (let tier = 0; tier < 3; tier++) {
          ctx.beginPath()
          const yBase = s * (0.34 + tier * 0.12)
          const span = s * (0.44 - tier * 0.06)
          ctx.moveTo(c, yBase)
          ctx.quadraticCurveTo(
            c + side * span * 0.7,
            yBase - s * 0.16,
            c + side * span,
            yBase - s * 0.04,
          )
          ctx.quadraticCurveTo(
            c + side * span * 0.65,
            yBase + s * 0.08,
            c,
            yBase + s * 0.06,
          )
          ctx.closePath()
          strokeAndFill(ctx, 'rgba(255, 215, 0, 0.85)', '#fff7cc', 4, '#ffd700', 20)
        }
      }
      break
    }

    case 'PLAYER_ARCHITECT_BODY':
    case 'PLAYER_ARCHITECT_BUFF': {
      const buffed = key === 'PLAYER_ARCHITECT_BUFF'
      const neon = buffed ? '#ffd700' : '#00ffcc'
      const armor = buffed ? '#3b2806' : '#112238'
      const leftFootLift = strideSign < 0 ? -s * 0.045 : strideSign > 0 ? s * 0.025 : 0
      const rightFootLift = strideSign > 0 ? -s * 0.045 : strideSign < 0 ? s * 0.025 : 0

      // Armored torso & greaves (with 4-frame walk-cycle foot stride)
      ctx.beginPath()
      ctx.moveTo(s * 0.34, s * 0.44)
      ctx.lineTo(s * 0.66, s * 0.44)
      ctx.lineTo(s * 0.72 + strideSign * s * 0.02, s * 0.86 + rightFootLift)
      ctx.lineTo(s * 0.56 + strideSign * s * 0.015, s * 0.86 + rightFootLift)
      ctx.lineTo(c, s * 0.72)
      ctx.lineTo(s * 0.44 - strideSign * s * 0.015, s * 0.86 + leftFootLift)
      ctx.lineTo(s * 0.28 - strideSign * s * 0.02, s * 0.86 + leftFootLift)
      ctx.closePath()
      strokeAndFill(ctx, armor, '#040711', 9, neon, 14)

      // Shoulder pauldrons
      drawPolygon(ctx, s * 0.29, s * 0.46 + strideSign * s * 0.012, s * 0.09, 6)
      strokeAndFill(ctx, neon, '#040711', 6)
      drawPolygon(ctx, s * 0.71, s * 0.46 - strideSign * s * 0.012, s * 0.09, 6)
      strokeAndFill(ctx, neon, '#040711', 6)

      // Cyber Hood & Helmet
      ctx.beginPath()
      ctx.moveTo(c, s * 0.12)
      ctx.lineTo(s * 0.67, s * 0.28)
      ctx.lineTo(s * 0.62, s * 0.46)
      ctx.lineTo(s * 0.38, s * 0.46)
      ctx.lineTo(s * 0.33, s * 0.28)
      ctx.closePath()
      strokeAndFill(ctx, armor, '#040711', 9, neon, 16)

      // Dark face void
      ctx.beginPath()
      ctx.arc(c, s * 0.33, s * 0.10, 0, Math.PI * 2)
      strokeAndFill(ctx, '#03050a', neon, 4)

      // Glowing Cyber Eyes (Visor)
      ctx.fillStyle = buffed ? '#ffffff' : '#00ffcc'
      ctx.shadowColor = neon
      ctx.shadowBlur = 14
      ctx.fillRect(c - s * 0.065, s * 0.31, s * 0.045, s * 0.025)
      ctx.fillRect(c + s * 0.020, s * 0.31, s * 0.045, s * 0.025)
      ctx.shadowBlur = 0

      // Chest Sigma Emblem
      ctx.fillStyle = neon
      ctx.font = 'bold 46px Orbitron, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('∑', c, s * 0.58)
      break
    }

    case 'PLAYER_STAFF_FRONT': {
      // Axiom Staff on right side + floating logic orb on left
      ctx.save()
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(s * 0.74, s * 0.22)
      ctx.lineTo(s * 0.74, s * 0.86)
      ctx.stroke()

      // Staff head Merkaba star
      drawPolygon(ctx, s * 0.74, s * 0.20, s * 0.09, 4, 0)
      strokeAndFill(ctx, '#00ffcc', '#040711', 5, '#00ffcc', 18)
      drawPolygon(ctx, s * 0.74, s * 0.20, s * 0.09, 4, Math.PI / 4)
      strokeAndFill(ctx, 'rgba(255,215,0,0.85)', '#040711', 4)

      // Left hand floating Codex Orb
      ctx.beginPath()
      ctx.arc(s * 0.24, s * 0.52, s * 0.065, 0, Math.PI * 2)
      strokeAndFill(ctx, '#00d4ff', '#ffffff', 4, '#00d4ff', 16)
      ctx.restore()
      break
    }

    case 'PLAYER_MELEE_SLASH': {
      // Crescent blade arc
      ctx.beginPath()
      ctx.arc(c, c, s * 0.42, -Math.PI * 0.75, -Math.PI * 0.25, false)
      ctx.arc(c, c + s * 0.08, s * 0.36, -Math.PI * 0.25, -Math.PI * 0.75, true)
      ctx.closePath()
      strokeAndFill(ctx, '#00ffcc', '#ffffff', 6, '#00ffcc', 24)
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. THE 4 TOWERS (Distinct Silhouettes: Base + Directional Turret)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'TOWER_RAPID_BASE': {
      // Tesla Coil Pylon with 3 stacked cyan capacitor rings
      ctx.beginPath()
      ctx.moveTo(s * 0.26, s * 0.90)
      ctx.lineTo(s * 0.74, s * 0.90)
      ctx.lineTo(s * 0.62, s * 0.28)
      ctx.lineTo(s * 0.38, s * 0.28)
      ctx.closePath()
      strokeAndFill(ctx, '#13243b', '#040711', 10, '#00ffff', 12)

      // 3 Capacitor rings
      ;[0.74, 0.56, 0.38].forEach((y) => {
        ctx.beginPath()
        ctx.roundRect(s * 0.22, s * y, s * 0.56, s * 0.08, 12)
        strokeAndFill(ctx, '#00ffff', '#040711', 6, '#00ffff', 16)
      })
      break
    }

    case 'TOWER_RAPID_TURRET': {
      // Twin-prong Tachyon Lightning Emitter
      ctx.beginPath()
      ctx.moveTo(s * 0.34, s * 0.68)
      ctx.lineTo(s * 0.34, s * 0.16)
      ctx.lineTo(s * 0.44, s * 0.32)
      ctx.lineTo(s * 0.56, s * 0.32)
      ctx.lineTo(s * 0.66, s * 0.16)
      ctx.lineTo(s * 0.66, s * 0.68)
      ctx.closePath()
      strokeAndFill(ctx, '#16324f', '#040711', 8, '#00ffff', 18)

      ctx.beginPath()
      ctx.arc(c, s * 0.38, s * 0.14, 0, Math.PI * 2)
      strokeAndFill(ctx, '#00ffff', '#ffffff', 5, '#00ffff', 22)
      break
    }

    case 'TOWER_HEAVY_BASE': {
      // Heavy Obsidian Mortar Bunker
      ctx.beginPath()
      ctx.moveTo(s * 0.16, s * 0.92)
      ctx.lineTo(s * 0.84, s * 0.92)
      ctx.lineTo(s * 0.76, s * 0.36)
      ctx.lineTo(s * 0.24, s * 0.36)
      ctx.closePath()
      strokeAndFill(ctx, '#261433', '#040711', 10, '#ff00ff', 14)

      // Antimatter core vents
      ctx.fillStyle = '#ff00ff'
      ctx.fillRect(s * 0.32, s * 0.52, s * 0.36, s * 0.12)
      ctx.fillRect(s * 0.28, s * 0.72, s * 0.44, s * 0.10)
      break
    }

    case 'TOWER_HEAVY_TURRET': {
      // Twin-Barrel Siege Mortar Cannon
      ctx.beginPath()
      ctx.roundRect(s * 0.26, s * 0.14, s * 0.20, s * 0.56, 10)
      ctx.roundRect(s * 0.54, s * 0.14, s * 0.20, s * 0.56, 10)
      strokeAndFill(ctx, '#3b174d', '#040711', 8, '#ff00ff', 16)

      drawPolygon(ctx, c, s * 0.56, s * 0.24, 8)
      strokeAndFill(ctx, '#a855f7', '#040711', 8, '#ff00ff', 20)
      break
    }

    case 'TOWER_SLOW_BASE': {
      // Glacial Cryo-Obelisk with Ice Spikes
      ctx.beginPath()
      ctx.moveTo(c, s * 0.20)
      ctx.lineTo(s * 0.74, s * 0.88)
      ctx.lineTo(s * 0.26, s * 0.88)
      ctx.closePath()
      strokeAndFill(ctx, '#0c3547', '#040711', 9, '#00ddff', 16)

      // Left & right ice crystals
      ctx.beginPath()
      ctx.moveTo(s * 0.16, s * 0.48)
      ctx.lineTo(s * 0.34, s * 0.88)
      ctx.lineTo(s * 0.14, s * 0.88)
      ctx.closePath()
      strokeAndFill(ctx, '#00ddff', '#040711', 6)

      ctx.beginPath()
      ctx.moveTo(s * 0.84, s * 0.48)
      ctx.lineTo(s * 0.86, s * 0.88)
      ctx.lineTo(s * 0.66, s * 0.88)
      ctx.closePath()
      strokeAndFill(ctx, '#00ddff', '#040711', 6)
      break
    }

    case 'TOWER_SLOW_TURRET': {
      // Zero-Kelvin Cryo Snowflake Star
      drawPolygon(ctx, c, c, s * 0.34, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 221, 255, 0.85)', '#ffffff', 6, '#00ddff', 22)
      drawPolygon(ctx, c, c, s * 0.34, 6, Math.PI / 6)
      strokeAndFill(ctx, 'rgba(180, 248, 255, 0.75)', '#040711', 5)
      break
    }

    case 'TOWER_SNIPER_BASE': {
      // Tall Tripod Railgun Spire
      ctx.beginPath()
      ctx.moveTo(c, s * 0.14)
      ctx.lineTo(s * 0.68, s * 0.90)
      ctx.lineTo(s * 0.54, s * 0.90)
      ctx.lineTo(c, s * 0.42)
      ctx.lineTo(s * 0.46, s * 0.90)
      ctx.lineTo(s * 0.32, s * 0.90)
      ctx.closePath()
      strokeAndFill(ctx, '#331014', '#040711', 8, '#ff2200', 16)
      break
    }

    case 'TOWER_SNIPER_TURRET': {
      // Long Electromagnetic Railgun Barrel + Horus Laser Eye
      ctx.beginPath()
      ctx.rect(s * 0.41, s * 0.04, s * 0.06, s * 0.66)
      ctx.rect(s * 0.53, s * 0.04, s * 0.06, s * 0.66)
      strokeAndFill(ctx, '#ff2200', '#040711', 6, '#ff2200', 18)

      drawPolygon(ctx, c, s * 0.62, s * 0.22, 6)
      strokeAndFill(ctx, '#290a0e', '#ff2200', 7)
      ctx.beginPath()
      ctx.arc(c, s * 0.62, s * 0.09, 0, Math.PI * 2)
      strokeAndFill(ctx, '#ffdd00', '#ff2200', 4, '#ff2200', 16)
      break
    }

    case 'SITE_HOLOGRAM_CAGE': {
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 8
      ctx.setLineDash([22, 14])
      ctx.strokeRect(s * 0.14, s * 0.14, s * 0.72, s * 0.72)
      ctx.setLineDash([])
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. ENEMIES (3 Virus Castes + Trojan + Siege + Ice + 5-Layer Boss)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'ENEMY_CRAWLER_BACK': {
      // 6 Mechanical Spider Legs (with 4-frame alternating scuttle cycle)
      ctx.strokeStyle = '#ff0055'
      ctx.lineWidth = 12
      ctx.lineCap = 'round'
      ;[-0.22, 0, 0.22].forEach((yo, legIdx) => {
        const legPhase = (legIdx % 2 === 0 ? 1 : -1) * strideSign * 0.045
        ctx.beginPath()
        ctx.moveTo(s * 0.10, c + s * (yo + 0.12 + legPhase))
        ctx.lineTo(s * 0.30, c + s * (yo - 0.04 - legPhase * 0.5))
        ctx.lineTo(c, c + s * yo)
        ctx.lineTo(s * 0.70, c + s * (yo - 0.04 + legPhase * 0.5))
        ctx.lineTo(s * 0.90, c + s * (yo + 0.12 - legPhase))
        ctx.stroke()
      })
      break
    }

    case 'ENEMY_CRAWLER_BODY': {
      // Arachnid Virus Carapace + 3 Optic Eyes
      drawPolygon(ctx, c, c, s * 0.28, 6, 0)
      strokeAndFill(ctx, '#2e0618', '#ff0055', 8, '#ff0055', 16)
      ;[-0.09, 0, 0.09].forEach((xo, idx) => {
        ctx.beginPath()
        ctx.arc(c + s * xo, c - s * 0.04, idx === 1 ? s * 0.05 : s * 0.035, 0, Math.PI * 2)
        strokeAndFill(ctx, '#00ffcc', '#ffffff', 2, '#00ffcc', 10)
      })
      break
    }

    case 'ENEMY_PHANTOM_BACK': {
      // Glitch Wraith Aura
      drawPolygon(ctx, c, c, s * 0.38, 8, Math.PI / 8)
      strokeAndFill(ctx, 'rgba(255, 0, 85, 0.32)', '#ff3377', 5, '#ff0055', 18)
      break
    }

    case 'ENEMY_PHANTOM_BODY': {
      // Hooded NaN Specter with digital skull mask
      ctx.beginPath()
      ctx.moveTo(c, s * 0.14)
      ctx.lineTo(s * 0.76, s * 0.46)
      ctx.lineTo(s * 0.68, s * 0.86)
      ctx.lineTo(c, s * 0.72)
      ctx.lineTo(s * 0.32, s * 0.86)
      ctx.lineTo(s * 0.24, s * 0.46)
      ctx.closePath()
      strokeAndFill(ctx, '#380820', '#ff0055', 8, '#ff0055', 16)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 52px Courier New, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('NaN', c, c)
      break
    }

    case 'ENEMY_GOLEM_BACK': {
      drawPolygon(ctx, c, c, s * 0.40, 4, Math.PI / 4)
      strokeAndFill(ctx, '#4a081e', '#ff0055', 8)
      break
    }

    case 'ENEMY_GOLEM_BODY': {
      // Heavy Firewall Brute
      drawPolygon(ctx, c, c, s * 0.34, 8, 0)
      strokeAndFill(ctx, '#290512', '#ff2266', 10, '#ff0055', 16)
      ctx.fillStyle = '#ff0055'
      ctx.fillRect(s * 0.34, s * 0.38, s * 0.32, s * 0.08)
      break
    }

    case 'ENEMY_TROJAN_BODY': {
      // Cyber Trojan Stallion Head / Missile
      ctx.beginPath()
      ctx.moveTo(c, s * 0.14)
      ctx.lineTo(s * 0.76, s * 0.38)
      ctx.lineTo(s * 0.66, s * 0.84)
      ctx.lineTo(s * 0.34, s * 0.84)
      ctx.lineTo(s * 0.24, s * 0.38)
      ctx.closePath()
      strokeAndFill(ctx, '#421606', '#ffaa00', 8, '#ff5500', 16)
      ctx.beginPath()
      ctx.arc(c, s * 0.44, s * 0.08, 0, Math.PI * 2)
      strokeAndFill(ctx, '#ffdd00', '#ff2200', 4)
      break
    }

    case 'ENEMY_SIEGE_OVERLAY': {
      // Red Targeting Crosshair for Siege Mode
      ctx.strokeStyle = '#ff2200'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(c, c, s * 0.38, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(c - s * 0.45, c)
      ctx.lineTo(c + s * 0.45, c)
      ctx.moveTo(c, c - s * 0.45)
      ctx.lineTo(c, c + s * 0.45)
      ctx.stroke()
      break
    }

    case 'ENEMY_ICE_SHARD': {
      drawPolygon(ctx, c, s * 0.68, s * 0.28, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 221, 255, 0.65)', '#ffffff', 5, '#00ddff', 14)
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. BOSS ("Leviatã do Pedágio" — 5 Layers)
    // ═══════════════════════════════════════════════════════════════════════════
    case 'BOSS_WHEEL_BACK': {
      ctx.beginPath()
      ctx.arc(c, c, s * 0.44, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffaa00'
      ctx.lineWidth = 14
      ctx.shadowColor = '#ff8800'
      ctx.shadowBlur = 22
      ctx.stroke()

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(c + Math.cos(a) * s * 0.44, c + Math.sin(a) * s * 0.44)
        ctx.stroke()
      }
      break
    }

    case 'BOSS_WINGS_MID': {
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath()
        ctx.moveTo(c, c)
        ctx.lineTo(c + side * s * 0.46, s * 0.18)
        ctx.lineTo(c + side * s * 0.42, s * 0.76)
        ctx.closePath()
        strokeAndFill(ctx, '#3d1904', '#ffaa00', 8, '#ff8800', 16)
      }
      break
    }

    case 'BOSS_LEVIATHAN_BODY': {
      drawPolygon(ctx, c, c, s * 0.34, 8, 0)
      strokeAndFill(ctx, '#260d04', '#ffaa00', 10, '#ff8800', 20)
      break
    }

    case 'BOSS_MASK_GOLD':
    case 'BOSS_MASK_PUNISH': {
      const punish = key === 'BOSS_MASK_PUNISH'
      const col = punish ? '#ff1133' : '#ffd700'
      drawPolygon(ctx, c, c, s * 0.24, 6, 0)
      strokeAndFill(ctx, punish ? '#3b040e' : '#422c04', col, 8, col, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 64px Orbitron, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(punish ? '💀' : '👑', c, c)
      break
    }

    case 'BOSS_SCEPTER_FRONT': {
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 54px Orbitron, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⚖️', s * 0.76, s * 0.52)
      break
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. SCENERY PROPS & MATH ALTAR
    // ═══════════════════════════════════════════════════════════════════════════
    case 'PROP_SPAWN_PORTAL': {
      // Glitch Rift Gate
      ctx.beginPath()
      ctx.arc(c, c, s * 0.40, 0, Math.PI * 2)
      strokeAndFill(ctx, 'rgba(168, 85, 247, 0.28)', '#ff0055', 10, '#a855f7', 24)
      drawPolygon(ctx, c, c, s * 0.28, 6, 0)
      strokeAndFill(ctx, 'rgba(255, 0, 85, 0.42)', '#00ffcc', 5)
      break
    }

    case 'PROP_PERIMETER_OBELISK': {
      ctx.beginPath()
      ctx.moveTo(c, s * 0.06)
      ctx.lineTo(s * 0.66, s * 0.92)
      ctx.lineTo(s * 0.34, s * 0.92)
      ctx.closePath()
      strokeAndFill(ctx, '#0d1b2a', '#00ffcc', 8, '#00ffcc', 16)
      break
    }

    case 'PROP_CRYSTAL_CLUSTER': {
      ctx.beginPath()
      ctx.moveTo(c, s * 0.18)
      ctx.lineTo(s * 0.68, s * 0.88)
      ctx.lineTo(s * 0.32, s * 0.88)
      ctx.closePath()
      strokeAndFill(ctx, 'rgba(0, 255, 204, 0.75)', '#ffffff', 5, '#00ffcc', 16)
      break
    }

    case 'PROP_RUNE_TOTEM': {
      drawPolygon(ctx, c, c, s * 0.30, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 212, 255, 0.25)', '#00d4ff', 6, '#00d4ff', 14)
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 72px Orbitron, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('π', c, c)
      break
    }

    case 'PROP_DATA_TREE': {
      // Cyber circuit antenna tree
      ctx.strokeStyle = '#00ffcc'
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.moveTo(c, s * 0.90)
      ctx.lineTo(c, s * 0.30)
      ctx.moveTo(c, s * 0.58)
      ctx.lineTo(s * 0.26, s * 0.34)
      ctx.moveTo(c, s * 0.48)
      ctx.lineTo(s * 0.74, s * 0.26)
      ctx.stroke()
      ;[
        [c, s * 0.24],
        [s * 0.24, s * 0.30],
        [s * 0.76, s * 0.22],
      ].forEach(([nx, ny]) => {
        ctx.beginPath()
        ctx.arc(nx, ny, s * 0.07, 0, Math.PI * 2)
        strokeAndFill(ctx, '#00d4ff', '#ffffff', 4, '#00ffcc', 14)
      })
      break
    }

    case 'PROP_HORIZON_MONOLITH': {
      ctx.beginPath()
      ctx.moveTo(s * 0.28, s * 0.95)
      ctx.lineTo(s * 0.36, s * 0.12)
      ctx.lineTo(c, s * 0.04)
      ctx.lineTo(s * 0.64, s * 0.12)
      ctx.lineTo(s * 0.72, s * 0.95)
      ctx.closePath()
      strokeAndFill(ctx, '#070d1c', '#00d4ff', 6, '#00d4ff', 12)
      break
    }

    case 'MATH_PAD_RUNE_TOP': {
      drawPolygon(ctx, c, c, s * 0.44, 8, 0)
      strokeAndFill(ctx, 'rgba(26, 26, 58, 0.85)', '#ffd700', 8, '#ffd700', 16)
      drawPolygon(ctx, c, c, s * 0.30, 6, 0)
      strokeAndFill(ctx, 'rgba(0, 212, 255, 0.22)', '#00d4ff', 4)
      break
    }

    case 'MATH_PAD_PILLAR': {
      const grad = ctx.createLinearGradient(c, s * 0.95, c, s * 0.05)
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.65)')
      grad.addColorStop(1, 'rgba(0, 212, 255, 0.0)')
      ctx.fillStyle = grad
      ctx.fillRect(s * 0.35, s * 0.05, s * 0.30, s * 0.90)
      break
    }

    case 'PROJECTILE_IMPACT_SPARK': {
      // Crisp 4-pointed geometric crystal shard star for 2.5D EnemyDeathFX shatter pool
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4
        const rad = i % 2 === 0 ? s * 0.44 : s * 0.14
        const px = c + Math.cos(ang) * rad
        const py = c + Math.sin(ang) * rad
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      strokeAndFill(ctx, '#ffffff', '#ffffff', 4, '#ffffff', 14)
      break
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/renderer/engineSpriteFactory.ts
// MASTER_PLAN_V5: Fábrica de Sprites 2.5D Offscreen para todas as 6 Engines
// Pré-renderiza e mantém em cache (O(1) por frame) edifícios 2.5D (Quartéis,
// Fábricas de Tanques, Torres de Besteiros, Britador, Castelo), unidades 2.5D
// (Herói Coroado, Soldados Aliados, Tanques Aliados, Operários, Inimigos),
// Bosses 2.5D, Segmentos 3D Escamados da Serpente e Props Isométricos.
// ──────────────────────────────────────────────────────────────────────────────

export type BuildingSpriteKind =
  | 'archer_tower'
  | 'barracks'
  | 'tank_factory'
  | 'turret'
  | 'quarry_crusher'
  | 'ingot_pallet'
  | 'castle_keep'

export type UnitSpriteKind =
  | 'crowned_hero'
  | 'allied_soldier'
  | 'allied_tank'
  | 'allied_archer'
  | 'allied_mecha'
  | 'worker_small'
  | 'worker_medium'
  | 'worker_titan'
  | 'enemy_goblin'
  | 'enemy_rifleman'
  | 'enemy_tank'
  | 'enemy_zombie'

export type BossSpriteKind =
  | 'siege_giant'
  | 'fort_tank_boss'
  | 'quarry_golem_boss'
  | 'arena_minotaur_boss'

export type PropSpriteKind =
  | 'wood_palisade'
  | 'sandbag_wall'
  | 'gold_coin'
  | 'gold_ingot'
  | 'granite_block'
  | 'tnt_barrel'
  | 'purple_pedestal'

export type DragonSegmentRole = 'head' | 'body' | 'gold' | 'tail'

const spriteCache = new Map<string, HTMLCanvasElement>()

function createBuffer(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. EDIFÍCIOS 2.5D (Torres, Quartéis, Fábrica de Tanque, Britador, Castelo)
// ──────────────────────────────────────────────────────────────────────────────
export function getBuildingSprite(
  kind: BuildingSpriteKind,
  tier = 1,
  frame = 0
): HTMLCanvasElement {
  const clampedTier = Math.max(1, Math.min(3, tier))
  const animBucket = Math.floor(frame) % 4
  const key = `bldg:${kind}:t${clampedTier}:f${animBucket}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const [c, ctx] = createBuffer(128, 128)
  const cx = 64
  const cy = 78

  // Sombra projetada 2.5D no solo
  ctx.fillStyle = 'rgba(2, 6, 23, 0.48)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 28, 44, 18, 0, 0, Math.PI * 2)
  ctx.fill()

  if (kind === 'archer_tower') {
    // Base / Pilares 2.5D (Tier 1: Madeira; Tier 2: Pedra Real; Tier 3: Bastião Dourado/Morteiro)
    const isStone = clampedTier >= 2
    const isGold = clampedTier >= 3

    // Corpo da torre com gradiente cilíndrico/isométrico
    const bodyGrad = ctx.createLinearGradient(cx - 30, cy - 30, cx + 30, cy + 24)
    if (isGold) {
      bodyGrad.addColorStop(0, '#475569')
      bodyGrad.addColorStop(0.5, '#334155')
      bodyGrad.addColorStop(1, '#0f172a')
    } else if (isStone) {
      bodyGrad.addColorStop(0, '#94a3b8')
      bodyGrad.addColorStop(0.5, '#64748b')
      bodyGrad.addColorStop(1, '#334155')
    } else {
      bodyGrad.addColorStop(0, '#b45309')
      bodyGrad.addColorStop(0.5, '#92400e')
      bodyGrad.addColorStop(1, '#451a03')
    }

    // Pilares / Muralha da torre
    ctx.fillStyle = bodyGrad
    ctx.strokeStyle = isGold ? '#facc15' : isStone ? '#cbd5e1' : '#78350f'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.roundRect(cx - 28, cy - 26, 56, 52, 8)
    ctx.fill()
    ctx.stroke()

    // Vigas cruzadas de madeira (Tier 1) ou blocos de cantaria (Tier 2+)
    if (!isStone) {
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx - 24, cy - 18)
      ctx.lineTo(cx + 24, cy + 20)
      ctx.moveTo(cx + 24, cy - 18)
      ctx.lineTo(cx - 24, cy + 20)
      ctx.stroke()
    } else {
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)'
      ctx.lineWidth = 1.5
      for (let row = -14; row <= 16; row += 10) {
        ctx.beginPath()
        ctx.moveTo(cx - 26, cy + row)
        ctx.lineTo(cx + 26, cy + row)
        ctx.stroke()
      }
    }

    // Plataforma superior 2.5D com ameias
    ctx.fillStyle = isGold ? '#1e293b' : isStone ? '#475569' : '#78350f'
    ctx.strokeStyle = isGold ? '#facc15' : '#e2e8f0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 34, cy - 38, 68, 18, 6)
    ctx.fill()
    ctx.stroke()

    // Ameias frontais
    for (let bx = -30; bx <= 20; bx += 16) {
      ctx.fillStyle = isGold ? '#facc15' : isStone ? '#94a3b8' : '#b45309'
      ctx.fillRect(cx + bx, cy - 44, 10, 8)
    }

    // Estandarte Azul Real na frente da torre
    ctx.fillStyle = '#0284c7'
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - 10, cy - 16)
    ctx.lineTo(cx + 10, cy - 16)
    ctx.lineTo(cx + 10, cy + 8)
    ctx.lineTo(cx, cy + 16)
    ctx.lineTo(cx - 10, cy + 8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 3 Besteiros Azuis no topo da Torre (como nas screenshots do Kingshot!)
    const archerOffsets = [-18, 0, 18]
    const bob = animBucket % 2 === 0 ? -1.5 : 1
    for (const ox of archerOffsets) {
      const ax = cx + ox
      const ay = cy - 44 + bob
      // Corpo azul
      ctx.fillStyle = '#0ea5e9'
      ctx.beginPath()
      ctx.roundRect(ax - 6, ay - 6, 12, 12, 4)
      ctx.fill()
      // Elmo prateado/azul
      ctx.fillStyle = '#38bdf8'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(ax, ay - 11, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Besta / Canhão apontado para a direita
      ctx.strokeStyle = isGold ? '#facc15' : '#fde047'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(ax + 3, ay - 3)
      ctx.lineTo(ax + 12, ay - 5)
      ctx.stroke()
    }
  } else if (kind === 'barracks') {
    // QUARTEL MILITAR 2.5D (Tenda/Quartel que treina tropas — estilo Top Force!)
    const roofGrad = ctx.createLinearGradient(cx - 38, cy - 36, cx + 38, cy + 20)
    if (clampedTier === 1) {
      roofGrad.addColorStop(0, '#0284c7')
      roofGrad.addColorStop(0.5, '#0369a1')
      roofGrad.addColorStop(1, '#1e3a8a')
    } else if (clampedTier === 2) {
      roofGrad.addColorStop(0, '#2563eb')
      roofGrad.addColorStop(0.5, '#1d4ed8')
      roofGrad.addColorStop(1, '#172554')
    } else {
      roofGrad.addColorStop(0, '#0ea5e9')
      roofGrad.addColorStop(0.5, '#4338ca')
      roofGrad.addColorStop(1, '#1e1b4b')
    }

    // Paredes laterais do quartel
    ctx.fillStyle = '#1e293b'
    ctx.strokeStyle = clampedTier >= 2 ? '#facc15' : '#38bdf8'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.roundRect(cx - 36, cy - 16, 72, 42, 8)
    ctx.fill()
    ctx.stroke()

    // Telhado em cumeeira 2.5D
    ctx.fillStyle = roofGrad
    ctx.beginPath()
    ctx.moveTo(cx - 42, cy - 12)
    ctx.lineTo(cx, cy - 42)
    ctx.lineTo(cx + 42, cy - 12)
    ctx.lineTo(cx + 36, cy - 4)
    ctx.lineTo(cx - 36, cy - 4)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Portão iluminado de saída de soldados
    const doorGlow = ctx.createLinearGradient(cx, cy - 4, cx, cy + 26)
    doorGlow.addColorStop(0, '#38bdf8')
    doorGlow.addColorStop(1, '#020617')
    ctx.fillStyle = doorGlow
    ctx.beginPath()
    ctx.roundRect(cx - 14, cy - 2, 28, 28, [10, 10, 0, 0])
    ctx.fill()

    // Sacos de areia frontais
    ctx.fillStyle = '#d6d3d1'
    ctx.strokeStyle = '#57534e'
    ctx.lineWidth = 1.2
    for (const sx of [-28, -18, 18, 28]) {
      ctx.beginPath()
      ctx.roundRect(cx + sx - 6, cy + 20, 12, 7, 3)
      ctx.fill()
      ctx.stroke()
    }

    // Bandeira de comando no topo do Quartel
    const wave = animBucket % 2 === 0 ? 3 : -2
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cy - 42)
    ctx.lineTo(cx, cy - 62)
    ctx.stroke()

    ctx.fillStyle = clampedTier >= 2 ? '#facc15' : '#38bdf8'
    ctx.beginPath()
    ctx.moveTo(cx, cy - 62)
    ctx.lineTo(cx + 20, cy - 56 + wave)
    ctx.lineTo(cx, cy - 49)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'tank_factory') {
    // FÁBRICA DE BLINDADOS / TANQUES 2.5D
    const hullGrad = ctx.createLinearGradient(cx - 40, cy - 34, cx + 40, cy + 26)
    hullGrad.addColorStop(0, '#334155')
    hullGrad.addColorStop(0.5, '#1e293b')
    hullGrad.addColorStop(1, '#090d16')

    ctx.fillStyle = hullGrad
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.roundRect(cx - 40, cy - 28, 80, 54, 10)
    ctx.fill()
    ctx.stroke()

    // Teto industrial arqueado
    ctx.fillStyle = '#475569'
    ctx.beginPath()
    ctx.ellipse(cx, cy - 28, 40, 14, 0, Math.PI, 0)
    ctx.fill()
    ctx.stroke()

    // Chaminé soltando fumaça
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(cx - 32, cy - 52, 10, 22)
    ctx.fillStyle = 'rgba(203, 213, 225, 0.55)'
    ctx.beginPath()
    ctx.arc(cx - 27, cy - 58 - (animBucket % 3) * 3, 7, 0, Math.PI * 2)
    ctx.fill()

    // Portão de hangar com faixas de alerta amarelas/pretas
    ctx.fillStyle = '#020617'
    ctx.fillRect(cx - 22, cy - 8, 44, 34)
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.strokeRect(cx - 22, cy - 8, 44, 34)

    // Silhueta de canhão de tanque saindo do hangar
    ctx.fillStyle = '#0ea5e9'
    ctx.beginPath()
    ctx.roundRect(cx - 14, cy + 4, 28, 16, 4)
    ctx.fill()
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(cx - 3, cy - 4, 6, 16)
  } else if (kind === 'turret') {
    // TORRETA DUPLA DE SACOS DE AREIA 2.5D
    ctx.fillStyle = '#a8a29e'
    ctx.strokeStyle = '#44403c'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(cx, cy + 10, 30, 14, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Base giratória blindada
    ctx.fillStyle = '#0284c7'
    ctx.strokeStyle = '#bae6fd'
    ctx.beginPath()
    ctx.arc(cx, cy - 2, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Canos duplos de metralhadora pesada
    const recoil = animBucket % 2 === 0 ? 0 : -3
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(cx + 8 + recoil, cy - 10, 24, 5)
    ctx.fillRect(cx + 8 + recoil, cy - 1, 24, 5)
    // Chama de disparo
    if (animBucket % 2 === 0) {
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.arc(cx + 35, cy - 4, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'quarry_crusher') {
    // BRITADOR INDUSTRIAL 2.5D (Pedreira do Rei — ÷10)
    ctx.fillStyle = '#334155'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2.8
    ctx.beginPath()
    ctx.roundRect(cx - 38, cy - 26, 76, 52, 8)
    ctx.fill()
    ctx.stroke()

    // Funil superior de rochas
    ctx.fillStyle = '#475569'
    ctx.beginPath()
    ctx.moveTo(cx - 30, cy - 26)
    ctx.lineTo(cx - 42, cy - 46)
    ctx.lineTo(cx + 42, cy - 46)
    ctx.lineTo(cx + 30, cy - 26)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Rolos trituradores dentados
    ctx.fillStyle = '#94a3b8'
    ctx.beginPath()
    ctx.arc(cx - 12, cy - 8, 11, 0, Math.PI * 2)
    ctx.arc(cx + 12, cy - 8, 11, 0, Math.PI * 2)
    ctx.fill()

    // Fornalha dourada na base
    ctx.fillStyle = '#f59e0b'
    ctx.fillRect(cx - 22, cy + 8, 44, 12)
  } else if (kind === 'ingot_pallet') {
    // PALLET DE LINGOTES DE OURO 2.5D
    ctx.fillStyle = '#78350f'
    ctx.strokeStyle = '#451a03'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 36, cy + 6, 72, 18, 4)
    ctx.fill()
    ctx.stroke()

    // Pilhas de lingotes reluzentes
    for (let row = 0; row < Math.min(3, clampedTier); row++) {
      for (let col = -1; col <= 1; col++) {
        const ix = cx + col * 20
        const iy = cy - row * 10
        ctx.fillStyle = '#facc15'
        ctx.strokeStyle = '#b45309'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(ix - 9, iy - 4, 18, 9, 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  } else if (kind === 'castle_keep') {
    // CASTELO REAL AZUL 2.5D (Cerco das Torres)
    ctx.fillStyle = '#475569'
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.roundRect(cx - 44, cy - 36, 88, 64, 8)
    ctx.fill()
    ctx.stroke()

    // Telhados cônicos azuis reais
    ctx.fillStyle = '#0284c7'
    ctx.beginPath()
    ctx.moveTo(cx - 48, cy - 36)
    ctx.lineTo(cx - 28, cy - 64)
    ctx.lineTo(cx - 8, cy - 36)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx + 8, cy - 36)
    ctx.lineTo(cx + 28, cy - 64)
    ctx.lineTo(cx + 48, cy - 36)
    ctx.closePath()
    ctx.fill()

    // Portão arqueado real
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.roundRect(cx - 16, cy - 6, 32, 34, [16, 16, 0, 0])
    ctx.fill()
  }

  spriteCache.set(key, c)
  return c
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. UNIDADES 2.5D (Herói Coroado, Soldados do Quartel, Tanques, Operários, Inimigos)
// ──────────────────────────────────────────────────────────────────────────────
export function getUnitSprite(
  kind: UnitSpriteKind,
  animFrame = 0
): HTMLCanvasElement {
  const frameBucket = Math.floor(animFrame) % 4
  const key = `unit:${kind}:f${frameBucket}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const [c, ctx] = createBuffer(72, 72)
  const cx = 36
  const cy = 44
  const stride = (frameBucket % 2 === 0 ? 1 : -1) * 3.5

  // Sombra 2.5D
  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 16, 16, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  if (kind === 'allied_tank' || kind === 'enemy_tank') {
    const isAllied = kind === 'allied_tank'
    // Lagartas blindadas 2.5D
    ctx.fillStyle = '#1e293b'
    ctx.strokeStyle = '#020617'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 24, cy + 4, 48, 12, 5)
    ctx.fill()
    ctx.stroke()

    // Chassi blindado inclinado
    const hullGrad = ctx.createLinearGradient(cx - 22, cy - 12, cx + 22, cy + 8)
    if (isAllied) {
      hullGrad.addColorStop(0, '#38bdf8')
      hullGrad.addColorStop(0.5, '#0284c7')
      hullGrad.addColorStop(1, '#1e3a8a')
    } else {
      hullGrad.addColorStop(0, '#f87171')
      hullGrad.addColorStop(0.5, '#dc2626')
      hullGrad.addColorStop(1, '#7f1d1d')
    }
    ctx.fillStyle = hullGrad
    ctx.strokeStyle = isAllied ? '#bae6fd' : '#fecaca'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 22, cy - 8, 44, 16, 6)
    ctx.fill()
    ctx.stroke()

    // Torreta do tanque + Canhão
    ctx.beginPath()
    ctx.roundRect(cx - 12, cy - 18, 24, 13, 5)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = isAllied ? '#e0f2fe' : '#fca5a5'
    const dir = isAllied ? 1 : -1
    ctx.fillRect(dir > 0 ? cx + 8 : cx - 28, cy - 14, 20, 5)
    spriteCache.set(key, c)
    return c
  }

  if (kind === 'allied_mecha') {
    // Sentinela Mecha 2.5D (Arena das Ondas)
    ctx.fillStyle = '#0ea5e9'
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.roundRect(cx - 16, cy - 18, 32, 26, 8)
    ctx.fill()
    ctx.stroke()
    // Visor neon ciano
    ctx.fillStyle = '#67e8f9'
    ctx.fillRect(cx - 10, cy - 12, 20, 6)
    // Canhões duplos laterais
    ctx.fillStyle = '#334155'
    ctx.fillRect(cx - 24, cy - 10, 8, 14)
    ctx.fillRect(cx + 16, cy - 10, 8, 14)
    spriteCache.set(key, c)
    return c
  }

  // Botas caminhando
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(cx - 6 + stride, cy + 12, 4.5, 0, Math.PI * 2)
  ctx.arc(cx + 6 - stride, cy + 12, 4.5, 0, Math.PI * 2)
  ctx.fill()

  if (kind === 'crowned_hero') {
    // Capa real esvoaçante
    ctx.fillStyle = '#1d4ed8'
    ctx.beginPath()
    ctx.moveTo(cx - 14, cy - 10)
    ctx.lineTo(cx + 14, cy - 10)
    ctx.lineTo(cx + 18, cy + 11)
    ctx.lineTo(cx - 18, cy + 11)
    ctx.closePath()
    ctx.fill()

    // Armadura peitoral azul-celeste e dourada
    ctx.fillStyle = '#0284c7'
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.roundRect(cx - 12, cy - 10, 24, 20, 6)
    ctx.fill()
    ctx.stroke()

    // Cabeça + Coroa Real de Ouro
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(cx, cy - 18, 9.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#facc15'
    ctx.strokeStyle = '#b45309'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - 9, cy - 24)
    ctx.lineTo(cx - 6, cy - 32)
    ctx.lineTo(cx, cy - 26)
    ctx.lineTo(cx + 6, cy - 32)
    ctx.lineTo(cx + 9, cy - 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Besta / Rifle Real
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(cx + 8, cy - 6, 14, 5)
  } else if (kind === 'allied_soldier' || kind === 'allied_archer') {
    // Soldado Aliado treinado pelo Quartel / Besteiro do Esquadrão
    ctx.fillStyle = kind === 'allied_soldier' ? '#0ea5e9' : '#2563eb'
    ctx.strokeStyle = '#bae6fd'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.roundRect(cx - 10, cy - 8, 20, 17, 5)
    ctx.fill()
    ctx.stroke()

    // Capacete tático 2.5D
    ctx.fillStyle = '#38bdf8'
    ctx.beginPath()
    ctx.arc(cx, cy - 15, 8.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Fuzil / Besta
    ctx.fillStyle = '#fde047'
    ctx.fillRect(cx + 6, cy - 4, 13, 4)
  } else if (
    kind === 'worker_small' ||
    kind === 'worker_medium' ||
    kind === 'worker_titan'
  ) {
    // Operários da Pedreira do Rei (Leve 50 / Médio 100 / Titã 300)
    const scale = kind === 'worker_titan' ? 1.28 : kind === 'worker_medium' ? 1.1 : 0.95
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.fillStyle =
      kind === 'worker_titan'
        ? '#7c3aed'
        : kind === 'worker_medium'
          ? '#0284c7'
          : '#0d9488'
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(-11, -9, 22, 18, 6)
    ctx.fill()
    ctx.stroke()

    // Capacete de minerador dourado
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.arc(0, -16, 8.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  } else {
    // Inimigos 2.5D (Goblin chifrudo, Fuzileiro vermelho, Mutante da Arena)
    const isZombie = kind === 'enemy_zombie'
    ctx.fillStyle = isZombie ? '#9333ea' : '#dc2626'
    ctx.strokeStyle = isZombie ? '#d8b4fe' : '#fca5a5'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.roundRect(cx - 11, cy - 8, 22, 18, 6)
    ctx.fill()
    ctx.stroke()

    // Cabeça com chifres e olhos brilhantes
    ctx.fillStyle = isZombie ? '#6b21a8' : '#991b1b'
    ctx.beginPath()
    ctx.arc(cx, cy - 15, 8.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Chifres
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.moveTo(cx - 7, cy - 20)
    ctx.lineTo(cx - 12, cy - 27)
    ctx.lineTo(cx - 3, cy - 22)
    ctx.moveTo(cx + 7, cy - 20)
    ctx.lineTo(cx + 12, cy - 27)
    ctx.lineTo(cx + 3, cy - 22)
    ctx.fill()

    // Olhos amarelos ferozes
    ctx.fillStyle = '#fef08a'
    ctx.fillRect(cx - 5, cy - 17, 3, 3)
    ctx.fillRect(cx + 2, cy - 17, 3, 3)
  }

  spriteCache.set(key, c)
  return c
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. BOSSES GIGANTES 2.5D (Espadachim, Tanque Boss, Golem, Minotauro)
// ──────────────────────────────────────────────────────────────────────────────
export function getBossSprite(kind: BossSpriteKind, animFrame = 0): HTMLCanvasElement {
  const frameBucket = Math.floor(animFrame) % 4
  const key = `boss:${kind}:f${frameBucket}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const [c, ctx] = createBuffer(128, 128)
  const cx = 64
  const cy = 76
  const swing = (frameBucket % 2 === 0 ? 1 : -1) * 4

  // Aura vermelha ameaçadora + sombra no chão
  ctx.fillStyle = 'rgba(220, 38, 38, 0.28)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 24, 42, 18, 0, 0, Math.PI * 2)
  ctx.fill()

  if (kind === 'fort_tank_boss') {
    // TANQUE BOSS GIGANTE DE CANHÃO DUPLO (Forte da Bandeira)
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(cx - 42, cy + 6, 84, 18)
    const bossGrad = ctx.createLinearGradient(cx - 38, cy - 24, cx + 38, cy + 16)
    bossGrad.addColorStop(0, '#ef4444')
    bossGrad.addColorStop(0.5, '#991b1b')
    bossGrad.addColorStop(1, '#450a0a')
    ctx.fillStyle = bossGrad
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(cx - 38, cy - 16, 76, 28, 8)
    ctx.fill()
    ctx.stroke()

    // Torreta pesada com 2 canhões
    ctx.beginPath()
    ctx.roundRect(cx - 22, cy - 34, 44, 22, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#fca5a5'
    ctx.fillRect(cx - 48, cy - 29, 28, 6)
    ctx.fillRect(cx - 48, cy - 20, 28, 6)
  } else {
    // BOSS COLOSSAL 2.5D (Rei Demônio / Minotauro / Golem de Magma)
    const bodyGrad = ctx.createLinearGradient(cx - 30, cy - 40, cx + 30, cy + 20)
    if (kind === 'quarry_golem_boss') {
      bodyGrad.addColorStop(0, '#78716c')
      bodyGrad.addColorStop(0.5, '#44403c')
      bodyGrad.addColorStop(1, '#1c1917')
    } else if (kind === 'arena_minotaur_boss') {
      bodyGrad.addColorStop(0, '#b91c1c')
      bodyGrad.addColorStop(0.5, '#7f1d1d')
      bodyGrad.addColorStop(1, '#3b0764')
    } else {
      bodyGrad.addColorStop(0, '#ef4444')
      bodyGrad.addColorStop(0.5, '#991b1b')
      bodyGrad.addColorStop(1, '#450a0a')
    }

    // Torso blindado gigante
    ctx.fillStyle = bodyGrad
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(cx - 28, cy - 26, 56, 46, 12)
    ctx.fill()
    ctx.stroke()

    // Ombreiras com espinhos dourados
    ctx.fillStyle = '#7f1d1d'
    ctx.beginPath()
    ctx.arc(cx - 30, cy - 18, 12, 0, Math.PI * 2)
    ctx.arc(cx + 30, cy - 18, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Cabeça + Chifres Colossais (Minotauro / Lorde da Guerra)
    ctx.fillStyle = '#450a0a'
    ctx.beginPath()
    ctx.arc(cx, cy - 38, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.moveTo(cx - 12, cy - 44)
    ctx.lineTo(cx - 28, cy - 62)
    ctx.lineTo(cx - 4, cy - 48)
    ctx.moveTo(cx + 12, cy - 44)
    ctx.lineTo(cx + 28, cy - 62)
    ctx.lineTo(cx + 4, cy - 48)
    ctx.fill()

    // Espada / Machado Flamejante
    ctx.save()
    ctx.translate(cx + 32, cy - 10 + swing)
    ctx.rotate(-0.35)
    ctx.fillStyle = '#f97316'
    ctx.strokeStyle = '#fef08a'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(-5, -36, 10, 44, 4)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  spriteCache.set(key, c)
  return c
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. DRAGÃO / SERPENTE 3D ESCAMADA (Kingdom Guard — Engine F)
// ──────────────────────────────────────────────────────────────────────────────
export function getDragonSegmentSprite(role: DragonSegmentRole): HTMLCanvasElement {
  const key = `dragon:${role}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const [c, ctx] = createBuffer(80, 80)
  const cx = 40
  const cy = 40

  // Sombra 3D sob o segmento
  ctx.fillStyle = 'rgba(2, 6, 23, 0.55)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 12, 26, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  const r = role === 'head' ? 28 : role === 'tail' ? 19 : 24
  const grad = ctx.createRadialGradient(cx - 7, cy - 8, 3, cx, cy, r)
  if (role === 'gold') {
    grad.addColorStop(0, '#fef08a')
    grad.addColorStop(0.45, '#facc15')
    grad.addColorStop(0.85, '#b45309')
    grad.addColorStop(1, '#451a03')
  } else if (role === 'head') {
    grad.addColorStop(0, '#fca5a5')
    grad.addColorStop(0.35, '#ef4444')
    grad.addColorStop(0.8, '#991b1b')
    grad.addColorStop(1, '#450a0a')
  } else {
    grad.addColorStop(0, '#fb923c')
    grad.addColorStop(0.4, '#dc2626')
    grad.addColorStop(0.85, '#7f1d1d')
    grad.addColorStop(1, '#3b0764')
  }

  // Esfera 3D com escamas
  ctx.fillStyle = grad
  ctx.strokeStyle = role === 'gold' ? '#fef08a' : '#f59e0b'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Arco de escamas dorsais douradas
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.48)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(cx, cy - 3, r * 0.68, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()

  if (role === 'head') {
    // Chifres reais curvos de dragão + olhos ardentes
    ctx.fillStyle = '#facc15'
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(cx - 14, cy - 18)
    ctx.lineTo(cx - 28, cy - 34)
    ctx.lineTo(cx - 6, cy - 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx + 14, cy - 18)
    ctx.lineTo(cx + 28, cy - 34)
    ctx.lineTo(cx + 6, cy - 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Olhos de fogo
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(cx - 9, cy - 8, 4, 0, Math.PI * 2)
    ctx.arc(cx + 9, cy - 8, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  spriteCache.set(key, c)
  return c
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. PROPS ISOMÉTRICOS 2.5D (Paliçada, Moeda, Barril TNT, Pedestal Roxo, Rocha)
// ──────────────────────────────────────────────────────────────────────────────
export function getPropSprite(kind: PropSpriteKind): HTMLCanvasElement {
  const key = `prop:${kind}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const [c, ctx] = createBuffer(64, 64)
  const cx = 32
  const cy = 34

  if (kind === 'gold_coin') {
    const grad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 14)
    grad.addColorStop(0, '#fef08a')
    grad.addColorStop(0.55, '#facc15')
    grad.addColorStop(1, '#b45309')
    ctx.fillStyle = grad
    ctx.strokeStyle = '#fef9c3'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, 13, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'granite_block') {
    // Bloco de Granito 3D chanfrado (Pedreira / Serpente)
    ctx.fillStyle = '#64748b'
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 22, cy - 20, 44, 40, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(cx - 18, cy - 16, 36, 12)
  } else if (kind === 'tnt_barrel') {
    // Barril Explosivo TNT 2.5D (Kingdom Guard)
    const bGrad = ctx.createLinearGradient(cx - 18, cy - 20, cx + 18, cy + 20)
    bGrad.addColorStop(0, '#ef4444')
    bGrad.addColorStop(0.5, '#dc2626')
    bGrad.addColorStop(1, '#7f1d1d')
    ctx.fillStyle = bGrad
    ctx.strokeStyle = '#fde047'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(cx - 18, cy - 20, 36, 40, 8)
    ctx.fill()
    ctx.stroke()

    // Cintas metálicas e faixa TNT
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(cx - 18, cy - 11, 36, 5)
    ctx.fillRect(cx - 18, cy + 8, 36, 5)

    ctx.fillStyle = '#fef08a'
    ctx.font = '900 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('TNT', cx, cy - 1)
  } else if (kind === 'purple_pedestal') {
    // Pedestal Octogonal Branco/Roxo de Armas & +1 Besteiro (Kingdom Guard)
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#a855f7'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.roundRect(cx - 24, cy - 22, 48, 44, 12)
    ctx.fill()
    ctx.stroke()

    const pGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 18)
    pGrad.addColorStop(0, '#d8b4fe')
    pGrad.addColorStop(0.6, '#9333ea')
    pGrad.addColorStop(1, '#4c1d95')
    ctx.fillStyle = pGrad
    ctx.beginPath()
    ctx.arc(cx, cy, 16, 0, Math.PI * 2)
    ctx.fill()
  } else if (kind === 'wood_palisade') {
    // Estacas de madeira 2.5D da paliçada
    for (let lx = -18; lx <= 18; lx += 12) {
      ctx.fillStyle = '#92400e'
      ctx.strokeStyle = '#451a03'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx + lx - 5, cy + 18)
      ctx.lineTo(cx + lx - 5, cy - 8)
      ctx.lineTo(cx + lx, cy - 20)
      ctx.lineTo(cx + lx + 5, cy - 8)
      ctx.lineTo(cx + lx + 5, cy + 18)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  spriteCache.set(key, c)
  return c
}

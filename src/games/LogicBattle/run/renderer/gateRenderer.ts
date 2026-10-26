// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/gateRenderer.ts — Ponte de Pedra 3D, Ilhas & Portões Neon
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import { BiomeConfig } from '../../config/biomes'
import { OPERATOR_PALETTE } from '../../config/gatePolicies'
import { applyGateChain } from '../../domain/armyMath'
import { formatArmy } from '../../domain/notation'
import { ArmyCount, EnemySpec, Gate, LaneSegment, NotationMode } from '../../types'
import { drawFortressAndBoss, FortressRenderState } from './battleRenderer'
import {
  BridgeProjectionConfig,
  getLaneCenterNormX,
  projectBridgePoint,
} from './perspective'

function drawPineTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  snowTint: boolean,
): void {
  const s = scale * 1.35
  ctx.save()
  // Sombra macia na neve
  ctx.fillStyle = 'rgba(15, 23, 42, 0.24)'
  ctx.beginPath()
  ctx.ellipse(x, y + 3 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  // Tronco robusto de madeira
  ctx.fillStyle = '#451a03'
  ctx.beginPath()
  ctx.roundRect(x - 3.5 * s, y - 9 * s, 7 * s, 11 * s, 2 * s)
  ctx.fill()

  // 3 camadas cônicas frondosas com neve espessa (fiel a mundo1_ponte_conceito.jpg)
  const layers = [
    { baseY: y - 5 * s, topY: y - 26 * s, halfW: 18 * s, dark: '#14532d', light: '#166534' },
    { baseY: y - 16 * s, topY: y - 37 * s, halfW: 14.5 * s, dark: '#166534', light: '#15803d' },
    { baseY: y - 27 * s, topY: y - 47 * s, halfW: 10.5 * s, dark: '#15803d', light: '#22c55e' },
  ]

  for (const layer of layers) {
    // Folhagem verde-pinho
    ctx.fillStyle = layer.dark
    ctx.beginPath()
    ctx.moveTo(x, layer.topY)
    ctx.lineTo(x + layer.halfW, layer.baseY)
    ctx.lineTo(x - layer.halfW, layer.baseY)
    ctx.closePath()
    ctx.fill()

    // Face iluminada à esquerda
    ctx.fillStyle = layer.light
    ctx.beginPath()
    ctx.moveTo(x, layer.topY)
    ctx.lineTo(x, layer.baseY)
    ctx.lineTo(x - layer.halfW, layer.baseY)
    ctx.closePath()
    ctx.fill()

    // Cobertura generosa de neve branca nos galhos
    if (snowTint) {
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.moveTo(x, layer.topY)
      ctx.lineTo(x + layer.halfW * 0.72, layer.topY + (layer.baseY - layer.topY) * 0.62)
      ctx.quadraticCurveTo(
        x + layer.halfW * 0.25,
        layer.topY + (layer.baseY - layer.topY) * 0.45,
        x,
        layer.topY + (layer.baseY - layer.topY) * 0.66,
      )
      ctx.quadraticCurveTo(
        x - layer.halfW * 0.25,
        layer.topY + (layer.baseY - layer.topY) * 0.45,
        x - layer.halfW * 0.72,
        layer.topY + (layer.baseY - layer.topY) * 0.62,
      )
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawSideIslandsAndScenery(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  biome: BiomeConfig,
  progress: number,
): void {
  const { width, height } = proj
  const isWarmBiome = biome.id === 'deserto_decimais' || biome.id === 'vulcao_negativos'
  const snowColor = isWarmBiome ? '#e7e5e4' : '#f8fafc'
  const snowShadow = isWarmBiome ? '#a8a29e' : '#cbd5e1'
  const cliffColor = isWarmBiome ? '#57534e' : '#64748b'

  const scrollZ = (progress * 1.4) % 1

  // Margens costeiras amplas de neve com falésias e bosques de pinheiros (como em mundo1_ponte_conceito.jpg)
  const islandDepths = [0.16, 0.44, 0.72]
  for (let idx = 0; idx < islandDepths.length; idx++) {
    const rawZ = (islandDepths[idx] - scrollZ * 0.22 + 1) % 1
    const z = 0.14 + rawZ * 0.72
    const leftEdge = projectBridgePoint(proj, -1.02, z)
    const rightEdge = projectBridgePoint(proj, 1.02, z)
    const s = leftEdge.scale

    const islandRx = 92 * s
    const islandRy = 32 * s

    // Margem esquerda
    const lx = leftEdge.x - 52 * s
    const ly = leftEdge.y + 6 * s
    ctx.save()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)'
    ctx.beginPath()
    ctx.ellipse(lx, ly + 13 * s, islandRx * 1.04, islandRy * 1.05, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cliffColor
    ctx.beginPath()
    ctx.ellipse(lx, ly + 9 * s, islandRx, islandRy, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = snowShadow
    ctx.beginPath()
    ctx.ellipse(lx, ly + 3 * s, islandRx * 0.96, islandRy * 0.88, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = snowColor
    ctx.beginPath()
    ctx.ellipse(lx, ly, islandRx * 0.92, islandRy * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()

    drawPineTree(ctx, lx - 34 * s, ly - 4 * s, s * 0.98, !isWarmBiome)
    drawPineTree(ctx, lx - 6 * s, ly - 8 * s, s * 1.12, !isWarmBiome)
    drawPineTree(ctx, lx + 20 * s, ly + 4 * s, s * 0.9, !isWarmBiome)
    ctx.restore()

    // Margem direita
    const rx = rightEdge.x + 52 * s
    const ry = rightEdge.y + 6 * s
    ctx.save()
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)'
    ctx.beginPath()
    ctx.ellipse(rx, ry + 13 * s, islandRx * 1.04, islandRy * 1.05, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = cliffColor
    ctx.beginPath()
    ctx.ellipse(rx, ry + 9 * s, islandRx, islandRy, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = snowShadow
    ctx.beginPath()
    ctx.ellipse(rx, ry + 3 * s, islandRx * 0.96, islandRy * 0.88, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = snowColor
    ctx.beginPath()
    ctx.ellipse(rx, ry, islandRx * 0.92, islandRy * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()

    drawPineTree(ctx, rx + 34 * s, ry - 4 * s, s * 0.98, !isWarmBiome)
    drawPineTree(ctx, rx + 6 * s, ry - 8 * s, s * 1.12, !isWarmBiome)
    drawPineTree(ctx, rx - 20 * s, ry + 4 * s, s * 0.9, !isWarmBiome)
    ctx.restore()
  }

  // Reflexos claros na água gelada
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1.6
  for (let i = 0; i < 6; i++) {
    const wy = height * (0.3 + i * 0.1)
    ctx.beginPath()
    ctx.moveTo(10, wy)
    ctx.lineTo(36 + (i % 2) * 16, wy)
    ctx.moveTo(width - 48, wy + 6)
    ctx.lineTo(width - 12, wy + 6)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawBridgeAndBackdrop(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  biome: BiomeConfig,
  laneCount: 2 | 3,
  progress: number,
  enemy: EnemySpec,
  notationMode: NotationMode,
  battleState?: FortressRenderState,
): { bossCenterX: number; bossCenterY: number; hordeCenterY: number } {
  const { width, height } = proj

  // 1. Céu e Mar Ártico Luminoso (azul-celeste no topo -> azul-oceano claro na água, como em mundo1_ponte_conceito.jpg)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
  if (biome.id === 'planicie_pedra' || biome.id === 'fiorde_gelado') {
    skyGrad.addColorStop(0, '#93c5fd')
    skyGrad.addColorStop(0.28, '#60a5fa')
    skyGrad.addColorStop(0.55, '#38bdf8')
    skyGrad.addColorStop(1, '#0284c7')
  } else {
    skyGrad.addColorStop(0, biome.skyGradient[0])
    skyGrad.addColorStop(1, biome.skyGradient[1])
  }
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  // Brilho atmosférico suave no horizonte
  const horizonY = height * proj.horizonYRatio
  const glowGrad = ctx.createRadialGradient(
    width * 0.5,
    horizonY,
    16,
    width * 0.5,
    horizonY,
    width * 0.72,
  )
  glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)')
  glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, width, height * 0.65)

  // 2. Ilhas costeiras nevadas e pinheiros 3D nas margens da ponte
  drawSideIslandsAndScenery(ctx, proj, biome, progress)

  // 3. Trapézio da Ponte de Pedra (Paredes Laterais 3D, Lajes de Cantaria, Neve e Parapeitos)
  const nearLeft = projectBridgePoint(proj, -1, -0.26)
  const nearRight = projectBridgePoint(proj, 1, -0.26)
  const farLeft = projectBridgePoint(proj, -1, 0.88)
  const farRight = projectBridgePoint(proj, 1, 0.88)

  ctx.save()

  // Paredes laterais 3D de alvenaria da ponte descendo até a água
  ctx.fillStyle = '#475569'
  ctx.beginPath()
  ctx.moveTo(nearLeft.x - 16, nearLeft.y)
  ctx.lineTo(farLeft.x - 6, farLeft.y + 12)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.lineTo(nearLeft.x, nearLeft.y)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(nearRight.x + 16, nearRight.y)
  ctx.lineTo(farRight.x + 6, farRight.y + 12)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.lineTo(nearRight.x, nearRight.y)
  ctx.closePath()
  ctx.fill()

  // Superfície de pedra clara da ponte
  const bridgeGrad = ctx.createLinearGradient(0, farLeft.y, 0, nearLeft.y)
  bridgeGrad.addColorStop(0, '#94a3b8')
  bridgeGrad.addColorStop(0.45, '#78879b')
  bridgeGrad.addColorStop(1, '#64748b')
  ctx.fillStyle = bridgeGrad
  ctx.beginPath()
  ctx.moveTo(nearLeft.x, nearLeft.y)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.lineTo(nearRight.x, nearRight.y)
  ctx.closePath()
  ctx.fill()

  // Calçamento de pedras (cobblestones) com juntas e blocos iluminados
  const tileOffset = (progress * 18) % 1
  const rowCount = 15
  for (let i = 0; i < rowCount; i++) {
    const z0 = ((i + (1 - tileOffset)) / rowCount) * 0.88
    const z1 = ((i + 1 + (1 - tileOffset)) / rowCount) * 0.88
    if (z0 <= -0.1 || z0 >= 0.87) continue
    const pL = projectBridgePoint(proj, -1, z0)
    const pR = projectBridgePoint(proj, 1, z0)

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.36)'
    ctx.lineWidth = Math.max(1.1, 1.9 * pL.scale)
    ctx.beginPath()
    ctx.moveTo(pL.x, pL.y)
    ctx.lineTo(pR.x, pR.y)
    ctx.stroke()

    if (z1 <= 0.88) {
      const cols = 5
      const shift = (i % 2) * 0.18
      for (let c = 1; c < cols; c++) {
        const normX = -1 + (c / cols) * 2 + shift - 0.09
        if (normX <= -0.92 || normX >= 0.92) continue
        const b0 = projectBridgePoint(proj, normX, z0)
        const b1 = projectBridgePoint(proj, normX, z1)
        ctx.beginPath()
        ctx.moveTo(b0.x, b0.y)
        ctx.lineTo(b1.x, b1.y)
        ctx.stroke()
      }
    }
  }

  // Faixas de neve acumulada junto aos parapeitos internos (como em mundo1_ponte_conceito.jpg)
  const snowInLNear = projectBridgePoint(proj, -0.91, -0.26)
  const snowInLFar = projectBridgePoint(proj, -0.88, 0.88)
  ctx.fillStyle = 'rgba(241, 245, 249, 0.65)'
  ctx.beginPath()
  ctx.moveTo(nearLeft.x, nearLeft.y)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.lineTo(snowInLFar.x, snowInLFar.y)
  ctx.lineTo(snowInLNear.x, snowInLNear.y)
  ctx.closePath()
  ctx.fill()

  const snowInRNear = projectBridgePoint(proj, 0.91, -0.26)
  const snowInRFar = projectBridgePoint(proj, 0.88, 0.88)
  ctx.beginPath()
  ctx.moveTo(nearRight.x, nearRight.y)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.lineTo(snowInRFar.x, snowInRFar.y)
  ctx.lineTo(snowInRNear.x, snowInRNear.y)
  ctx.closePath()
  ctx.fill()

  // Parapeitos laterais largos de cantaria 3D (curbs)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(nearLeft.x, nearLeft.y)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.moveTo(nearRight.x, nearRight.y)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.stroke()

  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(nearLeft.x - 2, nearLeft.y)
  ctx.lineTo(farLeft.x - 1, farLeft.y)
  ctx.moveTo(nearRight.x + 2, nearRight.y)
  ctx.lineTo(farRight.x + 1, farRight.y)
  ctx.stroke()

  // Divisória sutil de faixas no centro da ponte
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.25)'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 10])
  if (laneCount === 2) {
    const midNear = projectBridgePoint(proj, 0, -0.05)
    const midFar = projectBridgePoint(proj, 0, 0.85)
    ctx.beginPath()
    ctx.moveTo(midNear.x, midNear.y)
    ctx.lineTo(midFar.x, midFar.y)
    ctx.stroke()
  } else {
    for (const divX of [-0.33, 0.33]) {
      const dNear = projectBridgePoint(proj, divX, -0.05)
      const dFar = projectBridgePoint(proj, divX, 0.85)
      ctx.beginPath()
      ctx.moveTo(dNear.x, dNear.y)
      ctx.lineTo(dFar.x, dFar.y)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
  ctx.restore()

  // 4. Fortaleza semicircular, Horda de soldados rubros, Chefe com chifres e Barra de Vida [💀 1,2k]
  return drawFortressAndBoss(ctx, proj, progress, enemy, notationMode, battleState)
}

/**
 * Seleciona a paleta neon vibrante de cada portão para reproduzir a riqueza cromática
 * de `mundo1_ponte_conceito.jpg` (Verde-Esmeralda `#22c55e`, Azul-Elétrico `#0ea5e9` e Vermelho-Vivo `#ef4444`).
 */
function resolveGateVisualPalette(
  primaryGate: Gate,
  laneIdx: number,
  isRedemptionGate: boolean,
  isChainOrConveyor: boolean,
): { border: string; topFill: string; midFill: string; botFill: string } {
  if (isRedemptionGate) {
    return {
      border: '#facc15',
      topFill: 'rgba(250, 204, 21, 0.62)',
      midFill: 'rgba(234, 179, 8, 0.42)',
      botFill: 'rgba(250, 204, 21, 0.68)',
    }
  }

  // Operadores de subtração ou desconto são sempre Vermelho-Vivo (como "- 10" no conceito)
  if (primaryGate.op === '−' || primaryGate.op === '%−') {
    return {
      border: '#ff4d4d',
      topFill: 'rgba(239, 68, 68, 0.66)',
      midFill: 'rgba(220, 38, 38, 0.48)',
      botFill: 'rgba(239, 68, 68, 0.72)',
    }
  }

  // Multiplicação, esteiras (5x [+1]) ou segunda faixa de soma usam Azul-Ciano Elétrico (como "× 2" e "× ½" no conceito)
  if (
    primaryGate.op === '×' ||
    primaryGate.op === '÷' ||
    isChainOrConveyor ||
    (primaryGate.op === '+' && laneIdx % 2 === 1)
  ) {
    return {
      border: '#38bdf8',
      topFill: 'rgba(14, 165, 233, 0.64)',
      midFill: 'rgba(2, 132, 199, 0.46)',
      botFill: 'rgba(56, 189, 248, 0.72)',
    }
  }

  // Soma principal na primeira faixa usa Verde-Esmeralda Luminoso (como "+ 99" no conceito)
  if (primaryGate.op === '+') {
    return {
      border: '#4ade80',
      topFill: 'rgba(34, 197, 94, 0.64)',
      midFill: 'rgba(22, 163, 74, 0.46)',
      botFill: 'rgba(74, 222, 128, 0.72)',
    }
  }

  const fallback = OPERATOR_PALETTE[primaryGate.op] ?? OPERATOR_PALETTE['+']
  return {
    border: fallback.border,
    topFill: fallback.fill.replace('0.22', '0.58'),
    midFill: fallback.fill.replace('0.22', '0.42'),
    botFill: fallback.fill.replace('0.22', '0.66'),
  }
}

export function drawSegmentsOnBridge(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  segments: readonly LaneSegment[],
  resolvedSegments: Readonly<Record<string, { chosenLane: number; resultArmy: ArmyCount }>>,
  progress: number,
  laneCount: 2 | 3,
  currentArmy: ArmyCount,
  inspectedSegmentId: string | null,
  notationMode: NotationMode,
): void {
  const upcoming: { seg: LaneSegment; relDepth: number }[] = []
  for (const seg of segments) {
    if (resolvedSegments[seg.id]) continue
    const relDepth = (seg.zPosition - progress) * 3.6
    if (relDepth >= -0.04 && relDepth <= 0.68) {
      upcoming.push({ seg, relDepth })
    }
  }

  upcoming.sort((a, b) => a.relDepth - b.relDepth)
  const visible = upcoming.slice(0, 2).reverse()

  for (const { seg, relDepth } of visible) {
    const isInspected = inspectedSegmentId === seg.id
    const isRedemptionGate = seg.kind === 'redemption'

    for (let laneIdx = 0; laneIdx < seg.lanes.length; laneIdx++) {
      const laneGates = seg.lanes[laneIdx]
      if (!laneGates || laneGates.length === 0) continue

      const primaryGate = laneGates[0]
      const laneCenterX = getLaneCenterNormX(laneIdx, laneCount)
      const pt = projectBridgePoint(proj, laneCenterX, relDepth)

      const laneWidthPx = (pt.halfBridgeWidth * 1.9) / laneCount
      const gateW = Math.max(60, laneWidthPx * 0.95)
      const gateH = Math.max(44, 88 * pt.scale)
      const x0 = pt.x - gateW / 2
      const y0 = pt.y - gateH

      const isChainOrConveyor =
        (seg.kind === 'conveyor' || seg.kind === 'chain') && laneGates.length > 1
      const vis = resolveGateVisualPalette(
        primaryGate,
        laneIdx,
        isRedemptionGate,
        isChainOrConveyor,
      )

      ctx.save()

      // Reflexo luminoso do portão no chão de pedra da ponte
      ctx.fillStyle = vis.midFill
      ctx.beginPath()
      ctx.ellipse(pt.x, pt.y + 3 * pt.scale, gateW * 0.46, 7 * pt.scale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Painel de energia translúcido com gradiente vertical luminoso (estilo mundo1_ponte_conceito.jpg)
      const panelGrad = ctx.createLinearGradient(x0, y0, x0, y0 + gateH)
      panelGrad.addColorStop(0, vis.topFill)
      panelGrad.addColorStop(0.5, vis.midFill)
      panelGrad.addColorStop(1, vis.botFill)

      ctx.fillStyle = panelGrad
      ctx.strokeStyle = vis.border
      ctx.lineWidth = Math.max(2.4, 3.4 * pt.scale)
      ctx.beginPath()
      ctx.roundRect(x0, y0, gateW, gateH, Math.max(6, 8 * pt.scale))
      ctx.fill()
      ctx.stroke()

      // Brilho diagonal vítreo no painel do portão
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.beginPath()
      ctx.moveTo(x0 + gateW * 0.14, y0 + 2)
      ctx.lineTo(x0 + gateW * 0.42, y0 + 2)
      ctx.lineTo(x0 + gateW * 0.24, y0 + gateH - 2)
      ctx.lineTo(x0 + gateW * 0.04, y0 + gateH - 2)
      ctx.closePath()
      ctx.fill()

      // Pilares laterais de neon brilhante com núcleo branco incandescente
      const pillarW = Math.max(4.5, 7 * pt.scale)
      ctx.fillStyle = vis.border
      ctx.beginPath()
      ctx.roundRect(x0 - 1.5, y0 - 3 * pt.scale, pillarW, gateH + 5 * pt.scale, 3)
      ctx.roundRect(x0 + gateW - pillarW + 1.5, y0 - 3 * pt.scale, pillarW, gateH + 5 * pt.scale, 3)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x0 + 0.5, y0 + 1, Math.max(1.8, pillarW * 0.42), gateH - 2)
      ctx.fillRect(x0 + gateW - pillarW * 0.65, y0 + 1, Math.max(1.8, pillarW * 0.42), gateH - 2)

      // Texto honesto gigante com contorno escuro 3D ("+ 99", "× 2", "× ½", "− 10")
      let mainText = primaryGate.label
      if (seg.kind === 'conveyor' && laneGates.length > 1) {
        mainText = `${laneGates.length}× [${primaryGate.label}]`
      } else if (seg.kind === 'chain' && laneGates.length > 1) {
        mainText = laneGates.map((g) => g.label).join(' → ')
      }

      const fontSize = Math.max(
        14,
        Math.min(28, Math.round((mainText.length > 7 ? 16 : 24) * pt.scale + 4)),
      )
      ctx.font = `900 ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const textY = y0 + gateH * 0.52
      // Sombra projetada 3D
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)'
      ctx.fillText(mainText, pt.x, textY + 2.5 * pt.scale)

      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = Math.max(3.5, 5.5 * pt.scale)
      ctx.lineJoin = 'round'
      ctx.strokeText(mainText, pt.x, textY)

      ctx.fillStyle = '#ffffff'
      ctx.fillText(mainText, pt.x, textY)

      // Se a Luneta Tática inspecionou este segmento, mostra o resultado exato acima do portão
      if (isInspected) {
        const previewVal = applyGateChain(currentArmy, laneGates)
        const previewLabel = `🔭 ${formatArmy(previewVal, notationMode)}`
        ctx.fillStyle = '#0f172a'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.8
        const pw = Math.max(54, previewLabel.length * 7.5 + 12)
        const ph = 20
        ctx.beginPath()
        ctx.roundRect(pt.x - pw / 2, y0 - ph - 5, pw, ph, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#7dd3fc'
        ctx.font = 'bold 11px Inter, system-ui, sans-serif'
        ctx.fillText(previewLabel, pt.x, y0 - ph / 2 - 4.5)
      }

      ctx.restore()
    }

    // Ícone compacto do Detector de Pegadinhas (!) no centro do par de portões
    if (seg.showDetectorWarning && relDepth < 0.8) {
      const centerPt = projectBridgePoint(proj, 0, relDepth)
      const gateH = Math.max(44, 88 * centerPt.scale)
      const badgeY = centerPt.y - gateH * 0.5

      ctx.save()
      ctx.fillStyle = '#facc15'
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(centerPt.x, badgeY, Math.max(10, 13 * centerPt.scale), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#0f172a'
      ctx.font = `900 ${Math.max(10, Math.round(13 * centerPt.scale))}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', centerPt.x, badgeY + 0.5)
      ctx.restore()
    }
  }
}

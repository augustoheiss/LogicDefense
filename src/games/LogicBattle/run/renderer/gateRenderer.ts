// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/gateRenderer.ts — Ponte Pseudo-3D & Portões Honestos
// ──────────────────────────────────────────────────────────────────────────────
import { BiomeConfig } from '../../config/biomes'
import { OPERATOR_PALETTE } from '../../config/gatePolicies'
import { applyGateChain } from '../../domain/armyMath'
import { formatArmy } from '../../domain/notation'
import { ArmyCount, EnemySpec, LaneSegment, NotationMode } from '../../types'
import {
  BridgeProjectionConfig,
  getLaneCenterNormX,
  projectBridgePoint,
} from './perspective'

export function drawBridgeAndBackdrop(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  biome: BiomeConfig,
  laneCount: 2 | 3,
  progress: number,
  enemy: EnemySpec,
  notationMode: NotationMode,
): void {
  const { width, height } = proj

  // Céu do bioma
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
  skyGrad.addColorStop(0, biome.skyGradient[0])
  skyGrad.addColorStop(1, biome.skyGradient[1])
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, width, height)

  // Brilho do horizonte
  const horizonY = height * proj.horizonYRatio
  const glowGrad = ctx.createRadialGradient(
    width * 0.5,
    horizonY,
    10,
    width * 0.5,
    horizonY,
    width * 0.55,
  )
  glowGrad.addColorStop(0, biome.horizonGlowColor)
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, width, height * 0.55)

  // Trapézio da ponte
  const nearLeft = projectBridgePoint(proj, -1, -0.08)
  const nearRight = projectBridgePoint(proj, 1, -0.08)
  const farLeft = projectBridgePoint(proj, -1, 1)
  const farRight = projectBridgePoint(proj, 1, 1)

  ctx.save()
  ctx.fillStyle = biome.bridgeSurfaceColor
  ctx.beginPath()
  ctx.moveTo(nearLeft.x, nearLeft.y)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.lineTo(nearRight.x, nearRight.y)
  ctx.closePath()
  ctx.fill()

  // Parapeitos laterais luminosos
  ctx.strokeStyle = biome.bridgeEdgeColor
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(nearLeft.x, nearLeft.y)
  ctx.lineTo(farLeft.x, farLeft.y)
  ctx.moveTo(nearRight.x, nearRight.y)
  ctx.lineTo(farRight.x, farRight.y)
  ctx.stroke()

  // Linhas horizontais de laje em movimento com o progresso da marcha
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
  ctx.lineWidth = 1
  const tileOffset = (progress * 18) % 1
  for (let i = 0; i < 12; i++) {
    const z = ((i + (1 - tileOffset)) / 12) * 0.98
    if (z <= 0.01 || z >= 0.99) continue
    const pL = projectBridgePoint(proj, -1, z)
    const pR = projectBridgePoint(proj, 1, z)
    ctx.beginPath()
    ctx.moveTo(pL.x, pL.y)
    ctx.lineTo(pR.x, pR.y)
    ctx.stroke()
  }

  // Divisórias de faixas (2 ou 3 faixas)
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.24)'
  ctx.setLineDash([8, 8])
  if (laneCount === 2) {
    const midNear = projectBridgePoint(proj, 0, -0.05)
    const midFar = projectBridgePoint(proj, 0, 1)
    ctx.beginPath()
    ctx.moveTo(midNear.x, midNear.y)
    ctx.lineTo(midFar.x, midFar.y)
    ctx.stroke()
  } else {
    for (const divX of [-0.33, 0.33]) {
      const dNear = projectBridgePoint(proj, divX, -0.05)
      const dFar = projectBridgePoint(proj, divX, 1)
      ctx.beginPath()
      ctx.moveTo(dNear.x, dNear.y)
      ctx.lineTo(dFar.x, dFar.y)
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
  ctx.restore()

  // Fortaleza / Chefe no horizonte (aproxima-se no final da corrida)
  const bossDepth = Math.max(0.18, 1 - Math.max(0, progress - 0.72) * 2.8)
  const bossPt = projectBridgePoint(proj, 0, bossDepth)
  const badgeW = 148 * bossPt.scale + 44
  const badgeH = 34 * bossPt.scale + 12

  ctx.save()
  ctx.fillStyle = 'rgba(69, 10, 10, 0.9)'
  ctx.strokeStyle = '#fb7185'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(bossPt.x - badgeW / 2, bossPt.y - badgeH - 8, badgeW, badgeH, 8)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ffe4e6'
  ctx.font = `bold ${Math.max(10, Math.round(12 * bossPt.scale + 2))}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    `⚔ ${enemy.bossName}: ${formatArmy(enemy.totalForce, notationMode)}`,
    bossPt.x,
    bossPt.y - badgeH / 2 - 8,
  )
  ctx.restore()
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
  // Filtra segmentos visíveis à frente ou recém-atravessados e ordena do fundo (maior depth) para a frente
  const visible: { seg: LaneSegment; relDepth: number }[] = []
  for (const seg of segments) {
    if (resolvedSegments[seg.id]) continue
    const relDepth = (seg.zPosition - progress) * 2.35
    if (relDepth >= -0.04 && relDepth <= 1.0) {
      visible.push({ seg, relDepth })
    }
  }

  visible.sort((a, b) => b.relDepth - a.relDepth)

  for (const { seg, relDepth } of visible) {
    const isInspected = inspectedSegmentId === seg.id
    const isRedemptionGate = seg.kind === 'redemption'

    for (let laneIdx = 0; laneIdx < seg.lanes.length; laneIdx++) {
      const laneGates = seg.lanes[laneIdx]
      if (!laneGates || laneGates.length === 0) continue

      const primaryGate = laneGates[0]
      const laneCenterX = getLaneCenterNormX(laneIdx, laneCount)
      const pt = projectBridgePoint(proj, laneCenterX, relDepth)

      const laneWidthPx = (pt.halfBridgeWidth * 1.82) / laneCount
      const gateW = Math.max(54, laneWidthPx * 0.92)
      const gateH = Math.max(34, 68 * pt.scale)
      const x0 = pt.x - gateW / 2
      const y0 = pt.y - gateH

      const palette = isRedemptionGate
        ? {
            border: '#facc15',
            fill: 'rgba(250, 204, 21, 0.28)',
            badgeBg: '#854d0e',
            text: '#fef08a',
            namePt: 'Portão do Resgate',
          }
        : OPERATOR_PALETTE[primaryGate.op] ?? OPERATOR_PALETTE['+']

      ctx.save()

      // Sombra e painel translúcido do portão
      ctx.fillStyle = palette.fill
      ctx.strokeStyle = palette.border
      ctx.lineWidth = Math.max(2, 3 * pt.scale)
      ctx.beginPath()
      ctx.roundRect(x0, y0, gateW, gateH, Math.max(6, 10 * pt.scale))
      ctx.fill()
      ctx.stroke()

      // Pilares laterais
      ctx.fillStyle = palette.border
      ctx.fillRect(x0, y0, Math.max(3, 5 * pt.scale), gateH)
      ctx.fillRect(x0 + gateW - Math.max(3, 5 * pt.scale), y0, Math.max(3, 5 * pt.scale), gateH)

      // Texto honesto da placa (com suporte a esteira 'conveyor' e cadeia 'chain')
      let mainText = primaryGate.label
      let subText = primaryGate.subLabel ?? ''
      if (seg.kind === 'conveyor' && laneGates.length > 1) {
        mainText = `${laneGates.length}× [${primaryGate.label}]`
        subText = 'Esteira em Série'
      } else if (seg.kind === 'chain' && laneGates.length > 1) {
        mainText = laneGates.map((g) => g.label).join(' → ')
        subText = 'Ordem Importa'
      }

      const fontSize = Math.max(
        11,
        Math.min(20, Math.round((mainText.length > 9 ? 14 : 18) * pt.scale + 3)),
      )
      ctx.fillStyle = palette.text
      ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(mainText, pt.x, y0 + gateH * (subText ? 0.42 : 0.52))

      if (subText && pt.scale > 0.42) {
        ctx.fillStyle = '#e2e8f0'
        ctx.font = `600 ${Math.max(9, Math.round(10 * pt.scale + 1))}px Inter, system-ui, sans-serif`
        ctx.fillText(subText, pt.x, y0 + gateH * 0.76)
      }

      // Se a Luneta Tática inspecionou este segmento, mostra o resultado exato acima do portão
      if (isInspected) {
        const previewVal = applyGateChain(currentArmy, laneGates)
        const previewLabel = `🔭 = ${formatArmy(previewVal, notationMode)}`
        ctx.fillStyle = '#0f172a'
        ctx.strokeStyle = '#38bdf8'
        ctx.lineWidth = 1.5
        const pw = Math.max(58, previewLabel.length * 7.5 + 12)
        const ph = 20
        ctx.beginPath()
        ctx.roundRect(pt.x - pw / 2, y0 - ph - 4, pw, ph, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#7dd3fc'
        ctx.font = 'bold 11px Inter, system-ui, sans-serif'
        ctx.fillText(previewLabel, pt.x, y0 - ph / 2 - 4)
      }

      ctx.restore()
    }

    // Badge central do Detector de Pegadinhas (⚠ Observatório Socrático)
    if (seg.showDetectorWarning && relDepth < 0.85) {
      const centerPt = projectBridgePoint(proj, 0, relDepth)
      const gateH = Math.max(34, 68 * centerPt.scale)
      const badgeY = centerPt.y - gateH - 12

      ctx.save()
      ctx.fillStyle = '#78350f'
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.roundRect(centerPt.x - 46, badgeY - 11, 92, 22, 11)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#fef08a'
      ctx.font = 'bold 11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⚠ PEGADINHA?', centerPt.x, badgeY + 0.5)
      ctx.restore()
    }
  }
}

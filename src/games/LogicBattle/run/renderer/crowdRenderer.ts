// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/crowdRenderer.ts — Espiral de Filotaxia & Vai-Um
// ──────────────────────────────────────────────────────────────────────────────
import { decomposeTiers, formatArmy } from '../../domain/notation'
import {
  ArmyCount,
  CrowdSpriteNode,
  MergeAnimationEvent,
  NotationMode,
} from '../../types'
import { BridgeProjectionConfig, projectBridgePoint } from './perspective'
import { getTierSprite } from './spriteFactory'

const GOLDEN_ANGLE_RAD = (137.50776405003785 * Math.PI) / 180

/**
 * Gera a distribuição espacial em espiral de filotaxia (137,5°) para os Pelotões Posicionais.
 * As unidades de maior denominação ficam no coração da formação e os Recrutas nas bordas.
 */
export function buildCrowdNodes(army: ArmyCount): CrowdSpriteNode[] {
  const tiers = decomposeTiers(army)
  const nodes: CrowdSpriteNode[] = []
  let k = 0

  for (const { tier, count } of tiers) {
    for (let i = 0; i < count; i++) {
      const r = k === 0 ? 0 : Math.min(0.32, 0.024 * Math.sqrt(k))
      const theta = k * GOLDEN_ANGLE_RAD
      const offsetX = Math.cos(theta) * r
      const offsetZ = Math.sin(theta) * r * 0.42
      nodes.push({
        id: `u_${tier.tierIndex}_${i}`,
        tierIndex: tier.tierIndex,
        denominationLabel: tier.denominationLabel,
        offsetX,
        offsetZ,
        scale: 1 + tier.tierIndex * 0.06,
      })
      k++
    }
  }

  // Ordenar de trás para frente (maior offsetZ primeiro) para Painter's Algorithm
  nodes.sort((a, b) => b.offsetZ - a.offsetZ)
  return nodes
}

export function drawPlayerCrowd(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  nodes: readonly CrowdSpriteNode[],
  laneNormX: number,
  currentArmy: ArmyCount,
  notationMode: NotationMode,
  elapsedMs: number,
  activeMergeEvent: MergeAnimationEvent | null,
  reducedMotion: boolean,
): void {
  const centerProj = projectBridgePoint(proj, laneNormX, 0.04)

  // Se houver Fusão Vai-Um ativa, desenha anel dourado pulsante na base do exército
  if (activeMergeEvent) {
    const ageMs = Math.max(0, elapsedMs - activeMergeEvent.startedAtMs)
    const progress = Math.min(1, ageMs / 1100)
    const ringRadius = 28 + progress * 46
    ctx.save()
    ctx.strokeStyle = `rgba(250, 204, 21, ${1 - progress * 0.85})`
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.ellipse(centerProj.x, centerProj.y + 4, ringRadius, ringRadius * 0.45, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Desenhar cada unidade na espiral
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const sprite = getTierSprite(node.tierIndex)
    const unitNormX = Math.max(-0.92, Math.min(0.92, laneNormX + node.offsetX))
    const unitZ = Math.max(0, Math.min(0.18, 0.04 + node.offsetZ * 0.22))
    const pt = projectBridgePoint(proj, unitNormX, unitZ)

    const bobY = reducedMotion
      ? 0
      : Math.sin(elapsedMs * 0.012 + i * 0.7) * 2.2

    if (sprite) {
      const drawW = sprite.width * pt.scale * 0.92
      const drawH = sprite.height * pt.scale * 0.92
      ctx.drawImage(sprite, pt.x - drawW / 2, pt.y - drawH + bobY, drawW, drawH)
    } else {
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(pt.x, pt.y + bobY, 7 * pt.scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Placa flutuante de contagem acima do exército
  const formatted = formatArmy(currentArmy, notationMode)
  const pillW = Math.max(66, formatted.length * 11 + 26)
  const pillH = 28
  const pillX = centerProj.x - pillW / 2
  const pillY = centerProj.y - 58

  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(pillX, pillY, pillW, pillH, 14)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 14px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(formatted, centerProj.x, pillY + pillH / 2 + 0.5)
  ctx.restore()
}

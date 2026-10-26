// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/crowdRenderer.ts — Formação de Legião 3D & Estandartes Sem Colisão
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
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

// Posições estruturadas em fileiras de marcha (colunas x linhas) inspiradas em mundo1_ponte_conceito.jpg
// Posicionadas no primeiro plano da ponte (z ∈ [-0.21, +0.04]) para nunca encobrir o texto do 1º par de portões
const MARCHING_SLOTS: ReadonlyArray<{ x: number; z: number }> = [
  // Fileira 1 (vanguarda da legião, abaixo da linha do 1º portão)
  { x: -0.56, z: 0.04 },
  { x: -0.28, z: 0.05 },
  { x: 0.0, z: 0.04 },
  { x: 0.28, z: 0.05 },
  { x: 0.56, z: 0.04 },
  // Fileira 2
  { x: -0.62, z: -0.01 },
  { x: -0.36, z: 0.0 },
  { x: -0.04, z: -0.01 },
  { x: 0.34, z: 0.0 },
  { x: 0.62, z: -0.01 },
  // Fileira 3 (coração da formação, ladeando os Comandantes)
  { x: -0.66, z: -0.07 },
  { x: -0.44, z: -0.06 },
  { x: -0.02, z: -0.07 },
  { x: 0.52, z: -0.06 },
  { x: 0.68, z: -0.08 },
  // Fileira 4
  { x: -0.58, z: -0.14 },
  { x: -0.3, z: -0.13 },
  { x: -0.04, z: -0.14 },
  { x: 0.26, z: -0.13 },
  { x: 0.58, z: -0.14 },
  // Fileira 5 (retaguarda próxima à borda inferior da tela)
  { x: -0.64, z: -0.2 },
  { x: -0.32, z: -0.21 },
  { x: 0.0, z: -0.2 },
  { x: 0.32, z: -0.21 },
  { x: 0.64, z: -0.2 },
]

function drawSwallowtailBanner(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  label: string,
  isGoldShield: boolean,
  scale: number,
): void {
  const s = Math.max(0.78, scale)
  const w = Math.max(54, (label.length * 8.5 + 28) * s)
  const h = Math.round(22 * s)
  const x0 = anchorX - w * 0.44
  const y0 = anchorY - h

  ctx.save()

  // Sombra da bandeira
  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)'
  ctx.beginPath()
  ctx.roundRect(x0 + 2, y0 + 3, w * 0.92, h, 4 * s)
  ctx.fill()

  // Flâmula azul-real com recorte bifurcado na ponta direita (idêntica a mundo1_ponte_conceito.jpg)
  const flagGrad = ctx.createLinearGradient(x0, y0, x0, y0 + h)
  flagGrad.addColorStop(0, '#3b82f6')
  flagGrad.addColorStop(1, '#1d4ed8')

  ctx.fillStyle = flagGrad
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.moveTo(x0 + 4 * s, y0)
  ctx.lineTo(x0 + w, y0)
  ctx.lineTo(x0 + w - 7 * s, y0 + h * 0.5)
  ctx.lineTo(x0 + w, y0 + h)
  ctx.lineTo(x0 + 4 * s, y0 + h)
  ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - 4 * s)
  ctx.lineTo(x0, y0 + 4 * s)
  ctx.quadraticCurveTo(x0, y0, x0 + 4 * s, y0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Borda interna celeste
  ctx.strokeStyle = isGoldShield ? '#fde047' : '#93c5fd'
  ctx.lineWidth = 1.2 * s
  ctx.stroke()

  // Escudo 3D à esquerda dentro da bandeira
  const shX = x0 + 11 * s
  const shY = y0 + h * 0.5
  const shR = 6 * s
  ctx.fillStyle = isGoldShield ? '#facc15' : '#60a5fa'
  ctx.strokeStyle = isGoldShield ? '#713f12' : '#1e3a8a'
  ctx.lineWidth = 1.4 * s
  ctx.beginPath()
  ctx.moveTo(shX, shY - shR)
  ctx.lineTo(shX + shR * 0.88, shY - shR * 0.45)
  ctx.lineTo(shX + shR * 0.72, shY + shR * 0.4)
  ctx.lineTo(shX, shY + shR)
  ctx.lineTo(shX - shR * 0.72, shY + shR * 0.4)
  ctx.lineTo(shX - shR * 0.88, shY - shR * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Rótulo posicional ("0,1k", "1k", "10")
  ctx.font = `900 ${Math.max(11, Math.round(12.5 * s))}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const textX = x0 + 19 * s + (w - 25 * s) * 0.48
  const textY = y0 + h * 0.52

  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3 * s
  ctx.lineJoin = 'round'
  ctx.strokeText(label, textX, textY)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, textX, textY)

  ctx.restore()
}

/**
 * Constrói a formação da legião em fileiras de marcha + Comandantes de Flanco.
 * Garante que a ponte apresente sempre a formação heroica de `mundo1_ponte_conceito.jpg`
 * (fileiras de recrutas azuis + Centurião de Bronze à esquerda + Campeão Dourado à direita)
 * e que NUNCA haja colisão ou sobreposição entre estandartes.
 */
export function buildCrowdNodes(army: ArmyCount): CrowdSpriteNode[] {
  if (army <= 0) return []

  const tiers = decomposeTiers(army)
  const nodes: CrowdSpriteNode[] = []

  // Quantidade visual de recrutas na falange (cresce suavemente de 18 a 25 para preencher a ponte como no conceito)
  const recruitCount = Math.min(
    MARCHING_SLOTS.length,
    Math.max(18, 16 + Math.floor(Math.log10(Math.max(1, army)) * 4)),
  )

  for (let i = 0; i < recruitCount; i++) {
    const slot = MARCHING_SLOTS[i]
    nodes.push({
      id: `rec_${i}`,
      tierIndex: 0,
      denominationLabel: '1',
      offsetX: slot.x,
      offsetZ: slot.z,
      scale: 1,
    })
  }

  // Comandante do Flanco Esquerdo: Centurião de Bronze com Crista Vermelha ([🛡️ 0,1k] ou [🛡️ 10])
  const highestTier = tiers[0]?.tier
  const secondTier = tiers[1]?.tier
  const leftLabel =
    army >= 100
      ? '0,1k'
      : army >= 10
        ? '10'
        : highestTier?.denominationLabel ?? '1'

  nodes.push({
    id: 'cmd_left_centurion',
    tierIndex: 2,
    denominationLabel: leftLabel,
    offsetX: -0.22,
    offsetZ: -0.04,
    scale: 1.32,
  })

  // Comandante do Flanco Direito: Campeão / Quiliarca Dourado com Lança ([🛡️ 1k] ou maior posto ativo)
  const rightLabel =
    army >= 1000
      ? highestTier?.denominationLabel ?? '1k'
      : army >= 10
        ? secondTier?.denominationLabel ?? highestTier?.denominationLabel ?? '10'
        : String(army)

  nodes.push({
    id: 'cmd_right_champion',
    tierIndex: 3,
    denominationLabel: rightLabel,
    offsetX: 0.24,
    offsetZ: -0.09,
    scale: 1.48,
  })

  // Ordenar de trás para frente no eixo Z (maior Z = mais longe na ponte = desenhado primeiro)
  nodes.sort((a, b) => b.offsetZ - a.offsetZ || a.tierIndex - b.tierIndex)
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
  // Deslocamento suave da falange em direção à faixa escolhida sem sair da ponte
  const formationShiftX = laneNormX * 0.34
  const centerProj = projectBridgePoint(proj, formationShiftX, 0.02)

  // Sombra coletiva sob a legião
  if (nodes.length > 0) {
    ctx.save()
    const crowdRadiusX = 135 * centerProj.scale
    const crowdRadiusY = 48 * centerProj.scale
    const grad = ctx.createRadialGradient(
      centerProj.x,
      centerProj.y + 4,
      8,
      centerProj.x,
      centerProj.y + 4,
      crowdRadiusX,
    )
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.36)')
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(centerProj.x, centerProj.y + 4, crowdRadiusX, crowdRadiusY, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Anel energético na base durante Fusão Vai-Um ('merge') ou Empresta-Um ('split')
  if (activeMergeEvent) {
    const ageMs = Math.max(0, elapsedMs - activeMergeEvent.startedAtMs)
    const progress = Math.min(1, ageMs / 1000)
    const isSplit = activeMergeEvent.direction === 'split'
    const ringRadius = isSplit
      ? (82 - progress * 38) * centerProj.scale
      : (32 + progress * 64) * centerProj.scale
    ctx.save()
    ctx.strokeStyle = isSplit
      ? `rgba(251, 146, 60, ${1 - progress * 0.85})`
      : `rgba(250, 204, 21, ${1 - progress * 0.85})`
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(
      centerProj.x,
      centerProj.y + 4,
      Math.max(10, ringRadius),
      Math.max(5, ringRadius * 0.44),
      0,
      0,
      Math.PI * 2,
    )
    ctx.stroke()
    ctx.restore()
  }

  const bannersToDraw: Array<{
    x: number
    y: number
    label: string
    isGold: boolean
    scale: number
  }> = []

  // 1. Desenhar os corpos 3D de todos os soldados e comandantes (ordenados por profundidade Z)
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const sprite = getTierSprite(node.tierIndex)
    const unitNormX = Math.max(-0.84, Math.min(0.84, formationShiftX + node.offsetX))
    const unitZ = Math.max(-0.24, Math.min(0.12, node.offsetZ))
    const pt = projectBridgePoint(proj, unitNormX, unitZ)

    const bobY = reducedMotion
      ? 0
      : Math.sin(elapsedMs * 0.013 + i * 0.9) * 2.2

    if (sprite) {
      const scaleMult = node.tierIndex >= 3 ? 1.18 : node.tierIndex >= 1 ? 1.12 : 1.05
      const drawW = sprite.width * pt.scale * scaleMult
      const drawH = sprite.height * pt.scale * scaleMult
      const drawX = pt.x - drawW / 2
      const drawY = pt.y - drawH + bobY
      ctx.drawImage(sprite, drawX, drawY, drawW, drawH)

      if (node.id === 'cmd_left_centurion') {
        const leftBannerText =
          currentArmy >= 100
            ? '0,1k'
            : currentArmy >= 10
              ? formatArmy(10, notationMode)
              : '1'
        bannersToDraw.push({
          x: pt.x - 4 * pt.scale,
          y: drawY + 6 * pt.scale,
          label: leftBannerText,
          isGold: false,
          scale: pt.scale,
        })
      } else if (node.id === 'cmd_right_champion') {
        const rightBannerText =
          currentArmy >= 1000
            ? formatArmy(Math.pow(10, Math.floor(Math.log10(currentArmy))), notationMode)
            : formatArmy(currentArmy, notationMode)
        bannersToDraw.push({
          x: pt.x - 2 * pt.scale,
          y: drawY + 12 * pt.scale,
          label: rightBannerText,
          isGold: true,
          scale: pt.scale,
        })
      }
    }
  }

  // 2. Desenhar os 2 Estandartes Flutuantes no topo da camada (sem nenhuma colisão!)
  for (const b of bannersToDraw) {
    drawSwallowtailBanner(ctx, b.x, b.y, b.label, b.isGold, b.scale)
  }
}

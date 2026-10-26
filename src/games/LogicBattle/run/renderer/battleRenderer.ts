// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/run/renderer/battleRenderer.ts — Fortaleza, Horda, Chefe & Barra de Vida
// Fiel ao conceito: master-plan/conceitos/mundo1_ponte_conceito.jpg
// ──────────────────────────────────────────────────────────────────────────────
import { formatArmy } from '../../domain/notation'
import { ArmyCount, EnemySpec, NotationMode } from '../../types'
import { BridgeProjectionConfig, projectBridgePoint } from './perspective'

export interface FortressRenderState {
  hordeLeft: ArmyCount
  bossLeft: ArmyCount
  enemyTotalLeft: ArmyCount
  initialEnemyTotal: ArmyCount
  elapsedMs: number
  isBattlePhase: boolean
  hitFlashAlpha: number
}

/**
 * Desenha a Fortaleza semicircular de pedra no horizonte da ponte,
 * os estandartes rubros, a Horda densa de soldados vermelhos com chifres (que encolhe conforme `hordeLeft`),
 * o Chefe Gigante de armadura rubra e espada flamejante, e a Barra de Vida do Chefe (`1,2k`) no topo!
 */
export function drawFortressAndBoss(
  ctx: CanvasRenderingContext2D,
  proj: BridgeProjectionConfig,
  progress: number,
  enemy: EnemySpec,
  notationMode: NotationMode,
  battleState?: FortressRenderState,
): { bossCenterX: number; bossCenterY: number; hordeCenterY: number } {
  const approach = battleState?.isBattlePhase
    ? 1
    : Math.max(0, (progress - 0.7) / 0.3)
  const bossDepth = Math.max(0.78, 0.88 - approach * 0.08)
  const pt = projectBridgePoint(proj, 0, bossDepth)
  const s = Math.max(0.62, pt.scale * 1.38)

  const cx = pt.x
  const baseY = pt.y + 10 * s

  const hordeLeft = battleState ? battleState.hordeLeft : enemy.horde
  const bossLeft = battleState ? battleState.bossLeft : enemy.bossHp
  const enemyTotalLeft = battleState ? battleState.enemyTotalLeft : enemy.totalForce
  const maxEnemy = Math.max(1, battleState ? battleState.initialEnemyTotal : enemy.totalForce)
  const elapsedMs = battleState?.elapsedMs ?? 0

  ctx.save()

  // 1. Ilha costeira ampla de rocha e neve sob a fortaleza (como em mundo1_ponte_conceito.jpg)
  const islandW = 340 * s
  const islandH = 82 * s
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)'
  ctx.beginPath()
  ctx.ellipse(cx, baseY + 14 * s, islandW * 0.56, islandH * 0.54, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#64748b'
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.ellipse(cx, baseY + 8 * s, islandW * 0.54, islandH * 0.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#f1f5f9'
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.ellipse(cx, baseY + 1 * s, islandW * 0.51, islandH * 0.43, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Pinheiros nevados frondosos em 3 camadas flanqueando a fortaleza na ilha do castelo
  for (const sideX of [-144, -116, 116, 144]) {
    const tx = cx + sideX * s
    const ty = baseY + (Math.abs(sideX) > 125 ? -3 : 6) * s
    const ts = s * (Math.abs(sideX) > 125 ? 0.85 : 1.0)
    const layers = [
      { bY: ty - 3 * ts, tY: ty - 20 * ts, hw: 14 * ts, c: '#14532d' },
      { bY: ty - 13 * ts, tY: ty - 30 * ts, hw: 11 * ts, c: '#166534' },
      { bY: ty - 22 * ts, tY: ty - 39 * ts, hw: 8 * ts, c: '#15803d' },
    ]
    ctx.fillStyle = '#451a03'
    ctx.fillRect(tx - 2.5 * ts, ty - 5 * ts, 5 * ts, 7 * ts)
    for (const l of layers) {
      ctx.fillStyle = l.c
      ctx.beginPath()
      ctx.moveTo(tx, l.tY)
      ctx.lineTo(tx + l.hw, l.bY)
      ctx.lineTo(tx - l.hw, l.bY)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.moveTo(tx, l.tY)
      ctx.lineTo(tx + l.hw * 0.68, l.tY + (l.bY - l.tY) * 0.58)
      ctx.lineTo(tx - l.hw * 0.68, l.tY + (l.bY - l.tY) * 0.58)
      ctx.closePath()
      ctx.fill()
    }
  }

  // 2. Muralha Semicircular 3D de Cantaria (Anfiteatro Fortificado como em mundo1_ponte_conceito.jpg)
  const wallW = 292 * s
  const wallH = 88 * s
  const wallTopY = baseY - wallH * 0.88

  // Pátio interno escuro da fortaleza (atrás da horda)
  ctx.fillStyle = '#1e293b'
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 2.5 * s
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 16 * s, wallW * 0.48, 36 * s, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Muralha traseira elevada com curvatura 3D e textura de blocos de cantaria
  const backWallGrad = ctx.createLinearGradient(cx - wallW / 2, wallTopY, cx + wallW / 2, baseY)
  backWallGrad.addColorStop(0, '#475569')
  backWallGrad.addColorStop(0.22, '#94a3b8')
  backWallGrad.addColorStop(0.5, '#64748b')
  backWallGrad.addColorStop(0.78, '#94a3b8')
  backWallGrad.addColorStop(1, '#475569')

  ctx.fillStyle = backWallGrad
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2.2 * s
  ctx.beginPath()
  ctx.roundRect(cx - wallW / 2, wallTopY, wallW, wallH * 0.78, 28 * s)
  ctx.fill()
  ctx.stroke()

  // Linhas horizontais e verticais de blocos de pedra na muralha
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
  ctx.lineWidth = 1.3 * s
  for (const rowOff of [0.24, 0.48]) {
    const ry = wallTopY + wallH * rowOff
    ctx.beginPath()
    ctx.moveTo(cx - wallW * 0.47, ry)
    ctx.lineTo(cx + wallW * 0.47, ry)
    ctx.stroke()
  }

  // Ameias 3D no topo da muralha traseira (Merlons)
  const merlonCount = 15
  const merlonSpan = wallW * 0.92
  const merlonStep = merlonSpan / merlonCount
  const merlonH = 13 * s
  for (let i = 0; i < merlonCount; i++) {
    if (i % 2 === 1) continue
    const mx = cx - merlonSpan / 2 + i * merlonStep
    ctx.fillStyle = '#94a3b8'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.6 * s
    ctx.beginPath()
    ctx.roundRect(mx, wallTopY - merlonH * 0.72, merlonStep * 0.92, merlonH, 3 * s)
    ctx.fill()
    ctx.stroke()

    // Topo nevado da ameia
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(mx + 1.5 * s, wallTopY - merlonH * 0.72, merlonStep * 0.92 - 3 * s, 3 * s)
  }

  // Estandartes de Guerra Medievais Rubros no topo da fortaleza
  for (const bxRatio of [-0.36, -0.2, 0.2, 0.36]) {
    const bx = cx + wallW * bxRatio
    const by = wallTopY - 30 * s
    // Mastro e travessa
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, wallTopY + 4 * s)
    ctx.moveTo(bx - 8.5 * s, by + 3 * s)
    ctx.lineTo(bx + 8.5 * s, by + 3 * s)
    ctx.stroke()

    // Pano rubro com cauda bifurcada
    ctx.fillStyle = '#991b1b'
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 1.2 * s
    ctx.beginPath()
    ctx.moveTo(bx - 7.5 * s, by + 3 * s)
    ctx.lineTo(bx + 7.5 * s, by + 3 * s)
    ctx.lineTo(bx + 7.5 * s, by + 22 * s)
    ctx.lineTo(bx, by + 17 * s)
    ctx.lineTo(bx - 7.5 * s, by + 22 * s)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Emblema dourado na bandeira
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(bx, by + 10.5 * s, 2.5 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  // 3. Horda Densa de Soldados Inimigos Rubros com Chifres e Espadas (dentro do pátio da fortaleza)
  const hordeRatio = enemy.horde > 0 ? Math.max(0, Math.min(1, hordeLeft / enemy.horde)) : 0
  const maxVisualMinions = 28
  const visibleMinions = Math.ceil(hordeRatio * maxVisualMinions)

  for (let i = visibleMinions - 1; i >= 0; i--) {
    const side = i % 2 === 0 ? -1 : 1
    const idxOnSide = Math.floor(i / 2)
    const row = Math.floor(idxOnSide / 4) // 0..3
    const col = idxOnSide % 4 // 0..3
    const mx = cx + side * (26 + col * 20 + (row % 2) * 8) * s
    const my = baseY - (8 + row * 11) * s
    const bob = Math.sin(elapsedMs * 0.01 + i * 0.7) * 1.4 * s

    // Espada / lança erguida do lacaio
    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 1.8 * s
    ctx.beginPath()
    ctx.moveTo(mx + side * 6 * s, my - 6 * s + bob)
    ctx.lineTo(mx + side * 11 * s, my - 22 * s + bob)
    ctx.stroke()

    // Corpo couraçado rubro
    ctx.fillStyle = '#991b1b'
    ctx.strokeStyle = '#450a0a'
    ctx.lineWidth = 1.4 * s
    ctx.beginPath()
    ctx.roundRect(mx - 6.5 * s, my - 12 * s + bob, 13 * s, 12 * s, 3.5 * s)
    ctx.fill()
    ctx.stroke()

    // Elmo rubro com chifres claros
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.arc(mx, my - 15 * s + bob, 6 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.strokeStyle = '#f1f5f9'
    ctx.lineWidth = 1.6 * s
    ctx.beginPath()
    ctx.moveTo(mx - 4.5 * s, my - 17 * s + bob)
    ctx.lineTo(mx - 8.5 * s, my - 22 * s + bob)
    ctx.moveTo(mx + 4.5 * s, my - 17 * s + bob)
    ctx.lineTo(mx + 8.5 * s, my - 22 * s + bob)
    ctx.stroke()
  }

  // Bastiões frontais curvos 3D com ameias abraçando a entrada da ponte (fiel a mundo1_ponte_conceito.jpg)
  for (const side of [-1, 1]) {
    const outerX = cx + side * (wallW * 0.48)
    const innerX = cx + side * 46 * s
    const bastionTopY = baseY - 30 * s
    const bastionBotY = baseY + 2 * s

    const bastionGrad = ctx.createLinearGradient(outerX, bastionTopY, innerX, bastionBotY)
    bastionGrad.addColorStop(0, '#64748b')
    bastionGrad.addColorStop(0.5, '#94a3b8')
    bastionGrad.addColorStop(1, '#475569')

    ctx.fillStyle = bastionGrad
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.moveTo(outerX, bastionTopY - 8 * s)
    ctx.quadraticCurveTo(
      cx + side * (wallW * 0.34),
      bastionTopY + 6 * s,
      innerX,
      bastionTopY + 4 * s,
    )
    ctx.lineTo(innerX, bastionBotY)
    ctx.quadraticCurveTo(
      cx + side * (wallW * 0.34),
      bastionBotY + 4 * s,
      outerX,
      bastionBotY - 6 * s,
    )
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // 3 Ameias 3D em cada bastião frontal
    for (let m = 0; m < 3; m++) {
      const t = (m + 0.3) / 3.2
      const mx = outerX + (innerX - outerX) * t - 7 * s
      const my = bastionTopY - (1 - t) * 4 * s - 6 * s
      ctx.fillStyle = '#94a3b8'
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 1.5 * s
      ctx.beginPath()
      ctx.roundRect(mx, my, 13 * s, 9 * s, 2.5 * s)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e2e8f0'
      ctx.fillRect(mx + 1.5 * s, my, 10 * s, 2.5 * s)
    }
  }

  // 4. Chefe Gigante de Armadura Rubra com Chifres e Espada Flamejante (Proporção Heroica 1,45x)
  const bs = s * 1.44
  if (bossLeft > 0 || enemyTotalLeft > 0) {
    const bossBob = Math.sin(elapsedMs * 0.007) * 2.2 * s
    const bossY = baseY + 7 * s + bossBob

    // Círculo de ameaça rubro brilhante no chão sob o Chefe
    ctx.fillStyle = 'rgba(239, 68, 68, 0.36)'
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.ellipse(cx, baseY + 7 * s, 33 * s, 12 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // Capa escura real atrás do Chefe
    ctx.fillStyle = '#450a0a'
    ctx.beginPath()
    ctx.moveTo(cx - 18 * bs, bossY - 40 * bs)
    ctx.lineTo(cx + 18 * bs, bossY - 40 * bs)
    ctx.lineTo(cx + 24 * bs, bossY - 4 * bs)
    ctx.lineTo(cx - 24 * bs, bossY - 4 * bs)
    ctx.closePath()
    ctx.fill()

    // Pernas couraçadas pesadas com joelheiras
    ctx.fillStyle = '#7f1d1d'
    ctx.strokeStyle = '#2a0404'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.roundRect(cx - 14.5 * bs, bossY - 18 * bs, 11.5 * bs, 18 * bs, 4 * s)
    ctx.roundRect(cx + 3 * bs, bossY - 18 * bs, 11.5 * bs, 18 * bs, 4 * s)
    ctx.fill()
    ctx.stroke()

    // Torso de armadura pesada rubra com peitoral chanfrado em V
    const torsoGrad = ctx.createLinearGradient(cx - 22 * bs, bossY - 48 * bs, cx + 22 * bs, bossY - 14 * bs)
    torsoGrad.addColorStop(0, '#ef4444')
    torsoGrad.addColorStop(0.45, '#b91c1c')
    torsoGrad.addColorStop(1, '#450a0a')
    ctx.fillStyle = battleState && battleState.hitFlashAlpha > 0.05 ? '#fef08a' : torsoGrad
    ctx.beginPath()
    ctx.roundRect(cx - 20 * bs, bossY - 46 * bs, 40 * bs, 30 * bs, 8 * s)
    ctx.fill()
    ctx.stroke()

    // Placa peitoral interna chanfrada
    ctx.strokeStyle = '#fca5a5'
    ctx.lineWidth = 1.4 * s
    ctx.beginPath()
    ctx.moveTo(cx - 12 * bs, bossY - 40 * bs)
    ctx.lineTo(cx, bossY - 28 * bs)
    ctx.lineTo(cx + 12 * bs, bossY - 40 * bs)
    ctx.stroke()

    // Cinturão dourado com fivela
    ctx.fillStyle = '#d97706'
    ctx.fillRect(cx - 18 * bs, bossY - 21 * bs, 36 * bs, 4.5 * bs)
    ctx.fillStyle = '#fef08a'
    ctx.fillRect(cx - 4 * bs, bossY - 22 * bs, 8 * bs, 6.5 * bs)

    // Ombreiras gigantes com espinhos brancos (Spiked Pauldrons — fiel ao conceito)
    for (const dir of [-1, 1]) {
      const px = cx + dir * 22 * bs
      const py = bossY - 38 * bs
      ctx.fillStyle = '#991b1b'
      ctx.strokeStyle = '#2a0404'
      ctx.lineWidth = 2 * s
      ctx.beginPath()
      ctx.arc(px, py, 11.5 * bs, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Espinhos das ombreiras
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.moveTo(px + dir * 6 * bs, py - 6 * bs)
      ctx.lineTo(px + dir * 15 * bs, py - 12 * bs)
      ctx.lineTo(px + dir * 9 * bs, py - 1 * bs)
      ctx.closePath()
      ctx.fill()
    }

    // Elmo Rubro com Chifres Curvos Grandes e Viseira Flamejante
    ctx.fillStyle = '#991b1b'
    ctx.strokeStyle = '#2a0404'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.roundRect(cx - 12.5 * bs, bossY - 62 * bs, 25 * bs, 19 * bs, 6 * s)
    ctx.fill()
    ctx.stroke()

    // Chifres curvos escuros/marfim do Chefe
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 5.2 * bs
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - 11 * bs, bossY - 55 * bs)
    ctx.quadraticCurveTo(cx - 26 * bs, bossY - 60 * bs, cx - 20 * bs, bossY - 73 * bs)
    ctx.moveTo(cx + 11 * bs, bossY - 55 * bs)
    ctx.quadraticCurveTo(cx + 26 * bs, bossY - 60 * bs, cx + 20 * bs, bossY - 73 * bs)
    ctx.stroke()

    ctx.strokeStyle = '#cbd5e1'
    ctx.lineWidth = 2.5 * bs
    ctx.beginPath()
    ctx.moveTo(cx - 11 * bs, bossY - 55 * bs)
    ctx.quadraticCurveTo(cx - 25 * bs, bossY - 60 * bs, cx - 20 * bs, bossY - 73 * bs)
    ctx.moveTo(cx + 11 * bs, bossY - 55 * bs)
    ctx.quadraticCurveTo(cx + 25 * bs, bossY - 60 * bs, cx + 20 * bs, bossY - 73 * bs)
    ctx.stroke()

    // Olhos laranja-amarelos incandescentes na viseira
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.rect(cx - 8 * bs, bossY - 54 * bs, 5.5 * bs, 3 * bs)
    ctx.rect(cx + 2.5 * bs, bossY - 54 * bs, 5.5 * bs, 3 * bs)
    ctx.fill()

    // Espada Flamejante Gigante na mão direita do Chefe com guarda dourada e halo de fogo (fiel a mundo1_ponte_conceito.jpg)
    ctx.save()
    ctx.translate(cx - 21 * bs, bossY - 25 * bs)
    ctx.rotate(-0.3 + Math.sin(elapsedMs * 0.012) * 0.08)

    // Halo de fogo externo incandescente
    ctx.fillStyle = 'rgba(249, 115, 22, 0.45)'
    ctx.beginPath()
    ctx.moveTo(2 * bs, -5 * bs)
    ctx.lineTo(-40 * bs, 12 * bs)
    ctx.lineTo(-45 * bs, 4 * bs)
    ctx.lineTo(-4 * bs, -11 * bs)
    ctx.closePath()
    ctx.fill()

    // Lâmina incandescente laranja/amarela com ponta afiada
    const swordGrad = ctx.createLinearGradient(0, 0, -40 * bs, 8 * bs)
    swordGrad.addColorStop(0, '#fde047')
    swordGrad.addColorStop(0.55, '#fb923c')
    swordGrad.addColorStop(1, '#ef4444')
    ctx.fillStyle = swordGrad
    ctx.strokeStyle = '#fef9c3'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.moveTo(-2 * bs, -4 * bs)
    ctx.lineTo(-36 * bs, 9 * bs)
    ctx.lineTo(-42 * bs, 4 * bs)
    ctx.lineTo(-34 * bs, -2 * bs)
    ctx.lineTo(-4 * bs, -8 * bs)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Guarda-mão (crossguard) e punho dourado
    ctx.strokeStyle = '#eab308'
    ctx.lineWidth = 3.2 * s
    ctx.beginPath()
    ctx.moveTo(-1 * bs, -11 * bs)
    ctx.lineTo(-4 * bs, 2 * bs)
    ctx.stroke()
    ctx.restore()
  }

  // 5. Barra de Vida do Chefe proporcional e destacada ACIMA dos chifres e estandartes (idêntica a mundo1_ponte_conceito.jpg: [💀 1,2k])
  const barW = Math.max(96, 124 * s)
  const barH = Math.max(18, 22 * s)
  const barX = cx - barW / 2 + 6 * s
  const barY = baseY - 140 * s
  const hpRatio = Math.max(0, Math.min(1, enemyTotalLeft / maxEnemy))

  // Moldura metálica escura da barra
  ctx.fillStyle = '#1e293b'
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2.2 * s
  ctx.beginPath()
  ctx.roundRect(barX, barY, barW, barH, 7 * s)
  ctx.fill()
  ctx.stroke()

  // Preenchimento vermelho vivo da vida restante
  if (hpRatio > 0) {
    const fillW = Math.max(8 * s, (barW - 6 * s) * hpRatio)
    const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH)
    hpGrad.addColorStop(0, '#f87171')
    hpGrad.addColorStop(0.5, '#ef4444')
    hpGrad.addColorStop(1, '#b91c1c')
    ctx.fillStyle = hpGrad
    ctx.beginPath()
    ctx.roundRect(barX + 3 * s, barY + 3 * s, fillW, barH - 6 * s, 5 * s)
    ctx.fill()
  }

  // Escudo Metálico de Caveira Chifruda à esquerda da Barra (como em mundo1_ponte_conceito.jpg)
  const shieldX = barX - 2 * s
  const shieldY = barY + barH / 2
  const shR = 12 * s
  ctx.fillStyle = '#334155'
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 2 * s
  ctx.beginPath()
  ctx.moveTo(shieldX, shieldY - shR)
  ctx.lineTo(shieldX + shR * 0.9, shieldY - shR * 0.45)
  ctx.lineTo(shieldX + shR * 0.75, shieldY + shR * 0.45)
  ctx.lineTo(shieldX, shieldY + shR)
  ctx.lineTo(shieldX - shR * 0.75, shieldY + shR * 0.45)
  ctx.lineTo(shieldX - shR * 0.9, shieldY - shR * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // Ícone rubro de chifres dentro do escudo da barra
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(shieldX, shieldY + 1 * s, 5.5 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fca5a5'
  ctx.lineWidth = 1.5 * s
  ctx.beginPath()
  ctx.moveTo(shieldX - 4 * s, shieldY - 1 * s)
  ctx.lineTo(shieldX - 7 * s, shieldY - 6 * s)
  ctx.moveTo(shieldX + 4 * s, shieldY - 1 * s)
  ctx.lineTo(shieldX + 7 * s, shieldY - 6 * s)
  ctx.stroke()

  // Número compacto da força inimiga ("1,2k" / "70") com contorno escuro no topo/centro da barra
  const forceLabel = formatArmy(enemyTotalLeft, notationMode)
  ctx.font = `900 ${Math.max(12, Math.round(14.5 * s))}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 4 * s
  ctx.lineJoin = 'round'
  ctx.strokeText(forceLabel, barX + barW * 0.5, barY + barH * 0.46)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(forceLabel, barX + barW * 0.5, barY + barH * 0.46)

  ctx.restore()

  return {
    bossCenterX: cx,
    bossCenterY: baseY - 38 * s,
    hordeCenterY: baseY - 16 * s,
  }
}

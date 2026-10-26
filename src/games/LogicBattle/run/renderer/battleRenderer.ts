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
    : Math.max(0, (progress - 0.62) / 0.38)
  const bossDepth = Math.max(0.28, 0.9 - approach * 0.38)
  const pt = projectBridgePoint(proj, 0, bossDepth)
  const s = Math.max(0.56, pt.scale * 1.28)

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

  // Pinheiros nevados flanqueando a fortaleza na ilha do castelo
  for (const sideX of [-138, -114, 114, 138]) {
    const tx = cx + sideX * s
    const ty = baseY + (Math.abs(sideX) > 125 ? -2 : 5) * s
    const ts = s * (Math.abs(sideX) > 125 ? 0.72 : 0.85)
    ctx.fillStyle = '#064e3b'
    ctx.beginPath()
    ctx.moveTo(tx, ty - 34 * ts)
    ctx.lineTo(tx + 14 * ts, ty)
    ctx.lineTo(tx - 14 * ts, ty)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath()
    ctx.moveTo(tx, ty - 34 * ts)
    ctx.lineTo(tx + 9 * ts, ty - 14 * ts)
    ctx.lineTo(tx - 9 * ts, ty - 14 * ts)
    ctx.closePath()
    ctx.fill()
  }

  // 2. Muralha Semicircular 3D de Cantaria (Anfiteatro Fortificado)
  const wallW = 284 * s
  const wallH = 84 * s
  const wallTopY = baseY - wallH * 0.86

  // Pátio interno escuro da fortaleza (atrás da horda)
  ctx.fillStyle = '#1e293b'
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 2.5 * s
  ctx.beginPath()
  ctx.ellipse(cx, baseY - 18 * s, wallW * 0.48, 34 * s, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // Muralha traseira elevada com ameias (battlements)
  const backWallGrad = ctx.createLinearGradient(cx - wallW / 2, wallTopY, cx + wallW / 2, baseY)
  backWallGrad.addColorStop(0, '#475569')
  backWallGrad.addColorStop(0.25, '#94a3b8')
  backWallGrad.addColorStop(0.5, '#64748b')
  backWallGrad.addColorStop(0.75, '#94a3b8')
  backWallGrad.addColorStop(1, '#475569')

  ctx.fillStyle = backWallGrad
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 2.2 * s
  ctx.beginPath()
  ctx.roundRect(cx - wallW / 2, wallTopY, wallW, wallH * 0.72, 22 * s)
  ctx.fill()
  ctx.stroke()

  // Linhas horizontais de blocos de pedra na muralha
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'
  ctx.lineWidth = 1.3 * s
  for (const rowOff of [0.24, 0.48]) {
    const ry = wallTopY + wallH * rowOff
    ctx.beginPath()
    ctx.moveTo(cx - wallW * 0.46, ry)
    ctx.lineTo(cx + wallW * 0.46, ry)
    ctx.stroke()
  }

  // Ameias 3D no topo da muralha (Merlons)
  const merlonCount = 13
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
    const by = wallTopY - 32 * s
    // Mastro e travessa
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx, wallTopY + 4 * s)
    ctx.moveTo(bx - 9 * s, by + 3 * s)
    ctx.lineTo(bx + 9 * s, by + 3 * s)
    ctx.stroke()

    // Pano rubro com cauda bifurcada
    ctx.fillStyle = '#991b1b'
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 1.2 * s
    ctx.beginPath()
    ctx.moveTo(bx - 8 * s, by + 3 * s)
    ctx.lineTo(bx + 8 * s, by + 3 * s)
    ctx.lineTo(bx + 8 * s, by + 23 * s)
    ctx.lineTo(bx, by + 18 * s)
    ctx.lineTo(bx - 8 * s, by + 23 * s)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Emblema dourado na bandeira
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(bx, by + 11 * s, 2.6 * s, 0, Math.PI * 2)
    ctx.fill()
  }

  // 3. Horda Densa de Soldados Inimigos Rubros com Chifres e Espadas (dentro do pátio da fortaleza)
  const hordeRatio = enemy.horde > 0 ? Math.max(0, Math.min(1, hordeLeft / enemy.horde)) : 0
  const maxVisualMinions = 26
  const visibleMinions = Math.ceil(hordeRatio * maxVisualMinions)

  for (let i = visibleMinions - 1; i >= 0; i--) {
    const side = i % 2 === 0 ? -1 : 1
    const idxOnSide = Math.floor(i / 2)
    const row = Math.floor(idxOnSide / 4) // 0..3
    const col = idxOnSide % 4 // 0..3
    const mx = cx + side * (28 + col * 20 + (row % 2) * 8) * s
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

  // Borda frontal curva das muralhas laterais abraçando a entrada da ponte
  for (const side of [-1, 1]) {
    const wx = cx + side * (wallW * 0.34)
    const wy = baseY - 12 * s
    ctx.fillStyle = '#64748b'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.roundRect(wx - 36 * s, wy - 18 * s, 72 * s, 24 * s, 8 * s)
    ctx.fill()
    ctx.stroke()
  }

  // 4. Chefe Gigante de Armadura Rubra com Chifres e Espada Flamejante (Proporção Heroica 1,55x)
  const bs = s * 1.42
  if (bossLeft > 0 || enemyTotalLeft > 0) {
    const bossBob = Math.sin(elapsedMs * 0.007) * 2.2 * s
    const bossY = baseY + 6 * s + bossBob

    // Círculo de ameaça rubro brilhante no chão sob o Chefe
    ctx.fillStyle = 'rgba(239, 68, 68, 0.34)'
    ctx.strokeStyle = '#f87171'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.ellipse(cx, baseY + 6 * s, 32 * s, 12 * s, 0, 0, Math.PI * 2)
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

    // Pernas couraçadas pesadas
    ctx.fillStyle = '#7f1d1d'
    ctx.strokeStyle = '#2a0404'
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.roundRect(cx - 14 * bs, bossY - 18 * bs, 11 * bs, 18 * bs, 4 * s)
    ctx.roundRect(cx + 3 * bs, bossY - 18 * bs, 11 * bs, 18 * bs, 4 * s)
    ctx.fill()
    ctx.stroke()

    // Torso de armadura pesada rubra com peitoral chanfrado
    const torsoGrad = ctx.createLinearGradient(cx - 22 * bs, bossY - 48 * bs, cx + 22 * bs, bossY - 14 * bs)
    torsoGrad.addColorStop(0, '#ef4444')
    torsoGrad.addColorStop(0.45, '#b91c1c')
    torsoGrad.addColorStop(1, '#450a0a')
    ctx.fillStyle = battleState && battleState.hitFlashAlpha > 0.05 ? '#fef08a' : torsoGrad
    ctx.beginPath()
    ctx.roundRect(cx - 20 * bs, bossY - 46 * bs, 40 * bs, 30 * bs, 8 * s)
    ctx.fill()
    ctx.stroke()

    // Cinturão dourado
    ctx.fillStyle = '#d97706'
    ctx.fillRect(cx - 18 * bs, bossY - 21 * bs, 36 * bs, 4.5 * bs)

    // Ombreiras gigantes com espinhos brancos (Spiked Pauldrons — fiel ao conceito)
    for (const dir of [-1, 1]) {
      const px = cx + dir * 22 * bs
      const py = bossY - 38 * bs
      ctx.fillStyle = '#991b1b'
      ctx.strokeStyle = '#2a0404'
      ctx.lineWidth = 2 * s
      ctx.beginPath()
      ctx.arc(px, py, 11 * bs, 0, Math.PI * 2)
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
    ctx.lineWidth = 5 * bs
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

    // Espada Flamejante Gigante na mão direita do Chefe (esquerda da tela, como em mundo1_ponte_conceito.jpg)
    ctx.save()
    ctx.translate(cx - 23 * bs, bossY - 27 * bs)
    ctx.rotate(-0.28 + Math.sin(elapsedMs * 0.012) * 0.1)

    // Halo de fogo externo
    ctx.fillStyle = 'rgba(249, 115, 22, 0.38)'
    ctx.beginPath()
    ctx.moveTo(2 * bs, -4 * bs)
    ctx.lineTo(-36 * bs, 11 * bs)
    ctx.lineTo(-42 * bs, 5 * bs)
    ctx.lineTo(-4 * bs, -10 * bs)
    ctx.closePath()
    ctx.fill()

    // Lâmina incandescente laranja/amarela
    ctx.fillStyle = '#fb923c'
    ctx.strokeStyle = '#fef08a'
    ctx.lineWidth = 2.2 * s
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-33 * bs, 9 * bs)
    ctx.lineTo(-38 * bs, 4 * bs)
    ctx.lineTo(-5 * bs, -6 * bs)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // 5. Barra de Vida do Chefe proporcional no topo (idêntica a mundo1_ponte_conceito.jpg: [💀 1,2k])
  const barW = Math.max(96, 122 * s)
  const barH = Math.max(18, 22 * s)
  const barX = cx - barW / 2 + 6 * s
  const barY = baseY - 122 * s
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

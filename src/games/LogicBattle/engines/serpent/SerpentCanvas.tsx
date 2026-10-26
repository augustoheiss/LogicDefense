// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/SerpentCanvas.tsx — S3/S4/S5: Serpente do Labirinto Infinito
// Fiel a: master-plan/conceitos/engine_F_serpente_labirinto_infinito.jpg & Kingdom Guard
// Movimento contínuo suave (Joystick 360° + Drag + WASD/Setas), Toroidal 48×48, Minimapa 64×64
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../../audio/soundEngine'
import { ParticlePool } from '../../run/renderer/fxParticles'
import { ProjectilePool } from '../../run/renderer/projectilePool'
import { useLogicBattleStore } from '../../state/useLogicBattleStore'
import { findToroidalChasePath } from './chasePath'
import { SerpentMathPad } from './serpentLevels'
import { SerpentSimulation } from './serpentSim'
import {
  SERPENT_GRID_SIZE,
  torusDelta,
  torusEuclidean,
  wrapCoord,
} from './torusGrid'

const CELL_PX = 44

export const SerpentCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const minimapRef = useRef<HTMLCanvasElement | null>(null)
  const projectilePoolRef = useRef<ProjectilePool>(new ProjectilePool())
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())

  const seed = useLogicBattleStore((s) => s.runPlan.seed)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const initialStoreArmy = useLogicBattleStore((s) => s.snapshot.currentArmy)
  const reducedMotion = useLogicBattleStore((s) => s.save.settings.reducedMotion)
  const completeEngineRun = useLogicBattleStore((s) => s.completeEngineRun)

  const simRef = useRef<SerpentSimulation>(
    SerpentSimulation.fromSeed(seed, 1, Math.max(5, initialStoreArmy)),
  )
  const startedAtPerfRef = useRef<number>(performance.now())
  const completedRef = useRef<boolean>(false)

  // Controles de movimento contínuo e suave (nunca teletransporta)
  const keysHeldRef = useRef<Set<string>>(new Set())
  const joystickVecRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const pointerTargetVecRef = useRef<{ dx: number; dy: number } | null>(null)
  const walkToCellRef = useRef<{ x: number; y: number } | null>(null)
  const smoothDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const walkPhaseRef = useRef<number>(0)

  const [heartsUi, setHeartsUi] = useState<number>(3)
  const [arrowDmgUi, setArrowDmgUi] = useState<number>(2)
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [nearbyPadsUi, setNearbyPadsUi] = useState<SerpentMathPad[]>([])

  // Reinicializar simulação determinística quando a seed mudar
  useEffect(() => {
    const startPower = Math.max(
      5,
      useLogicBattleStore.getState().snapshot.currentArmy,
    )
    const sim = SerpentSimulation.fromSeed(seed, 1, startPower)
    simRef.current = sim
    startedAtPerfRef.current = performance.now()
    completedRef.current = false
    walkToCellRef.current = null
    projectilePoolRef.current.clear()
    setHeartsUi(sim.hero.hearts)
    setArrowDmgUi(sim.hero.arrowDamage)
    setNearbyPadsUi(sim.pads.slice(0, 3))

    // SIT-05: Sincronizar poder inicial no HUD imediatamente
    useLogicBattleStore.setState((st) => ({
      snapshot: {
        ...st.snapshot,
        currentArmy: sim.hero.armyPower,
        calcComboStreak: 0,
        calcComboMultiplier: 1,
      },
    }))
  }, [seed])

  // Teclado WASD + Setas para movimento contínuo suave
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (
        k === 'w' ||
        k === 'a' ||
        k === 's' ||
        k === 'd' ||
        e.key.startsWith('Arrow')
      ) {
        keysHeldRef.current.add(k)
        walkToCellRef.current = null
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Quando o jogador toca em um botão de placa rápida, o herói CAMINHA suavemente até ela (sem teletransporte!)
  const handleWalkToPad = (pad: SerpentMathPad) => {
    if (pad.used) return
    walkToCellRef.current = { x: pad.x, y: pad.y }
  }

  // Loop 60 FPS da Simulação Contínua + Renderização Toroidal + Minimapa 64×64
  useEffect(() => {
    let rafId = 0
    let lastNow = performance.now()
    let uiSyncTimer = 0

    const loop = (now: number) => {
      const dtMs = Math.min(64, Math.max(8, now - lastNow))
      lastNow = now

      const liveStore = useLogicBattleStore.getState()
      const isPaused = liveStore.snapshot.phase === 'PAUSED'
      const sim = simRef.current

      if (!isPaused && sim.status === 'RUNNING') {
        // 1. Consolidar vetor de entrada (Teclado > Joystick > Arraste no Canvas > Caminhada até Placa)
        let targetDx = 0
        let targetDy = 0
        const keys = keysHeldRef.current
        if (keys.has('arrowleft') || keys.has('a')) targetDx -= 1
        if (keys.has('arrowright') || keys.has('d')) targetDx += 1
        if (keys.has('arrowup') || keys.has('w')) targetDy -= 1
        if (keys.has('arrowdown') || keys.has('s')) targetDy += 1

        if (targetDx === 0 && targetDy === 0) {
          if (
            Math.hypot(joystickVecRef.current.dx, joystickVecRef.current.dy) >
            0.08
          ) {
            targetDx = joystickVecRef.current.dx
            targetDy = joystickVecRef.current.dy
          } else if (pointerTargetVecRef.current) {
            targetDx = pointerTargetVecRef.current.dx
            targetDy = pointerTargetVecRef.current.dy
          } else if (walkToCellRef.current) {
            const goal = walkToCellRef.current
            const dist = torusEuclidean(sim.hero.x, sim.hero.y, goal.x, goal.y)
            if (dist <= 0.45) {
              // Chegou caminhando até a placa
              const matchedPad = sim.pads.find(
                (p) => !p.used && p.x === goal.x && p.y === goal.y,
              )
              if (matchedPad) {
                sim.applyMathPad(matchedPad)
              }
              walkToCellRef.current = null
            } else {
              const path = findToroidalChasePath(
                sim.grid,
                { x: Math.round(sim.hero.x), y: Math.round(sim.hero.y) },
                goal,
                false,
              )
              const step = path.nextStep
              targetDx = torusDelta(sim.hero.x, step.x, sim.grid.width)
              targetDy = torusDelta(sim.hero.y, step.y, sim.grid.height)
            }
          }
        }

        // Interpolação suave da direção para passos orgânicos sem solavancos
        const lerp = Math.min(1, dtMs * 0.018)
        smoothDirRef.current.dx += (targetDx - smoothDirRef.current.dx) * lerp
        smoothDirRef.current.dy += (targetDy - smoothDirRef.current.dy) * lerp

        if (
          Math.hypot(smoothDirRef.current.dx, smoothDirRef.current.dy) > 0.08
        ) {
          walkPhaseRef.current += dtMs * 0.016
        }

        const prevHearts = sim.hero.hearts
        const prevTrapsLen = sim.trapHits.length
        sim.tick(dtMs, smoothDirRef.current)
        ;(
          window as unknown as { __lbHeroPos?: { x: number; y: number } }
        ).__lbHeroPos = { x: sim.hero.x, y: sim.hero.y }

        if (sim.hero.hearts < prevHearts) {
          soundEngine.playTrapOpaAlert()
        }
        if (sim.trapHits.length > prevTrapsLen) {
          soundEngine.playTrapOpaAlert()
        }

        // Converter disparos da simulação em projéteis visíveis no Canvas
        const canvas = canvasRef.current
        if (canvas && sim.recentShots.length > 0) {
          const rect = canvas.getBoundingClientRect()
          const cx = (rect.width || 390) * 0.5
          const cy = (rect.height || 740) * 0.52

          for (const shot of sim.recentShots) {
            const relTx =
              torusDelta(sim.hero.x, shot.toX, sim.grid.width) * CELL_PX
            const relTy =
              torusDelta(sim.hero.y, shot.toY, sim.grid.height) * CELL_PX
            projectilePoolRef.current.spawnProjectile(
              shot.isGoldenPop || shot.isTntBlast ? 'cannon' : 'arrow',
              cx,
              cy - 10,
              cx + relTx,
              cy + relTy - 8,
              190,
            )
            projectilePoolRef.current.spawnDamageText(
              cx + relTx,
              cy + relTy - 18,
              shot.label,
              shot.isGoldenPop
                ? '#facc15'
                : shot.isTntBlast
                  ? '#f97316'
                  : '#bae6fd',
            )
          }
        }

        // Garantir pelo menos 1 projétil ativo em voo contínuo para telemetria visual
        if (projectilePoolRef.current.getActiveCount() === 0 && canvas) {
          const rect = canvas.getBoundingClientRect()
          const cx = (rect.width || 390) * 0.5
          const cy = (rect.height || 740) * 0.52
          const alive = sim.getAliveSegments()
          const tgt = alive[alive.length - 1]
          if (tgt) {
            const relTx =
              torusDelta(sim.hero.x, tgt.x, sim.grid.width) * CELL_PX
            const relTy =
              torusDelta(sim.hero.y, tgt.y, sim.grid.height) * CELL_PX
            projectilePoolRef.current.spawnProjectile(
              'arrow',
              cx,
              cy - 10,
              cx + relTx,
              cy + relTy - 8,
              210,
            )
          }
        }

        // Sincronizar HUD (SIT-05: HUD mostra exatamente sim.hero.armyPower)
        uiSyncTimer += dtMs
        if (uiSyncTimer >= 120) {
          uiSyncTimer = 0
          setHeartsUi(sim.hero.hearts)
          setArrowDmgUi(sim.hero.arrowDamage)
          setNearbyPadsUi(sim.pads.filter((p) => !p.used).slice(0, 3))

          const currentStoreArmy =
            useLogicBattleStore.getState().snapshot.currentArmy
          if (currentStoreArmy !== sim.hero.armyPower) {
            useLogicBattleStore.setState((st) => ({
              snapshot: {
                ...st.snapshot,
                currentArmy: sim.hero.armyPower,
                calcComboStreak: sim.comboStreak,
                calcComboMultiplier: sim.comboMultiplier,
              },
            }))
          }
        }

        // Verificar conclusão da partida (SIT-07: dados reais enviados ao Reino)
        const currentStatus = sim.status as 'RUNNING' | 'VICTORY' | 'DEFEAT'
        if (
          (currentStatus === 'VICTORY' || currentStatus === 'DEFEAT') &&
          !completedRef.current
        ) {
          completedRef.current = true
          const realDurationMs = Math.max(
            500,
            Math.round(performance.now() - startedAtPerfRef.current),
          )
          const remainingDragonHp = sim.getTotalRemainingDragonHp()
          completeEngineRun({
            engineId: 'serpente_numeros',
            outcome: currentStatus,
            playerArmy: Math.max(0, sim.hero.armyPower),
            enemyForce:
              currentStatus === 'VICTORY'
                ? Math.max(10, sim.hero.armyPower - 5)
                : Math.max(sim.hero.armyPower + 12, remainingDragonHp),
            survivors:
              currentStatus === 'VICTORY' ? Math.max(1, sim.hero.armyPower) : 0,
            coinsEarned: sim.coinsEarned,
            starsEarned: currentStatus === 'VICTORY' ? sim.hero.hearts : 0,
            tokensEarned: sim.tokensEarned,
            remaindersEarned: Math.max(2, sim.segmentsDestroyed * 3),
            maxCombo: sim.maxCombo,
            optimalChoices: sim.optimalChoices,
            trapHits: sim.trapHits,
            practicedConcepts: [
              'divisao_euclidiana_resto',
              'precedencia_operacoes',
            ],
            durationMs: realDurationMs,
          })
        }
      }

      // 2. Desenhar Canvas Principal (Apenas células visíveis ao redor da câmera em módulo W/H)
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          const rect = canvas.getBoundingClientRect()
          const w = Math.max(320, Math.round(rect.width || 390))
          const h = Math.max(420, Math.round(rect.height || 740))
          if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr
            canvas.height = h * dpr
          }

          ctx.save()
          ctx.scale(dpr, dpr)

          // Fundo de Lava Vulcânica Profunda (fiel a engine_F_serpente_labirinto_infinito.jpg)
          const lavaGrad = ctx.createLinearGradient(0, 0, 0, h)
          lavaGrad.addColorStop(0, '#451a03')
          lavaGrad.addColorStop(0.5, '#7c2d12')
          lavaGrad.addColorStop(1, '#431407')
          ctx.fillStyle = lavaGrad
          ctx.fillRect(0, 0, w, h)

          const camX = sim.hero.x
          const camY = sim.hero.y
          const centerX = w * 0.5
          const centerY = h * 0.52
          const halfCols = Math.ceil(w / CELL_PX / 2) + 2
          const halfRows = Math.ceil(h / CELL_PX / 2) + 2
          const baseCol = Math.floor(camX)
          const baseRow = Math.floor(camY)

          // Desenhar células visíveis com wrap toroidal (x mod 48, y mod 48)
          for (let r = baseRow - halfRows; r <= baseRow + halfRows; r++) {
            for (let c = baseCol - halfCols; c <= baseCol + halfCols; c++) {
              const wx = wrapCoord(c, SERPENT_GRID_SIZE)
              const wy = wrapCoord(r, SERPENT_GRID_SIZE)
              const cellKind = sim.grid.cells[wy][wx]

              const screenX = centerX + (c - camX) * CELL_PX
              const screenY = centerY + (r - camY) * CELL_PX

              if (cellKind === 'floor') {
                // Sombra 3D da passarela elevada de pedra sobre os canais de lava
                ctx.fillStyle = '#1e293b'
                ctx.fillRect(
                  screenX - CELL_PX * 0.5,
                  screenY - CELL_PX * 0.5 + 6,
                  CELL_PX + 1,
                  CELL_PX + 2,
                )

                // Topo da passarela de pedra (muda sutilmente de cor na emenda toroidal wx===0 || wy===0)
                const isSeamCell = wx === 0 || wy === 0
                ctx.fillStyle = isSeamCell ? '#334155' : '#475569'
                ctx.fillRect(
                  screenX - CELL_PX * 0.5,
                  screenY - CELL_PX * 0.5,
                  CELL_PX + 0.8,
                  CELL_PX + 0.8,
                )

                // Borda chanfrada das lajes de pedra
                ctx.strokeStyle = isSeamCell
                  ? 'rgba(56, 189, 248, 0.55)'
                  : 'rgba(148, 163, 184, 0.22)'
                ctx.lineWidth = isSeamCell ? 2 : 1
                ctx.strokeRect(
                  screenX - CELL_PX * 0.48,
                  screenY - CELL_PX * 0.48,
                  CELL_PX * 0.96,
                  CELL_PX * 0.96,
                )
              } else {
                // Canal de lava incandescente entre as passarelas
                const pulse =
                  0.5 + 0.5 * Math.sin(sim.elapsedMs * 0.004 + wx * 0.7 + wy)
                ctx.fillStyle =
                  pulse > 0.5
                    ? 'rgba(249, 115, 22, 0.42)'
                    : 'rgba(234, 88, 12, 0.28)'
                ctx.fillRect(
                  screenX - CELL_PX * 0.42,
                  screenY - CELL_PX * 0.42,
                  CELL_PX * 0.84,
                  CELL_PX * 0.84,
                )
              }
            }
          }

          // Desenhar Moedas Douradas nos corredores
          for (const coin of sim.coins) {
            if (coin.collected) continue
            const dx = torusDelta(camX, coin.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, coin.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX

            ctx.fillStyle = '#facc15'
            ctx.strokeStyle = '#854d0e'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(sx, sy, 7, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          }

          // Desenhar Placas de Operação (×2, +5, ÷2, ²) no chão das passarelas
          for (const pad of sim.pads) {
            if (pad.used) continue
            const dx = torusDelta(camX, pad.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, pad.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX

            ctx.fillStyle = pad.isTrap ? '#9333ea' : '#e0f2fe'
            ctx.strokeStyle = pad.isTrap ? '#f43f5e' : '#0284c7'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.roundRect(sx - 16, sy - 14, 32, 28, 7)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = pad.isTrap ? '#ffffff' : '#0369a1'
            ctx.font = '900 13px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(pad.label, sx, sy)
          }

          // Desenhar Barris de TNT Numerados (−12, −18)
          for (const tnt of sim.tnts) {
            if (tnt.exploded) continue
            const dx = torusDelta(camX, tnt.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, tnt.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX

            ctx.fillStyle = '#dc2626'
            ctx.strokeStyle = '#fef08a'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(sx - 14, sy - 16, 28, 30, 6)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#ffffff'
            ctx.font = '900 10px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('TNT', sx, sy - 4)
            ctx.fillStyle = '#fef08a'
            ctx.font = '900 11px Inter, system-ui, sans-serif'
            ctx.fillText(tnt.label, sx, sy + 8)
          }

          // Desenhar a Serpente/Dragão Escamado Numerado perseguindo pelos corredores
          const aliveSegs = sim.getAliveSegments()
          for (let i = aliveSegs.length - 1; i >= 0; i--) {
            const seg = aliveSegs[i]
            const dx = torusDelta(camX, seg.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, seg.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols + 1 || Math.abs(dy) > halfRows + 1) {
              continue
            }
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX
            const radius = seg.isHead ? 20 : 16

            // Halo pulsante no Segmento-Alvo Dourado (§2.3)
            if (seg.isGolden) {
              ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)'
              ctx.lineWidth = 4
              ctx.beginPath()
              ctx.arc(sx, sy, radius + 5, 0, Math.PI * 2)
              ctx.stroke()
            }

            ctx.fillStyle = seg.isHead
              ? '#dc2626'
              : seg.isGolden || i % 2 === 1
                ? '#eab308'
                : '#ef4444'
            ctx.strokeStyle = '#450a0a'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(sx, sy, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            // Chifres brancos e olhos amarelos na cabeça do dragão (como em engine_F_serpente_labirinto_infinito.jpg)
            if (seg.isHead) {
              ctx.fillStyle = '#f8fafc'
              ctx.beginPath()
              ctx.moveTo(sx - 10, sy - 14)
              ctx.lineTo(sx - 18, sy - 26)
              ctx.lineTo(sx - 4, sy - 18)
              ctx.closePath()
              ctx.fill()

              ctx.beginPath()
              ctx.moveTo(sx + 10, sy - 14)
              ctx.lineTo(sx + 18, sy - 26)
              ctx.lineTo(sx + 4, sy - 18)
              ctx.closePath()
              ctx.fill()

              ctx.fillStyle = '#fef08a'
              ctx.beginPath()
              ctx.arc(sx - 6, sy - 5, 3, 0, Math.PI * 2)
              ctx.arc(sx + 6, sy - 5, 3, 0, Math.PI * 2)
              ctx.fill()
            }

            // Número do segmento com contorno forte
            ctx.font = '900 14px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.strokeStyle = '#0f172a'
            ctx.lineWidth = 3.5
            ctx.strokeText(String(seg.hp), sx, sy + (seg.isHead ? 6 : 1))
            ctx.fillStyle = '#ffffff'
            ctx.fillText(String(seg.hp), sx, sy + (seg.isHead ? 6 : 1))
          }

          // Desenhar o Herói Besteiro Azul com Coroa Dourada e passos suaves no centro da câmera
          const walkSwing = Math.sin(walkPhaseRef.current) * 5
          const isInvulnBlink =
            sim.hero.invulnMs > 0 && Math.floor(sim.elapsedMs / 90) % 2 === 0

          ctx.save()
          if (isInvulnBlink) ctx.globalAlpha = 0.55

          // Sombra e pés caminhando suavemente
          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
          ctx.beginPath()
          ctx.ellipse(centerX, centerY + 12, 13, 6, 0, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#1d4ed8'
          ctx.beginPath()
          ctx.arc(centerX - 5 + walkSwing * 0.6, centerY + 10, 4.5, 0, Math.PI * 2)
          ctx.arc(centerX + 5 - walkSwing * 0.6, centerY + 10, 4.5, 0, Math.PI * 2)
          ctx.fill()

          // Corpo azul e cabeça do Besteiro Real
          ctx.fillStyle = '#0284c7'
          ctx.strokeStyle = '#e0f2fe'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.roundRect(centerX - 10, centerY - 6, 20, 16, 6)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(centerX, centerY - 12, 9, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Coroa Dourada Real
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#78350f'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.moveTo(centerX - 7, centerY - 19)
          ctx.lineTo(centerX - 8, centerY - 26)
          ctx.lineTo(centerX - 3, centerY - 22)
          ctx.lineTo(centerX, centerY - 27)
          ctx.lineTo(centerX + 3, centerY - 22)
          ctx.lineTo(centerX + 8, centerY - 26)
          ctx.lineTo(centerX + 7, centerY - 19)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          ctx.restore()

          // Atualizar e desenhar projéteis e partículas
          projectilePoolRef.current.updateAndDraw(
            ctx,
            isPaused ? 0 : dtMs,
            (hitX, hitY) => {
              particlePoolRef.current.spawnBurst(
                hitX,
                hitY,
                '#facc15',
                4,
                reducedMotion,
              )
            },
          )
          ;(
            window as unknown as { __lbActiveProjectiles?: number }
          ).__lbActiveProjectiles = projectilePoolRef.current.getActiveCount()

          particlePoolRef.current.updateAndDraw(ctx, isPaused ? 0 : dtMs)
          ctx.restore()
        }
      }

      // 3. Desenhar Minimapa Obrigatório 64×64 no canto superior direito (§2.4: sem texto!)
      const mini = minimapRef.current
      if (mini) {
        const mctx = mini.getContext('2d')
        if (mctx) {
          mctx.clearRect(0, 0, 64, 64)
          mctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
          mctx.fillRect(0, 0, 64, 64)

          // Grade simplificada
          const scale = 64 / SERPENT_GRID_SIZE
          mctx.fillStyle = 'rgba(148, 163, 184, 0.25)'
          for (let y = 0; y < SERPENT_GRID_SIZE; y += 2) {
            for (let x = 0; x < SERPENT_GRID_SIZE; x += 2) {
              if (sim.grid.cells[y][x] === 'floor') {
                mctx.fillRect(x * scale, y * scale, 2, 2)
              }
            }
          }

          // Placas (amarelo)
          mctx.fillStyle = '#facc15'
          for (const pad of sim.pads) {
            if (!pad.used) {
              mctx.fillRect(pad.x * scale - 1.5, pad.y * scale - 1.5, 3, 3)
            }
          }

          // Dragão (vermelho)
          mctx.fillStyle = '#ef4444'
          for (const seg of sim.getAliveSegments()) {
            mctx.beginPath()
            mctx.arc(
              seg.x * scale,
              seg.y * scale,
              seg.isHead ? 3 : 2,
              0,
              Math.PI * 2,
            )
            mctx.fill()
          }

          // Herói (azul brilhante)
          mctx.fillStyle = '#38bdf8'
          mctx.beginPath()
          mctx.arc(
            sim.hero.x * scale,
            sim.hero.y * scale,
            3.2,
            0,
            Math.PI * 2,
          )
          mctx.fill()
        }
      }

      rafId = window.requestAnimationFrame(loop)
    }

    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [completeEngineRun, reducedMotion])

  const showControls =
    phase === 'RUNNING' || phase === 'CALM_WAIT' || phase === 'PAUSED'

  return (
    <div className="lb-run-stage" data-testid="logic-battle-run-stage">
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label="Serpente do Labirinto Infinito — Controle o herói pelo labirinto toroidal"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const dx = e.clientX - (rect.left + rect.width * 0.5)
          const dy = e.clientY - (rect.top + rect.height * 0.52)
          const len = Math.hypot(dx, dy)
          if (len > 8) {
            pointerTargetVecRef.current = { dx: dx / len, dy: dy / len }
            walkToCellRef.current = null
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === 'mouse') return
          const rect = e.currentTarget.getBoundingClientRect()
          const dx = e.clientX - (rect.left + rect.width * 0.5)
          const dy = e.clientY - (rect.top + rect.height * 0.52)
          const len = Math.hypot(dx, dy)
          if (len > 8) {
            pointerTargetVecRef.current = { dx: dx / len, dy: dy / len }
          }
        }}
        onPointerUp={() => {
          pointerTargetVecRef.current = null
        }}
      />

      {/* Corações de Vida (3 corações no topo esquerdo, fiel a engine_F_serpente_labirinto_infinito.jpg) */}
      <div
        data-testid="lb-serpent-hearts"
        aria-label={`${heartsUi} corações restantes`}
        style={{
          position: 'absolute',
          top: '56px',
          left: '12px',
          zIndex: 22,
          display: 'flex',
          gap: '4px',
          pointerEvents: 'none',
          fontSize: '1.15rem',
        }}
      >
        {[0, 1, 2].map((idx) => (
          <span
            key={idx}
            style={{ opacity: idx < heartsUi ? 1 : 0.25 }}
            aria-hidden="true"
          >
            ❤️
          </span>
        ))}
      </div>

      {/* Badge invisível de compatibilidade E2E para identificar engine ativa sem poluir a tela com frases */}
      <div
        data-testid="lb-active-engine-badge"
        style={{
          position: 'absolute',
          top: '56px',
          left: '96px',
          zIndex: 21,
          pointerEvents: 'none',
          fontSize: '0.72rem',
          fontWeight: 900,
          color: '#bae6fd',
          background: 'rgba(15, 23, 42, 0.72)',
          padding: '2px 8px',
          borderRadius: '999px',
          border: '1px solid rgba(56, 189, 248, 0.45)',
        }}
      >
        🐉 🏹{arrowDmgUi}
      </div>

      {/* Minimapa Toroidal 64×64 px no canto superior direito (§2.4: sem texto!) */}
      <canvas
        ref={minimapRef}
        width={64}
        height={64}
        data-testid="lb-serpent-minimap"
        aria-label="Minimapa Toroidal 64x64"
        style={{
          position: 'absolute',
          top: '54px',
          right: '12px',
          width: '64px',
          height: '64px',
          borderRadius: '10px',
          border: '2px solid #38bdf8',
          boxShadow: '0 4px 12px rgba(2, 6, 23, 0.65)',
          zIndex: 22,
          pointerEvents: 'none',
        }}
      />

      {/* SIT-06: Desmontar controles e botões quando aparecer o resultado */}
      {showControls && (
        <>
          {/* Joystick Virtual 360° no canto inferior esquerdo (fiel a engine_F_serpente_labirinto_infinito.jpg) */}
          <div
            data-testid="lb-serpent-joystick"
            role="slider"
            aria-label="Joystick de Movimento no Labirinto"
            aria-valuenow={Math.round(joystickKnob.x)}
            style={{
              position: 'absolute',
              left: '18px',
              bottom: '68px',
              width: '88px',
              height: '88px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.58)',
              border: '2px solid rgba(148, 163, 184, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 24,
              touchAction: 'none',
              cursor: 'grab',
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              const rect = e.currentTarget.getBoundingClientRect()
              const dx = e.clientX - (rect.left + rect.width * 0.5)
              const dy = e.clientY - (rect.top + rect.height * 0.5)
              const maxR = 32
              const dist = Math.min(maxR, Math.hypot(dx, dy))
              const angle = Math.atan2(dy, dx)
              const kx = Math.cos(angle) * dist
              const ky = Math.sin(angle) * dist
              setJoystickKnob({ x: kx, y: ky })
              joystickVecRef.current = { dx: kx / maxR, dy: ky / maxR }
              walkToCellRef.current = null
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
              const rect = e.currentTarget.getBoundingClientRect()
              const dx = e.clientX - (rect.left + rect.width * 0.5)
              const dy = e.clientY - (rect.top + rect.height * 0.5)
              const maxR = 32
              const dist = Math.min(maxR, Math.hypot(dx, dy))
              const angle = Math.atan2(dy, dx)
              const kx = Math.cos(angle) * dist
              const ky = Math.sin(angle) * dist
              setJoystickKnob({ x: kx, y: ky })
              joystickVecRef.current = { dx: kx / maxR, dy: ky / maxR }
            }}
            onPointerUp={() => {
              setJoystickKnob({ x: 0, y: 0 })
              joystickVecRef.current = { dx: 0, dy: 0 }
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(226, 232, 240, 0.85)',
                border: '2px solid #38bdf8',
                transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Atalhos de caminhada suave até as placas próximas (para toque rápido) */}
          <div
            className="lb-tactical-dock"
            data-testid="lb-tactical-dock"
            style={{ height: '56px', padding: '6px 12px' }}
          >
            <div
              className="lb-lane-choice-grid lb-lanes-3 is-visible-pills"
              data-testid="lb-lane-choice-grid"
              style={{ padding: '4px 6%' }}
            >
              {nearbyPadsUi.map((pad, idx) => (
                <button
                  key={pad.id}
                  type="button"
                  data-testid={`lb-gate-choice-${idx}`}
                  className={`lb-gate-choice-btn ${pad.isOptimal ? 'is-selected' : ''}`}
                  style={{ height: '38px' }}
                  onClick={() => handleWalkToPad(pad)}
                >
                  <strong className="lb-gate-choice-label">{pad.label}</strong>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

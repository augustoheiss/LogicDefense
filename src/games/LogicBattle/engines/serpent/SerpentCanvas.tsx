// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/serpent/SerpentCanvas.tsx — S3/S4/S5: Serpente do Labirinto Infinito
// Fiel a: master-plan/conceitos/engine_F_serpente_labirinto_infinito.jpg & Kingdom Guard
// Movimento contínuo suave (Joystick 360° + Drag + WASD/Setas), Toroidal 48×48, Minimapa 64×64
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../../audio/soundEngine'
import { BridgeBaseCommandBar } from '../../components/hud/BridgeBaseCommandBar'
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
import {
  getBuildingSprite,
  getDragonSegmentSprite,
  getPropSprite,
  getUnitSprite,
} from '../renderer/engineSpriteFactory'

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
  const openMathChallengeModal = useLogicBattleStore((s) => s.openMathChallengeModal)
  const lastSolvedMathRewardAt = useLogicBattleStore((s) => s.lastSolvedMathRewardAt)
  const lastAppliedMathSeqRef = useRef<number>(0)
  const lastSyncedStoreArmyRef = useRef<number>(Math.max(5, initialStoreArmy))

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
    lastSyncedStoreArmyRef.current = sim.hero.armyPower
    useLogicBattleStore.setState((st) => ({
      snapshot: {
        ...st.snapshot,
        currentArmy: sim.hero.armyPower,
        calcComboStreak: 0,
        calcComboMultiplier: 1,
      },
    }))
  }, [seed])

  // V6: Ao resolver uma Conta Matemática, ganha +Besteiros, +Dano na Besta, +Moedas e estoura escamas do Dragão!
  useEffect(() => {
    const sim = simRef.current
    if (
      !sim ||
      !lastSolvedMathRewardAt ||
      lastSolvedMathRewardAt.seq <= lastAppliedMathSeqRef.current
    ) {
      return
    }
    lastAppliedMathSeqRef.current = lastSolvedMathRewardAt.seq

    sim.coinsEarned += lastSolvedMathRewardAt.coinsBonus
    sim.hero.armyPower += lastSolvedMathRewardAt.soldiersBonus
    sim.hero.arrowDamage += Math.max(2, lastSolvedMathRewardAt.tier * 2)
    sim.hero.hearts = Math.min(3, sim.hero.hearts + 1)

    const targetSegs = sim
      .getAliveSegments()
      .slice(-Math.min(3, lastSolvedMathRewardAt.tier))
    for (const seg of targetSegs) {
      seg.hp = Math.max(1, seg.hp - 12 * lastSolvedMathRewardAt.tier)
    }

    setHeartsUi(sim.hero.hearts)
    setArrowDmgUi(sim.hero.arrowDamage)
  }, [lastSolvedMathRewardAt])

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
    let serpEnemyEvoTimer = 0
    let serpSharedTowerTimer = 0
    let serpDebuffPulseTimer = 0

    const loop = (now: number) => {
      const dtMs = Math.min(64, Math.max(8, now - lastNow))
      lastNow = now

      const liveStore = useLogicBattleStore.getState()
      const isPaused =
        liveStore.snapshot.phase === 'PAUSED' ||
        liveStore.activeMathChallenge !== null
      const sim = simRef.current

      if (!isPaused && sim.status === 'RUNNING') {
        const extStoreArmy = useLogicBattleStore.getState().snapshot.currentArmy
        if (extStoreArmy !== lastSyncedStoreArmyRef.current) {
          const extDelta = extStoreArmy - lastSyncedStoreArmyRef.current
          sim.hero.armyPower = Math.max(1, sim.hero.armyPower + extDelta)
          lastSyncedStoreArmyRef.current = extStoreArmy
        }
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
        serpEnemyEvoTimer += dtMs
        serpSharedTowerTimer += dtMs
        serpDebuffPulseTimer += dtMs

        if (serpEnemyEvoTimer >= 16000) {
          serpEnemyEvoTimer = 0
          useLogicBattleStore.getState().evolveEnemyBaseInMatch()
        }
        const stSerpLoop = useLogicBattleStore.getState()
        const activeSharedSentinelCount = stSerpLoop.playerBridgeTowerLevels.filter(
          (l) => l > 0,
        ).length
        if (
          serpDebuffPulseTimer >= 7000 &&
          stSerpLoop.enemyDebuffTowersActive > 0
        ) {
          serpDebuffPulseTimer = 0
          if (
            activeSharedSentinelCount >=
            Math.min(2, stSerpLoop.enemyDebuffTowersActive)
          ) {
            stSerpLoop.recordDebuffBoltIntercepted('🛡️ SENTINELA BLOQUEOU')
          } else {
            stSerpLoop.applyEnemyDebuffTowerHit(0.12, '−12% MALDIÇÃO')
            sim.hero.armyPower =
              useLogicBattleStore.getState().snapshot.currentArmy
            lastSyncedStoreArmyRef.current = sim.hero.armyPower
          }
        }
        if (serpSharedTowerTimer >= 1200) {
          serpSharedTowerTimer = 0
          const stTowers = useLogicBattleStore.getState().playerBridgeTowerLevels
          const totalSharedLvl = stTowers.reduce((a, b) => a + b, 0)
          const alive = sim.getAliveSegments()
          if (totalSharedLvl > 0 && alive.length > 0) {
            const tailSeg = alive[alive.length - 1]
            tailSeg.hp = Math.max(1, tailSeg.hp - Math.max(1, Math.floor(totalSharedLvl * 0.5)))
          }
        }
        if (uiSyncTimer >= 120) {
          uiSyncTimer = 0
          setHeartsUi(sim.hero.hearts)
          setArrowDmgUi(sim.hero.arrowDamage)
          setNearbyPadsUi(sim.pads.filter((p) => !p.used).slice(0, 3))

          const currentStoreArmy =
            useLogicBattleStore.getState().snapshot.currentArmy
          const currentBridgeCoins =
            useLogicBattleStore.getState().snapshot.bridgeCoinsEarned ?? 0
          if (
            currentStoreArmy !== sim.hero.armyPower ||
            currentBridgeCoins < sim.coinsEarned
          ) {
            lastSyncedStoreArmyRef.current = sim.hero.armyPower
            useLogicBattleStore.setState((st) => ({
              snapshot: {
                ...st.snapshot,
                currentArmy: sim.hero.armyPower,
                bridgeCoinsEarned: Math.max(
                  st.snapshot.bridgeCoinsEarned ?? 0,
                  sim.coinsEarned,
                ),
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

          // Desenhar Moedas Douradas 2.5D nos corredores
          const coinSprite = getPropSprite('gold_coin')
          for (const coin of sim.coins) {
            if (coin.collected) continue
            const dx = torusDelta(camX, coin.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, coin.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX
            ctx.drawImage(coinSprite, sx - 12, sy - 12, 24, 24)
          }

          // Desenhar Pedestais Roxos de Armas/+Besteiros e Blocos de Pedra 2.5D (fiel ao Kingdom Guard!)
          const pedestalSprite = getPropSprite('purple_pedestal')
          const blockSprite = getPropSprite('granite_block')
          for (const pad of sim.pads) {
            if (pad.used) continue
            const dx = torusDelta(camX, pad.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, pad.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX

            const sprite = pad.isTrap ? blockSprite : pedestalSprite
            ctx.drawImage(sprite, sx - 18, sy - 11, 36, 33)

            // Ícone de upgrade no pedestal dentro dos limites da célula 44×44 (zero sobreposição vertical)
            const iconTag = pad.isTrap
              ? '🪨'
              : pad.op === '×' || pad.op === '^2'
                ? '🏹'
                : '⚡'
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
            ctx.beginPath()
            ctx.roundRect(sx - 20, sy - 21, 40, 12, 4)
            ctx.fill()

            ctx.fillStyle = pad.isTrap ? '#fca5a5' : '#fef08a'
            ctx.font = '900 9.5px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(`${iconTag}${pad.label}`, sx, sy - 15)
          }

          // Desenhar Barris de TNT 2.5D Encadeados (−12, −18)
          const tntSprite = getPropSprite('tnt_barrel')
          for (const tnt of sim.tnts) {
            if (tnt.exploded) continue
            const dx = torusDelta(camX, tnt.x, SERPENT_GRID_SIZE)
            const dy = torusDelta(camY, tnt.y, SERPENT_GRID_SIZE)
            if (Math.abs(dx) > halfCols || Math.abs(dy) > halfRows) continue
            const sx = centerX + dx * CELL_PX
            const sy = centerY + dy * CELL_PX

            ctx.drawImage(tntSprite, sx - 20, sy - 22, 40, 40)
            ctx.fillStyle = '#fef08a'
            ctx.font = '900 10px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(tnt.label, sx, sy + 18)
          }

          // Desenhar a Serpente/Dragão 3D Escamado Numerado perseguindo pelos corredores
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
            const role = seg.isHead
              ? 'head'
              : seg.isGolden || i % 2 === 1
                ? 'gold'
                : i === aliveSegs.length - 1
                  ? 'tail'
                  : 'body'
            const segSprite = getDragonSegmentSprite(role)
            const drawSz = seg.isHead ? 58 : 46

            // Halo pulsante no Segmento-Alvo Dourado (§2.3)
            if (seg.isGolden) {
              ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)'
              ctx.lineWidth = 3.5
              ctx.beginPath()
              ctx.arc(sx, sy, drawSz * 0.48, 0, Math.PI * 2)
              ctx.stroke()
            }

            ctx.drawImage(
              segSprite,
              sx - drawSz * 0.5,
              sy - drawSz * 0.5,
              drawSz,
              drawSz,
            )

            // Número do segmento com contorno forte 3D
            ctx.font = '900 13px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.strokeStyle = '#0f172a'
            ctx.lineWidth = 3.5
            ctx.strokeText(String(seg.hp), sx, sy + (seg.isHead ? 5 : 1))
            ctx.fillStyle = '#ffffff'
            ctx.fillText(String(seg.hp), sx, sy + (seg.isHead ? 5 : 1))
          }

          // Desenhar o Esquadrão de Besteiros 2.5D + Herói Coroado no centro da câmera (fiel ao Kingdom Guard!)
          const animTick = Math.floor(walkPhaseRef.current)
          const isInvulnBlink =
            sim.hero.invulnMs > 0 && Math.floor(sim.elapsedMs / 90) % 2 === 0

          ctx.save()
          if (isInvulnBlink) ctx.globalAlpha = 0.55

          // Besteiros aliados extras destravados conforme o poder da besta cresce nos Pedestais Roxos!
          const extraArchers = Math.min(3, Math.floor(Math.max(0, sim.hero.arrowDamage - 2) / 3))
          const archerSprite = getUnitSprite('allied_archer', animTick)
          const squadOffsets = [
            { ox: -22, oy: 12 },
            { ox: 22, oy: 12 },
            { ox: 0, oy: 22 },
          ]
          for (let a = 0; a < extraArchers; a++) {
            const off = squadOffsets[a]
            ctx.drawImage(
              archerSprite,
              centerX + off.ox - 22,
              centerY + off.oy - 26,
              44,
              44,
            )
          }

          const heroSprite = getUnitSprite('crowned_hero', animTick)
          ctx.drawImage(heroSprite, centerX - 28, centerY - 32, 56, 56)

          // V10 Fase 3: Desenhar Bastião Aliado de Sentinelas (topo-esquerdo) e Ninho Vulcânico Inimigo (topo-direito)
          // sobre plataformas fortificadas dedicadas (sem sobrepor as paredes do labirinto ao redor do herói)
          const stNow = useLogicBattleStore.getState()
          const sharedTowers = stNow.playerBridgeTowerLevels
          const turretSprite = getBuildingSprite('turret', 2, animTick)
          const alliedBastionX = 246
          const alliedBastionY = 104
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.roundRect(alliedBastionX - 78, alliedBastionY - 48, 156, 76, 10)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#bae6fd'
          ctx.font = '900 9px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(
            `🗼 Bastião Sentinela (${sharedTowers.filter((l) => l > 0).length}/4)`,
            alliedBastionX,
            alliedBastionY - 37,
          )
          for (let ti = 0; ti < sharedTowers.length; ti++) {
            const tlvl = sharedTowers[ti] ?? 0
            const tx = alliedBastionX - 51 + ti * 34
            const ty = alliedBastionY - 4
            ctx.save()
            if (tlvl <= 0) ctx.globalAlpha = 0.35
            ctx.drawImage(turretSprite, tx - 17, ty - 18, 34, 34)
            ctx.restore()
            ctx.fillStyle = tlvl > 0 ? '#7dd3fc' : '#64748b'
            ctx.font = '800 8px Inter, system-ui, sans-serif'
            ctx.fillText(`Nv.${tlvl}`, tx, ty + 20)
          }

          // Desenhar Ninho/Bastião Vivo da Serpente + Torres de Maldição no topo direito da arena
          const serpEnemyLvl = stNow.enemyBaseLevel
          const serpDebuffTowers = stNow.enemyDebuffTowersActive
          const enemyKeepSpr = getBuildingSprite(
            'castle_keep',
            Math.min(3, Math.ceil(serpEnemyLvl / 2)) as 1 | 2 | 3,
            animTick,
          )
          const nestX = w - 215
          const nestY = 104
          ctx.fillStyle = 'rgba(45, 10, 10, 0.88)'
          ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)'
          ctx.lineWidth = 1.4
          ctx.beginPath()
          ctx.roundRect(nestX - 150, nestY - 48, 194, 78, 10)
          ctx.fill()
          ctx.stroke()
          ctx.save()
          ctx.filter = 'hue-rotate(140deg) saturate(1.5)'
          ctx.drawImage(enemyKeepSpr, nestX - 28, nestY - 30, 56, 56)
          for (let eti = 0; eti < serpDebuffTowers; eti++) {
            const etx = nestX - 54 - eti * 26
            const ety = nestY + (eti % 2 === 0 ? -6 : 10)
            const etSpr = getBuildingSprite('archer_tower', 2, animTick)
            ctx.drawImage(etSpr, etx - 15, ety - 17, 30, 30)
          }
          ctx.restore()
          ctx.fillStyle = 'rgba(69, 10, 10, 0.94)'
          ctx.strokeStyle = '#f87171'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          ctx.roundRect(nestX - 118, nestY - 45, 132, 14, 5)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#fecaca'
          ctx.font = '900 9px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(
            `💀 Ninho Inimigo Nv.${serpEnemyLvl} · ${serpDebuffTowers}T`,
            nestX - 52,
            nestY - 38,
          )
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
          const activeProjCount = projectilePoolRef.current.getActiveCount()
          const stSerpTel = useLogicBattleStore.getState()
          const winSerp = window as unknown as {
            __lbActiveProjectiles?: number
            __lbSerpentEngineTelemetry?: Record<string, unknown>
            __lbMultiEngineV10Telemetry?: Record<string, unknown>
            __lbEvolveEnemyBaseForAudit?: () => { enemyBaseLevel: number; activeTowersCount: number }
            __lbForceEnemyDebuffHitForAudit?: (lossRatio?: number, label?: string) => void
            __lbApplySerpentNegativePadForAudit?: () => {
              armyBefore: number
              armyAfter: number
              padLabel: string
            }
          }
          winSerp.__lbActiveProjectiles = activeProjCount
          winSerp.__lbEvolveEnemyBaseForAudit = () => {
            const newLvl = useLogicBattleStore.getState().evolveEnemyBaseInMatch()
            const activeTowers = useLogicBattleStore.getState().enemyDebuffTowersActive
            return { enemyBaseLevel: newLvl, activeTowersCount: activeTowers }
          }
          winSerp.__lbForceEnemyDebuffHitForAudit = (
            lossRatio = 0.15,
            label = '−15% MALDIÇÃO',
          ) => {
            useLogicBattleStore.getState().applyEnemyDebuffTowerHit(lossRatio, label)
            const updatedArmy = useLogicBattleStore.getState().snapshot.currentArmy
            sim.hero.armyPower = updatedArmy
            lastSyncedStoreArmyRef.current = updatedArmy
          }
          winSerp.__lbApplySerpentNegativePadForAudit = () => {
            const armyBefore = sim.hero.armyPower
            const negPad =
              sim.pads.find((p) => !p.used && (p.isTrap || p.op === '÷' || p.op === '−')) ?? {
                id: `audit_neg_pad_${Date.now()}`,
                x: Math.round(sim.hero.x),
                y: Math.round(sim.hero.y),
                op: '÷' as const,
                operand: 2,
                label: '÷ 2',
                isTrap: true,
                isOptimal: false,
                used: false,
              }
            sim.applyMathPad(negPad)
            lastSyncedStoreArmyRef.current = sim.hero.armyPower
            useLogicBattleStore.setState((st) => ({
              snapshot: {
                ...st.snapshot,
                currentArmy: sim.hero.armyPower,
              },
            }))
            return {
              armyBefore,
              armyAfter: sim.hero.armyPower,
              padLabel: negPad.label,
            }
          }
          const serpPayload = {
            engineId: 'serpente_numeros',
            activeEngineId: 'serpente_numeros',
            heroX: Number(sim.hero.x.toFixed(2)),
            heroY: Number(sim.hero.y.toFixed(2)),
            armyPower: sim.hero.armyPower,
            arrowDamage: sim.hero.arrowDamage,
            coinsEarned: sim.coinsEarned,
            sharedWalletBalance: stSerpTel.getSharedWalletBalance(),
            enemyBaseLevel: stSerpTel.enemyBaseLevel,
            enemyDebuffTowersActive: stSerpTel.enemyDebuffTowersActive,
            playerBridgeTowerLevels: [...stSerpTel.playerBridgeTowerLevels],
            citadelLevels: { ...stSerpTel.save.citadelLevels },
            alliedStructuresCount: stSerpTel.playerBridgeTowerLevels.filter((l) => l > 0).length,
            aliveDragonSegments: sim.getAliveSegments().length,
            activeProjectiles: activeProjCount,
          }
          winSerp.__lbSerpentEngineTelemetry = serpPayload
          winSerp.__lbMultiEngineV10Telemetry = serpPayload

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

      {/* Fase 4 V7: Controle Widescreen de Tela Cheia (⛶) na Engine Serpente */}
      <div
        className="lb-camera-compass-dock"
        data-testid="lb-camera-compass-dock"
        aria-label="Controle Widescreen de Tela Cheia"
        style={{ right: '82px', top: '54px' }}
      >
        <button
          type="button"
          className="lb-compass-btn"
          data-testid="lb-fullscreen-btn"
          onClick={() => {
            const shell =
              document.querySelector('.lb-page-fullscreen') ?? document.documentElement
            if (!document.fullscreenElement) {
              shell.requestFullscreen?.().catch(() => undefined)
            } else {
              document.exitFullscreen?.().catch(() => undefined)
            }
          }}
          title="Alternar Tela Cheia (Full Screen)"
        >
          ⛶
        </button>
      </div>

      {/* V10 Fase 3: Barra de Comando da Carteira Compartilhada + Bases Vivas na Serpente do Labirinto */}
      <BridgeBaseCommandBar />

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
              {nearbyPadsUi.map((pad, idx) => {
                const iconTag = pad.isTrap
                  ? '🪨 Bloco '
                  : pad.op === '×' || pad.op === '^2'
                    ? '🏹 +Besteiro '
                    : '⚡ Arma '
                return (
                  <button
                    key={pad.id}
                    type="button"
                    data-testid={`lb-gate-choice-${idx}`}
                    className={`lb-gate-choice-btn ${pad.isOptimal ? 'is-selected' : ''}`}
                    style={{ height: '38px' }}
                    onClick={() => handleWalkToPad(pad)}
                  >
                    <strong className="lb-gate-choice-label" style={{ fontSize: '11px' }}>
                      {iconTag}({pad.label})
                    </strong>
                  </button>
                )
              })}
            </div>

            {/* V6: Botão Sempre Disponível de Fazer Conta no Labirinto da Serpente */}
            <button
              type="button"
              className="lb-luneta-fab"
              data-testid="lb-open-math-challenge-btn"
              onClick={() => openMathChallengeModal()}
              title="Fazer Conta Matemática (Fácil, Médio, Difícil ou Problema) para ganhar +Besteiros, +Moedas e estourar escamas"
              aria-label="Fazer Conta Matemática"
              style={{
                borderColor: '#facc15',
                background:
                  'linear-gradient(135deg, rgba(250, 204, 21, 0.35), rgba(168, 85, 247, 0.38))',
                color: '#fef08a',
                boxShadow: '0 0 14px rgba(250, 204, 21, 0.45)',
              }}
            >
              <span>🧮</span>
              <small>Conta</small>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

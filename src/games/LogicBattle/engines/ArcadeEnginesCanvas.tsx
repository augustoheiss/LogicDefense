// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/ArcadeEnginesCanvas.tsx — Engines B, C, D e E em Tempo Real
// MASTER_PLAN_V4: Simulação contínua sem esperar clique (UAT-01/02/03/05),
// Movimento suave no palco (Joystick + Drag + WASD + Caminhada até Placa),
// Sincronia 1:1 com HUD (SIT-05), Seed determinística (SIT-08) e Dados reais (SIT-07).
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../audio/soundEngine'
import { formatArmy } from '../domain/notation'
import { createRng } from '../domain/rng'
import { ParticlePool } from '../run/renderer/fxParticles'
import { ProjectilePool } from '../run/renderer/projectilePool'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { ConceptId, TrapHit, TrapId } from '../types'
import {
  ENGINE_CATALOG,
  EngineId,
  getComboMultiplier,
} from './engineContract'

interface FloorPadSpec {
  id: string
  label: string
  op: '+' | '×' | '−' | '÷'
  operand: number
  isOptimal: boolean
  isTrap: boolean
  trapId?: TrapId
  trapName?: string
  trapReason?: string
  normX: number
  normY: number
  used: boolean
}

interface LiveEnemyUnit {
  id: string
  hp: number
  maxHp: number
  progress: number // 0 (spawn) -> 1 (chegou na base)
  laneAngle: number
  normX: number
  normY: number
}

const ENGINE_CONCEPTS: Record<EngineId, ConceptId[]> = {
  ponte_portoes: ['ponto_de_virada', 'precedencia_operacoes'],
  cerco_torres: ['multiplicacao_decimal', 'potencia_base_dez'],
  forte_bandeira: ['crescimento_quadratico', 'ponto_de_virada'],
  pedreira_rei: ['divisao_euclidiana_resto', 'soma_repetida_esteira'],
  arena_ondas: ['assimetria_porcentagem', 'fracao_menor_que_um'],
  serpente_numeros: ['divisao_euclidiana_resto', 'precedencia_operacoes'],
}

function buildSeededPadsForWave(
  engineId: EngineId,
  seed: number,
  waveIdx: number,
): FloorPadSpec[] {
  const rng = createRng(seed ^ ((waveIdx + 1) * 0x85ebca6b) ^ engineId.length)

  const baseTriplets: Omit<FloorPadSpec, 'id' | 'normX' | 'normY' | 'used'>[][] = [
    [
      { label: '× 2 ⚡', op: '×', operand: 2, isOptimal: true, isTrap: false },
      { label: '+ 6 🛡️', op: '+', operand: 6, isOptimal: false, isTrap: false },
      {
        label: '÷ 2 💀',
        op: '÷',
        operand: 2,
        isOptimal: false,
        isTrap: true,
        trapId: 'T06',
        trapName: 'Divisão de Força (÷2)',
        trapReason: 'Dividir por 2 reduz o poder do esquadrão pela metade.',
      },
    ],
    [
      { label: '× 2 👑', op: '×', operand: 2, isOptimal: true, isTrap: false },
      { label: '+ 8 🛡️', op: '+', operand: 8, isOptimal: false, isTrap: false },
      {
        label: '− 6 💀',
        op: '−',
        operand: 6,
        isOptimal: false,
        isTrap: true,
        trapId: 'T02',
        trapName: 'Zona de Drenagem (−6)',
        trapReason: 'Pisar na placa vermelha drena 6 unidades de poder.',
      },
    ],
    [
      { label: '× 3 ⚡', op: '×', operand: 3, isOptimal: true, isTrap: false },
      { label: '+ 10 🛡️', op: '+', operand: 10, isOptimal: false, isTrap: false },
      {
        label: '÷ 2 💀',
        op: '÷',
        operand: 2,
        isOptimal: false,
        isTrap: true,
        trapId: 'T06',
        trapName: 'Brecha Divisora (÷2)',
        trapReason: 'A brecha divide a cadência e a guarnição ao meio.',
      },
    ],
  ]

  const chosenSet = baseTriplets[waveIdx % baseTriplets.length]
  // SIT-08 & UAT-05: Embaralhar posições por seed para que o botão do meio não seja sempre ótimo!
  const shuffled = rng.shuffle([...chosenSet])
  const padPositions =
    waveIdx % 2 === 1
      ? [
          { normX: 0.24, normY: 0.74 },
          { normX: 0.5, normY: 0.76 },
          { normX: 0.76, normY: 0.74 },
        ]
      : [
          { normX: 0.24, normY: 0.58 },
          { normX: 0.5, normY: 0.55 },
          { normX: 0.76, normY: 0.58 },
        ]

  return shuffled.map((item, idx) => ({
    ...item,
    id: `pad_w${waveIdx}_${idx}_${seed}`,
    normX: padPositions[idx].normX,
    normY: padPositions[idx].normY,
    used: false,
  }))
}

export const ArcadeEnginesCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const projectilePoolRef = useRef<ProjectilePool>(new ProjectilePool())
  const particlePoolRef = useRef<ParticlePool>(new ParticlePool())

  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const seed = useLogicBattleStore((s) => s.runPlan.seed)
  const phase = useLogicBattleStore((s) => s.snapshot.phase)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const reducedMotion = useLogicBattleStore((s) => s.save.settings.reducedMotion)
  const completeEngineRun = useLogicBattleStore((s) => s.completeEngineRun)

  const engineMeta = ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.cerco_torres

  // Estado imperativo da simulação contínua em tempo real (60 FPS)
  const simRef = useRef({
    waveIdx: 0,
    maxWaves: 3,
    armyPower: 5,
    baseHearts: 3,
    comboStreak: 0,
    comboMultiplier: 1,
    maxCombo: 1,
    optimalChoices: 0,
    tokensEarned: 0,
    coinsEarned: 10,
    killsCount: 0,
    elapsedMs: 0,
    fireTimerMs: 180,
    spawnTimerMs: 0,
    heroNormX: 0.5,
    heroNormY: 0.7,
    walkPhase: 0,
    walkTargetPad: null as FloorPadSpec | null,
    pads: [] as FloorPadSpec[],
    enemies: [] as LiveEnemyUnit[],
    trapHits: [] as TrapHit[],
    completed: false,
    startedAtPerf: performance.now(),
  })

  const keysHeldRef = useRef<Set<string>>(new Set())
  const joystickVecRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const pointerTargetRef = useRef<{ normX: number; normY: number } | null>(null)

  const [waveUi, setWaveUi] = useState<number>(1)
  const [heartsUi, setHeartsUi] = useState<number>(3)
  const [padsUi, setPadsUi] = useState<FloorPadSpec[]>([])
  const [joystickKnob, setJoystickKnob] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })

  // Inicializar simulação contínua determinística por seed e sincronizar com o HUD (SIT-05)
  useEffect(() => {
    const startArmy = Math.max(
      5,
      useLogicBattleStore.getState().snapshot.currentArmy,
    )
    const initialPads = buildSeededPadsForWave(activeEngineId, seed, 0)
    const rng = createRng(seed ^ 0x27d4eb2d)

    const initialEnemies: LiveEnemyUnit[] = [0, 1, 2, 3].map((i) => {
      const hp = i === 0 ? 4 : 8 + rng.nextInt(0, 8)
      const angle = (i / 4) * Math.PI * 2 + 0.4
      return {
        id: `en_0_${i}`,
        hp,
        maxHp: hp,
        progress: 0.08 + i * 0.14,
        laneAngle: angle,
        normX: 0.2 + i * 0.2,
        normY: 0.22,
      }
    })

    simRef.current = {
      waveIdx: 0,
      maxWaves: 3,
      armyPower: startArmy,
      baseHearts: 3,
      comboStreak: 0,
      comboMultiplier: 1,
      maxCombo: 1,
      optimalChoices: 0,
      tokensEarned: 0,
      coinsEarned: 10,
      killsCount: 0,
      elapsedMs: 0,
      fireTimerMs: 180,
      spawnTimerMs: 0,
      heroNormX: 0.5,
      heroNormY: 0.72,
      walkPhase: 0,
      walkTargetPad: null,
      pads: initialPads,
      enemies: initialEnemies,
      trapHits: [],
      completed: false,
      startedAtPerf: performance.now(),
    }

    projectilePoolRef.current.clear()
    setWaveUi(1)
    setHeartsUi(3)
    setPadsUi([...initialPads])

    // SIT-05: Garantir que HUD e Engine mostrem exatamente o mesmo valor desde t=0s
    useLogicBattleStore.setState((st) => ({
      snapshot: {
        ...st.snapshot,
        currentArmy: startArmy,
        calcComboStreak: 0,
        calcComboMultiplier: 1,
      },
    }))
  }, [activeEngineId, seed])

  // Controles de teclado WASD / Setas para movimento suave
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
        simRef.current.walkTargetPad = null
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

  const applyPadEffect = (pad: FloorPadSpec) => {
    const sim = simRef.current
    if (pad.used || sim.completed) return
    pad.used = true

    const prevArmy = sim.armyPower
    let nextArmy = prevArmy
    if (pad.op === '+') nextArmy = prevArmy + pad.operand
    else if (pad.op === '×') nextArmy = prevArmy * pad.operand
    else if (pad.op === '−') nextArmy = Math.max(1, prevArmy - pad.operand)
    else if (pad.op === '÷')
      nextArmy = Math.max(1, Math.floor(prevArmy / Math.max(1, pad.operand)))

    if (pad.isTrap) {
      sim.comboStreak = 0
      sim.comboMultiplier = 1
      sim.tokensEarned += 1
      const loss = Math.max(1, prevArmy - nextArmy)
      sim.trapHits.push({
        trapId: pad.trapId ?? 'T06',
        trapName: pad.trapName ?? 'Placa Armadilha',
        conceptId: ENGINE_CONCEPTS[activeEngineId]?.[0] ?? 'ponto_de_virada',
        segmentId: pad.id,
        chosenLane: 0,
        betterLane: 1,
        armyBefore: prevArmy,
        chosenResult: nextArmy,
        counterfactualResult: prevArmy * 2,
        loss,
        lossRatio: loss / Math.max(1, prevArmy * 2),
        intuitionTrapPt: `A placa ${pad.label} reduziu a força ativa.`,
        luzGuiaPt:
          pad.trapReason ??
          'Compare o sinal da operação antes de pisar na placa!',
        codexSlug: 'operacoes-e-precedencia',
      })
      soundEngine.playTrapOpaAlert()
      useLogicBattleStore.setState((st) => ({
        snapshot: {
          ...st.snapshot,
          currentArmy: nextArmy,
          lastTrapFlashAtMs: performance.now(),
          calcComboStreak: 0,
          calcComboMultiplier: 1,
        },
      }))
    } else {
      if (pad.isOptimal) {
        sim.comboStreak += 1
        sim.optimalChoices += 1
      } else {
        sim.comboStreak = 0
      }
      sim.comboMultiplier = getComboMultiplier(sim.comboStreak)
      if (sim.comboMultiplier > sim.maxCombo) {
        sim.maxCombo = sim.comboMultiplier
      }
      soundEngine.playGatePass(Math.max(1, nextArmy - prevArmy), true)
      useLogicBattleStore.setState((st) => ({
        snapshot: {
          ...st.snapshot,
          currentArmy: nextArmy,
          calcComboStreak: sim.comboStreak,
          calcComboMultiplier: sim.comboMultiplier,
        },
      }))
    }

    sim.armyPower = nextArmy
    sim.coinsEarned += 6

    // Avançar para a próxima onda de placas mantendo a ação contínua
    if (sim.waveIdx + 1 < sim.maxWaves) {
      sim.waveIdx += 1
      const nextPads = buildSeededPadsForWave(activeEngineId, seed, sim.waveIdx)
      sim.pads = nextPads
      setWaveUi(sim.waveIdx + 1)
      setPadsUi([...nextPads])
    } else {
      // Concluir após a 3ª onda com validação honesta de vitória/derrota (UAT-05)
      finishSimulation()
    }
  }

  const finishSimulation = (forceDefeat = false) => {
    const sim = simRef.current
    if (sim.completed) return
    sim.completed = true

    const realDurationMs = Math.max(
      400,
      Math.round(performance.now() - sim.startedAtPerf),
    )
    // UAT-05: Meta calibrada (~18) para que escolhas ótimas vençam, mas escolhas cegas/armadilhas ou perder os 3 corações causem DERROTA real!
    const requiredForce = 18
    const isVictory =
      !forceDefeat && sim.baseHearts > 0 && sim.armyPower >= requiredForce

    completeEngineRun({
      engineId: activeEngineId,
      outcome: isVictory ? 'VICTORY' : 'DEFEAT',
      playerArmy: Math.max(0, sim.armyPower),
      enemyForce: requiredForce,
      survivors: isVictory ? Math.max(1, sim.armyPower) : 0,
      coinsEarned: sim.coinsEarned,
      starsEarned: isVictory ? sim.baseHearts : 0,
      tokensEarned: sim.tokensEarned,
      remaindersEarned:
        activeEngineId === 'pedreira_rei'
          ? Math.max(10, Math.round(sim.armyPower * 0.4))
          : Math.max(3, sim.killsCount * 2),
      maxCombo: sim.maxCombo,
      optimalChoices: sim.optimalChoices,
      trapHits: sim.trapHits,
      practicedConcepts: ENGINE_CONCEPTS[activeEngineId] ?? [
        'ponto_de_virada',
      ],
      durationMs: realDurationMs,
    })
  }

  // Quando o jogador toca em um botão de placa: o herói CAMINHA suavemente passo a passo até ela no palco (sem teletransportar!)
  const handlePadButtonClick = (pad: FloorPadSpec) => {
    const sim = simRef.current
    if (pad.used || sim.completed) return
    const dist = Math.hypot(sim.heroNormX - pad.normX, sim.heroNormY - pad.normY)
    if (dist <= 0.075) {
      applyPadEffect(pad)
    } else {
      const dx = pad.normX - sim.heroNormX
      const dy = pad.normY - sim.heroNormY
      const len = Math.hypot(dx, dy)
      const step = Math.min(len, 0.085)
      sim.heroNormX += (dx / len) * step
      sim.heroNormY += (dy / len) * step
      sim.walkPhase += 1.2
      sim.walkTargetPad = pad
    }
  }

  // Loop 60 FPS de Simulação Contínua + Renderização Fiel aos Conceitos
  useEffect(() => {
    let rafId = 0
    let lastNow = performance.now()

    const renderLoop = (now: number) => {
      const dtMs = Math.min(64, Math.max(8, now - lastNow))
      lastNow = now
      const dtSec = dtMs / 1000

      const liveState = useLogicBattleStore.getState()
      const isPaused = liveState.snapshot.phase === 'PAUSED'
      const sim = simRef.current

      if (!isPaused && !sim.completed) {
        sim.elapsedMs += dtMs
        sim.fireTimerMs += dtMs
        sim.spawnTimerMs += dtMs

        // 1. Movimento suave do Herói no palco (Teclado / Joystick / Ponteiro / Caminhada até Placa)
        let moveDx = 0
        let moveDy = 0
        const keys = keysHeldRef.current
        if (keys.has('arrowleft') || keys.has('a')) moveDx -= 1
        if (keys.has('arrowright') || keys.has('d')) moveDx += 1
        if (keys.has('arrowup') || keys.has('w')) moveDy -= 1
        if (keys.has('arrowdown') || keys.has('s')) moveDy += 1

        if (moveDx === 0 && moveDy === 0) {
          if (
            Math.hypot(joystickVecRef.current.dx, joystickVecRef.current.dy) >
            0.08
          ) {
            moveDx = joystickVecRef.current.dx
            moveDy = joystickVecRef.current.dy
          } else if (pointerTargetRef.current) {
            const pdx = pointerTargetRef.current.normX - sim.heroNormX
            const pdy = pointerTargetRef.current.normY - sim.heroNormY
            const plen = Math.hypot(pdx, pdy)
            if (plen > 0.02) {
              moveDx = pdx / plen
              moveDy = pdy / plen
            }
          } else if (sim.walkTargetPad && !sim.walkTargetPad.used) {
            const tdx = sim.walkTargetPad.normX - sim.heroNormX
            const tdy = sim.walkTargetPad.normY - sim.heroNormY
            const tlen = Math.hypot(tdx, tdy)
            if (tlen <= 0.045) {
              const reached = sim.walkTargetPad
              sim.walkTargetPad = null
              applyPadEffect(reached)
            } else {
              moveDx = (tdx / tlen) * 2.2
              moveDy = (tdy / tlen) * 2.2
            }
          }
        }

        if (Math.hypot(moveDx, moveDy) > 0.05) {
          sim.walkPhase += dtMs * 0.018
          sim.heroNormX = Math.max(
            0.12,
            Math.min(0.88, sim.heroNormX + moveDx * 0.42 * dtSec),
          )
          sim.heroNormY = Math.max(
            0.22,
            Math.min(0.84, sim.heroNormY + moveDy * 0.42 * dtSec),
          )

          // Verificar se o Herói pisou fisicamente em uma placa no chão
          for (const pad of sim.pads) {
            if (pad.used) continue
            if (
              Math.hypot(sim.heroNormX - pad.normX, sim.heroNormY - pad.normY) <=
              0.065
            ) {
              sim.walkTargetPad = null
              applyPadEffect(pad)
              break
            }
          }
        }
        ;(
          window as unknown as { __lbHeroPos?: { x: number; y: number } }
        ).__lbHeroPos = { x: sim.heroNormX, y: sim.heroNormY }

        // 2. Avançar inimigos continuamente sem esperar clique (UAT-01)
        for (let i = sim.enemies.length - 1; i >= 0; i--) {
          const en = sim.enemies[i]
          en.progress += dtSec * 0.075

          if (activeEngineId === 'cerco_torres') {
            // Estrada sinuosa em S (fiel a Kingshot / UAT-03)
            en.normY = 0.16 + en.progress * 0.62
            en.normX = 0.5 + Math.sin(en.progress * Math.PI * 2.2) * 0.28
          } else if (activeEngineId === 'forte_bandeira') {
            // Invasores convergindo pelas 3 portas do forte
            const r = 0.42 * (1 - en.progress * 0.78)
            en.normX = 0.5 + Math.cos(en.laneAngle) * r
            en.normY = 0.46 + Math.sin(en.laneAngle) * r
          } else if (activeEngineId === 'pedreira_rei') {
            // Blocos de rocha descendo rumo ao britador
            en.normY = 0.18 + en.progress * 0.52
          } else {
            // Arena das Ondas: enxame radial 360°
            const r = 0.44 * (1 - en.progress * 0.8)
            en.normX = 0.5 + Math.cos(en.laneAngle + sim.elapsedMs * 0.0006) * r
            en.normY = 0.46 + Math.sin(en.laneAngle + sim.elapsedMs * 0.0006) * r
          }

          // Se o inimigo alcançar a linha de defesa sem ser destruído, causa dano real!
          if (en.progress >= 1) {
            sim.enemies.splice(i, 1)
            sim.baseHearts = Math.max(0, sim.baseHearts - 1)
            sim.armyPower = Math.max(1, sim.armyPower - 2)
            setHeartsUi(sim.baseHearts)
            soundEngine.playTrapOpaAlert()
            useLogicBattleStore.setState((st) => ({
              snapshot: {
                ...st.snapshot,
                currentArmy: sim.armyPower,
              },
            }))
            if (sim.baseHearts <= 0) {
              finishSimulation(true)
              break
            }
          }
        }

        // Repor onda de inimigos/blocos continuamente
        if (sim.enemies.length < 3 && sim.spawnTimerMs >= 1600) {
          sim.spawnTimerMs = 0
          const nextHp = 6 + sim.waveIdx * 5 + (sim.killsCount % 3) * 3
          const idx = sim.killsCount + sim.enemies.length
          sim.enemies.push({
            id: `en_${sim.elapsedMs}_${idx}`,
            hp: nextHp,
            maxHp: nextHp,
            progress: 0.04,
            laneAngle: (idx * 1.57) % (Math.PI * 2),
            normX: 0.25 + (idx % 3) * 0.25,
            normY: 0.18,
          })
        }

        // 3. Tiro Contínuo com Dano Real nos Inimigos desde t = 0s (UAT-02)
        const canvas = canvasRef.current
        if (
          canvas &&
          sim.enemies.length > 0 &&
          (sim.fireTimerMs >= 210 ||
            projectilePoolRef.current.getActiveCount() === 0)
        ) {
          sim.fireTimerMs = 0
          const rect = canvas.getBoundingClientRect()
          const w = rect.width || 390
          const h = rect.height || 740

          // Alvo é o inimigo mais avançado
          let target = sim.enemies[0]
          for (const cand of sim.enemies) {
            if (cand.progress > target.progress) target = cand
          }

          const sx = sim.heroNormX * w
          const sy = sim.heroNormY * h - 10
          const tx = target.normX * w
          const ty = target.normY * h

          const shotDmg = Math.max(1, Math.ceil(sim.armyPower * 0.25))
          target.hp = Math.max(0, target.hp - shotDmg)

          projectilePoolRef.current.spawnProjectile(
            sim.armyPower >= 16 ? 'cannon' : 'arrow',
            sx,
            sy,
            tx,
            ty,
            210,
          )
          projectilePoolRef.current.spawnDamageText(
            tx,
            ty - 14,
            `−${shotDmg}`,
            '#fef08a',
          )

          // Se abateu o inimigo/bloco, ganha +1 de poder real no HUD (UAT-01: em 6s parado o número sobe!)
          if (target.hp <= 0) {
            sim.enemies = sim.enemies.filter((e) => e.id !== target.id)
            sim.killsCount += 1
            sim.coinsEarned += 4
            sim.armyPower += 1
            useLogicBattleStore.setState((st) => ({
              snapshot: {
                ...st.snapshot,
                currentArmy: sim.armyPower,
              },
            }))
          }
        }
      }

      // 4. Desenhar o Palco 2D da Engine
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

          // Fundo temático por engine
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
          if (activeEngineId === 'pedreira_rei') {
            bgGrad.addColorStop(0, '#1e293b')
            bgGrad.addColorStop(0.5, '#334155')
            bgGrad.addColorStop(1, '#0f172a')
          } else if (activeEngineId === 'arena_ondas') {
            bgGrad.addColorStop(0, '#1e1b4b')
            bgGrad.addColorStop(0.5, '#311042')
            bgGrad.addColorStop(1, '#0f172a')
          } else if (activeEngineId === 'forte_bandeira') {
            bgGrad.addColorStop(0, '#134e4a')
            bgGrad.addColorStop(0.5, '#115e59')
            bgGrad.addColorStop(1, '#0f172a')
          } else {
            bgGrad.addColorStop(0, '#14532d')
            bgGrad.addColorStop(0.5, '#166534')
            bgGrad.addColorStop(1, '#0f172a')
          }
          ctx.fillStyle = bgGrad
          ctx.fillRect(0, 0, w, h)

          // Cenário específico de cada Engine fiel às referências (Kingshot, Top Force, Idle Quarry, Survivor Arena)
          if (activeEngineId === 'cerco_torres') {
            // UAT-03: Estrada sinuosa em S com torres laterais e muralha do castelo na base
            ctx.strokeStyle = '#94a3b8'
            ctx.lineWidth = 34
            ctx.lineCap = 'round'
            ctx.beginPath()
            for (let p = 0; p <= 1; p += 0.05) {
              const rx = (0.5 + Math.sin(p * Math.PI * 2.2) * 0.28) * w
              const ry = (0.14 + p * 0.64) * h
              if (p === 0) ctx.moveTo(rx, ry)
              else ctx.lineTo(rx, ry)
            }
            ctx.stroke()

            // Muralha do Castelo na base da estrada
            ctx.fillStyle = '#334155'
            ctx.strokeStyle = '#cbd5e1'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.roundRect(w * 0.22, h * 0.78, w * 0.56, 34, 8)
            ctx.fill()
            ctx.stroke()
          } else if (activeEngineId === 'forte_bandeira') {
            // Forte de sacos de areia / muralha circular com bandeira central (Top Force)
            ctx.strokeStyle = '#a3e635'
            ctx.lineWidth = 8
            ctx.beginPath()
            ctx.arc(w * 0.5, h * 0.52, Math.min(w, h) * 0.3, 0, Math.PI * 2)
            ctx.stroke()
          } else if (activeEngineId === 'pedreira_rei') {
            // Britador central ÷10 na Pedreira do Rei
            ctx.fillStyle = '#0f172a'
            ctx.strokeStyle = '#facc15'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.roundRect(w * 0.3, h * 0.68, w * 0.4, 32, 8)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = '#fef08a'
            ctx.font = '900 12px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText('⚙️ BRITADOR ÷10', w * 0.5, h * 0.68 + 20)
          } else {
            // Arena das Ondas: Anel de energia 360° ao redor do Herói
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(
              sim.heroNormX * w,
              sim.heroNormY * h,
              46,
              0,
              Math.PI * 2,
            )
            ctx.stroke()
          }

          // Desenhar Placas Matemáticas no Chão do Palco (para caminhar até elas)
          for (const pad of sim.pads) {
            if (pad.used) continue
            const px = pad.normX * w
            const py = pad.normY * h

            ctx.fillStyle = pad.isTrap
              ? 'rgba(147, 51, 234, 0.88)'
              : 'rgba(14, 165, 233, 0.88)'
            ctx.strokeStyle = pad.isTrap ? '#f43f5e' : '#bae6fd'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.roundRect(px - 28, py - 16, 56, 32, 9)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#ffffff'
            ctx.font = '900 13px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(pad.label, px, py)
          }

          // Desenhar Inimigos/Blocos Vivos em movimento contínuo
          for (const en of sim.enemies) {
            const ex = en.normX * w
            const ey = en.normY * h

            ctx.fillStyle =
              activeEngineId === 'pedreira_rei' ? '#f59e0b' : '#dc2626'
            ctx.strokeStyle = '#450a0a'
            ctx.lineWidth = 2.2
            ctx.beginPath()
            if (activeEngineId === 'pedreira_rei') {
              ctx.roundRect(ex - 18, ey - 18, 36, 36, 7)
            } else {
              ctx.arc(ex, ey, 16, 0, Math.PI * 2)
            }
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#ffffff'
            ctx.font = '900 13px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(en.hp), ex, ey)
          }

          // Desenhar o Herói/Comandante Azul com passos suaves na posição real (heroNormX, heroNormY)
          const hx = sim.heroNormX * w
          const hy = sim.heroNormY * h
          const stepSwing = Math.sin(sim.walkPhase) * 5

          ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
          ctx.beginPath()
          ctx.ellipse(hx, hy + 14, 15, 6, 0, 0, Math.PI * 2)
          ctx.fill()

          // Pés caminhando
          ctx.fillStyle = '#1e3a8a'
          ctx.beginPath()
          ctx.arc(hx - 5 + stepSwing * 0.6, hy + 11, 4.5, 0, Math.PI * 2)
          ctx.arc(hx + 5 - stepSwing * 0.6, hy + 11, 4.5, 0, Math.PI * 2)
          ctx.fill()

          // Corpo e cabeça do Comandante
          ctx.fillStyle = '#0284c7'
          ctx.strokeStyle = '#e0f2fe'
          ctx.lineWidth = 2.2
          ctx.beginPath()
          ctx.roundRect(hx - 12, hy - 8, 24, 18, 6)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(hx, hy - 14, 9.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()

          // Badge do Poder Atual sobre o Herói (sempre idêntico ao HUD — SIT-05)
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.roundRect(hx - 24, hy - 39, 48, 17, 6)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = '#ffffff'
          ctx.font = '900 11px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            `🛡️${formatArmy(sim.armyPower, notationMode)}`,
            hx,
            hy - 30,
          )

          // Projéteis e Partículas
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

      rafId = window.requestAnimationFrame(renderLoop)
    }

    rafId = window.requestAnimationFrame(renderLoop)
    return () => window.cancelAnimationFrame(rafId)
  }, [activeEngineId, notationMode, reducedMotion, seed])

  // SIT-06: Desmontar botões quando aparecer o resultado
  const showControls =
    phase === 'RUNNING' || phase === 'CALM_WAIT' || phase === 'PAUSED'

  return (
    <div className="lb-run-stage" data-testid="logic-battle-run-stage">
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        data-testid="logic-battle-canvas"
        aria-label={`${engineMeta.name} — Modo Contínuo Ativo`}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            pointerTargetRef.current = {
              normX: (e.clientX - rect.left) / rect.width,
              normY: (e.clientY - rect.top) / rect.height,
            }
            simRef.current.walkTargetPad = null
          }
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pointerType === 'mouse') return
          const rect = e.currentTarget.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            pointerTargetRef.current = {
              normX: (e.clientX - rect.left) / rect.width,
              normY: (e.clientY - rect.top) / rect.height,
            }
          }
        }}
        onPointerUp={() => {
          pointerTargetRef.current = null
        }}
      />

      {/* Corações de Defesa no topo esquerdo */}
      <div
        style={{
          position: 'absolute',
          top: '56px',
          left: '12px',
          zIndex: 22,
          display: 'flex',
          gap: '4px',
          pointerEvents: 'none',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{ opacity: i < heartsUi ? 1 : 0.25 }}
            aria-hidden="true"
          >
            ❤️
          </span>
        ))}
      </div>

      {/* Badge compacto da Engine e Onda */}
      <div
        className="lb-vai-um-banner"
        data-testid="lb-active-engine-badge"
        style={{ top: '54px' }}
      >
        <strong>
          {engineMeta.icon} {engineMeta.shortName} · {waveUi}/3
        </strong>
      </div>

      {showControls && (
        <>
          {/* Joystick Virtual 360° para caminhar livremente no palco */}
          <div
            data-testid="lb-engine-joystick"
            role="slider"
            aria-label="Joystick de Movimento"
            aria-valuenow={Math.round(joystickKnob.x)}
            style={{
              position: 'absolute',
              left: '16px',
              bottom: '64px',
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.56)',
              border: '2px solid rgba(148, 163, 184, 0.5)',
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
              const maxR = 26
              const dist = Math.min(maxR, Math.hypot(dx, dy))
              const angle = Math.atan2(dy, dx)
              const kx = Math.cos(angle) * dist
              const ky = Math.sin(angle) * dist
              setJoystickKnob({ x: kx, y: ky })
              joystickVecRef.current = { dx: kx / maxR, dy: ky / maxR }
              simRef.current.walkTargetPad = null
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
              const rect = e.currentTarget.getBoundingClientRect()
              const dx = e.clientX - (rect.left + rect.width * 0.5)
              const dy = e.clientY - (rect.top + rect.height * 0.5)
              const maxR = 26
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
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'rgba(226, 232, 240, 0.85)',
                border: '2px solid #38bdf8',
                transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`,
                pointerEvents: 'none',
              }}
            />
          </div>

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
              {padsUi.map((pad, idx) => (
                <button
                  key={pad.id}
                  type="button"
                  data-testid={`lb-gate-choice-${idx}`}
                  className="lb-gate-choice-btn"
                  style={{ height: '38px' }}
                  onClick={() => handlePadButtonClick(pad)}
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

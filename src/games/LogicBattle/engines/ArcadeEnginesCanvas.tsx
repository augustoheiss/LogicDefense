// ──────────────────────────────────────────────────────────────────────────────
// src/games/LogicBattle/engines/ArcadeEnginesCanvas.tsx — Engines B, C, D e E em 2.5D Real
// MASTER_PLAN_V5:
// - ZERO buffs genéricos da Ponte: cada engine tem sua economia de Moedas (🪙) e construções/armas próprias
// - Sprites 2.5D offscreen via engineSpriteFactory.ts (Torres c/ Besteiros, Quartéis, Fábricas de Tanques,
//   Soldados e Tanques Aliados autônomos, Operários carregando granito ao Britador ÷10, Esquadrão + Mecha)
// - Pacing real de 4 Ondas Completas + Boss Caminhante com Barra de Vida (proibido acabar em 3 cliques!)
// ──────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { soundEngine } from '../audio/soundEngine'
import { formatArmy } from '../domain/notation'
import { createRng } from '../domain/rng'
import { ParticlePool } from '../run/renderer/fxParticles'
import { ProjectilePool } from '../run/renderer/projectilePool'
import { useLogicBattleStore } from '../state/useLogicBattleStore'
import { ConceptId } from '../types'
import {
  ENGINE_CATALOG,
  EngineId,
  getComboMultiplier,
} from './engineContract'
import {
  BossSpriteKind,
  BuildingSpriteKind,
  getBossSprite,
  getBuildingSprite,
  getPropSprite,
  getUnitSprite,
  UnitSpriteKind,
} from './renderer/engineSpriteFactory'

interface TacticalBuildPad {
  id: string
  slotIndex: number
  title: string
  subtitle: string
  icon: string
  costCoins: number
  level: number
  maxLevel: number
  normX: number
  normY: number
  buildingKind?: BuildingSpriteKind
  actionKind:
    | 'build_archer_tower'
    | 'build_mortar_tower'
    | 'repair_palisade'
    | 'build_barracks'
    | 'build_tank_factory'
    | 'build_turret'
    | 'hire_worker'
    | 'hire_titan'
    | 'upgrade_crusher'
    | 'add_squad_gunner'
    | 'upgrade_plasma_rifle'
    | 'deploy_mecha'
}

interface BuiltStructure25D {
  id: string
  kind: BuildingSpriteKind
  tier: number
  normX: number
  normY: number
  fireCooldownMs: number
  trainProgressMs: number
  trainIntervalMs: number
  label: string
}

interface AlliedAutonomousUnit {
  id: string
  kind: UnitSpriteKind
  hp: number
  maxHp: number
  attackDmg: number
  normX: number
  normY: number
  fireTimerMs: number
  carryWeightKg: number
  carryingState: 'seeking_rock' | 'to_crusher' | 'combat'
}

interface LiveEnemyUnit {
  id: string
  kind: UnitSpriteKind
  isBoss: boolean
  bossKind?: BossSpriteKind
  hp: number
  maxHp: number
  normX: number
  normY: number
  speed: number
  attackTimerMs: number
  rewardCoins: number
  rockWeightKg?: number
}

interface DroppedCoin {
  id: string
  normX: number
  normY: number
  amount: number
  ageMs: number
}

const CONCEPT_BY_ENGINE: Record<EngineId, ConceptId> = {
  ponte_portoes: 'ponto_de_virada',
  cerco_torres: 'multiplicacao_decimal',
  forte_bandeira: 'ponto_de_virada',
  pedreira_rei: 'divisao_euclidiana_resto',
  arena_ondas: 'precedencia_operacoes',
  serpente_numeros: 'subtracao_negativo',
}

function createInitialPadsForEngine(engineId: EngineId): TacticalBuildPad[] {
  if (engineId === 'cerco_torres') {
    return [
      {
        id: 'pad_tower_archers',
        slotIndex: 0,
        title: 'Torre de Besteiros',
        subtitle: '+3 Arqueiros 2.5D',
        icon: '🏹',
        costCoins: 16,
        level: 1,
        maxLevel: 5,
        normX: 0.25,
        normY: 0.34,
        buildingKind: 'archer_tower',
        actionKind: 'build_archer_tower',
      },
      {
        id: 'pad_tower_mortar',
        slotIndex: 1,
        title: 'Bastião & Morteiro',
        subtitle: 'Dano Explosivo ×2',
        icon: '💣',
        costCoins: 26,
        level: 0,
        maxLevel: 4,
        normX: 0.25,
        normY: 0.66,
        buildingKind: 'archer_tower',
        actionKind: 'build_mortar_tower',
      },
      {
        id: 'pad_palisade_guard',
        slotIndex: 2,
        title: 'Reforçar Paliçada',
        subtitle: '+HP Muro & +1 Guarda',
        icon: '🛡️',
        costCoins: 18,
        level: 1,
        maxLevel: 5,
        normX: 0.16,
        normY: 0.50,
        actionKind: 'repair_palisade',
      },
    ]
  }

  if (engineId === 'forte_bandeira') {
    return [
      {
        id: 'pad_fort_barracks',
        slotIndex: 0,
        title: 'Quartel de Tropas',
        subtitle: 'Treina Soldados Aliados',
        icon: '⛺',
        costCoins: 18,
        level: 1,
        maxLevel: 5,
        normX: 0.36,
        normY: 0.38,
        buildingKind: 'barracks',
        actionKind: 'build_barracks',
      },
      {
        id: 'pad_fort_tank_factory',
        slotIndex: 1,
        title: 'Fábrica de Tanques',
        subtitle: 'Despacha Blindados 2.5D',
        icon: '🚜',
        costCoins: 30,
        level: 0,
        maxLevel: 4,
        normX: 0.64,
        normY: 0.38,
        buildingKind: 'tank_factory',
        actionKind: 'build_tank_factory',
      },
      {
        id: 'pad_fort_turret',
        slotIndex: 2,
        title: 'Torreta & Fuzil ×2',
        subtitle: '+Torreta & Dobra Dano',
        icon: '🔫',
        costCoins: 22,
        level: 1,
        maxLevel: 5,
        normX: 0.50,
        normY: 0.66,
        buildingKind: 'turret',
        actionKind: 'build_turret',
      },
    ]
  }

  if (engineId === 'pedreira_rei') {
    return [
      {
        id: 'pad_quarry_worker',
        slotIndex: 0,
        title: 'Contratar Operário',
        subtitle: 'Carrega Blocos ao Britador',
        icon: '👷',
        costCoins: 15,
        level: 2,
        maxLevel: 7,
        normX: 0.28,
        normY: 0.72,
        actionKind: 'hire_worker',
      },
      {
        id: 'pad_quarry_titan',
        slotIndex: 1,
        title: 'Titã Carregador',
        subtitle: 'Carrega Rocha Pesada & Luta',
        icon: '🗿',
        costCoins: 28,
        level: 0,
        maxLevel: 4,
        normX: 0.52,
        normY: 0.72,
        actionKind: 'hire_titan',
      },
      {
        id: 'pad_quarry_crusher',
        slotIndex: 2,
        title: 'Turbo Britador ÷10',
        subtitle: 'Dobra Lingotes de Ouro',
        icon: '⚙️',
        costCoins: 22,
        level: 1,
        maxLevel: 5,
        normX: 0.24,
        normY: 0.44,
        buildingKind: 'quarry_crusher',
        actionKind: 'upgrade_crusher',
      },
    ]
  }

  // Engine E: arena_ondas (Zombie Waves / ZW-Shooting)
  return [
    {
      id: 'pad_arena_squad',
      slotIndex: 0,
      title: '+1 Atirador no Esquadrão',
      subtitle: 'Atira Junto em Formação',
      icon: '🪖',
      costCoins: 18,
      level: 2,
      maxLevel: 6,
      normX: 0.34,
      normY: 0.36,
      actionKind: 'add_squad_gunner',
    },
    {
      id: 'pad_arena_plasma',
      slotIndex: 1,
      title: 'Feixe Duplo & Cadência',
      subtitle: 'Rajada de Plasma +40%',
      icon: '⚡',
      costCoins: 22,
      level: 1,
      maxLevel: 5,
      normX: 0.66,
      normY: 0.36,
      actionKind: 'upgrade_plasma_rifle',
    },
    {
      id: 'pad_arena_mecha',
      slotIndex: 2,
      title: 'Sentinela Mecha 360°',
      subtitle: 'Drone Blindado Autônomo',
      icon: '🤖',
      costCoins: 30,
      level: 0,
      maxLevel: 4,
      normX: 0.50,
      normY: 0.68,
      actionKind: 'deploy_mecha',
    },
  ]
}

export const ArcadeEnginesCanvas: React.FC = () => {
  const activeEngineId = useLogicBattleStore((s) => s.activeEngineId)
  const snapshot = useLogicBattleStore((s) => s.snapshot)
  const runPlan = useLogicBattleStore((s) => s.runPlan)
  const notationMode = useLogicBattleStore((s) => s.save.settings.notationMode)
  const reducedMotion = useLogicBattleStore((s) => s.save.settings.reducedMotion)
  const completeEngineRun = useLogicBattleStore((s) => s.completeEngineRun)
  const openMathChallengeModal = useLogicBattleStore((s) => s.openMathChallengeModal)
  const lastSolvedMathRewardAt = useLogicBattleStore((s) => s.lastSolvedMathRewardAt)
  const lastAppliedMathSeqRef = useRef<number>(0)

  const engineSpec = ENGINE_CATALOG[activeEngineId] ?? ENGINE_CATALOG.cerco_torres
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const projectilePoolRef = useRef(new ProjectilePool())
  const particlePoolRef = useRef(new ParticlePool())
  const keysPressedRef = useRef<Set<string>>(new Set())

  const initialArmy = Math.max(12, runPlan.n0)
  const baseEnemyForce = Math.max(40, snapshot.enemy.totalForce)

  const [hudState, setHudState] = useState<{
    wave: number
    maxWaves: number
    playerForce: number
    baseHp: number
    baseMaxHp: number
    coins: number
    comboStreak: number
    comboMult: number
    enemiesLeft: number
    bossHp: number
    bossMaxHp: number
    statusText: string
    pads: TacticalBuildPad[]
    alliedCount: number
  }>(() => ({
    wave: 1,
    maxWaves: 4,
    playerForce: initialArmy,
    baseHp: 100,
    baseMaxHp: 100,
    coins: 28, // Começa com ouro suficiente para construir a 1ª Torre / Quartel / Operário!
    comboStreak: 0,
    comboMult: 1,
    enemiesLeft: 8,
    bossHp: 0,
    bossMaxHp: Math.max(120, snapshot.enemy.bossHp * 2),
    statusText:
      activeEngineId === 'forte_bandeira'
        ? 'Quartel ativo! Colete 🪙 e construa mais Quartéis e Fábricas de Tanques para seu exército atacar!'
        : activeEngineId === 'cerco_torres'
          ? 'Colete 🪙 dos goblins abatidos e construa Torres de Besteiros 2.5D e Morteiros atrás da paliçada!'
          : activeEngineId === 'pedreira_rei'
            ? 'Contrate Operários e Titãs para carregar blocos de granito até o Britador (÷10) e gerar Lingotes!'
            : 'Mova o Esquadrão pelo coliseu, colete 🪙 e recrute +Atiradores e Sentinelas Mecha contra a Horda!',
    pads: createInitialPadsForEngine(activeEngineId),
    alliedCount: 2,
  }))

  const simRef = useRef<{
    seed: number
    rngNextFloat: () => number
    elapsedMs: number
    wave: number
    maxWaves: number
    playerForce: number
    heroWeaponDmg: number
    heroFireCadenceMs: number
    baseHp: number
    baseMaxHp: number
    coins: number
    comboStreak: number
    maxCombo: number
    remaindersEarned: number
    finished: boolean
    heroNormX: number
    heroNormY: number
    targetNormX: number
    targetNormY: number
    pendingPadId: string | null
    pointerActive: boolean
    walkPhase: number
    pads: TacticalBuildPad[]
    buildings: BuiltStructure25D[]
    alliedUnits: AlliedAutonomousUnit[]
    enemies: LiveEnemyUnit[]
    droppedCoins: DroppedCoin[]
    spawnTimerMs: number
    waveEnemiesToSpawn: number
    waveEnemiesSpawned: number
    bossSpawnedInWave: boolean
    fireTimerMs: number
    ingotsStacked: number
    targetIngots: number
    padClickCount: number
  } | null>(null)

  useEffect(() => {
    const startArmy = Math.max(12, runPlan.n0)
    const rng = createRng(runPlan.seed + 701)
    const initialPads = createInitialPadsForEngine(activeEngineId)

    const startHeroPos =
      activeEngineId === 'cerco_torres'
        ? { x: 0.22, y: 0.50 }
        : activeEngineId === 'pedreira_rei'
          ? { x: 0.36, y: 0.56 }
          : { x: 0.50, y: 0.52 }

    // Estruturas 2.5D iniciais em campo conforme cada jogo das screenshots
    const initialBuildings: BuiltStructure25D[] = []
    const initialAllies: AlliedAutonomousUnit[] = []

    if (activeEngineId === 'cerco_torres') {
      initialBuildings.push(
        {
          id: 'bldg_castle',
          kind: 'castle_keep',
          tier: 2,
          normX: 0.08,
          normY: 0.50,
          fireCooldownMs: 0,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Castelo Real',
        },
        {
          id: 'bldg_tower_0',
          kind: 'archer_tower',
          tier: 1,
          normX: 0.25,
          normY: 0.34,
          fireCooldownMs: 300,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Torre Nv.1',
        },
      )
    } else if (activeEngineId === 'forte_bandeira') {
      // Começa com 1 Quartel de Infantaria ativo que já treina soldados aliados!
      initialBuildings.push({
        id: 'bldg_barracks_0',
        kind: 'barracks',
        tier: 1,
        normX: 0.38,
        normY: 0.40,
        fireCooldownMs: 0,
        trainProgressMs: 2200,
        trainIntervalMs: 3600,
        label: 'Quartel Nv.1',
      })
      // 2 Soldados aliados iniciais já marchando para defender o forte
      for (let i = 0; i < 2; i++) {
        initialAllies.push({
          id: `ally_init_${i}`,
          kind: 'allied_soldier',
          hp: 36,
          maxHp: 36,
          attackDmg: Math.max(4, Math.round(startArmy * 0.25)),
          normX: 0.44 + i * 0.12,
          normY: 0.46 + (i % 2) * 0.08,
          fireTimerMs: i * 250,
          carryWeightKg: 0,
          carryingState: 'combat',
        })
      }
    } else if (activeEngineId === 'pedreira_rei') {
      initialBuildings.push(
        {
          id: 'bldg_crusher',
          kind: 'quarry_crusher',
          tier: 1,
          normX: 0.22,
          normY: 0.42,
          fireCooldownMs: 0,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Britador ÷10',
        },
        {
          id: 'bldg_pallet',
          kind: 'ingot_pallet',
          tier: 1,
          normX: 0.14,
          normY: 0.68,
          fireCooldownMs: 0,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Pallet de Ouro',
        },
      )
      // 2 Operários iniciais carregando pedras autonomamente
      for (let i = 0; i < 2; i++) {
        initialAllies.push({
          id: `worker_init_${i}`,
          kind: 'worker_small',
          hp: 45,
          maxHp: 45,
          attackDmg: Math.max(5, Math.round(startArmy * 0.28)),
          normX: 0.34 + i * 0.08,
          normY: 0.52 + i * 0.1,
          fireTimerMs: 0,
          carryWeightKg: 30,
          carryingState: 'seeking_rock',
        })
      }
    } else if (activeEngineId === 'arena_ondas') {
      // Esquadrão inicial de 2 atiradores de elite junto ao Comandante
      for (let i = 0; i < 2; i++) {
        initialAllies.push({
          id: `squad_init_${i}`,
          kind: 'allied_archer',
          hp: 50,
          maxHp: 50,
          attackDmg: Math.max(5, Math.round(startArmy * 0.3)),
          normX: startHeroPos.x + (i === 0 ? -0.05 : 0.05),
          normY: startHeroPos.y + 0.04,
          fireTimerMs: i * 180,
          carryWeightKg: 0,
          carryingState: 'combat',
        })
      }
    }

    const initEnemyKind: UnitSpriteKind =
      activeEngineId === 'forte_bandeira'
        ? 'enemy_rifleman'
        : activeEngineId === 'arena_ondas'
          ? 'enemy_zombie'
          : 'enemy_goblin'

    const initialEnemies: LiveEnemyUnit[] = [
      {
        id: 'enemy_init_0',
        kind: initEnemyKind,
        hp: 28,
        maxHp: 28,
        normX: activeEngineId === 'cerco_torres' || activeEngineId === 'pedreira_rei' ? 0.82 : 0.80,
        normY: 0.42,
        speed: 0.000068,
        attackTimerMs: 0,
        rewardCoins: 6,
        isBoss: false,
      },
      {
        id: 'enemy_init_1',
        kind: initEnemyKind,
        hp: 32,
        maxHp: 32,
        normX: activeEngineId === 'cerco_torres' || activeEngineId === 'pedreira_rei' ? 0.86 : 0.18,
        normY: 0.58,
        speed: 0.000068,
        attackTimerMs: 0,
        rewardCoins: 6,
        isBoss: false,
      },
    ]

    simRef.current = {
      seed: runPlan.seed,
      rngNextFloat: rng.nextFloat,
      elapsedMs: 0,
      wave: 1,
      maxWaves: 4,
      playerForce: startArmy,
      heroWeaponDmg: Math.max(4, Math.round(startArmy * 0.28)),
      heroFireCadenceMs: 360,
      baseHp: 120,
      baseMaxHp: 120,
      coins: 28,
      comboStreak: 0,
      maxCombo: 1,
      remaindersEarned: 0,
      finished: false,
      heroNormX: startHeroPos.x,
      heroNormY: startHeroPos.y,
      targetNormX: startHeroPos.x,
      targetNormY: startHeroPos.y,
      pendingPadId: null,
      pointerActive: false,
      walkPhase: 0,
      pads: initialPads,
      buildings: initialBuildings,
      alliedUnits: initialAllies,
      enemies: initialEnemies,
      droppedCoins: [],
      spawnTimerMs: 650,
      waveEnemiesToSpawn: 7,
      waveEnemiesSpawned: 2,
      bossSpawnedInWave: false,
      fireTimerMs: 0,
      ingotsStacked: 0,
      targetIngots: 12,
      padClickCount: 0,
    }

    useLogicBattleStore.setState((s) => ({
      snapshot: {
        ...s.snapshot,
        currentArmy: startArmy,
        phase: 'RUNNING',
      },
    }))

    projectilePoolRef.current.clear()
    // Disparo inicial imediato em t=0s para feedback visual instantâneo e telemetria E2E
    projectilePoolRef.current.spawnProjectile(
      activeEngineId === 'cerco_torres' ? 'arrow' : activeEngineId === 'arena_ondas' ? 'spear' : 'cannon',
      startHeroPos.x * 420,
      startHeroPos.y * 620,
      initialEnemies[0].normX * 420,
      initialEnemies[0].normY * 620,
      360,
    )
    ;(window as unknown as { __lbActiveProjectiles?: number }).__lbActiveProjectiles =
      projectilePoolRef.current.getActiveCount()
  }, [activeEngineId, runPlan.n0, runPlan.seed, baseEnemyForce])

  // V6: Ao acertar uma Conta no MathChallengeModal, injeta +Moedas, +Soldados/Tanques/Torres/Titãs e Buff de Arma!
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

    sim.coins += lastSolvedMathRewardAt.coinsBonus
    sim.playerForce += lastSolvedMathRewardAt.soldiersBonus
    sim.heroWeaponDmg = Math.max(
      sim.heroWeaponDmg + 4,
      Math.round(sim.heroWeaponDmg * lastSolvedMathRewardAt.weaponDmgMultiplier),
    )
    sim.heroFireCadenceMs = Math.max(150, Math.round(sim.heroFireCadenceMs * 0.88))
    sim.baseHp = Math.min(sim.baseMaxHp, sim.baseHp + 25)
    sim.comboStreak += 1
    sim.maxCombo = Math.max(sim.maxCombo, getComboMultiplier(sim.comboStreak))

    const bonusUnitsCount = lastSolvedMathRewardAt.tier >= 3 ? 2 : 1
    for (let i = 0; i < bonusUnitsCount; i++) {
      const unitKind: UnitSpriteKind =
        activeEngineId === 'forte_bandeira'
          ? lastSolvedMathRewardAt.tier >= 2 && i === 0
            ? 'allied_tank'
            : 'allied_soldier'
          : activeEngineId === 'pedreira_rei'
            ? lastSolvedMathRewardAt.tier >= 2
              ? 'worker_titan'
              : 'worker_medium'
            : activeEngineId === 'arena_ondas'
              ? lastSolvedMathRewardAt.tier >= 3 && i === 0
                ? 'allied_mecha'
                : 'allied_archer'
              : 'allied_archer'

      sim.alliedUnits.push({
        id: `math_ally_${lastSolvedMathRewardAt.seq}_${i}`,
        kind: unitKind,
        hp: unitKind === 'allied_tank' || unitKind === 'allied_mecha' ? 180 : 65,
        maxHp: unitKind === 'allied_tank' || unitKind === 'allied_mecha' ? 180 : 65,
        attackDmg: Math.max(8, Math.round(sim.heroWeaponDmg * 0.9)),
        normX: Math.min(0.75, sim.heroNormX + 0.05 * (i + 1)),
        normY: Math.max(0.24, Math.min(0.78, sim.heroNormY + (i % 2 === 0 ? -0.05 : 0.05))),
        fireTimerMs: 0,
        carryWeightKg: activeEngineId === 'pedreira_rei' ? 80 : 0,
        carryingState: activeEngineId === 'pedreira_rei' ? 'to_crusher' : 'combat',
      })
    }

    setHudState((prev) => ({
      ...prev,
      coins: sim.coins,
      playerForce: sim.playerForce,
      baseHp: Math.round(sim.baseHp),
      alliedCount: sim.alliedUnits.length,
      statusText: `🧮 Conta resolvida! +${lastSolvedMathRewardAt.coinsBonus} 🪙, +${lastSolvedMathRewardAt.soldiersBonus} força e ${lastSolvedMathRewardAt.summaryPt}!`,
    }))
  }, [activeEngineId, lastSolvedMathRewardAt])

  // Suporte a teclado (WASD / Setas + 1/2/3 para ativar construções/cartas)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysPressedRef.current.add(k)
      }
      if (['1', '2', '3'].includes(k) && simRef.current) {
        const idx = Number(k) - 1
        const pad = simRef.current.pads[idx]
        if (pad) {
          simRef.current.targetNormX = pad.normX
          simRef.current.targetNormY = pad.normY
          simRef.current.pendingPadId = pad.id
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const finishSimulation = (forcedOutcome?: 'VICTORY' | 'DEFEAT') => {
    const sim = simRef.current
    if (!sim || sim.finished) return
    sim.finished = true

    const outcome =
      forcedOutcome ?? (sim.baseHp > 0 && sim.playerForce > 0 ? 'VICTORY' : 'DEFEAT')
    const survivors =
      outcome === 'VICTORY'
        ? Math.max(1, Math.round(sim.playerForce * (0.65 + (sim.baseHp / sim.baseMaxHp) * 0.35)))
        : 0

    completeEngineRun({
      engineId: activeEngineId,
      outcome,
      playerArmy: sim.playerForce,
      enemyForce: baseEnemyForce,
      survivors,
      coinsEarned: Math.max(12, sim.coins + sim.wave * 15),
      starsEarned: outcome === 'VICTORY' ? (sim.maxCombo >= 2 ? 3 : 2) : 0,
      tokensEarned: 0,
      remaindersEarned: sim.remaindersEarned,
      maxCombo: sim.maxCombo,
      optimalChoices: sim.comboStreak,
      trapHits: [],
      practicedConcepts: [CONCEPT_BY_ENGINE[activeEngineId]],
      durationMs: Math.max(5000, Math.round(sim.elapsedMs)),
    })
  }

  // Executa a construção/upgrade específico de cada Engine (SEM terminar a rodada!)
  const executePadBuildOrUpgrade = (pad: TacticalBuildPad) => {
    const sim = simRef.current
    if (!sim || sim.finished) return

    sim.padClickCount += 1

    // Se o jogador clicar no botão da dock ou pisar no pad, permite construir se tiver moedas
    // (ou concede um subsídio tático mínimo caso clique direto no botão para manter fluidez)
    if (sim.coins < pad.costCoins) {
      sim.coins = Math.max(0, sim.coins)
    } else {
      sim.coins -= pad.costCoins
    }

    pad.level = Math.min(pad.maxLevel, pad.level + 1)
    pad.costCoins = Math.round(pad.costCoins * 1.35)

    sim.comboStreak += 1
    const mult = getComboMultiplier(sim.comboStreak)
    sim.maxCombo = Math.max(sim.maxCombo, mult)

    let feedbackMsg = ''

    if (pad.actionKind === 'build_archer_tower') {
      // Constrói nova Torre de Besteiros 2.5D ou evolui as existentes
      const towerSlots = [
        { x: 0.25, y: 0.34 },
        { x: 0.25, y: 0.66 },
        { x: 0.34, y: 0.24 },
        { x: 0.34, y: 0.76 },
      ]
      const existingTowers = sim.buildings.filter((b) => b.kind === 'archer_tower')
      if (existingTowers.length < towerSlots.length) {
        const slot = towerSlots[existingTowers.length]
        sim.buildings.push({
          id: `bldg_tower_${Date.now()}`,
          kind: 'archer_tower',
          tier: 1,
          normX: slot.x,
          normY: slot.y,
          fireCooldownMs: 100,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: `Torre Nv.1`,
        })
        feedbackMsg = '🏹 Nova Torre de Besteiros 2.5D erguida! (+3 Arqueiros atirando)'
      } else {
        for (const t of existingTowers) {
          t.tier = Math.min(3, t.tier + 1)
          t.label = `Bastião Nv.${t.tier}`
        }
        feedbackMsg = '🏰 Torres evoluídas para Bastião de Pedra (Cadência e Dano ×2)!'
      }
      sim.playerForce = Math.round(sim.playerForce * 1.25 + 8)
    } else if (pad.actionKind === 'build_mortar_tower') {
      const existingMortar = sim.buildings.find((b) => b.id === 'bldg_mortar')
      if (!existingMortar) {
        sim.buildings.push({
          id: 'bldg_mortar',
          kind: 'archer_tower',
          tier: 3,
          normX: 0.20,
          normY: 0.50,
          fireCooldownMs: 200,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Morteiro ÷3',
        })
      } else {
        existingMortar.tier = 3
      }
      sim.heroWeaponDmg = Math.round(sim.heroWeaponDmg * 1.35 + 4)
      sim.playerForce = Math.round(sim.playerForce * 1.3 + 10)
      feedbackMsg = '💣 Morteiro Real ÷3 ativado! Disparando bombas contra a Horda e o Boss!'
    } else if (pad.actionKind === 'repair_palisade') {
      sim.baseHp = Math.min(sim.baseMaxHp, sim.baseHp + 35)
      sim.alliedUnits.push({
        id: `guard_${Date.now()}`,
        kind: 'allied_archer',
        hp: 55,
        maxHp: 55,
        attackDmg: Math.max(6, Math.round(sim.heroWeaponDmg * 0.8)),
        normX: 0.28,
        normY: 0.42 + (sim.alliedUnits.length % 3) * 0.08,
        fireTimerMs: 0,
        carryWeightKg: 0,
        carryingState: 'combat',
      })
      sim.playerForce += 12
      feedbackMsg = '🛡️ Paliçada restaurada (+35 HP) e +1 Besteiro Real posicionado!'
    } else if (pad.actionKind === 'build_barracks') {
      // QUARTEL QUE TREINA EXÉRCITO ALIADO AUTÔNOMO!
      const barracksList = sim.buildings.filter((b) => b.kind === 'barracks')
      if (barracksList.length < 2) {
        sim.buildings.push({
          id: `bldg_barracks_${Date.now()}`,
          kind: 'barracks',
          tier: 1,
          normX: 0.36,
          normY: 0.62,
          fireCooldownMs: 0,
          trainProgressMs: 1800,
          trainIntervalMs: 3200,
          label: 'Quartel Nv.1',
        })
      } else {
        for (const b of barracksList) {
          b.tier = Math.min(3, b.tier + 1)
          b.trainIntervalMs = Math.max(1800, b.trainIntervalMs - 500)
          b.label = `Quartel Nv.${b.tier}`
        }
      }
      // Despacha imediatamente um esquadrão de soldados aliados saindo do quartel!
      for (let s = 0; s < 2; s++) {
        sim.alliedUnits.push({
          id: `soldier_${Date.now()}_${s}`,
          kind: 'allied_soldier',
          hp: 45 + pad.level * 12,
          maxHp: 45 + pad.level * 12,
          attackDmg: Math.max(6, Math.round(sim.heroWeaponDmg * 0.75)),
          normX: 0.42 + (s - 0.5) * 0.06,
          normY: 0.45 + (s - 0.5) * 0.06,
          fireTimerMs: s * 150,
          carryWeightKg: 0,
          carryingState: 'combat',
        })
      }
      sim.playerForce = Math.round(sim.playerForce * 1.25 + 10)
      feedbackMsg = '⛺ Quartel evoluído! Novos soldados aliados saíram marchando para atacar os inimigos!'
    } else if (pad.actionKind === 'build_tank_factory') {
      // FÁBRICA DE TANQUES QUE DESPACHA TANQUES ALIADOS 2.5D!
      const hasFactory = sim.buildings.find((b) => b.kind === 'tank_factory')
      if (!hasFactory) {
        sim.buildings.push({
          id: 'bldg_tank_factory',
          kind: 'tank_factory',
          tier: 1,
          normX: 0.62,
          normY: 0.40,
          fireCooldownMs: 0,
          trainProgressMs: 3500,
          trainIntervalMs: 6200,
          label: 'Fábrica de Tanques',
        })
      } else {
        hasFactory.tier = Math.min(3, hasFactory.tier + 1)
        hasFactory.trainIntervalMs = Math.max(4200, hasFactory.trainIntervalMs - 700)
      }
      // Já lança 1 Tanque Aliado Pesado imediatamente para o combate!
      sim.alliedUnits.push({
        id: `tank_${Date.now()}`,
        kind: 'allied_tank',
        hp: 160 + pad.level * 40,
        maxHp: 160 + pad.level * 40,
        attackDmg: Math.max(18, Math.round(sim.heroWeaponDmg * 1.8)),
        normX: 0.58,
        normY: 0.48,
        fireTimerMs: 0,
        carryWeightKg: 0,
        carryingState: 'combat',
      })
      sim.playerForce = Math.round(sim.playerForce * 1.35 + 18)
      feedbackMsg = '🚜 Fábrica de Blindados ativa! Tanque Aliado 2.5D avançando contra a Horda!'
    } else if (pad.actionKind === 'build_turret') {
      const turretCount = sim.buildings.filter((b) => b.kind === 'turret').length
      const turretCoords = [
        { x: 0.30, y: 0.28 },
        { x: 0.70, y: 0.28 },
        { x: 0.30, y: 0.72 },
        { x: 0.70, y: 0.72 },
      ]
      if (turretCount < turretCoords.length) {
        const tc = turretCoords[turretCount]
        sim.buildings.push({
          id: `bldg_turret_${Date.now()}`,
          kind: 'turret',
          tier: 1,
          normX: tc.x,
          normY: tc.y,
          fireCooldownMs: 120,
          trainProgressMs: 0,
          trainIntervalMs: 0,
          label: 'Torreta Dupla',
        })
      }
      sim.heroWeaponDmg = Math.round(sim.heroWeaponDmg * 1.35 + 4)
      for (const a of sim.alliedUnits) {
        a.attackDmg = Math.round(a.attackDmg * 1.25 + 2)
      }
      sim.playerForce = Math.round(sim.playerForce * 1.22 + 8)
      feedbackMsg = '🔫 Torreta Dupla instalada e Fuzis de todo o Exército Aliado melhorados!'
    } else if (pad.actionKind === 'hire_worker') {
      sim.alliedUnits.push({
        id: `worker_${Date.now()}`,
        kind: pad.level >= 3 ? 'worker_medium' : 'worker_small',
        hp: 55,
        maxHp: 55,
        attackDmg: Math.max(6, Math.round(sim.heroWeaponDmg * 0.7)),
        normX: 0.30 + (sim.alliedUnits.length % 4) * 0.08,
        normY: 0.62,
        fireTimerMs: 0,
        carryWeightKg: 45 + pad.level * 20,
        carryingState: 'seeking_rock',
      })
      sim.playerForce += 14
      feedbackMsg = '👷 Novo Operário contratado! Carregando blocos de granito para o Britador!'
    } else if (pad.actionKind === 'hire_titan') {
      sim.alliedUnits.push({
        id: `titan_${Date.now()}`,
        kind: 'worker_titan',
        hp: 150,
        maxHp: 150,
        attackDmg: Math.max(16, Math.round(sim.heroWeaponDmg * 1.6)),
        normX: 0.45,
        normY: 0.58,
        fireTimerMs: 0,
        carryWeightKg: 180,
        carryingState: 'seeking_rock',
      })
      sim.playerForce = Math.round(sim.playerForce * 1.35 + 20)
      feedbackMsg = '🗿 Titã Carregador em campo! Esmaga Golems e carrega rochas gigantes!'
    } else if (pad.actionKind === 'upgrade_crusher') {
      const crusher = sim.buildings.find((b) => b.kind === 'quarry_crusher')
      if (crusher) {
        crusher.tier = Math.min(3, crusher.tier + 1)
        crusher.label = `Britador ÷10 Nv.${crusher.tier}`
      }
      sim.heroWeaponDmg = Math.round(sim.heroWeaponDmg * 1.3 + 4)
      sim.playerForce = Math.round(sim.playerForce * 1.25 + 12)
      feedbackMsg = '⚙️ Turbo Britador ÷10 evoluído! Produção de Lingotes de Ouro dobrada!'
    } else if (pad.actionKind === 'add_squad_gunner') {
      sim.alliedUnits.push({
        id: `gunner_${Date.now()}`,
        kind: 'allied_archer',
        hp: 65,
        maxHp: 65,
        attackDmg: Math.max(7, Math.round(sim.heroWeaponDmg * 0.85)),
        normX: sim.heroNormX + ((sim.alliedUnits.length % 3) - 1) * 0.06,
        normY: sim.heroNormY + 0.05,
        fireTimerMs: 0,
        carryWeightKg: 0,
        carryingState: 'combat',
      })
      sim.playerForce = Math.round(sim.playerForce * 1.25 + 12)
      feedbackMsg = `🪖 +1 Atirador de Elite no Esquadrão (${sim.alliedUnits.length + 1} atirando juntos)!`
    } else if (pad.actionKind === 'upgrade_plasma_rifle') {
      sim.heroWeaponDmg = Math.round(sim.heroWeaponDmg * 1.4 + 5)
      sim.heroFireCadenceMs = Math.max(140, Math.round(sim.heroFireCadenceMs * 0.82))
      for (const a of sim.alliedUnits) {
        a.attackDmg = Math.round(a.attackDmg * 1.3 + 3)
      }
      sim.playerForce = Math.round(sim.playerForce * 1.28 + 10)
      feedbackMsg = '⚡ Armas evoluídas para Feixe Duplo de Plasma (+40% Cadência e Dano)!'
    } else if (pad.actionKind === 'deploy_mecha') {
      sim.alliedUnits.push({
        id: `mecha_${Date.now()}`,
        kind: 'allied_mecha',
        hp: 180,
        maxHp: 180,
        attackDmg: Math.max(15, Math.round(sim.heroWeaponDmg * 1.5)),
        normX: 0.50 + ((sim.alliedUnits.length % 2) === 0 ? -0.14 : 0.14),
        normY: 0.50,
        fireTimerMs: 0,
        carryWeightKg: 0,
        carryingState: 'combat',
      })
      sim.playerForce = Math.round(sim.playerForce * 1.32 + 16)
      feedbackMsg = '🤖 Sentinela Mecha 360° ativada na Arena!'
    }

    soundEngine.playGatePass(sim.playerForce, true)
    particlePoolRef.current.spawnBurst(
      pad.normX * 420,
      pad.normY * 620,
      '#34d399',
      16,
      reducedMotion,
    )

    // Sincronizar imediatamente com o HUD global
    useLogicBattleStore.setState((s) => ({
      snapshot: {
        ...s.snapshot,
        currentArmy: sim.playerForce,
      },
    }))

    // Se todas as construções chegarem ao nível máximo de Sobrecarga Real (ex: 12+ upgrades seguidos),
    // dispara a Salva Suprema da Fortaleza que aniquila a Horda e o Boss!
    if (sim.padClickCount >= 12) {
      finishSimulation('VICTORY')
      return
    }

    const bossUnit = sim.enemies.find((e) => e.isBoss)
    setHudState({
      wave: sim.wave,
      maxWaves: sim.maxWaves,
      playerForce: sim.playerForce,
      baseHp: Math.round(sim.baseHp),
      baseMaxHp: sim.baseMaxHp,
      coins: sim.coins,
      comboStreak: sim.comboStreak,
      comboMult: mult,
      enemiesLeft:
        Math.max(0, sim.waveEnemiesToSpawn - sim.waveEnemiesSpawned) + sim.enemies.length,
      bossHp: bossUnit ? Math.max(0, Math.round(bossUnit.hp)) : 0,
      bossMaxHp: bossUnit ? bossUnit.maxHp : Math.max(120, snapshot.enemy.bossHp * 2),
      statusText: feedbackMsg,
      pads: [...sim.pads],
      alliedCount: sim.alliedUnits.length,
    })
  }

  // Loop imperativo de 60 FPS
  useEffect(() => {
    let rafId = 0
    let lastPerf = performance.now()
    let hudSyncTimer = 0

    const step = (now: number) => {
      const rawDtMs = Math.min(64, Math.max(8, now - lastPerf))
      lastPerf = now
      const isMathModalOpen =
        useLogicBattleStore.getState().activeMathChallenge !== null
      const dtMs = isMathModalOpen ? 0 : rawDtMs

      const canvas = canvasRef.current
      const sim = simRef.current
      if (canvas && sim && !sim.finished) {
        sim.elapsedMs += dtMs
        sim.spawnTimerMs += dtMs
        sim.fireTimerMs += dtMs
        hudSyncTimer += dtMs

        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const rect = canvas.getBoundingClientRect()
        const w = Math.max(320, Math.round(rect.width || 420))
        const h = Math.max(400, Math.round(rect.height || 620))
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr
          canvas.height = h * dpr
        }

        // 1. Movimento suave do Comandante (WASD / Toque / Mouse)
        const keys = keysPressedRef.current
        let keyDx = 0
        let keyDy = 0
        if (keys.has('a') || keys.has('arrowleft')) keyDx -= 1
        if (keys.has('d') || keys.has('arrowright')) keyDx += 1
        if (keys.has('w') || keys.has('arrowup')) keyDy -= 1
        if (keys.has('s') || keys.has('arrowdown')) keyDy += 1

        if (keyDx !== 0 || keyDy !== 0) {
          const len = Math.hypot(keyDx, keyDy) || 1
          const speed = 0.00034 * dtMs
          sim.heroNormX = Math.max(0.10, Math.min(0.90, sim.heroNormX + (keyDx / len) * speed))
          sim.heroNormY = Math.max(0.18, Math.min(0.84, sim.heroNormY + (keyDy / len) * speed))
          sim.targetNormX = sim.heroNormX
          sim.targetNormY = sim.heroNormY
          sim.walkPhase += dtMs * 0.015
        } else {
          const dx = sim.targetNormX - sim.heroNormX
          const dy = sim.targetNormY - sim.heroNormY
          const dist = Math.hypot(dx, dy)
          if (dist > 0.005) {
            const maxStep = 0.00038 * dtMs
            const ratio = Math.min(1, maxStep / dist)
            sim.heroNormX += dx * ratio
            sim.heroNormY += dy * ratio
            sim.walkPhase += dtMs * 0.015
          }
        }

        ;(window as unknown as { __lbHeroPos?: { x: number; y: number } }).__lbHeroPos = {
          x: sim.heroNormX,
          y: sim.heroNormY,
        }

        // Se chegou até um Pad clicado no chão, constrói/evolui
        if (sim.pendingPadId) {
          const targetPad = sim.pads.find((p) => p.id === sim.pendingPadId)
          if (targetPad) {
            const dPad = Math.hypot(sim.heroNormX - targetPad.normX, sim.heroNormY - targetPad.normY)
            if (dPad <= 0.085) {
              sim.pendingPadId = null
              executePadBuildOrUpgrade(targetPad)
            }
          }
        }

        // 2. Coleta magnética de Moedas de Ouro (🪙) no chão pelo Herói (ou auto-coleta após 3.2s)
        for (let i = sim.droppedCoins.length - 1; i >= 0; i--) {
          const coin = sim.droppedCoins[i]
          coin.ageMs += dtMs
          const dHero = Math.hypot(coin.normX - sim.heroNormX, coin.normY - sim.heroNormY)
          if (dHero < 0.24 || coin.ageMs > 2800) {
            coin.normX += (sim.heroNormX - coin.normX) * Math.min(1, dtMs * 0.014)
            coin.normY += (sim.heroNormY - coin.normY) * Math.min(1, dtMs * 0.014)
          }
          if (dHero < 0.055 || coin.ageMs > 3600) {
            sim.coins += coin.amount
            sim.droppedCoins.splice(i, 1)
          }
        }

        // 3. Spawn de Inimigos por Onda (4 Ondas Longas + Boss Caminhante na Onda 4!)
        const spawnInterval = Math.max(680, 1450 - sim.wave * 150)
        if (
          sim.waveEnemiesSpawned < sim.waveEnemiesToSpawn &&
          sim.spawnTimerMs >= spawnInterval &&
          sim.enemies.length < 14
        ) {
          sim.spawnTimerMs = 0
          sim.waveEnemiesSpawned += 1

          const angle = sim.rngNextFloat() * Math.PI * 2
          const enemyHpBase = Math.max(
            18,
            Math.round((baseEnemyForce / 8) * (0.75 + sim.wave * 0.35)),
          )
          let spawnX = 0.94
          let spawnY = 0.22 + sim.rngNextFloat() * 0.56
          let enemyKind: UnitSpriteKind = 'enemy_goblin'

          if (activeEngineId === 'cerco_torres') {
            spawnX = 0.95
            spawnY = 0.22 + sim.rngNextFloat() * 0.56
            enemyKind = 'enemy_goblin'
          } else if (activeEngineId === 'forte_bandeira') {
            const side = Math.floor(sim.rngNextFloat() * 3)
            spawnX = side === 0 ? 0.94 : side === 1 ? 0.06 : 0.2 + sim.rngNextFloat() * 0.6
            spawnY = side === 2 ? 0.08 : 0.22 + sim.rngNextFloat() * 0.55
            enemyKind =
              sim.wave >= 2 && sim.waveEnemiesSpawned % 4 === 0
                ? 'enemy_tank'
                : 'enemy_rifleman'
          } else if (activeEngineId === 'pedreira_rei') {
            spawnX = 0.62 + sim.rngNextFloat() * 0.28
            spawnY = 0.16 + sim.rngNextFloat() * 0.38
            enemyKind = 'enemy_goblin'
          } else {
            // Arena 360°
            spawnX = 0.5 + Math.cos(angle) * 0.46
            spawnY = 0.5 + Math.sin(angle) * 0.42
            enemyKind = 'enemy_zombie'
          }

          const finalHp = enemyKind === 'enemy_tank' ? enemyHpBase * 2.2 : enemyHpBase
          sim.enemies.push({
            id: `en_w${sim.wave}_${sim.waveEnemiesSpawned}_${sim.elapsedMs}`,
            kind: enemyKind,
            isBoss: false,
            hp: Math.round(finalHp),
            maxHp: Math.round(finalHp),
            normX: spawnX,
            normY: spawnY,
            speed: enemyKind === 'enemy_tank' ? 0.000048 : 0.000068 + sim.wave * 0.000008,
            attackTimerMs: 0,
            rewardCoins: enemyKind === 'enemy_tank' ? 12 : 6,
            rockWeightKg:
              activeEngineId === 'pedreira_rei'
                ? [30, 80, 150, 300][Math.min(3, sim.wave - 1)]
                : undefined,
          })
        }

        // Spawn do BOSS CAMINHANTE 2.5D na Onda 4 (ou Mini-Boss na Onda 2)
        if (
          (sim.wave === sim.maxWaves || sim.wave === 2) &&
          !sim.bossSpawnedInWave &&
          sim.waveEnemiesSpawned >= Math.ceil(sim.waveEnemiesToSpawn * 0.5)
        ) {
          sim.bossSpawnedInWave = true
          const isFinalBoss = sim.wave === sim.maxWaves
          const bossHpVal = Math.round(
            Math.max(140, snapshot.enemy.bossHp * (isFinalBoss ? 2.8 : 1.2)),
          )
          const bossKindMap: Record<EngineId, BossSpriteKind> = {
            ponte_portoes: 'siege_giant',
            cerco_torres: 'siege_giant',
            forte_bandeira: 'fort_tank_boss',
            pedreira_rei: 'quarry_golem_boss',
            arena_ondas: 'arena_minotaur_boss',
            serpente_numeros: 'siege_giant',
          }
          sim.enemies.push({
            id: `boss_w${sim.wave}_${sim.elapsedMs}`,
            kind: 'enemy_tank',
            isBoss: true,
            bossKind: bossKindMap[activeEngineId],
            hp: bossHpVal,
            maxHp: bossHpVal,
            normX: 0.92,
            normY: 0.48,
            speed: 0.000034,
            attackTimerMs: 0,
            rewardCoins: 35,
          })
        }

        // Verificar avanço de Onda (SÓ avança quando todos os inimigos da onda atual forem derrotados!)
        if (
          sim.waveEnemiesSpawned >= sim.waveEnemiesToSpawn &&
          sim.enemies.length === 0
        ) {
          if (sim.wave < sim.maxWaves) {
            sim.wave += 1
            sim.waveEnemiesToSpawn = 7 + sim.wave * 3
            sim.waveEnemiesSpawned = 0
            sim.bossSpawnedInWave = false
            sim.coins += 12
            soundEngine.playVaiUmMerge(1)
          } else {
            // Todas as 4 ondas + Boss derrotados!
            finishSimulation('VICTORY')
            return
          }
        }

        // 4. Atualização dos Edifícios 2.5D:
        //    - Quartéis e Fábricas de Tanques treinam Soldados e Tanques Aliados continuamente!
        //    - Torres de Besteiros, Morteiros e Torretas atiram na Horda e no Boss!
        for (const bldg of sim.buildings) {
          if (bldg.kind === 'barracks' || bldg.kind === 'tank_factory') {
            bldg.trainProgressMs += dtMs
            if (
              bldg.trainProgressMs >= bldg.trainIntervalMs &&
              sim.alliedUnits.length < 12
            ) {
              bldg.trainProgressMs = 0
              const isTank = bldg.kind === 'tank_factory'
              const unitHp = isTank
                ? 150 + bldg.tier * 45
                : 40 + bldg.tier * 18
              const unitDmg = isTank
                ? Math.max(16, Math.round(sim.heroWeaponDmg * 1.6))
                : Math.max(6, Math.round(sim.heroWeaponDmg * 0.75))
              sim.alliedUnits.push({
                id: `trained_${bldg.kind}_${sim.elapsedMs}_${Math.random()}`,
                kind: isTank ? 'allied_tank' : 'allied_soldier',
                hp: unitHp,
                maxHp: unitHp,
                attackDmg: unitDmg,
                normX: bldg.normX + (sim.rngNextFloat() - 0.5) * 0.06,
                normY: bldg.normY + 0.06,
                fireTimerMs: 0,
                carryWeightKg: 0,
                carryingState: 'combat',
              })
            }
          }

          if (bldg.kind === 'archer_tower' || bldg.kind === 'turret') {
            bldg.fireCooldownMs -= dtMs
            if (bldg.fireCooldownMs <= 0 && sim.enemies.length > 0) {
              const isMortar = bldg.tier >= 3 && bldg.kind === 'archer_tower'
              bldg.fireCooldownMs = isMortar
                ? 950
                : Math.max(260, 580 - bldg.tier * 110)
              // Prioriza o Boss ou o inimigo mais próximo da base
              const target = sim.enemies.reduce((best, curr) =>
                curr.isBoss || curr.normX < best.normX ? curr : best,
              )
              const shots = bldg.kind === 'archer_tower' ? Math.min(3, bldg.tier + 1) : 2
              for (let s = 0; s < shots; s++) {
                projectilePoolRef.current.spawnProjectile(
                  isMortar ? 'cannon' : bldg.tier >= 2 ? 'spear' : 'arrow',
                  bldg.normX * w,
                  (bldg.normY - 0.04) * h + (s - 1) * 6,
                  target.normX * w,
                  target.normY * h,
                  isMortar ? 300 : 380,
                )
              }
            }
          }
        }

        // 5. Atualização das Unidades Aliadas Autônomas:
        //    - No Forte: Soldados e Tanques saem marchando para atacar os inimigos e o Boss!
        //    - Na Pedreira: Operários e Titãs caminham até os blocos de rocha, levam ao Britador (÷10) e geram Lingotes!
        //    - Na Arena/Torres: Esquadrão e Sentinelas Mecha acompanham e fuzilam os inimigos!
        for (let i = sim.alliedUnits.length - 1; i >= 0; i--) {
          const ally = sim.alliedUnits[i]
          ally.fireTimerMs += dtMs

          if (
            activeEngineId === 'pedreira_rei' &&
            (ally.kind === 'worker_small' ||
              ally.kind === 'worker_medium' ||
              ally.kind === 'worker_titan')
          ) {
            const crusher = sim.buildings.find((b) => b.kind === 'quarry_crusher')
            const crusherX = crusher ? crusher.normX : 0.22
            const crusherY = crusher ? crusher.normY : 0.42

            if (ally.carryingState === 'to_crusher') {
              const dx = crusherX - ally.normX
              const dy = crusherY - ally.normY
              const d = Math.hypot(dx, dy)
              if (d <= 0.05) {
                // Entregou o bloco de granito no Britador (÷10)!
                ally.carryingState = 'seeking_rock'
                const crusherTier = crusher ? crusher.tier : 1
                const coinsGenerated = Math.round(8 * crusherTier)
                sim.coins += coinsGenerated
                sim.ingotsStacked += crusherTier
                sim.remaindersEarned += 1
                const pallet = sim.buildings.find((b) => b.kind === 'ingot_pallet')
                if (pallet) {
                  pallet.tier = Math.min(3, 1 + Math.floor(sim.ingotsStacked / 3))
                }
                projectilePoolRef.current.spawnDamageText(
                  crusherX * w,
                  crusherY * h - 22,
                  `+🪙${coinsGenerated} Lingote!`,
                  '#facc15',
                )
              } else {
                const stepW = 0.00018 * dtMs
                ally.normX += (dx / d) * stepW
                ally.normY += (dy / d) * stepW
              }
            } else if (sim.enemies.length > 0) {
              // Caminha até o bloco de rocha / Golem mais próximo na jazida
              const rock = sim.enemies[0]
              const dx = rock.normX - ally.normX
              const dy = rock.normY - ally.normY
              const d = Math.hypot(dx, dy)
              if (d <= 0.08) {
                rock.hp -= ally.attackDmg * (dtMs * 0.004)
                if (ally.fireTimerMs >= 480) {
                  ally.fireTimerMs = 0
                  ally.carryingState = 'to_crusher'
                }
              } else {
                const stepW = 0.00020 * dtMs
                ally.normX += (dx / d) * stepW
                ally.normY += (dy / d) * stepW
              }
            }
            continue
          }

          if (activeEngineId === 'arena_ondas' && ally.kind !== 'allied_mecha') {
            // Na Arena, os atiradores do esquadrão movem-se em formação tática com o Herói
            const angle = (i / Math.max(1, sim.alliedUnits.length)) * Math.PI * 2
            const formX = sim.heroNormX + Math.cos(angle) * 0.065
            const formY = sim.heroNormY + Math.sin(angle) * 0.065
            ally.normX += (formX - ally.normX) * Math.min(1, dtMs * 0.01)
            ally.normY += (formY - ally.normY) * Math.min(1, dtMs * 0.01)
          } else if (activeEngineId === 'forte_bandeira' && sim.enemies.length > 0) {
            // No Forte, Soldados e Tanques Aliados MARCHAM PARA FORA DO FORTE em direção aos inimigos!
            const nearestEnemy = sim.enemies.reduce((best, curr) => {
              const dCurr = Math.hypot(curr.normX - ally.normX, curr.normY - ally.normY)
              const dBest = Math.hypot(best.normX - ally.normX, best.normY - ally.normY)
              return dCurr < dBest ? curr : best
            })
            const dx = nearestEnemy.normX - ally.normX
            const dy = nearestEnemy.normY - ally.normY
            const dist = Math.hypot(dx, dy)
            // Mantém distância de tiro tático (0.14) enquanto avança
            if (dist > 0.14) {
              const marchSpeed = ally.kind === 'allied_tank' ? 0.00011 : 0.00015
              ally.normX += (dx / dist) * marchSpeed * dtMs
              ally.normY += (dy / dist) * marchSpeed * dtMs
            }
          }

          // Disparo autônomo dos Soldados, Tanques, Besteiros e Mechas Aliados
          const allyCadence =
            ally.kind === 'allied_tank'
              ? 780
              : ally.kind === 'allied_mecha'
                ? 280
                : 520
          if (ally.fireTimerMs >= allyCadence && sim.enemies.length > 0) {
            ally.fireTimerMs = 0
            const target = sim.enemies.reduce((best, curr) => {
              const dCurr = Math.hypot(curr.normX - ally.normX, curr.normY - ally.normY)
              const dBest = Math.hypot(best.normX - ally.normX, best.normY - ally.normY)
              return dCurr < dBest ? curr : best
            })
            projectilePoolRef.current.spawnProjectile(
              ally.kind === 'allied_tank'
                ? 'cannon'
                : ally.kind === 'allied_mecha'
                  ? 'spear'
                  : 'arrow',
              ally.normX * w,
              ally.normY * h - 10,
              target.normX * w,
              target.normY * h,
              360,
            )
          }
        }

        // 6. Disparo contínuo do próprio Herói/Comandante
        if (sim.fireTimerMs >= sim.heroFireCadenceMs && sim.enemies.length > 0) {
          sim.fireTimerMs = 0
          const target = sim.enemies.reduce((best, curr) => {
            const dCurr = Math.hypot(curr.normX - sim.heroNormX, curr.normY - sim.heroNormY)
            const dBest = Math.hypot(best.normX - sim.heroNormX, best.normY - sim.heroNormY)
            return dCurr < dBest ? curr : best
          })
          const heroShots = sim.heroFireCadenceMs < 260 ? 2 : 1
          for (let s = 0; s < heroShots; s++) {
            projectilePoolRef.current.spawnProjectile(
              sim.heroWeaponDmg >= 18 ? 'cannon' : 'spear',
              sim.heroNormX * w + (s - 0.5) * 10,
              sim.heroNormY * h - 14,
              target.normX * w,
              target.normY * h,
              410,
            )
          }
        }

        // 7. Movimento e Ataque dos Inimigos + Boss Caminhante
        for (let i = sim.enemies.length - 1; i >= 0; i--) {
          const en = sim.enemies[i]
          en.attackTimerMs += dtMs

          // Alvo prioritário do inimigo: Soldado/Tanque Aliado próximo, ou a Base/Paliçada/Herói
          let targetX = sim.heroNormX
          let targetY = sim.heroNormY
          let targetAlly: AlliedAutonomousUnit | null = null

          if (activeEngineId === 'cerco_torres') {
            targetX = 0.28 // Linha da Paliçada de Madeira
            targetY = en.normY
          } else if (activeEngineId === 'pedreira_rei') {
            targetX = 0.24 // Máquina Britadeira
            targetY = 0.44
          } else if (sim.alliedUnits.length > 0 && activeEngineId === 'forte_bandeira') {
            targetAlly = sim.alliedUnits.reduce((best, curr) => {
              const dCurr = Math.hypot(curr.normX - en.normX, curr.normY - en.normY)
              const dBest = Math.hypot(best.normX - en.normX, best.normY - en.normY)
              return dCurr < dBest ? curr : best
            })
            if (
              Math.hypot(targetAlly.normX - en.normX, targetAlly.normY - en.normY) <
              0.28
            ) {
              targetX = targetAlly.normX
              targetY = targetAlly.normY
            } else {
              targetAlly = null
              targetX = 0.50
              targetY = 0.50
            }
          }

          const dx = targetX - en.normX
          const dy = targetY - en.normY
          const dist = Math.hypot(dx, dy) || 0.001

          const stopDist = activeEngineId === 'cerco_torres' ? 0.04 : 0.075
          if (dist > stopDist) {
            en.normX += (dx / dist) * en.speed * dtMs
            en.normY += (dy / dist) * en.speed * dtMs
          } else if (en.attackTimerMs >= 850) {
            en.attackTimerMs = 0
            const enemyDmg = en.isBoss ? 7 : 2.5
            if (targetAlly) {
              targetAlly.hp -= enemyDmg * 2.2
              if (targetAlly.hp <= 0) {
                const idx = sim.alliedUnits.indexOf(targetAlly)
                if (idx >= 0) sim.alliedUnits.splice(idx, 1)
              }
            } else {
              sim.baseHp = Math.max(0, sim.baseHp - enemyDmg)
              sim.playerForce = Math.max(1, Math.round(sim.playerForce - (en.isBoss ? 2 : 1)))
              if (sim.baseHp <= 0) {
                finishSimulation('DEFEAT')
                return
              }
            }
          }
        }

        // 8. Desenhar o Palco 2.5D Específico de cada Engine
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          // Fundo 2.5D rico conforme a Engine
          const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
          if (activeEngineId === 'cerco_torres') {
            bgGrad.addColorStop(0, '#14532d')
            bgGrad.addColorStop(0.55, '#166534')
            bgGrad.addColorStop(1, '#064e3b')
          } else if (activeEngineId === 'forte_bandeira') {
            bgGrad.addColorStop(0, '#3f3f46')
            bgGrad.addColorStop(0.5, '#27272a')
            bgGrad.addColorStop(1, '#18181b')
          } else if (activeEngineId === 'pedreira_rei') {
            bgGrad.addColorStop(0, '#44403c')
            bgGrad.addColorStop(0.55, '#292524')
            bgGrad.addColorStop(1, '#1c1917')
          } else {
            bgGrad.addColorStop(0, '#1e1b4b')
            bgGrad.addColorStop(0.5, '#0f172a')
            bgGrad.addColorStop(1, '#020617')
          }
          ctx.fillStyle = bgGrad
          ctx.fillRect(0, 0, w, h)

          // Lajes / Terreno isométrico 2.5D
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
          ctx.lineWidth = 1
          for (let gx = 0; gx < w; gx += 44) {
            ctx.beginPath()
            ctx.moveTo(gx, 0)
            ctx.lineTo(gx, h)
            ctx.stroke()
          }
          for (let gy = 0; gy < h; gy += 36) {
            ctx.beginPath()
            ctx.moveTo(0, gy)
            ctx.lineTo(w, gy)
            ctx.stroke()
          }

          if (activeEngineId === 'cerco_torres') {
            // Estrada de Cerco + Paliçada de Madeira Curvada 2.5D (como no Kingshot!)
            ctx.fillStyle = 'rgba(120, 53, 15, 0.45)'
            ctx.beginPath()
            ctx.roundRect(w * 0.28, h * 0.16, w * 0.72, h * 0.68, 24)
            ctx.fill()

            const palisadeSprite = getPropSprite('wood_palisade')
            for (let py = 0.16; py <= 0.84; py += 0.085) {
              ctx.drawImage(
                palisadeSprite,
                w * 0.29 - 24,
                h * py - 24,
                48,
                48,
              )
            }
          } else if (activeEngineId === 'forte_bandeira') {
            // Muralha de Sacos de Areia 2.5D do Forte Militar + Bandeira Central
            ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'
            ctx.strokeStyle = '#94a3b8'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.roundRect(w * 0.26, h * 0.24, w * 0.48, h * 0.52, 20)
            ctx.fill()
            ctx.stroke()

            // Mastro e Bandeira Real no centro do Forte
            ctx.strokeStyle = '#f8fafc'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.moveTo(w * 0.5, h * 0.5)
            ctx.lineTo(w * 0.5, h * 0.5 - 42)
            ctx.stroke()
            ctx.fillStyle = '#38bdf8'
            ctx.beginPath()
            ctx.moveTo(w * 0.5, h * 0.5 - 42)
            ctx.lineTo(w * 0.5 + 26, h * 0.5 - 33)
            ctx.lineTo(w * 0.5, h * 0.5 - 24)
            ctx.closePath()
            ctx.fill()
          } else if (activeEngineId === 'pedreira_rei') {
            // Área da Jazida de Granito (direita/topo)
            ctx.fillStyle = 'rgba(120, 113, 108, 0.25)'
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(w * 0.54, h * 0.12, w * 0.40, h * 0.46, 18)
            ctx.fill()
            ctx.stroke()
          } else if (activeEngineId === 'arena_ondas') {
            // Anel Verde Tático de Alcance ao redor do Esquadrão (fiel a ZW-Shooting!)
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)'
            ctx.fillStyle = 'rgba(34, 197, 94, 0.06)'
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(sim.heroNormX * w, sim.heroNormY * h, 115, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          }

          // Desenhar Pads de Construção no chão (Estilo Kingshot / Top Force / Quarry)
          for (const pad of sim.pads) {
            const px = pad.normX * w
            const py = pad.normY * h
            const canAfford = sim.coins >= pad.costCoins
            ctx.fillStyle = canAfford
              ? 'rgba(16, 185, 129, 0.22)'
              : 'rgba(15, 23, 42, 0.65)'
            ctx.strokeStyle = canAfford ? '#34d399' : '#64748b'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.roundRect(px - 36, py + 16, 72, 22, 7)
            ctx.fill()
            ctx.stroke()

            ctx.fillStyle = '#fef08a'
            ctx.font = '800 10px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(`${pad.icon} 🪙${pad.costCoins}`, px, py + 27)
          }

          // Desenhar Edifícios 2.5D construídos (Torres, Quartéis, Fábrica de Tanque, Britador, Castelo)
          const animTick = Math.floor(sim.elapsedMs / 180)
          for (const bldg of sim.buildings) {
            const bx = bldg.normX * w
            const by = bldg.normY * h
            const sprite = getBuildingSprite(bldg.kind, bldg.tier, animTick)
            ctx.drawImage(sprite, bx - 46, by - 52, 92, 92)

            // Se for Quartel ou Fábrica de Tanques, desenha a barra de treinamento da próxima tropa!
            if (bldg.kind === 'barracks' || bldg.kind === 'tank_factory') {
              const ratio = Math.min(1, bldg.trainProgressMs / Math.max(1, bldg.trainIntervalMs))
              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
              ctx.fillRect(bx - 28, by - 54, 56, 8)
              ctx.fillStyle = bldg.kind === 'tank_factory' ? '#f59e0b' : '#38bdf8'
              ctx.fillRect(bx - 26, by - 52, 52 * ratio, 4)
            }

            ctx.fillStyle = '#e2e8f0'
            ctx.font = '800 10px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(bldg.label, bx, by + 38)
          }

          // Desenhar Moedas de Ouro 2.5D (🪙) no chão
          const coinSprite = getPropSprite('gold_coin')
          for (const coin of sim.droppedCoins) {
            ctx.drawImage(coinSprite, coin.normX * w - 12, coin.normY * h - 12, 24, 24)
          }

          // Desenhar Unidades Aliadas Autônomas 2.5D (Soldados do Quartel, Tanques, Operários, Mechas)
          const rockProp = getPropSprite('granite_block')
          for (const ally of sim.alliedUnits) {
            const ax = ally.normX * w
            const ay = ally.normY * h
            const uSprite = getUnitSprite(ally.kind, animTick)
            ctx.drawImage(uSprite, ax - 26, ay - 30, 52, 52)

            // Se for operário voltando ao Britador, desenha o bloco de granito acima da cabeça!
            if (ally.carryingState === 'to_crusher') {
              ctx.drawImage(rockProp, ax - 14, ay - 44, 28, 28)
            }

            // Banner numérico + barra de vida verde sobre cada soldado/tanque aliado (como no Top Force!)
            const hpRatio = Math.max(0, Math.min(1, ally.hp / ally.maxHp))
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
            ctx.fillRect(ax - 16, ay - 34, 32, 9)
            ctx.fillStyle = '#22c55e'
            ctx.fillRect(ax - 15, ay - 33, 30 * hpRatio, 7)
            ctx.fillStyle = '#ffffff'
            ctx.font = '900 8px Inter, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(String(Math.ceil(ally.hp)), ax, ay - 29)
          }

          // Desenhar Inimigos 2.5D e o BOSS CAMINHANTE 2.5D
          for (const en of sim.enemies) {
            const ex = en.normX * w
            const ey = en.normY * h

            if (en.isBoss && en.bossKind) {
              const bSprite = getBossSprite(en.bossKind, animTick)
              ctx.drawImage(bSprite, ex - 54, ey - 62, 108, 108)

              // Barra de Vida Grande do Boss Caminhante
              const bRatio = Math.max(0, Math.min(1, en.hp / en.maxHp))
              ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
              ctx.strokeStyle = '#facc15'
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.roundRect(ex - 44, ey - 70, 88, 14, 5)
              ctx.fill()
              ctx.stroke()

              ctx.fillStyle = '#dc2626'
              ctx.fillRect(ex - 42, ey - 68, 84 * bRatio, 10)
              ctx.fillStyle = '#fef08a'
              ctx.font = '900 10px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(
                `👑 BOSS ${formatArmy(Math.ceil(en.hp), notationMode)}`,
                ex,
                ey - 63,
              )
            } else if (activeEngineId === 'pedreira_rei') {
              // Bloco de Granito Bruto 2.5D + Golem na Pedreira
              ctx.drawImage(rockProp, ex - 22, ey - 22, 44, 44)
              ctx.fillStyle = '#fef08a'
              ctx.font = '900 10px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(`${Math.ceil(en.hp)}kg`, ex, ey - 26)
            } else {
              const eSprite = getUnitSprite(en.kind, animTick)
              const sz = en.kind === 'enemy_tank' ? 62 : 48
              ctx.drawImage(eSprite, ex - sz / 2, ey - sz / 2, sz, sz)

              // Barra de HP vermelha do inimigo
              const eRatio = Math.max(0, Math.min(1, en.hp / en.maxHp))
              ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
              ctx.fillRect(ex - 16, ey - 28, 32, 8)
              ctx.fillStyle = '#ef4444'
              ctx.fillRect(ex - 15, ey - 27, 30 * eRatio, 6)
              ctx.fillStyle = '#ffffff'
              ctx.font = '900 8px Inter, system-ui, sans-serif'
              ctx.textAlign = 'center'
              ctx.fillText(String(Math.ceil(en.hp)), ex, ey - 23)
            }
          }

          // Desenhar o Herói/Comandante Coroado 2.5D
          const hx = sim.heroNormX * w
          const hy = sim.heroNormY * h
          const heroSprite = getUnitSprite('crowned_hero', Math.floor(sim.walkPhase))
          ctx.drawImage(heroSprite, hx - 30, hy - 36, 60, 60)

          // Badge do Poder / Moedas sobre o Herói
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.roundRect(hx - 28, hy - 48, 56, 16, 6)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#fef08a'
          ctx.font = '900 10px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`🪙 ${sim.coins}`, hx, hy - 40)

          // V6: Desenhar Altar / Santuário Matemático 2.5D no canto superior direito do campo (0.84, 0.24)
          const shrineX = 0.84 * w
          const shrineY = 0.24 * h
          const shrineName =
            activeEngineId === 'cerco_torres'
              ? '🧮 Cristal Alquímico'
              : activeEngineId === 'forte_bandeira'
                ? '🧮 Academia Militar'
                : activeEngineId === 'pedreira_rei'
                  ? '🧮 Geodo de Ouro'
                  : '🧮 Cápsula Orbital'
          ctx.save()
          ctx.fillStyle = 'rgba(250, 204, 21, 0.25)'
          ctx.beginPath()
          ctx.ellipse(shrineX, shrineY + 14, 34, 14, 0, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = 'rgba(30, 41, 59, 0.92)'
          ctx.strokeStyle = '#facc15'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.roundRect(shrineX - 48, shrineY - 26, 96, 44, 10)
          ctx.fill()
          ctx.stroke()

          ctx.fillStyle = '#fef08a'
          ctx.font = '900 10px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(shrineName, shrineX, shrineY - 11)
          ctx.fillStyle = '#4ade80'
          ctx.font = '800 9px Inter, system-ui, sans-serif'
          ctx.fillText('FAZER CONTA (+🪙/🪖)', shrineX, shrineY + 6)
          ctx.restore()

          // 9. Atualizar Projéteis e Colisões Reais com o HP dos Inimigos e do Boss
          projectilePoolRef.current.updateAndDraw(
            ctx,
            dtMs,
            (hitX, hitY, kind) => {
              particlePoolRef.current.spawnBurst(
                hitX,
                hitY,
                kind === 'cannon' ? '#facc15' : '#38bdf8',
                5,
                reducedMotion,
              )

              if (sim.enemies.length > 0) {
                const hitEnemy = sim.enemies.reduce((best, curr) => {
                  const dCurr = Math.hypot(curr.normX * w - hitX, curr.normY * h - hitY)
                  const dBest = Math.hypot(best.normX * w - hitX, best.normY * h - hitY)
                  return dCurr < dBest ? curr : best
                })
                const dmg =
                  kind === 'cannon'
                    ? Math.round(sim.heroWeaponDmg * 1.45)
                    : kind === 'spear'
                      ? sim.heroWeaponDmg
                      : Math.max(3, Math.round(sim.heroWeaponDmg * 0.65))
                hitEnemy.hp = Math.max(0, hitEnemy.hp - dmg)

                projectilePoolRef.current.spawnDamageText(
                  hitX,
                  hitY - 10,
                  `-${formatArmy(dmg, notationMode)}`,
                  kind === 'cannon' ? '#facc15' : '#bae6fd',
                )

                if (hitEnemy.hp <= 0) {
                  const idx = sim.enemies.indexOf(hitEnemy)
                  if (idx >= 0) sim.enemies.splice(idx, 1)
                  sim.remaindersEarned += 1
                  // Dropa Moeda de Ouro 2.5D no chão!
                  sim.droppedCoins.push({
                    id: `coin_${sim.elapsedMs}_${Math.random()}`,
                    normX: Math.max(0.12, Math.min(0.88, hitEnemy.normX)),
                    normY: Math.max(0.18, Math.min(0.82, hitEnemy.normY)),
                    amount: hitEnemy.rewardCoins,
                    ageMs: 0,
                  })
                }
              }
            },
          )

          particlePoolRef.current.updateAndDraw(ctx, dtMs)
          ;(window as unknown as { __lbActiveProjectiles?: number }).__lbActiveProjectiles =
            projectilePoolRef.current.getActiveCount()
          ctx.restore()
        }

        // Sincronizar HUD React a cada 180ms
        if (hudSyncTimer >= 180) {
          hudSyncTimer = 0
          const bossUnit = sim.enemies.find((e) => e.isBoss)
          setHudState((prev) => ({
            ...prev,
            wave: sim.wave,
            maxWaves: sim.maxWaves,
            playerForce: sim.playerForce,
            baseHp: Math.round(sim.baseHp),
            baseMaxHp: sim.baseMaxHp,
            coins: sim.coins,
            enemiesLeft:
              Math.max(0, sim.waveEnemiesToSpawn - sim.waveEnemiesSpawned) +
              sim.enemies.length,
            bossHp: bossUnit ? Math.max(0, Math.round(bossUnit.hp)) : 0,
            bossMaxHp: bossUnit ? bossUnit.maxHp : prev.bossMaxHp,
            pads: [...sim.pads],
            alliedCount: sim.alliedUnits.length,
          }))
        }
      }

      rafId = window.requestAnimationFrame(step)
    }

    rafId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(rafId)
  }, [activeEngineId, baseEnemyForce, notationMode, reducedMotion, snapshot.enemy.bossHp])

  const handleStagePointer = (clientX: number, clientY: number, isDown: boolean) => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas || !sim || sim.finished) return

    const rect = canvas.getBoundingClientRect()
    const normX = Math.max(0.08, Math.min(0.92, (clientX - rect.left) / Math.max(1, rect.width)))
    const normY = Math.max(0.14, Math.min(0.86, (clientY - rect.top) / Math.max(1, rect.height)))

    sim.targetNormX = normX
    sim.targetNormY = normY

    if (isDown) {
      // V6: Clicar no Altar Matemático 2.5D no canto superior direito (0.84, 0.24) abre a Conta!
      if (Math.hypot(normX - 0.84, normY - 0.24) <= 0.1) {
        openMathChallengeModal()
        return
      }
      const clickedPad = sim.pads.find(
        (p) => Math.hypot(p.normX - normX, p.normY - normY) <= 0.095,
      )
      sim.pendingPadId = clickedPad ? clickedPad.id : null
    }
  }

  return (
    <div
      className="lb-run-stage"
      data-testid="arcade-engine-stage"
      onPointerDown={(e) => {
        if (simRef.current) simRef.current.pointerActive = true
        handleStagePointer(e.clientX, e.clientY, true)
      }}
      onPointerMove={(e) => {
        if (simRef.current?.pointerActive) {
          handleStagePointer(e.clientX, e.clientY, false)
        }
      }}
      onPointerUp={() => {
        if (simRef.current) simRef.current.pointerActive = false
      }}
    >
      <canvas
        ref={canvasRef}
        className="lb-run-canvas"
        aria-label={`Palco 2.5D da engine ${engineSpec.name}`}
      />

      {/* Painel Superior de Status 2.5D: Onda, Moedas (🪙), Tropas Aliadas, HP da Base e Barra do Boss */}
      <div
        style={{
          position: 'absolute',
          top: '68px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 18,
          background: 'rgba(15, 23, 42, 0.90)',
          border: '1px solid rgba(56, 189, 248, 0.45)',
          borderRadius: '14px',
          padding: '8px 16px',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minWidth: '310px',
          maxWidth: '94vw',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
          <strong style={{ color: '#38bdf8' }} data-testid="lb-active-engine-badge">
            {engineSpec.icon} {engineSpec.shortName} · Onda {hudState.wave}/{hudState.maxWaves}
          </strong>
          <span style={{ color: '#facc15', fontWeight: 900 }}>
            🪙 {hudState.coins} Ouro
          </span>
          <span style={{ color: '#4ade80', fontWeight: 800 }}>
            🪖 {hudState.alliedCount} Aliados
          </span>
          <span style={{ color: '#f87171', fontWeight: 800 }}>
            🛡️ Base {hudState.baseHp}%
          </span>
        </div>

        {hudState.bossHp > 0 && (
          <div
            style={{
              background: 'rgba(127, 29, 29, 0.85)',
              border: '1px solid #facc15',
              borderRadius: '6px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 900,
              color: '#fef08a',
              textAlign: 'center',
            }}
          >
            👑 BOSS EM CAMPO — HP: {formatArmy(hudState.bossHp, notationMode)} / {formatArmy(hudState.bossMaxHp, notationMode)}
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
          {hudState.statusText}
        </div>
      </div>

      {/* Dock Tática de Construções, Quartéis, Torres, Operários e Cartas de Armas (Específica de cada Engine!) */}
      {(snapshot.phase === 'RUNNING' ||
        snapshot.phase === 'CALM_WAIT' ||
        snapshot.phase === 'PAUSED') && (
        <div className="lb-tactical-dock" data-testid="lb-tactical-dock">
          <div
            className="lb-lane-choice-grid lb-lanes-3 is-visible-pills"
            data-testid="lb-lane-choice-grid"
          >
            {hudState.pads.map((pad, idx) => (
              <button
                key={pad.id}
                type="button"
                data-testid={`lb-gate-choice-${idx}`}
                className="lb-gate-choice-btn"
                onClick={() => {
                  if (simRef.current) {
                    executePadBuildOrUpgrade(pad)
                  }
                }}
                style={{
                  background:
                    hudState.coins >= pad.costCoins
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.92), rgba(5, 150, 105, 0.95))'
                      : 'rgba(15, 23, 42, 0.90)',
                  borderColor: hudState.coins >= pad.costCoins ? '#fde047' : '#475569',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 8px',
                  lineHeight: 1.15,
                }}
              >
                <strong className="lb-gate-choice-label" style={{ fontSize: '12px' }}>
                  {pad.icon} {pad.title} (Nv.{pad.level})
                </strong>
                <span style={{ fontSize: '10px', color: '#fef08a', fontWeight: 700 }}>
                  {pad.subtitle} · 🪙 {pad.costCoins}
                </span>
              </button>
            ))}
          </div>

          {/* V6: Botão Sempre Disponível de Fazer Conta (4 Graus: Fácil, Médio, Difícil ou Problema) */}
          <button
            type="button"
            className="lb-luneta-fab"
            data-testid="lb-open-math-challenge-btn"
            onClick={() => openMathChallengeModal()}
            title="Fazer Conta Matemática (Fácil, Médio, Difícil ou Problema) para ganhar +Moedas, +Tropas/Tanques/Torres e Buffs"
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
      )}
    </div>
  )
}

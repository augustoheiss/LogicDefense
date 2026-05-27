// ============================================================
// Logic Friction — Enemy Manager (Spawner)
// Sprint 7: Boss waves + Trojan Horse death spawning +
//           Pathfinding grid integration
// Uses EnemyRegistry for attack coordination
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../state/useGameStore'
import { onPlayerAttack } from '../player/playerEvents'
import { enemyRegistry } from './EnemyRegistry'
import { rebuildObstacles, resetGrid, isPositionBlocked } from './pathfindingGrid'
import { Enemy } from './Enemy'
import {
  ENEMY_BASE_HP,
  ENEMY_HP_SCALE,
  ENEMY_BASE_SPEED,
  ENEMY_SPEED_SCALE,
  ENEMY_MAX_SPEED,
  ENEMY_SPAWN_RADIUS,
  WAVE_SPAWN_INTERVAL,
  BOSS_NORMAL_HP_MULT,
  BOSS_PUNISH_HP_MULT,
  BOSS_TOLL_PER_WAVE,
  BOSS_SPEED_MULT,
  BOSS_SCALE,
  BOSS_TROJAN_SPAWN_COUNT,
} from '../config/constants'

interface SpawnedEnemy {
  id: string
  position: [number, number, number]
  hp: number
  speed: number
  isBoss: boolean
  requiredMoney: number  // 0 for normal enemies
  scale: number
}

let enemyIdCounter = 0

/**
 * Find a clear spawn point on the arena perimeter.
 * If the initial angle is blocked, sweep in 15° increments until clear.
 */
function findClearSpawnPoint(initialAngle: number, radius: number): [number, number] {
  const STEP = Math.PI / 12 // 15°
  for (let i = 0; i < 24; i++) {
    const angle = initialAngle + i * STEP
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (!isPositionBlocked(x, z)) return [x, z]
  }
  // All 24 positions blocked (should never happen) — use original
  return [Math.cos(initialAngle) * radius, Math.sin(initialAngle) * radius]
}

export function EnemyManager() {
  const [enemies, setEnemies] = useState<SpawnedEnemy[]>([])
  const spawnTimerRef = useRef(0)
  const bossSpawnTimerRef = useRef(0)
  const prevTowerCountRef = useRef(0)

  const phase = useGameStore(s => s.phase)
  const towers = useGameStore(s => s.towers)

  // ── Rebuild pathfinding grid when towers change ──
  useEffect(() => {
    if (towers.length !== prevTowerCountRef.current) {
      rebuildObstacles(towers)
      prevTowerCountRef.current = towers.length
    }
  }, [towers])

  // ── Clear enemies on game reset ──
  useEffect(() => {
    if (phase === 'MENU') {
      setEnemies([])
      enemyRegistry.clear()
      resetGrid()
      enemyIdCounter = 0
    }
  }, [phase])

  // ── Listen for player attacks → check registry for range hits ──
  useEffect(() => {
    const unsub = onPlayerAttack((px, pz, range, damage) => {
      enemyRegistry.forEach((entry) => {
        const dx = entry.x - px
        const dz = entry.z - pz
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist <= range) {
          entry.takeDamage(damage)
        }
      })
    })
    return unsub
  }, [])

  // ── Normal enemy death handler ──
  const handleEnemyDeath = useCallback((id: string) => {
    setEnemies(prev => prev.filter(e => e.id !== id))
    useGameStore.getState().enemyKilled(false)
  }, [])

  // ── Boss death handler — triggers Trojan Horse spawn ──
  const handleBossDeath = useCallback((id: string, x: number, z: number) => {
    setEnemies(prev => prev.filter(e => e.id !== id))
    useGameStore.getState().enemyKilled(true)
    // Queue trojan spawns at the boss's last position
    useGameStore.getState().queueTrojanSpawn(x, z)
  }, [])

  // ── Spawn loop (runs every frame during PLAYING) ──
  useFrame((_, delta) => {
    const state = useGameStore.getState()
    if (state.isPaused) return
    if (state.phase !== 'PLAYING') return

    // ── 1. Normal enemy spawning ──
    if (state.enemiesToSpawn > 0) {
      spawnTimerRef.current += delta
      if (spawnTimerRef.current >= WAVE_SPAWN_INTERVAL) {
        spawnTimerRef.current = 0

        const angle = Math.random() * Math.PI * 2
        const [x, z] = findClearSpawnPoint(angle, ENEMY_SPAWN_RADIUS)

        const waveNumber = state.waveNumber
        const enemyHp = ENEMY_BASE_HP + (waveNumber - 1) * ENEMY_HP_SCALE
        const enemySpeed = Math.min(
          ENEMY_MAX_SPEED,
          ENEMY_BASE_SPEED + (waveNumber - 1) * ENEMY_SPEED_SCALE,
        )

        const id = `enemy-${++enemyIdCounter}`

        setEnemies(prev => [...prev, {
          id,
          position: [x, 1.5, z],
          hp: enemyHp,
          speed: enemySpeed,
          isBoss: false,
          requiredMoney: 0,
          scale: 1,
        }])

        state.enemySpawned()
      }
    }

    // ── 2. Boss spawning (boss waves only) ──
    if (state.bossesToSpawn > 0) {
      bossSpawnTimerRef.current += delta
      // Bosses spawn slower — 2x the normal interval for dramatic pacing
      if (bossSpawnTimerRef.current >= WAVE_SPAWN_INTERVAL * 2) {
        bossSpawnTimerRef.current = 0

        const angle = Math.random() * Math.PI * 2
        const [x, z] = findClearSpawnPoint(angle, ENEMY_SPAWN_RADIUS)

        const waveNumber = state.waveNumber
        const normalHp = ENEMY_BASE_HP + (waveNumber - 1) * ENEMY_HP_SCALE
        const requiredMoney = waveNumber * BOSS_TOLL_PER_WAVE
        const playerGold = state.gold

        // Economy check: HP scales based on whether player meets the toll
        const bossHp = playerGold >= requiredMoney
          ? normalHp * BOSS_NORMAL_HP_MULT     // 10x — player is wealthy
          : normalHp * BOSS_PUNISH_HP_MULT     // 30x — player is punished

        const normalSpeed = Math.min(
          ENEMY_MAX_SPEED,
          ENEMY_BASE_SPEED + (waveNumber - 1) * ENEMY_SPEED_SCALE,
        )
        const bossSpeed = normalSpeed * BOSS_SPEED_MULT  // 35% of normal

        const id = `boss-${++enemyIdCounter}`

        setEnemies(prev => [...prev, {
          id,
          position: [x, 1.5, z],
          hp: bossHp,
          speed: bossSpeed,
          isBoss: true,
          requiredMoney,
          scale: BOSS_SCALE,
        }])

        state.bossSpawned()
      }
    }

    // ── 3. Trojan Horse spawning (from boss death queue) ──
    const trojanSpawn = state.consumeTrojanSpawn()
    if (trojanSpawn) {
      const waveNumber = state.waveNumber
      const normalHp = ENEMY_BASE_HP + (waveNumber - 1) * ENEMY_HP_SCALE
      const normalSpeed = Math.min(
        ENEMY_MAX_SPEED,
        ENEMY_BASE_SPEED + (waveNumber - 1) * ENEMY_SPEED_SCALE,
      )

      const newEnemies: SpawnedEnemy[] = []
      for (let i = 0; i < BOSS_TROJAN_SPAWN_COUNT; i++) {
        // Spread enemies in a small cluster around the boss death position
        const spreadAngle = (i / BOSS_TROJAN_SPAWN_COUNT) * Math.PI * 2
        const spreadRadius = 1.5 + Math.random() * 1.0
        const ex = trojanSpawn.x + Math.cos(spreadAngle) * spreadRadius
        const ez = trojanSpawn.z + Math.sin(spreadAngle) * spreadRadius

        const id = `trojan-${++enemyIdCounter}`
        newEnemies.push({
          id,
          position: [ex, 1.5, ez],
          hp: normalHp,
          speed: normalSpeed,
          isBoss: false,
          requiredMoney: 0,
          scale: 1,
        })

        // Register each trojan enemy in the store's alive counter
        // (using enemySpawned would decrement enemiesToSpawn which is already 0)
        useGameStore.setState(s => ({ enemiesAlive: s.enemiesAlive + 1 }))
      }

      setEnemies(prev => [...prev, ...newEnemies])
    }
  })

  return (
    <>
      {enemies.map(e => (
        <Enemy
          key={e.id}
          id={e.id}
          position={e.position}
          hp={e.hp}
          speed={e.speed}
          isBoss={e.isBoss}
          requiredMoney={e.requiredMoney}
          enemyScale={e.scale}
          onDeath={e.isBoss ? undefined : handleEnemyDeath}
          onBossDeath={e.isBoss ? handleBossDeath : undefined}
        />
      ))}
    </>
  )
}

// ============================================================
// Logic Friction — Enemy Manager (Spawner)
// Sprint 2: Wave-based spawning at arena perimeter
// Uses EnemyRegistry for attack coordination
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from '../state/useGameStore'
import { onPlayerAttack } from '../player/playerEvents'
import { enemyRegistry } from './EnemyRegistry'
import { Enemy } from './Enemy'
import {
  ENEMY_BASE_HP,
  ENEMY_HP_SCALE,
  ENEMY_BASE_SPEED,
  ENEMY_SPEED_SCALE,
  ENEMY_MAX_SPEED,
  ENEMY_SPAWN_RADIUS,
  WAVE_SPAWN_INTERVAL,
} from '../config/constants'

interface SpawnedEnemy {
  id: string
  position: [number, number, number]
  hp: number
  speed: number
}

let enemyIdCounter = 0

export function EnemyManager() {
  const [enemies, setEnemies] = useState<SpawnedEnemy[]>([])
  const spawnTimerRef = useRef(0)

  const phase = useGameStore(s => s.phase)

  // ── Clear enemies on game reset ──
  useEffect(() => {
    if (phase === 'MENU') {
      setEnemies([])
      enemyRegistry.clear()
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

  // ── Enemy death handler ──
  const handleEnemyDeath = useCallback((id: string) => {
    setEnemies(prev => prev.filter(e => e.id !== id))
    useGameStore.getState().enemyKilled()
  }, [])

  // ── Spawn loop (runs every frame during PLAYING) ──
  // IMPORTANT: Read state directly from the store inside useFrame to avoid
  // stale closures. React state subscriptions don't update the useFrame callback
  // synchronously in R3F.
  useFrame((_, delta) => {
    const state = useGameStore.getState()
    if (state.phase !== 'PLAYING' || state.enemiesToSpawn <= 0) return

    spawnTimerRef.current += delta
    if (spawnTimerRef.current < WAVE_SPAWN_INTERVAL) return
    spawnTimerRef.current = 0

    // Spawn one enemy at a random angle on the perimeter
    const angle = Math.random() * Math.PI * 2
    const x = Math.cos(angle) * ENEMY_SPAWN_RADIUS
    const z = Math.sin(angle) * ENEMY_SPAWN_RADIUS

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
    }])

    state.enemySpawned()
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
          onDeath={handleEnemyDeath}
        />
      ))}
    </>
  )
}

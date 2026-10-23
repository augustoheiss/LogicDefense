// ============================================================
// Logic Friction — Enemy Registry
// Shared mutable Map: enemy id → { position, takeDamage, slow }
// Used by PlayerController attack system and Tower targeting
// ============================================================

export interface EnemyEntry {
  x: number
  z: number
  hp: number
  maxHp: number
  isBoss: boolean
  speedMultiplier: number   // 1.0 = normal, 0.5 = slowed
  slowExpiry: number        // performance.now() timestamp when slow wears off
  focusHeat: number         // Decaying target lock heat for multi-tower deconfliction
  lastTargetedAt: number    // performance.now() timestamp of last single-target tower shot
  takeDamage: (amount: number) => void
  applySlow: (factor: number, duration: number) => void
}

const FOCUS_HEAT_HALF_LIFE_MS = 1800

/**
 * Compute exponentially decayed focus heat at timestamp `nowMs`.
 * Guarantees zero allocation and smooth Round-Robin load balancing across surviving enemies.
 */
export function getEffectiveFocusHeat(
  entry: EnemyEntry,
  nowMs: number,
  halfLifeMs = FOCUS_HEAT_HALF_LIFE_MS,
): number {
  if (!entry.focusHeat || entry.focusHeat <= 0 || !entry.lastTargetedAt || entry.lastTargetedAt <= 0) {
    return 0
  }
  const elapsed = Math.max(0, nowMs - entry.lastTargetedAt)
  if (elapsed > halfLifeMs * 4) return 0
  return entry.focusHeat * Math.pow(0.5, elapsed / halfLifeMs)
}

/**
 * Synchronously record a tower target lock on `entry` inside the active useFrame tick.
 * Subsequent towers in the same frame immediately observe the updated heat.
 */
export function recordTowerTargetLock(
  entry: EnemyEntry,
  nowMs: number,
  weight = 1.0,
): void {
  if (weight <= 0) return
  const currentHeat = getEffectiveFocusHeat(entry, nowMs)
  entry.focusHeat = currentHeat + weight
  entry.lastTargetedAt = nowMs
}

/** Global registry — each Enemy registers/unregisters itself on mount/unmount */
export const enemyRegistry = new Map<string, EnemyEntry>()

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__LF_ENEMY_REGISTRY__ = enemyRegistry
}


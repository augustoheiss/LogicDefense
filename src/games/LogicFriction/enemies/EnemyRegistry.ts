// ============================================================
// Logic Friction — Enemy Registry
// Shared mutable Map: enemy id → { position, takeDamage, slow }
// Used by PlayerController attack system and Tower targeting
// ============================================================

export interface EnemyEntry {
  x: number
  z: number
  isBoss: boolean
  speedMultiplier: number   // 1.0 = normal, 0.5 = slowed
  slowExpiry: number        // performance.now() timestamp when slow wears off
  takeDamage: (amount: number) => void
  applySlow: (factor: number, duration: number) => void
}

/** Global registry — each Enemy registers/unregisters itself on mount/unmount */
export const enemyRegistry = new Map<string, EnemyEntry>()

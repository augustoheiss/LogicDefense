// ============================================================
// Logic Friction — Enemy Registry
// Shared mutable Map: enemy id → { position, takeDamage }
// Used by PlayerController attack system for range checks
// ============================================================

export interface EnemyEntry {
  x: number
  z: number
  takeDamage: (amount: number) => void
}

/** Global registry — each Enemy registers/unregisters itself on mount/unmount */
export const enemyRegistry = new Map<string, EnemyEntry>()

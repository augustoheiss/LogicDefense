// ============================================================
// Logic Friction — Keyboard Input Hook
// Shared module-level key state for all components
// ============================================================
import { useEffect } from 'react'

/** Module-level keyboard state — shared across all useFrame consumers */
export const keys: Record<string, boolean> = {}

/**
 * Attaches keydown/keyup listeners once per mount.
 * Call this in ANY component that needs keyboard input
 * (idempotent — multiple calls share the same `keys` object).
 */
export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys[e.code] = true }
    const up   = (e: KeyboardEvent) => { keys[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])
}

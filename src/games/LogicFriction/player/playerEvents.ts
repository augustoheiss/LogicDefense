// ============================================================
// Logic Friction — Player Events & Shared State
// Extracted from PlayerController.tsx to fix Vite HMR.
// React Fast Refresh requires component files to export ONLY
// components or hooks. Non-component exports break HMR and
// cause full page reloads that crash the Physics tree.
// ============================================================

// ── Shared player position (written by PlayerController every frame) ──
export const playerPositionRef = { x: 0, y: 0, z: 0 }

// ── Attack event system ──
type AttackListener = (px: number, pz: number, range: number, damage: number) => void
const attackListeners: Set<AttackListener> = new Set()

export function onPlayerAttack(listener: AttackListener) {
  attackListeners.add(listener)
  return () => { attackListeners.delete(listener) }
}

export function fireAttack(px: number, pz: number, damage: number, range: number) {
  attackListeners.forEach(fn => fn(px, pz, range, damage))
}

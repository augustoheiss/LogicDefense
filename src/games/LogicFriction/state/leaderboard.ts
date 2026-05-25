// ============================================================
// Logic Friction — Local Leaderboard (Top 10) + Save Slots
// Persists to localStorage under 'logicFriction_leaderboard'.
// Each entry doubles as a save slot with a gameStateSnapshot.
// Sorted by wave (desc), then gold (desc).
// ============================================================

import type { TowerData, SiteData } from './useGameStore'

const STORAGE_KEY = 'logicFriction_leaderboard'

/** Snapshot of persistent game data for loading a save slot. */
export interface GameStateSnapshot {
  waveNumber: number
  gold: number
  coreHp: number
  maxCoreHp: number
  coreLevel: number
  towers: TowerData[]
  constructionSites: SiteData[]
}

export interface LeaderboardEntry {
  id: string
  name: string
  wave: number
  gold: number
  date: string
  snapshot: GameStateSnapshot | null
}

/** Read the leaderboard from localStorage (sorted). */
export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LeaderboardEntry[]
    return sortAndTrim(parsed)
  } catch {
    return []
  }
}

/** Add a score + game state snapshot, sort, trim to Top 10, and persist. */
export function saveToLeaderboard(
  name: string,
  wave: number,
  gold: number,
  snapshot: GameStateSnapshot | null = null,
): void {
  const entries = getLeaderboard()

  const entry: LeaderboardEntry = {
    id: `lb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Anônimo',
    wave,
    gold,
    date: new Date().toLocaleDateString('pt-BR'),
    snapshot,
  }

  entries.push(entry)
  const trimmed = sortAndTrim(entries)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Clear the entire leaderboard. */
export function clearLeaderboard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

// ── Internal ────────────────────────────────────────────────────────────────────
function sortAndTrim(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .sort((a, b) => b.wave - a.wave || b.gold - a.gold)
    .slice(0, 10)
}

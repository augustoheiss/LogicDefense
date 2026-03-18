export interface LeaderboardEntry {
  playerName: string
  wave: number
  totalCorrect: number
  totalMath: number
  dateTime: string
}

const LEADERBOARD_KEY = 'logicDef_leaderboard'
const MAX_ENTRIES = 50

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? '[]') as LeaderboardEntry[]
  } catch {
    return []
  }
}

export function saveRound(
  playerName: string,
  wave: number,
  totalCorrect: number,
  totalMath: number,
): LeaderboardEntry[] {
  const entries = getLeaderboard()
  const newEntry: LeaderboardEntry = {
    playerName: playerName.trim() || 'Anônimo',
    wave,
    totalCorrect,
    totalMath,
    dateTime: new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
  entries.push(newEntry)
  entries.sort((a, b) => b.wave - a.wave || b.totalCorrect - a.totalCorrect)
  const trimmed = entries.slice(0, MAX_ENTRIES)
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed))
  return trimmed
}

/** Legacy compat — kept so old high-score display still compiles if referenced elsewhere */
export function getHighScore(): { wave: number; math: number } {
  const top = getLeaderboard()[0]
  return { wave: top?.wave ?? 0, math: top?.totalMath ?? 0 }
}

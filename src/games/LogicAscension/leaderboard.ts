const STORAGE_KEY = 'logicAscensionLeaderboard';
const MAX_ENTRIES = 10;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface HighScore {
  name:  string;
  power: number;
  stage: number;
  date:  string;
}

// ── Persistence helpers ────────────────────────────────────────────────────────
export function getHighScores(): HighScore[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HighScore[];
  } catch {
    return [];
  }
}

export function saveHighScore(score: HighScore): void {
  const scores = getHighScores();
  scores.push(score);
  scores.sort((a, b) => b.power - a.power);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(scores.slice(0, MAX_ENTRIES)),
  );
}

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
    return parsed
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map((item) => ({
        name: String(item.name || 'Herói').slice(0, 15),
        power: Number.isFinite(Number(item.power)) ? Number(item.power) : 0,
        stage: Number.isFinite(Number(item.stage)) ? Number(item.stage) : 1,
        date: String(item.date || '').slice(0, 20),
      }))
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveHighScore(score: HighScore): void {
  try {
    const scores = getHighScores();
    scores.push({
      name: String(score.name || 'Herói').trim().slice(0, 15) || 'Herói',
      power: Number.isFinite(score.power) ? score.power : 0,
      stage: Number.isFinite(score.stage) ? score.stage : 1,
      date: String(score.date || '').slice(0, 20),
    });
    scores.sort((a, b) => b.power - a.power);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(scores.slice(0, MAX_ENTRIES)),
    );
  } catch {
    // Ignore storage quota or private mode errors
  }
}

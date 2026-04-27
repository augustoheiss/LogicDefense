// ============================================================
// LOGIC INVADERS — Game Component  (v3 — Endless Roguelike)
// Leaderboard + "Finalizar Jogo" button + enemy projectile hint
// ============================================================
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useGameEngine, CANVAS_W, CANVAS_H } from '../hooks/useGameEngine';
import { formatScore } from '../utils/formatScore';
import type { LeaderboardEntry } from '../types';

const LEADERBOARD_KEY = 'logic_invaders_leaderboard';

// ── Leaderboard helpers ───────────────────────────────────────
function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

function addLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry[] {
  const entries = loadLeaderboard();
  entries.push(entry);
  entries.sort((a, b) => b.score - a.score);
  const top10 = entries.slice(0, 10);
  saveLeaderboard(top10);
  return top10;
}

// ── Laser timer bar ───────────────────────────────────────────
interface LaserBarProps { ratio: number }
function LaserBar({ ratio }: LaserBarProps) {
  if (ratio <= 0) return null;
  return (
    <div className="li-laser-bar-wrapper" role="progressbar" aria-label="Tempo de laser restante" aria-valuenow={Math.round(ratio * 100)}>
      <div className="li-laser-bar-track">
        <div className="li-laser-bar-fill" style={{ width: `${ratio * 100}%` }} />
        <span className="li-laser-bar-label">⚡ LASER MODE</span>
      </div>
    </div>
  );
}

// ── Leaderboard Table ─────────────────────────────────────────
function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontFamily: 'var(--li-mono)', fontSize: 13 }}>
        Nenhum placar salvo ainda. Seja o primeiro!
      </p>
    );
  }
  return (
      <div className="li-lb-table">
        <div className="li-lb-header">
          <span>#</span>
          <span>Nome</span>
          <span>Pontos</span>
          <span>Onda</span>
          <span>Data</span>
        </div>
        {entries.map((e, i) => (
          <div
            key={i}
            className={`li-lb-row ${i === 0 ? 'li-lb-row--gold' : i === 1 ? 'li-lb-row--silver' : i === 2 ? 'li-lb-row--bronze' : ''}`}
          >
            <span className="li-lb-rank">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
            </span>
            <span className="li-lb-name">{e.name}</span>
            <span className="li-lb-score">{formatScore(e.score)}</span>
            <span className="li-lb-wave">Onda {e.wave}</span>
            <span className="li-lb-date">{new Date(e.date).toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function LogicInvadersGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<string>('idle');
  const [wave, setWave] = useState(1);
  const [laserActive, setLaserActive] = useState(false);
  const [laserRatio, setLaserRatio] = useState(0);

  // Leaderboard state
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard);
  const [savedEntry, setSavedEntry] = useState<LeaderboardEntry | null>(null);

  // Keep latest score/wave in refs so save overlay can access them
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { waveRef.current = wave; }, [wave]);

  const handleLaserChange = useCallback((active: boolean, ratio: number) => {
    setLaserActive(active);
    setLaserRatio(ratio);
  }, []);

  const handleStatusChange = useCallback((s: string) => {
    setStatus(s);
  }, []);

  const engineOptions = useMemo(() => ({
    onScoreChange: setScore,
    onStatusChange: handleStatusChange,
    onWaveChange: setWave,
    onLaserChange: handleLaserChange,
  }), [handleLaserChange, handleStatusChange]);

  const { startGame, pauseGame, resumeGame } = useGameEngine(canvasRef, engineOptions);

  const isIdle = status === 'idle';
  const isPlaying = status === 'playing';

  // Focus canvas when game starts
  useEffect(() => {
    if (isPlaying && canvasRef.current) canvasRef.current.focus();
  }, [isPlaying]);

  // ── Handlers ──────────────────────────────────────────────
  const handleEndGame = useCallback(() => {
    pauseGame();
    setPlayerName('');
    setSavedEntry(null);
    setShowSaveOverlay(true);
  }, [pauseGame]);

  const handleSaveScore = useCallback(() => {
    const name = playerName.trim() || 'Anônimo';
    const entry: LeaderboardEntry = {
      name,
      score: scoreRef.current,
      wave: waveRef.current,
      date: new Date().toISOString(),
    };
    const updated = addLeaderboardEntry(entry);
    setLeaderboard(updated);
    setSavedEntry(entry);
    setShowSaveOverlay(false);
    setShowLeaderboard(true);
  }, [playerName]);

  const handleCancelSave = useCallback(() => {
    setShowSaveOverlay(false);
    resumeGame();
  }, [resumeGame]);

  const handleCloseLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
    // Reset to idle so player can start fresh
    setStatus('idle');
  }, []);

  const handleNewGame = useCallback(() => {
    setShowLeaderboard(false);
    setShowSaveOverlay(false);
    startGame();
  }, [startGame]);

  // Show leaderboard from idle (read-only)
  const handleViewLeaderboard = useCallback(() => {
    setLeaderboard(loadLeaderboard());
    setSavedEntry(null);
    setShowLeaderboard(true);
  }, []);

  return (
    <div className="li-wrapper">

      {/* ── HUD bar ── */}
      {!isIdle && !showSaveOverlay && !showLeaderboard && (
        <div className="li-hud">
          <div className="li-hud-stat">
            <span className="li-hud-label">PONTOS</span>
            <span className="li-hud-value li-hud-value--cyan">{formatScore(score)}</span>
          </div>
          <div className="li-hud-stat">
            <span className="li-hud-label">ONDA</span>
            <span className="li-hud-value li-hud-value--magenta">{wave}</span>
          </div>
          <div className="li-hud-controls-hint">
            {laserActive
              ? '⚡ LASER ATIVO — destruindo tudo automaticamente!'
              : 'A/D · MOVER | ESPAÇO/SEGURE · ATIRAR | Clique nas BOLHAS para Matar-Math'}
          </div>
          {isPlaying && (
            <button
              className="li-end-btn"
              onClick={handleEndGame}
              id="li-end-game-btn"
              title="Finalizar e salvar pontuação"
            >
              📋 Finalizar & Salvar
            </button>
          )}
        </div>
      )}

      {/* ── Canvas ── */}
      <div className={`li-canvas-container ${laserActive ? 'li-canvas--laser' : ''}`}>
        <canvas
          ref={canvasRef}
          id="li-canvas"
          width={CANVAS_W}
          height={CANVAS_H}
          tabIndex={0}
          aria-label="Logic Invaders — canvas do jogo"
          style={{
            cursor: isPlaying ? 'crosshair' : 'default',
            touchAction: 'none',      // ← stops browser swipe-scroll intercepting pointer events
            userSelect: 'none',       // ← prevents text-selection drag on mobile
            WebkitUserSelect: 'none', // ← Safari
          }}
        />
      </div>{/* /.li-canvas-container — overlays are siblings below, NOT inside */}

      {/* ══ IDLE OVERLAY ══
          Anchored to .li-wrapper (position:relative) so overflow:hidden on
          the canvas container cannot clip this content. z-index:100 floats
          above HUD, canvas, and LaserBar. touch-action:auto on buttons lets
          iOS Safari route taps correctly. */}
      {isIdle && !showLeaderboard && (
        <div className="li-overlay">
          <div className="li-overlay-box">
            <div className="li-overlay-eyebrow">HEISS-LAB PROTOTYPE</div>
            <h2 className="li-overlay-title">
              <span className="li-glow-cyan">Logic</span>{' '}
              <span className="li-glow-magenta">Invaders</span>
            </h2>
            <p className="li-overlay-sub">
              Aliens descem com equações matemáticas. Você tem <strong>2 armas</strong>:
            </p>
            <div className="li-overlay-mechanic-list">
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">🔫</span>
                <span><strong>Bala normal</strong> (Espaço/Segure) — causa 1 de dano. 10 tiros para destruir.</span>
              </div>
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">🧮</span>
                <span><strong>Matar-Math</strong> (Clique na bolha certa) — mata instantâneo + LASER por 5s!</span>
              </div>
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">🎲</span>
                <span><strong>Projéteis inimigos</strong> — aliens atiram modificadores (×2…÷8) que alteram sua pontuação!</span>
              </div>
            </div>
            <div className="li-overlay-keys">
              <span><kbd>A</kbd><kbd>D</kbd> Mover</span>
              <span><kbd>Espaço</kbd> Atirar (segure)</span>
              <span>📱 Segure e deslize</span>
              <span>🖱️ Clique nas bolhas</span>
            </div>
            <div className="li-overlay-action-row">
              <button
                id="li-start-btn"
                className="li-start-btn"
                onClick={startGame}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                ▶ INICIAR JOGO
              </button>
              <button
                className="li-lb-open-btn"
                onClick={handleViewLeaderboard}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                🏆 Ver Placar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Laser bar ── */}
      <LaserBar ratio={laserRatio} />

      {/* ── Mobile hint ── */}
      {isPlaying && (
        <p className="li-mobile-hint" style={{ textAlign: 'center', marginTop: 8 }}>
          📱 Segure o campo para atirar · Deslize para mover · Clique nas bolhas para Matar-Math · ⚠️ Desvie dos projéteis!
        </p>
      )}

      {/* ══════════════════════════════════════════════
          SAVE SCORE OVERLAY
      ══════════════════════════════════════════════ */}
      {showSaveOverlay && (
        <div className="li-overlay">
          <div className="li-overlay-box li-save-box">
            <div className="li-overlay-eyebrow li-eyebrow--cyan">FINALIZAR JOGO</div>
            <h2 className="li-overlay-title" style={{ marginBottom: '0.5rem' }}>
              Salvar <span className="li-glow-cyan">Pontuação</span>
            </h2>

            <div className="li-save-score-display">
              <div className="li-save-stat">
                <span className="li-save-stat-label">PONTOS</span>
                <span className="li-save-stat-value li-glow-cyan">{formatScore(score)}</span>
              </div>
              <div className="li-save-stat">
                <span className="li-save-stat-label">ONDA</span>
                <span className="li-save-stat-value" style={{ color: '#ff00ff' }}>{wave}</span>
              </div>
            </div>

            <label className="li-save-label" htmlFor="li-player-name-input">
              Seu nome no placar:
            </label>
            <input
              id="li-player-name-input"
              className="li-save-input"
              type="text"
              maxLength={24}
              placeholder="Digite seu nome..."
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveScore(); }}
              autoFocus
            />

            <div className="li-save-actions">
              <button
                className="li-start-btn"
                onClick={handleSaveScore}
                id="li-save-score-btn"
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                💾 Salvar no Placar
              </button>
              <button
                className="li-ghost-btn"
                onClick={handleCancelSave}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                ← Continuar Jogando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          LEADERBOARD OVERLAY
      ══════════════════════════════════════════════ */}
      {showLeaderboard && (
        <div className="li-overlay">
          <div className="li-overlay-box li-lb-box">
            <div className="li-overlay-eyebrow li-eyebrow--cyan">TABELA DE PONTUAÇÃO</div>
            <h2 className="li-overlay-title" style={{ marginBottom: '0.75rem' }}>
              🏆 <span className="li-glow-cyan">Top 10</span> — Logic Invaders
            </h2>

            {savedEntry && (
              <div className="li-lb-saved-banner">
                ✅ Pontuação salva! <strong>{savedEntry.name}</strong> — {formatScore(savedEntry.score)} pts
              </div>
            )}

            <LeaderboardTable entries={leaderboard} />

            <div className="li-save-actions" style={{ marginTop: '1.5rem' }}>
              <button
                className="li-start-btn"
                onClick={handleNewGame}
                id="li-new-game-btn"
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                🔄 Novo Jogo
              </button>
              <button
                className="li-ghost-btn"
                onClick={handleCloseLeaderboard}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

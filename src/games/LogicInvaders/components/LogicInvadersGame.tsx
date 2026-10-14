// ============================================================
// LOGIC INVADERS — Game Component  (v5 — 6 Lentes da Matemática Básica)
// ─ Modo Descoberta vs. Modo Arcade
// ─ Cápsula de Sabedoria em tempo real (truques de cálculo mental)
// ─ Grimório da Sessão no overlay de Salvar Pontuação
// ─ Controle de áudio Web Audio API (🔊/🔇) e atalhos [1] [2] [3]
// ============================================================
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useGameEngine, CANVAS_W, CANVAS_H } from '../hooks/useGameEngine';
import { formatScore } from '../utils/formatScore';
import { soundEngine } from '../utils/soundEngine';
import type { LeaderboardEntry, GameMode, MathInsightEvent } from '../types';

const LEADERBOARD_KEY = 'logic_invaders_leaderboard';

// ── Leaderboard helpers ───────────────────────────────────────
function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LeaderboardEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as LeaderboardEntry).name === 'string' &&
          typeof (item as LeaderboardEntry).score === 'number' &&
          Number.isFinite((item as LeaderboardEntry).score) &&
          typeof (item as LeaderboardEntry).wave === 'number' &&
          Number.isFinite((item as LeaderboardEntry).wave) &&
          typeof (item as LeaderboardEntry).date === 'string'
      )
      .slice(0, 10)
      .map((item) => ({
        name: item.name.slice(0, 24),
        score: item.score,
        wave: item.wave,
        date: item.date,
      }));
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

// ── Fullscreen helper ─────────────────────────────────────────
function requestFullScreen(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = el as any;
  if (e.requestFullscreen)            { e.requestFullscreen().catch(() => {}); }
  else if (e.webkitRequestFullscreen) { e.webkitRequestFullscreen(); }
  else if (e.msRequestFullscreen)     { e.msRequestFullscreen();     }
}

// ── Main component ────────────────────────────────────────────
export function LogicInvadersGame() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<string>('idle');
  const [wave, setWave] = useState(1);
  const [laserActive, setLaserActive] = useState(false);
  const [laserRatio, setLaserRatio] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>('discovery');
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [insight, setInsight] = useState<MathInsightEvent | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());

  // Leaderboard & Session Summary state
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(loadLeaderboard);
  const [savedEntry, setSavedEntry] = useState<LeaderboardEntry | null>(null);
  const [sessionSummary, setSessionSummary] = useState<{
    mathKillsTotal: number;
    bestStreak: number;
    masteredTips: string[];
  }>({ mathKillsTotal: 0, bestStreak: 0, masteredTips: [] });

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

  const handleStreakChange = useCallback((currentStreak: number, maxStreak: number) => {
    setStreak(currentStreak);
    setBestStreak(maxStreak);
  }, []);

  const handleInsightChange = useCallback((newInsight: MathInsightEvent | null) => {
    setInsight(newInsight);
  }, []);

  const engineOptions = useMemo(() => ({
    onScoreChange: setScore,
    onStatusChange: handleStatusChange,
    onWaveChange: setWave,
    onLaserChange: handleLaserChange,
    onStreakChange: handleStreakChange,
    onInsightChange: handleInsightChange,
  }), [handleLaserChange, handleStatusChange, handleStreakChange, handleInsightChange]);

  const { startGame, pauseGame, resumeGame, getSessionSummary } = useGameEngine(canvasRef, engineOptions);

  const isIdle = status === 'idle';
  const isPlaying = status === 'playing';

  // Focus canvas when game starts
  useEffect(() => {
    if (isPlaying && canvasRef.current) canvasRef.current.focus();
  }, [isPlaying]);

  // ── Handlers ──────────────────────────────────────────────
  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMuted();
    setIsMuted(nextMuted);
  }, []);

  const handleEndGame = useCallback(() => {
    pauseGame();
    setSessionSummary(getSessionSummary());
    setPlayerName('');
    setSavedEntry(null);
    setShowSaveOverlay(true);
  }, [pauseGame, getSessionSummary]);

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
    setStatus('idle');
  }, []);

  const handleNewGame = useCallback(() => {
    setShowLeaderboard(false);
    setShowSaveOverlay(false);
    startGame(gameMode);
  }, [startGame, gameMode]);

  const handleViewLeaderboard = useCallback(() => {
    setLeaderboard(loadLeaderboard());
    setSavedEntry(null);
    setShowLeaderboard(true);
  }, []);

  return (
    <div className="li-wrapper" ref={wrapperRef}>

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
          <div className="li-hud-stat">
            <span className="li-hud-label">SEQUÊNCIA</span>
            <span className="li-hud-value li-hud-value--gold">
              {streak > 0 ? `🔥 ${streak}` : '0'}
            </span>
          </div>

          <div className="li-hud-controls-hint">
            {laserActive
              ? '⚡ LASER ATIVO — destruindo tudo automaticamente!'
              : 'A/D · Mover | [1][2][3] ou Clique · Matar-Math | Espaço · Atirar'}
          </div>

          <div className="li-hud-actions">
            <button
              type="button"
              className="li-mute-btn"
              onClick={handleToggleMute}
              title={isMuted ? 'Ativar som' : 'Silenciar som'}
              aria-label={isMuted ? 'Ativar som' : 'Silenciar som'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
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
        </div>
      )}

      {/* ── Cápsula de Sabedoria (Live Mental Math Insight Banner) ── */}
      {!isIdle && !showSaveOverlay && !showLeaderboard && (
        <div
          className={`li-wisdom-capsule ${
            insight
              ? insight.isCorrect
                ? 'li-wisdom-capsule--correct'
                : 'li-wisdom-capsule--hint'
              : ''
          }`}
        >
          {insight ? (
            <>
              <span className="li-wisdom-badge">
                {insight.isCorrect ? '✨ EUREKA' : '💡 LUZ GUIA'} · {insight.lensTitle}
              </span>
              <span className="li-wisdom-text">
                <strong>{insight.equation}</strong> → {insight.fullTip}
              </span>
            </>
          ) : (
            <span className="li-wisdom-text">
              💡 <strong>Dica:</strong> Use a <em>Luz Guia</em> embaixo de cada conta ou aperte{' '}
              <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> para disparar o Raio de Plasma na bolha certa!
            </span>
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
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </div>

      {/* ══ EXTERNAL PLAY BUTTON ══ */}
      {isIdle && !showLeaderboard && !showSaveOverlay && (
        <button
          id="li-external-play-btn"
          className="li-external-play-btn"
          onClick={() => {
            if (wrapperRef.current) requestFullScreen(wrapperRef.current);
            startGame(gameMode);
          }}
          style={{ touchAction: 'auto', pointerEvents: 'auto' }}
        >
          ▶ Jogar em Tela Cheia ({gameMode === 'discovery' ? 'Modo Descoberta' : 'Modo Arcade'})
        </button>
      )}

      {/* ══ IDLE OVERLAY ══ */}
      {isIdle && !showLeaderboard && (
        <div className="li-overlay">
          <div className="li-overlay-box">
            <div className="li-overlay-eyebrow">HEISS-LAB · 6 LENTES DA MATEMÁTICA BÁSICA</div>
            <h2 className="li-overlay-title">
              <span className="li-glow-cyan">Logic</span>{' '}
              <span className="li-glow-magenta">Invaders</span>
            </h2>
            <p className="li-overlay-sub">
              Descubra atalhos visuais para resolver continhas de cabeça. Escolha seu ritmo:
            </p>

            {/* ── Mode Selector ── */}
            <div className="li-mode-selector" role="radiogroup" aria-label="Modo de jogo">
              <button
                type="button"
                className={`li-mode-btn ${gameMode === 'discovery' ? 'li-mode-btn--active' : ''}`}
                onClick={() => setGameMode('discovery')}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                <span className="li-mode-title">🌱 Modo Descoberta</span>
                <span className="li-mode-desc">Luz Guia sempre acesa · Ritmo tranquilo</span>
              </button>
              <button
                type="button"
                className={`li-mode-btn ${gameMode === 'arcade' ? 'li-mode-btn--active' : ''}`}
                onClick={() => setGameMode('arcade')}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                <span className="li-mode-title">⚡ Modo Arcade</span>
                <span className="li-mode-desc">Velocidade total · Dica se hesitar</span>
              </button>
            </div>

            <div className="li-overlay-mechanic-list">
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">🧮</span>
                <span>
                  <strong>Raio de Plasma (Matar-Math)</strong> — Clique na bolha certa ou aperte{' '}
                  <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> para destruir o alien na hora + ganhar{' '}
                  <strong>LASER por 5s!</strong>
                </span>
              </div>
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">💡</span>
                <span>
                  <strong>6 Lentes Mentais</strong> — Veja como desmontar somas, subtrações, dobros e metades sem decorar tabuada.
                </span>
              </div>
              <div className="li-overlay-mechanic">
                <span className="li-m-icon">🔫</span>
                <span>
                  <strong>Bala Normal</strong> (<kbd>Espaço</kbd> / segure) — Causa 1 de dano no corpo do alien e destrói blocos dos Bosses.
                </span>
              </div>
            </div>

            <div className="li-overlay-keys">
              <span><kbd>A</kbd><kbd>D</kbd> Mover</span>
              <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Bolhas</span>
              <span><kbd>Espaço</kbd> Atirar</span>
              <span>🖱️/📱 Toque nas bolhas</span>
            </div>

            <div className="li-overlay-action-row">
              <button
                id="li-start-btn"
                className="li-start-btn"
                onClick={() => {
                  if (wrapperRef.current) requestFullScreen(wrapperRef.current);
                  startGame(gameMode);
                }}
                style={{ touchAction: 'auto', pointerEvents: 'auto' }}
              >
                ⛶ INICIAR (TELA CHEIA)
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
          📱 Toque nas bolhas (ou aperte 1, 2, 3) para Matar-Math · Segure e deslize para mover e atirar!
        </p>
      )}

      {/* ══════════════════════════════════════════════
          SAVE SCORE OVERLAY + GRIMÓRIO DA SESSÃO
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
              <div className="li-save-stat">
                <span className="li-save-stat-label">MATAR-MATH</span>
                <span className="li-save-stat-value" style={{ color: '#00ff88' }}>
                  {sessionSummary.mathKillsTotal}
                </span>
              </div>
              <div className="li-save-stat">
                <span className="li-save-stat-label">SEQUÊNCIA MÁX</span>
                <span className="li-save-stat-value" style={{ color: '#ffdd44' }}>
                  🔥{sessionSummary.bestStreak || bestStreak}
                </span>
              </div>
            </div>

            {sessionSummary.masteredTips.length > 0 && (
              <div className="li-grimoire-box">
                <div className="li-grimoire-title">
                  🧠 Truques Mentais Dominados na Sessão ({sessionSummary.masteredTips.length})
                </div>
                <ul className="li-grimoire-list">
                  {sessionSummary.masteredTips.slice(-4).map((tip, idx) => (
                    <li key={idx} className="li-grimoire-item">
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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

import {
  useState, useEffect, useRef, useCallback, CSSProperties,
} from 'react';
import { Question, snapVal } from './mathEngine';
import { formatPower } from './utils';
import { soundEngine } from './soundEngine';

// ── Public interface ───────────────────────────────────────────────────────────
export interface ChoiceOption { value: number; isCorrect: boolean; }
interface CombatArenaProps {
  playerPower: number;
  monsterLevel: number;
  question: Question;
  choices: ChoiceOption[];
  onResult: (correct: boolean, survivedPower: number, speedBonusPct?: number) => void;
  isBoss?: boolean;
  isDesperationMode?: boolean;
  isImpossibleMode?: boolean;
  streak?: number;
}

// ── Canvas & game constants ────────────────────────────────────────────────────
const CANVAS_W = 192;
const CANVAS_H = 264;
const PA_MAX_HP = 5;
const PA_TIMER_SECS = 30;
const ARROW_SPEED_PMS = CANVAS_H / 350;   // px/ms → bottom→top in 350ms
const CHARGE_SUPER_MS = 800;              // hold ≥ 800ms → super arrow (5 dmg)
const AUTO_FIRE_MS = 220;                 // auto-fire rate while pointer held
const PLAYER_LERP_K = 0.18;               // per-frame lerp factor for player X
const MONSTER_SPEED = 38;                 // px/s base speed for monster glide
const ENTITY_ROW_Y = 24;                  // monster Y — single row of 24px at top

// ── CSS keyframes ──────────────────────────────────────────────────────────────
const ARENA_STYLES = `
@keyframes arena-enter {
  from { opacity:0; transform:scale(.90) translateY(12px); }
  to   { opacity:1; transform:scale(1)   translateY(0); }
}
@keyframes result-pulse { 0%,100%{opacity:1;} 50%{opacity:.55;} }
@keyframes btn-shake {
  0%,100%{transform:translateX(0);}  20%{transform:translateX(-6px);}
  40%{transform:translateX(6px);}    60%{transform:translateX(-4px);}
  80%{transform:translateX(4px);}
}
@keyframes critical-banner-pulse {
  0%,100%{background:rgba(255,0,0,.18);border-color:#ff444466;}
  50%{background:rgba(255,0,0,.36);border-color:#ff4444cc;}
}
@keyframes player-damage {
  0%,100%{transform:scale(1) translateX(0) rotate(0);filter:brightness(1);}
  20%{transform:scale(.9) translateX(-10px) rotate(-5deg);filter:brightness(2) drop-shadow(0 0 20px red);}
  40%{transform:scale(1.05) translateX(10px) rotate(5deg);filter:brightness(.5);}
  60%{transform:translateX(-10px) rotate(-5deg);}
  80%{transform:translateX(10px) rotate(5deg);}
}
@keyframes desperation-border {
  0%,100%{box-shadow:0 0 30px rgba(255,0,0,.35),0 0 60px rgba(255,0,0,.15);border-color:#ff2222;}
  50%{box-shadow:0 0 60px rgba(255,0,0,.75),0 0 120px rgba(255,0,0,.30);border-color:#ff8888;}
}
@keyframes desperation-banner {0%,100%{background:rgba(255,0,0,.14);}50%{background:rgba(255,0,0,.28);}}
@keyframes desperation-text   {0%,100%{opacity:1;transform:scale(1);}50%{opacity:.75;transform:scale(1.04);}}
@keyframes lifeline-reveal    {from{opacity:0;transform:scale(.7) translateY(-8px);}to{opacity:1;transform:scale(1) translateY(0);}}
@keyframes toast-in {
  0%{opacity:0;transform:translateX(-50%) translateY(-18px) scale(.8);}
  60%{transform:translateX(-50%) translateY(4px) scale(1.05);}
  100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}
}
@keyframes toast-out {
  0%{opacity:1;transform:translateX(-50%) translateY(0);}
  100%{opacity:0;transform:translateX(-50%) translateY(-20px);}
}
`;

// ── Shared atom components ─────────────────────────────────────────────────────
function CombatantCard({ emoji, name, statLabel, statValue, color, extraStyle }: {
  emoji: string; name: string; statLabel: string; statValue: number; color: string; extraStyle?: CSSProperties;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '10px 14px', background: `${color}0e`, border: `1px solid ${color}33`, borderRadius: 12, minWidth: 98, ...extraStyle
    }}>
      <span style={{ fontSize: 30 }}>{emoji}</span>
      <span style={{ fontSize: 9, color: `${color}aa`, fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 2 }}>{name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 9, color: '#475569', fontFamily: "'Courier New',monospace" }}>{statLabel}</span>
        <span style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>{formatPower(statValue)}</span>
      </div>
    </div>
  );
}

type BtnState = 'idle' | 'correct' | 'wrong' | 'reveal' | 'dim' | 'eliminated';
function ChoiceBtn({
  index, value, state, onClick, label,
}: {
  index: number; value: number; state: BtnState; onClick: () => void; label?: string;
}) {
  const MAP: Record<BtnState, CSSProperties> = {
    idle:       { background: 'rgba(15,23,42,.92)', border: '2px solid #334155', color: '#e2e8f0', cursor: 'pointer', transition: 'transform .12s,opacity .12s,border-color .12s' },
    correct:    { background: 'rgba(0,65,20,.78)',  border: '2px solid #00ff66', color: '#00ff66', cursor: 'default', transform: 'scale(1.04)', opacity: 1, animation: 'result-pulse .8s ease infinite' },
    wrong:      { background: 'rgba(65,0,0,.75)',   border: '2px solid #ff4444', color: '#ff4444', cursor: 'default', animation: 'btn-shake .4s ease' },
    reveal:     { background: 'rgba(0,45,15,.55)',  border: '2px dashed #00ff66', color: '#00ff66', cursor: 'default', opacity: .88 },
    dim:        { background: 'rgba(10,10,20,.5)',  border: '2px solid #1e293b', color: '#334155', cursor: 'default', opacity: .4 },
    eliminated: { background: 'rgba(5,5,15,.35)',   border: '2px dashed #1e293b22', color: '#1e2936', cursor: 'default', opacity: .16, pointerEvents: 'none' as const },
  };
  return (
    <button
      onClick={onClick}
      disabled={state !== 'idle'}
      style={{
        position: 'relative',
        willChange: 'transform',
        width: '100%',
        padding: '15px 10px',
        borderRadius: 10,
        fontSize: 24,
        fontWeight: 800,
        fontFamily: "'Courier New',monospace",
        outline: 'none',
        ...MAP[state],
      }}
      onMouseEnter={e => {
        if (state === 'idle') {
          e.currentTarget.style.transform = 'scale(1.03)';
          e.currentTarget.style.borderColor = '#00d4ff';
        }
      }}
      onMouseLeave={e => {
        if (state === 'idle') {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = '#334155';
        }
      }}
    >
      <span style={{
        position: 'absolute',
        top: 6,
        left: 8,
        fontSize: 10,
        fontWeight: 700,
        padding: '1px 5px',
        borderRadius: 4,
        background: 'rgba(0,212,255,0.12)',
        border: '1px solid rgba(0,212,255,0.28)',
        color: '#00d4ff',
      }}>
        {index + 1}
      </span>
      {label ?? value}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  POCKET ARENA — Continuous-X fluid shooter, 60fps canvas
// ─────────────────────────────────────────────────────────────────────────────
interface ArrowEntity {
  id: number;
  x: number;
  y: number;
  dmg: number;
  isSuper: boolean;
}

const HIT_RADIUS = 28;

function PocketArena({
  isBoss, onStun, onExpire, onTimerTick,
}: {
  isBoss: boolean;
  onStun: () => void;
  onExpire: () => void;
  onTimerTick?: (remainingRatio: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const isRunning = useRef(false);

  const onStunRef = useRef(onStun); onStunRef.current = onStun;
  const onExpireRef = useRef(onExpire); onExpireRef.current = onExpire;
  const onTimerTickRef = useRef(onTimerTick); onTimerTickRef.current = onTimerTick;

  const timerTextRef = useRef<HTMLSpanElement>(null);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const hpTextRef = useRef<HTMLSpanElement>(null);
  const hpBarRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<'playing' | 'stunned' | 'expired'>('playing');

  const gs = useRef({
    playerX: CANVAS_W / 2,
    targetX: CANVAS_W / 2,
    monsterX: CANVAS_W / 2,
    monsterVX: MONSTER_SPEED,
    monsterFlash: 0,
    arrows: [] as ArrowEntity[],
    nextArrowId: 0,
    monsterHP: PA_MAX_HP,
    isHeld: false,
    chargeStart: 0,
    lastAutoFire: 0,
    startTime: 0,
    stunned: false,
    expired: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isRunning.current = false;
    cancelAnimationFrame(rafRef.current);

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const g = gs.current;
    g.playerX = CANVAS_W / 2; g.targetX = CANVAS_W / 2;
    g.monsterX = CANVAS_W / 2; g.monsterVX = MONSTER_SPEED;
    g.monsterFlash = 0; g.arrows = []; g.nextArrowId = 0;
    g.monsterHP = PA_MAX_HP; g.isHeld = false;
    g.chargeStart = 0; g.lastAutoFire = 0;
    g.startTime = 0; g.stunned = false; g.expired = false;

    if (timerTextRef.current) timerTextRef.current.textContent = PA_TIMER_SECS.toFixed(0) + 's';
    if (timerBarRef.current) timerBarRef.current.style.width = '100%';
    if (hpTextRef.current) hpTextRef.current.textContent = `${PA_MAX_HP} / ${PA_MAX_HP}`;
    if (hpBarRef.current) hpBarRef.current.style.width = '100%';

    isRunning.current = true;
    let lastT = -1;

    function tick(ts: number) {
      if (!isRunning.current) return;

      if (lastT < 0) {
        lastT = ts;
        g.startTime = ts;
        g.lastAutoFire = ts;
      }
      const dt = Math.min(ts - lastT, 50);
      const dtS = dt / 1000;
      lastT = ts;

      try {
        // ── Speed Bonus Window (Non-punishing!) ───────────────────────────
        const remaining = Math.max(0, PA_TIMER_SECS - (ts - g.startTime) / 1000);
        const ratio = remaining / PA_TIMER_SECS;
        onTimerTickRef.current?.(ratio);

        if (timerTextRef.current) {
          timerTextRef.current.textContent = remaining > 0 ? `+${Math.ceil(ratio * 20)}% (${remaining.toFixed(0)}s)` : 'Sem bônus';
          const col = remaining > 15 ? '#ffd700' : remaining > 6 ? '#00d4ff' : '#64748b';
          timerTextRef.current.style.color = col;
        }
        if (timerBarRef.current) {
          const pct = ratio * 100;
          const col = remaining > 15 ? '#ffd700' : remaining > 6 ? '#00d4ff' : '#475569';
          timerBarRef.current.style.width = pct + '%';
          timerBarRef.current.style.background = `linear-gradient(90deg,${col}66,${col})`;
        }
        if (remaining <= 0 && !g.expired) {
          g.expired = true;
          setPhase('expired');
          onExpireRef.current();
          // Keep canvas alive for shooting even if speed bonus expired!
        }

        // ── Player smooth lerp ─────────────────────────────────────────────
        g.playerX += (g.targetX - g.playerX) * PLAYER_LERP_K;
        g.playerX = Math.max(14, Math.min(CANVAS_W - 14, g.playerX));

        // ── Monster glide ──────────────────────────────────────────────────
        g.monsterX += g.monsterVX * dtS;
        if (g.monsterX < 14) { g.monsterX = 14; g.monsterVX = Math.abs(g.monsterVX) * (0.9 + Math.random() * 0.2); }
        if (g.monsterX > CANVAS_W - 14) { g.monsterX = CANVAS_W - 14; g.monsterVX = -Math.abs(g.monsterVX) * (0.9 + Math.random() * 0.2); }

        g.monsterFlash = Math.max(0, g.monsterFlash - dt / 180);

        // ── Auto-fire ──────────────────────────────────────────────────────
        if (g.isHeld && ts - g.lastAutoFire > AUTO_FIRE_MS) {
          g.lastAutoFire = ts;
          g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 1, isSuper: false });
          soundEngine.playArrow(false);
        }

        // ── Arrow movement + collision ─────────────────────────────────────
        const rem: number[] = [];
        for (let i = 0; i < g.arrows.length; i++) {
          const a = g.arrows[i];
          a.y -= ARROW_SPEED_PMS * dt;
          if (a.y < -16) { rem.push(i); continue; }
          if (a.y <= ENTITY_ROW_Y + HIT_RADIUS) {
            const dx = a.x - g.monsterX;
            if (Math.abs(dx) < HIT_RADIUS) {
              rem.push(i);
              const newHP = Math.max(0, g.monsterHP - a.dmg);
              g.monsterHP = newHP; g.monsterFlash = 1.0;
              soundEngine.playMonsterHit();
              if (hpTextRef.current) hpTextRef.current.textContent = `${newHP} / ${PA_MAX_HP}`;
              if (hpBarRef.current) hpBarRef.current.style.width = `${(newHP / PA_MAX_HP) * 100}%`;
              if (newHP <= 0 && !g.stunned) {
                g.stunned = true; isRunning.current = false;
                setPhase('stunned'); onStunRef.current(); return;
              }
              g.monsterVX *= -1.25;
            }
          }
        }
        for (let i = rem.length - 1; i >= 0; i--) g.arrows.splice(rem[i], 1);

        // ══════════════════════════ DRAW ════════════════════════════════════
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#080d18';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let sy = 0; sy < CANVAS_H; sy += 4) ctx.fillRect(0, sy, CANVAS_W, 2);

        ctx.fillStyle = 'rgba(255,40,40,0.06)';
        ctx.fillRect(0, 0, CANVAS_W, ENTITY_ROW_Y * 2);

        ctx.fillStyle = 'rgba(0,212,255,0.04)';
        ctx.fillRect(0, CANVAS_H - ENTITY_ROW_Y * 2, CANVAS_W, ENTITY_ROW_Y * 2);

        if (g.isHeld) {
          const held = ts - g.chargeStart;
          const pct = Math.min(1, held / CHARGE_SUPER_MS);
          const pulse = Math.sin(ts / 80) * 0.5 + 0.5;
          const isReady = pct >= 1;
          ctx.shadowBlur = 0;
          ctx.fillStyle = isReady
            ? `rgba(255,215,0,${0.07 + 0.13 * pulse})`
            : `rgba(168,85,247,${0.04 + 0.10 * pct})`;
          const bw = 28 + 16 * pct;
          ctx.fillRect(g.playerX - bw / 2, 0, bw, CANVAS_H);

          if (pct > 0.1) {
            ctx.beginPath();
            ctx.arc(g.playerX, CANVAS_H - ENTITY_ROW_Y, 10 + 8 * pct, 0, Math.PI * 2);
            ctx.shadowBlur = 8 + 18 * pct;
            ctx.shadowColor = isReady ? '#ffd700' : '#a855f7';
            ctx.strokeStyle = isReady
              ? `rgba(255,215,0,${0.45 + 0.45 * pulse})`
              : `rgba(168,85,247,${0.25 + 0.35 * pct})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
        }

        for (const a of g.arrows) {
          if (a.isSuper) {
            ctx.shadowBlur = 18; ctx.shadowColor = '#ffd700';
            ctx.fillStyle = '#ffd700'; ctx.font = 'bold 20px monospace';
          } else {
            ctx.shadowBlur = 6; ctx.shadowColor = '#00d4ff';
            ctx.fillStyle = '#00d4ff'; ctx.font = 'bold 13px monospace';
          }
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('▲', a.x, a.y);
          ctx.shadowBlur = 0;
        }

        const fl = g.monsterFlash;
        const me = g.monsterHP <= 0 ? '😵' : g.monsterHP <= 1 ? '😰' : g.monsterHP <= 3 ? '😤' : isBoss ? '👹' : '💀';
        if (fl > 0) { ctx.shadowBlur = 22 * fl; ctx.shadowColor = `rgba(255,220,0,${fl})`; }
        ctx.font = `${Math.round(18 + 7 * fl)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(me, g.monsterX, ENTITY_ROW_Y);
        ctx.shadowBlur = 0;

        const glowPct = g.isHeld ? Math.min(1, (ts - g.chargeStart) / CHARGE_SUPER_MS) : 0;
        if (glowPct < 0.15) {
          ctx.font = '17px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👾', g.playerX, CANVAS_H - ENTITY_ROW_Y);
        } else {
          ctx.shadowBlur = 12 + 20 * glowPct;
          ctx.shadowColor = glowPct >= 1 ? '#ffd700' : '#a855f7';
          ctx.font = '17px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👾', g.playerX, CANVAS_H - ENTITY_ROW_Y);
          ctx.shadowBlur = 0;
        }

      } catch (err) {
        console.error('[PocketArena] tick crash:', err);
        isRunning.current = false; return;
      }

      if (isRunning.current) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { isRunning.current = false; cancelAnimationFrame(rafRef.current); };
  }, [isBoss]);

  function xFromPointer(e: React.PointerEvent<HTMLCanvasElement>): number {
    const c = canvasRef.current;
    if (!c) return gs.current.targetX;
    const r = c.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * CANVAS_W;
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation(); e.preventDefault();
    const g = gs.current;
    if (g.stunned) return;
    g.targetX = xFromPointer(e);
    g.isHeld = true;
    g.chargeStart = performance.now();
    g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 1, isSuper: false });
    soundEngine.playArrow(false);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const g = gs.current;
    if (!g.isHeld || g.stunned) return;
    g.targetX = xFromPointer(e);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation(); e.preventDefault();
    const g = gs.current;
    if (!g.isHeld || g.stunned) return;
    const held = performance.now() - g.chargeStart;
    g.isHeld = false;
    if (held >= CHARGE_SUPER_MS) {
      g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 5, isSuper: true });
      soundEngine.playArrow(true);
    }
  }, []);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const g = gs.current;
    if (!g.isHeld || g.stunned) return;
    g.isHeld = false;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: '100%' }}>
      {/* Speed Bonus Bar (Non-anxiety-inducing!) */}
      {phase !== 'stunned' && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚡ Bônus Rápido
            </span>
            <span ref={timerTextRef} style={{ fontSize: 11, fontWeight: 800, fontFamily: "'Courier New',monospace", color: '#ffd700' }}>
              +20% (30s)
            </span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 100, overflow: 'hidden' }}>
            <div ref={timerBarRef} style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,#ffd70066,#ffd700)', borderRadius: 100 }} />
          </div>
        </div>
      )}

      {/* Monster Shield HP bar */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
            {phase === 'stunned' ? '😵 ESCUDO QUEBRADO' : '🛡️ Escudo (50/50)'}
          </span>
          <span ref={hpTextRef} style={{ fontSize: 11, fontWeight: 700, fontFamily: "'Courier New',monospace", color: '#ff8888' }}>
            {PA_MAX_HP} / {PA_MAX_HP}
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,80,80,.12)', borderRadius: 100, overflow: 'hidden', border: '1px solid rgba(255,80,80,.2)' }}>
          <div ref={hpBarRef} style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,#ff4444,#ff8888)', borderRadius: 100, transition: 'width .12s ease' }} />
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', borderRadius: 6, border: '1px solid rgba(255,255,255,.09)', touchAction: 'none', cursor: phase === 'stunned' ? 'default' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />

      {phase === 'stunned' ? (
        <div style={{ textAlign: 'center', padding: '8px 12px', background: 'rgba(255,215,0,.09)', border: '1px solid rgba(255,215,0,.28)', borderRadius: 10, animation: 'lifeline-reveal .4s ease both', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 800, fontFamily: "'Courier New',monospace" }}>🏹 Escudo Quebrado!</div>
          <div style={{ fontSize: 10, color: '#cbd5e1', fontFamily: "'Courier New',monospace", marginTop: 2 }}>2 respostas erradas eliminadas</div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 9, color: '#475569', fontFamily: "'Courier New',monospace", textAlign: 'center', lineHeight: 1.4 }}>
          Opcional: Segure e arraste no mini-mapa para quebrar o escudo e eliminar 2 opções!
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMBAT ARENA
// ─────────────────────────────────────────────────────────────────────────────
export function CombatArena({
  playerPower, monsterLevel, question, choices, onResult,
  isBoss = false, isDesperationMode = false, isImpossibleMode = false,
  streak = 0,
}: CombatArenaProps) {
  const correctAnswer = choices.find(c => c.isCorrect)!.value;

  // Treat Impossible Mode as playable High-Stakes Redemption Mode so the player ALWAYS gets to calculate!
  const highRiskMode = isDesperationMode || isImpossibleMode;

  // ── QTE & Streak Lifeline state ──────────────────────────────────────────────
  const [earnedLifeline, setEarnedLifeline] = useState(false);
  const [eliminatedIdxs, setEliminatedIdxs] = useState<number[]>(() => {
    // Fever Streak Reward: if streak >= 3, automatically eliminate 1 wrong option right away!
    if (streak >= 3) {
      const wrongIdxs = choices
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !c.isCorrect)
        .map(({ i }) => i);
      if (wrongIdxs.length > 0) {
        return [wrongIdxs[Math.floor(Math.random() * wrongIdxs.length)]];
      }
    }
    return [];
  });
  const [showToast, setShowToast] = useState(false);
  const [toastFading, setToastFading] = useState(false);
  const [showStudyHint, setShowStudyHint] = useState(false);

  // ── Second Wind (math) state ─────────────────────────────────────────────────
  const [mistakeCount, setMistakeCount] = useState(0);
  const [currentPowerSnapshot, setCurrentPowerSnapshot] = useState(playerPower);
  const [isTakingDamage, setIsTakingDamage] = useState(false);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [secondPick, setSecondPick] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);
  const [holdExplanation, setHoldExplanation] = useState(false);

  const resolvedRef = useRef(false);
  const speedRatioRef = useRef(1);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const finalPick = secondPick !== null ? secondPick : firstPick;
  const wasCorrect = finalPick !== null && snapVal(finalPick) === snapVal(correctAnswer);
  const onResultRef = useRef(onResult); onResultRef.current = onResult;

  const registerTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    soundEngine.playCombatStart(isBoss);
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [isBoss]);

  const finishCombat = useCallback(() => {
    const speedBonusPct = wasCorrect ? Math.round(speedRatioRef.current * 20) : 0;
    onResultRef.current(wasCorrect, currentPowerSnapshot, speedBonusPct);
  }, [wasCorrect, currentPowerSnapshot]);

  // ── Auto-close after math resolves (unless user clicked/hovered to study methods) ──
  useEffect(() => {
    if (!resolved || holdExplanation) return;
    const id = setTimeout(() => {
      finishCombat();
    }, 2400);
    return () => clearTimeout(id);
  }, [resolved, holdExplanation, finishCombat]);

  // ── QTE stun callback ────────────────────────────────────────────────────────
  const handleStun = useCallback(() => {
    if (resolvedRef.current) return;
    soundEngine.playStun5050();
    const wrongIdxs = choices
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.isCorrect && c.value !== firstPick)
      .map(({ i }) => i);
    for (let i = wrongIdxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongIdxs[i], wrongIdxs[j]] = [wrongIdxs[j], wrongIdxs[i]];
    }
    setEliminatedIdxs(wrongIdxs.slice(0, 2));
    setEarnedLifeline(true);
    setShowToast(true); setToastFading(false);
    registerTimeout(() => setToastFading(true), 2100);
    registerTimeout(() => setShowToast(false), 2700);
  }, [choices, firstPick, registerTimeout]);

  // ── Math pick handler ────────────────────────────────────────────────────────
  const handlePick = useCallback((opt: ChoiceOption, idx: number) => {
    if (resolved || isTakingDamage) return;
    if (eliminatedIdxs.includes(idx)) return;

    const isSecondAttempt = mistakeCount === 1;

    if (!isSecondAttempt) {
      setFirstPick(opt.value);
      if (opt.isCorrect) {
        soundEngine.playMathEureka(streak + 1);
        resolvedRef.current = true;
        setResolved(true);
        return;
      }
      if (highRiskMode) {
        soundEngine.playMathError();
        resolvedRef.current = true;
        setResolved(true);
        return;
      }

      // Second Wind — halve power; QTE canvas loop CONTINUES uninterrupted
      const halved = Math.floor(currentPowerSnapshot / 2);
      if (halved <= 0) {
        soundEngine.playMathError();
        setCurrentPowerSnapshot(0);
        setMistakeCount(1);
        resolvedRef.current = true;
        setResolved(true);
        return;
      }
      soundEngine.playSecondWind();
      setCurrentPowerSnapshot(halved);
      setMistakeCount(1);
      setIsTakingDamage(true);
      registerTimeout(() => setIsTakingDamage(false), 700);
      return;
    }

    // Second attempt
    if (opt.value === firstPick) return;
    setSecondPick(opt.value);
    if (opt.isCorrect) {
      soundEngine.playMathEureka(1);
    } else {
      soundEngine.playMathError();
    }
    resolvedRef.current = true;
    setResolved(true);
  }, [resolved, isTakingDamage, eliminatedIdxs, mistakeCount, streak, highRiskMode, currentPowerSnapshot, firstPick, registerTimeout]);

  // ── Keyboard shortcuts [1] [2] [3] [4] + [Space]/[Enter] to advance ──────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (resolved) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finishCombat();
        }
        return;
      }
      let idx = -1;
      if (e.key === '1' || e.code === 'Numpad1') idx = 0;
      else if (e.key === '2' || e.code === 'Numpad2') idx = 1;
      else if (e.key === '3' || e.code === 'Numpad3') idx = 2;
      else if (e.key === '4' || e.code === 'Numpad4') idx = 3;

      if (idx >= 0 && idx < choices.length) {
        e.preventDefault();
        e.stopPropagation();
        handlePick(choices[idx], idx);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [resolved, choices, handlePick, finishCombat]);

  // ── Button state ─────────────────────────────────────────────────────────────
  function getBtnState(opt: ChoiceOption, idx: number): BtnState {
    if (!resolved && eliminatedIdxs.includes(idx)) return 'eliminated';
    if (!resolved && mistakeCount === 0) return 'idle';
    if (!resolved && mistakeCount === 1) {
      if (opt.value === firstPick && !opt.isCorrect) return 'wrong';
      if (eliminatedIdxs.includes(idx)) return 'eliminated';
      return 'idle';
    }
    if (opt.isCorrect) return finalPick === opt.value ? 'correct' : 'reveal';
    if (opt.value === firstPick || opt.value === secondPick) return 'wrong';
    return 'dim';
  }

  function getAnswerLabel(val: number): string | undefined {
    if (!question.answerLabels) return undefined;
    return question.answerLabels[snapVal(val)] ?? question.answerLabels[val];
  }

  const streakBonusPct = Math.min(50, streak * 10);
  const baseGain = highRiskMode ? Math.round(monsterLevel * 0.5) : monsterLevel;
  const gainIfCorrect = Math.round(baseGain * (1 + streakBonusPct / 100));
  const lossIfWrong = Math.round(monsterLevel * 0.5);

  type Delta = number | 'death' | null;
  const resultDelta: Delta = !resolved ? null
    : wasCorrect ? gainIfCorrect
      : (highRiskMode ? 'death' : -lossIfWrong);

  const playerExtraStyle: CSSProperties = isTakingDamage
    ? { animation: 'player-damage .65s cubic-bezier(.36,.07,.19,.97)' } : {};

  const accentColor = highRiskMode ? '#ff2222' : isBoss ? '#8800cc' : '#1e3a5a';

  return (
    <>
      <style>{ARENA_STYLES}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(4,4,16,.95)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12, willChange: 'transform',
      }}>
        <div style={{
          width: '95vw', maxWidth: 940,
          background: highRiskMode ? '#180404' : '#070c18',
          border: `2px solid ${accentColor}`, borderRadius: 14,
          overflow: 'hidden', position: 'relative',
          animation: highRiskMode
            ? 'arena-enter .2s cubic-bezier(.34,1.56,.64,1) forwards, desperation-border .7s ease .2s infinite'
            : 'arena-enter .2s cubic-bezier(.34,1.56,.64,1) forwards',
          boxShadow: highRiskMode
            ? '0 0 60px rgba(255,0,0,.35), 0 0 30px rgba(255,0,0,.18)'
            : '0 0 60px rgba(0,0,0,.9), 0 0 30px rgba(0,212,255,.06)',
          maxHeight: '96vh', overflowY: 'auto',
        }}>

          {/* Toast */}
          {showToast && (
            <div style={{
              position: 'sticky', top: 8, left: '50%',
              width: 'max-content', maxWidth: '86%',
              zIndex: 20, pointerEvents: 'none',
              display: 'block', marginLeft: 'auto', marginRight: 'auto',
              background: 'linear-gradient(135deg,rgba(255,215,0,.24),rgba(0,212,255,.16))',
              border: '1px solid #ffd70099', borderRadius: 10,
              padding: '9px 20px', fontSize: 13, fontWeight: 800,
              fontFamily: "'Courier New',monospace", color: '#ffd700', letterSpacing: 1,
              boxShadow: '0 0 28px rgba(255,215,0,.55)',
              animation: toastFading ? 'toast-out .6s ease forwards' : 'toast-in .45s cubic-bezier(.34,1.56,.64,1) forwards',
              whiteSpace: 'nowrap',
            }}>
              🏹 ESCUDO QUEBRADO! 50/50 ATIVADO!
            </div>
          )}

          {/* Header */}
          <div style={{
            background: highRiskMode ? 'linear-gradient(135deg,#2a0000,#180000)' : isBoss ? 'linear-gradient(135deg,#1a0028,#0f0020)' : 'linear-gradient(135deg,#0d1b2a,#0a1628)',
            borderBottom: `1px solid ${highRiskMode ? '#ff222255' : isBoss ? '#8800cc44' : '#1e3a5a'}`,
            padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: highRiskMode ? '#ff6666' : '#64748b', fontFamily: "'Courier New',monospace", letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {isImpossibleMode ? '🔥 Desafio de Superação' : isDesperationMode ? '⚠️ Modo Desespero' : isBoss ? '👹 Confronto Final' : '⚔️ Combate Lógico'}
              </span>
              {question.lensTitle && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#00d4ff',
                  background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
                  padding: '2px 9px', borderRadius: 100, fontFamily: "'Courier New',monospace",
                }}>
                  🧠 {question.lensTitle}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {streak > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 800, color: '#ffd700',
                  background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)',
                  padding: '2px 10px', borderRadius: 100, fontFamily: "'Courier New',monospace",
                }}>
                  🔥 Sequência ×{streak} (+{streakBonusPct}% poder)
                </span>
              )}
              <span style={{ fontSize: 12, color: highRiskMode ? '#ff6666' : '#94a3b8', fontFamily: "'Courier New',monospace", letterSpacing: 1 }}>
                Teclas [1] [2] [3] [4]
              </span>
            </div>
          </div>

          {/* High-risk banner */}
          {highRiskMode && (
            <div style={{ padding: '8px 18px', textAlign: 'center', animation: 'desperation-banner .7s ease infinite', borderBottom: '1px solid #ff222244', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 12, color: '#ff8888', fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: 1 }}>
                {isImpossibleMode
                  ? `Monstro muito acima do seu poder! Acerte de primeira para sobreviver e ganhar +${formatPower(gainIfCorrect)}!`
                  : `Monstro mais forte que você — Acerte de primeira para virar o jogo!`}
              </span>
            </div>
          )}

          {/* Second Wind banner */}
          {mistakeCount === 1 && !resolved && (
            <div style={{ padding: '8px 18px', textAlign: 'center', animation: 'critical-banner-pulse .65s ease infinite', borderBottom: '1px solid #ff444433', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <span style={{ fontSize: 15 }}>🛡️</span>
              <span style={{ fontSize: 12, color: '#ffaaaa', fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: 1 }}>
                SEGUNDO FÔLEGO! Seu escudo absorveu o erro (−50% poder). Olhe a dica abaixo e tente de novo!
              </span>
            </div>
          )}

          {/* Streak / Lifeline active banner */}
          {(earnedLifeline || streak >= 3) && !resolved && (
            <div style={{ padding: '5px 18px', textAlign: 'center', background: 'rgba(255,215,0,.07)', borderBottom: '1px solid rgba(255,215,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'lifeline-reveal .4s ease both' }}>
              <span style={{ fontSize: 13 }}>{earnedLifeline ? '🏹' : '🔥'}</span>
              <span style={{ fontSize: 11, color: '#ffd700', fontFamily: "'Courier New',monospace", fontWeight: 700 }}>
                {earnedLifeline
                  ? '50/50 ATIVO — 2 respostas erradas eliminadas!'
                  : `SINCRONIA LÓGICA (×${streak}) — 1 opção errada eliminada automaticamente!`}
              </span>
            </div>
          )}

          {/* ════ BODY: [Canvas Grid] | [Math] ════ */}
          <div className="ca-body" style={{ display: 'grid', gridTemplateColumns: '215px 1fr' }}>

            {/* LEFT — PocketArena */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '14px 12px 16px',
              borderRight: `1px solid ${accentColor}44`,
              background: 'rgba(0,0,0,.2)',
            }}>
              <span style={{ fontSize: 10, color: highRiskMode ? '#ff4444' : isBoss ? '#cc44ff' : '#00d4ff', fontFamily: "'Courier New',monospace", letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
                🏹 Quebra-Escudo
              </span>
              <PocketArena
                isBoss={isBoss}
                onStun={handleStun}
                onExpire={() => {}}
                onTimerTick={(r) => { speedRatioRef.current = r; }}
              />
            </div>

            {/* RIGHT — Math & Multi-Path Explanations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 18px 18px' }}>

              {/* Stat cards */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
                <CombatantCard
                  emoji="👾" name="Você" statLabel="Poder"
                  statValue={currentPowerSnapshot}
                  color={mistakeCount === 1 ? '#ff8844' : '#00ff66'}
                  extraStyle={playerExtraStyle}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 58 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "'Courier New',monospace", color: highRiskMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff6b35' }}>VS</span>
                  {resolved && (
                    <div style={{ fontSize: 15, color: wasCorrect ? '#00ff66' : '#ff4444', fontFamily: "'Courier New',monospace", textAlign: 'center', fontWeight: 800, animation: 'result-pulse .8s ease infinite' }}>
                      {wasCorrect ? '✅' : '❌'}<br />
                      {resultDelta === 'death' ? '💀' : resultDelta !== null && resultDelta > 0 ? `+${formatPower(resultDelta)}` : `${resultDelta}`}
                    </div>
                  )}
                  {mistakeCount === 1 && !resolved && !isTakingDamage && (
                    <div style={{ fontSize: 10, color: '#ff8844', fontFamily: "'Courier New',monospace", textAlign: 'center', fontWeight: 700 }}>⚡ 2ª CHANCE</div>
                  )}
                </div>
                <CombatantCard
                  emoji={isBoss ? '👹' : '💀'} name={isBoss ? 'Boss Final' : 'Monstro'} statLabel="Nível"
                  statValue={monsterLevel} color={highRiskMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff4444'}
                />
              </div>

              {/* Question Box */}
              <div style={{ background: 'rgba(0,212,255,.05)', border: '1px solid #1e3a4a', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#38bdf8', fontFamily: "'Courier New',monospace", fontWeight: 700 }}>
                  💡 {question.hint}
                </p>
                <p style={{ margin: '4px 0', fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 900, color: '#f1f5f9', fontFamily: "'Courier New',monospace", letterSpacing: 2, lineHeight: 1.1, textShadow: '0 0 22px rgba(0,212,255,.45)' }}>
                  {question.expression}
                </p>

                {/* Optional pre-answer "Ver Caminhos Mentais" button */}
                {!resolved && question.methods && question.methods.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {!showStudyHint && mistakeCount === 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowStudyHint(true)}
                        style={{
                          background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)',
                          color: '#d8b4fe', borderRadius: 6, padding: '4px 10px', fontSize: 11,
                          fontFamily: "'Courier New',monospace", cursor: 'pointer',
                        }}
                      >
                        🔍 Ver como desmontar essa conta (Atalho Mental)
                      </button>
                    ) : (
                      <div style={{
                        marginTop: 6, padding: '6px 10px', borderRadius: 6,
                        background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.28)',
                        color: '#e9d5ff', fontSize: 12, fontFamily: "'Courier New',monospace", textAlign: 'left',
                      }}>
                        <strong>{question.methods[0].badge}:</strong>{' '}
                        {question.methods[0].summary.replace(/=\s*[^=!]+!?$/, '= ?')}
                      </div>
                    )}
                  </div>
                )}

                {!resolved && (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, fontFamily: "'Courier New',monospace", flexWrap: 'wrap' }}>
                    {highRiskMode ? (
                      <>
                        <span style={{ color: '#ffd700', fontWeight: 700 }}>✅ +{formatPower(gainIfCorrect)} poder</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: '#ff4444', fontWeight: 700 }}>❌ Sem margem para erro</span>
                      </>
                    ) : mistakeCount === 1 ? (
                      <>
                        <span style={{ color: '#00ff66', fontWeight: 700 }}>✅ +{formatPower(gainIfCorrect)} poder</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: '#ff4444', fontWeight: 700 }}>❌ Última tentativa</span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#00ff66', fontWeight: 700 }}>✅ +{formatPower(gainIfCorrect)} poder</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: '#94a3b8' }}>🛡️ 1º erro: Escudo Second Wind</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Answer buttons 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {choices.map((opt, i) => (
                  <ChoiceBtn
                    key={i}
                    index={i}
                    value={opt.value}
                    label={getAnswerLabel(opt.value)}
                    state={getBtnState(opt, i)}
                    onClick={() => handlePick(opt, i)}
                  />
                ))}
              </div>

              {/* Post-result: 3 Ways to Solve + Instant Continue Button */}
              {resolved && (
                <div
                  onMouseEnter={() => setHoldExplanation(true)}
                  onPointerDown={() => setHoldExplanation(true)}
                  style={{
                    background: wasCorrect ? 'rgba(0,38,16,.55)' : 'rgba(42,8,8,.6)',
                    border: `1px solid ${wasCorrect ? '#00ff6655' : '#ff444455'}`,
                    borderRadius: 12, padding: '12px 14px',
                    fontFamily: "'Courier New',monospace",
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <div style={{ color: wasCorrect ? '#00ff66' : '#ff6666', fontWeight: 800, fontSize: 13 }}>
                      {(() => {
                        const al = getAnswerLabel(correctAnswer) ?? correctAnswer;
                        const cs = mistakeCount === 1 ? ' (Segundo Fôlego!)' : '';
                        return wasCorrect
                          ? `✨ EUREKA! Resposta: ${al} · +${formatPower(gainIfCorrect)} poder${cs}`
                          : `❌ Resposta certa: ${al} — Veja os atalhos mentais:`;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={finishCombat}
                      style={{
                        background: wasCorrect ? 'rgba(0,255,102,0.18)' : 'rgba(0,212,255,0.18)',
                        border: `1px solid ${wasCorrect ? '#00ff66' : '#00d4ff'}`,
                        color: wasCorrect ? '#00ff66' : '#00d4ff',
                        borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 800,
                        fontFamily: "'Courier New',monospace", cursor: 'pointer',
                      }}
                    >
                      ▶ Continuar [Espaço]
                    </button>
                  </div>

                  {/* Render the 3 Mental Solution Pathways */}
                  {question.methods && question.methods.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {question.methods.map((m, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(15,23,42,0.75)',
                            borderLeft: `3px solid ${idx === 0 ? '#ffd700' : idx === 1 ? '#00d4ff' : '#a855f7'}`,
                            borderRadius: '0 6px 6px 0',
                            padding: '6px 10px',
                            fontSize: 12,
                            lineHeight: 1.5,
                            color: '#e2e8f0',
                          }}
                        >
                          <div style={{ fontWeight: 800, color: idx === 0 ? '#ffd700' : idx === 1 ? '#38bdf8' : '#c084fc', fontSize: 11 }}>
                            {m.badge}
                          </div>
                          <div>{m.summary}</div>
                        </div>
                      ))}
                      {question.realLifeTip && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, paddingLeft: 4 }}>
                          🌍 <em>{question.realLifeTip}</em>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#cbd5e1', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {question.explanation}
                    </div>
                  )}

                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, textAlign: 'right' }}>
                    {holdExplanation
                      ? '⏸ Leitura pausada — clique em "Continuar" ou aperte [Espaço] quando terminar'
                      : '⏱ Avançando automaticamente (toque aqui para pausar e ler com calma)'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <style>{`
            @media (max-width:640px) {
              .ca-body { grid-template-columns:1fr !important; }
            }
          `}</style>
        </div>
      </div>
    </>
  );
}

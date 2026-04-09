import {
  useState, useEffect, useRef, useCallback, CSSProperties,
} from 'react';
import { Question } from './mathEngine';
import { formatPower } from './utils';

// ── Public interface ───────────────────────────────────────────────────────────
export interface ChoiceOption { value: number; isCorrect: boolean; }
interface CombatArenaProps {
  playerPower: number; monsterLevel: number; question: Question;
  choices: ChoiceOption[];
  onResult: (correct: boolean, survivedPower: number) => void;
  isBoss?: boolean; isDesperationMode?: boolean; isImpossibleMode?: boolean;
}

// ── Canvas & game constants ────────────────────────────────────────────────────
const CANVAS_W = 192;
const CANVAS_H = 288;
const PA_MAX_HP = 5;
const PA_TIMER_SECS = 30;
const ARROW_SPEED_PMS = CANVAS_H / 350;   // px/ms → bottom→top in 350ms
const CHARGE_SUPER_MS = 800;              // hold ≥ 800ms → super arrow (5 dmg)
const AUTO_FIRE_MS = 220;             // auto-fire rate while pointer held
const PLAYER_LERP_K = 0.18;           // per-frame lerp factor for player X
const MONSTER_SPEED = 38;             // px/s base speed for monster glide
const ENTITY_ROW_Y = 24;             // monster Y — single row of 24px at top

// ── CSS keyframes ──────────────────────────────────────────────────────────────
const ARENA_STYLES = `
@keyframes arena-enter {
  from { opacity:0; transform:scale(.88) translateY(14px); }
  to   { opacity:1; transform:scale(1)   translateY(0); }
}
@keyframes result-pulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }
@keyframes timer-danger  { 0%,100%{opacity:1;} 50%{opacity:.35;} }
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
@keyframes impossible-border {
  0%,100%{box-shadow:0 0 40px rgba(180,0,0,.6),0 0 80px rgba(180,0,0,.25);border-color:#880000;}
  50%{box-shadow:0 0 80px rgba(255,20,20,.9),0 0 160px rgba(255,20,20,.4);border-color:#ff0000;}
}
@keyframes impossible-crush {0%{transform:scale(1);}30%{transform:scale(1.04);}60%{transform:scale(.94);}100%{transform:scale(1);}}
@keyframes impossible-text  {0%{letter-spacing:.06em;}50%{letter-spacing:.18em;color:#ff4444;}100%{letter-spacing:.06em;}}
@keyframes lifeline-reveal   {from{opacity:0;transform:scale(.7) translateY(-8px);}to{opacity:1;transform:scale(1) translateY(0);}}
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
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
      padding: '12px 16px', background: `${color}0e`, border: `1px solid ${color}33`, borderRadius: 12, minWidth: 108, ...extraStyle
    }}>
      <span style={{ fontSize: 34 }}>{emoji}</span>
      <span style={{ fontSize: 10, color: `${color}aa`, fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 2 }}>{name}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: 10, color: '#475569', fontFamily: "'Courier New',monospace" }}>{statLabel}</span>
        <span style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>{formatPower(statValue)}</span>
      </div>
    </div>
  );
}

type BtnState = 'idle' | 'correct' | 'wrong' | 'reveal' | 'dim' | 'eliminated';
function ChoiceBtn({ value, state, onClick, label }: { value: number; state: BtnState; onClick: () => void; label?: string; }) {
  const MAP: Record<BtnState, CSSProperties> = {
    // transition: ONLY transform+opacity — never box-shadow/border (causes layout thrash)
    idle: { background: 'rgba(15,23,42,.9)', border: '2px solid #334155', color: '#94a3b8', cursor: 'pointer', transition: 'transform .12s,opacity .12s' },
    correct: { background: 'rgba(0,60,0,.7)', border: '2px solid #00ff00', color: '#00ff00', cursor: 'default', transform: 'scale(1.05)', opacity: 1, animation: 'result-pulse .8s ease infinite' },
    wrong: { background: 'rgba(60,0,0,.7)', border: '2px solid #ff4444', color: '#ff4444', cursor: 'default', animation: 'btn-shake .4s ease' },
    reveal: { background: 'rgba(0,40,0,.5)', border: '2px dashed #00ff00', color: '#00ff00', cursor: 'default', opacity: .8 },
    dim: { background: 'rgba(10,10,20,.5)', border: '2px solid #1e293b', color: '#334155', cursor: 'default', opacity: .4 },
    eliminated: { background: 'rgba(5,5,15,.35)', border: '2px dashed #1e293b22', color: '#1e2936', cursor: 'default', opacity: .14, pointerEvents: 'none' as const },
  };
  return (
    <button onClick={onClick} disabled={state !== 'idle'}
      style={{ willChange: 'transform', width: '100%', padding: '16px 8px', borderRadius: 10, fontSize: 24, fontWeight: 700, fontFamily: "'Courier New',monospace", outline: 'none', ...MAP[state] }}
      onMouseEnter={e => { if (state === 'idle') { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.opacity = '1'; } }}
      onMouseLeave={e => { if (state === 'idle') { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; } }}
    >{label ?? value}</button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  POCKET ARENA — Continuous-X fluid shooter, 60fps canvas
//
//  Movement model (no grid snapping):
//  • playerX  : lerps toward pointer X at PLAYER_LERP_K per frame
//  • monsterX : glides sinusoidally left/right, reverses at walls
//  • Arrows   : continuous X coords, hitTest = distance < HIT_RADIUS
//
//  Input model:
//  • PointerDown → start tracking + start charge timer
//  • PointerMove → update targetX (player ship follows finger)
//  • While held → auto-fire normal arrows every AUTO_FIRE_MS
//  • PointerUp/Leave → if held ≥ CHARGE_SUPER_MS, also fire 5-dmg Super Arrow
//
//  React-render budget: ONE setPhase per game (end state only). Everything
//  else written directly to DOM element refs.
// ─────────────────────────────────────────────────────────────────────────────
interface ArrowEntity {
  id: number;
  x: number;          // continuous canvas X
  y: number;          // canvas Y (top=0, moves up)
  dmg: number;
  isSuper: boolean;
}

const HIT_RADIUS = 28;   // px — continuous hit detection radius

// ─────────────────────────────────────────────────────────────────────────────
function PocketArena({
  isBoss, onStun, onExpire,
}: {
  isBoss: boolean; isDesperationMode: boolean;
  onStun: () => void; onExpire: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const isRunning = useRef(false);   // Strict-Mode zombie guard

  const onStunRef = useRef(onStun); onStunRef.current = onStun;
  const onExpireRef = useRef(onExpire); onExpireRef.current = onExpire;

  // ── Direct DOM refs — ZERO React renders from RAF ─────────────────────────
  const timerTextRef = useRef<HTMLSpanElement>(null);
  const timerBarRef = useRef<HTMLDivElement>(null);
  const hpTextRef = useRef<HTMLSpanElement>(null);
  const hpBarRef = useRef<HTMLDivElement>(null);

  // ── One React state: structural phase (fires exactly once per game) ────────
  const [phase, setPhase] = useState<'playing' | 'stunned' | 'expired'>('playing');

  // ── All mutable game data in one ref — zero allocs in hot path ────────────
  const gs = useRef({
    // Player
    playerX: CANVAS_W / 2,    // current smooth X
    targetX: CANVAS_W / 2,    // pointer target X
    // Monster
    monsterX: CANVAS_W / 2,    // continuous X
    monsterVX: MONSTER_SPEED,   // px/s, reverses at walls
    monsterFlash: 0,
    // Arrows
    arrows: [] as ArrowEntity[],
    nextArrowId: 0,
    // State
    monsterHP: PA_MAX_HP,
    isHeld: false,           // is pointer currently down
    chargeStart: 0,               // performance.now() when hold began
    lastAutoFire: 0,               // ts of last auto-fire
    startTime: 0,
    stunned: false,
    expired: false,
  });

  // ── 60fps RAF game loop ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Kill zombie loop (Strict-Mode fires useEffect twice)
    isRunning.current = false;
    cancelAnimationFrame(rafRef.current);

    // HiDPI init
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Reset game state for this mount
    const g = gs.current;
    g.playerX = CANVAS_W / 2; g.targetX = CANVAS_W / 2;
    g.monsterX = CANVAS_W / 2; g.monsterVX = MONSTER_SPEED;
    g.monsterFlash = 0; g.arrows = []; g.nextArrowId = 0;
    g.monsterHP = PA_MAX_HP; g.isHeld = false;
    g.chargeStart = 0; g.lastAutoFire = 0;
    g.startTime = 0; g.stunned = false; g.expired = false;

    // Reset DOM displays
    if (timerTextRef.current) timerTextRef.current.textContent = PA_TIMER_SECS.toFixed(1) + 's';
    if (timerBarRef.current) timerBarRef.current.style.width = '100%';
    if (hpTextRef.current) hpTextRef.current.textContent = `${PA_MAX_HP} / ${PA_MAX_HP}`;
    if (hpBarRef.current) hpBarRef.current.style.width = '100%';

    isRunning.current = true;
    let lastT = -1;

    function tick(ts: number) {
      if (!isRunning.current) return;

      // First-frame bootstrap — ensures all timestamps share the same RAF origin
      if (lastT < 0) {
        lastT = ts;
        g.startTime = ts;
        g.lastAutoFire = ts;
      }
      const dt = Math.min(ts - lastT, 50);   // ms; capped for tab-switch safety
      const dtS = dt / 1000;                  // seconds
      lastT = ts;

      try {

        // ── Timer ──────────────────────────────────────────────────────────
        const remaining = Math.max(0, PA_TIMER_SECS - (ts - g.startTime) / 1000);
        if (timerTextRef.current) {
          timerTextRef.current.textContent = remaining.toFixed(1) + 's';
          const col = remaining > 15 ? '#00d4ff' : remaining > 6 ? '#ffd700' : '#ff4444';
          timerTextRef.current.style.color = col;
          timerTextRef.current.style.animation = remaining < 5.5 ? 'timer-danger .45s ease infinite' : '';
        }
        if (timerBarRef.current) {
          const pct = (remaining / PA_TIMER_SECS) * 100;
          const col = remaining > 15 ? '#00d4ff' : remaining > 6 ? '#ffd700' : '#ff4444';
          timerBarRef.current.style.width = pct + '%';
          timerBarRef.current.style.background = `linear-gradient(90deg,${col}66,${col})`;
        }
        if (remaining <= 0 && !g.expired) {
          g.expired = true; isRunning.current = false;
          setPhase('expired'); onExpireRef.current(); return;
        }

        // ── Player smooth lerp toward pointer ──────────────────────────────
        g.playerX += (g.targetX - g.playerX) * PLAYER_LERP_K;
        g.playerX = Math.max(14, Math.min(CANVAS_W - 14, g.playerX));

        // ── Monster sinusoidal glide (bounces off walls) ────────────────────
        g.monsterX += g.monsterVX * dtS;
        if (g.monsterX < 14) { g.monsterX = 14; g.monsterVX = Math.abs(g.monsterVX) * (0.9 + Math.random() * 0.2); }
        if (g.monsterX > CANVAS_W - 14) { g.monsterX = CANVAS_W - 14; g.monsterVX = -Math.abs(g.monsterVX) * (0.9 + Math.random() * 0.2); }

        // ── Hit-flash decay ─────────────────────────────────────────────────
        g.monsterFlash = Math.max(0, g.monsterFlash - dt / 180);

        // ── Auto-fire: shoot while pointer held ─────────────────────────────
        if (g.isHeld && ts - g.lastAutoFire > AUTO_FIRE_MS) {
          g.lastAutoFire = ts;
          g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 1, isSuper: false });
        }

        // ── Arrow movement + collision ───────────────────────────────────────
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
              if (hpTextRef.current) hpTextRef.current.textContent = `${newHP} / ${PA_MAX_HP}`;
              if (hpBarRef.current) hpBarRef.current.style.width = `${(newHP / PA_MAX_HP) * 100}%`;
              if (newHP <= 0 && !g.stunned) {
                g.stunned = true; isRunning.current = false;
                setPhase('stunned'); onStunRef.current(); return;
              }
              // Monster evasive nudge on hit
              g.monsterVX *= -1.25;
            }
          }
        }
        for (let i = rem.length - 1; i >= 0; i--) g.arrows.splice(rem[i], 1);

        // ══════════════════════════ DRAW ════════════════════════════════════
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.shadowBlur = 0;

        // Background — distinct dark blue confirms canvas is alive
        ctx.fillStyle = '#080d18';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Subtle scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let sy = 0; sy < CANVAS_H; sy += 4) ctx.fillRect(0, sy, CANVAS_W, 2);

        // Monster zone tint (top ~14% of canvas)
        ctx.fillStyle = 'rgba(255,40,40,0.06)';
        ctx.fillRect(0, 0, CANVAS_W, ENTITY_ROW_Y * 2);

        // Player zone tint (bottom ~14%)
        ctx.fillStyle = 'rgba(0,212,255,0.04)';
        ctx.fillRect(0, CANVAS_H - ENTITY_ROW_Y * 2, CANVAS_W, ENTITY_ROW_Y * 2);

        // Charge glow column under player
        if (g.isHeld) {
          const held = ts - g.chargeStart;
          const pct = Math.min(1, held / CHARGE_SUPER_MS);
          const pulse = Math.sin(ts / 80) * 0.5 + 0.5;
          const isReady = pct >= 1;
          ctx.shadowBlur = 0;
          ctx.fillStyle = isReady
            ? `rgba(255,215,0,${0.07 + 0.13 * pulse})`
            : `rgba(168,85,247,${0.04 + 0.10 * pct})`;
          // Soft vertical beam centered on playerX
          const bw = 28 + 16 * pct;
          ctx.fillRect(g.playerX - bw / 2, 0, bw, CANVAS_H);

          // Charge arc around player ship
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

        // Arrows
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

        // Monster
        const fl = g.monsterFlash;
        const me = g.monsterHP <= 0 ? '😵' : g.monsterHP <= 1 ? '😰' : g.monsterHP <= 3 ? '😤' : isBoss ? '👹' : '💀';
        if (fl > 0) { ctx.shadowBlur = 22 * fl; ctx.shadowColor = `rgba(255,220,0,${fl})`; }
        ctx.font = `${Math.round(18 + 7 * fl)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(me, g.monsterX, ENTITY_ROW_Y);
        ctx.shadowBlur = 0;

        // Player glow halo
        const glowPct = g.isHeld ? Math.min(1, (ts - g.chargeStart) / CHARGE_SUPER_MS) : 0;
        if (glowPct < 0.15) {
          // Just draw ship
          ctx.font = '17px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('👾', g.playerX, CANVAS_H - ENTITY_ROW_Y);
        } else {
          // Charged: add glow shadow behind ship
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pointer helpers — update targetX & charge state ───────────────────────
  function xFromPointer(e: React.PointerEvent<HTMLCanvasElement>): number {
    const c = canvasRef.current;
    if (!c) return gs.current.targetX;
    const r = c.getBoundingClientRect();
    // Map CSS pixel → canvas logical pixel
    return ((e.clientX - r.left) / r.width) * CANVAS_W;
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);  // keep tracking even if cursor slides off
    e.stopPropagation(); e.preventDefault();
    const g = gs.current;
    if (g.stunned || g.expired) return;
    g.targetX = xFromPointer(e);
    g.isHeld = true;
    g.chargeStart = performance.now();
    // Fire an immediate normal arrow on tap-down
    g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 1, isSuper: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const g = gs.current;
    if (!g.isHeld || g.stunned || g.expired) return;
    g.targetX = xFromPointer(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation(); e.preventDefault();
    const g = gs.current;
    if (!g.isHeld || g.stunned || g.expired) return;
    const held = performance.now() - g.chargeStart;
    g.isHeld = false;
    if (held >= CHARGE_SUPER_MS) {
      // Release = fire the charged super arrow in addition to the auto-fire stream
      g.arrows.push({ id: g.nextArrowId++, x: g.playerX, y: CANVAS_H - ENTITY_ROW_Y, dmg: 5, isSuper: true });
    }
  }, []);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    const g = gs.current;
    if (!g.isHeld || g.stunned || g.expired) return;
    g.isHeld = false;   // cancel charge; auto-fire stops
  }, []);

  // ── JSX — purely structural, live values mutated by RAF via DOM refs ───────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>

      {/* Timer */}
      {phase === 'playing' && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: '#475569', fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>⏱ QTE</span>
            <span ref={timerTextRef} style={{ fontSize: 13, fontWeight: 900, fontFamily: "'Courier New',monospace", color: '#00d4ff' }}>
              {PA_TIMER_SECS.toFixed(1)}s
            </span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 100, overflow: 'hidden' }}>
            <div ref={timerBarRef} style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg,#00d4ff66,#00d4ff)', borderRadius: 100 }} />
          </div>
        </div>
      )}

      {/* HP bar */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 10, color: '#475569', fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
            {phase === 'stunned' ? '😵 ATORDOADO' : 'HP Monstro'}
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
        style={{ display: 'block', borderRadius: 6, border: '1px solid rgba(255,255,255,.09)', touchAction: 'none', cursor: phase !== 'playing' ? 'default' : 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />

      {/* End-state panels */}
      {phase === 'expired' && (
        <div style={{ fontSize: 11, color: '#334155', fontFamily: "'Courier New',monospace", textAlign: 'center', padding: '6px 12px', border: '1px solid #1e293b', borderRadius: 6 }}>
          ⌛ QTE expirado — use a Matemática!
        </div>
      )}
      {phase === 'stunned' && (
        <div style={{ textAlign: 'center', padding: '10px 14px', background: 'rgba(255,215,0,.07)', border: '1px solid rgba(255,215,0,.22)', borderRadius: 10, animation: 'lifeline-reveal .4s ease both' }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🏹⚡</div>
          <div style={{ fontSize: 12, color: '#ffd700', fontWeight: 700, fontFamily: "'Courier New',monospace" }}>Monstro Atorduado!</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'Courier New',monospace", marginTop: 2 }}>2 respostas erradas eliminadas</div>
        </div>
      )}

      {/* Hint */}
      {phase === 'playing' && (
        <p style={{ margin: 0, fontSize: 10, color: '#1e3a4a', fontFamily: "'Courier New',monospace", textAlign: 'center', lineHeight: 1.5 }}>
          Segurar = auto-disparo ▲ · {(CHARGE_SUPER_MS / 1000).toFixed(1)}s = ⚡ Super (5 dano)
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
}: CombatArenaProps) {
  const correctAnswer = choices.find(c => c.isCorrect)!.value;

  // ── QTE outcome state ────────────────────────────────────────────────────────
  const [earnedLifeline, setEarnedLifeline] = useState(false);
  const [eliminatedIdxs, setEliminatedIdxs] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastFading, setToastFading] = useState(false);

  // ── Second Wind (math) state ─────────────────────────────────────────────────
  const [mistakeCount, setMistakeCount] = useState(0);
  const [currentPowerSnapshot, setCurrentPowerSnapshot] = useState(playerPower);
  const [isTakingDamage, setIsTakingDamage] = useState(false);
  const [firstPick, setFirstPick] = useState<number | null>(null);
  const [secondPick, setSecondPick] = useState<number | null>(null);
  const [resolved, setResolved] = useState(false);
  const resolvedRef = useRef(false);

  const finalPick = secondPick !== null ? secondPick : firstPick;
  const wasCorrect = finalPick !== null && finalPick === correctAnswer;
  const onResultRef = useRef(onResult); onResultRef.current = onResult;

  // ── Impossible mode: auto-fire loss in 2 s ──────────────────────────────────
  useEffect(() => {
    if (!isImpossibleMode) return;
    const t = setTimeout(() => onResultRef.current(false, currentPowerSnapshot), 2000);
    return () => clearTimeout(t);
  }, [isImpossibleMode]); // eslint-disable-line

  // ── After math resolves → close after 1.5 s ─────────────────────────────────
  useEffect(() => {
    if (!resolved || isImpossibleMode) return;
    const t = setTimeout(() => onResultRef.current(wasCorrect, currentPowerSnapshot), 1500);
    return () => clearTimeout(t);
  }, [resolved]); // eslint-disable-line

  // ── QTE stun callback ────────────────────────────────────────────────────────
  const handleStun = useCallback(() => {
    if (resolvedRef.current) return;
    const wrongIdxs = choices
      .map((c, i) => ({ c, i })).filter(({ c }) => !c.isCorrect).map(({ i }) => i);
    for (let i = wrongIdxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrongIdxs[i], wrongIdxs[j]] = [wrongIdxs[j], wrongIdxs[i]];
    }
    setEliminatedIdxs(wrongIdxs.slice(0, 2));
    setEarnedLifeline(true);
    setShowToast(true); setToastFading(false);
    setTimeout(() => setToastFading(true), 2100);
    setTimeout(() => setShowToast(false), 2700);
  }, [choices]);

  // ── Math pick handler (callable at ANY time) ─────────────────────────────────
  function handlePick(opt: ChoiceOption) {
    if (resolved || isTakingDamage) return;
    const isSecondAttempt = mistakeCount === 1;

    if (!isSecondAttempt) {
      setFirstPick(opt.value);
      if (opt.isCorrect) { resolvedRef.current = true; setResolved(true); return; }
      if (isImpossibleMode) { resolvedRef.current = true; setResolved(true); return; }

      // Second Wind — halve power; QTE canvas loop CONTINUES uninterrupted
      const halved = Math.floor(currentPowerSnapshot / 2);
      if (halved <= 0) {
        setCurrentPowerSnapshot(0); setMistakeCount(1);
        resolvedRef.current = true; setResolved(true); return;
      }
      setCurrentPowerSnapshot(halved);
      setMistakeCount(1);
      setIsTakingDamage(true);
      setTimeout(() => setIsTakingDamage(false), 800);
      return;
    }

    setSecondPick(opt.value);
    resolvedRef.current = true;
    setResolved(true);
  }

  // ── Button state ─────────────────────────────────────────────────────────────
  function getBtnState(opt: ChoiceOption, idx: number): BtnState {
    if (earnedLifeline && eliminatedIdxs.includes(idx) && !resolved) return 'eliminated';
    if (!resolved && mistakeCount === 0) return 'idle';
    if (!resolved && mistakeCount === 1) {
      if (opt.value === firstPick && !opt.isCorrect) return 'wrong';
      if (earnedLifeline && eliminatedIdxs.includes(idx)) return 'eliminated';
      return 'idle';
    }
    if (opt.isCorrect) return finalPick === opt.value ? 'correct' : 'reveal';
    if (opt.value === firstPick || opt.value === secondPick) return 'wrong';
    return 'dim';
  }

  const gainIfCorrect = isDesperationMode ? Math.round(monsterLevel * .5) : monsterLevel;
  const lossIfWrong = Math.round(monsterLevel * .5);

  type Delta = number | 'death' | null;
  const resultDelta: Delta = !resolved ? null
    : wasCorrect ? (isDesperationMode ? Math.round(monsterLevel * .5) : monsterLevel)
      : (isDesperationMode ? 'death' : -lossIfWrong);

  const playerExtraStyle: CSSProperties = isTakingDamage
    ? { animation: 'player-damage .65s cubic-bezier(.36,.07,.19,.97)' } : {};

  const accentColor = isDesperationMode ? '#ff2222' : isBoss ? '#8800cc' : '#1e3a5a';

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{ARENA_STYLES}</style>

      {/* Backdrop */}
      {/* backdrop-filter:blur removed — it composites the entire game canvas every frame */}
      <div style={{ position: 'fixed', inset: 0, background: isImpossibleMode ? 'rgba(38,2,2,.97)' : 'rgba(4,4,16,.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, willChange: 'transform' }}>

        {/* ═══ IMPOSSIBLE MODE ═══ */}
        {isImpossibleMode ? (
          <div style={{ width: '100%', maxWidth: 520, background: '#0a0000', border: '2px solid #880000', borderRadius: 14, overflow: 'hidden', animation: 'arena-enter .18s cubic-bezier(.34,1.56,.64,1) forwards, impossible-border .55s ease .18s infinite', boxShadow: '0 0 80px rgba(200,0,0,.6)', textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg,#200000,#100000)', borderBottom: '1px solid #55000088', padding: '14px 20px' }}>
              <div style={{ color: '#ff4444', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Encontro Impossível</div>
              <div style={{ color: '#ff0000', fontSize: 22, fontWeight: 900, fontFamily: "'Courier New',monospace" }}>💀 ESMAGAMENTO INSTANTÂNEO</div>
            </div>
            <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 52, animation: 'impossible-crush .7s ease infinite' }}>💥</div>
              <div style={{ color: '#ff2222', fontSize: 15, fontWeight: 700, lineHeight: 1.55, animation: 'impossible-text 1.1s ease infinite' }}>⚠️ DIFERENÇA DE PODER ABSURDA!</div>
              <div style={{ color: '#cc4444', fontSize: 13, lineHeight: 1.6, maxWidth: 360 }}>
                O monstro (Lv.{monsterLevel}) te esmagou antes de calcular!<br />
                <span style={{ color: '#884444', fontSize: 11 }}>Mín.: {Math.ceil(monsterLevel / 2)} · Seu poder: {playerPower}</span>
              </div>
            </div>
          </div>

        ) : (

          /* ═══ NORMAL / BOSS / DESPERATION PANEL ═══ */
          <div style={{
            width: '94vw', maxWidth: 900,
            background: isDesperationMode ? '#180404' : '#070c18',
            border: `2px solid ${accentColor}`, borderRadius: 14,
            overflow: 'hidden', position: 'relative',
            animation: isDesperationMode
              ? 'arena-enter .22s cubic-bezier(.34,1.56,.64,1) forwards, desperation-border .7s ease .22s infinite'
              : 'arena-enter .22s cubic-bezier(.34,1.56,.64,1) forwards',
            boxShadow: isDesperationMode
              ? '0 0 60px rgba(255,0,0,.35), 0 0 30px rgba(255,0,0,.18)'
              : '0 0 60px rgba(0,0,0,.9), 0 0 30px rgba(0,212,255,.05)',
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
                🏹 MONSTRO ATORDUADO! 50/50 ATIVADO!
              </div>
            )}

            {/* Header */}
            <div style={{
              background: isDesperationMode ? 'linear-gradient(135deg,#2a0000,#180000)' : isBoss ? 'linear-gradient(135deg,#1a0028,#0f0020)' : 'linear-gradient(135deg,#0d1b2a,#0a1628)',
              borderBottom: `1px solid ${isDesperationMode ? '#ff222255' : isBoss ? '#8800cc44' : '#1e3a5a'}`,
              padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: isDesperationMode ? '#ff4444aa' : '#475569', fontFamily: "'Courier New',monospace", letterSpacing: 2, textTransform: 'uppercase' }}>
                {isDesperationMode ? 'Modo Desespero' : isBoss ? 'Confronto Final' : '⚔️ Combate Híbrido'}
              </span>
              <span style={{ fontSize: 16, color: isDesperationMode ? '#ff4444' : isBoss ? '#cc44ff' : '#00d4ff', fontFamily: "'Courier New',monospace", fontWeight: 700 }}>
                {isDesperationMode ? '💀 ATAQUE DESESPERADO' : isBoss ? '👹 BOSS FINAL' : 'Força · ou · Lógica'}
              </span>
              <span style={{ fontSize: 13, color: isDesperationMode ? '#ff4444aa' : '#475569', fontFamily: "'Courier New',monospace", letterSpacing: 2, textTransform: 'uppercase' }}>
                Nível {monsterLevel}
              </span>
            </div>

            {/* Desperation banner */}
            {isDesperationMode && (
              <div style={{ padding: '10px 20px', textAlign: 'center', animation: 'desperation-banner .7s ease infinite', borderBottom: '1px solid #ff222244', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 13, color: '#ff6666', fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', animation: 'desperation-text .7s ease infinite' }}>
                  Você está sobrepoderado — Erro = DERROTA IMEDIATA
                </span>
                <span style={{ fontSize: 18 }}>⚠️</span>
              </div>
            )}

            {/* Second Wind banner */}
            {mistakeCount === 1 && !resolved && (
              <div style={{ padding: '8px 20px', textAlign: 'center', animation: 'critical-banner-pulse .65s ease infinite', borderBottom: '1px solid #ff444433', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>💥</span>
                <span style={{ fontSize: 12, color: '#ff8888', fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: 1 }}>
                  GOLPE CRÍTICO! Poder reduzido à metade. Última chance — grid ainda ativo!
                </span>
                <span style={{ fontSize: 16 }}>💥</span>
              </div>
            )}

            {/* Lifeline active banner */}
            {earnedLifeline && !resolved && (
              <div style={{ padding: '6px 20px', textAlign: 'center', background: 'rgba(255,215,0,.07)', borderBottom: '1px solid rgba(255,215,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, animation: 'lifeline-reveal .45s ease both' }}>
                <span style={{ fontSize: 14 }}>🏹</span>
                <span style={{ fontSize: 12, color: '#ffd700', fontFamily: "'Courier New',monospace", fontWeight: 700, letterSpacing: 1 }}>
                  50/50 ATIVA — 2 respostas erradas eliminadas!
                </span>
                <span style={{ fontSize: 14 }}>⚡</span>
              </div>
            )}

            {/* ════ BODY: [Canvas Grid] | [Math] ════ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr' }}>

              {/* LEFT — PocketArena */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                padding: '18px 14px 20px',
                borderRight: `1px solid ${accentColor}44`,
                background: 'rgba(0,0,0,.18)', minWidth: 220,
              }}>
                <span style={{ fontSize: 10, color: isDesperationMode ? '#ff4444' : isBoss ? '#cc44ff' : '#00d4ff', fontFamily: "'Courier New',monospace", letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
                  🏹 Força Bruta
                </span>
                <PocketArena
                  isBoss={isBoss}
                  isDesperationMode={isDesperationMode}
                  onStun={handleStun}
                  onExpire={() => {/* timer expiry handled inside PocketArena */ }}
                />
              </div>

              {/* RIGHT — Math */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 18px 20px' }}>
                <span style={{ fontSize: 10, color: isDesperationMode ? '#ff4444' : isBoss ? '#cc44ff' : '#00d4ff', fontFamily: "'Courier New',monospace", letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>
                  🧠 Lógica
                </span>

                {/* Stat cards */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <CombatantCard emoji="👾" name="Jogador" statLabel="Poder"
                    statValue={currentPowerSnapshot}
                    color={mistakeCount === 1 ? '#ff8844' : '#00ff00'}
                    extraStyle={playerExtraStyle} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Courier New',monospace", color: isDesperationMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff6b35', animation: isDesperationMode ? 'desperation-text .7s ease infinite' : undefined }}>VS</span>
                    {resolved && (
                      <div style={{ fontSize: 16, color: wasCorrect ? '#00ff00' : '#ff4444', fontFamily: "'Courier New',monospace", textAlign: 'center', fontWeight: 700, animation: 'result-pulse .8s ease infinite' }}>
                        {wasCorrect ? '✅' : '❌'}<br />
                        {resultDelta === 'death' ? '💀' : resultDelta !== null && resultDelta > 0 ? `+${resultDelta}` : `${resultDelta}`}<br />
                        <span style={{ fontSize: 11, fontWeight: 400, color: wasCorrect ? '#00cc00' : '#cc3333' }}>{resultDelta === 'death' ? 'DERROTA' : 'poder'}</span>
                      </div>
                    )}
                    {mistakeCount === 1 && !resolved && !isTakingDamage && (
                      <div style={{ fontSize: 10, color: '#ff8844', fontFamily: "'Courier New',monospace", textAlign: 'center', fontWeight: 700 }}>⚡ 2ª CHANCE</div>
                    )}
                  </div>
                  <CombatantCard emoji={isBoss ? '👹' : '💀'} name={isBoss ? 'Boss Final' : 'Inimigo'} statLabel="Nível"
                    statValue={monsterLevel} color={isDesperationMode ? '#ff2222' : isBoss ? '#cc44ff' : '#ff4444'} />
                </div>

                {/* Question */}
                <div style={{ background: 'rgba(0,212,255,.04)', border: '1px solid #1e3a4a', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 14, color: '#64748b', fontFamily: "'Courier New',monospace", textTransform: 'uppercase', letterSpacing: 2 }}>{question.hint}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 40, fontWeight: 900, color: '#f1f5f9', fontFamily: "'Courier New',monospace", letterSpacing: 2, lineHeight: 1, textShadow: '0 0 22px rgba(0,212,255,.45)' }}>{question.expression}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: '#475569', fontFamily: "'Courier New',monospace" }}>Qual é o resultado?</p>
                  {!resolved && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, fontFamily: "'Courier New',monospace", flexWrap: 'wrap' }}>
                      {isDesperationMode ? (<>
                        <span style={{ color: '#ffd700', fontWeight: 700 }}>✅ +{gainIfCorrect}</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: '#ff2222', fontWeight: 700, animation: 'desperation-text .7s ease infinite' }}>❌ Derrota Imediata</span>
                      </>) : mistakeCount === 1 ? (<>
                        <span style={{ color: '#00cc00' }}>✅ Sobrevive!</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: '#ff2222', fontWeight: 700 }}>❌ Derrota Definitiva</span>
                      </>) : (<>
                        <span style={{ color: '#00cc00' }}>✅ +{gainIfCorrect}</span>
                        <span style={{ color: '#334155' }}>|</span>
                        <span style={{ color: isBoss ? '#ff2222' : '#cc4444' }}>❌ −50% poder · 2º: Derrota{isBoss ? ' imediata' : ''}</span>
                      </>)}
                    </div>
                  )}
                </div>

                {/* Answer buttons 2×2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {choices.map((opt, i) => (
                    <ChoiceBtn key={i} value={opt.value} label={question.answerLabels?.[opt.value]}
                      state={getBtnState(opt, i)} onClick={() => handlePick(opt)} />
                  ))}
                </div>

                {/* Post-result explanation */}
                {resolved && (
                  <div style={{ background: wasCorrect ? 'rgba(0,40,0,.4)' : 'rgba(40,0,0,.4)', border: `1px solid ${wasCorrect ? '#00ff00' : '#ff4444'}44`, borderRadius: 10, padding: '12px 15px', fontFamily: "'Courier New',monospace", lineHeight: 1.75 }}>
                    <div style={{ color: wasCorrect ? '#00ff00' : '#ff4444', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                      {(() => {
                        const al = question.answerLabels?.[correctAnswer] ?? correctAnswer;
                        const cs = mistakeCount === 1 ? ' (golpe crítico sobrevivido!)' : '';
                        const ls = earnedLifeline ? ' 🏹' : '';
                        return isDesperationMode
                          ? (wasCorrect ? `🔥 Milagre! +${gainIfCorrect} poder. Sobreviveu!` : `💀 Derrota! Resposta: ${al}`)
                          : (wasCorrect ? `✅ Correto! +${gainIfCorrect} poder.${cs}${ls}` : `❌ Errado! −${lossIfWrong} poder. Resposta: ${al}`);
                      })()}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>{question.explanation}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Responsive stack for narrow viewports */}
            <style>{`
            @media (max-width:590px) {
              .ca-body { grid-template-columns:1fr !important; }
            }
          `}</style>
          </div>
        )}
      </div>
    </>
  );
}

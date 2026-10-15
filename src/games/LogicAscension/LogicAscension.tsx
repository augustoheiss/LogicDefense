import { useState, useEffect, useCallback, useRef, CSSProperties, memo } from 'react';
import { Tile, TileType, Direction, PlayerPos, PathId, FloatingText } from './types';
import {
  generateRandomMap,
  GeneratedMap,
  PLAYER_START,
  BOSS_SPAWN,
  PORTAL_SPAWN,
  MAJOR_CHOICE_POS,
  GRID_ROWS,
  GRID_COLS,
  NUM_ROOMS,
} from './mapData';
import {
  runOracle,
  generateDynamicQuestion,
  Question,
  OracleResult,
  SolutionMethod,
  calculateTheoreticalMax,
} from './mathEngine';
import { CombatArena, ChoiceOption } from './CombatArena';
import { MainMenu } from './MainMenu';
import { formatPower } from './utils';
import { saveHighScore } from './leaderboard';
import { soundEngine } from './soundEngine';

// ── Utilities ──────────────────────────────────────────────────────────────────
function setTile(grid: Tile[][], row: number, col: number, tile: Tile): Tile[][] {
  return grid.map((r, ri) =>
    ri === row ? r.map((c, ci) => (ci === col ? tile : c)) : r
  );
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIR_DELTA: Record<Direction, [number, number]> = {
  UP:    [-1, 0],
  DOWN:  [ 1, 0],
  LEFT:  [ 0,-1],
  RIGHT: [ 0, 1],
};

// ── Game phases ────────────────────────────────────────────────────────────────
type GamePhase = 'playing' | 'victory' | 'gameover';

// ── Combat state ───────────────────────────────────────────────────────────────
interface CombatState {
  targetPos:          { row: number; col: number };
  monsterLevel:       number;
  question:           Question;
  choices:            ChoiceOption[];
  powerSnapshot:      number;
  isBoss:             boolean;
  isDesperationMode:  boolean;
  isImpossibleMode:   boolean;
}

// ── Knowledge Box state ────────────────────────────────────────────────────────
interface KnowledgeEntry {
  expression?:  string;
  lensTitle?:   string;
  hint?:        string;
  text:         string;
  methods?:     SolutionMethod[];
  realLifeTip?: string;
  isCorrect:    boolean;
}

// ── Fullscreen helper ──────────────────────────────────────────────────────────
function requestFullScreen(el: HTMLElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = el as any;
  if (e.requestFullscreen)            { e.requestFullscreen().catch(() => {}); }
  else if (e.webkitRequestFullscreen) { e.webkitRequestFullscreen(); }
  else if (e.msRequestFullscreen)     { e.msRequestFullscreen();     }
}

const GAME_STYLES = `
@keyframes buff-punish {
  0%   { transform: scale(1.35); color: #ffd700; }
  45%  { transform: scale(0.62); color: #ff2222; }
  100% { transform: scale(1);    color: #ff8888; }
}
@keyframes buff-reward {
  0%   { transform: scale(0.65); color: #888888; }
  50%  { transform: scale(1.5);  color: #00ff88; }
  100% { transform: scale(1);    color: #ffd700; }
}
@keyframes float-up-pop {
  0%   { opacity: 0; transform: translate(-50%, 10px) scale(0.75); }
  20%  { opacity: 1; transform: translate(-50%, -6px) scale(1.08); }
  80%  { opacity: 1; transform: translate(-50%, -28px) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -44px) scale(0.92); }
}

/* 1. Main Wrapper */
.la-main-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  width: 100%;
  justify-content: center;
  align-items: flex-start;
  background: #07070f;
  box-sizing: border-box;
  padding: 1.5rem;
  position: relative;
}

/* 2. Game Area Wrapper */
.la-game-wrapper-inner {
  flex: 1 1 420px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* 3. Game Grid */
.la-viewport {
  width: 100%;
  max-width: 82vh;
  max-height: 70vh;
  aspect-ratio: 1 / 1;
  position: relative;
  overflow: hidden;
  border: 2px solid #1e293b;
  border-radius: 8px;
  box-shadow: 0 0 40px rgba(0,0,0,0.8);
}

/* 3a. Camera anchor */
.la-camera-anchor {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  overflow: visible;
}

/* 3b. Grid container */
.la-grid-container {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

/* 4. Sidebar */
.la-sidebar {
  flex: 0 0 340px;
  max-width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Mobile */
@media (max-width: 820px) {
  .la-main-layout {
    padding: 0.85rem;
    gap: 1rem;
  }
  .la-game-wrapper-inner {
    flex: 1 1 100%;
  }
  .la-sidebar {
    flex: 0 0 100%;
    max-height: none;
  }
}

/* Fullscreen */
.la-main-layout:fullscreen,
.la-main-layout:-webkit-full-screen {
  flex-wrap: wrap;
  align-items: flex-start;
  height: 100vh;
  width: 100vw;
  padding: 1.5rem;
  gap: 1.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: #070810;
}

.la-main-layout:fullscreen .la-sidebar,
.la-main-layout:-webkit-full-screen .la-sidebar {
  max-height: none;
  overflow-y: auto;
}

.la-main-layout:fullscreen .la-viewport,
.la-main-layout:-webkit-full-screen .la-viewport {
  max-width: 100%;
  max-height: 82vh;
}
`;

// ── Log item type ──────────────────────────────────────────────────────────────
interface LogItem {
  id:          number;
  text:        string;
  type:        'combat' | 'oracle' | 'info';
  explanation?: string;
  hint?:        string;
  lensTitle?:   string;
  expression?:  string;
  methods?:     SolutionMethod[];
  realLifeTip?: string;
  isCorrect?:   boolean;
}

let _logId = 0;
function mkLog(
  text: string,
  type: LogItem['type'] = 'info',
  extra?: Partial<Omit<LogItem, 'id' | 'text' | 'type'>>,
): LogItem {
  return { id: ++_logId, text, type, ...extra };
}

// ── Visual constants ───────────────────────────────────────────────────────────
const CELL = 80;
const GAP  = 2;

function getCamTransform(row: number, col: number): string {
  const tx = -(col * (CELL + GAP) + CELL / 2);
  const ty = -(row * (CELL + GAP) + CELL / 2);
  return `translate(${tx}px, ${ty}px)`;
}

const JOYSTICK_REPEAT_MS = 180;

function getBackgroundImage(stage: number): string {
  const index = ((stage - 1) % 9) + 1;
  return `/images/background-0${index}.jpg`;
}

const COLOR: Record<TileType | 'PLAYER', { bg: string; border: string; shadow?: string }> = {
  EMPTY:        { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' },
  WALL:         { bg: 'transparent',            border: 'transparent' },
  MONSTER:      { bg: 'rgba(60,0,0,0.72)',      border: '#ff4444', shadow: 'inset 0 0 10px rgba(255,68,68,0.45)' },
  TRICKY_BUFF:  { bg: 'rgba(50,38,0,0.75)',     border: '#ffd700', shadow: 'inset 0 0 10px rgba(255,215,0,0.40)' },
  MAJOR_CHOICE: { bg: 'rgba(0,24,40,0.80)',     border: '#00d4ff', shadow: 'inset 0 0 16px rgba(0,212,255,0.35), 0 0 10px rgba(0,212,255,0.4)' },
  FOG:          { bg: 'rgba(4,4,14,0.93)',      border: 'rgba(18,18,42,0.55)' },
  BOSS:         { bg: 'rgba(26,0,40,0.85)',     border: '#cc44ff', shadow: 'inset 0 0 18px rgba(200,68,255,0.55), 0 0 22px rgba(200,68,255,0.5)' },
  PORTAL:       { bg: 'rgba(13,0,30,0.85)',     border: '#a855f7', shadow: 'inset 0 0 16px rgba(168,85,247,0.5), 0 0 18px rgba(168,85,247,0.6)' },
  PLAYER:       { bg: 'rgba(0,26,0,0.80)',      border: '#00ff00', shadow: 'inset 0 0 16px rgba(0,255,0,0.45), 0 0 14px rgba(0,255,0,0.6)' },
};

function cellStyle(tile: Tile): CSSProperties {
  const key       = tile.type;
  const c         = COLOR[key];
  const activated = tile.type === 'MAJOR_CHOICE' && tile.activated;
  return {
    width:          CELL,
    height:         CELL,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   6,
    border:         `2px solid ${activated ? 'rgba(0,51,51,0.55)' : c.border}`,
    background:     activated ? 'rgba(0,15,14,0.65)' : c.bg,
    boxShadow:      activated ? 'none' : (c.shadow ?? 'none'),
    transition:     'box-shadow 0.25s ease, background 0.25s ease',
    userSelect:     'none',
    overflow:       'hidden',
    flexShrink:     0,
  };
}

// ── Tile content ───────────────────────────────────────────────────────────────
const CellContent = memo(function CellContent({ tile }: { tile: Tile }) {
  const icon: CSSProperties = {
    fontSize: 28, lineHeight: 1,
    filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.95))',
  };
  const lbl: CSSProperties = {
    fontSize: 11, fontFamily: "'Courier New', monospace",
    lineHeight: 1.2, textAlign: 'center', padding: '0 3px',
    textShadow: '0 1px 4px #000, 0 -1px 4px #000, 1px 0 4px #000, -1px 0 4px #000',
  };
  const pill: CSSProperties = {
    background: 'rgba(0,0,0,0.78)',
    borderRadius: 4,
    padding: '1px 5px',
  };

  switch (tile.type) {
    case 'MONSTER':
      return (
        <>
          <span style={icon}>💀</span>
          <span style={{ ...lbl, ...pill, color: '#ff6666', fontWeight: 700, marginTop: 3, fontSize: 13 }}>
            Lv.{tile.level != null ? formatPower(tile.level) : '?'}
          </span>
        </>
      );
    case 'TRICKY_BUFF':
      return (
        <>
          <span style={icon}>⚡</span>
          <span style={{
            ...lbl, ...pill,
            color:      tile.multiplier !== undefined && tile.multiplier >= 1 ? '#ffd700' : '#ff8888',
            fontWeight: 700,
            fontSize:   15,
            marginTop:  2,
            display:    'inline-block',
            animation:  tile.animationType === 'punish'
              ? 'buff-punish 0.9s ease forwards'
              : tile.animationType === 'reward'
                ? 'buff-reward 0.9s ease forwards'
                : undefined,
          }}>
            {tile.multiplierLabel}
          </span>
        </>
      );
    case 'MAJOR_CHOICE':
      return (
        <>
          <span style={{ fontSize: tile.activated ? 18 : 22, lineHeight: 1, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.95))' }}>
            {tile.activated ? '✓' : '🔀'}
          </span>
          {!tile.activated && tile.multiplierLabel && (
            <span style={{ ...lbl, ...pill, color: '#ffd700', fontWeight: 700, fontSize: 14, marginTop: 2 }}>
              {tile.multiplierLabel}
            </span>
          )}
          <span style={{ ...lbl, ...pill, color: tile.activated ? '#4af0d0' : '#00d4ff', marginTop: 2, fontSize: 10 }}>
            {tile.label}
          </span>
        </>
      );
    case 'BOSS':
      return (
        <>
          <span style={{ fontSize: 30, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}>👹</span>
          <span style={{ ...lbl, ...pill, color: '#ff44ff', fontWeight: 700, marginTop: 2 }}>BOSS</span>
          <span style={{ ...lbl, ...pill, color: '#cc44ff', marginTop: 1, fontSize: 13 }}>Lv.{tile.level != null ? formatPower(tile.level) : '?'}</span>
        </>
      );
    case 'PORTAL':
      return (
        <>
          <span style={{ fontSize: 30, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(168,85,247,0.7))' }}>🌀</span>
          <span style={{ ...lbl, ...pill, color: '#a855f7', fontWeight: 700, marginTop: 2 }}>PORTAL</span>
        </>
      );
    case 'FOG':
      return <span style={{ fontSize: 24, color: '#2a2a5a', letterSpacing: -2 }}>░░</span>;
    default:
      return null;
  }
});

// ── Sub-components ─────────────────────────────────────────────────────────────
function LogItemRow({
  item, isFirst, onCombatClick,
}: {
  item: LogItem;
  isFirst: boolean;
  onCombatClick?: (item: LogItem) => void;
}) {
  const clickable = item.type === 'combat' && (!!item.explanation || !!item.methods) && !!onCombatClick;
  const accent    = item.type === 'combat'
    ? (item.isCorrect ? '#00cc55' : '#ff4444')
    : item.type === 'oracle' ? '#00d4ff' : '#1e293b';
  const textColor = isFirst
    ? '#e2e8f0'
    : item.type === 'combat'
      ? (item.isCorrect ? '#86efac' : '#fca5a5')
      : item.type === 'oracle' ? '#93c5fd' : '#64748b';
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onCombatClick!(item) : undefined}
      onKeyDown={clickable ? e => { if (e.key === 'Enter') onCombatClick!(item); } : undefined}
      style={{
        padding:    '7px 10px',
        borderLeft: `3px solid ${isFirst ? '#00d4ff' : accent}`,
        color:      textColor,
        fontSize:   12,
        fontFamily: "'Courier New', monospace",
        lineHeight: 1.55,
        cursor:     clickable ? 'pointer' : 'default',
        transition: 'background 0.15s',
        display:    'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ flexGrow: 1 }}>{item.text}</span>
      {clickable && <span style={{ fontSize: 10, color: '#38bdf8', flexShrink: 0 }}>📖 Ver 3 jeitos</span>}
    </div>
  );
}

function StatBadge({ label, value, color = '#00ff00' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}44`,
      borderRadius: 6, padding: '6px 10px', flex: 1,
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 9, color: `${color}99`, fontFamily: "'Courier New', monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 18, color, fontFamily: "'Courier New', monospace", fontWeight: 800 }}>
        {value}
      </span>
    </div>
  );
}

function OraclePanel({ result, pathId, roomIdx }: { result: OracleResult; pathId: PathId; roomIdx: number }) {
  const accent = pathId === 'buff' ? '#00d4ff' : '#ff4444';
  return (
    <div style={{
      background: `${accent}08`,
      border: `1px solid ${accent}33`,
      borderRadius: 8,
      padding: '12px 14px',
      fontSize: 13,
      fontFamily: "'Courier New', monospace",
      lineHeight: 1.75,
    }}>
      <p style={{ margin: '0 0 6px', color: accent, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
        🔮 Oráculo: {pathId === 'buff' ? '⚡ Caminho Buff' : '💀 Sacrifício'} · Sala {roomIdx + 1}/{NUM_ROOMS}
      </p>
      <div style={{ color: '#94a3b8', fontSize: 11 }}>Ordem Estratégica Recomendada:</div>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 14, marginTop: 2 }}>
        {result.optimalOrder.join(' → ')}
      </div>
      <div style={{ color: '#94a3b8', marginTop: 4, fontSize: 12 }}>{result.rationale}</div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {result.monsterLevels.map((lvl, i) => (
          <span key={i} style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid #ff444444',
            borderRadius: 6,
            padding: '2px 8px',
            color: '#ff8888',
            fontSize: 12,
            fontWeight: 700,
          }}>
            M{i + 1}={formatPower(lvl)}
          </span>
        ))}
        <span style={{
          background: 'rgba(255,215,0,0.1)',
          border: '1px solid #ffd70044',
          borderRadius: 6,
          padding: '2px 8px',
          color: '#ffd700',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {result.revealedBuffLabel}
        </span>
      </div>
    </div>
  );
}

function RoomPill({ label, complete, active, roomProgress }: {
  label: string; complete: boolean; active: boolean; roomProgress: number;
}) {
  const color = complete ? '#00ff66' : active ? '#ffd700' : '#475569';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: `${color}12`,
      border: `1px solid ${color}55`,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: "'Courier New', monospace",
    }}>
      <span style={{ color, fontSize: 16 }}>{complete ? '✓' : active ? '⚡' : '○'}</span>
      <span style={{ color: complete ? '#00ff66' : active ? '#ffd700' : '#64748b', fontWeight: 700 }}>
        {label}
      </span>
      {active && !complete && (
        <span style={{ color: '#ffd700', fontSize: 12, marginLeft: 'auto' }}>Sala {roomProgress}/{NUM_ROOMS}</span>
      )}
      {complete && <span style={{ color: '#00ff66', fontSize: 11, marginLeft: 'auto', fontWeight: 700 }}>CONCLUÍDO</span>}
    </div>
  );
}

// ── Accordion ─────────────────────────────────────────────────────────────────
type AccordionId = 'rooms' | 'oracle' | 'log' | 'knowledge' | 'legend';

function AccordionHeader({
  id, label, badge, activePanel, setActivePanel,
}: {
  id:             AccordionId;
  label:          string;
  badge?:         string;
  activePanel:    AccordionId | null;
  setActivePanel: (id: AccordionId | null) => void;
}) {
  const open = activePanel === id;
  return (
    <button
      onClick={() => setActivePanel(open ? null : id)}
      style={{
        width:          '100%',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '9px 11px',
        background:     open ? 'rgba(0,212,255,0.10)' : 'rgba(8,10,20,0.65)',
        border:         `1px solid ${open ? '#00d4ff44' : '#1e293b'}`,
        borderRadius:   open ? '8px 8px 0 0' : 8,
        color:          open ? '#00d4ff' : '#94a3b8',
        fontSize:       10,
        fontWeight:     700,
        fontFamily:     "'Courier New', monospace",
        textTransform:  'uppercase',
        letterSpacing:  1.5,
        cursor:         'pointer',
        transition:     'all 0.18s ease',
        outline:        'none',
      }}
    >
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {badge && <span style={{ fontSize: 10, color: '#ffd700' }}>{badge}</span>}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LogicAscension({ onGoToMenu }: { onGoToMenu?: () => void } = {}) {
  const [mapData, setMapData] = useState<GeneratedMap>(generateRandomMap);
  const [grid,    setGrid]    = useState<Tile[][]>(() => mapData.grid);

  // ── Core game state ──────────────────────────────────────────────────────────
  const [playerPos,       setPlayerPos]       = useState<PlayerPos>(PLAYER_START);
  const [playerPower,     setPlayerPower]     = useState(10);
  const [combat,          setCombat]          = useState<CombatState | null>(null);
  const [completedRooms,  setCompletedRooms]  = useState<Set<PathId>>(new Set());
  const [gamePhase,       setGamePhase]       = useState<GamePhase>('playing');
  const [gameState,       setGameState]       = useState<'MENU' | 'PLAYING'>('MENU');
  const [bossSpawned,     setBossSpawned]     = useState(false);
  const [gameOverReason,  setGameOverReason]  = useState('');
  const [currentStage,    setCurrentStage]    = useState(1);
  const [lastExplanation, setLastExplanation] = useState<KnowledgeEntry | null>(null);
  const [activePanel,     setActivePanel]     = useState<AccordionId | null>('knowledge');
  const [victoryName,     setVictoryName]     = useState('');
  const [gameOverName,    setGameOverName]    = useState('');

  // ── Dopamine, Audio & Streak state ───────────────────────────────────────────
  const [streak,         setStreak]         = useState(0);
  const [bestStreak,     setBestStreak]     = useState(0);
  const [masteredLenses, setMasteredLenses] = useState<string[]>([]);
  const [floatingTexts,  setFloatingTexts]  = useState<FloatingText[]>([]);
  const [isMuted,        setIsMuted]        = useState<boolean>(() => soundEngine.isMuted());

  // ── ProcGen room tracking ────────────────────────────────────────────────────
  const [activeRoomIdx, setActiveRoomIdx] = useState<Partial<Record<PathId, number>>>({});
  const [oracleChain,   setOracleChain]   = useState<Partial<Record<PathId, OracleResult[]>>>({});

  const [log, setLog] = useState<LogItem[]>(() => [
    mkLog('👾 Logic Ascension · Matemática Básica Viva', 'info'),
    mkLog('🗺️  Pegue o Buff ×2 no corredor e escolha seu caminho.', 'info'),
    mkLog('⌨️  WASD/Setas para mover · [1]-[4] para responder rápido.', 'info'),
  ]);

  // ── Stable refs ──────────────────────────────────────────────────────────────
  const gridRef           = useRef(grid);
  const posRef            = useRef(playerPos);
  const powerRef          = useRef(playerPower);
  const combatRef         = useRef(combat);
  const stageRef          = useRef(currentStage);
  const streakRef         = useRef(streak);
  const completedRoomsRef = useRef(completedRooms);
  const gamePhaseRef      = useRef(gamePhase);
  const bossSpawnedRef    = useRef(bossSpawned);
  const mapDataRef        = useRef(mapData);
  const activeRoomIdxRef  = useRef(activeRoomIdx);
  const oracleChainRef    = useRef(oracleChain);
  const timersRef         = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  gridRef.current           = grid;
  posRef.current            = playerPos;
  powerRef.current          = playerPower;
  combatRef.current         = combat;
  stageRef.current          = currentStage;
  streakRef.current         = streak;
  completedRoomsRef.current = completedRooms;
  gamePhaseRef.current      = gamePhase;
  bossSpawnedRef.current    = bossSpawned;
  mapDataRef.current        = mapData;
  activeRoomIdxRef.current  = activeRoomIdx;
  oracleChainRef.current    = oracleChain;

  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDirRef   = useRef<Direction | null>(null);
  const floatIdRef      = useRef(0);

  const registerTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const spawnFloatingText = useCallback((row: number, col: number, text: string, color: string, subtext?: string) => {
    const id = ++floatIdRef.current;
    setFloatingTexts(prev => [...prev, { id, row, col, text, subtext, color }]);
    registerTimeout(() => {
      setFloatingTexts(prev => prev.filter(f => f.id !== id));
    }, 1350);
  }, [registerTimeout]);

  const addEntries = useCallback((entries: LogItem[]) => {
    setLog(prev => [...entries, ...prev].slice(0, 40));
  }, []);

  // ── Reveal room k (rooms 1+): Adaptive Oracle (Anti-Softlock) ────────────────
  const revealNextRoom = useCallback((pathId: PathId, roomIdx: number) => {
    const room  = mapDataRef.current.rooms[pathId][roomIdx];
    const chain = oracleChainRef.current[pathId] ?? [];
    const projPrev = chain[roomIdx - 1]?.projectedPowerAfterRoom ?? powerRef.current;

    // Hybrid Adaptive Oracle: anchors primarily to the player's real power so a single
    // mistake or sub-optimal buff order in Room 1 never creates an impossible softlock in Room 3!
    const inputPower = Math.max(
      4,
      Math.min(
        Math.round(powerRef.current * 1.35),
        Math.round(powerRef.current * 0.72 + projPrev * 0.28),
      ),
    );
    const oracle = runOracle(inputPower, pathId, room.buffMultiplier);

    soundEngine.playRoomReveal();

    setOracleChain(prev => ({
      ...prev,
      [pathId]: [...(prev[pathId] ?? []), oracle],
    }));

    setGrid(g => {
      let ng = g;
      for (const { row, col } of room.accessTiles)
        ng = setTile(ng, row, col, { type: 'EMPTY' });
      for (const ft of room.floorTiles)
        ng = setTile(ng, ft.row, ft.col, { type: 'EMPTY' });
      for (let i = 0; i < 3; i++) {
        const p = room.monsterPositions[i];
        ng = setTile(ng, p.row, p.col, { type: 'MONSTER', level: oracle.monsterLevels[i] });
      }
      const isReward = oracle.revealedBuffMultiplier >= oracle.baseBuffMultiplier;
      ng = setTile(ng, room.buffPosition.row, room.buffPosition.col, {
        type:            'TRICKY_BUFF',
        multiplier:      oracle.revealedBuffMultiplier,
        multiplierLabel: oracle.revealedBuffLabel,
        animationType:   isReward ? 'reward' : 'punish',
      });
      return ng;
    });

    addEntries([
      mkLog(`🔓 Sala ${roomIdx + 1}/${NUM_ROOMS} revelada (${pathId === 'buff' ? '⚡' : '💀'})`, 'info'),
      ...oracle.logLines.map(l => mkLog(l, 'oracle')),
    ]);

    const { row: br, col: bc } = room.buffPosition;
    registerTimeout(() => {
      setGrid(g => {
        const bt = g[br]?.[bc];
        if (bt?.type !== 'TRICKY_BUFF' || !bt.animationType) return g;
        return setTile(g, br, bc, { ...bt, animationType: undefined });
      });
    }, 1400);
  }, [addEntries, registerTimeout]);

  // ── Sequential room-completion detector ──────────────────────────────────────
  useEffect(() => {
    const paths: PathId[] = ['buff', 'sacrifice'];
    for (const pathId of paths) {
      if (completedRoomsRef.current.has(pathId)) continue;
      const activeIdx = activeRoomIdxRef.current[pathId];
      if (activeIdx === undefined) continue;

      const room     = mapDataRef.current.rooms[pathId][activeIdx];
      const entities = [...room.monsterPositions, room.buffPosition];
      if (!entities.every(({ row, col }) => grid[row][col].type === 'EMPTY')) continue;

      addEntries([
        mkLog(`🏆 Sala ${activeIdx + 1}/${NUM_ROOMS} concluída! (${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'})`, 'info'),
      ]);

      if (activeIdx < NUM_ROOMS - 1) {
        setActiveRoomIdx(prev => ({ ...prev, [pathId]: activeIdx + 1 }));
        revealNextRoom(pathId, activeIdx + 1);
      } else {
        setCompletedRooms(prev => new Set([...prev, pathId]));
        addEntries([
          mkLog(`🏆🏆 ${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'} — Todas as ${NUM_ROOMS} Salas Concluídas!`, 'info'),
        ]);
      }
    }
  }, [grid, addEntries, revealNextRoom]);

  // ── Boss spawn detector (Fair Adaptive Climax) ───────────────────────────────
  useEffect(() => {
    if (completedRooms.size < 2 || bossSpawnedRef.current) return;
    const buffProj = oracleChainRef.current.buff?.[NUM_ROOMS - 1]?.projectedPowerAfterRoom;
    const sacProj  = oracleChainRef.current.sacrifice?.[NUM_ROOMS - 1]?.projectedPowerAfterRoom;
    const rawBase  = Math.max(buffProj ?? 0, sacProj ?? 0) || calculateTheoreticalMax();
    // Calibrate Boss to be an exciting challenge (~85%-115% of player's actual power)
    const bossLvl  = Math.max(
      10,
      Math.min(Math.round(powerRef.current * 1.15), Math.round(rawBase * 0.85)),
    );
    setBossSpawned(true);
    soundEngine.playBossSpawn();
    setGrid(g => setTile(g, BOSS_SPAWN.row, BOSS_SPAWN.col, { type: 'BOSS', level: bossLvl }));
    addEntries([
      mkLog(`💥 BOSS FINAL surgiu no corredor central (7,3)! Lv.${formatPower(bossLvl)}`, 'info'),
      mkLog(`⚠️  Derrote o Boss para abrir o PORTAL!`, 'info'),
    ]);
  }, [completedRooms, addEntries]);

  // ── Movement handler ─────────────────────────────────────────────────────────
  const move = useCallback((dir: Direction) => {
    if (combatRef.current) return;
    if (gamePhaseRef.current !== 'playing') return;

    const g     = gridRef.current;
    const { row, col } = posRef.current;
    const power = powerRef.current;

    const [dr, dc] = DIR_DELTA[dir];
    const nr = row + dr;
    const nc = col + dc;

    if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) return;

    const target = g[nr][nc];
    if (target.type === 'WALL' || target.type === 'FOG') return;

    let newGrid  = g;
    let newPower = power;
    const entries: LogItem[] = [];

    // ── PORTAL → victory ─────────────────────────────────────────────────
    if (target.type === 'PORTAL') {
      soundEngine.playVictoryFanfare();
      setPlayerPos({ row: nr, col: nc });
      setGamePhase('victory');
      return;
    }

    // ── TRICKY BUFF ──────────────────────────────────────────────────────
    if (target.type === 'TRICKY_BUFF') {
      const mult = target.multiplier ?? 1;
      newPower   = Math.max(1, Math.round(power * mult));
      soundEngine.playBuff(mult >= 1);
      spawnFloatingText(
        nr, nc,
        `${target.multiplierLabel} (${formatPower(newPower)})`,
        mult >= 1 ? '#ffd700' : '#ff6666',
        mult >= 1 ? '⚡ BÔNUS!' : '⚠️ MALDIÇÃO',
      );
      entries.push(mkLog(`⚡ TrickyBuff! ${formatPower(power)} ${target.multiplierLabel} = ${formatPower(newPower)} poder`, 'info'));
      newGrid = setTile(newGrid, nr, nc, { type: 'EMPTY' });
    } else if (target.type === 'EMPTY') {
      soundEngine.playStep();
    }

    // ── MAJOR CHOICE (first visit only) ──────────────────────────────────
    if (target.type === 'MAJOR_CHOICE' && !target.activated) {
      const pathId = target.pathId!;
      const mcMult = target.multiplier ?? 1;

      newPower = Math.max(2, Math.round(newPower * mcMult));
      soundEngine.playBuff(mcMult >= 1);
      soundEngine.playRoomReveal();
      spawnFloatingText(
        nr, nc,
        `${target.multiplierLabel ?? ''} → ${formatPower(newPower)}`,
        pathId === 'buff' ? '#00d4ff' : '#ff6666',
        pathId === 'buff' ? '⚡ THE BUFF' : '💀 SACRIFÍCIO',
      );
      entries.push(
        mkLog(`${pathId === 'buff' ? '⚡' : '💀'} Escolha! ${formatPower(power)} ${target.multiplierLabel ?? ''} → ${formatPower(newPower)} poder`, 'info')
      );

      const oracle0 = runOracle(newPower, pathId);
      const room0   = mapDataRef.current.rooms[pathId][0];

      for (const { row: ar, col: ac } of room0.accessTiles)
        newGrid = setTile(newGrid, ar, ac, { type: 'EMPTY' });
      for (const ft of room0.floorTiles)
        newGrid = setTile(newGrid, ft.row, ft.col, { type: 'EMPTY' });
      for (let i = 0; i < 3; i++) {
        const p = room0.monsterPositions[i];
        newGrid = setTile(newGrid, p.row, p.col, { type: 'MONSTER', level: oracle0.monsterLevels[i] });
      }
      const wasPunished = oracle0.revealedBuffMultiplier < oracle0.baseBuffMultiplier;
      newGrid = setTile(newGrid, room0.buffPosition.row, room0.buffPosition.col, {
        type:            'TRICKY_BUFF',
        multiplier:      oracle0.revealedBuffMultiplier,
        multiplierLabel: oracle0.revealedBuffLabel,
        animationType:   wasPunished ? 'punish' : 'reward',
      });
      newGrid = setTile(newGrid, nr, nc, { ...target, activated: true });

      setActiveRoomIdx(prev => ({ ...prev, [pathId]: 0 }));
      setOracleChain(prev => ({ ...prev, [pathId]: [oracle0] }));

      entries.push(mkLog(`🔓 Sala 1/${NUM_ROOMS} revelada (${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'})`, 'info'));
      entries.push(...oracle0.logLines.map(l => mkLog(l, 'oracle')));

      const { row: br, col: bc } = room0.buffPosition;
      registerTimeout(() => {
        setGrid(g => {
          const bt = g[br]?.[bc];
          if (bt?.type !== 'TRICKY_BUFF' || !bt.animationType) return g;
          return setTile(g, br, bc, { ...bt, animationType: undefined });
        });
      }, 1400);
    }

    // ── MONSTER or BOSS → open CombatArena ───────────────────────────────
    if (target.type === 'MONSTER' || target.type === 'BOSS') {
      const isBoss = target.type === 'BOSS';
      const lvl    = target.level ?? 5;

      const isImpossibleMode  = newPower < Math.floor(lvl / 2);
      const isDesperationMode = !isImpossibleMode && newPower < lvl;

      const question = generateDynamicQuestion(stageRef.current);
      const choices  = shuffleArray<ChoiceOption>([
        { value: question.correctAnswer, isCorrect: true },
        ...question.wrongAnswers.map(v => ({ value: v, isCorrect: false })),
      ]);

      setGrid(newGrid);
      setPlayerPower(newPower);
      if (entries.length) addEntries(entries);

      setCombat({
        targetPos:         { row: nr, col: nc },
        monsterLevel:      lvl,
        question,
        choices,
        powerSnapshot:     newPower,
        isBoss,
        isDesperationMode,
        isImpossibleMode,
      });
      return;
    }

    // ── Commit normal move ────────────────────────────────────────────────
    setPlayerPos({ row: nr, col: nc });
    setPlayerPower(newPower);
    setGrid(newGrid);
    if (entries.length) addEntries(entries);
  }, [addEntries, registerTimeout, spawnFloatingText]);

  // ── Virtual Joystick Handlers ────────────────────────────────────────────────
  const stopContinuousMove = useCallback(() => {
    if (moveIntervalRef.current !== null) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
    currentDirRef.current = null;
  }, []);

  const startContinuousMove = useCallback((dir: Direction) => {
    stopContinuousMove();
    currentDirRef.current = dir;
    move(dir);
    moveIntervalRef.current = setInterval(() => {
      if (currentDirRef.current) move(currentDirRef.current);
    }, JOYSTICK_REPEAT_MS);
  }, [move, stopContinuousMove]);

  // ── Combat result handler ─────────────────────────────────────────────────────
  const handleCombatResult = useCallback((correct: boolean, survivedPower: number, speedBonusPct: number = 0) => {
    const c = combatRef.current;
    if (!c) return;
    setCombat(null);

    const streakBonusPct = Math.min(50, streakRef.current * 10);
    const totalBonusMult = 1 + (streakBonusPct + speedBonusPct) / 100;

    let nextStreak = 0;
    if (correct) {
      nextStreak = streakRef.current + 1;
      setStreak(nextStreak);
      setBestStreak(prev => Math.max(prev, nextStreak));
      if (c.question.lensTitle) {
        const tipEntry = `${c.question.lensTitle}: ${c.question.expression} = ${c.question.answerLabels?.[c.question.correctAnswer] ?? c.question.correctAnswer}`;
        setMasteredLenses(prev => prev.includes(tipEntry) ? prev : [...prev, tipEntry]);
      }
    } else {
      setStreak(0);
    }

    const resolveKill = (newPower: number, gained: number, logLine: string) => {
      setGrid(g => setTile(g, c.targetPos.row, c.targetPos.col, { type: 'EMPTY' }));
      setPlayerPos(c.targetPos);
      setPlayerPower(newPower);
      spawnFloatingText(
        c.targetPos.row,
        c.targetPos.col,
        gained >= 0 ? `+${formatPower(gained)} PODER!` : `${formatPower(gained)} PODER`,
        gained >= 0 ? '#00ff66' : '#ff4444',
        nextStreak >= 2 ? `🔥 Sequência ×${nextStreak}!` : undefined,
      );
      addEntries([mkLog(logLine, 'combat', {
        explanation: c.question.explanation,
        hint:        c.question.hint,
        lensTitle:   c.question.lensTitle,
        expression:  c.question.expression,
        methods:     c.question.methods,
        realLifeTip: c.question.realLifeTip,
        isCorrect:   correct,
      })]);
    };

    const spawnPortal = (newPower: number, gained: number, logPrefix: string) => {
      setGrid(g => {
        let ng = setTile(g, c.targetPos.row, c.targetPos.col, { type: 'EMPTY' });
        ng     = setTile(ng, PORTAL_SPAWN.row, PORTAL_SPAWN.col, { type: 'PORTAL' });
        return ng;
      });
      setPlayerPos(c.targetPos);
      setPlayerPower(newPower);
      spawnFloatingText(
        c.targetPos.row,
        c.targetPos.col,
        `+${formatPower(gained)} BOSS!`,
        '#a855f7',
        '🌀 PORTAL ABERTO!',
      );
      addEntries([
        mkLog(`${logPrefix} Boss derrotado! +${formatPower(gained)} poder. Total: ${formatPower(newPower)}`, 'combat', {
          explanation: c.question.explanation,
          hint:        c.question.hint,
          lensTitle:   c.question.lensTitle,
          expression:  c.question.expression,
          methods:     c.question.methods,
          realLifeTip: c.question.realLifeTip,
          isCorrect:   correct,
        }),
        mkLog('🌀 PORTAL aberto em (7,1)! Entre nele para vencer!', 'info'),
      ]);
    };

    const tookCriticalHit = survivedPower < c.powerSnapshot;
    if (tookCriticalHit) {
      addEntries([
        mkLog(
          `🛡️ Segundo Fôlego ativado (-50% poder: ${formatPower(c.powerSnapshot)} → ${formatPower(survivedPower)})`,
          'info',
        ),
      ]);
    }

    // Persist rich entry for the Knowledge Box
    const kbText = [
      c.question.hint ? `💡 ${c.question.hint}` : '',
      c.question.explanation ?? '',
    ].filter(Boolean).join('\n\n');

    setLastExplanation({
      expression:  c.question.expression,
      lensTitle:   c.question.lensTitle,
      hint:        c.question.hint,
      text:        kbText,
      methods:     c.question.methods,
      realLifeTip: c.question.realLifeTip,
      isCorrect:   correct,
    });

    const highRisk = c.isDesperationMode || c.isImpossibleMode;

    if (highRisk) {
      if (correct) {
        const absorbed = Math.max(1, Math.round(c.monsterLevel * 0.5 * totalBonusMult));
        const newPower = survivedPower + absorbed;
        if (c.isBoss) spawnPortal(newPower, absorbed, '🔥 Superação Heroica!');
        else resolveKill(newPower, absorbed, `🔥 Superação! +${formatPower(absorbed)} poder. Total: ${formatPower(newPower)}`);
      } else {
        setGamePhase('gameover');
        setGameOverReason(
          `Falhou no Desafio de Superação (${c.question.expression} = ${c.question.answerLabels?.[c.question.correctAnswer] ?? c.question.correctAnswer}).\n${c.question.explanation}`
        );
      }
      return;
    }

    if (c.isBoss) {
      if (correct) {
        const gained = Math.round(c.monsterLevel * totalBonusMult);
        spawnPortal(survivedPower + gained, gained, '🏆');
      } else {
        setGamePhase('gameover');
        setGameOverReason(
          `Falhou contra o Boss Final (${c.question.expression} = ${c.question.answerLabels?.[c.question.correctAnswer] ?? c.question.correctAnswer}).\n${c.question.explanation}`
        );
      }
      return;
    }

    const delta    = correct ? Math.round(c.monsterLevel * totalBonusMult) : -Math.round(c.monsterLevel * 0.5);
    const newPower = survivedPower + delta;
    if (newPower <= 0) {
      setGamePhase('gameover');
      setGameOverReason(
        `Seu poder chegou a zero (${c.question.expression} = ${c.question.answerLabels?.[c.question.correctAnswer] ?? c.question.correctAnswer}).\n${c.question.explanation}`
      );
      return;
    }
    resolveKill(
      newPower,
      delta,
      correct
        ? `✅ ${c.question.expression} → +${formatPower(delta)} poder (🔥×${nextStreak}). Total: ${formatPower(newPower)}`
        : `❌ ${c.question.expression} → ${formatPower(delta)} poder. Total: ${formatPower(newPower)}`
    );
  }, [addEntries, spawnFloatingText]);

  // ── Log-item click: show explanation in Knowledge Box ────────────────────────
  const handleLogClick = useCallback((item: LogItem) => {
    const body = [
      item.hint ? `💡 ${item.hint}` : '',
      item.explanation ?? '',
    ].filter(Boolean).join('\n\n');
    setLastExplanation({
      expression:  item.expression,
      lensTitle:   item.lensTitle,
      hint:        item.hint,
      text:        body,
      methods:     item.methods,
      realLifeTip: item.realLifeTip,
      isCorrect:   item.isCorrect ?? false,
    });
    setActivePanel('knowledge');
  }, []);

  // ── Keyboard listener — zero-latency movement ────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (combatRef.current || gamePhaseRef.current !== 'playing') return;
      let dir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': dir = 'UP';    break;
        case 'ArrowDown':  case 's': case 'S': dir = 'DOWN';  break;
        case 'ArrowLeft':  case 'a': case 'A': dir = 'LEFT';  break;
        case 'ArrowRight': case 'd': case 'D': dir = 'RIGHT'; break;
      }
      if (!dir) return;
      e.preventDefault();

      try {
        if (camLayerRef.current && posRef.current && gridRef.current) {
          const { row, col } = posRef.current;
          const [dr, dc] = DIR_DELTA[dir];
          const nr = row + dr;
          const nc = col + dc;
          const inBounds = nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS;
          if (inBounds) {
            const t = gridRef.current?.[nr]?.[nc];
            const walkable = t && t.type !== 'WALL' && t.type !== 'FOG';
            if (walkable) {
              camLayerRef.current.style.transform = getCamTransform(nr, nc);
            }
          }
        }
      } catch (err) {
        console.error('[optimistic-cam] DOM write failed:', err);
      }

      move(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  useEffect(() => () => stopContinuousMove(), [stopContinuousMove]);

  // ── Reset to Stage 1 (full hard restart) ─────────────────────────────────────
  const resetGame = useCallback(() => {
    clearAllTimers();
    const newMap = generateRandomMap();
    setCurrentStage(1);
    setMapData(newMap);
    setGrid(newMap.grid);
    setPlayerPos(PLAYER_START);
    setPlayerPower(10);
    setCombat(null);
    setCompletedRooms(new Set());
    setActiveRoomIdx({});
    setOracleChain({});
    setGamePhase('playing');
    setBossSpawned(false);
    setGameOverReason('');
    setLastExplanation(null);
    setStreak(0);
    setBestStreak(0);
    setMasteredLenses([]);
    setFloatingTexts([]);
    setLog([
      mkLog('🔄 Reiniciado do zero.', 'info'),
      mkLog('👾 Logic Ascension — Nível 1', 'info'),
      mkLog('🗺️  Pegue o Buff ×2 e escolha um caminho.', 'info'),
    ]);
  }, [clearAllTimers]);

  // ── Return to MainMenu safely (fixes stuck Victory/GameOver modal bug!) ──────
  const returnToMenu = useCallback(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    resetGame();
    setGameState('MENU');
    onGoToMenu?.();
  }, [resetGame, onGoToMenu]);

  // ── Advance to next stage (carry-over power & streak) ────────────────────────
  const advanceLevel = useCallback(() => {
    clearAllTimers();
    const newMap = generateRandomMap();
    setCurrentStage(s => s + 1);
    setMapData(newMap);
    setGrid(newMap.grid);
    setPlayerPos(PLAYER_START);
    setCombat(null);
    setCompletedRooms(new Set());
    setActiveRoomIdx({});
    setOracleChain({});
    setGamePhase('playing');
    setBossSpawned(false);
    setGameOverReason('');
    setFloatingTexts([]);
    soundEngine.playRoomReveal();
    setLog([
      mkLog(`🆕 Nível ${stageRef.current + 1}! Poder herdado: ${formatPower(powerRef.current)}`, 'info'),
      mkLog('🗺️  Novo mapa gerado — consulte o Oráculo nas salas!', 'info'),
    ]);
  }, [clearAllTimers]);

  const handleToggleMute = useCallback(() => {
    const next = soundEngine.toggleMuted();
    setIsMuted(next);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const paths: PathId[] = ['buff', 'sacrifice'];

  const roomStatus = paths.map(pathId => {
    const { row, col } = MAJOR_CHOICE_POS[pathId];
    const mc        = grid[row][col];
    const activeIdx = activeRoomIdx[pathId];
    return {
      pathId,
      active:       mc.type === 'MAJOR_CHOICE' && !!mc.activated,
      complete:     completedRooms.has(pathId),
      roomProgress: activeIdx !== undefined ? activeIdx + 1 : 0,
    };
  });

  const currentOracles: Partial<Record<PathId, { result: OracleResult; roomIdx: number }>> = {};
  for (const pathId of paths) {
    const chain = oracleChain[pathId];
    if (chain?.length) {
      currentOracles[pathId] = { result: chain[chain.length - 1], roomIdx: chain.length - 1 };
    }
  }

  const bossTile  = grid[BOSS_SPAWN.row]?.[BOSS_SPAWN.col];
  const bossLevel = bossTile?.type === 'BOSS' ? bossTile.level : undefined;

  const camLayerRef = useRef<HTMLDivElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);
  const camTransform = getCamTransform(playerPos?.row ?? 0, playerPos?.col ?? 0);

  return (
    <div className="la-main-layout" ref={wrapperRef} style={{
      fontFamily:  "'Courier New', monospace",
      color:       '#e2e8f0',
      touchAction: gameState === 'PLAYING' ? 'none' : 'auto',
      userSelect:  'none',
    }}>
      <style>{GAME_STYLES}</style>

      {gameState === 'MENU' ? (
        <MainMenu
          onPlay={(fullscreen = true) => {
            if (fullscreen && wrapperRef.current) requestFullScreen(wrapperRef.current);
            soundEngine.playRoomReveal();
            setGameState('PLAYING');
          }}
        />
      ) : (
        <>
          {/* ── Grid viewport ── */}
          <div className="la-game-wrapper-inner">
            {/* Header inside the game area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: '#00d4ff', letterSpacing: 2.5, textTransform: 'uppercase' }}>
                  Logic Ascension · Matemática Básica Viva
                </p>
                <h2 style={{ margin: '2px 0 0', fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 800, color: '#f1f5f9' }}>
                  Masmorra Lógica
                  <span style={{ marginLeft: 10, fontSize: 'clamp(14px, 2vw, 18px)', color: '#ffd700', fontWeight: 900 }}>
                    — Nível {currentStage}
                  </span>
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleToggleMute}
                  title={isMuted ? 'Ativar som' : 'Silenciar som'}
                  style={{
                    background: 'rgba(0,212,255,0.08)', border: '1px solid #1e3a5a', color: '#e2e8f0',
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
                  }}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <button
                  onClick={returnToMenu}
                  style={{
                    background: 'rgba(255,68,68,0.12)', border: '1px solid #ff444488', color: '#ff6666',
                    padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                    fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 'bold',
                  }}
                >
                  🚪 Menu / Placar
                </button>
              </div>
            </div>

            <div className="la-viewport">
              <div
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button,canvas')) return;
                  if (combatRef.current || gamePhaseRef.current !== 'playing') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dx = e.clientX - (rect.left + rect.width  / 2);
                  const dy = e.clientY - (rect.top  + rect.height / 2);
                  const dir: Direction = Math.abs(dx) > Math.abs(dy)
                    ? (dx > 0 ? 'RIGHT' : 'LEFT')
                    : (dy > 0 ? 'DOWN'  : 'UP');
                  startContinuousMove(dir);
                }}
                onPointerMove={(e) => {
                  if (moveIntervalRef.current === null) return;
                  if (combatRef.current || gamePhaseRef.current !== 'playing') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const dx = e.clientX - (rect.left + rect.width  / 2);
                  const dy = e.clientY - (rect.top  + rect.height / 2);
                  const newDir: Direction = Math.abs(dx) > Math.abs(dy)
                    ? (dx > 0 ? 'RIGHT' : 'LEFT')
                    : (dy > 0 ? 'DOWN'  : 'UP');
                  currentDirRef.current = newDir;
                }}
                onPointerUp={stopContinuousMove}
                onPointerCancel={stopContinuousMove}
                onPointerLeave={stopContinuousMove}
                style={{
                  position:           'absolute',
                  inset:              0,
                  backgroundImage:    `linear-gradient(rgba(10,10,20,0.85), rgba(10,10,20,0.85)), url('${getBackgroundImage(currentStage)}')`,
                  backgroundSize:     'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="la-camera-anchor">
                  <div
                    ref={camLayerRef}
                    className="la-grid-container"
                    style={{ transform: camTransform }}
                  >
                    {/* Map tiles */}
                    {grid.map((row, ri) =>
                      row.map((tile, ci) => (
                        <div
                          key={`${ri}-${ci}`}
                          style={{
                            ...cellStyle(tile),
                            position: 'absolute',
                            left:     ci * (CELL + GAP),
                            top:      ri * (CELL + GAP),
                          }}
                        >
                          <CellContent tile={tile} />
                        </div>
                      ))
                    )}

                    {/* Player */}
                    <div
                      style={{
                        position:       'absolute',
                        left:           (playerPos?.col ?? 0) * (CELL + GAP),
                        top:            (playerPos?.row ?? 0) * (CELL + GAP),
                        width:          CELL,
                        height:         CELL,
                        zIndex:         2,
                        display:        'flex',
                        flexDirection:  'column',
                        alignItems:     'center',
                        justifyContent: 'center',
                        pointerEvents:  'none',
                        borderRadius:   6,
                        border:         '2px solid #00ff66',
                        background:     'rgba(0,26,0,0.82)',
                        boxShadow:      'inset 0 0 16px rgba(0,255,0,0.45), 0 0 14px rgba(0,255,0,0.6)',
                      }}
                    >
                      <span style={{ fontSize: 30, lineHeight: 1, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}>👾</span>
                      <span style={{
                        fontSize: 11, fontWeight: 900, color: '#00ff66',
                        background: 'rgba(0,0,0,0.8)', borderRadius: 4, padding: '0 4px', marginTop: 2,
                      }}>
                        {formatPower(playerPower)}
                      </span>
                    </div>

                    {/* Floating Dopamine Popups */}
                    {floatingTexts.map(ft => (
                      <div
                        key={ft.id}
                        style={{
                          position:      'absolute',
                          left:          ft.col * (CELL + GAP) + CELL / 2,
                          top:           ft.row * (CELL + GAP),
                          zIndex:        10,
                          pointerEvents: 'none',
                          textAlign:     'center',
                          whiteSpace:    'nowrap',
                          animation:     'float-up-pop 1.35s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                        }}
                      >
                        {ft.subtext && (
                          <div style={{
                            fontSize: 10, fontWeight: 900, color: '#ffd700',
                            textShadow: '0 2px 6px #000', letterSpacing: 1,
                          }}>
                            {ft.subtext}
                          </div>
                        )}
                        <div style={{
                          fontSize: 16, fontWeight: 900, color: ft.color,
                          background: 'rgba(4,8,18,0.9)', border: `1px solid ${ft.color}`,
                          borderRadius: 6, padding: '2px 8px',
                          boxShadow: `0 0 14px ${ft.color}66`,
                        }}>
                          {ft.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vignette overlay */}
                <div style={{
                  position:      'absolute',
                  inset:         0,
                  zIndex:        1,
                  pointerEvents: 'none',
                  background:    'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.60) 100%)',
                  borderRadius:  6,
                }} />
              </div>
            </div>

            {/* Bottom Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, width: '100%' }}>
              <button
                onClick={() => { if (wrapperRef.current) requestFullScreen(wrapperRef.current); }}
                style={{
                  background: 'transparent', border: '1px solid #00d4ff', color: '#00d4ff',
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: "'Courier New', monospace", fontSize: 11,
                }}
              >
                ⛶ Tela Cheia
              </button>
              <span style={{ fontSize: 10, color: '#64748b' }}>
                ⌨️ WASD/Setas · [1]-[4] Responder
              </span>
              <button
                onClick={resetGame}
                style={{
                  background: 'transparent', border: '1px solid #ff4444', color: '#ff4444',
                  padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: "'Courier New', monospace", fontSize: 11,
                }}
              >
                ↺ Novo Mapa
              </button>
            </div>
          </div>

          {/* ── Sidebar (accordion) ── */}
          <div className="la-sidebar">
            {/* Status — always visible */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #1e293b',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>
                  ⚡ Status · Nível {currentStage}
                </span>
                {streak >= 2 && (
                  <span style={{ fontSize: 10, color: '#ffd700', fontWeight: 800 }}>
                    +{Math.min(50, streak * 10)}% Bônus Streak!
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <StatBadge label="Poder" value={formatPower(playerPower)} color="#00ff66" />
                <StatBadge label="Sequência" value={streak > 0 ? `🔥 ×${streak}` : '0'} color="#ffd700" />
                <StatBadge label="Salas" value={`${completedRooms.size}/2`} color="#00d4ff" />
              </div>
              {bossSpawned && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span>{gamePhase === 'victory' ? '🏆' : '👹'}</span>
                  <span style={{ color: gamePhase === 'victory' ? '#a855f7' : '#cc44ff', fontWeight: 800 }}>
                    {gamePhase === 'victory' ? 'Boss Derrotado!' : `Boss Lv.${bossLevel != null ? formatPower(bossLevel) : '—'} no corredor (7,3)!`}
                  </span>
                </div>
              )}
            </div>

            {/* Knowledge Box (3 Ways to Solve) */}
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <AccordionHeader
                id="knowledge"
                label={`3 Maneiras de Resolver${lastExplanation ? (lastExplanation.isCorrect ? ' ✅' : ' 💡') : ''}`}
                badge={lastExplanation?.lensTitle}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
              />
              {activePanel === 'knowledge' && (
                <div style={{
                  background:   lastExplanation
                    ? (lastExplanation.isCorrect ? 'rgba(0,45,18,0.28)' : 'rgba(45,15,5,0.32)')
                    : 'rgba(8,10,22,0.6)',
                  border:       `1px solid ${lastExplanation ? (lastExplanation.isCorrect ? '#00cc5544' : '#ff664444') : '#1e293b'}`,
                  borderTop:    'none',
                  borderRadius: '0 0 8px 8px',
                  padding:      '12px 14px',
                }}>
                  {lastExplanation ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lastExplanation.expression && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9' }}>
                            {lastExplanation.expression}
                          </span>
                          {lastExplanation.lensTitle && (
                            <span style={{ fontSize: 10, color: '#00d4ff', fontWeight: 700 }}>
                              {lastExplanation.lensTitle}
                            </span>
                          )}
                        </div>
                      )}
                      {lastExplanation.methods && lastExplanation.methods.length > 0 ? (
                        lastExplanation.methods.map((m, idx) => (
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
                        ))
                      ) : (
                        <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {lastExplanation.text}
                        </p>
                      )}
                      {lastExplanation.realLifeTip && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          🌍 <em>{lastExplanation.realLifeTip}</em>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
                      Após cada combate, veja aqui <strong>3 maneiras diferentes</strong> de resolver a continha de cabeça (Massinha da Soma, Hack Japonês, Dobra e Metade, etc.)!
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Oracle accordion */}
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <AccordionHeader
                id="oracle"
                label="Oráculo da Sala"
                badge={Object.keys(currentOracles).length ? `${Object.keys(currentOracles).length} ativo` : undefined}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
              />
              {activePanel === 'oracle' && (
                <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid #00d4ff22', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.keys(currentOracles).length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                      Pise em <strong>⚡ The Buff</strong> ou <strong>💀 Sacrifício</strong> para ativar o Oráculo e descobrir se deve pegar o Buff antes ou depois dos monstros!
                    </p>
                  ) : (
                    paths.map(pathId => {
                      const entry = currentOracles[pathId];
                      if (!entry) return null;
                      return <OraclePanel key={pathId} result={entry.result} pathId={pathId} roomIdx={entry.roomIdx} />;
                    })
                  )}
                </div>
              )}
            </div>

            {/* Rooms accordion */}
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <AccordionHeader
                id="rooms"
                label={`Progresso (${NUM_ROOMS} Salas/Caminho)`}
                badge={`${completedRooms.size}/2 ✓`}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
              />
              {activePanel === 'rooms' && (
                <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid #00d4ff22', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {roomStatus.map(s => (
                    <RoomPill
                      key={s.pathId}
                      label={s.pathId === 'buff' ? '⚡ The Buff' : '💀 Sacrifício'}
                      active={s.active}
                      complete={s.complete}
                      roomProgress={s.roomProgress}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Log accordion */}
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <AccordionHeader
                id="log"
                label="Histórico de Combates"
                badge={`${log.filter(l => l.type === 'combat').length} contas`}
                activePanel={activePanel}
                setActivePanel={setActivePanel}
              />
              {activePanel === 'log' && (
                <div style={{
                  background: '#0a0c14',
                  border: '1px solid #1e293b', borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  maxHeight: 280, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 1,
                  padding: '4px 0',
                }}>
                  {log.map((item, i) => (
                    <LogItemRow key={item.id} item={item} isFirst={i === 0} onCombatClick={handleLogClick} />
                  ))}
                </div>
              )}
            </div>

            {/* Legend accordion */}
            <div style={{ borderRadius: 8, overflow: 'hidden' }}>
              <AccordionHeader
                id="legend"
                label="Legenda do Mapa"
                activePanel={activePanel}
                setActivePanel={setActivePanel}
              />
              {activePanel === 'legend' && (
                <div style={{
                  background: 'rgba(8,10,22,0.5)',
                  border: '1px solid #1e293b', borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {([
                    ['👾', 'Jogador (com poder atual)'],
                    ['🔀', 'Escolha de Caminho (⚡ Buff ou 💀 Sacrifício)'],
                    ['⚡', 'Multiplicador da Sala (use na hora certa!)'],
                    ['💀', 'Monstro (absorva seu poder resolvendo a conta)'],
                    ['👹', 'Boss Final (surge quando limpar os 2 caminhos)'],
                    ['🌀', 'Portal da Vitória (abre após vencer o Boss)'],
                  ] as [string, string][]).map(([ic, d]) => (
                    <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#94a3b8' }}>
                      <span style={{ fontSize: 18, minWidth: 24 }}>{ic}</span>
                      <span>{d}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Combat overlay ── */}
          {combat && (
            <CombatArena
              playerPower={combat.powerSnapshot}
              monsterLevel={combat.monsterLevel}
              question={combat.question}
              choices={combat.choices}
              onResult={handleCombatResult}
              isBoss={combat.isBoss}
              isDesperationMode={combat.isDesperationMode}
              isImpossibleMode={combat.isImpossibleMode}
              streak={streak}
            />
          )}

          {/* ── Victory modal ── */}
          {gamePhase === 'victory' && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 2000,
              background: 'rgba(2,2,10,0.93)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
              <div style={{
                maxWidth: 500, width: '100%',
                background: 'linear-gradient(160deg, #0a0020 0%, #050015 100%)',
                border: '2px solid #a855f7',
                borderRadius: 16, padding: '28px 28px',
                boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 30px rgba(168,85,247,0.2)',
                textAlign: 'center', fontFamily: "'Courier New', monospace",
                maxHeight: '92vh', overflowY: 'auto',
              }}>
                <div style={{ fontSize: 48, marginBottom: 6 }}>🏆</div>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: '#a855f7', letterSpacing: 4, textTransform: 'uppercase' }}>
                  Masmorra Dominada!
                </p>
                <h2 style={{ margin: '0 0 14px', fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
                  VITÓRIA NO NÍVEL {currentStage}!
                </h2>
                <div style={{
                  background: 'rgba(168,85,247,0.08)', border: '1px solid #a855f744',
                  borderRadius: 10, padding: '12px 18px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Poder Acumulado</p>
                    <span style={{ fontSize: 32, fontWeight: 900, color: '#a855f7' }}>{formatPower(playerPower)}</span>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Maior Sequência</p>
                    <span style={{ fontSize: 26, fontWeight: 900, color: '#ffd700' }}>🔥 ×{bestStreak}</span>
                  </div>
                </div>

                {masteredLenses.length > 0 && (
                  <div style={{
                    textAlign: 'left', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 10, color: '#00d4ff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                      🧠 Lentes Mentais Dominadas ({masteredLenses.length})
                    </div>
                    {masteredLenses.slice(-4).map((l, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
                        ✓ {l}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginBottom: 16, textAlign: 'left' }}>
                  <label style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Seu nome para o Top 10 Placar:
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Ex: AUGUSTO"
                    value={victoryName}
                    onChange={e => setVictoryName(e.target.value.toUpperCase())}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(168,85,247,0.07)', border: '1px solid #a855f755',
                      color: '#e2e8f0', padding: '10px 14px', borderRadius: 6,
                      fontFamily: "'Courier New', monospace", fontSize: 16, letterSpacing: '0.12em',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={advanceLevel}
                  style={{
                    display: 'block', width: '100%',
                    background: 'rgba(255,215,0,0.16)', border: '2px solid #ffd700',
                    color: '#ffd700', padding: '13px 24px', borderRadius: 8, marginBottom: 8,
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                    fontSize: 14, fontWeight: 900, letterSpacing: 1,
                  }}
                >
                  ⚔️ Avançar para o Nível {currentStage + 1} (Manter Poder)
                </button>

                <button
                  onClick={() => {
                    saveHighScore({
                      name:  victoryName.trim() || 'LÓGICO',
                      power: playerPower,
                      stage: currentStage,
                      date:  new Date().toLocaleDateString('pt-BR'),
                    });
                    returnToMenu();
                  }}
                  style={{
                    display: 'block', width: '100%',
                    background: 'rgba(0,212,255,0.12)', border: '1px solid #00d4ff88',
                    color: '#00d4ff', padding: '11px 24px', borderRadius: 8, marginBottom: 8,
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                    fontSize: 12, fontWeight: 700, letterSpacing: 1,
                  }}
                >
                  💾 Salvar no Placar e Ver Top 10
                </button>

                <button
                  onClick={returnToMenu}
                  style={{
                    display: 'block', width: '100%',
                    background: 'transparent', border: '1px solid #1e293b',
                    color: '#64748b', padding: '9px 24px', borderRadius: 8,
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                    fontSize: 11, letterSpacing: 1,
                  }}
                >
                  🚪 Voltar ao Menu (sem salvar)
                </button>
              </div>
            </div>
          )}

          {/* ── Game Over modal ── */}
          {gamePhase === 'gameover' && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 2000,
              background: 'rgba(2,2,10,0.93)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
              <div style={{
                maxWidth: 500, width: '100%',
                background: 'linear-gradient(160deg, #1a0000 0%, #0a0000 100%)',
                border: '2px solid #ff2222',
                borderRadius: 16, padding: '28px 28px',
                boxShadow: '0 0 80px rgba(255,34,34,0.4), 0 0 30px rgba(255,34,34,0.2)',
                textAlign: 'center', fontFamily: "'Courier New', monospace",
                maxHeight: '92vh', overflowY: 'auto',
              }}>
                <div style={{ fontSize: 46, marginBottom: 6 }}>💀</div>
                <p style={{ margin: '0 0 4px', fontSize: 10, color: '#ff6666', letterSpacing: 3, textTransform: 'uppercase' }}>
                  Fim da Jornada — Mas o Aprendizado Fica!
                </p>
                <h2 style={{ margin: '0 0 14px', fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
                  FIM DE JOGO
                </h2>
                <div style={{
                  background: 'rgba(255,34,34,0.06)', border: '1px solid #ff222244',
                  borderRadius: 10, padding: '10px 18px', marginBottom: 14,
                  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Poder · Nível {currentStage}</p>
                    <span style={{ fontSize: 30, fontWeight: 900, color: '#ff4444' }}>{formatPower(playerPower)}</span>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#94a3b8', textTransform: 'uppercase' }}>Maior Sequência</p>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#ffd700' }}>🔥 ×{bestStreak}</span>
                  </div>
                </div>

                {gameOverReason && (
                  <div style={{
                    margin: '0 0 14px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6,
                    background: 'rgba(255,68,68,0.06)', border: '1px solid #ff444433',
                    borderRadius: 8, padding: '10px 12px', textAlign: 'left', whiteSpace: 'pre-wrap',
                  }}>
                    {gameOverReason}
                  </div>
                )}

                <div style={{ marginBottom: 14, textAlign: 'left' }}>
                  <label style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Seu nome para o Top 10 Placar:
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Ex: AUGUSTO"
                    value={gameOverName}
                    onChange={e => setGameOverName(e.target.value.toUpperCase())}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,34,34,0.06)', border: '1px solid #ff222244',
                      color: '#e2e8f0', padding: '10px 14px', borderRadius: 6,
                      fontFamily: "'Courier New', monospace", fontSize: 16, letterSpacing: '0.12em',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    saveHighScore({
                      name:  gameOverName.trim() || 'LÓGICO',
                      power: playerPower,
                      stage: currentStage,
                      date:  new Date().toLocaleDateString('pt-BR'),
                    });
                    returnToMenu();
                  }}
                  style={{
                    display: 'block', width: '100%',
                    background: 'rgba(0,212,255,0.12)', border: '1px solid #00d4ff88',
                    color: '#00d4ff', padding: '11px 24px', borderRadius: 8, marginBottom: 8,
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                    fontSize: 12, fontWeight: 700, letterSpacing: 1,
                  }}
                >
                  💾 Salvar no Placar e Ver Top 10
                </button>

                <button
                  onClick={resetGame}
                  style={{
                    display: 'block', width: '100%',
                    background: 'rgba(255,68,68,0.12)', border: '2px solid #ff4444',
                    color: '#ff4444', padding: '11px 24px', borderRadius: 8,
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                    fontSize: 13, fontWeight: 700, letterSpacing: 1,
                  }}
                >
                  ↺ Tentar Novamente (Novo Mapa)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

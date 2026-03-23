import { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import { Tile, TileType, Direction, PlayerPos, PathId } from './types';
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
import { runOracle, generateDynamicQuestion, Question, OracleResult, calculateTheoreticalMax } from './mathEngine';
import { CombatArena, ChoiceOption } from './CombatArena';
import { formatPower } from './utils';
import { saveHighScore } from './leaderboard';

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
  /** True when playerPower < enemyLevel / 2 — instant crush, no question. */
  isImpossibleMode:   boolean;
}

// ── Buff-modification animations (injected once) ──────────────────────────────
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
`;

// ── Log item type ──────────────────────────────────────────────────────────────
interface LogItem {
  id:         number;
  text:       string;
  type:       'combat' | 'oracle' | 'info';
  explanation?: string;
  hint?:        string;
  isCorrect?:   boolean;
}

let _logId = 0;
function mkLog(
  text: string,
  type: LogItem['type'] = 'info',
  extra?: Partial<Pick<LogItem, 'explanation' | 'hint' | 'isCorrect'>>,
): LogItem {
  return { id: ++_logId, text, type, ...extra };
}

// ── Visual constants ───────────────────────────────────────────────────────────
const CELL = 80;   // large tiles — viewport camera handles clipping
const GAP  = 2;

// ── Viewport / camera constants ────────────────────────────────────────────────
/** How many tiles are visible in each axis of the camera window. */
const VIEWPORT_TILES = 9;
/** Pixel size of the fixed viewport container (square). */
const VIEWPORT_W = VIEWPORT_TILES * CELL + (VIEWPORT_TILES - 1) * GAP; // 736 px
const VIEWPORT_H = VIEWPORT_W;

// ── Biome background helper ────────────────────────────────────────────────────
function getBackgroundImage(stage: number): string {
  const index = ((stage - 1) % 9) + 1;
  return `/images/background-0${index}.jpg`;
}

const COLOR: Record<TileType | 'PLAYER', { bg: string; border: string; shadow?: string }> = {
  // Walls are fully transparent — the biome artwork shows through
  EMPTY:        { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' },
  WALL:         { bg: 'transparent',        border: 'transparent' },
  // Entity tiles keep their identity colours but with a dark glass base
  MONSTER:      { bg: 'rgba(60,0,0,0.72)',  border: '#ff4444', shadow: 'inset 0 0 10px rgba(255,68,68,0.45)' },
  TRICKY_BUFF:  { bg: 'rgba(50,38,0,0.75)', border: '#ffd700', shadow: 'inset 0 0 10px rgba(255,215,0,0.40)' },
  MAJOR_CHOICE: { bg: 'rgba(0,24,40,0.80)', border: '#00d4ff', shadow: 'inset 0 0 16px rgba(0,212,255,0.35), 0 0 10px rgba(0,212,255,0.4)' },
  // Fog is intentionally opaque — unknown territory should feel impenetrable
  FOG:          { bg: 'rgba(4,4,14,0.93)',  border: 'rgba(18,18,42,0.55)' },
  BOSS:         { bg: 'rgba(26,0,40,0.85)', border: '#cc44ff', shadow: 'inset 0 0 18px rgba(200,68,255,0.55), 0 0 22px rgba(200,68,255,0.5)' },
  PORTAL:       { bg: 'rgba(13,0,30,0.85)', border: '#a855f7', shadow: 'inset 0 0 16px rgba(168,85,247,0.5), 0 0 18px rgba(168,85,247,0.6)' },
  PLAYER:       { bg: 'rgba(0,26,0,0.80)',  border: '#00ff00', shadow: 'inset 0 0 16px rgba(0,255,0,0.45), 0 0 14px rgba(0,255,0,0.6)' },
};

function cellStyle(tile: Tile, isPlayer: boolean): CSSProperties {
  const key       = isPlayer ? 'PLAYER' : tile.type;
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
function CellContent({ tile, isPlayer }: { tile: Tile; isPlayer: boolean }) {
  const icon: CSSProperties = {
    fontSize: 28, lineHeight: 1,
    filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.95))',
  };
  const lbl: CSSProperties = {
    fontSize: 11, fontFamily: "'Courier New', monospace",
    lineHeight: 1.2, textAlign: 'center', padding: '0 3px',
    textShadow: '0 1px 4px #000, 0 -1px 4px #000, 1px 0 4px #000, -1px 0 4px #000',
  };
  // Pill background for numeric labels to guarantee readability on any biome art
  const pill: CSSProperties = {
    background: 'rgba(0,0,0,0.78)',
    borderRadius: 4,
    padding: '1px 5px',
  };

  if (isPlayer) return (
    <span style={{ fontSize: 36, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}>👾</span>
  );

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
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function LogItemRow({
  item, isFirst, onCombatClick,
}: {
  item: LogItem;
  isFirst: boolean;
  onCombatClick?: (item: LogItem) => void;
}) {
  const clickable = item.type === 'combat' && !!item.explanation && !!onCombatClick;
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
        padding:    '8px 10px',
        borderLeft: `3px solid ${isFirst ? '#00d4ff' : accent}`,
        color:      textColor,
        fontSize:   13,
        fontFamily: "'Courier New', monospace",
        lineHeight: 1.65,
        cursor:     clickable ? 'pointer' : 'default',
        transition: 'background 0.15s',
        display:    'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ flexGrow: 1 }}>{item.text}</span>
      {clickable && <span style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>📖</span>}
    </div>
  );
}


function StatBadge({ label, value, color = '#00ff00' }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}44`,
      borderRadius: 6, padding: '6px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <span style={{ fontSize: 9, color: `${color}88`, fontFamily: "'Courier New', monospace", textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 20, color, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

// ── Oracle sidebar panel ───────────────────────────────────────────────────────
function OraclePanel({ result, pathId, roomIdx }: { result: OracleResult; pathId: PathId; roomIdx: number }) {
  const accent = pathId === 'buff' ? '#00d4ff' : '#ff4444';
  return (
    <div style={{
      background: `${accent}08`,
      border: `1px solid ${accent}33`,
      borderRadius: 8,
      padding: '14px 16px',
      fontSize: 14,
      fontFamily: "'Courier New', monospace",
      lineHeight: 2,
    }}>
      <p style={{ margin: '0 0 8px', color: accent, fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>
        ─ Oracle: {pathId === 'buff' ? '⚡ Buff' : '💀 Sac'} · Sala {roomIdx + 1}/{NUM_ROOMS} ─
      </p>
      <div style={{ color: '#64748b', fontSize: 12 }}>Ordem ótima:</div>
      <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>
        {result.optimalOrder.join(' → ')}
      </div>
      <div style={{ color: '#64748b', marginTop: 6, fontSize: 13 }}>{result.rationale}</div>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {result.monsterLevels.map((lvl, i) => (
          <span key={i} style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid #ff444444',
            borderRadius: 6,
            padding: '4px 10px',
            color: '#ff8888',
            fontSize: 14,
            fontWeight: 700,
          }}>
            M{i + 1}={formatPower(lvl)}
          </span>
        ))}
        <span style={{
          background: 'rgba(255,215,0,0.1)',
          border: '1px solid #ffd70044',
          borderRadius: 6,
          padding: '4px 10px',
          color: '#ffd700',
          fontSize: 14,
          fontWeight: 700,
        }}>
          {result.revealedBuffLabel}
        </span>
      </div>
    </div>
  );
}

// ── Room status pill ───────────────────────────────────────────────────────────
function RoomPill({ label, complete, active, roomProgress }: {
  label: string; complete: boolean; active: boolean; roomProgress: number;
}) {
  const color = complete ? '#00ff00' : active ? '#ffd700' : '#334155';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: `${color}12`,
      border: `1px solid ${color}55`,
      borderRadius: 8,
      fontSize: 15,
      fontFamily: "'Courier New', monospace",
    }}>
      <span style={{ color, fontSize: 20 }}>{complete ? '✓' : active ? '…' : '○'}</span>
      <span style={{ color: complete ? '#00ff00' : active ? '#ffd700' : '#334155', fontWeight: 600 }}>
        {label}
      </span>
      {active && !complete && (
        <span style={{ color: '#ffd700', fontSize: 13, marginLeft: 'auto' }}>{roomProgress}/{NUM_ROOMS}</span>
      )}
      {complete && <span style={{ color: '#00ff00', fontSize: 13, marginLeft: 'auto' }}>COMPLETA</span>}
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
        background:     open ? 'rgba(0,212,255,0.09)' : 'rgba(8,10,20,0.55)',
        border:         `1px solid ${open ? '#00d4ff33' : '#1e293b'}`,
        borderRadius:   open ? '8px 8px 0 0' : 8,
        color:          open ? '#00d4ff' : '#475569',
        fontSize:       9,
        fontFamily:     "'Courier New', monospace",
        textTransform:  'uppercase',
        letterSpacing:  2,
        cursor:         'pointer',
        transition:     'all 0.18s ease',
        outline:        'none',
      }}
    >
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {badge && <span style={{ fontSize: 9, color: '#ffd70099' }}>{badge}</span>}
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </div>
    </button>
  );
}

// ── Fixed mobile D-pad ─────────────────────────────────────────────────────────
function FixedDpad({ onMove }: { onMove: (dir: Direction) => void }) {
  const btn: CSSProperties = {
    width:                     72,
    height:                    72,
    background:                'rgba(0,212,255,0.10)',
    border:                    '2px solid rgba(0,212,255,0.28)',
    borderRadius:              14,
    color:                     '#00d4ff',
    fontSize:                  30,
    cursor:                    'pointer',
    display:                   'flex',
    alignItems:                'center',
    justifyContent:            'center',
    touchAction:               'manipulation',
    userSelect:                'none',
    WebkitTapHighlightColor:   'transparent',
    transition:                'background 0.1s ease',
    fontFamily:                'system-ui, sans-serif',
  };
  const press  = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) =>
    ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.30)');
  const release = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) =>
    ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.10)');

  return (
    <div style={{
      position:   'fixed',
      bottom:     24,
      left:       24,
      zIndex:     500,
      display:    'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap:        4,
    }}>
      <button style={btn} aria-label="Cima"     onClick={() => onMove('UP')}
        onMouseDown={press} onMouseUp={release} onTouchStart={press} onTouchEnd={release}>↑</button>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn} aria-label="Esquerda" onClick={() => onMove('LEFT')}
          onMouseDown={press} onMouseUp={release} onTouchStart={press} onTouchEnd={release}>←</button>
        <button style={btn} aria-label="Baixo"    onClick={() => onMove('DOWN')}
          onMouseDown={press} onMouseUp={release} onTouchStart={press} onTouchEnd={release}>↓</button>
        <button style={btn} aria-label="Direita"  onClick={() => onMove('RIGHT')}
          onMouseDown={press} onMouseUp={release} onTouchStart={press} onTouchEnd={release}>→</button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LogicAscension({ onGoToMenu }: { onGoToMenu?: () => void } = {}) {
  // ── ProcGen map: generate once on mount, regenerate on reset ────────────────
  const [mapData, setMapData] = useState<GeneratedMap>(generateRandomMap);
  const [grid,    setGrid]    = useState<Tile[][]>(() => mapData.grid);

  // ── Core game state ──────────────────────────────────────────────────────────
  const [playerPos,      setPlayerPos]      = useState<PlayerPos>(PLAYER_START);
  const [playerPower,    setPlayerPower]    = useState(10);
  const [combat,         setCombat]         = useState<CombatState | null>(null);
  const [completedRooms, setCompletedRooms] = useState<Set<PathId>>(new Set());
  const [gamePhase,      setGamePhase]      = useState<GamePhase>('playing');
  const [bossSpawned,    setBossSpawned]    = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  /** Sprint 9: stage persists across maps — increments on "Avançar", resets on "Reiniciar". */
  const [currentStage,   setCurrentStage]   = useState(1);
  /** Sprint 10.5: explanation from the last resolved combat, persists on the map screen. */
  const [lastExplanation, setLastExplanation] = useState<{ text: string; isCorrect: boolean } | null>(null);
  /** Sprint 10.6: which accordion panel is open in the sidebar. */
  const [activePanel, setActivePanel] = useState<AccordionId | null>('knowledge');
  /** Sprint 12: player names for leaderboard save on Victory / Game Over. */
  const [victoryName,  setVictoryName]  = useState('');
  const [gameOverName, setGameOverName] = useState('');

  // ── ProcGen room tracking ────────────────────────────────────────────────────
  // activeRoomIdx[pathId] = current room being played (undefined = not started)
  // oracleChain[pathId]   = oracle results per room, accumulated progressively
  const [activeRoomIdx, setActiveRoomIdx] = useState<Partial<Record<PathId, number>>>({});
  const [oracleChain,   setOracleChain]   = useState<Partial<Record<PathId, OracleResult[]>>>({});

  const [log, setLog] = useState<LogItem[]>(() => [
    mkLog('👾 Logic Ascension · Progressão Infinita', 'info'),
    mkLog('🗺️  Explore o corredor e entre nas Salas.', 'info'),
    mkLog('⌨️  WASD ou setas para mover.', 'info'),
  ]);

  // ── Stable refs (avoid stale closures in callbacks / effects) ────────────────
  const gridRef           = useRef(grid);
  const posRef            = useRef(playerPos);
  const powerRef          = useRef(playerPower);
  const combatRef         = useRef(combat);
  const stageRef          = useRef(currentStage);
  stageRef.current        = currentStage;
  const completedRoomsRef = useRef(completedRooms);
  const gamePhaseRef      = useRef(gamePhase);
  const bossSpawnedRef    = useRef(bossSpawned);
  const mapDataRef        = useRef(mapData);
  const activeRoomIdxRef  = useRef(activeRoomIdx);
  const oracleChainRef    = useRef(oracleChain);
  gridRef.current           = grid;
  posRef.current            = playerPos;
  powerRef.current          = playerPower;
  combatRef.current         = combat;
  completedRoomsRef.current = completedRooms;
  gamePhaseRef.current      = gamePhase;
  bossSpawnedRef.current    = bossSpawned;
  mapDataRef.current        = mapData;
  activeRoomIdxRef.current  = activeRoomIdx;
  oracleChainRef.current    = oracleChain;

  const addEntries = useCallback((entries: LogItem[]) => {
    setLog(prev => [...entries, ...prev].slice(0, 40));
  }, []);

  // ── Reveal room k (rooms 1–4): run chained Oracle, then uncover FOG ──────────
  // Called by the room-completion effect when a room is cleared.
  const revealNextRoom = useCallback((pathId: PathId, roomIdx: number) => {
    const room  = mapDataRef.current.rooms[pathId][roomIdx];
    const chain = oracleChainRef.current[pathId] ?? [];
    // Hardcore Oracle chain: Room k uses Room (k-1)'s projected power as input
    const inputPower = chain[roomIdx - 1]?.projectedPowerAfterRoom ?? powerRef.current;
    const oracle = runOracle(inputPower, pathId, room.buffMultiplier);

    setOracleChain(prev => ({
      ...prev,
      [pathId]: [...(prev[pathId] ?? []), oracle],
    }));

    setGrid(g => {
      let ng = g;
      // 1. Access tiles (chunk spine section) → EMPTY
      for (const { row, col } of room.accessTiles)
        ng = setTile(ng, row, col, { type: 'EMPTY' });
      // 2. All floor tiles → EMPTY (entity overwrites follow)
      for (const ft of room.floorTiles)
        ng = setTile(ng, ft.row, ft.col, { type: 'EMPTY' });
      // 3. Monsters
      for (let i = 0; i < 3; i++) {
        const p = room.monsterPositions[i];
        ng = setTile(ng, p.row, p.col, { type: 'MONSTER', level: oracle.monsterLevels[i] });
      }
      // 4. TrickyBuff with visual cue (reward = buff improved or neutral; punish = nerfed)
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

    // Clear buff animation flag after keyframe completes
    const { row: br, col: bc } = room.buffPosition;
    setTimeout(() => {
      setGrid(g => {
        const bt = g[br]?.[bc];
        if (bt?.type !== 'TRICKY_BUFF' || !bt.animationType) return g;
        return setTile(g, br, bc, { ...bt, animationType: undefined });
      });
    }, 1400);
  }, [addEntries]);

  // ── Sequential room-completion detector ──────────────────────────────────────
  // Fires on every grid change. Checks if the CURRENT active room (per path) has
  // all 4 entity tiles cleared. On clear → reveal next room OR mark path done.
  useEffect(() => {
    const paths: PathId[] = ['buff', 'sacrifice'];
    for (const pathId of paths) {
      if (completedRoomsRef.current.has(pathId)) continue;
      const activeIdx = activeRoomIdxRef.current[pathId];
      if (activeIdx === undefined) continue;    // MC not yet activated

      const room     = mapDataRef.current.rooms[pathId][activeIdx];
      const entities = [...room.monsterPositions, room.buffPosition];
      if (!entities.every(({ row, col }) => grid[row][col].type === 'EMPTY')) continue;

      // Active room cleared!
      addEntries([
        mkLog(`🏆 Sala ${activeIdx + 1}/${NUM_ROOMS} concluída! (${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'})`, 'info'),
      ]);

      if (activeIdx < NUM_ROOMS - 1) {
        setActiveRoomIdx(prev => ({ ...prev, [pathId]: activeIdx + 1 }));
        revealNextRoom(pathId, activeIdx + 1);
      } else {
        setCompletedRooms(prev => new Set([...prev, pathId]));
        addEntries([
          mkLog(`🏆🏆 ${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'} — Todas ${NUM_ROOMS} Salas Concluídas!`, 'info'),
        ]);
      }
    }
  }, [grid, addEntries, revealNextRoom]);

  // ── Boss spawn detector ──────────────────────────────────────────────────────
  // Fires when BOTH paths are fully cleared.
  // Boss level = 90% of the highest Room-5 projected power across both paths.
  useEffect(() => {
    if (completedRooms.size < 2 || bossSpawnedRef.current) return;
    const buffProj = oracleChainRef.current.buff?.[NUM_ROOMS - 1]?.projectedPowerAfterRoom;
    const sacProj  = oracleChainRef.current.sacrifice?.[NUM_ROOMS - 1]?.projectedPowerAfterRoom;
    const base     = Math.max(buffProj ?? 0, sacProj ?? 0) || calculateTheoreticalMax();
    const bossLvl  = Math.round(base * 0.9);
    setBossSpawned(true);
    setGrid(g => setTile(g, BOSS_SPAWN.row, BOSS_SPAWN.col, { type: 'BOSS', level: bossLvl }));
    addEntries([
      mkLog(`💥 BOSS FINAL surgiu no corredor! Lv.${bossLvl}`, 'info'),
      mkLog(`📐 Oracle proj. máx (${NUM_ROOMS} salas): ${base} → Boss = 90% = ${bossLvl}`, 'oracle'),
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
      setPlayerPos({ row: nr, col: nc });
      setGamePhase('victory');
      return;
    }

    // ── TRICKY BUFF ──────────────────────────────────────────────────────
    if (target.type === 'TRICKY_BUFF') {
      const mult = target.multiplier ?? 1;
      newPower   = Math.round(power * mult);
      entries.push(mkLog(`⚡ TrickyBuff! ${power} ${target.multiplierLabel} = ${newPower} poder`, 'info'));
      newGrid = setTile(newGrid, nr, nc, { type: 'EMPTY' });
    }

    // ── MAJOR CHOICE (first visit only) ──────────────────────────────────
    if (target.type === 'MAJOR_CHOICE' && !target.activated) {
      const pathId = target.pathId!;
      const mcMult = target.multiplier ?? 1;

      // Task 1: Apply MC multiplier IMMEDIATELY
      newPower = Math.round(newPower * mcMult);
      entries.push(
        mkLog(`${pathId === 'buff' ? '⚡' : '💀'} Escolha! ${power} ${target.multiplierLabel ?? ''} → ${newPower} poder`, 'info')
      );

      // Oracle for Room 0 (no overrideBuffMult → Sprint-7 MC punishment/reward)
      const oracle0 = runOracle(newPower, pathId);
      const room0   = mapDataRef.current.rooms[pathId][0];

      // Reveal access tiles (MC connector + chunk-0 spine) → EMPTY
      for (const { row: ar, col: ac } of room0.accessTiles)
        newGrid = setTile(newGrid, ar, ac, { type: 'EMPTY' });
      // Floor tiles → EMPTY first, then entities override
      for (const ft of room0.floorTiles)
        newGrid = setTile(newGrid, ft.row, ft.col, { type: 'EMPTY' });
      // Monsters
      for (let i = 0; i < 3; i++) {
        const p = room0.monsterPositions[i];
        newGrid = setTile(newGrid, p.row, p.col, { type: 'MONSTER', level: oracle0.monsterLevels[i] });
      }
      // TrickyBuff with MC punishment/reward animation
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
      setTimeout(() => {
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
  }, [addEntries]);

  // ── Combat result handler ─────────────────────────────────────────────────────
  const handleCombatResult = useCallback((correct: boolean) => {
    const c = combatRef.current;
    if (!c) return;
    setCombat(null);

    const resolveKill = (newPower: number, logLine: string) => {
      setGrid(g => setTile(g, c.targetPos.row, c.targetPos.col, { type: 'EMPTY' }));
      setPlayerPos(c.targetPos);
      setPlayerPower(newPower);
      addEntries([mkLog(logLine, 'combat', {
        explanation: c.question.explanation,
        hint:        c.question.hint,
        isCorrect:   correct,
      })]);
    };

    const spawnPortal = (newPower: number, logPrefix: string) => {
      setGrid(g => {
        let ng = setTile(g, c.targetPos.row, c.targetPos.col, { type: 'EMPTY' });
        ng     = setTile(ng, PORTAL_SPAWN.row, PORTAL_SPAWN.col, { type: 'PORTAL' });
        return ng;
      });
      setPlayerPos(c.targetPos);
      setPlayerPower(newPower);
      addEntries([
        mkLog(`${logPrefix} Boss derrotado! +${formatPower(c.monsterLevel)} poder. Total: ${formatPower(newPower)}`, 'combat', {
          explanation: c.question.explanation,
          hint:        c.question.hint,
          isCorrect:   correct,
        }),
        mkLog('🌀 PORTAL aberto! Retorne para vencer!', 'info'),
      ]);
    };

    if (c.isImpossibleMode) {
      setGamePhase('gameover');
      setGameOverReason(
        `⚠️ DIFERENÇA DE PODER ABSURDA! O monstro (Lv.${formatPower(c.monsterLevel)}) te esmagou! ` +
        `Poder: ${formatPower(c.powerSnapshot)} (mín. necessário: ${formatPower(Math.ceil(c.monsterLevel / 2))})`
      );
      return;
    }

    // Persist hint + explanation for the Knowledge Box (always include both)
    const kbText = [
      c.question.hint        ? `💡 ${c.question.hint}` : '',
      c.question.explanation ?? '',
    ].filter(Boolean).join('\n\n');
    setLastExplanation({ text: kbText, isCorrect: correct });

    if (c.isDesperationMode) {
      if (correct) {
        const absorbed = Math.round(c.monsterLevel * 0.5);
        const newPower = c.powerSnapshot + absorbed;
        if (c.isBoss) spawnPortal(newPower, '🔥 Milagre Desesperado!');
        else resolveKill(newPower, `🔥 Milagre! +${formatPower(absorbed)} poder (50% desespero). Total: ${formatPower(newPower)}`);
      } else {
        setGamePhase('gameover');
        setGameOverReason(
          c.isBoss
            ? `Falhou no Ataque Desesperado contra o Boss! Resposta: ${c.question.correctAnswer}. ${c.question.explanation}`
            : `Falhou no Ataque Desesperado! Resposta: ${c.question.correctAnswer}. ${c.question.explanation}`
        );
      }
      return;
    }

    if (c.isBoss) {
      if (correct) spawnPortal(c.powerSnapshot + c.monsterLevel, '🏆');
      else {
        setGamePhase('gameover');
        setGameOverReason(
          `Falhou contra o Boss Final! Resposta: ${c.question.correctAnswer}. ${c.question.explanation}`
        );
      }
      return;
    }

    const delta    = correct ? c.monsterLevel : -Math.round(c.monsterLevel * 0.5);
    const newPower = c.powerSnapshot + delta;
    if (newPower <= 0) {
      setGamePhase('gameover');
      setGameOverReason(
        `Poder chegou a ${formatPower(newPower)}. Resposta: ${c.question.correctAnswer}. ${c.question.explanation}`
      );
      return;
    }
    resolveKill(
      newPower,
      correct
        ? `✅ Correto! +${formatPower(delta)} poder. Total: ${formatPower(newPower)}`
        : `❌ Errado! ${formatPower(delta)} poder (dano). Total: ${formatPower(newPower)}`
    );
  }, [addEntries]);

  // ── Log-item click: show explanation in Knowledge Box ────────────────────────
  const handleLogClick = useCallback((item: LogItem) => {
    const body = [
      item.hint        ? `💡 ${item.hint}` : '',
      item.explanation ?? '',
    ].filter(Boolean).join('\n\n');
    setLastExplanation({ text: body, isCorrect: item.isCorrect ?? false });
    setActivePanel('knowledge');
  }, []);

  // ── Keyboard listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); move('UP');    break;
        case 'ArrowDown':  case 's': case 'S': e.preventDefault(); move('DOWN');  break;
        case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); move('LEFT');  break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); move('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  // ── Reset to Stage 1 (full hard restart) ─────────────────────────────────────
  const resetGame = useCallback(() => {
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
    setLog([
      mkLog('🔄 Reiniciado do zero.', 'info'),
      mkLog('👾 Logic Ascension — Nível 1', 'info'),
      mkLog('🗺️  Explore o corredor e entre nas Salas.', 'info'),
    ]);
  }, []);

  // ── Advance to next stage (carry-over power) ──────────────────────────────────
  // Keeps playerPower intact; generates a fresh map; resets only level state.
  const advanceLevel = useCallback(() => {
    const newMap = generateRandomMap();
    setCurrentStage(s => s + 1);
    setMapData(newMap);
    setGrid(newMap.grid);
    setPlayerPos(PLAYER_START);
    // playerPower is intentionally NOT reset here
    setCombat(null);
    setCompletedRooms(new Set());
    setActiveRoomIdx({});
    setOracleChain({});
    setGamePhase('playing');
    setBossSpawned(false);
    setGameOverReason('');
    setLastExplanation(null);
    setLog([
      mkLog(`🆕 Avançando para o próximo nível! Poder herdado: ${powerRef.current}`, 'info'),
      mkLog('🗺️  Novo mapa — explore e entre nas Salas.', 'info'),
    ]);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const paths: PathId[] = ['buff', 'sacrifice'];

  const roomStatus = paths.map(pathId => {
    const { row, col } = MAJOR_CHOICE_POS[pathId];
    const mc       = grid[row][col];
    const activeIdx = activeRoomIdx[pathId];
    return {
      pathId,
      active:       mc.type === 'MAJOR_CHOICE' && !!mc.activated,
      complete:     completedRooms.has(pathId),
      roomProgress: activeIdx !== undefined ? activeIdx + 1 : 0,
    };
  });

  // Latest oracle per path (last room that was activated)
  const currentOracles: Partial<Record<PathId, { result: OracleResult; roomIdx: number }>> = {};
  for (const pathId of paths) {
    const chain = oracleChain[pathId];
    if (chain?.length) {
      currentOracles[pathId] = { result: chain[chain.length - 1], roomIdx: chain.length - 1 };
    }
  }

  // Boss tile level for sidebar display
  const bossTile = grid[BOSS_SPAWN.row]?.[BOSS_SPAWN.col];
  const bossLevel = bossTile?.type === 'BOSS' ? bossTile.level : undefined;

  // ── Render ────────────────────────────────────────────────────────────────────
  // Camera: translate the full grid so the player tile is centred in the viewport.
  // playerPos.col * (CELL + GAP) is the left-edge of the player tile; add CELL/2
  // to get its centre, then subtract half the viewport width to align them.
  const camTx = Math.round(VIEWPORT_W / 2 - playerPos.col * (CELL + GAP) - CELL / 2);
  const camTy = Math.round(VIEWPORT_H / 2 - playerPos.row * (CELL + GAP) - CELL / 2);

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           20,
      padding:       '24px 16px 32px',
      minHeight:     '100vh',
      background:    '#07070f',
      fontFamily:    "'Courier New', monospace",
      color:         '#e2e8f0',
    }}>

      <style>{GAME_STYLES}</style>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 11, color: '#00d4ff', letterSpacing: 3, textTransform: 'uppercase' }}>
          Logic Ascension · Sprint 9 · Progressão Infinita
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(18px, 3.5vw, 28px)', fontWeight: 700, color: '#f1f5f9', letterSpacing: 1 }}>
          A Ascensão Lógica
          <span style={{
            marginLeft: 14,
            fontSize: 'clamp(14px, 2vw, 20px)',
            color: '#ffd700',
            fontWeight: 900,
            letterSpacing: 2,
            textShadow: '0 0 12px rgba(255,215,0,0.5)',
          }}>
            — Nível {currentStage}
          </span>
        </h1>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>

        {/* ── Grid viewport ── */}
        <div style={{ flexShrink: 0 }}>

          {/* Fixed clipping window — overflow:hidden hides everything outside */}
          <div style={{
            position:           'relative',
            width:              VIEWPORT_W,
            height:             VIEWPORT_H,
            overflow:           'hidden',
            backgroundImage:    `linear-gradient(rgba(10,10,20,0.85), rgba(10,10,20,0.85)), url('${getBackgroundImage(currentStage)}')`,
            backgroundSize:     'cover',
            backgroundPosition: 'center',
            border:             '2px solid #1e293b',
            borderRadius:       8,
            boxShadow:          '0 0 40px rgba(0,0,0,0.8)',
          }}>

            {/* Camera layer — translate3d tracks the player */}
            <div style={{
              position:   'absolute',
              top:        0,
              left:       0,
              zIndex:     0,
              transform:  `translate3d(${camTx}px, ${camTy}px, 0)`,
              transition: 'transform 0.18s ease-out',
              willChange: 'transform',
              display:             'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL}px)`,
              gap:                 GAP,
            }}>
              {grid.map((row, ri) =>
                row.map((tile, ci) => {
                  const isPlayer = ri === playerPos.row && ci === playerPos.col;
                  return (
                    <div key={`${ri}-${ci}`} style={cellStyle(tile, isPlayer)}>
                      <CellContent tile={tile} isPlayer={isPlayer} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Vignette overlay — darkens edges so entities/text stay legible on bright biome art */}
            <div style={{
              position:       'absolute',
              inset:          0,
              zIndex:         1,
              pointerEvents:  'none',
              background:     'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.60) 100%)',
              borderRadius:   6,
            }} />
          </div>

          {/* ── Controls ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, width: VIEWPORT_W }}>
            <button onClick={resetGame}
              style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Courier New', monospace", fontSize: 11, transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ↺ Novo Mapa
            </button>
          </div>
        </div>

        {/* ── Sidebar (accordion) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 270, minWidth: 220, flexShrink: 0 }}>

          {/* Status — always visible ───────────────────────────────────────────── */}
          <div style={{
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid #1e293b',
            borderRadius: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>
                — Status · Nível {currentStage} —
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBadge label="Poder" value={formatPower(playerPower)} color="#00ff00" />
              <StatBadge label="Posição" value={`${playerPos.row},${playerPos.col}`} color="#00d4ff" />
            </div>
            {bossSpawned && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                <span>{gamePhase === 'victory' ? '🏆' : '👹'}</span>
                <span style={{ color: gamePhase === 'victory' ? '#a855f7' : '#cc44ff', fontWeight: 700 }}>
                  {gamePhase === 'victory' ? 'Boss Derrotado!' : `Boss Lv.${bossLevel != null ? formatPower(bossLevel) : '—'} — Ativo!`}
                </span>
              </div>
            )}
          </div>

          {/* Rooms accordion ──────────────────────────────────────────────────── */}
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <AccordionHeader
              id="rooms"
              label={`Salas (${NUM_ROOMS}/caminho)`}
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

          {/* Oracle accordion ─────────────────────────────────────────────────── */}
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <AccordionHeader
              id="oracle"
              label="Oracle"
              badge={Object.keys(currentOracles).length ? `${Object.keys(currentOracles).length} ativo` : undefined}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
            />
            {activePanel === 'oracle' && (
              <div style={{ background: 'rgba(0,212,255,0.02)', border: '1px solid #00d4ff22', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.keys(currentOracles).length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#475569', fontFamily: "'Courier New', monospace", lineHeight: 1.7 }}>
                    Entre em uma sala para ativar o Oracle e revelar a ordem ótima.
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

          {/* Log accordion ────────────────────────────────────────────────────── */}
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <AccordionHeader
              id="log"
              label="Log de Eventos"
              badge={`${log.filter(l => l.type === 'combat').length} combates`}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
            />
            {activePanel === 'log' && (
              <div style={{
                background: '#0a0c14',
                border: '1px solid #1e293b', borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                maxHeight: 340, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 1,
                padding: '4px 0',
              }}>
                {log.map((item, i) => (
                  <LogItemRow key={item.id} item={item} isFirst={i === 0} onCombatClick={handleLogClick} />
                ))}
              </div>
            )}
          </div>

          {/* Knowledge accordion ──────────────────────────────────────────────── */}
          <div style={{ borderRadius: 8, overflow: 'hidden' }}>
            <AccordionHeader
              id="knowledge"
              label={`Caixa de Conhecimento${lastExplanation ? (lastExplanation.isCorrect ? '  ✅' : '  ❌') : ''}`}
              activePanel={activePanel}
              setActivePanel={setActivePanel}
            />
            {activePanel === 'knowledge' && (
              <div style={{
                background:   lastExplanation
                  ? (lastExplanation.isCorrect ? 'rgba(0,55,0,0.22)' : 'rgba(55,12,0,0.26)')
                  : 'rgba(8,10,22,0.6)',
                border:       `1px solid ${lastExplanation ? (lastExplanation.isCorrect ? '#00cc5544' : '#ff664444') : '#1e293b'}`,
                borderTop:    'none',
                borderRadius: '0 0 8px 8px',
                padding:      '18px 20px',
                minHeight:    160,
                transition:   'background 0.4s ease, border-color 0.4s ease',
              }}>
                <p style={{
                  margin:     0,
                  fontSize:   16,
                  fontFamily: "'Courier New', monospace",
                  color:      lastExplanation ? '#cbd5e1' : '#334155',
                  lineHeight: 2,
                  whiteSpace: 'pre-wrap',
                  transition: 'color 0.3s ease',
                }}>
                  {lastExplanation
                    ? lastExplanation.text
                    : 'A explicação da última questão de matemática aparecerá aqui após cada combate.\n\nClique em um combate do Log para rever a solução.'}
                </p>
              </div>
            )}
          </div>

          {/* Legend accordion ─────────────────────────────────────────────────── */}
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
                padding: '14px 18px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                {([
                  ['👾', 'Jogador'],
                  ['🔀', 'Escolha (garfo)'],
                  ['⚡', 'TrickyBuff'],
                  ['💀', 'Monstro'],
                  ['░░', 'Névoa'],
                  ['👹', 'Boss Final'],
                  ['🌀', 'Portal → Vitória'],
                ] as [string, string][]).map(([ic, d]) => (
                  <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: '#64748b', fontFamily: "'Courier New', monospace" }}>
                    <span style={{ fontSize: 22, minWidth: 28 }}>{ic}</span>
                    <span>{d}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <p style={{ margin: 0, fontSize: 10, color: '#334155', letterSpacing: 1 }}>
        ⌨  WASD ou Setas · Limpe as {NUM_ROOMS} Salas de cada caminho · Derrote o Boss · Entre no Portal
      </p>

      {/* ── Fixed mobile D-pad ── */}
      {gamePhase === 'playing' && !combat && <FixedDpad onMove={move} />}

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
        />
      )}

      {/* ── Victory modal ── */}
      {gamePhase === 'victory' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(2,2,10,0.93)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            maxWidth: 480, width: '100%',
            background: 'linear-gradient(160deg, #0a0020 0%, #050015 100%)',
            border: '2px solid #a855f7',
            borderRadius: 16, padding: '36px 32px',
            boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 30px rgba(168,85,247,0.2)',
            textAlign: 'center', fontFamily: "'Courier New', monospace",
          }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🏆</div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#a855f7', letterSpacing: 4, textTransform: 'uppercase' }}>
              Parabéns, Lógico!
            </p>
            <h2 style={{ margin: '0 0 18px', fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
              VITÓRIA!
            </h2>
            <div style={{
              background: 'rgba(168,85,247,0.08)', border: '1px solid #a855f744',
              borderRadius: 10, padding: '12px 20px', marginBottom: 20,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
                Nível {currentStage} · Poder Final
              </p>
              <span style={{ fontSize: 38, fontWeight: 900, color: '#a855f7' }}>{formatPower(playerPower)}</span>
              <p style={{ margin: '6px 0 0', fontSize: 10, color: '#475569' }}>
                Salas: {completedRooms.size} × {NUM_ROOMS} · Boss derrotado ✓
              </p>
            </div>

            {/* Name input for leaderboard */}
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Nome para o placar (opcional):
              </label>
              <input
                type="text"
                maxLength={12}
                placeholder="Ex: JOGADOR"
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

            {/* Primary: carry-over power to next level */}
            <button onClick={advanceLevel} style={{
              display: 'block', width: '100%',
              background: 'rgba(255,215,0,0.15)', border: '2px solid #ffd700',
              color: '#ffd700', padding: '13px 32px', borderRadius: 8, marginBottom: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 14, fontWeight: 900, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.15)')}
            >
              ⚔️ Avançar para o Nível {currentStage + 1}
            </button>

            {/* Save score and go to menu */}
            <button onClick={() => {
              saveHighScore({
                name:  victoryName.trim() || 'AAA',
                power: playerPower,
                stage: currentStage,
                date:  new Date().toLocaleDateString('pt-BR'),
              });
              onGoToMenu?.();
            }} style={{
              display: 'block', width: '100%',
              background: 'rgba(0,212,255,0.10)', border: '1px solid #00d4ff88',
              color: '#00d4ff', padding: '11px 32px', borderRadius: 8, marginBottom: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 12, fontWeight: 700, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.10)')}
            >
              💾 Salvar e Voltar ao Menu
            </button>

            {/* Quit without saving */}
            <button onClick={() => onGoToMenu?.()} style={{
              display: 'block', width: '100%',
              background: 'transparent', border: '1px solid #1e293b',
              color: '#334155', padding: '9px 32px', borderRadius: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: 1, transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#64748b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
            >
              🚪 Desistir (sem salvar)
            </button>
          </div>
        </div>
      )}

      {/* ── Game Over modal ── */}
      {gamePhase === 'gameover' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(2,2,10,0.93)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            maxWidth: 480, width: '100%',
            background: 'linear-gradient(160deg, #1a0000 0%, #0a0000 100%)',
            border: '2px solid #ff2222',
            borderRadius: 16, padding: '36px 32px',
            boxShadow: '0 0 80px rgba(255,34,34,0.4), 0 0 30px rgba(255,34,34,0.2)',
            textAlign: 'center', fontFamily: "'Courier New', monospace",
          }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>💀</div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#ff4444', letterSpacing: 4, textTransform: 'uppercase' }}>
              Derrota
            </p>
            <h2 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
              GAME OVER
            </h2>
            <div style={{
              background: 'rgba(255,34,34,0.06)', border: '1px solid #ff222244',
              borderRadius: 10, padding: '12px 20px', marginBottom: 16,
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
                Poder · Nível {currentStage}
              </p>
              <span style={{ fontSize: 38, fontWeight: 900, color: '#ff4444' }}>{formatPower(playerPower)}</span>
            </div>
            {gameOverReason && (
              <p style={{
                margin: '0 0 16px', fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
                background: 'rgba(255,68,68,0.05)', border: '1px solid #ff44441a',
                borderRadius: 8, padding: '10px 14px',
              }}>
                {gameOverReason}
              </p>
            )}

            {/* Name input for leaderboard */}
            <div style={{ marginBottom: 18, textAlign: 'left' }}>
              <label style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Nome para o placar (opcional):
              </label>
              <input
                type="text"
                maxLength={12}
                placeholder="Ex: JOGADOR"
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

            {/* Save and go to menu */}
            <button onClick={() => {
              saveHighScore({
                name:  gameOverName.trim() || 'AAA',
                power: playerPower,
                stage: currentStage,
                date:  new Date().toLocaleDateString('pt-BR'),
              });
              onGoToMenu?.();
            }} style={{
              display: 'block', width: '100%',
              background: 'rgba(0,212,255,0.08)', border: '1px solid #00d4ff66',
              color: '#00d4ff', padding: '11px 32px', borderRadius: 8, marginBottom: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 12, fontWeight: 700, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.20)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.08)')}
            >
              💾 Salvar e Voltar ao Menu
            </button>

            {/* Try again (no save) */}
            <button onClick={resetGame} style={{
              display: 'block', width: '100%',
              background: 'rgba(255,68,68,0.10)', border: '2px solid #ff4444',
              color: '#ff4444', padding: '11px 32px', borderRadius: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 13, fontWeight: 700, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.10)')}
            >
              ↺ Tentar Novamente (sem salvar)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

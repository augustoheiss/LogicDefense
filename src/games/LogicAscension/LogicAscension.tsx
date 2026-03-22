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
import { runOracle, getRandomQuestion, Question, OracleResult, calculateTheoreticalMax } from './mathEngine';
import { CombatArena, ChoiceOption } from './CombatArena';

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

// ── Visual constants ───────────────────────────────────────────────────────────
const CELL = 80;   // large tiles — viewport camera handles clipping
const GAP  = 2;

// ── Viewport / camera constants ────────────────────────────────────────────────
/** How many tiles are visible in each axis of the camera window. */
const VIEWPORT_TILES = 9;
/** Pixel size of the fixed viewport container (square). */
const VIEWPORT_W = VIEWPORT_TILES * CELL + (VIEWPORT_TILES - 1) * GAP; // 736 px
const VIEWPORT_H = VIEWPORT_W;

const COLOR: Record<TileType | 'PLAYER', { bg: string; border: string; shadow?: string }> = {
  EMPTY:        { bg: '#0f172a', border: '#1e2d45' },
  WALL:         { bg: '#06080f', border: '#0e1428' },
  MONSTER:      { bg: '#1c0808', border: '#ff4444', shadow: 'inset 0 0 10px rgba(255,68,68,0.4)' },
  TRICKY_BUFF:  { bg: '#1a1400', border: '#ffd700', shadow: 'inset 0 0 10px rgba(255,215,0,0.35)' },
  MAJOR_CHOICE: { bg: '#001828', border: '#00d4ff', shadow: 'inset 0 0 16px rgba(0,212,255,0.35), 0 0 10px rgba(0,212,255,0.4)' },
  FOG:          { bg: '#090910', border: '#12122a' },
  BOSS:         { bg: '#1a0028', border: '#cc44ff', shadow: 'inset 0 0 18px rgba(200,68,255,0.55), 0 0 22px rgba(200,68,255,0.5)' },
  PORTAL:       { bg: '#0d001e', border: '#a855f7', shadow: 'inset 0 0 16px rgba(168,85,247,0.5), 0 0 18px rgba(168,85,247,0.6)' },
  PLAYER:       { bg: '#001a00', border: '#00ff00', shadow: 'inset 0 0 16px rgba(0,255,0,0.45), 0 0 14px rgba(0,255,0,0.6)' },
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
    border:         `2px solid ${activated ? '#003333' : c.border}`,
    background:     activated ? '#000f0e' : c.bg,
    boxShadow:      activated ? 'none' : (c.shadow ?? 'none'),
    transition:     'box-shadow 0.25s ease, background 0.25s ease',
    userSelect:     'none',
    overflow:       'hidden',
    flexShrink:     0,
  };
}

// ── Tile content ───────────────────────────────────────────────────────────────
function CellContent({ tile, isPlayer }: { tile: Tile; isPlayer: boolean }) {
  const icon:  CSSProperties = { fontSize: 28, lineHeight: 1 };
  const lbl:   CSSProperties = {
    fontSize: 11, fontFamily: "'Courier New', monospace",
    lineHeight: 1.2, textAlign: 'center', padding: '0 3px',
  };

  if (isPlayer) return <span style={{ fontSize: 36 }}>👾</span>;

  switch (tile.type) {
    case 'MONSTER':
      return (
        <>
          <span style={icon}>💀</span>
          <span style={{ ...lbl, color: '#ff6666', fontWeight: 700, marginTop: 3, fontSize: 13 }}>
            Lv.{tile.level ?? '?'}
          </span>
        </>
      );
    case 'TRICKY_BUFF':
      return (
        <>
          <span style={icon}>⚡</span>
          <span style={{
            ...lbl,
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
          <span style={{ fontSize: tile.activated ? 18 : 22, lineHeight: 1 }}>
            {tile.activated ? '✓' : '🔀'}
          </span>
          {!tile.activated && tile.multiplierLabel && (
            <span style={{ ...lbl, color: '#ffd700', fontWeight: 700, fontSize: 14, marginTop: 2 }}>
              {tile.multiplierLabel}
            </span>
          )}
          <span style={{ ...lbl, color: tile.activated ? '#003333' : '#00d4ff', marginTop: 2, fontSize: 10 }}>
            {tile.label}
          </span>
        </>
      );
    case 'BOSS':
      return (
        <>
          <span style={{ fontSize: 30, lineHeight: 1 }}>👹</span>
          <span style={{ ...lbl, color: '#ff44ff', fontWeight: 700, marginTop: 2 }}>BOSS</span>
          <span style={{ ...lbl, color: '#cc44ff', marginTop: 1, fontSize: 13 }}>Lv.{tile.level ?? '?'}</span>
        </>
      );
    case 'PORTAL':
      return (
        <>
          <span style={{ fontSize: 30, lineHeight: 1 }}>🌀</span>
          <span style={{ ...lbl, color: '#a855f7', fontWeight: 700, marginTop: 2 }}>PORTAL</span>
        </>
      );
    case 'FOG':
      return <span style={{ fontSize: 24, color: '#14143a', letterSpacing: -2 }}>░░</span>;
    default:
      return null;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function LogEntry({ msg, idx }: { msg: string; idx: number }) {
  return (
    <div style={{
      padding:    '4px 8px',
      borderLeft: `2px solid ${idx === 0 ? '#00d4ff' : '#1e293b'}`,
      color:      idx === 0 ? '#e2e8f0' : '#64748b',
      fontSize:   10,
      fontFamily: "'Courier New', monospace",
      lineHeight: 1.5,
    }}>
      {msg}
    </div>
  );
}

function DpadBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={`Move ${label}`}
      style={{
        width: 40, height: 40,
        background: 'rgba(0,212,255,0.07)', border: '1px solid #00d4ff33',
        borderRadius: 6, color: '#00d4ff', fontSize: 16, cursor: 'pointer',
        fontFamily: "'Courier New', monospace",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.07)')}
    >
      {label}
    </button>
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
      padding: '10px 12px',
      fontSize: 10,
      fontFamily: "'Courier New', monospace",
      lineHeight: 1.8,
    }}>
      <p style={{ margin: '0 0 6px', color: accent, fontSize: 9, textTransform: 'uppercase', letterSpacing: 2 }}>
        ─ Oracle: {pathId === 'buff' ? '⚡ Buff' : '💀 Sac'} · Sala {roomIdx + 1}/{NUM_ROOMS} ─
      </p>
      <div style={{ color: '#64748b' }}>Ordem ótima:</div>
      <div style={{ color: '#e2e8f0', fontWeight: 700 }}>
        {result.optimalOrder.join(' → ')}
      </div>
      <div style={{ color: '#64748b', marginTop: 4 }}>{result.rationale}</div>
      <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
        {result.monsterLevels.map((lvl, i) => (
          <span key={i} style={{
            background: 'rgba(255,68,68,0.1)',
            border: '1px solid #ff444444',
            borderRadius: 4,
            padding: '2px 6px',
            color: '#ff8888',
            fontSize: 11,
            fontWeight: 700,
          }}>
            M{i + 1}={lvl}
          </span>
        ))}
        <span style={{
          background: 'rgba(255,215,0,0.1)',
          border: '1px solid #ffd70044',
          borderRadius: 4,
          padding: '2px 6px',
          color: '#ffd700',
          fontSize: 11,
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
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px',
      background: `${color}12`,
      border: `1px solid ${color}55`,
      borderRadius: 6,
      fontSize: 10,
      fontFamily: "'Courier New', monospace",
    }}>
      <span style={{ color, fontSize: 12 }}>{complete ? '✓' : active ? '…' : '○'}</span>
      <span style={{ color: complete ? '#00ff00' : active ? '#ffd700' : '#334155' }}>
        {label}
      </span>
      {active && !complete && (
        <span style={{ color: '#ffd700', fontSize: 9 }}>{roomProgress}/{NUM_ROOMS}</span>
      )}
      {complete && <span style={{ color: '#00ff00', fontSize: 9 }}>COMPLETA</span>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function LogicAscension() {
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

  // ── ProcGen room tracking ────────────────────────────────────────────────────
  // activeRoomIdx[pathId] = current room being played (undefined = not started)
  // oracleChain[pathId]   = oracle results per room, accumulated progressively
  const [activeRoomIdx, setActiveRoomIdx] = useState<Partial<Record<PathId, number>>>({});
  const [oracleChain,   setOracleChain]   = useState<Partial<Record<PathId, OracleResult[]>>>({});

  const [log, setLog] = useState<string[]>([
    '👾 Logic Ascension — Sprint 8 · ProcGen',
    '🗺️  Explore o corredor e entre nas Salas.',
    '⌨️  WASD ou setas para mover.',
  ]);

  // ── Stable refs (avoid stale closures in callbacks / effects) ────────────────
  const gridRef           = useRef(grid);
  const posRef            = useRef(playerPos);
  const powerRef          = useRef(playerPower);
  const combatRef         = useRef(combat);
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

  const addEntries = useCallback((entries: string[]) => {
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
      `🔓 Sala ${roomIdx + 1}/${NUM_ROOMS} revelada (${pathId === 'buff' ? '⚡' : '💀'})`,
      ...oracle.logLines,
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
        `🏆 Sala ${activeIdx + 1}/${NUM_ROOMS} concluída! (${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'})`,
      ]);

      if (activeIdx < NUM_ROOMS - 1) {
        setActiveRoomIdx(prev => ({ ...prev, [pathId]: activeIdx + 1 }));
        revealNextRoom(pathId, activeIdx + 1);
      } else {
        setCompletedRooms(prev => new Set([...prev, pathId]));
        addEntries([
          `🏆🏆 ${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'} — Todas ${NUM_ROOMS} Salas Concluídas!`,
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
      `💥 BOSS FINAL surgiu no corredor! Lv.${bossLvl}`,
      `📐 Oracle proj. máx (${NUM_ROOMS} salas): ${base} → Boss = 90% = ${bossLvl}`,
      `⚠️  Derrote o Boss para abrir o PORTAL!`,
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
    const entries: string[] = [];

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
      entries.push(`⚡ TrickyBuff! ${power} ${target.multiplierLabel} = ${newPower} poder`);
      newGrid = setTile(newGrid, nr, nc, { type: 'EMPTY' });
    }

    // ── MAJOR CHOICE (first visit only) ──────────────────────────────────
    if (target.type === 'MAJOR_CHOICE' && !target.activated) {
      const pathId = target.pathId!;
      const mcMult = target.multiplier ?? 1;

      // Task 1: Apply MC multiplier IMMEDIATELY
      newPower = Math.round(newPower * mcMult);
      entries.push(
        `${pathId === 'buff' ? '⚡' : '💀'} Escolha! ${power} ${target.multiplierLabel ?? ''} → ${newPower} poder`
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

      entries.push(`🔓 Sala 1/${NUM_ROOMS} revelada (${pathId === 'buff' ? '⚡ Buff' : '💀 Sac'})`);
      entries.push(...oracle0.logLines);

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

      const question = getRandomQuestion();
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
      addEntries([logLine]);
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
        `${logPrefix} Boss derrotado! +${c.monsterLevel} poder. Total: ${newPower}`,
        '🌀 PORTAL aberto! Retorne para vencer!',
      ]);
    };

    if (c.isImpossibleMode) {
      setGamePhase('gameover');
      setGameOverReason(
        `⚠️ DIFERENÇA DE PODER ABSURDA! O monstro (Lv.${c.monsterLevel}) te esmagou! ` +
        `Poder: ${c.powerSnapshot} (mín. necessário: ${Math.ceil(c.monsterLevel / 2)})`
      );
      return;
    }

    // Persist the explanation for the Knowledge Box (all non-impossible combats answered a question)
    setLastExplanation({ text: c.question.explanation, isCorrect: correct });

    if (c.isDesperationMode) {
      if (correct) {
        const absorbed = Math.round(c.monsterLevel * 0.5);
        const newPower = c.powerSnapshot + absorbed;
        if (c.isBoss) spawnPortal(newPower, '🔥 Milagre Desesperado!');
        else resolveKill(newPower, `🔥 Milagre! +${absorbed} poder (50% desespero). Total: ${newPower}`);
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
        `Poder chegou a ${newPower}. Resposta: ${c.question.correctAnswer}. ${c.question.explanation}`
      );
      return;
    }
    resolveKill(
      newPower,
      correct
        ? `✅ Correto! +${delta} poder. Total: ${newPower}`
        : `❌ Errado! ${delta} poder (dano). Total: ${newPower}`
    );
  }, [addEntries]);

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
    setLog(['🔄 Reiniciado do zero.', '👾 Logic Ascension — Nível 1', '🗺️  Explore o corredor e entre nas Salas.']);
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
      `🆕 Avançando para o próximo nível! Poder herdado: ${powerRef.current}`,
      '🗺️  Novo mapa — explore e entre nas Salas.',
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
            position:     'relative',
            width:        VIEWPORT_W,
            height:       VIEWPORT_H,
            overflow:     'hidden',
            background:   '#0a0a14',
            border:       '2px solid #1e293b',
            borderRadius: 8,
            boxShadow:    '0 0 40px rgba(0,0,0,0.8)',
          }}>

            {/* Camera layer — translate3d tracks the player */}
            <div style={{
              position:   'absolute',
              top:        0,
              left:       0,
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
          </div>

          {/* ── Controls ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, width: VIEWPORT_W }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <DpadBtn label="↑" onClick={() => move('UP')} />
              <div style={{ display: 'flex', gap: 3 }}>
                <DpadBtn label="←" onClick={() => move('LEFT')} />
                <DpadBtn label="↓" onClick={() => move('DOWN')} />
                <DpadBtn label="→" onClick={() => move('RIGHT')} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[
                ['👾','Jogador'], ['🔀','Escolha (garfo)'], ['⚡','TrickyBuff'],
                ['💀','Monstro'], ['░░','Névoa'], ['👹','Boss Final'], ['🌀','Portal'],
              ].map(([ic, d]) => (
                <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#475569', fontFamily: "'Courier New', monospace" }}>
                  <span>{ic}</span><span>{d}</span>
                </span>
              ))}
            </div>

            <button onClick={resetGame}
              style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: "'Courier New', monospace", fontSize: 11, transition: 'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ↺ Novo Mapa
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 260, minWidth: 220, flexShrink: 0 }}>

          {/* Player stats */}
          <div>
            <p style={{ margin: '0 0 8px', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 2 }}>
              — Status —
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatBadge label="Poder" value={playerPower} color="#00ff00" />
              <StatBadge label="Posição" value={`${playerPos.row},${playerPos.col}`} color="#00d4ff" />
            </div>
          </div>

          {/* Room completion status */}
          <div>
            <p style={{ margin: '0 0 6px', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 2 }}>
              — Salas de Puzzle ({NUM_ROOMS} por caminho) —
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
          </div>

          {/* Boss status */}
          {bossSpawned && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              background: gamePhase === 'victory' ? 'rgba(168,85,247,0.1)' : 'rgba(200,68,255,0.08)',
              border: `1px solid ${gamePhase === 'victory' ? '#a855f7' : '#cc44ff'}55`,
              borderRadius: 8,
              fontSize: 10,
              fontFamily: "'Courier New', monospace",
            }}>
              <span style={{ fontSize: 16 }}>{gamePhase === 'victory' ? '🏆' : '👹'}</span>
              <div>
                <div style={{ color: gamePhase === 'victory' ? '#a855f7' : '#cc44ff', fontWeight: 700 }}>
                  {gamePhase === 'victory' ? 'Boss Derrotado!' : 'Boss Final — Ativo!'}
                </div>
                <div style={{ color: '#475569', fontSize: 9 }}>
                  {gamePhase === 'victory'
                    ? 'Portal aberto ✓'
                    : `Lv. ${bossLevel ?? '—'} · Derrote para vencer`}
                </div>
              </div>
            </div>
          )}

          {/* Oracle panels (shown once a path is activated) */}
          {paths.map(pathId => {
            const entry = currentOracles[pathId];
            if (!entry) return null;
            return (
              <OraclePanel
                key={pathId}
                result={entry.result}
                pathId={pathId}
                roomIdx={entry.roomIdx}
              />
            );
          })}

          {/* Oracle placeholder before any activation */}
          {Object.keys(currentOracles).length === 0 && (
            <div style={{
              background: 'rgba(0,212,255,0.03)',
              border: '1px solid #1e3a4a',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 10,
              fontFamily: "'Courier New', monospace",
              color: '#475569',
              lineHeight: 1.8,
            }}>
              <p style={{ margin: '0 0 6px', color: '#00d4ff88', fontSize: 9, textTransform: 'uppercase', letterSpacing: 2 }}>
                — Oracle (inativo) —
              </p>
              <div>Entre em uma sala para ativar o Oracle e revelar a ordem ótima.</div>
            </div>
          )}

          {/* Event log */}
          <div style={{ background: '#0a0c14', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', flexGrow: 1 }}>
            <div style={{ padding: '7px 10px', background: '#0d1117', borderBottom: '1px solid #1e293b', fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 2 }}>
              — Log de Eventos —
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 0' }}>
              {log.map((msg, i) => <LogEntry key={i} msg={msg} idx={i} />)}
            </div>
          </div>

          {/* ── Knowledge Box ─────────────────────────────────────────────────────── */}
          {/* Always rendered so the sidebar doesn't jump when an explanation arrives. */}
          <div style={{
            background:   lastExplanation
              ? (lastExplanation.isCorrect ? 'rgba(0,60,0,0.18)' : 'rgba(60,15,0,0.22)')
              : 'rgba(8,10,20,0.5)',
            border:       `1px solid ${
              lastExplanation
                ? (lastExplanation.isCorrect ? '#00cc5566' : '#ff660055')
                : '#1e293b'
            }`,
            borderRadius: 8,
            overflow:     'hidden',
            transition:   'background 0.5s ease, border-color 0.5s ease',
          }}>
            {/* Header bar */}
            <div style={{
              display:       'flex',
              alignItems:    'center',
              gap:           6,
              padding:       '6px 10px',
              background:    lastExplanation
                ? (lastExplanation.isCorrect ? 'rgba(0,80,0,0.25)' : 'rgba(80,20,0,0.30)')
                : 'rgba(15,20,35,0.6)',
              borderBottom:  `1px solid ${
                lastExplanation
                  ? (lastExplanation.isCorrect ? '#00cc5533' : '#ff660033')
                  : '#1e293b'
              }`,
              transition:    'background 0.5s ease',
            }}>
              <span style={{ fontSize: 12 }}>
                {lastExplanation ? (lastExplanation.isCorrect ? '✅' : '❌') : '🧠'}
              </span>
              <span style={{
                fontSize:      9,
                fontFamily:    "'Courier New', monospace",
                textTransform: 'uppercase',
                letterSpacing: 2,
                color:         lastExplanation
                  ? (lastExplanation.isCorrect ? '#00cc5599' : '#ff884499')
                  : '#334155',
              }}>
                — Caixa de Conhecimento —
              </span>
            </div>

            {/* Body — min-height reserved for future long explanations / AI content */}
            <div style={{
              padding:   '10px 12px',
              minHeight: 100,
            }}>
              <p style={{
                margin:     0,
                fontSize:   11,
                fontFamily: "'Courier New', monospace",
                color:      lastExplanation ? '#94a3b8' : '#334155',
                lineHeight: 1.75,
                whiteSpace: 'pre-wrap',
                transition: 'color 0.3s ease',
              }}>
                {lastExplanation
                  ? lastExplanation.text
                  : 'A explicação da última questão de matemática aparecerá aqui após cada combate.'}
              </p>
            </div>
          </div>

        </div>
      </div>

      <p style={{ margin: 0, fontSize: 10, color: '#334155', letterSpacing: 1 }}>
        ⌨  WASD ou Setas · Limpe as {NUM_ROOMS} Salas de cada caminho · Derrote o Boss · Entre no Portal
      </p>

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
            maxWidth: 460, width: '100%',
            background: 'linear-gradient(160deg, #0a0020 0%, #050015 100%)',
            border: '2px solid #a855f7',
            borderRadius: 16, padding: '36px 32px',
            boxShadow: '0 0 80px rgba(168,85,247,0.4), 0 0 30px rgba(168,85,247,0.2)',
            textAlign: 'center', fontFamily: "'Courier New', monospace",
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#a855f7', letterSpacing: 4, textTransform: 'uppercase' }}>
              Parabéns, Lógico!
            </p>
            <h2 style={{ margin: '0 0 20px', fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
              VITÓRIA!
            </h2>
            <div style={{
              background: 'rgba(168,85,247,0.08)', border: '1px solid #a855f744',
              borderRadius: 10, padding: '14px 20px', marginBottom: 24,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
                Nível {currentStage} · Poder Final
              </p>
              <span style={{ fontSize: 40, fontWeight: 900, color: '#a855f7' }}>{playerPower}</span>
              <p style={{ margin: '8px 0 0', fontSize: 10, color: '#475569' }}>
                Salas concluídas: {completedRooms.size} × {NUM_ROOMS} · Boss derrotado ✓
              </p>
            </div>
            <p style={{ margin: '0 0 24px', fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
              Você dominou a Ordem das Operações, seguiu o Oracle e<br />
              derrotou o Boss do Nível {currentStage}. A Ascensão continua…
            </p>

            {/* Primary: carry-over power to next level */}
            <button onClick={advanceLevel} style={{
              display: 'block', width: '100%',
              background: 'rgba(255,215,0,0.15)', border: '2px solid #ffd700',
              color: '#ffd700', padding: '14px 32px', borderRadius: 8, marginBottom: 10,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 14, fontWeight: 900, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,215,0,0.15)')}
            >
              ⚔️ Avançar para o Nível {currentStage + 1}
            </button>

            {/* Secondary: hard reset */}
            <button onClick={resetGame} style={{
              display: 'block', width: '100%',
              background: 'transparent', border: '1px solid #475569',
              color: '#64748b', padding: '10px 32px', borderRadius: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 11, letterSpacing: 1, transition: 'background 0.2s, color 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.15)'; e.currentTarget.style.color = '#94a3b8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            >
              ↺ Reiniciar do Zero (Poder: 10)
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
            maxWidth: 460, width: '100%',
            background: 'linear-gradient(160deg, #1a0000 0%, #0a0000 100%)',
            border: '2px solid #ff2222',
            borderRadius: 16, padding: '36px 32px',
            boxShadow: '0 0 80px rgba(255,34,34,0.4), 0 0 30px rgba(255,34,34,0.2)',
            textAlign: 'center', fontFamily: "'Courier New', monospace",
          }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>💀</div>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#ff4444', letterSpacing: 4, textTransform: 'uppercase' }}>
              Derrota
            </p>
            <h2 style={{ margin: '0 0 20px', fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: 2 }}>
              GAME OVER
            </h2>
            <div style={{
              background: 'rgba(255,34,34,0.06)', border: '1px solid #ff222244',
              borderRadius: 10, padding: '14px 20px', marginBottom: 20,
            }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 2 }}>
                Poder ao morrer
              </p>
              <span style={{ fontSize: 40, fontWeight: 900, color: '#ff4444' }}>{playerPower}</span>
            </div>
            {gameOverReason && (
              <p style={{
                margin: '0 0 24px', fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
                background: 'rgba(255,68,68,0.05)', border: '1px solid #ff44441a',
                borderRadius: 8, padding: '10px 14px',
              }}>
                {gameOverReason}
              </p>
            )}
            <button onClick={resetGame} style={{
              background: 'rgba(255,68,68,0.12)', border: '2px solid #ff4444',
              color: '#ff4444', padding: '12px 32px', borderRadius: 8,
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              fontSize: 13, fontWeight: 700, letterSpacing: 1, transition: 'background 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.12)')}
            >
              ↺ Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

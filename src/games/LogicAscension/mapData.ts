import { Tile, PathId } from './types';

// ── Grid dimensions ────────────────────────────────────────────────────────────
export const GRID_ROWS = 15;
export const GRID_COLS = 25;
export const NUM_ROOMS = 5;

// ── Fixed layout positions (never change, regardless of ProcGen) ───────────────
/**
 * 25 × 15 layout (row × col, 0-indexed):
 *
 *  Row  0 : full WALL border
 *  Rows 1-5 : BUFF ZONE   (top half)     ← buff rooms carved here
 *  Row  3 : buff SPINE  (horizontal corridor connecting all 5 buff rooms)
 *  Row  6 : col-3 bridge (EMPTY)  → MC_B at (5,3)
 *  Row  7 : main corridor  P(7,1)  B×2(7,2)  jct(7,3)
 *  Row  8 : col-3 bridge (EMPTY)  → MC_S at (9,3)
 *  Rows 9-13 : SAC ZONE   (bottom half)  ← sac  rooms carved here
 *  Row 11 : sac  SPINE
 *  Row 14 : full WALL border
 *  Cols 0, 24 : left/right WALL borders
 *  Cols 1-3   : start zone
 *  Cols 4-23  : 5 chunks × 4 cols each  (rooms + spine sections)
 *
 *  MC tiles are fixed:
 *    MC_B at (5,3)  – connects via (4,3),(3,3) [FOG] to buff spine
 *    MC_S at (9,3)  – connects via (10,3),(11,3) [FOG] to sac spine
 *
 *  Boss spawns at (7,3) after both paths cleared.
 *  Portal spawns at (7,1) after boss is defeated.
 */
export const PLAYER_START = { row: 7, col: 1 } as const;
export const BOSS_SPAWN   = { row: 7, col: 3 } as const;
export const PORTAL_SPAWN = { row: 7, col: 1 } as const;

export const MAJOR_CHOICE_POS: Record<PathId, { row: number; col: number }> = {
  buff:      { row: 5, col: 3 },
  sacrifice: { row: 9, col: 3 },
};

// ── Internal layout constants ──────────────────────────────────────────────────
const BUFF_SPINE_ROW  = 3;
const SAC_SPINE_ROW   = 11;
const BUFF_ROW_MIN    = 1;
const BUFF_ROW_MAX    = 5;
const SAC_ROW_MIN     = 9;
const SAC_ROW_MAX     = 13;
const CHUNK_START_COL = 4;   // chunks start here
const CHUNK_COLS      = 4;   // cols per chunk → 5 chunks × 4 = cols 4-23

/** Mild buff multipliers for rooms 1-4 (room 0 uses MC punishment/reward). */
const ROOM_BUFF_POOL = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

// ── ProcGen data types ─────────────────────────────────────────────────────────
export interface RoomData {
  pathId:   PathId;
  index:    number;       // 0 – NUM_ROOMS-1
  /**
   * All carved floor tiles (minimum 9 from a 3×3 room).
   * Entities occupy the 4 corner anchor points; remaining tiles form the
   * safe hub that guarantees free pathing through the room.
   */
  floorTiles:       { row: number; col: number }[];
  /** Indices match OracleResult.monsterLevels exactly. */
  monsterPositions: [
    { row: number; col: number },
    { row: number; col: number },
    { row: number; col: number },
  ];
  buffPosition: { row: number; col: number };
  /**
   * Room 0  : placeholder 1.0 — overridden at reveal time by Oracle.
   * Rooms 1-4 : randomly drawn from ROOM_BUFF_POOL at map generation.
   */
  buffMultiplier: number;
  /**
   * Tiles (all starting as FOG) revealed when this room becomes accessible.
   * Room 0  : MC-to-spine connector  +  chunk-0 spine section.
   * Rooms 1-4 : chunk-k spine section only (MC connector not needed again).
   */
  accessTiles: { row: number; col: number }[];
}

export interface GeneratedMap {
  grid:  Tile[][];
  rooms: Record<PathId, RoomData[]>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Procedural map generation ──────────────────────────────────────────────────
export function generateRandomMap(): GeneratedMap {
  // Full WALL grid
  const grid: Tile[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => ({ type: 'WALL' } as Tile))
  );

  // ── Fixed start zone (always visible, not covered by FOG) ──────────────────
  grid[7][1] = { type: 'EMPTY' };
  grid[7][2] = { type: 'TRICKY_BUFF', multiplier: 2, multiplierLabel: '×2' };
  grid[7][3] = { type: 'EMPTY' };   // junction / future boss spawn
  grid[6][3] = { type: 'EMPTY' };   // buff bridge
  grid[5][3] = {
    type: 'MAJOR_CHOICE', label: '⚡ The Buff',
    pathId: 'buff', multiplier: 2, multiplierLabel: '×2',
  };
  grid[8][3] = { type: 'EMPTY' };   // sac bridge
  grid[9][3] = {
    type: 'MAJOR_CHOICE', label: '💀 Sacrifício',
    pathId: 'sacrifice', multiplier: 0.5, multiplierLabel: '×½',
  };

  const rooms: Record<PathId, RoomData[]> = { buff: [], sacrifice: [] };

  // Per-path configuration
  const pathCfgs = [
    {
      pathId:      'buff'     as PathId,
      rowMin:      BUFF_ROW_MIN,
      rowMax:      BUFF_ROW_MAX,
      spineRow:    BUFF_SPINE_ROW,
      // FOG tiles bridging MC_B (row 5) → buff spine (row 3)
      mcConnector: [{ row: 4, col: 3 }, { row: 3, col: 3 }] as const,
    },
    {
      pathId:      'sacrifice' as PathId,
      rowMin:      SAC_ROW_MIN,
      rowMax:      SAC_ROW_MAX,
      spineRow:    SAC_SPINE_ROW,
      // FOG tiles bridging MC_S (row 9) → sac spine (row 11)
      mcConnector: [{ row: 10, col: 3 }, { row: 11, col: 3 }] as const,
    },
  ] as const;

  for (const { pathId, rowMin, rowMax, spineRow, mcConnector } of pathCfgs) {
    for (let k = 0; k < NUM_ROOMS; k++) {
      const chunkStart = CHUNK_START_COL + k * CHUNK_COLS;

      // Room dimensions — 3×3 minimum guarantees 4 corner anchors + safe hub
      const roomH = randInt(3, 4);                                // rows
      const roomW = randInt(3, 4);                                // cols

      const roomRowStart = randInt(rowMin, rowMax - roomH + 1);   // fits in zone
      const roomColStart = randInt(chunkStart, chunkStart + CHUNK_COLS - roomW);

      // ── Carve room as FOG ─────────────────────────────────────────────────
      const floorTiles: { row: number; col: number }[] = [];
      for (let r = roomRowStart; r < roomRowStart + roomH; r++) {
        for (let c = roomColStart; c < roomColStart + roomW; c++) {
          grid[r][c] = { type: 'FOG' };
          floorTiles.push({ row: r, col: c });
        }
      }

      // ── Carve chunk spine section as FOG ──────────────────────────────────
      // The spine row (3 for buff, 11 for sac) is guaranteed to be within or
      // directly adjacent to every room placed in the zone, so no vertical
      // connector tiles are ever required.
      const spineTiles: { row: number; col: number }[] = [];
      for (let c = chunkStart; c < chunkStart + CHUNK_COLS; c++) {
        grid[spineRow][c] = { type: 'FOG' };
        spineTiles.push({ row: spineRow, col: c });
      }

      // ── Access tiles ──────────────────────────────────────────────────────
      const accessTiles: { row: number; col: number }[] = [];
      if (k === 0) {
        for (const t of mcConnector) {
          grid[t.row][t.col] = { type: 'FOG' };
          accessTiles.push({ row: t.row, col: t.col });
        }
      }
      accessTiles.push(...spineTiles);

      // ── Corner-Anchor entity placement ────────────────────────────────────
      //
      // Entities always occupy the 4 extreme corners of the room rectangle.
      // This guarantees that the spine corridor (spineRow) and the centre
      // of the room remain completely clear, giving the player a safe hub
      // from which they can freely choose any corner to engage next.
      //
      // Anti-softlock rule: if a raw corner lands exactly on spineRow (the
      // entrance/exit lane) it is shifted 1 tile inward so the doorway is
      // never blocked.  With roomH ≥ 3 the shifted tile is always valid.
      const rEnd = roomRowStart + roomH - 1;
      const cEnd = roomColStart + roomW - 1;

      const rawCorners = [
        { row: roomRowStart, col: roomColStart },   // Top-Left
        { row: roomRowStart, col: cEnd         },   // Top-Right
        { row: rEnd,         col: roomColStart },   // Bottom-Left
        { row: rEnd,         col: cEnd         },   // Bottom-Right
      ];

      const safeAnchors = rawCorners.map(({ row, col }) => {
        if (row !== spineRow) return { row, col };
        // Doorway tile — step one row inward, away from the room edge
        return { row: row === roomRowStart ? row + 1 : row - 1, col };
      });

      const shuffledAnchors = shuffle(safeAnchors);
      const monsterPositions = [
        shuffledAnchors[0],
        shuffledAnchors[1],
        shuffledAnchors[2],
      ] as [
        { row: number; col: number },
        { row: number; col: number },
        { row: number; col: number },
      ];
      const buffPosition = shuffledAnchors[3];

      const buffMultiplier =
        k === 0
          ? 1.0  // placeholder for Room 0 — Oracle determines real value
          : ROOM_BUFF_POOL[randInt(0, ROOM_BUFF_POOL.length - 1)];

      rooms[pathId].push({
        pathId,
        index: k,
        floorTiles,
        monsterPositions,
        buffPosition,
        buffMultiplier,
        accessTiles,
      });
    }
  }

  return { grid, rooms };
}

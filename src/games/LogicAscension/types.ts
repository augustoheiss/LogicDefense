export type TileType =
  | 'EMPTY'
  | 'WALL'
  | 'MONSTER'
  | 'TRICKY_BUFF'
  | 'MAJOR_CHOICE'
  | 'FOG'
  | 'BOSS'
  | 'PORTAL';

export type PathId = 'buff' | 'sacrifice';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

/** What a FOG tile is concealing until the path is revealed. */
export interface HiddenContent {
  type: 'EMPTY' | 'TRICKY_BUFF' | 'MONSTER';
  multiplier?: number;
  multiplierLabel?: string;
}

export interface Tile {
  type: TileType;
  /** TRICKY_BUFF / MAJOR_CHOICE – the power multiplier applied on step. */
  multiplier?: number;
  multiplierLabel?: string;
  /** MONSTER / BOSS – level set dynamically by the Math Engine at fog-lift time. */
  level?: number;
  /** MAJOR_CHOICE – display label shown on the tile. */
  label?: string;
  /** MAJOR_CHOICE – which branch this choice opens. */
  pathId?: PathId;
  /** MAJOR_CHOICE – true after the player has already triggered this tile. */
  activated?: boolean;
  /** FOG – what is hidden underneath. */
  hidden?: HiddenContent;
  /**
   * TRICKY_BUFF – set to 'punish' or 'reward' immediately after fog reveal so the
   * cell renders a one-shot CSS animation, then cleared back to undefined.
   */
  animationType?: 'punish' | 'reward';
}

export interface PlayerPos {
  row: number;
  col: number;
}

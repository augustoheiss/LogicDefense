/**
 * Sekundo — Skeleton Type Definitions
 *
 * The infinite-depth addressing system. Path keys are hyphen-separated
 * numeric strings that create any hierarchy without code changes.
 *
 * Examples:
 *   "01-01-01"       → Event group 1, event 1, role 1
 *   "03-01"          → Territory category 3, territory 1
 *   "001-002-001-01" → Annual event 1, day 2, session 1, sub-task 1
 */

// ---------------------------------------------------------------------------
// Path Key
// ---------------------------------------------------------------------------

/**
 * A path key is a hyphen-separated string of numeric segments.
 * Each segment is digit-width agnostic: "01", "001", and "1" all equal index 1.
 */
export type PathKey = string;

/**
 * Parsed representation of a PathKey as an array of integers.
 * Used for comparison, sorting, and tree construction.
 */
export type ParsedKey = number[];

// ---------------------------------------------------------------------------
// Skeleton Node
// ---------------------------------------------------------------------------

/** The type of content a skeleton node represents. */
export type NodeType = 'slot' | 'territory' | 'header' | 'note';

/**
 * A single node in the skeleton tree.
 * Flat storage uses only `key`, `type`, `label`, `value`, `email`, `meta`.
 * The `children` array is computed at runtime from key depth relationships.
 */
export interface SkeletonNode {
  /** The unique path key address (e.g., "01-01-01"). */
  key: PathKey;

  /** What kind of node this is. */
  type: NodeType;

  /** Human-readable name (e.g., "Presidente", "Quadra Norte"). */
  label: string;

  /** Assigned person, data, or status. Empty string = unassigned. */
  value: string;

  /** Email address for notification dispatch. */
  email: string;

  /**
   * Arbitrary metadata as a key-value record.
   * Examples: { sala: "Principal" }, { ruas: ["Rua X", "Rua Y"] }
   */
  meta: Record<string, unknown>;

  /**
   * Child nodes (computed at runtime, not stored in CSV/JSON).
   * A child's key starts with this node's key prefix and has exactly
   * one additional segment.
   */
  children: SkeletonNode[];
}

// ---------------------------------------------------------------------------
// Flat Registry (Storage Format)
// ---------------------------------------------------------------------------

/**
 * A flat record of skeleton nodes indexed by their path key.
 * This is the canonical storage format in localStorage and CSV.
 */
export interface FlatSkeletonEntry {
  key: PathKey;
  type: NodeType;
  label: string;
  value: string;
  email: string;
  meta: Record<string, unknown>;
}

/**
 * The flat registry is a simple array of entries.
 * Order is determined by path key sorting, not array index.
 */
export type FlatRegistry = FlatSkeletonEntry[];

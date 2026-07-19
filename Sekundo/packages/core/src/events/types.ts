/**
 * Sekundo — Event Type Definitions
 *
 * Events are containers that hold one or more skeleton templates.
 * They define the temporal rhythm (weekly, monthly, annual, one-time)
 * and control the auto-rollover lifecycle.
 */

import type { PathKey } from '../skeleton/types';

// ---------------------------------------------------------------------------
// Frequency
// ---------------------------------------------------------------------------

/** How often the event repeats. */
export type Frequency = 'once' | 'weekly' | 'monthly' | 'annual';

// ---------------------------------------------------------------------------
// Event Configuration
// ---------------------------------------------------------------------------

/**
 * The configuration of a single event container.
 * An event can hold multiple skeletons simultaneously
 * (e.g., "Meio de Semana" + "Fim de Semana" + "Territórios").
 */
export interface EventConfig {
  /** Unique identifier (UUID v4). */
  id: string;

  /** Human-readable event name. */
  name: string;

  /** Recurrence pattern. */
  frequency: Frequency;

  /** ISO 8601 date string for the start. */
  startDate: string;

  /** ISO 8601 date string for the end (optional for recurring events). */
  endDate?: string;

  /** Root path keys of all skeletons contained in this event. */
  skeletonRoots: PathKey[];

  /** Whether auto-rollover is enabled. */
  autoRollover: boolean;

  /** ISO 8601 date of the last completed rollover. */
  lastRolloverDate?: string;

  /** Creation timestamp (ISO 8601). */
  createdAt: string;

  /** Last modification timestamp (ISO 8601). */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Event State (Runtime)
// ---------------------------------------------------------------------------

/** The current lifecycle state of an event. */
export type EventLifecycle = 'active' | 'archived' | 'draft';

/**
 * Full runtime state of an event, including its archived history.
 * This is what gets serialized to localStorage.
 */
export interface EventState {
  /** The event configuration. */
  config: EventConfig;

  /** Current lifecycle state. */
  lifecycle: EventLifecycle;

  /**
   * Archive of past rollover snapshots.
   * Each entry is a frozen copy of the skeleton values at that point in time.
   * Indexed by ISO date string of the rollover date.
   */
  archive: RolloverSnapshot[];
}

/**
 * A frozen snapshot of skeleton values at a specific rollover point.
 */
export interface RolloverSnapshot {
  /** The date this snapshot was created (ISO 8601). */
  date: string;

  /** Frozen key-value pairs: PathKey → assigned value at that time. */
  values: Record<PathKey, string>;
}

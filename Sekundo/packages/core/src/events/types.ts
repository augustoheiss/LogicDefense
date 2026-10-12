/**
 * Sekundo — Event Type Definitions
 *
 * Events are containers that hold one or more skeleton templates.
 * They define the temporal rhythm (weekly, monthly, annual, one-time)
 * and control the auto-rollover lifecycle.
 */

import type { PathKey } from '../skeleton/types';
import type { EngineId } from '../engines/types';

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

  /**
   * The active Universal Law/Engine governing this event.
   * e.g., 'territory_logistics', 'roster_assignments', 'study_synthesis', 'generic_wbs'
   */
  engineId?: EngineId;

  /**
   * Multi-Engine support: allows an event to activate multiple engines simultaneously
   * (e.g. ['territory_logistics', 'roster_assignments'] for an event managing both field territories and volunteers).
   */
  activeEngines?: EngineId[];
}

/**
 * Returns all active engines for an event configuration.
 * Preserves backward compatibility if only single engineId is specified.
 */
export function getActiveEngines(
  config?: Pick<EventConfig, 'engineId' | 'activeEngines'> | null
): EngineId[] {
  if (!config) return ['generic_wbs'];
  if (config.activeEngines && config.activeEngines.length > 0) {
    const unique = Array.from(new Set(config.activeEngines));
    return unique.length > 0 ? unique : ['generic_wbs'];
  }
  if (config.engineId) {
    return [config.engineId];
  }
  return ['generic_wbs'];
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

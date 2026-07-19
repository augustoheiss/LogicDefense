/**
 * Sekundo — Auto-Rollover Engine
 *
 * Gap-aware rollover that computes ALL missed periods sequentially.
 * If the app stays closed for 3 weeks (weekly event), it processes
 * 3 rollovers in sequence: freeze → archive → clear → advance.
 *
 * Design decision: The engine NEVER drops data. Every missed period
 * gets its own archive snapshot before the skeleton is cleared.
 */

import type {
  EventConfig,
  EventState,
  Frequency,
  RolloverSnapshot,
} from './types';
import type { FlatRegistry, PathKey } from '../skeleton/types';

// ---------------------------------------------------------------------------
// Period Calculation
// ---------------------------------------------------------------------------

/** Milliseconds in common time units. */
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Calculate the next rollover date from a given date based on frequency.
 *
 * @param fromDate - ISO date string of the last rollover.
 * @param frequency - Event frequency.
 * @returns ISO date string of the next rollover.
 */
export function nextRolloverDate(
  fromDate: string,
  frequency: Frequency
): string | null {
  if (frequency === 'once') return null;

  const date = new Date(fromDate);

  switch (frequency) {
    case 'weekly':
      date.setTime(date.getTime() + MS_PER_WEEK);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}

/**
 * Calculate how many rollover periods have been missed between
 * the last rollover date and the current date.
 *
 * @param lastRollover - ISO date string of the last completed rollover.
 * @param now - Current ISO date string.
 * @param frequency - Event frequency.
 * @returns Number of missed periods (0 if none).
 */
export function missedPeriods(
  lastRollover: string,
  now: string,
  frequency: Frequency
): number {
  if (frequency === 'once') return 0;

  const lastDate = new Date(lastRollover);
  const nowDate = new Date(now);
  const diffMs = nowDate.getTime() - lastDate.getTime();

  if (diffMs <= 0) return 0;

  switch (frequency) {
    case 'weekly':
      return Math.floor(diffMs / MS_PER_WEEK);
    case 'monthly': {
      // Calculate months between dates
      const monthDiff =
        (nowDate.getFullYear() - lastDate.getFullYear()) * 12 +
        (nowDate.getMonth() - lastDate.getMonth());
      return Math.max(0, monthDiff);
    }
    case 'annual': {
      const yearDiff = nowDate.getFullYear() - lastDate.getFullYear();
      return Math.max(0, yearDiff);
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Snapshot Creation
// ---------------------------------------------------------------------------

/**
 * Create a rollover snapshot from the current skeleton values.
 * Captures only keys that have assigned values (non-empty).
 *
 * @param skeleton - The current flat skeleton registry.
 * @param date - The date of this snapshot.
 * @returns A RolloverSnapshot ready for the archive.
 */
export function createSnapshot(
  skeleton: FlatRegistry,
  date: string
): RolloverSnapshot {
  const values: Record<PathKey, string> = {};

  for (const entry of skeleton) {
    if (entry.value && entry.value.trim() !== '') {
      values[entry.key] = entry.value;
    }
  }

  return { date, values };
}

/**
 * Clear all assigned values from the skeleton.
 * Preserves structure (keys, types, labels, meta) but blanks out values and emails.
 *
 * @param skeleton - The current flat skeleton registry.
 * @returns A new skeleton with all values cleared.
 */
export function clearValues(skeleton: FlatRegistry): FlatRegistry {
  return skeleton.map((entry) => ({
    ...entry,
    value: '',
    email: '',
  }));
}

// ---------------------------------------------------------------------------
// Rollover Execution
// ---------------------------------------------------------------------------

/**
 * Execute all pending rollovers for an event.
 * This is the main entry point called when the app opens.
 *
 * Algorithm:
 * 1. Calculate missed periods between lastRolloverDate and now.
 * 2. For each missed period (chronologically):
 *    a. Freeze current skeleton values → push to archive.
 *    b. Clear all values in the active skeleton.
 *    c. Advance the date pointer.
 * 3. Return the updated state and skeleton.
 *
 * @param state - Current event state from localStorage.
 * @param skeleton - Current active skeleton.
 * @param now - Current date (ISO string, defaults to today).
 * @returns Updated state and skeleton, or null if no rollover needed.
 */
export function executeRollover(
  state: EventState,
  skeleton: FlatRegistry,
  now?: string
): { state: EventState; skeleton: FlatRegistry } | null {
  const { config } = state;

  if (!config.autoRollover || config.frequency === 'once') {
    return null;
  }

  const currentDate = now ?? new Date().toISOString().split('T')[0];
  const lastRollover = config.lastRolloverDate ?? config.startDate;

  const missed = missedPeriods(lastRollover, currentDate, config.frequency);

  if (missed === 0) {
    return null;
  }

  // Process each missed period sequentially
  let currentSkeleton = skeleton;
  const newArchive = [...state.archive];
  let rolloverDate = lastRollover;

  for (let i = 0; i < missed; i++) {
    // Calculate the date for this rollover
    const nextDate = nextRolloverDate(rolloverDate, config.frequency);
    if (!nextDate) break;

    // Freeze current values into a snapshot
    const snapshot = createSnapshot(currentSkeleton, nextDate);
    newArchive.push(snapshot);

    // Clear the skeleton for the next period
    currentSkeleton = clearValues(currentSkeleton);

    // Advance the date pointer
    rolloverDate = nextDate;
  }

  // Build the updated state
  const updatedState: EventState = {
    ...state,
    config: {
      ...config,
      lastRolloverDate: rolloverDate,
      updatedAt: new Date().toISOString(),
    },
    archive: newArchive,
  };

  return {
    state: updatedState,
    skeleton: currentSkeleton,
  };
}

/**
 * Sekundo — Event Container
 *
 * CRUD operations for event configurations.
 * Events are stored in localStorage as EventState objects.
 */

import type { EventConfig, EventState, Frequency } from './types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new event configuration with sensible defaults.
 *
 * @param name - Human-readable event name.
 * @param frequency - Recurrence pattern.
 * @param skeletonRoots - Root path keys for contained skeletons.
 * @returns A new EventConfig ready for storage.
 */
export function createEvent(
  name: string,
  frequency: Frequency,
  skeletonRoots: string[] = []
): EventConfig {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    name,
    frequency,
    startDate: now.split('T')[0], // YYYY-MM-DD
    skeletonRoots,
    autoRollover: frequency !== 'once',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create a full EventState wrapper from a config.
 */
export function createEventState(config: EventConfig): EventState {
  return {
    config,
    lifecycle: 'draft',
    archive: [],
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update an existing event configuration.
 * Preserves id, createdAt, and archive history.
 */
export function updateEvent(
  state: EventState,
  updates: Partial<Pick<EventConfig, 'name' | 'frequency' | 'startDate' | 'endDate' | 'skeletonRoots' | 'autoRollover'>>
): EventState {
  return {
    ...state,
    config: {
      ...state.config,
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Activate a draft event (make it live).
 */
export function activateEvent(state: EventState): EventState {
  return {
    ...state,
    lifecycle: 'active',
    config: {
      ...state.config,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Archive an active event (mark as completed/inactive).
 */
export function archiveEvent(state: EventState): EventState {
  return {
    ...state,
    lifecycle: 'archived',
    config: {
      ...state.config,
      updatedAt: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a UUID v4-like ID using crypto.getRandomValues.
 * Falls back to Math.random if crypto is unavailable.
 */
function generateId(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'undefined') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);

    // Set version 4 bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

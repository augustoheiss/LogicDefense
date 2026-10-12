/**
 * Unified AsyncStorage Adapter — Sekundo
 *
 * Provides persistent device storage using React Native's AsyncStorage.
 * Handles EventStates, Flat Skeleton Registries, and PDF Coordinate Mappings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventState, FlatRegistry, TemplateCoordinateMap } from '@sekundo/core';

const EVENTS_PREFIX = 'sekundo_event_';
const SKELETON_PREFIX = 'sekundo_skeleton_';
const PDF_MAP_PREFIX = 'sekundo_pdf_map_';
const EVENTS_LIST_KEY = 'sekundo_events_list';

/**
 * Get all saved event IDs.
 */
export async function getEventIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the master list of event IDs.
 */
export async function saveEventIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(EVENTS_LIST_KEY, JSON.stringify(ids));
}

/**
 * Load the state of a specific event container.
 */
export async function loadEventState(eventId: string): Promise<EventState | null> {
  try {
    const raw = await AsyncStorage.getItem(`${EVENTS_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save/Update an event container state.
 */
export async function saveEventState(eventId: string, state: EventState): Promise<void> {
  await AsyncStorage.setItem(`${EVENTS_PREFIX}${eventId}`, JSON.stringify(state));
  const ids = await getEventIds();
  if (!ids.includes(eventId)) {
    await saveEventIds([...ids, eventId]);
  }
}

/**
 * Delete an event and all associated skeleton mappings.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await AsyncStorage.removeItem(`${EVENTS_PREFIX}${eventId}`);
  await AsyncStorage.removeItem(`${SKELETON_PREFIX}${eventId}`);
  const ids = await getEventIds();
  await saveEventIds(ids.filter((id) => id !== eventId));
}

/**
 * Load the flat skeleton registry for an event.
 */
export async function loadSkeleton(eventId: string): Promise<FlatRegistry | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SKELETON_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save/Update the flat skeleton registry for an event.
 */
export async function saveSkeleton(eventId: string, skeleton: FlatRegistry): Promise<void> {
  await AsyncStorage.setItem(`${SKELETON_PREFIX}${eventId}`, JSON.stringify(skeleton));
}

/**
 * Load a PDF coordinate mapping by template file hash.
 */
export async function loadPDFMap(templateHash: string): Promise<TemplateCoordinateMap | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PDF_MAP_PREFIX}${templateHash}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save a PDF coordinate mapping for a template file hash.
 */
export async function savePDFMap(
  templateHash: string,
  pdfMap: TemplateCoordinateMap
): Promise<void> {
  await AsyncStorage.setItem(`${PDF_MAP_PREFIX}${templateHash}`, JSON.stringify(pdfMap));
}

// ---------------------------------------------------------------------------
// Engine-Specific Storage Adapters (Local-First)
// ---------------------------------------------------------------------------

const ROSTER_SWAPS_PREFIX = 'sekundo_roster_swaps_';
const RUN_OF_SHOW_PREFIX = 'sekundo_ros_';
const TOURNAMENT_PREFIX = 'sekundo_tournament_';
const ICS_PREFIX = 'sekundo_ics_';
const FILES_PREFIX = 'sekundo_files_';

export async function loadRosterSwaps<T = unknown>(eventId: string): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ROSTER_SWAPS_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveRosterSwaps<T = unknown>(eventId: string, swaps: T[]): Promise<void> {
  await AsyncStorage.setItem(`${ROSTER_SWAPS_PREFIX}${eventId}`, JSON.stringify(swaps));
}

export async function loadRunOfShow<T = unknown>(eventId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${RUN_OF_SHOW_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveRunOfShow<T = unknown>(eventId: string, data: T): Promise<void> {
  await AsyncStorage.setItem(`${RUN_OF_SHOW_PREFIX}${eventId}`, JSON.stringify(data));
}

export async function loadTournamentState<T = unknown>(eventId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${TOURNAMENT_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTournamentState<T = unknown>(eventId: string, state: T): Promise<void> {
  await AsyncStorage.setItem(`${TOURNAMENT_PREFIX}${eventId}`, JSON.stringify(state));
}

export async function loadICSState<T = unknown>(eventId: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ICS_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveICSState<T = unknown>(eventId: string, state: T): Promise<void> {
  await AsyncStorage.setItem(`${ICS_PREFIX}${eventId}`, JSON.stringify(state));
}

export interface WorkspaceFileMetadata {
  id: string;
  name: string;
  type: 'csv' | 'pdf' | 'geojson' | 'md' | 'other';
  sizeBytes: number;
  attachedToPathKey?: string;
  lastModified: string;
  dataBase64?: string;
}

export async function loadProjectFiles(eventId: string): Promise<WorkspaceFileMetadata[]> {
  try {
    const raw = await AsyncStorage.getItem(`${FILES_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveProjectFiles(
  eventId: string,
  files: WorkspaceFileMetadata[]
): Promise<void> {
  await AsyncStorage.setItem(`${FILES_PREFIX}${eventId}`, JSON.stringify(files));
}

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

const IDB_NAME = 'sekundo_sovereign_db';
const IDB_STORE = 'kv_store';

let lastQuotaWarning: string | null = null;
export function getStorageQuotaWarning(): string | null {
  return lastQuotaWarning;
}

function isWebIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openSovereignIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isWebIndexedDBAvailable()) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
}

async function idbGet(key: string): Promise<string | null> {
  if (!isWebIndexedDBAvailable()) return null;
  try {
    const db = await openSovereignIDB();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  if (!isWebIndexedDBAvailable()) return;
  try {
    const db = await openSovereignIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal fallback
  }
}

async function idbRemove(key: string): Promise<void> {
  if (!isWebIndexedDBAvailable()) return;
  try {
    const db = await openSovereignIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Non-fatal
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) return val;
    } catch {
      // Fallback to IndexedDB
    }
    return await idbGet(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await idbSet(key, value);
    try {
      await AsyncStorage.setItem(key, value);
      lastQuotaWarning = null;
    } catch (err: any) {
      lastQuotaWarning =
        'Limite do localStorage (5MB) atingido; dados salvos com segurança no IndexedDB local do navegador.';
      console.warn('[Sekundo Storage]', lastQuotaWarning, err);
    }
  },
  async removeItem(key: string): Promise<void> {
    await idbRemove(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

/**
 * Get all saved event IDs.
 */
export async function getEventIds(): Promise<string[]> {
  try {
    const raw = await storage.getItem(EVENTS_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the master list of event IDs.
 */
export async function saveEventIds(ids: string[]): Promise<void> {
  await storage.setItem(EVENTS_LIST_KEY, JSON.stringify(ids));
}

/**
 * Load the state of a specific event container.
 */
export async function loadEventState(eventId: string): Promise<EventState | null> {
  try {
    const raw = await storage.getItem(`${EVENTS_PREFIX}${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save/Update an event container state.
 */
export async function saveEventState(eventId: string, state: EventState): Promise<void> {
  await storage.setItem(`${EVENTS_PREFIX}${eventId}`, JSON.stringify(state));
  const ids = await getEventIds();
  if (!ids.includes(eventId)) {
    await saveEventIds([...ids, eventId]);
  }
}

/**
 * Delete an event and all associated skeleton mappings.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await storage.removeItem(`${EVENTS_PREFIX}${eventId}`);
  await storage.removeItem(`${SKELETON_PREFIX}${eventId}`);
  const ids = await getEventIds();
  await saveEventIds(ids.filter((id) => id !== eventId));
}

/**
 * Load the flat skeleton registry for an event.
 */
export async function loadSkeleton(eventId: string): Promise<FlatRegistry | null> {
  try {
    // Check AsyncStorage first so external dev seeds in localStorage are picked up immediately
    const rawAsync = await AsyncStorage.getItem(`${SKELETON_PREFIX}${eventId}`).catch(() => null);
    if (rawAsync) {
      return JSON.parse(rawAsync);
    }
    const rawIdb = await idbGet(`${SKELETON_PREFIX}${eventId}`);
    return rawIdb ? JSON.parse(rawIdb) : null;
  } catch {
    return null;
  }
}

/**
 * Save/Update the flat skeleton registry for an event.
 */
export async function saveSkeleton(eventId: string, skeleton: FlatRegistry): Promise<void> {
  await storage.setItem(`${SKELETON_PREFIX}${eventId}`, JSON.stringify(skeleton));
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

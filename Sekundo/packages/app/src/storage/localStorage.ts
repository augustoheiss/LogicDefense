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

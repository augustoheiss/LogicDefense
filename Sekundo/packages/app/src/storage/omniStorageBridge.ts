/**
 * Sekundo — Unified Multi-Engine & Omni-CSV Storage Bridge
 *
 * Centralizes bidirectional persistence between the browser's saved workspace
 * (`sekundo_events_list`, `sekundo_skeleton_*`, `sekundo:privilege_directory_v1`,
 * `sekundo:schedule_hub_registry_v1`, `sekundo:territory_hub_registry_v1`, `sekundo_app_manifest_v1`)
 * and the Unified Master CSV (`sekundo_omni_geral.csv`).
 *
 * Solves:
 * 1. SIT-01: Persists exact CSV participant capabilities & dynamic custom privileges across all screens.
 * 2. SIT-02: Loads the real `FlatSkeletonEntry[]` of EVERY saved event in the browser when exporting
 *    the CSV Geral (`collectFullSiteOmniBundleFromStorage`), never passing `registry: []`.
 * 3. SIT-03: Saves a partitioned Multi-Engine skeleton (`buildCombinedMultiEngineSkeleton`) so that
 *    importing a single CSV Geral opens and powers Territory Engine + Schedule Engine + Privilege Matrix
 *    + all other Engines present in the CSV simultaneously.
 */

import { Platform } from 'react-native';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  PROGRAMACAO_UNIT_NAME,
  FICHAS_4UP_SDOC_YAML,
  TERRITORIOS_MULTICYCLE_SDOC_YAML,
  DEFAULT_SEKUNDO_APP_YAML,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  ensureParticipantPrivilegeMatrix,
  exportOmniCsvBundle,
  importOmniCsvBundle,
  buildCombinedMultiEngineSkeleton,
  selectEnginePartitionNodes,
  deriveActiveEnginesFromOmniBundle,
  getActiveEngines,
  eventContainer,
  type SekundoOmniStateBundle,
  type OmniEventBundleItem,
  type ParticipantProfile,
  type FlatSkeletonEntry,
  type EngineId,
} from '@sekundo/core';
import * as localStore from './localStorage';

export const PRIVILEGE_DIRECTORY_STORAGE_KEY = 'sekundo:privilege_directory_v1';
export const SCHEDULE_HUB_REGISTRY_STORAGE_KEY = 'sekundo:schedule_hub_registry_v1';
export const TERRITORY_HUB_REGISTRY_STORAGE_KEY = 'sekundo:territory_hub_registry_v1';
export const LOADED_OMNI_BUNDLE_STORAGE_KEY = 'sekundo:loaded_schedule_bundle_v1';
export const HOJE_MANIFEST_STORAGE_KEY = 'sekundo_app_manifest_v1';

function readWebLocalStorage(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

function writeWebLocalStorage(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore quota
    }
  }
}

/**
 * Loads the persisted Privilege Matrix participant directory from local storage.
 */
export async function loadSavedPrivilegeParticipants(): Promise<ParticipantProfile[]> {
  try {
    const raw =
      readWebLocalStorage(PRIVILEGE_DIRECTORY_STORAGE_KEY) ??
      (await localStore.storage.getItem(PRIVILEGE_DIRECTORY_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as ParticipantProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p, idx) =>
          ensureParticipantPrivilegeMatrix(p, idx, { preserveExplicitCapabilities: true })
        );
      }
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS;
}

/**
 * Saves the Privilege Matrix participant directory to local storage.
 */
export async function savePrivilegeParticipants(
  participants: ParticipantProfile[]
): Promise<void> {
  const serialized = JSON.stringify(participants);
  writeWebLocalStorage(PRIVILEGE_DIRECTORY_STORAGE_KEY, serialized);
  await localStore.storage.setItem(PRIVILEGE_DIRECTORY_STORAGE_KEY, serialized);
}

/**
 * Loads the persisted Territory Registry (`hub_territory_cycle`) from local storage
 * so any screen (`/territory-checklist`, `/territory-map`, `/schedule-hub`) can access
 * the latest imported territory spreadsheet.
 */
export async function loadSavedTerritoryRegistry(): Promise<FlatSkeletonEntry[] | null> {
  try {
    const raw =
      readWebLocalStorage(TERRITORY_HUB_REGISTRY_STORAGE_KEY) ??
      (await localStore.storage.getItem(TERRITORY_HUB_REGISTRY_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as FlatSkeletonEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Saves the Territory Registry to local storage.
 */
export async function saveTerritoryRegistry(registry: FlatSkeletonEntry[]): Promise<void> {
  const serialized = JSON.stringify(registry);
  writeWebLocalStorage(TERRITORY_HUB_REGISTRY_STORAGE_KEY, serialized);
  await localStore.storage.setItem(TERRITORY_HUB_REGISTRY_STORAGE_KEY, serialized);
}

/**
 * Loads the persisted Schedule Registry (`hub_schedule_slot`) from local storage.
 */
export async function loadSavedScheduleRegistry(): Promise<FlatSkeletonEntry[] | null> {
  try {
    const raw =
      readWebLocalStorage(SCHEDULE_HUB_REGISTRY_STORAGE_KEY) ??
      (await localStore.storage.getItem(SCHEDULE_HUB_REGISTRY_STORAGE_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as FlatSkeletonEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Saves the Schedule Registry to local storage.
 */
export async function saveScheduleRegistry(registry: FlatSkeletonEntry[]): Promise<void> {
  const serialized = JSON.stringify(registry);
  writeWebLocalStorage(SCHEDULE_HUB_REGISTRY_STORAGE_KEY, serialized);
  await localStore.storage.setItem(SCHEDULE_HUB_REGISTRY_STORAGE_KEY, serialized);
}

/**
 * Collects the COMPLETE saved state of the Sekundo site across all local storage keys
 * and all saved Event Containers (`loadSkeleton(ev.id)` for every saved event!).
 */
export async function collectFullSiteOmniBundleFromStorage(
  overrides?: Partial<SekundoOmniStateBundle>
): Promise<SekundoOmniStateBundle> {
  const participants = overrides?.participants || (await loadSavedPrivilegeParticipants());

  // 1. Load all saved Event Containers and their real skeletons from storage
  const eventIds = await localStore.getEventIds();
  const hydratedEvents: OmniEventBundleItem[] = [];
  let fallbackScheduleFromEvent: FlatSkeletonEntry[] | null = null;
  let fallbackTerritoryFromEvent: FlatSkeletonEntry[] | null = null;

  for (const id of eventIds) {
    const state = await localStore.loadEventState(id);
    if (!state) continue;
    const rawSkeleton = (await localStore.loadSkeleton(id)) || [];
    const engines = getActiveEngines(state.config);

    // If this event has a partitioned multi-engine skeleton, also extract schedule/territory fallbacks
    const schedNodes = selectEnginePartitionNodes(rawSkeleton, 'roster_assignments');
    const terrNodes = selectEnginePartitionNodes(rawSkeleton, 'territory_logistics');
    if (!fallbackScheduleFromEvent && schedNodes.length > 0 && engines.includes('roster_assignments')) {
      fallbackScheduleFromEvent = schedNodes;
    }
    if (!fallbackTerritoryFromEvent && terrNodes.length > 0 && engines.includes('territory_logistics')) {
      fallbackTerritoryFromEvent = terrNodes;
    }

    // Ensure every saved event has non-empty registry rows exported into `event_node`
    const effectiveRegistry =
      rawSkeleton.length > 0
        ? rawSkeleton
        : [
            {
              key: '01',
              type: 'header' as const,
              label: state.config.name,
              value: engines.join('|'),
              email: '',
              meta: { createdIso: new Date().toISOString() },
            },
          ];

    hydratedEvents.push({
      id: state.config.id,
      name: state.config.name,
      engines,
      registry: effectiveRegistry,
    });
  }

  const savedSchedule = await loadSavedScheduleRegistry();
  const savedTerritory = await loadSavedTerritoryRegistry();

  const scheduleRegistry =
    overrides?.scheduleRegistry ||
    savedSchedule ||
    fallbackScheduleFromEvent ||
    buildProgramacaoReuniaoRegistry(undefined, participants);

  const territoryRegistry =
    overrides?.territoryRegistry ||
    savedTerritory ||
    fallbackTerritoryFromEvent ||
    buildTerritoriosS13HistoricalRegistry();

  const hojeManifestYaml =
    overrides?.hojeManifestYaml ||
    readWebLocalStorage(HOJE_MANIFEST_STORAGE_KEY) ||
    (await localStore.storage.getItem(HOJE_MANIFEST_STORAGE_KEY)) ||
    DEFAULT_SEKUNDO_APP_YAML;

  return {
    unitName: overrides?.unitName || PROGRAMACAO_UNIT_NAME,
    participants,
    scheduleRegistry,
    territoryRegistry,
    events: overrides?.events || hydratedEvents,
    studioDocuments: overrides?.studioDocuments || [
      {
        id: 'fichas-4up',
        title: 'Fichas de Designação 4-Up (A4)',
        format: 'A4-Portrait-mm',
        sdocYaml: FICHAS_4UP_SDOC_YAML,
      },
      {
        id: 'territorios-multiciclo',
        title: 'Registro de Territórios Multi-Ciclo (A4)',
        format: 'A4-Portrait-mm',
        sdocYaml: TERRITORIOS_MULTICYCLE_SDOC_YAML,
      },
    ],
    hojeManifestYaml,
    hojeRituals: overrides?.hojeRituals || [
      {
        id: 'ritual-01',
        title: 'Auditoria de Prontidão Semanal & Envio WhatsApp',
        frequency: 'weekly',
        status: 'active',
        notes: 'Verifica confirmações dos Grupos 1–3 e gera fichas 4-Up',
      },
      {
        id: 'ritual-02',
        title: 'Fechamento de Ciclo Territorial & Mapa CAD',
        frequency: 'monthly',
        status: 'active',
        notes: 'Atualiza cobertura de quadras e imprime folha PDF A4',
      },
    ],
  };
}

/**
 * Exports the complete saved site state as an RFC-4180 CSV Geral string.
 */
export async function exportFullSiteOmniCsvFromStorage(
  overrides?: Partial<SekundoOmniStateBundle>
): Promise<string> {
  const bundle = await collectFullSiteOmniBundleFromStorage(overrides);
  return exportOmniCsvBundle(bundle);
}

/**
 * Commits an imported Omni-CSV string or bundle across ALL Sekundo engines and stores:
 * - Saves exact CSV participants & dynamic privileges to `sekundo:privilege_directory_v1`
 * - Saves Schedule & Territory registries
 * - Creates or updates a Multi-Engine Event Container with a partitioned skeleton
 *   (`roster_assignments` + `territory_logistics` + any other active engines in the CSV)
 * - Restores any additional user-saved events (`event_node`) contained in the CSV
 */
export async function commitOmniCsvBundleToStorage(
  csvTextOrBundle: string | SekundoOmniStateBundle,
  options?: {
    customEventName?: string;
    targetEventId?: string;
    restoreEmbeddedEvents?: boolean;
  }
): Promise<{
  bundle: SekundoOmniStateBundle;
  primaryEventId: string;
  activeEngines: EngineId[];
  restoredEventIds: string[];
}> {
  const bundle =
    typeof csvTextOrBundle === 'string'
      ? importOmniCsvBundle(csvTextOrBundle)
      : csvTextOrBundle;

  const serializedCsv =
    typeof csvTextOrBundle === 'string'
      ? csvTextOrBundle
      : exportOmniCsvBundle(bundle);

  // 1. Persist Participants + Dynamic Privileges, Schedule, Territory, and Hoje Manifest
  await savePrivilegeParticipants(bundle.participants);
  await saveScheduleRegistry(bundle.scheduleRegistry);
  await saveTerritoryRegistry(bundle.territoryRegistry);
  writeWebLocalStorage(LOADED_OMNI_BUNDLE_STORAGE_KEY, serializedCsv);
  await localStore.storage.setItem(LOADED_OMNI_BUNDLE_STORAGE_KEY, serializedCsv);

  if (bundle.hojeManifestYaml) {
    writeWebLocalStorage(HOJE_MANIFEST_STORAGE_KEY, bundle.hojeManifestYaml);
    await localStore.storage.setItem(HOJE_MANIFEST_STORAGE_KEY, bundle.hojeManifestYaml);
  }

  // 2. Derive all active engines present in this CSV Geral
  const rawEngines = deriveActiveEnginesFromOmniBundle(bundle);
  const validEngineSet = new Set<string>([
    'territory_logistics',
    'roster_assignments',
    'study_synthesis',
    'financial_ledger',
    'inventory_assets',
    'action_tracker',
    'custom',
    'live_production_ros',
    'incident_command',
    'tournament_pairings',
    'CheckInEngine',
    'DocumentEngine',
  ]);
  const activeEngines = rawEngines.filter((e) => validEngineSet.has(e)) as EngineId[];
  if (!activeEngines.includes('roster_assignments')) {
    activeEngines.unshift('roster_assignments');
  }
  if (!activeEngines.includes('territory_logistics')) {
    activeEngines.push('territory_logistics');
  }

  // 3. Build the combined Multi-Engine Partitioned Skeleton (Schedule + Territory)
  const combinedSkeleton = buildCombinedMultiEngineSkeleton(bundle);

  // 4. Create or update the primary Multi-Engine Event Container
  let primaryEventId = options?.targetEventId || '';
  const eventName =
    options?.customEventName?.trim() || `${bundle.unitName} — Multi-Engine`;

  if (primaryEventId) {
    const existingState = await localStore.loadEventState(primaryEventId);
    if (existingState) {
      const updatedConfig = {
        ...existingState.config,
        name: options?.customEventName?.trim() || existingState.config.name,
        engineId: activeEngines[0],
        engines: activeEngines,
      };
      await localStore.saveEventState(primaryEventId, {
        ...existingState,
        config: updatedConfig,
      });
      await localStore.saveSkeleton(primaryEventId, combinedSkeleton);
    } else {
      primaryEventId = '';
    }
  }

  if (!primaryEventId) {
    const config = eventContainer.createEvent(
      eventName,
      'weekly',
      ['01', '02', '03'],
      activeEngines
    );
    const state = eventContainer.createEventState(config);
    primaryEventId = config.id;
    await localStore.saveEventState(primaryEventId, state);
    await localStore.saveSkeleton(primaryEventId, combinedSkeleton);
  }

  // 5. Restore embedded user-saved events (`event_node`) if present and not sample placeholders
  const restoredEventIds: string[] = [];
  if (options?.restoreEmbeddedEvents !== false && bundle.events.length > 0) {
    const existingIds = await localStore.getEventIds();
    for (const ev of bundle.events) {
      // Skip synthetic sample placeholders (`evt-sample-*`) unless explicitly requested
      if (ev.id.startsWith('evt-sample-')) continue;
      if (ev.id === primaryEventId) continue;

      const evEngines = (ev.engines.filter((e) => validEngineSet.has(e)) as EngineId[]) || [
        'custom',
      ];
      if (!existingIds.includes(ev.id)) {
        const cfg = eventContainer.createEvent(
          ev.name,
          'weekly',
          ['01'],
          evEngines.length > 0 ? evEngines : ['custom']
        );
        const finalId = ev.id || cfg.id;
        const finalConfig = { ...cfg, id: finalId };
        const st = eventContainer.createEventState(finalConfig);
        await localStore.saveEventState(finalId, st);
        await localStore.saveSkeleton(finalId, ev.registry);
        restoredEventIds.push(finalId);
      } else {
        await localStore.saveSkeleton(ev.id, ev.registry);
        restoredEventIds.push(ev.id);
      }
    }
  }

  return {
    bundle,
    primaryEventId,
    activeEngines,
    restoredEventIds,
  };
}

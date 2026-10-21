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
  DEFAULT_COIN_LEDGER_ROWS,
  PROGRAMACAO_UNIT_NAME,
  FICHAS_4UP_SDOC_YAML,
  TERRITORIOS_MULTICYCLE_SDOC_YAML,
  DEFAULT_SEKUNDO_APP_YAML,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
  ensureParticipantPrivilegeMatrix,
  exportOmniCsvBundle,
  exportSingleEngineSampleCsv,
  getSheetsForEngineId,
  importOmniCsvBundle,
  groupCoinLedgerRowsByTable,
  buildCombinedMultiEngineSkeleton,
  selectEnginePartitionNodes,
  deriveActiveEnginesFromOmniBundle,
  getActiveEngines,
  eventContainer,
  type SekundoOmniStateBundle,
  type OmniEventBundleItem,
  type OmniCoinLedgerRowItem,
  type ParticipantProfile,
  type FlatSkeletonEntry,
  type EngineId,
} from '@sekundo/core';
import { loadDB, saveDB, type CoinTable, type TableRow } from '@sekundo/coin-engine';
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
 * Loads the persisted Assistente Moeda (`coin_ledger_row`) rows from `@sekundo/coin-engine` storage.
 * Falls back to `DEFAULT_COIN_LEDGER_ROWS` if no financial rows have been created yet so
 * the Assistente Moeda spreadsheet is always available on export.
 */
export async function loadSavedCoinLedgerRows(): Promise<OmniCoinLedgerRowItem[]> {
  try {
    const db = await loadDB();
    const collected: OmniCoinLedgerRowItem[] = [];
    const validEntryTypes = new Set<string>([
      'revenue',
      'income',
      'deposit',
      'investment',
      'waiver',
      'partner_in',
      'partner_out',
      'unresolved',
      'expense',
    ]);

    for (const table of db?.tables || []) {
      if (table.isDeleted) continue;
      const tableEnvelope: Record<string, any> = {
        tableId: table.id || 'coin-default',
        tableName: table.name || '🪙 Assistente Moeda — Geral',
      };
      if (table.goals) tableEnvelope.goals = table.goals;
      if (table.investorProfile) tableEnvelope.investorProfile = table.investorProfile;
      if (table.schema) tableEnvelope.schema = table.schema;
      if (table.activeSectors) tableEnvelope.activeSectors = table.activeSectors;
      if (table.dashboardConfig) tableEnvelope.dashboardConfig = table.dashboardConfig;
      if (table.sectorParams) tableEnvelope.sectorParams = table.sectorParams;
      if (table.description) tableEnvelope.description = table.description;
      const hasTableEnvelope = Object.keys(tableEnvelope).length > 0;

      const tableRows = table.rows || [];
      if (tableRows.length === 0) {
        collected.push({
          id: `__table_header__${table.id || 'coin-default'}`,
          date: (table.updatedAt || table.createdAt || new Date().toISOString()).slice(0, 10),
          category: table.name || 'Planilha Vazia',
          description: table.description || table.name || 'Cabeçalho de Planilha Vazia',
          amount: 0,
          entryType: 'unresolved',
          paymentMethod: 'PIX',
          status: 'paid',
          recurrence: 'unico',
          tableId: table.id || 'coin-default',
          tableName: table.name || '🪙 Assistente Moeda — Geral',
          isTableHeaderOnly: true,
          tableEnvelope: hasTableEnvelope ? tableEnvelope : undefined,
          metadataJson: hasTableEnvelope
            ? JSON.stringify({ isTableHeaderOnly: true, tableEnvelope })
            : JSON.stringify({ isTableHeaderOnly: true }),
        });
        continue;
      }

      tableRows.forEach((r, rowIdx) => {
        const rawEntry = (r.entryType || 'revenue').toLowerCase().trim();
        const entryType = (
          validEntryTypes.has(rawEntry) ? rawEntry : 'expense'
        ) as OmniCoinLedgerRowItem['entryType'];

        const recurrence =
          r.monthCount && r.monthCount > 1 ? `rateio_${r.monthCount}m` : 'unico';

        const extraPayload: Record<string, any> = {};
        if (r.customValues && Object.keys(r.customValues).length > 0) {
          extraPayload.customValues = r.customValues;
        }
        if (rowIdx === 0 && hasTableEnvelope) {
          extraPayload.tableEnvelope = tableEnvelope;
        }

        collected.push({
          id: r.id,
          date: r.date,
          category: r.category || table.name || 'Operacional',
          description: r.description || table.name || 'Lançamento Assistente Moeda',
          amount: Number(r.value) || 0,
          entryType,
          paymentMethod: r.tags || 'PIX',
          status: 'paid',
          recurrence,
          tableId: table.id || 'coin-default',
          tableName: table.name || '🪙 Assistente Moeda — Geral',
          monthlyValue: typeof r.monthlyValue === 'number' ? r.monthlyValue : undefined,
          monthCount: typeof r.monthCount === 'number' ? r.monthCount : undefined,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          tags: r.tags || 'PIX',
          ticker: r.ticker,
          quantity: typeof r.quantity === 'number' ? r.quantity : undefined,
          unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : undefined,
          customValues: r.customValues,
          tableEnvelope: rowIdx === 0 && hasTableEnvelope ? tableEnvelope : undefined,
          metadataJson:
            Object.keys(extraPayload).length > 0 ? JSON.stringify(extraPayload) : undefined,
        });
      });
    }
    if (collected.length > 0) {
      return collected;
    }
  } catch {
    // fallback to default coin rows
  }
  return DEFAULT_COIN_LEDGER_ROWS;
}

/**
 * Persists imported `OmniCoinLedgerRowItem[]` into Assistente Moeda's `@sekundo/coin-engine` DB
 * demultiplexed by `tableId` (`_container_id`), ensuring that multiple financial spreadsheets
 * exported in the same CSV are restored as independent `CoinTable` instances without mixing values.
 */
export async function saveCoinLedgerRowsToCoinDB(
  coinRows: OmniCoinLedgerRowItem[]
): Promise<void> {
  if (!Array.isArray(coinRows) || coinRows.length === 0) return;
  try {
    const partitions = groupCoinLedgerRowsByTable(coinRows);
    if (partitions.length === 0) return;

    const db = await loadDB();
    const nowIso = new Date().toISOString();
    const currentYear = new Date().getFullYear();
    const existingTables = Array.isArray(db?.tables) ? [...db.tables] : [];
    const partitionTableIds = new Set(partitions.map((p) => p.tableId));

    for (let partitionIdx = 0; partitionIdx < partitions.length; partitionIdx++) {
      const partition = partitions[partitionIdx];
      let discoveredEnvelope: Record<string, any> | undefined = partition.tableEnvelope;

      if (!discoveredEnvelope) {
        for (const item of partition.rows) {
          if (item.tableEnvelope && typeof item.tableEnvelope === 'object') {
            discoveredEnvelope = item.tableEnvelope;
            break;
          }
          if (item.metadataJson) {
            try {
              const parsedMeta = JSON.parse(item.metadataJson);
              if (parsedMeta?.tableEnvelope && typeof parsedMeta.tableEnvelope === 'object') {
                discoveredEnvelope = parsedMeta.tableEnvelope;
                break;
              }
            } catch {
              // ignore invalid json
            }
          }
        }
      }

      const mappedRows: TableRow[] = partition.rows.map((item, idx) => {
        const rawType = (item.entryType || 'revenue').toLowerCase().trim();
        const normalizedEntryType: TableRow['entryType'] =
          rawType === 'income' || rawType === 'revenue'
            ? 'revenue'
            : rawType === 'investment' || rawType === 'deposit'
            ? 'deposit'
            : rawType === 'waiver'
            ? 'waiver'
            : rawType === 'partner_in'
            ? 'partner_in'
            : rawType === 'partner_out'
            ? 'partner_out'
            : rawType === 'unresolved'
            ? 'unresolved'
            : 'expense';

        let customValues = item.customValues;
        if (!customValues && item.metadataJson) {
          try {
            const parsedMeta = JSON.parse(item.metadataJson);
            if (parsedMeta?.customValues && typeof parsedMeta.customValues === 'object') {
              customValues = parsedMeta.customValues;
            }
          } catch {
            // ignore
          }
        }

        const row: TableRow = {
          id: item.id || `coin-row-${partition.tableId}-${idx + 1}`,
          date: item.date || nowIso.slice(0, 10),
          value: Number(item.amount) || 0,
          description: item.description || item.category || 'Lançamento Importado',
          category: item.category || 'Operacional',
          tags: Array.isArray(item.tags)
            ? item.tags.join(',')
            : item.tags || item.paymentMethod || 'PIX',
          entryType: normalizedEntryType,
          createdAt: nowIso,
        };

        if (typeof item.monthlyValue === 'number') row.monthlyValue = item.monthlyValue;
        if (typeof item.monthCount === 'number') row.monthCount = item.monthCount;
        if (item.periodStart) row.periodStart = item.periodStart;
        if (item.periodEnd) row.periodEnd = item.periodEnd;
        if (item.ticker) row.ticker = item.ticker;
        if (typeof item.quantity === 'number') row.quantity = item.quantity;
        if (typeof item.unitPrice === 'number') row.unitPrice = item.unitPrice;
        if (customValues && Object.keys(customValues).length > 0) row.customValues = customValues;

        return row;
      });

      const targetTableId = partition.tableId || 'coin-default';
      const targetTableName =
        partition.tableName ||
        discoveredEnvelope?.tableName ||
        '🪙 Assistente Moeda — Geral';

      const applyEnvelope = (base: CoinTable): CoinTable => ({
        ...base,
        id: targetTableId,
        name: targetTableName || base.name,
        description:
          discoveredEnvelope?.description ||
          base.description ||
          'Planilha importada via Sekundo Multi-Planilha CSV',
        updatedAt: nowIso,
        rows: mappedRows,
        goals: discoveredEnvelope?.goals || base.goals || {
          dailyGoals: { [currentYear]: 150 },
          weeklyGoals: { [currentYear]: 1050 },
          annualCosts: { [currentYear]: 36000 },
        },
        investorProfile: discoveredEnvelope?.investorProfile || base.investorProfile,
        schema: discoveredEnvelope?.schema || base.schema,
        activeSectors: discoveredEnvelope?.activeSectors || base.activeSectors,
        dashboardConfig: discoveredEnvelope?.dashboardConfig || base.dashboardConfig,
        sectorParams: discoveredEnvelope?.sectorParams || base.sectorParams,
      });

      // 1. Match estrito pelo ID da tabela (`t.id === targetTableId`)
      let targetIdx = existingTables.findIndex(
        (t) => !t.isDeleted && t.id === targetTableId
      );

      // 2. Somente na 1ª partição, se o banco tiver apenas uma tabela inicial vazia (sem lançamentos)
      // e cujo ID não pertence a nenhuma outra partição do lote, substituímos essa tabela vazia inicial.
      if (
        targetIdx === -1 &&
        partitionIdx === 0 &&
        existingTables.length === 1 &&
        !existingTables[0].isDeleted &&
        (existingTables[0].rows || []).length === 0 &&
        !partitionTableIds.has(existingTables[0].id)
      ) {
        targetIdx = 0;
      }

      if (targetIdx >= 0) {
        existingTables[targetIdx] = applyEnvelope(existingTables[targetIdx]);
      } else {
        const newTable: CoinTable = applyEnvelope({
          id: targetTableId,
          name: targetTableName,
          description: 'Planilha importada via Sekundo Multi-Planilha CSV',
          createdAt: nowIso,
          updatedAt: nowIso,
          rows: mappedRows,
          goals: {
            dailyGoals: { [currentYear]: 150 },
            weeklyGoals: { [currentYear]: 1050 },
            annualCosts: { [currentYear]: 36000 },
          },
        });
        existingTables.push(newTable);
      }
    }

    const firstImportedTableId = partitions[0].tableId || 'coin-default';
    const firstActiveIdx = existingTables.findIndex(
      (t) => !t.isDeleted && t.id === firstImportedTableId
    );
    const resolvedActiveIdx = firstActiveIdx >= 0 ? firstActiveIdx : 0;

    await saveDB({
      ...(db || { tables: [] }),
      activeTableId: existingTables[resolvedActiveIdx]?.id || firstImportedTableId,
      tables: existingTables,
      activeTableIndex: resolvedActiveIdx,
    } as any);

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('coin_db_external_updated'));
      } catch {
        // ignore in non-DOM environments
      }
    }
  } catch {
    // ignore storage errors
  }
}

const HUB_PRIMARY_EVENT_ID = 'evt-sekundo-hub-primary';
const LEGACY_EVENTS_V1_STORAGE_KEY = 'sekundo:events:v1';

/**
 * Collects the COMPLETE saved state of the Sekundo site across all local storage keys,
 * Assistente Moeda DB (`loadDB`), and all saved Event Containers (`loadSkeleton(ev.id)`).
 */
export async function collectFullSiteOmniBundleFromStorage(
  overrides?: Partial<SekundoOmniStateBundle>
): Promise<SekundoOmniStateBundle> {
  const participants = overrides?.participants || (await loadSavedPrivilegeParticipants());

  // 1. Load all saved Event Containers and their real skeletons from storage
  const eventIds = await localStore.getEventIds();
  const hydratedEvents: OmniEventBundleItem[] = [];
  const seenEventIds = new Set<string>();
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

    // Do not duplicate the synthetic Hub primary event into `event_node`, because its
    // schedule and territory rows are already exported in `hub_schedule_slot` and `hub_territory_cycle`
    if (id === HUB_PRIMARY_EVENT_ID || (state.config as any)?.isHubPrimaryContainer) {
      seenEventIds.add(id);
      continue;
    }

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

    seenEventIds.add(state.config.id);
    hydratedEvents.push({
      id: state.config.id,
      name: state.config.name,
      engines,
      registry: effectiveRegistry,
    });
  }

  // Also check `sekundo:events:v1` for any events stored in tree/legacy format
  try {
    const rawLegacyEvents =
      readWebLocalStorage(LEGACY_EVENTS_V1_STORAGE_KEY) ??
      (await localStore.storage.getItem(LEGACY_EVENTS_V1_STORAGE_KEY));
    if (rawLegacyEvents) {
      const parsedLegacy = JSON.parse(rawLegacyEvents);
      if (Array.isArray(parsedLegacy)) {
        for (const item of parsedLegacy) {
          if (!item || !item.id || seenEventIds.has(item.id) || item.id === HUB_PRIMARY_EVENT_ID) {
            continue;
          }
          const itemEngines: string[] = Array.isArray(item.engines) && item.engines.length > 0
            ? item.engines
            : item.engineId
            ? [item.engineId]
            : ['generic_wbs'];
          let registry: FlatSkeletonEntry[] = [];
          if (Array.isArray(item.registry) && item.registry.length > 0) {
            registry = item.registry;
          } else if (item.root) {
            const rootLabel = item.root.label || item.title || item.name || item.id;
            registry.push({
              key: '01',
              type: (item.root.type || 'group') as any,
              label: rootLabel,
              value: item.root.value || '',
              email: '',
              meta: item.root.meta || {},
            });
            const children = Array.isArray(item.root.children) ? item.root.children : [];
            children.forEach((ch: any, idx: number) => {
              registry.push({
                key: ch.key || `01-${String(idx + 1).padStart(2, '0')}`,
                type: (ch.type || 'leaf') as any,
                label: ch.label || ch.title || `Item ${idx + 1}`,
                value: ch.value !== undefined ? String(ch.value) : '',
                email: ch.email || '',
                meta: ch.meta || {},
              });
            });
          }
          seenEventIds.add(item.id);
          hydratedEvents.push({
            id: item.id,
            name: item.title || item.name || item.id,
            engines: itemEngines,
            registry,
          });
        }
      }
    }
  } catch {
    // ignore legacy events parse error
  }

  const savedSchedule = await loadSavedScheduleRegistry();
  const savedTerritory = await loadSavedTerritoryRegistry();
  const coinLedgerRows = overrides?.coinLedgerRows || (await loadSavedCoinLedgerRows());

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
    coinLedgerRows,
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
 * Exports the complete saved site state across ALL engines as a Multi-Planilha CSV Geral string.
 */
export async function exportFullSiteOmniCsvFromStorage(
  overrides?: Partial<SekundoOmniStateBundle>
): Promise<string> {
  const bundle = await collectFullSiteOmniBundleFromStorage(overrides);
  return exportOmniCsvBundle(bundle);
}

/**
 * Exports ONLY the Planilha(s) belonging to a single selected `engineId` from saved storage.
 * Guarantees that downloading a single Engine's spreadsheet never dumps the entire global bundle.
 */
export async function exportSingleEngineOmniCsvFromStorage(
  engineId: string
): Promise<string> {
  const bundle = await collectFullSiteOmniBundleFromStorage();
  const targetSheets = getSheetsForEngineId(engineId);

  // If this engine maps to `event_node`, check if there are saved events for this engine
  if (targetSheets.length === 1 && targetSheets[0] === 'event_node') {
    const matchingEvents = (bundle.events || []).filter((ev) =>
      ev.engines.includes(engineId)
    );
    if (matchingEvents.length === 0) {
      return exportSingleEngineSampleCsv(engineId);
    }
    return exportOmniCsvBundle(
      { ...bundle, events: matchingEvents },
      { onlySheets: targetSheets, onlyEngineId: engineId }
    );
  }

  return exportOmniCsvBundle(bundle, {
    onlySheets: targetSheets,
    onlyEngineId: engineId,
  });
}

/**
 * Commits an imported Multi-Planilha Omni-CSV string or bundle across Sekundo's stores.
 * Respects `bundle.presentSheets`: if the user deleted a Planilha from the CSV before importing,
 * or imported a Single-Engine spreadsheet, only the Planilhas present in the file are updated in storage!
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

  const presentSet = new Set(bundle.presentSheets || []);
  const hasAllOrSheet = (kind: NonNullable<SekundoOmniStateBundle['presentSheets']>[number]) =>
    presentSet.size === 0 || presentSet.has(kind);

  const serializedCsv =
    typeof csvTextOrBundle === 'string'
      ? csvTextOrBundle
      : exportOmniCsvBundle(bundle);

  // 1. Persist only the Planilhas that are present in the imported CSV
  if (hasAllOrSheet('participant_privilege') && bundle.participants.length > 0) {
    await savePrivilegeParticipants(bundle.participants);
  }
  if (hasAllOrSheet('hub_schedule_slot') && bundle.scheduleRegistry.length > 0) {
    await saveScheduleRegistry(bundle.scheduleRegistry);
  }
  if (hasAllOrSheet('hub_territory_cycle') && bundle.territoryRegistry.length > 0) {
    await saveTerritoryRegistry(bundle.territoryRegistry);
  }
  if (hasAllOrSheet('coin_ledger_row') && bundle.coinLedgerRows && bundle.coinLedgerRows.length > 0) {
    await saveCoinLedgerRowsToCoinDB(bundle.coinLedgerRows);
  }

  writeWebLocalStorage(LOADED_OMNI_BUNDLE_STORAGE_KEY, serializedCsv);
  await localStore.storage.setItem(LOADED_OMNI_BUNDLE_STORAGE_KEY, serializedCsv);

  if (hasAllOrSheet('cockpit_hoje') && bundle.hojeManifestYaml) {
    writeWebLocalStorage(HOJE_MANIFEST_STORAGE_KEY, bundle.hojeManifestYaml);
    await localStore.storage.setItem(HOJE_MANIFEST_STORAGE_KEY, bundle.hojeManifestYaml);
  }

  // 2. Derive all active engines present in this CSV (including all 12 Universal Engines)
  const rawEngines = deriveActiveEnginesFromOmniBundle(bundle);
  const validEngineSet = new Set<string>([
    'territory_logistics',
    'roster_assignments',
    'study_synthesis',
    'generic_wbs',
    'incident_command',
    'live_production_ros',
    'tournament_pairings',
    'canvassing_logistics',
    'financial_ledger',
    'transformer',
    'inventory_assets',
    'action_tracker',
    'custom',
    'CheckInEngine',
    'DocumentEngine',
  ]);
  const activeEngines = rawEngines.filter((e) => validEngineSet.has(e)) as EngineId[];

  const hasScheduleSheet =
    hasAllOrSheet('hub_schedule_slot') || hasAllOrSheet('participant_privilege');
  const hasTerritorySheet = hasAllOrSheet('hub_territory_cycle');

  if (hasScheduleSheet && !activeEngines.includes('roster_assignments')) {
    activeEngines.unshift('roster_assignments');
  }
  if (hasTerritorySheet && !activeEngines.includes('territory_logistics')) {
    activeEngines.push('territory_logistics');
  }
  if (activeEngines.length === 0) {
    activeEngines.push('roster_assignments', 'territory_logistics');
  }

  // 3. Build the combined Multi-Engine Partitioned Skeleton (Schedule + Territory) when applicable
  const shouldCreateHubContainer =
    hasScheduleSheet || hasTerritorySheet || Boolean(options?.targetEventId);
  let primaryEventId = options?.targetEventId || '';

  if (shouldCreateHubContainer) {
    const combinedSkeleton = buildCombinedMultiEngineSkeleton(bundle);
    const eventName =
      options?.customEventName?.trim() || `${bundle.unitName} — Multi-Engine`;
    const targetHubId = primaryEventId || HUB_PRIMARY_EVENT_ID;
    const existingState = await localStore.loadEventState(targetHubId);

    if (existingState) {
      const updatedConfig = {
        ...existingState.config,
        id: targetHubId,
        name: options?.customEventName?.trim() || existingState.config.name,
        engineId: activeEngines[0],
        engines: activeEngines,
        isHubPrimaryContainer: !options?.targetEventId,
      } as any;
      await localStore.saveEventState(targetHubId, {
        ...existingState,
        config: updatedConfig,
      });
      await localStore.saveSkeleton(targetHubId, combinedSkeleton);
      primaryEventId = targetHubId;
    } else {
      const config = eventContainer.createEvent(
        eventName,
        'weekly',
        ['01', '02', '03'],
        activeEngines
      );
      const finalConfig = {
        ...config,
        id: targetHubId,
        isHubPrimaryContainer: !options?.targetEventId,
      } as any;
      const state = eventContainer.createEventState(finalConfig);
      primaryEventId = targetHubId;
      await localStore.saveEventState(primaryEventId, state);
      await localStore.saveSkeleton(primaryEventId, combinedSkeleton);
    }
  }

  // 4. Restore embedded events (`event_node`) if present in the CSV
  const restoredEventIds: string[] = [];
  if (
    hasAllOrSheet('event_node') &&
    options?.restoreEmbeddedEvents !== false &&
    bundle.events.length > 0
  ) {
    const existingIds = await localStore.getEventIds();
    for (const ev of bundle.events) {
      if (ev.id === primaryEventId || ev.id === HUB_PRIMARY_EVENT_ID) continue;

      const evEngines = (ev.engines.filter((e) => validEngineSet.has(e)) as EngineId[]) || [
        'custom',
      ];
      const normalizedEvEngines: EngineId[] = evEngines.length > 0 ? evEngines : ['custom'];
      const finalId = ev.id || `evt-${normalizedEvEngines[0]}`;

      if (!existingIds.includes(finalId)) {
        const cfg = eventContainer.createEvent(
          ev.name,
          'weekly',
          ['01'],
          normalizedEvEngines
        );
        const finalConfig = {
          ...cfg,
          id: finalId,
          engineId: normalizedEvEngines[0],
          engines: normalizedEvEngines,
        };
        const st = eventContainer.createEventState(finalConfig);
        await localStore.saveEventState(finalId, st);
        await localStore.saveSkeleton(finalId, ev.registry);
        restoredEventIds.push(finalId);
      } else {
        const existingEvState = await localStore.loadEventState(finalId);
        if (existingEvState) {
          await localStore.saveEventState(finalId, {
            ...existingEvState,
            config: {
              ...existingEvState.config,
              name: ev.name || existingEvState.config.name,
              engineId: normalizedEvEngines[0],
              engines: normalizedEvEngines,
            },
          });
        }
        await localStore.saveSkeleton(finalId, ev.registry);
        restoredEventIds.push(finalId);
      }
    }
  }

  if (!primaryEventId && restoredEventIds.length > 0) {
    primaryEventId = restoredEventIds[0];
  }

  // 5. Synchronize `sekundo:events:v1` mirror for tree/event consumers & SIT diagnostics
  try {
    const allIds = await localStore.getEventIds();
    const mirrorList: any[] = [];
    for (const id of allIds) {
      const st = await localStore.loadEventState(id);
      if (!st) continue;
      const skel = (await localStore.loadSkeleton(id)) || [];
      const engs = getActiveEngines(st.config);
      const childNodes =
        skel.length > 1 &&
        (skel[0].type === 'group' || skel[0].type === 'root' || skel[0].type === 'header')
          ? skel.slice(1)
          : skel;
      mirrorList.push({
        id: st.config.id,
        title: st.config.name,
        name: st.config.name,
        engineId: st.config.engineId || engs[0] || 'custom',
        engines: engs,
        registry: skel,
        root: {
          id: `root-${st.config.id}`,
          type: 'group',
          label: skel[0]?.label || st.config.name,
          children: childNodes.map((n) => ({
            id: n.key,
            key: n.key,
            type: n.type,
            label: n.label,
            value: n.value,
            email: n.email || '',
            meta: n.meta || {},
          })),
        },
      });
    }
    const serializedMirror = JSON.stringify(mirrorList);
    writeWebLocalStorage(LEGACY_EVENTS_V1_STORAGE_KEY, serializedMirror);
    await localStore.storage.setItem(LEGACY_EVENTS_V1_STORAGE_KEY, serializedMirror);
  } catch {
    // ignore mirror error
  }

  return {
    bundle,
    primaryEventId,
    activeEngines,
    restoredEventIds,
  };
}


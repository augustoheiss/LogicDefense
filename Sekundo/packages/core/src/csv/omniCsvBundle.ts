/**
 * Sekundo — Unified Master CSV ("CSV Geral" / Omni-Bundle CSV) Engine
 *
 * Implements lossless bidirectional Round-Trip (`Export ⇄ Import`) in a single
 * RFC-4180 CSV spreadsheet across ALL Sekundo subsystems:
 * 1. `event_node`            — Events across all 9 Universal Engines
 * 2. `hub_schedule_slot`     — 📅 Programação & WhatsApp (Semanas, Blocos, Designações, Grupos 1–3)
 * 3. `hub_territory_cycle`   — 🗺️ Registro de Territórios Multi-Ciclo
 * 4. `participant_privilege` — 🛡️ Diretório de Usuários + Matriz de 26 Privilégios + Rotação
 * 5. `studio_document`       — 🖋️ Estúdio Documental YAML ⇄ PDF (Canvas mm, Fichas 4-Up)
 * 6. `cockpit_hoje`          — ☀️ Cockpit Hoje & Compositor (Rituais governados, sekundo.app.yaml)
 *
 * Also supports dedicated CSV Import/Export for `📅 Programação & WhatsApp` (`schedule-hub.tsx`)
 * so users can import `.csv` schedules, auto-assign or edit in the app, and immediately
 * download the updated `.csv` backup without manual spreadsheet editing.
 *
 * Skills: agency-software-architect, agency-clean-room-data-hygiene-engineer
 */

import type { FlatSkeletonEntry, NodeType } from '../skeleton/types';
import {
  type ParticipantProfile,
  normalizePersonKey,
} from '../roster/participantDirectory';
import {
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  createEmptyCapabilitiesMap,
  ensureParticipantPrivilegeMatrix,
  getEffectiveCapabilityColumns,
  resolveCapabilityKeyOrCustom,
} from '../roster/privilegeRotationEngine';
import {
  PROGRAMACAO_UNIT_NAME,
  buildProgramacaoReuniaoRegistry,
  buildTerritoriosS13HistoricalRegistry,
} from '../schedule/programacaoReuniaoSeed';
import {
  FICHAS_4UP_SDOC_YAML,
  TERRITORIOS_MULTICYCLE_SDOC_YAML,
} from '../doc/templates/builtinTemplates';
import { DEFAULT_SEKUNDO_APP_YAML } from '../composer/appManifest';
import { ENGINE_TEMPLATES } from './engineTemplates';

export type OmniRecordKind =
  | 'event_node'
  | 'hub_schedule_slot'
  | 'hub_territory_cycle'
  | 'participant_privilege'
  | 'studio_document'
  | 'cockpit_hoje';

export const OMNI_CSV_HEADERS = [
  '_record_kind',
  '_container_id',
  '_key',
  '_type',
  '_engines',
  'group_or_tier',
  'date_or_cycle',
  'time_or_duration',
  'title_or_name',
  'primary_assignee',
  'secondary_assignee',
  'status_or_readiness',
  'capabilities_or_tags',
  'contact_or_location',
  'notes_or_payload',
  '_meta_json',
] as const;

export type OmniCsvHeader = (typeof OMNI_CSV_HEADERS)[number];

export interface OmniEventBundleItem {
  id: string;
  name: string;
  engines: string[];
  registry: FlatSkeletonEntry[];
}

export interface OmniStudioDocItem {
  id: string;
  title: string;
  format: string;
  sdocYaml: string;
}

export interface OmniHojeRitualItem {
  id: string;
  title: string;
  frequency: string;
  status: string;
  notes?: string;
}

export interface SekundoOmniStateBundle {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
  events: OmniEventBundleItem[];
  studioDocuments: OmniStudioDocItem[];
  hojeManifestYaml: string;
  hojeRituals: OmniHojeRitualItem[];
}

/**
 * RFC-4180 CSV cell escaping.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * RFC-4180 compliant multi-line CSV parser returning header names and row objects.
 */
export function parseRawOmniCsvTable(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const clean = (csvText || '').replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell);
        matrix.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    matrix.push(currentRow);
  }

  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (line.every((cell) => cell.trim() === '')) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = line[c] ?? '';
    }
    rows.push(obj);
  }

  return { headers, rows };
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Serializes a complete or partial `SekundoOmniStateBundle` into a single RFC-4180 CSV string.
 */
export function exportOmniCsvBundle(input?: Partial<SekundoOmniStateBundle>): string {
  const unitName = input?.unitName || PROGRAMACAO_UNIT_NAME;
  const participants = (input?.participants || DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS).map(
    (p, idx) => ensureParticipantPrivilegeMatrix(p, idx)
  );
  const scheduleRegistry =
    input?.scheduleRegistry || buildProgramacaoReuniaoRegistry(undefined, participants);
  const territoryRegistry =
    input?.territoryRegistry || buildTerritoriosS13HistoricalRegistry();
  const events = input?.events || [];
  const studioDocuments = input?.studioDocuments || [
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
  ];
  const hojeManifestYaml = input?.hojeManifestYaml ?? DEFAULT_SEKUNDO_APP_YAML;
  const hojeRituals: OmniHojeRitualItem[] = input?.hojeRituals || [
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
  ];

  const lines: string[] = [OMNI_CSV_HEADERS.join(',')];

  const pushRow = (record: Record<OmniCsvHeader, unknown>) => {
    const cells = OMNI_CSV_HEADERS.map((h) => escapeCsvCell(record[h]));
    lines.push(cells.join(','));
  };

  // 1. Participant & Privilege Matrix rows (`participant_privilege`)
  for (const p of participants) {
    const activeCapKeys = Object.entries(p.capabilities || {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([k]) => k);
    pushRow({
      _record_kind: 'participant_privilege',
      _container_id: unitName,
      _key: p.id,
      _type: p.profileCategory || 'perfil_a',
      _engines: 'roster_assignments',
      group_or_tier: `${p.groupTag}|${p.roleTier || 'operador_base'}`,
      date_or_cycle: p.lastAssignedIsoDate || '',
      time_or_duration: String(p.assignmentCount ?? 0),
      title_or_name: p.name,
      primary_assignee: p.name,
      secondary_assignee: p.lastPartnerId || '',
      status_or_readiness: (p.statusFlags || []).join('|'),
      capabilities_or_tags: activeCapKeys.join('|'),
      contact_or_location: p.phone || p.email || '',
      notes_or_payload: (p.capabilityTags || []).join('|'),
      _meta_json: JSON.stringify(p),
    });
  }

  // 2. Schedule & WhatsApp Hub rows (`hub_schedule_slot`)
  for (const entry of scheduleRegistry) {
    const meta = (entry.meta || {}) as Record<string, any>;
    pushRow({
      _record_kind: 'hub_schedule_slot',
      _container_id: unitName,
      _key: entry.key,
      _type: entry.type,
      _engines: 'roster_assignments',
      group_or_tier: meta.groupTag || '',
      date_or_cycle: meta.sessionDate || '',
      time_or_duration: meta.durationMinutes ? `${meta.durationMinutes} min` : '',
      title_or_name: entry.label,
      primary_assignee: meta.assignedTo || meta.chairPerson || entry.value || '',
      secondary_assignee: meta.assistantTo || meta.openingPrayer || '',
      status_or_readiness: meta.readinessState || (meta.confirmed ? 'ready' : 'pending'),
      capabilities_or_tags: Array.isArray(meta.capabilityTags)
        ? meta.capabilityTags.join('|')
        : meta.requiredCapability || '',
      contact_or_location: meta.room || 'Auditório Principal',
      notes_or_payload: meta.closingPrayer || meta.sessionTheme || '',
      _meta_json: JSON.stringify(meta),
    });
  }

  // 3. Territory Multi-Cycle rows (`hub_territory_cycle`)
  for (const entry of territoryRegistry) {
    const meta = (entry.meta || {}) as Record<string, any>;
    pushRow({
      _record_kind: 'hub_territory_cycle',
      _container_id: unitName,
      _key: entry.key,
      _type: entry.type,
      _engines: 'territory_logistics',
      group_or_tier: meta.groupTag || '',
      date_or_cycle: meta.assignedAt || '',
      time_or_duration: meta.completedAt || meta.lastCompletedDate || '',
      title_or_name: entry.label,
      primary_assignee: meta.workerName || entry.value || '',
      secondary_assignee: '',
      status_or_readiness: meta.worked === 1 ? 'concluido' : 'em_campo',
      capabilities_or_tags: meta.property_type || 'residencial',
      contact_or_location: meta.locality || meta.neighborhood || '',
      notes_or_payload: meta.territoryNumber || '',
      _meta_json: JSON.stringify(meta),
    });
  }

  // 4. Studio Document YAML ⇄ PDF rows (`studio_document`)
  for (const doc of studioDocuments) {
    pushRow({
      _record_kind: 'studio_document',
      _container_id: doc.id,
      _key: doc.id,
      _type: 'document',
      _engines: 'DocumentEngine',
      group_or_tier: doc.format,
      date_or_cycle: '2026-10-17',
      time_or_duration: 'A4-mm',
      title_or_name: doc.title,
      primary_assignee: '',
      secondary_assignee: '',
      status_or_readiness: 'ready',
      capabilities_or_tags: 'yaml|pdf|4up|mm',
      contact_or_location: 'Estúdio Documental',
      notes_or_payload: String(doc.sdocYaml || '').replace(/\r?\n/g, '\\n'),
      _meta_json: JSON.stringify(doc),
    });
  }

  // 5. Cockpit Hoje & Composer rows (`cockpit_hoje`)
  pushRow({
    _record_kind: 'cockpit_hoje',
    _container_id: 'sekundo.app.yaml',
    _key: 'manifest',
    _type: 'root',
    _engines: 'custom',
    group_or_tier: 'compositor',
    date_or_cycle: '2026-10-17',
    time_or_duration: 'daily',
    title_or_name: 'Manifesto Declarativo sekundo.app.yaml',
    primary_assignee: '',
    secondary_assignee: '',
    status_or_readiness: 'active',
    capabilities_or_tags: 'hoje|compositor|yaml',
    contact_or_location: 'Cockpit Hoje',
    notes_or_payload: String(hojeManifestYaml || '').replace(/\r?\n/g, '\\n'),
    _meta_json: JSON.stringify({ kind: 'manifest', yaml: hojeManifestYaml }),
  });

  for (const ritual of hojeRituals) {
    pushRow({
      _record_kind: 'cockpit_hoje',
      _container_id: 'hoje-rituals',
      _key: ritual.id,
      _type: 'slot',
      _engines: 'action_tracker',
      group_or_tier: ritual.frequency,
      date_or_cycle: '',
      time_or_duration: ritual.frequency,
      title_or_name: ritual.title,
      primary_assignee: '',
      secondary_assignee: '',
      status_or_readiness: ritual.status,
      capabilities_or_tags: 'ritual_governado',
      contact_or_location: 'Cockpit Hoje',
      notes_or_payload: ritual.notes || '',
      _meta_json: JSON.stringify(ritual),
    });
  }

  // 6. Events across all 9 Universal Engines (`event_node`)
  for (const ev of events) {
    for (const node of ev.registry) {
      const meta = (node.meta || {}) as Record<string, any>;
      pushRow({
        _record_kind: 'event_node',
        _container_id: `${ev.id}::${ev.name}`,
        _key: node.key,
        _type: node.type,
        _engines: ev.engines.join('|'),
        group_or_tier: meta.groupTag || meta.category || '',
        date_or_cycle: meta.date || meta.assignedAt || '',
        time_or_duration: meta.durationMinutes ? String(meta.durationMinutes) : '',
        title_or_name: node.label,
        primary_assignee: meta.assignedTo || meta.workerName || node.value || '',
        secondary_assignee: meta.assistantTo || '',
        status_or_readiness: meta.status || (meta.worked === 1 ? 'worked' : ''),
        capabilities_or_tags: '',
        contact_or_location: node.email || meta.address || meta.room || '',
        notes_or_payload: node.value || '',
        _meta_json: JSON.stringify(meta),
      });
    }
  }

  return lines.join('\n');
}

/**
 * Demultiplexes an Omni-CSV string (or a single-engine / Schedule Hub CSV string)
 * back into a complete `SekundoOmniStateBundle`.
 */
const STANDARD_OMNI_HEADER_SET = new Set<string>(OMNI_CSV_HEADERS as unknown as string[]);

/**
 * Parses a participant's exact privilege map from a CSV row.
 * Guarantees that `capabilities_or_tags` (and any extra privilege columns in the CSV)
 * is the Single Source of Truth — never reviving deselected privileges from `_meta_json`
 * or `buildPresetCapabilities`.
 */
export function parseParticipantPrivilegesFromCsvRow(
  row: Record<string, string>,
  headers: string[] = [],
  meta: Record<string, any> = {}
): Record<string, boolean> {
  const capMap: Record<string, boolean> = createEmptyCapabilitiesMap();
  const hasCapabilitiesColumn =
    headers.length === 0 ||
    headers.includes('capabilities_or_tags') ||
    'capabilities_or_tags' in row;

  if (!hasCapabilitiesColumn && meta.capabilities && typeof meta.capabilities === 'object') {
    Object.assign(capMap, meta.capabilities);
  }

  const rawCapCell = (row.capabilities_or_tags || row.privilegios || row.privileges || '').trim();
  if (rawCapCell) {
    const delimiter = rawCapCell.includes('|')
      ? '|'
      : rawCapCell.includes(';')
      ? ';'
      : ',';
    const tokens = rawCapCell
      .split(delimiter)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const resolved = resolveCapabilityKeyOrCustom(token);
      if (resolved.key) {
        capMap[resolved.key] = resolved.enabled;
      }
    }
  }

  // Support extra privilege columns added directly in the spreadsheet
  for (const h of headers) {
    if (!h || STANDARD_OMNI_HEADER_SET.has(h)) continue;
    const rawVal = (row[h] ?? '').trim();
    if (!rawVal) continue;
    const cleanHeader = h.replace(/^(priv|privilegio|cap|capability)\s*[:_-]\s*/i, '').trim();
    if (!cleanHeader) continue;
    const resolved = resolveCapabilityKeyOrCustom(`${cleanHeader}=${rawVal}`);
    if (resolved.key) {
      capMap[resolved.key] = resolved.enabled;
    }
  }

  return capMap;
}

/**
 * Demultiplexes an Omni-CSV string (or a single-engine / Schedule Hub CSV string)
 * back into a complete `SekundoOmniStateBundle`.
 */
export function importOmniCsvBundle(csvText: string): SekundoOmniStateBundle {
  const { headers, rows } = parseRawOmniCsvTable(csvText);

  let unitName = PROGRAMACAO_UNIT_NAME;
  const participants: ParticipantProfile[] = [];
  const scheduleRegistry: FlatSkeletonEntry[] = [];
  const territoryRegistry: FlatSkeletonEntry[] = [];
  const eventsMap = new Map<string, OmniEventBundleItem>();
  const studioDocuments: OmniStudioDocItem[] = [];
  let hojeManifestYaml = DEFAULT_SEKUNDO_APP_YAML;
  const hojeRituals: OmniHojeRitualItem[] = [];

  const isOmniSchema = headers.includes('_record_kind');

  if (!isOmniSchema) {
    // Fallback for standard single-engine or Schedule Hub simplified CSV
    const hubParsed = importScheduleHubFromCsv(csvText);
    return {
      unitName: hubParsed.unitName,
      participants: hubParsed.participants,
      scheduleRegistry: hubParsed.scheduleRegistry,
      territoryRegistry: hubParsed.territoryRegistry,
      events: [],
      studioDocuments: [],
      hojeManifestYaml,
      hojeRituals: [],
    };
  }

  for (const row of rows) {
    const kind = (row._record_kind || '').trim() as OmniRecordKind;
    const containerId = (row._container_id || '').trim();
    const key = (row._key || '').trim();
    const type = ((row._type || 'slot').trim() as NodeType) || 'slot';
    const title = row.title_or_name || '';
    const primary = row.primary_assignee || '';
    const secondary = row.secondary_assignee || '';
    const meta = safeJsonParse<Record<string, any>>(row._meta_json, {});

    if (kind === 'participant_privilege') {
      if (containerId) unitName = containerId;
      const [groupPart, tierPart] = (row.group_or_tier || 'Grupo 1|operador_base').split('|');
      const capMap = parseParticipantPrivilegesFromCsvRow(row, headers, meta);

      const statusFlags = (row.status_or_readiness || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean) as any[];

      const profile: ParticipantProfile = ensureParticipantPrivilegeMatrix(
        {
          ...meta,
          id: key || meta.id || `p-${participants.length + 1}`,
          name: title || primary || meta.name || `Participante ${participants.length + 1}`,
          groupTag: groupPart || meta.groupTag || 'Grupo 1',
          profileCategory: (
            row._type === 'perfil_b'
              ? 'perfil_b'
              : row._type === 'perfil_a'
              ? 'perfil_a'
              : meta.profileCategory || 'perfil_a'
          ) as any,
          roleTier: (tierPart || meta.roleTier || 'operador_base') as any,
          statusFlags: statusFlags.length > 0 ? statusFlags : meta.statusFlags,
          capabilities: capMap,
          capabilityTags: (row.notes_or_payload || '')
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean),
          lastAssignedIsoDate: row.date_or_cycle || meta.lastAssignedIsoDate || '',
          assignmentCount: parseInt(row.time_or_duration || '0', 10) || meta.assignmentCount || 0,
          lastPartnerId: secondary || meta.lastPartnerId || undefined,
          preserveExplicitCapabilities: true,
        },
        participants.length,
        { preserveExplicitCapabilities: true }
      );
      participants.push(profile);
    } else if (kind === 'hub_schedule_slot') {
      if (containerId) unitName = containerId;
      const mergedMeta: Record<string, any> = {
        ...meta,
        _enginePartition: 'roster_assignments',
      };
      if (row.group_or_tier) mergedMeta.groupTag = row.group_or_tier;
      if (row.date_or_cycle) mergedMeta.sessionDate = row.date_or_cycle;
      if (row.time_or_duration) {
        const mins = parseInt(row.time_or_duration, 10);
        if (!Number.isNaN(mins)) mergedMeta.durationMinutes = mins;
      }
      if (row.status_or_readiness) {
        mergedMeta.readinessState = row.status_or_readiness;
        mergedMeta.confirmed = row.status_or_readiness === 'ready';
      }
      if (row.contact_or_location) mergedMeta.room = row.contact_or_location;

      let value = primary;
      if (type === 'header' && key.split('-').length === 1) {
        if (primary) mergedMeta.chairPerson = primary;
        if (secondary) mergedMeta.openingPrayer = secondary;
        if (row.notes_or_payload && !mergedMeta.closingPrayer) {
          mergedMeta.closingPrayer = row.notes_or_payload;
        }
      } else if (type === 'slot') {
        if (primary) mergedMeta.assignedTo = primary;
        if (secondary) {
          mergedMeta.assistantTo = secondary;
          value = `${primary} / ${secondary}`;
        } else {
          delete mergedMeta.assistantTo;
        }
      }

      scheduleRegistry.push({
        key,
        type,
        label: title,
        value,
        email: '',
        meta: mergedMeta,
      });
    } else if (kind === 'hub_territory_cycle') {
      if (containerId) unitName = containerId;
      const mergedMeta: Record<string, any> = {
        ...meta,
        _enginePartition: 'territory_logistics',
      };
      if (primary) mergedMeta.workerName = primary;
      if (row.group_or_tier) mergedMeta.groupTag = row.group_or_tier;
      if (row.date_or_cycle) mergedMeta.assignedAt = row.date_or_cycle;
      if (row.time_or_duration) mergedMeta.completedAt = row.time_or_duration;
      if (row.status_or_readiness) {
        mergedMeta.worked = row.status_or_readiness === 'concluido' ? 1 : 0;
      }

      territoryRegistry.push({
        key,
        type: 'territory',
        label: title,
        value: primary,
        email: '',
        meta: mergedMeta,
      });
    } else if (kind === 'studio_document') {
      const rawYaml = row.notes_or_payload
        ? row.notes_or_payload.replace(/\\n/g, '\n')
        : meta.sdocYaml || '';
      studioDocuments.push({
        id: key || containerId || `doc-${studioDocuments.length + 1}`,
        title: title || 'Documento SDOC',
        format: row.group_or_tier || 'A4-Portrait-mm',
        sdocYaml: rawYaml,
      });
    } else if (kind === 'cockpit_hoje') {
      if (key === 'manifest' || containerId === 'sekundo.app.yaml') {
        hojeManifestYaml = row.notes_or_payload
          ? row.notes_or_payload.replace(/\\n/g, '\n')
          : meta.yaml || DEFAULT_SEKUNDO_APP_YAML;
      } else {
        hojeRituals.push({
          id: key || `ritual-${hojeRituals.length + 1}`,
          title: title || 'Ritual Governado',
          frequency: row.group_or_tier || 'weekly',
          status: row.status_or_readiness || 'active',
          notes: row.notes_or_payload || '',
        });
      }
    } else if (kind === 'event_node') {
      const [rawId, rawName] = containerId.includes('::')
        ? containerId.split('::')
        : [containerId || 'evt-01', containerId || 'Evento Importado'];
      const engines = (row._engines || 'custom')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);

      let ev = eventsMap.get(rawId);
      if (!ev) {
        ev = { id: rawId, name: rawName, engines, registry: [] };
        eventsMap.set(rawId, ev);
      }

      const mergedMeta: Record<string, any> = { ...meta };
      if (primary && !mergedMeta.assignedTo && !mergedMeta.workerName) {
        mergedMeta.assignedTo = primary;
      }
      if (secondary) mergedMeta.assistantTo = secondary;

      ev.registry.push({
        key,
        type,
        label: title,
        value: row.notes_or_payload || primary || '',
        email: row.contact_or_location?.includes('@') ? row.contact_or_location : '',
        meta: mergedMeta,
      });
    }
  }

  // Synchronize all discovered custom capabilities across all imported participants
  // so every participant has an explicit boolean (`true` or `false`) for every custom privilege
  if (participants.length > 0) {
    const allEffectiveCols = getEffectiveCapabilityColumns(participants);
    for (const p of participants) {
      const nextCaps: Record<string, boolean> = { ...(p.capabilities || {}) };
      for (const col of allEffectiveCols) {
        nextCaps[col.key] = Boolean(nextCaps[col.key]);
      }
      p.capabilities = nextCaps;
    }
  }

  return {
    unitName,
    participants:
      participants.length > 0 ? participants : DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    scheduleRegistry:
      scheduleRegistry.length > 0
        ? scheduleRegistry
        : buildProgramacaoReuniaoRegistry(
            undefined,
            participants.length > 0 ? participants : DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
          ),
    territoryRegistry:
      territoryRegistry.length > 0
        ? territoryRegistry
        : buildTerritoriosS13HistoricalRegistry(),
    events: Array.from(eventsMap.values()),
    studioDocuments,
    hojeManifestYaml,
    hojeRituals,
  };
}

/**
 * Builds a single partitioned `FlatSkeletonEntry[]` from a Multi-Engine Omni-CSV bundle
 * so that a single imported Event Container holds both `roster_assignments` (Schedule)
 * and `territory_logistics` (Territories) without key collisions.
 */
export function buildCombinedMultiEngineSkeleton(
  bundle: Partial<SekundoOmniStateBundle>
): FlatSkeletonEntry[] {
  const schedulePart = (bundle.scheduleRegistry || []).map((entry) => ({
    ...entry,
    meta: {
      ...(entry.meta || {}),
      _enginePartition: 'roster_assignments',
    },
  }));

  const territoryPart = (bundle.territoryRegistry || []).map((entry, idx) => {
    const rawOrig = (entry.meta as any)?._originalKey || entry.key.replace(/^(T::|90-)/, '');
    const numericSuffix = /^\d+(-\d+)*$/.test(rawOrig)
      ? rawOrig
      : String(idx + 1).padStart(2, '0');
    const prefixedKey = `90-${numericSuffix}`;
    return {
      ...entry,
      key: prefixedKey,
      type: entry.type || 'territory',
      meta: {
        ...(entry.meta || {}),
        _enginePartition: 'territory_logistics',
        _originalKey: rawOrig,
      },
    };
  });

  return [...schedulePart, ...territoryPart];
}

/**
 * Selects only the `FlatSkeletonEntry[]` belonging to a target Engine partition
 * (`'territory_logistics'` or `'roster_assignments'`).
 * Prevents Territory views from rendering meeting blocks as streets/houses and
 * prevents Schedule views from rendering territory blocks as meeting parts.
 */
export function selectEnginePartitionNodes(
  registry: FlatSkeletonEntry[],
  engineId: 'territory_logistics' | 'roster_assignments' | string
): FlatSkeletonEntry[] {
  if (!Array.isArray(registry) || registry.length === 0) return [];

  if (engineId === 'territory_logistics') {
    const partitionedTerritoryNodes = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        meta._enginePartition === 'territory_logistics' ||
        e.key.startsWith('90-') ||
        e.key.startsWith('T::')
      );
    });

    if (partitionedTerritoryNodes.length > 0) {
      return partitionedTerritoryNodes.map((e) => {
        const meta = { ...(e.meta || {}) } as Record<string, any>;
        const cleanKey = meta._originalKey || e.key.replace(/^(T::|90-)/, '');
        return {
          ...e,
          key: cleanKey,
          meta,
        };
      });
    }

    const nonScheduleNodes = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return meta._enginePartition !== 'roster_assignments';
    });

    const hasTerritoryLeafOrPolygon = nonScheduleNodes.some((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        e.type === 'territory' ||
        Boolean(meta.boundary_polygon) ||
        Boolean(meta.territory_number)
      );
    });

    if (hasTerritoryLeafOrPolygon) {
      return nonScheduleNodes;
    }

    // Check if the unpartitioned registry actually consists of Schedule/Meeting nodes
    const looksLikeSchedule = nonScheduleNodes.some((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      return (
        Boolean(meta.chairPerson) ||
        Boolean(meta.openingPrayer) ||
        Boolean(meta.sessionDate) ||
        /BLOCO\s+[123]\s+—|SEMANA\s+\d+/i.test(e.label || '')
      );
    });

    if (looksLikeSchedule) {
      return [];
    }

    return nonScheduleNodes;
  }

  if (engineId === 'roster_assignments') {
    const filtered = registry.filter((e) => {
      const meta = (e.meta || {}) as Record<string, any>;
      if (meta._enginePartition === 'territory_logistics') return false;
      if (e.key.startsWith('90-') || e.key.startsWith('T::')) return false;
      if (e.type === 'territory') return false;
      return true;
    });
    return filtered;
  }

  return registry;
}

/**
 * Automatically derives all active Engine IDs contained in an imported `SekundoOmniStateBundle`.
 */
export function deriveActiveEnginesFromOmniBundle(
  bundle: Partial<SekundoOmniStateBundle>
): string[] {
  const engines = new Set<string>();
  if ((bundle.scheduleRegistry?.length || 0) > 0 || (bundle.participants?.length || 0) > 0) {
    engines.add('roster_assignments');
  }
  if ((bundle.territoryRegistry?.length || 0) > 0) {
    engines.add('territory_logistics');
  }
  for (const ev of bundle.events || []) {
    for (const eng of ev.engines || []) {
      if (eng && eng.trim()) {
        engines.add(eng.trim());
      }
    }
  }
  if ((bundle.studioDocuments?.length || 0) > 0) {
    engines.add('DocumentEngine');
  }
  if ((bundle.hojeRituals?.length || 0) > 0) {
    engines.add('action_tracker');
  }
  if (engines.size === 0) {
    engines.add('roster_assignments');
    engines.add('territory_logistics');
  }
  return Array.from(engines);
}

/**
 * Dedicated CSV export for `📅 Programação & WhatsApp` (`schedule-hub.tsx`).
 * Exports participants + privileges, weekly schedule slots, and territory cycles
 * in the exact Omni-CSV format so re-importing is 100% lossless.
 */
export function exportScheduleHubToCsv(params: {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
}): string {
  return exportOmniCsvBundle({
    unitName: params.unitName,
    participants: params.participants,
    scheduleRegistry: params.scheduleRegistry,
    territoryRegistry: params.territoryRegistry,
    events: [],
    studioDocuments: [],
    hojeRituals: [],
  });
}

/**
 * Dedicated CSV import for `📅 Programação & WhatsApp` (`schedule-hub.tsx`).
 * Accepts either:
 * 1. An Omni-CSV / Schedule Hub CSV (`_record_kind` header)
 * 2. A canonical `_key,_type,label,value` CSV
 */
export function importScheduleHubFromCsv(csvText: string): {
  unitName: string;
  participants: ParticipantProfile[];
  scheduleRegistry: FlatSkeletonEntry[];
  territoryRegistry: FlatSkeletonEntry[];
} {
  const { headers, rows } = parseRawOmniCsvTable(csvText);
  if (headers.includes('_record_kind')) {
    const bundle = importOmniCsvBundle(csvText);
    return {
      unitName: bundle.unitName,
      participants: bundle.participants,
      scheduleRegistry: bundle.scheduleRegistry,
      territoryRegistry: bundle.territoryRegistry,
    };
  }

  // Support canonical `_key,_type,label,value` or human schedule CSV
  const scheduleRegistry: FlatSkeletonEntry[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r._key || r.key || String(i + 1).padStart(2, '0');
    const rawType = (r._type || r.tipo || 'slot').toLowerCase();
    const type: NodeType =
      rawType === 'header' || rawType === 'sessao' || rawType === 'secao'
        ? 'header'
        : 'slot';
    const label = r.label || r.parte || r.nome || r.title_or_name || `Item ${key}`;
    const primary = r.value || r.designado || r.primary_assignee || '';
    const assistant = r.assistente || r.secondary_assignee || '';
    const meta = safeJsonParse<Record<string, any>>(r._meta_json, {});
    if (primary) meta.assignedTo = primary;
    if (assistant) meta.assistantTo = assistant;
    if (r.duracao_min) meta.durationMinutes = parseInt(r.duracao_min, 10) || 10;
    if (r.sala) meta.room = r.sala;
    if (r.grupo) meta.groupTag = r.grupo;

    scheduleRegistry.push({
      key,
      type,
      label,
      value: assistant ? `${primary} / ${assistant}` : primary,
      email: r.email || '',
      meta,
    });
  }

  return {
    unitName: PROGRAMACAO_UNIT_NAME,
    participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    scheduleRegistry:
      scheduleRegistry.length > 0
        ? scheduleRegistry
        : buildProgramacaoReuniaoRegistry(undefined, DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS),
    territoryRegistry: buildTerritoriosS13HistoricalRegistry(),
  };
}

/**
 * Generates the complete sample **CSV GERAL (`sekundo_omni_geral.csv`)** containing:
 * - All 24 Clean-Room Participants with their 26-column Privilege Matrix
 * - The 9-Week Schedule & WhatsApp Hub (`📅 Programação & WhatsApp`)
 * - The 16 Multi-Cycle Territories (`🗺️ Registro de Territórios`)
 * - Document Studio YAML ⇄ PDF Templates (`🖋️ Estúdio Documental`)
 * - Cockpit Hoje & Composer (`☀️ Cockpit Hoje`)
 * - Sample Events across all Universal Engines (`territory_logistics`, `roster_assignments`,
 *   `study_synthesis`, `financial_ledger`, `inventory_assets`, `action_tracker`, `custom_generic`, `DocumentEngine`)
 */
export function generateOmniMasterSampleCsv(): string {
  const sampleEvents: OmniEventBundleItem[] = Object.values(ENGINE_TEMPLATES).map(
    (tpl, idx) => {
      const { rows } = parseRawOmniCsvTable(tpl.canonicalCsv);
      const registry: FlatSkeletonEntry[] = rows.map((r) => ({
        key: r._key || '01',
        type: (r._type as NodeType) || 'leaf',
        label: r.label || tpl.name,
        value: r.value || '',
        email: r.email || '',
        meta: safeJsonParse<Record<string, any>>(r._meta_json, {}),
      }));
      return {
        id: `evt-sample-${idx + 1}`,
        name: `Exemplo ${tpl.name}`,
        engines: [tpl.engineId],
        registry,
      };
    }
  );

  return exportOmniCsvBundle({
    unitName: PROGRAMACAO_UNIT_NAME,
    participants: DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
    scheduleRegistry: buildProgramacaoReuniaoRegistry(
      undefined,
      DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS
    ),
    territoryRegistry: buildTerritoriosS13HistoricalRegistry(),
    events: sampleEvents,
  });
}

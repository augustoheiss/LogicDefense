/**
 * Sekundo — In-App Territory CRUD, Partition Reconciliation & Zero-Bureaucracy Location Sharing Engine
 *
 * Pure deterministic domain operations for:
 * 1. Renaming and renumbering territories and quadras in cascade (`renameOrRenumberTerritory`).
 * 2. Creating new territories, quadras, and addresses directly in-app (`createTerritoryOrQuadra`, `createAddressInTerritory`).
 * 3. Reconciling clean territory nodes with multi-engine partitioned raw registries (`mergeTerritoryPartitionIntoRawRegistry`).
 * 4. Exporting updated territory models to human-editable S-13 CSV (`buildTerritoryModelCsvText`).
 * 5. Zero-bureaucracy location sharing for individual addresses, quadras, and whole territories (`formatShareAddressLocationText`, `formatShareTerritoryOrQuadraLocationsText`).
 */

import type { FlatSkeletonEntry } from '../skeleton/types';
import * as pathKey from '../skeleton/pathKey';
import { resolveTerritoryNumber, parseLatLng } from '../geo/geoUtils';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsSearchUrl } from '../geo/googleMapsLinks';
import { parseAddressLine } from '../geo/quadraPolygonEngine';

export interface TerritoryIdentitySummary {
  territoryNumber: string;
  territoryName: string;
  city: string;
  quadraKeys: string[];
  totalNodes: number;
  totalAddresses: number;
  workedAddresses: number;
}

export interface RenameOrRenumberTerritoryPatch {
  newTerritoryNumber: string;
  newTerritoryName?: string;
  newCity?: string;
  targetGroupKey?: string;
  newGroupLabel?: string;
  scope?: 'territory' | 'quadra';
}

export interface CreateTerritoryOrQuadraInput {
  territoryNumber: string;
  territoryName: string;
  quadraKey?: string;
  quadraLabel?: string;
  city?: string;
  state?: string;
  initialAddress?: {
    street: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    postalcode?: string;
    lat?: number | string;
    lng?: number | string;
    propertyType?: 'residencial' | 'comercial' | 'predio' | 'outro';
    notes?: string;
  };
}

export interface CreateAddressInTerritoryInput {
  territoryNumber: string;
  territoryName?: string;
  groupKey?: string;
  groupLabel?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalcode?: string;
  lat?: number | string;
  lng?: number | string;
  propertyType?: 'residencial' | 'comercial' | 'predio' | 'outro';
  isForeign?: boolean;
  language?: string;
  notes?: string;
}

export interface ShareFormattedPayload {
  title: string;
  text: string;
  mapsUrl: string;
  whatsappUrl: string;
}

function normalizeTerritoryId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '01';
  if (/^\d+$/.test(trimmed) && trimmed.length === 1) {
    return trimmed.padStart(2, '0');
  }
  return trimmed;
}

function safeNormalizeKey(rawKey: string): string {
  const cleaned = pathKey.normalizeKey(rawKey || '');
  try {
    return pathKey.serialize(pathKey.parse(cleaned));
  } catch {
    return cleaned;
  }
}

function safeSegments(rawKey: string): string[] {
  const cleaned = pathKey.normalizeKey(rawKey || '');
  return cleaned ? cleaned.split('-').filter(Boolean) : [];
}

function safeDepth(rawKey: string): number {
  try {
    return pathKey.depth(rawKey);
  } catch {
    return Math.max(1, safeSegments(rawKey).length);
  }
}

function safeParentKey(rawKey: string): string | null {
  try {
    return pathKey.parent(rawKey);
  } catch {
    const segs = safeSegments(rawKey);
    if (segs.length <= 1) return null;
    return segs.slice(0, -1).join('-');
  }
}

function safeRootKey(rawKey: string): string {
  try {
    return pathKey.root(rawKey);
  } catch {
    const segs = safeSegments(rawKey);
    return segs[0] || rawKey;
  }
}

function safeKeysEqual(a: string, b: string): boolean {
  try {
    return pathKey.equals(a, b);
  } catch {
    return safeNormalizeKey(a) === safeNormalizeKey(b);
  }
}

function allocateNextNumericRootKey(
  cleanNodes: FlatSkeletonEntry[],
  preferredNumberStr?: string
): string {
  const usedRoots = new Set<number>();
  for (const node of cleanNodes) {
    const rootSeg = safeRootKey(node.key);
    const num = parseInt(rootSeg.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      usedRoots.add(num);
    }
  }

  const preferredDigits = (preferredNumberStr || '').replace(/\D/g, '');
  const preferredNum = preferredDigits ? parseInt(preferredDigits, 10) : NaN;
  if (!isNaN(preferredNum) && preferredNum > 0 && !usedRoots.has(preferredNum)) {
    return String(preferredNum).padStart(2, '0');
  }

  let candidate = !isNaN(preferredNum) && preferredNum > 0 ? preferredNum : 1;
  while (usedRoots.has(candidate)) {
    candidate += 1;
  }
  return String(candidate).padStart(2, '0');
}

function parseOptionalCoord(val: number | string | undefined | null): number | undefined {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(',', '.');
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Resolves the human-readable name/locality of a territory from its nodes.
 */
export function resolveTerritoryNameFromNodes(
  cleanNodes: FlatSkeletonEntry[],
  territoryNumber: string
): string {
  const target = normalizeTerritoryId(territoryNumber);
  for (const node of cleanNodes) {
    if (resolveTerritoryNumber(node) !== target) continue;
    const meta = (node.meta || {}) as Record<string, any>;
    const explicitName = String(
      meta.territory_name || meta.locality || meta.neighborhood || meta.bairro || ''
    ).trim();
    if (explicitName) return explicitName;
  }
  for (const node of cleanNodes) {
    if (resolveTerritoryNumber(node) !== target) continue;
    if (safeDepth(node.key) === 1 && node.label) {
      const stripped = node.label
        .replace(/^Territ[oó]rio\s+[0-9A-Za-z_-]+\s*[-—•:]?\s*/i, '')
        .replace(/^Quadra\s+[0-9A-Za-z_-]+\s*[-—•:]?\s*/i, '')
        .trim();
      if (stripped && stripped !== target) return stripped;
    }
  }
  return '';
}

/**
 * Extracts a structured summary of all territories present in a clean registry.
 */
export function extractTerritorySummaries(
  cleanNodes: FlatSkeletonEntry[]
): TerritoryIdentitySummary[] {
  const parentKeys = new Set<string>();
  for (const item of cleanNodes) {
    const p = safeParentKey(item.key);
    if (p) {
      parentKeys.add(safeNormalizeKey(p));
    }
  }

  const byTerritory = new Map<
    string,
    {
      territoryName: string;
      city: string;
      quadraKeys: Set<string>;
      totalNodes: number;
      totalAddresses: number;
      workedAddresses: number;
    }
  >();

  for (const node of cleanNodes) {
    const tNum = resolveTerritoryNumber(node);
    const meta = (node.meta || {}) as Record<string, any>;
    let entry = byTerritory.get(tNum);
    if (!entry) {
      entry = {
        territoryName: '',
        city: '',
        quadraKeys: new Set<string>(),
        totalNodes: 0,
        totalAddresses: 0,
        workedAddresses: 0,
      };
      byTerritory.set(tNum, entry);
    }

    entry.totalNodes += 1;
    const candidateName = String(
      meta.territory_name || meta.locality || meta.neighborhood || meta.bairro || ''
    ).trim();
    if (!entry.territoryName && candidateName) {
      entry.territoryName = candidateName;
    }

    const candidateCity = String(meta.city || meta.cidade || '').trim();
    if (!entry.city && candidateCity) {
      entry.city = candidateCity;
    }

    const groupKey = safeRootKey(node.key);
    entry.quadraKeys.add(groupKey);

    const normKey = safeNormalizeKey(node.key);
    const isHeaderOnly =
      parentKeys.has(normKey) || (safeDepth(node.key) === 1 && node.type === 'header');
    if (!isHeaderOnly) {
      entry.totalAddresses += 1;
      if (Number(meta.worked) === 1) {
        entry.workedAddresses += 1;
      }
    }
  }

  return Array.from(byTerritory.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([territoryNumber, data]) => ({
      territoryNumber,
      territoryName:
        data.territoryName || resolveTerritoryNameFromNodes(cleanNodes, territoryNumber),
      city: data.city,
      quadraKeys: Array.from(data.quadraKeys),
      totalNodes: data.totalNodes,
      totalAddresses: data.totalAddresses,
      workedAddresses: data.workedAddresses,
    }));
}

/**
 * Atomically renames and/or renumbers a territory (or specific quadra) across all matching nodes.
 * Preserves all visit history, worked flags, coordinates, and polygons.
 */
export function renameOrRenumberTerritory(
  cleanNodes: FlatSkeletonEntry[],
  targetTerritoryNumber: string,
  patch: RenameOrRenumberTerritoryPatch
): FlatSkeletonEntry[] {
  const currentTerr = normalizeTerritoryId(targetTerritoryNumber);
  const nextTerr = normalizeTerritoryId(patch.newTerritoryNumber || targetTerritoryNumber);
  const nextName =
    patch.newTerritoryName !== undefined ? patch.newTerritoryName.trim() : undefined;
  const nextCity = patch.newCity !== undefined ? patch.newCity.trim() : undefined;
  const nextGroupLabel =
    patch.newGroupLabel !== undefined ? patch.newGroupLabel.trim() : undefined;
  const scope = patch.scope || 'territory';

  return cleanNodes.map((node) => {
    const nodeTerr = resolveTerritoryNumber(node);
    const rootKey = safeRootKey(node.key);

    const matchesTerritory = nodeTerr === currentTerr;
    const matchesQuadra = patch.targetGroupKey
      ? safeKeysEqual(rootKey, patch.targetGroupKey) ||
        safeKeysEqual(node.key, patch.targetGroupKey)
      : false;

    if (scope === 'quadra' && patch.targetGroupKey) {
      if (!matchesQuadra) return node;
    } else {
      if (!matchesTerritory && !matchesQuadra) return node;
    }

    const oldMeta = (node.meta || {}) as Record<string, any>;
    const updatedMeta: Record<string, any> = {
      ...oldMeta,
      territoryNumber: nextTerr,
      territory_number: nextTerr,
      territory: nextTerr,
      engine_id: 'territory_logistics',
    };

    if (nextName !== undefined) {
      updatedMeta.territory_name = nextName;
      updatedMeta.locality = nextName;
      if (!updatedMeta.neighborhood && nextName) {
        updatedMeta.neighborhood = nextName;
      }
      if (!updatedMeta.line2 && nextName) {
        updatedMeta.line2 = nextName;
      }
    }

    if (nextCity !== undefined && nextCity.length > 0) {
      updatedMeta.city = nextCity;
    }

    let nextLabel = node.label;
    const isGroupHeader = safeDepth(node.key) === 1;

    if (isGroupHeader) {
      if (matchesQuadra && nextGroupLabel) {
        nextLabel = nextGroupLabel;
      } else if (nextName !== undefined && nextName.length > 0) {
        if (matchesQuadra && !nextGroupLabel) {
          nextLabel = `Território ${nextTerr} — ${nextName}`;
        } else if (!patch.targetGroupKey || matchesTerritory) {
          const hadQuadraMention = /quadra/i.test(node.label || '');
          nextLabel = hadQuadraMention
            ? `${node.label.split('—')[0].trim()} — ${nextName}`
            : `Território ${nextTerr} — ${nextName}`;
        }
      } else if (nextTerr !== currentTerr && node.label) {
        nextLabel = node.label.replace(
          new RegExp(`\\b${currentTerr}\\b`),
          nextTerr
        );
      }
    }

    return {
      ...node,
      label: nextLabel,
      meta: updatedMeta,
    };
  });
}

/**
 * Creates a new Territory (or a new Quadra inside an existing Territory) along with an initial address node
 * so that it immediately appears in Territory Checklist, Publisher (Prancheta), and Map views.
 */
export function createTerritoryOrQuadra(
  cleanNodes: FlatSkeletonEntry[],
  input: CreateTerritoryOrQuadraInput
): {
  nodes: FlatSkeletonEntry[];
  headerKey: string;
  addressKey: string;
} {
  const territoryNumber = normalizeTerritoryId(input.territoryNumber);
  const territoryName = (input.territoryName || '').trim() || `Território ${territoryNumber}`;
  const city = (input.city || '').trim() || 'São Paulo';
  const state = (input.state || '').trim() || 'SP';

  const headerKey = allocateNextNumericRootKey(
    cleanNodes,
    input.quadraKey || territoryNumber
  );

  const headerLabel =
    (input.quadraLabel || '').trim() ||
    `Território ${territoryNumber} — ${territoryName}`;

  const initAddr = input.initialAddress;
  const street = (initAddr?.street || '').trim() || `Rua Principal (${territoryName})`;
  const numberStr = (initAddr?.number || '').trim() || '100';
  const neighborhood = (initAddr?.neighborhood || '').trim() || territoryName;
  const line = numberStr ? `${street}, ${numberStr}` : street;
  const lat = parseOptionalCoord(initAddr?.lat);
  const lng = parseOptionalCoord(initAddr?.lng);

  const headerNode: FlatSkeletonEntry = {
    key: headerKey,
    type: 'header',
    label: headerLabel,
    value: '',
    email: '',
    meta: {
      engine_id: 'territory_logistics',
      territoryNumber,
      territory_number: territoryNumber,
      territory: territoryNumber,
      territory_name: territoryName,
      locality: territoryName,
      neighborhood,
      city,
      state,
      worked: 0,
    },
  };

  const addressKey = `${headerKey}-01`;
  const addressNode: FlatSkeletonEntry = {
    key: addressKey,
    type: 'territory',
    label: `${line} (${neighborhood})`,
    value: '',
    email: '',
    meta: {
      engine_id: 'territory_logistics',
      territoryNumber,
      territory_number: territoryNumber,
      territory: territoryNumber,
      territory_name: territoryName,
      locality: territoryName,
      street,
      number: numberStr,
      line,
      line2: neighborhood,
      neighborhood,
      city,
      state,
      postalcode: (initAddr?.postalcode || '').trim(),
      property_type: initAddr?.propertyType || 'residencial',
      lat,
      lng,
      notes: (initAddr?.notes || '').trim(),
      worked: 0,
      custom_Order: 1,
    },
  };

  return {
    nodes: [...cleanNodes, headerNode, addressNode],
    headerKey,
    addressKey,
  };
}

/**
 * Adds a new address unit to an existing territory/quadra (or creates the quadra header if missing).
 */
export function createAddressInTerritory(
  cleanNodes: FlatSkeletonEntry[],
  input: CreateAddressInTerritoryInput
): {
  nodes: FlatSkeletonEntry[];
  createdKey: string;
  groupKey: string;
} {
  const territoryNumber = normalizeTerritoryId(input.territoryNumber);
  const existingTerritoryName =
    (input.territoryName || '').trim() ||
    resolveTerritoryNameFromNodes(cleanNodes, territoryNumber) ||
    `Território ${territoryNumber}`;

  // Resolve target groupKey
  let groupKey = (input.groupKey || '').trim();
  if (!groupKey) {
    const existingForTerritory = cleanNodes.find(
      (n) => resolveTerritoryNumber(n) === territoryNumber
    );
    if (existingForTerritory) {
      groupKey = safeRootKey(existingForTerritory.key);
    } else {
      groupKey = allocateNextNumericRootKey(cleanNodes, territoryNumber);
    }
  } else {
    groupKey = safeRootKey(groupKey);
    if (!/^\d+$/.test(groupKey)) {
      groupKey = allocateNextNumericRootKey(cleanNodes, territoryNumber);
    }
  }
  groupKey = safeNormalizeKey(groupKey);

  const nextNodes = [...cleanNodes];
  const hasGroupHeader = nextNodes.some((n) => safeKeysEqual(n.key, groupKey));

  const siblingNodes = nextNodes.filter(
    (n) =>
      safeKeysEqual(safeRootKey(n.key), groupKey) ||
      resolveTerritoryNumber(n) === territoryNumber
  );
  const firstSiblingMeta = (siblingNodes[0]?.meta || {}) as Record<string, any>;

  const city =
    (input.city || '').trim() ||
    String(firstSiblingMeta.city || firstSiblingMeta.cidade || 'São Paulo');
  const state =
    (input.state || '').trim() ||
    String(firstSiblingMeta.state || firstSiblingMeta.uf || 'SP');
  const neighborhood =
    (input.neighborhood || '').trim() ||
    existingTerritoryName ||
    String(firstSiblingMeta.neighborhood || firstSiblingMeta.line2 || '');

  // If the matching root node was a standalone single-node territory (e.g., S-13 seed "01"),
  // convert/ensure a proper header + child structure or attach child under "01"
  if (!hasGroupHeader) {
    nextNodes.push({
      key: groupKey,
      type: 'header',
      label:
        (input.groupLabel || '').trim() ||
        `Território ${territoryNumber} — ${existingTerritoryName}`,
      value: '',
      email: '',
      meta: {
        engine_id: 'territory_logistics',
        territoryNumber,
        territory_number: territoryNumber,
        territory: territoryNumber,
        territory_name: existingTerritoryName,
        locality: existingTerritoryName,
        neighborhood,
        city,
        state,
        worked: 0,
      },
    });
  }

  // Compute next child index under groupKey
  let maxChildSeq = 0;
  for (const node of nextNodes) {
    const segs = safeSegments(node.key);
    if (segs.length >= 2 && safeKeysEqual(segs[0], groupKey)) {
      const lastSeg = segs[segs.length - 1];
      const numeric = parseInt(lastSeg, 10);
      if (!isNaN(numeric) && numeric > maxChildSeq) {
        maxChildSeq = numeric;
      }
    }
  }

  const nextSeq = maxChildSeq + 1;
  const createdKey = `${groupKey}-${String(nextSeq).padStart(2, '0')}`;

  const street = (input.street || '').trim() || 'Rua Sem Nome';
  const numberStr = (input.number || '').trim();
  const complementStr = (input.complement || '').trim();
  const fullNumber = [numberStr, complementStr].filter(Boolean).join(' ');
  const line = fullNumber ? `${street}, ${fullNumber}` : street;

  const lat = parseOptionalCoord(input.lat);
  const lng = parseOptionalCoord(input.lng);

  const newAddressNode: FlatSkeletonEntry = {
    key: createdKey,
    type: 'territory',
    label: neighborhood ? `${line} (${neighborhood})` : line,
    value: '',
    email: '',
    meta: {
      engine_id: 'territory_logistics',
      territoryNumber,
      territory_number: territoryNumber,
      territory: territoryNumber,
      territory_name: existingTerritoryName,
      locality: existingTerritoryName,
      street,
      number: fullNumber || 'S/N',
      line,
      line2: neighborhood,
      neighborhood,
      city,
      state,
      postalcode: (input.postalcode || '').trim(),
      property_type: input.propertyType || 'residencial',
      is_foreign: Boolean(input.isForeign),
      language: input.isForeign ? (input.language || '').trim() : undefined,
      lat,
      lng,
      notes: (input.notes || '').trim(),
      worked: 0,
      custom_Order: nextSeq,
    },
  };

  nextNodes.push(newAddressNode);

  return {
    nodes: nextNodes,
    createdKey,
    groupKey,
  };
}

/**
 * Updates a single node inside the clean territory registry.
 */
export function updateSingleNodeInCleanRegistry(
  cleanNodes: FlatSkeletonEntry[],
  targetKey: string,
  updates: {
    label?: string;
    value?: string;
    meta?: Record<string, any>;
  }
): FlatSkeletonEntry[] {
  const normalizedTarget = safeNormalizeKey(targetKey.replace(/^(90-|T::)/, ''));
  return cleanNodes.map((node) => {
    const cleanNodeKey = safeNormalizeKey(node.key.replace(/^(90-|T::)/, ''));
    const origKey = node.meta?._originalKey
      ? safeNormalizeKey(String(node.meta._originalKey))
      : '';
    if (!safeKeysEqual(cleanNodeKey, normalizedTarget) && (!origKey || !safeKeysEqual(origKey, normalizedTarget))) {
      return node;
    }
    return {
      ...node,
      label: updates.label !== undefined ? updates.label : node.label,
      value: updates.value !== undefined ? updates.value : node.value,
      meta:
        updates.meta !== undefined
          ? { ...(node.meta || {}), ...updates.meta, engine_id: 'territory_logistics' }
          : node.meta,
    };
  });
}

/**
 * Deletes an entire territory or a specific quadra from the clean registry.
 */
export function deleteTerritoryOrQuadra(
  cleanNodes: FlatSkeletonEntry[],
  target: { territoryNumber?: string; groupKey?: string }
): FlatSkeletonEntry[] {
  if (target.groupKey) {
    const normGroup = safeNormalizeKey(target.groupKey);
    return cleanNodes.filter((n) => {
      const rootSeg = safeRootKey(n.key);
      return !safeKeysEqual(rootSeg, normGroup) && !safeKeysEqual(n.key, normGroup);
    });
  }
  if (target.territoryNumber) {
    const normTerr = normalizeTerritoryId(target.territoryNumber);
    return cleanNodes.filter((n) => resolveTerritoryNumber(n) !== normTerr);
  }
  return cleanNodes;
}

/**
 * Merges updated clean territory nodes back into a potentially multi-engine `rawRegistry`.
 * Preserves 100% of nodes belonging to other engines (`roster_assignments`, `event_schedule`, etc.)
 * and properly prefixes territory keys with `90-` when multi-engine partitioning is active.
 */
export function mergeTerritoryPartitionIntoRawRegistry(
  rawRegistry: FlatSkeletonEntry[],
  cleanTerritoryNodes: FlatSkeletonEntry[]
): FlatSkeletonEntry[] {
  const safeRaw = Array.isArray(rawRegistry) ? rawRegistry : [];

  const nonTerritoryNodes = safeRaw.filter((node) => {
    const metaEngine = node.meta?.engine_id;
    if (metaEngine === 'territory_logistics') return false;
    if (node.key.startsWith('90-') || node.key.startsWith('T::')) return false;
    return Boolean(
      metaEngine ||
        /^(01|02|03|04|05|99)-/.test(node.key)
    );
  });

  const usePartitionPrefix =
    nonTerritoryNodes.length > 0 ||
    safeRaw.some((n) => /^(01|02|03|04|05|90|99)-/.test(n.key));

  const formattedTerritoryNodes: FlatSkeletonEntry[] = cleanTerritoryNodes.map((node) => {
    const cleanKey = safeNormalizeKey(node.key.replace(/^(90-|T::)/, ''));
    const rawKey = usePartitionPrefix ? `90-${cleanKey}` : cleanKey;
    return {
      ...node,
      key: rawKey,
      meta: {
        ...(node.meta || {}),
        _originalKey: cleanKey,
        engine_id: 'territory_logistics',
      },
    };
  });

  return [...nonTerritoryNodes, ...formattedTerritoryNodes];
}

function escapeCsvCell(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports the current in-memory territory nodes as a clean, human-editable S-13 CSV model
 * that can be opened directly in Excel/Google Sheets or re-imported into Sekundo.
 */
export function buildTerritoryModelCsvText(cleanTerritoryNodes: FlatSkeletonEntry[]): string {
  const headers = [
    'Codigo',
    'Territorio',
    'Nome_Territorio',
    'Quadra',
    'Logradouro',
    'Numero',
    'Bairro',
    'Cidade',
    'UF',
    'CEP',
    'Latitude',
    'Longitude',
    'Tipo_Imovel',
    'Idioma',
    'Trabalhado',
    'Responsavel',
    'Data_Designacao',
    'Data_Conclusao',
    'Observacoes',
  ];

  const parentLabels = new Map<string, string>();
  const parentKeys = new Set<string>();
  for (const node of cleanTerritoryNodes) {
    if (safeDepth(node.key) === 1) {
      parentLabels.set(safeRootKey(node.key), node.label || node.key);
    }
    const p = safeParentKey(node.key);
    if (p) {
      parentKeys.add(safeNormalizeKey(p));
    }
  }

  const lines: string[] = [headers.join(';')];

  for (const node of cleanTerritoryNodes) {
    const normKey = safeNormalizeKey(node.key);
    if (parentKeys.has(normKey) && safeDepth(node.key) === 1) {
      continue;
    }

    const meta = (node.meta || {}) as Record<string, any>;
    const territoryNumber = resolveTerritoryNumber(node);
    const territoryName = String(
      meta.territory_name || meta.locality || meta.neighborhood || meta.bairro || ''
    ).trim();
    const quadraKey = safeRootKey(node.key);
    const quadraName = parentLabels.get(quadraKey) || quadraKey;

    const rawLine = String(meta.line || node.label || '').trim();
    const parsedAddr = parseAddressLine(rawLine);
    const street = String(meta.street || parsedAddr.street || rawLine).trim();
    const numberStr = String(meta.number || parsedAddr.number || '').trim();
    const neighborhood = String(
      meta.neighborhood || meta.line2 || meta.bairro || territoryName || ''
    ).trim();
    const city = String(meta.city || meta.cidade || '').trim();
    const state = String(meta.state || meta.uf || 'SP').trim();
    const cep = String(meta.postalcode || meta.cep || '').trim();
    const coords = parseLatLng(meta);
    const latStr = coords ? String(coords.lat) : '';
    const lngStr = coords ? String(coords.lng) : '';
    const propType = String(meta.property_type || 'residencial').trim();
    const language = String(meta.language || meta.idioma || '').trim();
    const worked = Number(meta.worked) === 1 ? '1' : '0';
    const worker = String(meta.workerName || node.value || '').trim();
    const assignedAt = String(meta.assignedAt || meta.assigned_date || '').trim();
    const completedAt = String(meta.completedAt || meta.completed_date || '').trim();
    const notes = String(meta.notes || meta.observacoes || '').trim();

    const row = [
      node.key,
      territoryNumber,
      territoryName,
      quadraName,
      street,
      numberStr,
      neighborhood,
      city,
      state,
      cep,
      latStr,
      lngStr,
      propType,
      language,
      worked,
      worker,
      assignedAt,
      completedAt,
      notes,
    ].map(escapeCsvCell);

    lines.push(row.join(';'));
  }

  return '\uFEFF' + lines.join('\n');
}

/**
 * Formats a zero-bureaucracy shareable message and Google Maps link for a single address.
 * Requires zero login, zero privilege checks, and zero PIN confirmation.
 */
export function formatShareAddressLocationText(
  item: FlatSkeletonEntry,
  fallbackCity?: string
): ShareFormattedPayload {
  const meta = (item.meta || {}) as Record<string, any>;
  const territoryNumber = resolveTerritoryNumber(item);
  const territoryName = String(
    meta.territory_name || meta.locality || meta.neighborhood || meta.bairro || ''
  ).trim();
  const line = String(meta.line || item.label || '').trim();
  const neighborhood = String(meta.line2 || meta.neighborhood || meta.bairro || '').trim();
  const city = String(meta.city || meta.cidade || fallbackCity || '').trim();
  const state = String(meta.state || meta.uf || '').trim();
  const postalcode = String(meta.postalcode || meta.cep || '').trim();
  const notes = String(meta.notes || meta.observacoes || '').trim();
  const coords = parseLatLng(meta);

  const mapsUrl = buildGoogleMapsDirectionsUrl({
    lat: coords?.lat,
    lng: coords?.lng,
    line,
    label: item.label,
    neighborhood,
    city,
    state,
    postalcode,
    mode: 'directions',
  });

  const headerTitle = territoryName
    ? `📍 Território ${territoryNumber} — ${territoryName}`
    : `📍 Território ${territoryNumber}`;

  const messageLines: string[] = [
    `*${headerTitle}*`,
    `🏠 *Endereço:* ${line || item.label}`,
  ];

  const locationSub = [neighborhood, city, postalcode ? `CEP ${postalcode}` : '']
    .filter(Boolean)
    .join(' • ');
  if (locationSub) {
    messageLines.push(`🏘️ *Local:* ${locationSub}`);
  }
  if (coords) {
    messageLines.push(`🧭 *Coordenadas:* ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
  }
  if (notes) {
    messageLines.push(`📝 *Obs:* ${notes}`);
  }
  messageLines.push(`🗺️ *Abrir no Google Maps:* ${mapsUrl}`);

  const text = messageLines.join('\n');
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return {
    title: `${headerTitle} • ${line || item.label}`,
    text,
    mapsUrl,
    whatsappUrl,
  };
}

/**
 * Formats a zero-bureaucracy shareable message for an entire Territory or a specific Quadra,
 * including the general Google Maps route link and direct links for the addresses.
 */
export function formatShareTerritoryOrQuadraLocationsText(params: {
  territoryNumber: string;
  territoryName?: string;
  quadraKey?: string;
  quadraLabel?: string;
  items: FlatSkeletonEntry[];
  city?: string;
  onlyPending?: boolean;
}): ShareFormattedPayload {
  const tNum = normalizeTerritoryId(params.territoryNumber);
  const tName =
    (params.territoryName || '').trim() ||
    resolveTerritoryNameFromNodes(params.items, tNum);

  const parentKeys = new Set<string>();
  for (const item of params.items) {
    const p = safeParentKey(item.key);
    if (p) parentKeys.add(safeNormalizeKey(p));
  }

  const leafItems = params.items.filter((item) => {
    const normKey = safeNormalizeKey(item.key);
    if (parentKeys.has(normKey) && safeDepth(item.key) === 1) return false;
    if (params.quadraKey) {
      const rootSeg = safeRootKey(item.key);
      if (!safeKeysEqual(rootSeg, params.quadraKey)) return false;
    }
    return true;
  });

  const total = leafItems.length;
  const worked = leafItems.filter((i) => Number(i.meta?.worked) === 1).length;
  const pending = total - worked;

  const displayItems = params.onlyPending
    ? leafItems.filter((i) => Number(i.meta?.worked) !== 1)
    : leafItems;

  const validCoords: Array<{ lat: number; lng: number }> = [];
  for (const item of displayItems.length > 0 ? displayItems : leafItems) {
    const c = parseLatLng((item.meta || {}) as Record<string, any>);
    if (c) validCoords.push(c);
  }

  const firstMeta = (leafItems[0]?.meta || {}) as Record<string, any>;
  const resolvedCity =
    (params.city || '').trim() ||
    String(firstMeta.city || firstMeta.cidade || '');

  const centerCoord =
    validCoords.length > 0
      ? {
          lat: validCoords.reduce((acc, c) => acc + c.lat, 0) / validCoords.length,
          lng: validCoords.reduce((acc, c) => acc + c.lng, 0) / validCoords.length,
        }
      : undefined;

  const mainMapsUrl = buildGoogleMapsDirectionsUrl({
    lat: centerCoord?.lat,
    lng: centerCoord?.lng,
    line: String(firstMeta.line || params.quadraLabel || `Território ${tNum}`),
    city: resolvedCity,
    waypoints: validCoords.slice(0, 9).map((c) => [c.lat, c.lng] as [number, number]),
    mode: 'directions',
  });

  const titleHeader = params.quadraLabel
    ? `🗺️ Território ${tNum}${tName ? ` (${tName})` : ''} — ${params.quadraLabel}`
    : `🗺️ Território ${tNum}${tName ? ` — ${tName}` : ''}`;

  const lines: string[] = [
    `*${titleHeader}*`,
    `📊 *Progresso:* ${worked}/${total} concluídos (${pending} pendentes)`,
    `🧭 *Abrir Rota no Google Maps:* ${mainMapsUrl}`,
    '',
    `*📍 Endereços (${displayItems.length}):*`,
  ];

  const maxListed = 25;
  displayItems.slice(0, maxListed).forEach((item, idx) => {
    const m = (item.meta || {}) as Record<string, any>;
    const isDone = Number(m.worked) === 1;
    const statusIcon = isDone ? '✅' : '⬜';
    const addrLine = String(m.line || item.label || item.key).trim();
    const coords = parseLatLng(m);
    const pinUrl = buildGoogleMapsSearchUrl({
      lat: coords?.lat,
      lng: coords?.lng,
      line: addrLine,
      city: String(m.city || m.cidade || resolvedCity),
    });
    lines.push(`${idx + 1}. ${statusIcon} ${addrLine} — ${pinUrl}`);
  });

  if (displayItems.length > maxListed) {
    lines.push(`... e mais ${displayItems.length - maxListed} endereço(s).`);
  }

  const text = lines.join('\n');
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

  return {
    title: titleHeader,
    text,
    mapsUrl: mainMapsUrl,
    whatsappUrl,
  };
}

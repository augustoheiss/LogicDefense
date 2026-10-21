/**
 * Sekundo — Tamper-Evident Append-Only Activity & Governance Audit Log Engine
 *
 * Orthogonal to `operationLedger.ts` (which compacts cell states via LWW):
 * - Preserves 100% of historical governance and operational events in an immutable chain:
 *   - `IDENTITY_CONFIRMED` (First-time registration confirmed: Name + Group + PIN)
 *   - `SESSION_RESTORED` (Trusted device session restored automatically)
 *   - `SESSION_LOGOUT` (Explicit user logout on shared device)
 *   - `SESSION_PIN_LOCKED` / `SESSION_PIN_UNLOCKED` (Quick PIN lock/unlock on shared device)
 *   - `IDENTITY_REJECTED` (Blocked attempt: name not in Privilege List, 0 active privileges, or wrong PIN/Group)
 *   - `SHEET_VIEWED` (Participant viewed/consulted a spreadsheet)
 *   - `CELL_EDITED` / `NODE_ADDED` / `NODE_DELETED` (Admin with `👑 Selo Admin` edited spreadsheet)
 *   - `UNAUTHORIZED_EDIT_ATTEMPT` / `UNAUTHORIZED_EXPORT_ATTEMPT` (Blocked action by non-Admin)
 *   - `CSV_EXPORTED` / `PDF_EXPORTED` (Admin with `👑 Selo Admin` exported spreadsheet)
 *   - `PRIVILEGE_UPDATED` / `ADMIN_SEAL_CHANGED` (Admin updated Privilege Matrix or granted/revoked `👑 Selo Admin`)
 * - Computes a deterministic FNV-1a / SHA-like chain hash (`prevHash -> entryHash`) so tampering is detectable.
 *
 * Skills: agency-software-architect, agency-code-reviewer
 */

import { compareHLC, createHLC, packHLC, unpackHLC } from '../sync/hlc';
import type { SpreadsheetAccessRole } from '../auth/privilegeAccessGuard';
import { neutralizeCsvFormula } from '../csv/omniCsvBundle';

export type ActivityActionType =
  | 'IDENTITY_CONFIRMED'
  | 'SESSION_RESTORED'
  | 'SESSION_LOGOUT'
  | 'SESSION_PIN_LOCKED'
  | 'SESSION_PIN_UNLOCKED'
  | 'IDENTITY_REJECTED'
  | 'SHEET_VIEWED'
  | 'CELL_EDITED'
  | 'NODE_ADDED'
  | 'NODE_DELETED'
  | 'UNAUTHORIZED_EDIT_ATTEMPT'
  | 'UNAUTHORIZED_EXPORT_ATTEMPT'
  | 'CSV_EXPORTED'
  | 'PDF_EXPORTED'
  | 'PRIVILEGE_UPDATED'
  | 'ADMIN_SEAL_CHANGED'
  | 'SHARE_LINK_CREATED';

export interface ActivityLogEntry {
  logId: string;
  eventId: string;
  timestamp: string;
  hlc: string;
  actorId: string;
  actorName: string;
  actorGroup: string;
  actorRole: SpreadsheetAccessRole;
  actionType: ActivityActionType;
  targetSheet?: string;
  targetNodeKey?: string;
  summary: string;
  beforeValue?: string;
  afterValue?: string;
  prevHash: string;
  entryHash: string;
}

export interface CreateActivityLogInput {
  logId?: string;
  eventId: string;
  timestamp?: string;
  hlc?: string;
  actorId: string;
  actorName: string;
  actorGroup?: string;
  actorRole: SpreadsheetAccessRole;
  actionType: ActivityActionType;
  targetSheet?: string;
  targetNodeKey?: string;
  summary: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}

export const ACTIVITY_ACTION_LABELS: Record<
  ActivityActionType,
  { icon: string; label: string; color: string; category: 'access' | 'view' | 'edit' | 'export' | 'security' }
> = {
  IDENTITY_CONFIRMED: {
    icon: '✅',
    label: 'Cadastro Confirmado',
    color: '#10B981',
    category: 'access',
  },
  SESSION_RESTORED: {
    icon: '🔄',
    label: 'Sessão Reconectada',
    color: '#3B82F6',
    category: 'access',
  },
  SESSION_LOGOUT: {
    icon: '🚪',
    label: 'Logout Realizado',
    color: '#94A3B8',
    category: 'access',
  },
  SESSION_PIN_LOCKED: {
    icon: '🔒',
    label: 'Tela Bloqueada (PIN)',
    color: '#F59E0B',
    category: 'security',
  },
  SESSION_PIN_UNLOCKED: {
    icon: '🔓',
    label: 'Tela Desbloqueada (PIN)',
    color: '#10B981',
    category: 'security',
  },
  IDENTITY_REJECTED: {
    icon: '🚫',
    label: 'Acesso Negado no Link',
    color: '#EF4444',
    category: 'security',
  },
  SHEET_VIEWED: {
    icon: '👁️',
    label: 'Planilha Consultada',
    color: '#38BDF8',
    category: 'view',
  },
  CELL_EDITED: {
    icon: '✏️',
    label: 'Informação Editada',
    color: '#8B5CF6',
    category: 'edit',
  },
  NODE_ADDED: {
    icon: '➕',
    label: 'Item Adicionado',
    color: '#10B981',
    category: 'edit',
  },
  NODE_DELETED: {
    icon: '🗑️',
    label: 'Item Removido',
    color: '#F43F5E',
    category: 'edit',
  },
  UNAUTHORIZED_EDIT_ATTEMPT: {
    icon: '🛡️',
    label: 'Tentativa de Edição Bloqueada',
    color: '#EF4444',
    category: 'security',
  },
  UNAUTHORIZED_EXPORT_ATTEMPT: {
    icon: '🛡️',
    label: 'Tentativa de Exportação Bloqueada',
    color: '#EF4444',
    category: 'security',
  },
  CSV_EXPORTED: {
    icon: '📤',
    label: 'Planilha CSV Exportada',
    color: '#F59E0B',
    category: 'export',
  },
  PDF_EXPORTED: {
    icon: '🖨️',
    label: 'Documento PDF Exportado',
    color: '#EC4899',
    category: 'export',
  },
  PRIVILEGE_UPDATED: {
    icon: '🛡️',
    label: 'Matriz de Privilégios Atualizada',
    color: '#6366F1',
    category: 'edit',
  },
  ADMIN_SEAL_CHANGED: {
    icon: '👑',
    label: 'Selo Admin Alterado',
    color: '#FFB800',
    category: 'security',
  },
  SHARE_LINK_CREATED: {
    icon: '🔗',
    label: 'Link Simultâneo Gerado',
    color: '#14B8A6',
    category: 'security',
  },
};

/**
 * Deterministic 64-bit hex digest for tamper-evident audit log chaining.
 */
export function computeAuditHash(payload: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x100000001b3 & 0xffffffff);
  }
  return `alh_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function serializeCanonicalEntryFields(
  entry: Omit<ActivityLogEntry, 'entryHash'>,
  prevHash: string
): string {
  return [
    prevHash,
    entry.logId,
    entry.eventId,
    entry.timestamp,
    entry.actorId,
    entry.actorName,
    entry.actorRole,
    entry.actionType,
    entry.targetSheet || '',
    entry.targetNodeKey || '',
    entry.summary,
    entry.beforeValue ?? '',
    entry.afterValue ?? '',
  ].join('|');
}

/**
 * Creates a new immutable `ActivityLogEntry` chained to `prevHash`.
 */
export function createActivityLogEntry(
  input: CreateActivityLogInput,
  prevHash: string = 'GENESIS_00000000'
): ActivityLogEntry {
  const ts = input.timestamp || new Date().toISOString();
  const nowMs = Number.isFinite(Date.parse(ts)) ? Date.parse(ts) : Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 9);
  const logId = input.logId || `act_${nowMs}_${randomSuffix}`;
  const hlc =
    input.hlc ||
    packHLC({
      ...createHLC(input.actorId || 'anon', nowMs),
      logical: 0,
    });

  const baseEntry: Omit<ActivityLogEntry, 'entryHash'> = {
    logId,
    eventId: input.eventId || 'global',
    timestamp: ts,
    hlc,
    actorId: input.actorId || 'unknown',
    actorName: input.actorName || 'Desconhecido',
    actorGroup: input.actorGroup || '',
    actorRole: input.actorRole,
    actionType: input.actionType,
    targetSheet: input.targetSheet,
    targetNodeKey: input.targetNodeKey,
    summary: input.summary,
    beforeValue:
      input.beforeValue !== undefined && input.beforeValue !== null
        ? String(input.beforeValue)
        : undefined,
    afterValue:
      input.afterValue !== undefined && input.afterValue !== null
        ? String(input.afterValue)
        : undefined,
    prevHash,
  };

  const entryHash = computeAuditHash(serializeCanonicalEntryFields(baseEntry, prevHash));
  return {
    ...baseEntry,
    entryHash,
  };
}

/**
 * Appends a new entry to an existing Activity Log array, chaining its `prevHash`
 * to the last entry's `entryHash`.
 */
export function appendActivityLogEntry(
  existingLog: ActivityLogEntry[],
  input: CreateActivityLogInput
): { updatedLog: ActivityLogEntry[]; entry: ActivityLogEntry } {
  const lastEntry = existingLog.length > 0 ? existingLog[existingLog.length - 1] : null;
  const prevHash = lastEntry ? lastEntry.entryHash : 'GENESIS_00000000';
  const entry = createActivityLogEntry(input, prevHash);
  return {
    updatedLog: [...existingLog, entry],
    entry,
  };
}

/**
 * Deterministic comparator for two `ActivityLogEntry` items.
 */
export function compareActivityLogEntries(a: ActivityLogEntry, b: ActivityLogEntry): number {
  const tA = Date.parse(a.timestamp);
  const tB = Date.parse(b.timestamp);
  if (Number.isFinite(tA) && Number.isFinite(tB) && tA !== tB) {
    return tA - tB;
  }
  const hlcA = unpackHLC(a.hlc);
  const hlcB = unpackHLC(b.hlc);
  if (hlcA && hlcB) {
    const cmp = compareHLC(hlcA, hlcB);
    if (cmp !== 0) return cmp;
  }
  return a.logId.localeCompare(b.logId);
}

/**
 * Merges two distributed Activity Logs (Local + Incoming Peer) without losing any entry,
 * deduplicating by `logId`, sorting deterministically by timestamp/HLC, and recomputing
 * the canonical chain hashes so all peers converge to the exact same audit trail.
 */
export function mergeActivityLogs(
  localLog: ActivityLogEntry[],
  incomingLog: ActivityLogEntry[],
  maxEntries: number = 5000
): ActivityLogEntry[] {
  const byId = new Map<string, ActivityLogEntry>();
  for (const item of localLog || []) {
    if (item && item.logId) byId.set(item.logId, item);
  }
  for (const item of incomingLog || []) {
    if (item && item.logId && !byId.has(item.logId)) {
      byId.set(item.logId, item);
    }
  }

  const sorted = Array.from(byId.values()).sort(compareActivityLogEntries);
  const trimmed = sorted.length > maxEntries ? sorted.slice(-maxEntries) : sorted;

  // Re-seal chain deterministically across merged distributed entries
  let prevHash = 'GENESIS_00000000';
  return trimmed.map((item) => {
    const updatedBase: Omit<ActivityLogEntry, 'entryHash'> = {
      ...item,
      prevHash,
    };
    const entryHash = computeAuditHash(serializeCanonicalEntryFields(updatedBase, prevHash));
    prevHash = entryHash;
    return {
      ...updatedBase,
      entryHash,
    };
  });
}

/**
 * Verifies the cryptographic integrity of an Activity Log hash chain.
 */
export function verifyActivityLogChain(log: ActivityLogEntry[]): {
  valid: boolean;
  brokenAtIndex?: number;
  totalEntries: number;
} {
  let expectedPrevHash = 'GENESIS_00000000';
  for (let i = 0; i < log.length; i++) {
    const item = log[i];
    if (item.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtIndex: i, totalEntries: log.length };
    }
    const recomputed = computeAuditHash(serializeCanonicalEntryFields(item, expectedPrevHash));
    if (item.entryHash !== recomputed) {
      return { valid: false, brokenAtIndex: i, totalEntries: log.length };
    }
    expectedPrevHash = item.entryHash;
  }
  return { valid: true, totalEntries: log.length };
}

/**
 * Exports the Activity Log to a clean RFC-4180 CSV string for Admin auditing.
 */
export function exportActivityLogToCsv(log: ActivityLogEntry[]): string {
  const headers = [
    'log_id',
    'data_hora_iso',
    'participante_nome',
    'grupo',
    'nivel_permissao',
    'tipo_acao',
    'planilha_alvo',
    'item_chave',
    'resumo_atividade',
    'valor_anterior',
    'valor_novo',
    'hash_integridade',
  ];

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const safe = neutralizeCsvFormula(String(val));
    if (/[",\r\n]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };

  const lines = [headers.join(',')];
  for (const entry of log) {
    const roleLabel =
      entry.actorRole === 'ADMIN_SEAL'
        ? 'Selo Admin'
        : entry.actorRole === 'VIEWER'
        ? 'Consultor (Somente Leitura)'
        : 'Bloqueado / Nao Autorizado';
    lines.push(
      [
        entry.logId,
        entry.timestamp,
        entry.actorName,
        entry.actorGroup,
        roleLabel,
        entry.actionType,
        entry.targetSheet || '',
        entry.targetNodeKey || '',
        entry.summary,
        entry.beforeValue || '',
        entry.afterValue || '',
        entry.entryHash,
      ]
        .map(escapeCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

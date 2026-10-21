/**
 * Sekundo — Zero-Knowledge Multi-Peer Collaborative Room Protocol (`1:N`)
 *
 * Enables simultaneous real-time spreadsheet sharing across 2..N participants
 * while preserving 100% Local-First Zero-Knowledge privacy:
 * - Every packet leaving the client (`SNAPSHOT_SYNC`, `DELTA_MUTATION`, `ACTIVITY_LOG`, `PRESENCE_HEARTBEAT`)
 *   is encrypted on the device with `AES-256-GCM` using the link's passphrase (`encryptForURL` / `decryptFromURL`).
 * - The stateless backend (`signaling_router.py`) only relays opaque encrypted strings (`SEKUNDO_COLLAB_v2:...`).
 * - Enforces Strict Receiver-Side RBAC Verification (`verifyIncomingCollabPacket`):
 *   - Only packets authored by a participant who holds the `👑 Selo Admin` (`hasAdminSealPrivilege`)
 *     are allowed to mutate the spreadsheet (`SNAPSHOT_SYNC`, `DELTA_MUTATION`, `ROSTER_UPDATE`).
 *   - `VIEWER` participants (without `👑 Selo Admin`) can only emit `ACTIVITY_LOG` (join/view confirmations)
 *     and `PRESENCE_HEARTBEAT` packets. Any state mutation attempt from a `VIEWER` is rejected and logged!
 *
 * Skills: agency-software-architect, agency-code-reviewer
 */

import { encryptForURL, decryptFromURL } from '../crypto/symmetric';
import type { FlatSkeletonEntry } from '../skeleton/types';
import type { ParticipantProfile } from '../roster/participantDirectory';
import { normalizePersonKey } from '../roster/participantDirectory';
import type { LedgerOperation } from './operationLedger';
import { reconcileLedgers } from './operationLedger';
import type { ActivityLogEntry } from '../audit/activityLogEngine';
import { mergeActivityLogs, appendActivityLogEntry } from '../audit/activityLogEngine';
import {
  type SpreadsheetAccessRole,
  hasAdminSealPrivilege,
} from '../auth/privilegeAccessGuard';

export const COLLAB_PACKET_PREFIX = 'SEKUNDO_COLLAB_v2:';

export type CollabPacketKind =
  | 'SNAPSHOT_SYNC'
  | 'DELTA_MUTATION'
  | 'ROSTER_UPDATE'
  | 'ACTIVITY_LOG'
  | 'PRESENCE_HEARTBEAT';

export interface CollabPeerPresence {
  peerId: string;
  participantId: string;
  fullName: string;
  groupTag: string;
  role: SpreadsheetAccessRole;
  hasAdminSeal: boolean;
  activeSheet?: string;
  lastSeenIso: string;
}

export interface CollabPacketPayloadV2 {
  protocol: 'SEKUNDO_COLLAB_v2';
  packetId: string;
  roomId: string;
  eventId: string;
  kind: CollabPacketKind;
  sentAt: string;
  author: {
    peerId: string;
    participantId: string;
    fullName: string;
    groupTag: string;
    role: SpreadsheetAccessRole;
    hasAdminSeal: boolean;
  };
  /** Present on SNAPSHOT_SYNC */
  skeleton?: FlatSkeletonEntry[];
  /** Present on SNAPSHOT_SYNC or ROSTER_UPDATE */
  privilegeRoster?: ParticipantProfile[];
  /** Present on DELTA_MUTATION */
  operations?: LedgerOperation[];
  /** Present on ACTIVITY_LOG or SNAPSHOT_SYNC */
  activityEntries?: ActivityLogEntry[];
  /** Present on PRESENCE_HEARTBEAT */
  presence?: CollabPeerPresence;
}

export interface CollabRoomStateReconcileResult {
  accepted: boolean;
  rejectedReason?: string;
  updatedSkeleton: FlatSkeletonEntry[];
  updatedRoster: ParticipantProfile[];
  updatedLedger: LedgerOperation[];
  updatedActivityLog: ActivityLogEntry[];
  updatedPresence?: CollabPeerPresence;
}

/**
 * Encrypts a `CollabPacketPayloadV2` into an opaque `SEKUNDO_COLLAB_v2:<cipher>` string
 * so the relay server never sees plaintext third-party data.
 */
export async function encodeEncryptedCollabPacket(
  payload: CollabPacketPayloadV2,
  passphrase: string
): Promise<string> {
  const cleanPass = (passphrase || '').trim();
  if (!cleanPass) {
    throw new Error('Passphrase is required to encrypt collaborative room packets.');
  }
  const cipherToken = await encryptForURL(payload, cleanPass);
  return `${COLLAB_PACKET_PREFIX}${cipherToken}`;
}

/**
 * Decrypts an opaque `SEKUNDO_COLLAB_v2:<cipher>` string back into a `CollabPacketPayloadV2`.
 */
export async function decodeEncryptedCollabPacket(
  rawCipher: string,
  passphrase: string
): Promise<CollabPacketPayloadV2> {
  const trimmed = (rawCipher || '').trim();
  const cleanPass = (passphrase || '').trim();
  if (!trimmed.startsWith(COLLAB_PACKET_PREFIX)) {
    throw new Error('Invalid collaborative packet prefix.');
  }
  const token = trimmed.slice(COLLAB_PACKET_PREFIX.length).trim();
  const decoded = (await decryptFromURL(token, cleanPass)) as CollabPacketPayloadV2;
  if (!decoded || decoded.protocol !== 'SEKUNDO_COLLAB_v2') {
    throw new Error('Invalid decrypted collaborative packet structure.');
  }
  return decoded;
}

/**
 * Verifies whether the author of an incoming `CollabPacketPayloadV2` actually holds
 * the `👑 Selo Admin` in the local `privilegeRoster`.
 */
export function isPacketAuthorAuthorizedAdmin(
  packet: CollabPacketPayloadV2,
  privilegeRoster: ParticipantProfile[]
): boolean {
  if (!packet?.author) return false;
  const normAuthorName = normalizePersonKey(packet.author.fullName);
  const matched =
    privilegeRoster.find((p) => p.id === packet.author.participantId) ||
    privilegeRoster.find((p) => normalizePersonKey(p.name) === normAuthorName);

  if (!matched) return false;
  return hasAdminSealPrivilege(matched);
}

/**
 * Reconciles an incoming decrypted `CollabPacketPayloadV2` against the current client state,
 * strictly enforcing that ONLY authors with `👑 Selo Admin` in the Privilege Roster can
 * mutate spreadsheet cells (`SNAPSHOT_SYNC`, `DELTA_MUTATION`) or update the Privilege Roster (`ROSTER_UPDATE`).
 */
export function applyIncomingCollabPacket(
  currentState: {
    eventId: string;
    skeleton: FlatSkeletonEntry[];
    privilegeRoster: ParticipantProfile[];
    ledger: LedgerOperation[];
    activityLog: ActivityLogEntry[];
  },
  packet: CollabPacketPayloadV2
): CollabRoomStateReconcileResult {
  let updatedSkeleton = currentState.skeleton;
  let updatedRoster = currentState.privilegeRoster;
  let updatedLedger = currentState.ledger;
  let updatedActivityLog = currentState.activityLog;

  // Always merge incoming activity log entries if present
  if (Array.isArray(packet.activityEntries) && packet.activityEntries.length > 0) {
    updatedActivityLog = mergeActivityLogs(updatedActivityLog, packet.activityEntries);
  }

  if (packet.kind === 'PRESENCE_HEARTBEAT' || packet.kind === 'ACTIVITY_LOG') {
    return {
      accepted: true,
      updatedSkeleton,
      updatedRoster,
      updatedLedger,
      updatedActivityLog,
      updatedPresence: packet.presence,
    };
  }

  // Mutation packets (`SNAPSHOT_SYNC`, `DELTA_MUTATION`, `ROSTER_UPDATE`) REQUIRE `👑 Selo Admin`!
  const isAuthorizedAdmin = isPacketAuthorAuthorizedAdmin(packet, currentState.privilegeRoster);
  if (!isAuthorizedAdmin) {
    const securityAlert = appendActivityLogEntry(updatedActivityLog, {
      eventId: currentState.eventId,
      actorId: packet.author?.participantId || 'unknown',
      actorName: packet.author?.fullName || 'Desconhecido',
      actorGroup: packet.author?.groupTag || '',
      actorRole: 'VIEWER',
      actionType: 'UNAUTHORIZED_EDIT_ATTEMPT',
      summary: `Tentativa de edição via rede bloqueada: ${packet.author?.fullName || 'Usuário'} não possui o 👑 Selo Admin.`,
    });
    return {
      accepted: false,
      rejectedReason: 'AUTHOR_MISSING_ADMIN_SEAL',
      updatedSkeleton,
      updatedRoster,
      updatedLedger,
      updatedActivityLog: securityAlert.updatedLog,
    };
  }

  if (packet.kind === 'ROSTER_UPDATE' && Array.isArray(packet.privilegeRoster)) {
    updatedRoster = packet.privilegeRoster;
  }

  if (packet.kind === 'DELTA_MUTATION' && Array.isArray(packet.operations) && packet.operations.length > 0) {
    const reconciled = reconcileLedgers(updatedLedger, packet.operations, updatedSkeleton);
    updatedSkeleton = reconciled.updatedRegistry;
    updatedLedger = reconciled.consolidatedLedger;
  } else if (packet.kind === 'SNAPSHOT_SYNC' && Array.isArray(packet.skeleton)) {
    if (Array.isArray(packet.operations) && packet.operations.length > 0) {
      const reconciled = reconcileLedgers(updatedLedger, packet.operations, packet.skeleton);
      updatedSkeleton = reconciled.updatedRegistry;
      updatedLedger = reconciled.consolidatedLedger;
    } else {
      updatedSkeleton = packet.skeleton;
    }
    if (Array.isArray(packet.privilegeRoster) && packet.privilegeRoster.length > 0) {
      updatedRoster = packet.privilegeRoster;
    }
  }

  return {
    accepted: true,
    updatedSkeleton,
    updatedRoster,
    updatedLedger,
    updatedActivityLog,
    updatedPresence: packet.presence,
  };
}

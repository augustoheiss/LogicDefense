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
import { signPacket, verifyPacket, derivePublicKeyFromSeed } from '../share/signedPacket';

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
  /** Ed25519 signature over canonical packet fields (SEC-02) */
  sig?: string;
  /** Ed25519 public key (base64url, 32 bytes) matching the capability room's verifyPub */
  verifyPub?: string;
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
 * Signs a `CollabPacketPayloadV2` using the room's Ed25519 `signSeed` (`#w` capability fragment).
 */
export function signCollabPacket(
  packet: CollabPacketPayloadV2,
  signSeed: string
): CollabPacketPayloadV2 {
  const verifyPub = derivePublicKeyFromSeed(signSeed);
  const packetWithPub: CollabPacketPayloadV2 = {
    ...packet,
    verifyPub,
  };
  const sig = signPacket(packetWithPub as unknown as Record<string, unknown>, signSeed);
  return {
    ...packetWithPub,
    sig,
  };
}

/**
 * Reconciles an incoming decrypted `CollabPacketPayloadV2` against the current client state,
 * strictly enforcing that:
 * 1. If `currentState.verifyPub` is configured (Capability Room v3), mutation packets MUST carry
 *    a valid Ed25519 signature (`sig`) matching `currentState.verifyPub` (`SEC-02`).
 * 2. Otherwise (v2 Admin Seal room), ONLY authors with `👑 Selo Admin` in the Privilege Roster can
 *    mutate spreadsheet cells (`SNAPSHOT_SYNC`, `DELTA_MUTATION`) or update the Privilege Roster (`ROSTER_UPDATE`).
 */
export function applyIncomingCollabPacket(
  currentState: {
    eventId: string;
    skeleton: FlatSkeletonEntry[];
    privilegeRoster: ParticipantProfile[];
    ledger: LedgerOperation[];
    activityLog: ActivityLogEntry[];
    verifyPub?: string;
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

  // SEC-02: When `verifyPub` is present on the room state, require cryptographic Ed25519 verification
  if (currentState.verifyPub) {
    const expectedPub = currentState.verifyPub.trim();
    const hasValidSig =
      Boolean(packet.sig) &&
      (!packet.verifyPub || packet.verifyPub === expectedPub) &&
      verifyPacket(
        packet as unknown as Record<string, unknown>,
        packet.sig || '',
        expectedPub
      );

    if (!hasValidSig) {
      const securityAlert = appendActivityLogEntry(updatedActivityLog, {
        eventId: currentState.eventId,
        actorId: packet.author?.participantId || 'unknown',
        actorName: packet.author?.fullName || 'Desconhecido',
        actorGroup: packet.author?.groupTag || '',
        actorRole: 'VIEWER',
        actionType: 'UNAUTHORIZED_EDIT_ATTEMPT',
        summary: `Pacote de mutação rejeitado: assinatura digital Ed25519 ausente ou inválida (${packet.author?.fullName || 'Anônimo'}).`,
      });
      return {
        accepted: false,
        rejectedReason: 'INVALID_ED25519_SIGNATURE',
        updatedSkeleton,
        updatedRoster,
        updatedLedger,
        updatedActivityLog: securityAlert.updatedLog,
      };
    }
  } else {
    // Legacy v2 room: Mutation packets (`SNAPSHOT_SYNC`, `DELTA_MUTATION`, `ROSTER_UPDATE`) REQUIRE `👑 Selo Admin`!
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
      const baseRegistry = updatedSkeleton.length > 0 ? updatedSkeleton : packet.skeleton;
      const reconciled = reconcileLedgers(updatedLedger, packet.operations, baseRegistry);
      updatedSkeleton = reconciled.updatedRegistry;
      updatedLedger = reconciled.consolidatedLedger;
    } else if (updatedLedger.length > 0) {
      const reconciled = reconcileLedgers(updatedLedger, [], packet.skeleton);
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

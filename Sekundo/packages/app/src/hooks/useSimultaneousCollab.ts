/**
 * Hook: useSimultaneousCollab
 *
 * Orchestrates simultaneous multi-user (`1:N`) real-time collaboration over:
 * 1. Same-browser instant loopback (`BroadcastChannel`)
 * 2. Cross-device Zero-Knowledge Encrypted Relay (`/signal/room/{room_id}/sync-push` & `sync-pull`)
 *
 * Guarantees:
 * - 100% Zero-Knowledge on the server: every packet is encrypted client-side with `AES-256-GCM`
 *   using the link's passphrase before leaving the device.
 * - Strict RBAC Enforcement: only packets from participants with `👑 Selo Admin` (`hasAdminSeal`)
 *   can mutate spreadsheet cells or update the Privilege Roster.
 * - Real-time Activity Log & Presence synchronization across all connected participants.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  type FlatSkeletonEntry,
  type ParticipantProfile,
  type LedgerOperation,
  type ActivityLogEntry,
  type AuthenticatedSessionPrincipal,
  type CollabPeerPresence,
  type CollabPacketPayloadV2,
  encodeEncryptedCollabPacket,
  decodeEncryptedCollabPacket,
  applyIncomingCollabPacket,
  diffSkeletonToLedgerOperations,
} from '@sekundo/core';
import { API, getHeaders } from '../config/api';
import { getOrCreateDeviceId, loadEventLedger, saveEventLedger } from '../storage/ledgerStore';
import { savePersistedActivityLog } from '../storage/activityLogStore';

export interface UseSimultaneousCollabProps {
  roomId: string;
  eventId: string;
  passphrase: string;
  principal: AuthenticatedSessionPrincipal | null;
  skeleton: FlatSkeletonEntry[];
  privilegeRoster: ParticipantProfile[];
  activityLog: ActivityLogEntry[];
  activeSheet?: string;
  onSkeletonUpdated: (nextSkeleton: FlatSkeletonEntry[]) => void;
  onRosterUpdated?: (nextRoster: ParticipantProfile[]) => void;
  onActivityLogUpdated: (nextLog: ActivityLogEntry[]) => void;
}

export function useSimultaneousCollab({
  roomId,
  eventId,
  passphrase,
  principal,
  skeleton,
  privilegeRoster,
  activityLog,
  activeSheet,
  onSkeletonUpdated,
  onRosterUpdated,
  onActivityLogUpdated,
}: UseSimultaneousCollabProps) {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'live' | 'offline_local'>('idle');
  const [onlinePeers, setOnlinePeers] = useState<CollabPeerPresence[]>([]);
  const [remotePeerCount, setRemotePeerCount] = useState<number>(1);

  const peerIdRef = useRef<string>(`peer_${Math.random().toString(36).slice(2, 9)}`);
  const lastSeqRef = useRef<number>(0);
  const seenPacketIdsRef = useRef<Set<string>>(new Set());
  const broadcastRef = useRef<any>(null);

  // Keep fresh refs to avoid stale closures during polling/broadcast callbacks
  const stateRef = useRef({
    eventId,
    passphrase,
    principal,
    skeleton,
    privilegeRoster,
    activityLog,
    activeSheet,
  });
  stateRef.current = {
    eventId,
    passphrase,
    principal,
    skeleton,
    privilegeRoster,
    activityLog,
    activeSheet,
  };

  useEffect(() => {
    getOrCreateDeviceId()
      .then((id) => {
        peerIdRef.current = id;
      })
      .catch(() => undefined);
  }, []);

  const handleIncomingDecryptedPacket = useCallback(
    async (packet: CollabPacketPayloadV2) => {
      if (!packet || !packet.packetId) return;
      if (seenPacketIdsRef.current.has(packet.packetId)) return;
      seenPacketIdsRef.current.add(packet.packetId);

      const current = stateRef.current;
      const localLedger = await loadEventLedger(current.eventId);

      const outcome = applyIncomingCollabPacket(
        {
          eventId: current.eventId,
          skeleton: current.skeleton,
          privilegeRoster: current.privilegeRoster,
          ledger: localLedger,
          activityLog: current.activityLog,
        },
        packet
      );

      if (outcome.updatedPresence) {
        const pres = outcome.updatedPresence;
        setOnlinePeers((prev) => {
          const filtered = prev.filter(
            (p) =>
              p.peerId !== pres.peerId &&
              p.participantId !== pres.participantId &&
              Date.now() - Date.parse(p.lastSeenIso) < 60_000
          );
          return [...filtered, pres];
        });
      }

      if (outcome.updatedActivityLog.length !== current.activityLog.length) {
        onActivityLogUpdated(outcome.updatedActivityLog);
        await savePersistedActivityLog(current.eventId, outcome.updatedActivityLog);
      }

      if (outcome.accepted) {
        if (packet.kind === 'DELTA_MUTATION' || packet.kind === 'SNAPSHOT_SYNC') {
          await saveEventLedger(current.eventId, outcome.updatedLedger);
          onSkeletonUpdated(outcome.updatedSkeleton);
        }
        if (
          (packet.kind === 'ROSTER_UPDATE' || packet.kind === 'SNAPSHOT_SYNC') &&
          onRosterUpdated &&
          outcome.updatedRoster !== current.privilegeRoster
        ) {
          onRosterUpdated(outcome.updatedRoster);
        }
      }
    },
    [onSkeletonUpdated, onRosterUpdated, onActivityLogUpdated]
  );

  // 1. Setup instant same-browser multi-tab BroadcastChannel
  useEffect(() => {
    const channelKey = (roomId || eventId || '').trim();
    if (!channelKey || typeof BroadcastChannel === 'undefined') return;

    try {
      const bc = new BroadcastChannel(`sekundo_collab_${channelKey}`);
      broadcastRef.current = bc;
      bc.onmessage = async (ev) => {
        const raw = ev?.data;
        if (!raw) return;
        try {
          if (typeof raw === 'string' && stateRef.current.passphrase) {
            const decoded = await decodeEncryptedCollabPacket(raw, stateRef.current.passphrase);
            await handleIncomingDecryptedPacket(decoded);
          } else if (typeof raw === 'object' && raw.protocol === 'SEKUNDO_COLLAB_v2') {
            await handleIncomingDecryptedPacket(raw as CollabPacketPayloadV2);
          }
        } catch {
          // ignore packet with different passphrase
        }
      };
      return () => {
        try {
          bc.close();
        } catch {
          // ignore
        }
        broadcastRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, [roomId, eventId, handleIncomingDecryptedPacket]);

  // Helper to dispatch a packet over both BroadcastChannel and the Zero-Knowledge Encrypted Relay
  const publishCollabPacket = useCallback(
    async (
      partial: Omit<CollabPacketPayloadV2, 'protocol' | 'packetId' | 'roomId' | 'eventId' | 'sentAt' | 'author'>
    ) => {
      const current = stateRef.current;
      const activePrincipal = current.principal;
      const authorInfo = activePrincipal
        ? {
            peerId: peerIdRef.current,
            participantId: activePrincipal.participantId,
            fullName: activePrincipal.fullName,
            groupTag: activePrincipal.groupTag,
            role: activePrincipal.role,
            hasAdminSeal: activePrincipal.hasAdminSeal,
          }
        : {
            peerId: peerIdRef.current,
            participantId: 'unverified',
            fullName: 'Visitante no Portão',
            groupTag: '',
            role: 'UNAUTHORIZED' as const,
            hasAdminSeal: false,
          };

      const packet: CollabPacketPayloadV2 = {
        protocol: 'SEKUNDO_COLLAB_v2',
        packetId: `pkt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        roomId: roomId || current.eventId,
        eventId: current.eventId,
        sentAt: new Date().toISOString(),
        author: authorInfo,
        ...partial,
      };

      seenPacketIdsRef.current.add(packet.packetId);

      // Local BroadcastChannel (instant multi-tab sync)
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage(packet);
        } catch {
          // ignore
        }
      }

      // Remote Zero-Knowledge Encrypted Relay Push
      if (roomId && current.passphrase.trim()) {
        try {
          const cipherPacket = await encodeEncryptedCollabPacket(packet, current.passphrase);
          const res = await fetch(API.signal.syncPush(roomId), {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              peer_id: peerIdRef.current,
              packet_kind: packet.kind,
              cipher_packet: cipherPacket,
            }),
          });
          if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
            const data = await res.json();
            if (typeof data.active_peer_count === 'number') {
              setRemotePeerCount(Math.max(1, data.active_peer_count));
            }
            setSyncStatus('live');
          } else {
            setSyncStatus('offline_local');
          }
        } catch {
          setSyncStatus('offline_local');
        }
      } else {
        setSyncStatus('offline_local');
      }
    },
    [roomId]
  );

  // 2. Poll the Zero-Knowledge Encrypted Relay for new packets from other simultaneous participants
  useEffect(() => {
    if (!roomId || !passphrase.trim()) {
      setSyncStatus('offline_local');
      return;
    }

    let cancelled = false;
    setSyncStatus('syncing');

    const pullRemotePackets = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          API.signal.syncPull(roomId, lastSeqRef.current, peerIdRef.current),
          {
            method: 'GET',
            headers: getHeaders(),
          }
        );
        if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
          if (!cancelled) setSyncStatus('offline_local');
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (typeof data.active_peer_count === 'number') {
          setRemotePeerCount(Math.max(1, data.active_peer_count));
        }

        const packets = Array.isArray(data.packets) ? data.packets : [];
        for (const item of packets) {
          if (typeof item.seq === 'number' && item.seq > lastSeqRef.current) {
            lastSeqRef.current = item.seq;
          }
          if (item.cipher_packet && stateRef.current.passphrase) {
            try {
              const decoded = await decodeEncryptedCollabPacket(
                item.cipher_packet,
                stateRef.current.passphrase
              );
              await handleIncomingDecryptedPacket(decoded);
            } catch {
              // ignore undecryptable packet
            }
          }
        }
        if (!cancelled) setSyncStatus('live');
      } catch {
        if (!cancelled) setSyncStatus('offline_local');
      }
    };

    pullRemotePackets();
    const interval = setInterval(pullRemotePackets, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, passphrase, handleIncomingDecryptedPacket]);

  // 3. Emit presence heartbeat when principal is authenticated
  useEffect(() => {
    if (!principal || principal.isPinLocked) return;

    const myPresence: CollabPeerPresence = {
      peerId: peerIdRef.current,
      participantId: principal.participantId,
      fullName: principal.fullName,
      groupTag: principal.groupTag,
      role: principal.role,
      hasAdminSeal: principal.hasAdminSeal,
      activeSheet,
      lastSeenIso: new Date().toISOString(),
    };

    setOnlinePeers((prev) => {
      const others = prev.filter(
        (p) => p.peerId !== myPresence.peerId && p.participantId !== myPresence.participantId
      );
      return [myPresence, ...others];
    });

    publishCollabPacket({
      kind: 'PRESENCE_HEARTBEAT',
      presence: myPresence,
    });
  }, [principal?.participantId, principal?.role, principal?.isPinLocked, activeSheet, publishCollabPacket]);

  const broadcastSkeletonSnapshot = useCallback(
    async (
      nextSkeleton: FlatSkeletonEntry[],
      nextRoster?: ParticipantProfile[],
      newLogEntries?: ActivityLogEntry[],
      explicitOps?: LedgerOperation[]
    ) => {
      const current = stateRef.current;
      const existingLedger = await loadEventLedger(current.eventId);
      const authorId = current.principal?.participantId || peerIdRef.current;
      const authorName = current.principal?.fullName || 'Operador';

      const deltaOps =
        explicitOps && explicitOps.length > 0
          ? explicitOps
          : diffSkeletonToLedgerOperations(
              current.eventId,
              current.skeleton,
              nextSkeleton,
              authorId,
              authorName
            );

      const mergedLedger =
        deltaOps.length > 0 ? [...existingLedger, ...deltaOps] : existingLedger;

      if (deltaOps.length > 0) {
        await saveEventLedger(current.eventId, mergedLedger);
      }

      // Update stateRef skeleton immediately so subsequent edits diff against the latest state
      stateRef.current.skeleton = nextSkeleton;

      await publishCollabPacket({
        kind: 'SNAPSHOT_SYNC',
        skeleton: nextSkeleton,
        privilegeRoster: nextRoster || current.privilegeRoster,
        operations: mergedLedger,
        activityEntries: newLogEntries || current.activityLog.slice(-20),
      });
    },
    [publishCollabPacket]
  );

  const broadcastActivityEntries = useCallback(
    async (entries: ActivityLogEntry[]) => {
      const current = stateRef.current;
      const presence: CollabPeerPresence | undefined = current.principal
        ? {
            peerId: peerIdRef.current,
            participantId: current.principal.participantId,
            fullName: current.principal.fullName,
            groupTag: current.principal.groupTag,
            role: current.principal.role,
            hasAdminSeal: current.principal.hasAdminSeal,
            activeSheet: current.activeSheet,
            lastSeenIso: new Date().toISOString(),
          }
        : undefined;

      await publishCollabPacket({
        kind: 'ACTIVITY_LOG',
        activityEntries: entries,
        presence,
      });
    },
    [publishCollabPacket]
  );

  return {
    syncStatus,
    onlinePeers,
    onlineCount: Math.max(onlinePeers.length, remotePeerCount),
    broadcastSkeletonSnapshot,
    broadcastActivityEntries,
  };
}

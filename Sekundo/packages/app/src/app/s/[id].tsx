/**
 * Sekundo — Zero-Bureaucracy Capability Recipient Screen (`/s/[id]#r=<readKey>[&w=<signSeed>]`)
 *
 * Implements Phase F1 & F2 of the Master Plan:
 *   - ZERO login, ZERO passphrase prompt, ZERO Name+Group+PIN modal on load!
 *   - Reads `id` from route params and `#r` / `&w` strictly from the URL `#` fragment.
 *   - Fetches the opaque AES-256-GCM blob from the stateless relay (`GET /signal/share/blob/{id}`)
 *     or local cache fallback, decrypts locally with `decryptBlobWithReadKey`, and renders
 *     the scoped territories/schedule in < 3 seconds.
 *   - If `&w=<signSeed>` is present (`mode === 'edit'`), allows 1-tap progress toggling
 *     cryptographically signed with Ed25519 (`signCollabPacket` / `SEC-02`).
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  parseCapabilityUrl,
  decryptBlobWithReadKey,
  encryptBlobWithReadKey,
  createLedgerOperation,
  signCollabPacket,
  encodeEncryptedCollabPacket,
  buildGoogleMapsSearchUrl,
  type ScopedProjection,
  type ScopedProjectionNode,
  type CollabPacketPayloadV2,
} from '@sekundo/core';
import { API, getHeaders } from '../../config/api';
import {
  loadCapabilityBlobFromLocalCache,
  saveCapabilityBlobToLocalCache,
} from '../../components/share/QuickShareSheet';

const Colors = {
  textSecondary: '#94A3B8',
};
const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
};
const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export default function CapabilityRecipientScreen() {
  const params = useLocalSearchParams<{ id?: string; r?: string; w?: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [projection, setProjection] = useState<ScopedProjection | null>(null);
  const [nodes, setNodes] = useState<ScopedProjectionNode[]>([]);
  const [readKey, setReadKey] = useState<string>('');
  const [signSeed, setSignSeed] = useState<string | undefined>(undefined);
  const [blobId, setBlobId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('Pronto');

  useEffect(() => {
    let cancelled = false;

    async function loadAndDecryptScope() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const rawId = String(params.id || '').trim();
        const rawHash =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.hash
            : '';

        const parsed = parseCapabilityUrl(`/s/${rawId}`, rawHash);
        if (!parsed) {
          throw new Error(
            'Link incompleto ou chave de leitura ausente no fragmento (#r=...). Verifique se o link foi copiado por completo.'
          );
        }

        setBlobId(parsed.blobId);
        setReadKey(parsed.readKey);
        setSignSeed(parsed.signSeed);

        let cipherBlob: string | null = null;

        // 1. Try stateless relay first
        try {
          const response = await fetch(API.share.blob(parsed.blobId), {
            method: 'GET',
            headers: getHeaders(),
          });
          if (response.ok) {
            const data = await response.json();
            if (data && typeof data.cipher_blob === 'string') {
              const fetchedBlob: string = data.cipher_blob;
              cipherBlob = fetchedBlob;
              saveCapabilityBlobToLocalCache(parsed.blobId, fetchedBlob);
            }
          }
        } catch {
          // Offline or relay unreachable -> fall back to local cache
        }

        // 2. Fallback to local cache (same-device / offline preview)
        if (!cipherBlob) {
          cipherBlob = loadCapabilityBlobFromLocalCache(parsed.blobId);
        }

        if (!cipherBlob) {
          throw new Error(
            'Escopo criptografado não encontrado ou expirado no servidor relay.'
          );
        }

        const decrypted = await decryptBlobWithReadKey(cipherBlob, parsed.readKey);
        if (cancelled) return;

        setProjection(decrypted.projection);
        setNodes(decrypted.projection.nodes || []);
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Não foi possível descriptografar este link.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAndDecryptScope();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const canEdit = Boolean(signSeed);

  const toggleNodeWorked = useCallback(
    async (targetNode: ScopedProjectionNode) => {
      if (!canEdit || !signSeed || !readKey || !projection) return;

      const currentVal = Number(targetNode.value) === 1 ? 1 : 0;
      const nextVal = currentVal === 1 ? 0 : 1;

      const updatedNodes = nodes.map((n) => {
        if (n.key !== targetNode.key) return n;
        return {
          ...n,
          value: String(nextVal),
          meta: {
            ...(n.meta || {}),
            worked: nextVal,
            updatedAt: new Date().toISOString(),
          },
        };
      });

      setNodes(updatedNodes);
      setSyncStatus('Assinando com Ed25519...');

      try {
        const updatedProjection: ScopedProjection = {
          ...projection,
          nodes: updatedNodes,
        };
        setProjection(updatedProjection);

        // Re-encrypt updated snapshot blob & save locally
        const updatedBlob = await encryptBlobWithReadKey(
          {
            protocol: 'SEKUNDO_CAP_v3',
            blobId,
            verifyPub: projection.verifyPub,
            projection: updatedProjection,
          },
          readKey
        );
        saveCapabilityBlobToLocalCache(blobId, updatedBlob);

        // Sign delta operation with Ed25519 signSeed (SEC-02)
        const op = createLedgerOperation(
          projection.eventId || 'cap_event',
          targetNode.key,
          'value',
          nextVal,
          `cap_peer_${blobId.slice(0, 6)}`,
          { prevValue: currentVal, authorName: 'Participante (Link)' }
        );

        const unsignedPacket: CollabPacketPayloadV2 = {
          protocol: 'SEKUNDO_COLLAB_v2',
          packetId: `pkt_${Date.now()}`,
          roomId: blobId,
          eventId: projection.eventId || 'cap_event',
          kind: 'DELTA_MUTATION',
          sentAt: new Date().toISOString(),
          author: {
            peerId: `cap_peer_${blobId.slice(0, 6)}`,
            participantId: 'cap_editor',
            fullName: 'Editor (Link Assinado)',
            groupTag: 'Campo',
            role: 'ADMIN_SEAL',
            hasAdminSeal: true,
          },
          operations: [op],
        };

        const signedPacket = signCollabPacket(unsignedPacket, signSeed);
        const cipherPacket = await encodeEncryptedCollabPacket(signedPacket, readKey);

        // Push updated blob & signed delta to stateless relay (best-effort)
        await Promise.allSettled([
          fetch(API.share.blob(blobId), {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ cipher_blob: updatedBlob }),
          }),
          fetch(API.signal.syncPush(blobId), {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              peer_id: signedPacket.author.peerId,
              packet_kind: 'DELTA_MUTATION',
              cipher_packet: cipherPacket,
            }),
          }),
        ]);

        setSyncStatus('✓ Salvo e assinado (Ed25519)');
      } catch {
        setSyncStatus('💾 Salvo localmente');
      }
    },
    [canEdit, signSeed, readKey, projection, nodes, blobId]
  );

  const leafNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          String(n.type) === 'leaf' ||
          String(n.type) === 'unit' ||
          n.type === 'slot' ||
          (n.meta && (n.meta.address || n.meta.street || n.meta.assignee))
      ),
    [nodes]
  );

  const displayNodes = leafNodes.length > 0 ? leafNodes : nodes;
  const completedCount = useMemo(
    () => displayNodes.filter((n) => Number(n.value) === 1).length,
    [displayNodes]
  );

  if (loading) {
    return (
      <View style={styles.centerContainer} testID="capability-recipient-loading">
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>
          Descriptografando escopo localmente (AES-256-GCM)...
        </Text>
      </View>
    );
  }

  if (errorMsg || !projection) {
    return (
      <View style={styles.centerContainer} testID="capability-recipient-error">
        <Text style={styles.errorIcon}>🔒</Text>
        <Text style={styles.errorTitle}>Não foi possível abrir este link</Text>
        <Text style={styles.errorBody}>{errorMsg}</Text>
        <TouchableOpacity
          style={styles.backHomeBtn}
          onPress={() => router.replace('/')}
          testID="capability-back-home-btn"
        >
          <Text style={styles.backHomeBtnText}>← Ir para o Início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="capability-recipient-screen">
      {/* Top Header Ribbon */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.scopeTitle} testID="capability-scope-title">
            {projection.title || projection.scope.title || 'Escopo Compartilhado'}
          </Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.modeBadge,
                canEdit ? styles.modeBadgeEdit : styles.modeBadgeRead,
              ]}
              testID="capability-mode-badge"
            >
              <Text style={styles.modeBadgeText}>
                {canEdit
                  ? '✏️ Pode marcar progresso (Ed25519)'
                  : '👁️ Somente Leitura'}
              </Text>
            </View>
            <Text style={styles.progressBadge} testID="capability-progress-text">
              {completedCount} / {displayNodes.length} concluídos • {syncStatus}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.homePill}
          onPress={() => router.push('/')}
          testID="capability-open-app-btn"
        >
          <Text style={styles.homePillText}>Painel Sekundo</Text>
        </TouchableOpacity>
      </View>

      {/* Scoped Nodes Checklist */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
      >
        {displayNodes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nenhum item neste escopo.</Text>
          </View>
        ) : (
          displayNodes.map((node) => {
            const isDone = Number(node.value) === 1;
            const meta = (node.meta || {}) as Record<string, any>;
            const addressStr = String(
              meta.address || meta.street || node.label || ''
            ).trim();
            const subtitleParts = [
              meta.group ? `Grupo: ${meta.group}` : '',
              meta.assignee ? `Designado: ${meta.assignee}` : '',
              meta.date ? `Data: ${meta.date}` : '',
              meta.notes ? `Obs: ${meta.notes}` : '',
            ].filter(Boolean);

            return (
              <View
                key={node.key}
                style={[styles.itemCard, isDone && styles.itemCardDone]}
                testID={`capability-node-${node.key}`}
              >
                <TouchableOpacity
                  style={styles.itemMainTouch}
                  disabled={!canEdit}
                  onPress={() => toggleNodeWorked(node)}
                  testID={`capability-toggle-${node.key}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isDone && styles.checkboxDone,
                      !canEdit && styles.checkboxReadOnly,
                    ]}
                  >
                    {isDone && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.itemLabel, isDone && styles.itemLabelDone]}
                    >
                      {node.label || node.key}
                    </Text>
                    <Text style={styles.itemKeySub}>Chave: {node.key}</Text>
                    {subtitleParts.length > 0 && (
                      <Text style={styles.itemMetaText}>
                        {subtitleParts.join(' • ')}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {addressStr.length > 3 && (
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() => {
                      const url = buildGoogleMapsSearchUrl({
                        label: addressStr,
                        street: String(meta.street || addressStr),
                        number: String(meta.number || ''),
                        neighborhood: String(meta.neighborhood || ''),
                        city: String(meta.city || ''),
                        lat: meta.lat ? Number(meta.lat) : undefined,
                        lng: meta.lng ? Number(meta.lng) : undefined,
                      });
                      Linking.openURL(url);
                    }}
                    testID={`capability-map-btn-${node.key}`}
                  >
                    <Text style={styles.mapBtnText}>📍 Mapa</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 42,
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: FontSize.sm,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 420,
  },
  backHomeBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backHomeBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  scopeTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  modeBadgeEdit: {
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderColor: '#10B981',
  },
  modeBadgeRead: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    borderColor: '#38BDF8',
  },
  modeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  progressBadge: {
    fontSize: FontSize.xs,
    color: '#94A3B8',
    fontWeight: '600',
  },
  homePill: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePillText: {
    color: '#38BDF8',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    gap: 10,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  emptyBox: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: FontSize.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: Spacing.sm,
    gap: 10,
  },
  itemCardDone: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  itemMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxReadOnly: {
    opacity: 0.65,
  },
  checkboxTick: {
    color: '#020617',
    fontWeight: '900',
    fontSize: 16,
  },
  itemLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  itemLabelDone: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  itemKeySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemMetaText: {
    fontSize: FontSize.xs,
    color: '#38BDF8',
    marginTop: 3,
  },
  mapBtn: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: {
    color: '#38BDF8',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
});

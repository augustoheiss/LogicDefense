/**
 * Page: share
 *
 * Admin interface to generate secure URL-safe encrypted tokens.
 * Computes Horizon Window payload, encrypts it using out-of-band passphrase,
 * and provides a copy-ready shareable URL.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useLocalEvent } from '../hooks/useLocalEvent';
import { useSkeleton } from '../hooks/useSkeleton';
import {
  generateToken,
  buildShareURL,
  DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS,
  ensureParticipantPrivilegeMatrix,
  hasActivePrivileges,
  encodeEncryptedCollabPacket,
  type ParticipantProfile,
} from '@sekundo/core';
import {
  loadSavedPrivilegeParticipants,
  savePrivilegeParticipants,
} from '../storage/omniStorageBridge';
import {
  loadPersistedActivityLog,
  recordPersistedActivityEvent,
} from '../storage/activityLogStore';
import { PrivilegeMatrixModal } from '../components/PrivilegeMatrixModal';
import { API } from '../config/api';
import * as Clipboard from 'expo-clipboard';

export default function ShareEvent() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const eventId = typeof id === 'string' ? id : '';

  const { events } = useLocalEvent();
  const event = events.find((e) => e.config.id === eventId);
  const { flatRegistry, loading: skeletonLoading } = useSkeleton(eventId);

  const [passphrase, setPassphrase] = useState('');
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [privilegeRoster, setPrivilegeRoster] = useState<ParticipantProfile[]>(() =>
    DEFAULT_PRIVILEGE_MATRIX_PARTICIPANTS.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx))
  );
  const [showPrivilegeModal, setShowPrivilegeModal] = useState(false);

  useEffect(() => {
    let active = true;
    loadSavedPrivilegeParticipants().then((saved) => {
      if (active && saved && saved.length > 0) {
        setPrivilegeRoster(saved.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx)));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const governanceStats = useMemo(() => {
    const total = privilegeRoster.length;
    const authorizedViewers = privilegeRoster.filter((p) => hasActivePrivileges(p)).length;
    const adminSealHolders = privilegeRoster.filter(
      (p) => hasActivePrivileges(p) && Boolean(p.hasAdminSeal)
    );
    const blockedCount = total - authorizedViewers;
    return {
      total,
      authorizedViewers,
      adminCount: adminSealHolders.length,
      adminNames: adminSealHolders.map((p) => `${p.name} (PIN: ${p.accessPin || '1001'})`),
      blockedCount,
    };
  }, [privilegeRoster]);

  if (skeletonLoading || !event) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  const handleUpdatePrivilegeRoster = async (updated: ParticipantProfile[]) => {
    const normalized = updated.map((p, idx) => ensureParticipantPrivilegeMatrix(p, idx));
    setPrivilegeRoster(normalized);
    await savePrivilegeParticipants(normalized);
  };

  const handleGenerateLink = async () => {
    if (!passphrase.trim()) return;
    setGenerating(true);
    setCopied(false);
    try {
      // 1. Create or allocate a room ID for simultaneous Zero-Knowledge sync
      let activeRoomId = `rm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        const res = await fetch(API.signal.createRoom, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data?.room_id) activeRoomId = data.room_id;
        }
      } catch {
        // Offline / local fallback room ID remains active
      }

      // 2. Record link creation in the immutable Activity Log
      const { updatedLog } = await recordPersistedActivityEvent({
        eventId: eventId || 'global',
        actorId: 'admin-host',
        actorName: 'Coordenador Host',
        actorGroup: 'Administração',
        actorRole: 'ADMIN_SEAL',
        actionType: 'SHARE_LINK_CREATED',
        targetSheet: 'GERAL',
        summary: `Link simultâneo E2EE gerado (Sala ${activeRoomId}) com ${governanceStats.authorizedViewers} credenciados (${governanceStats.adminCount} c/ Selo Admin).`,
      });

      // 3. Generate encrypted Base64URL token with embedded Privilege Roster + Room ID + Audit Log
      const token = await generateToken(event, flatRegistry, passphrase, {
        privilegeRoster,
        roomId: activeRoomId,
        activityLog: updatedLog,
      });

      // 4. Push initial encrypted SNAPSHOT_SYNC packet to the room (best-effort)
      try {
        const currentLog = await loadPersistedActivityLog(eventId || 'global');
        const cipherPacket = await encodeEncryptedCollabPacket(
          {
            protocol: 'SEKUNDO_COLLAB_v2',
            packetId: `pkt_init_${Date.now().toString(36)}`,
            roomId: activeRoomId,
            eventId: eventId || 'global',
            sentAt: new Date().toISOString(),
            kind: 'SNAPSHOT_SYNC',
            author: {
              peerId: 'admin_host',
              participantId: privilegeRoster.find((p) => p.hasAdminSeal)?.id || 'p-01',
              fullName: privilegeRoster.find((p) => p.hasAdminSeal)?.name || 'Coordenador Host',
              groupTag: privilegeRoster.find((p) => p.hasAdminSeal)?.groupTag || 'Grupo 1',
              role: 'ADMIN_SEAL',
              hasAdminSeal: true,
            },
            skeleton: Object.values(flatRegistry),
            privilegeRoster,
            activityEntries: currentLog.slice(-40),
          },
          passphrase
        );
        await fetch(API.signal.syncPush(activeRoomId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            peer_id: 'admin_host',
            packet_kind: 'SNAPSHOT_SYNC',
            cipher_packet: cipherPacket,
          }),
        });
      } catch {
        // Best-effort initial room push
      }

      // 5. Build the full URL
      const appBaseUrl = PlatformShareUrlBase();
      const fullUrl = buildShareURL(appBaseUrl, token, activeRoomId);

      setRoomId(activeRoomId);
      setShareUrl(fullUrl);
    } catch (err: any) {
      alert('Failed to generate token: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Editor</Text>
          </Pressable>
          <Text style={styles.title}>Secure Event Sharing</Text>
          <Text style={styles.subtitle}>
            Event: {event.config.name}
          </Text>
        </View>

        {/* Informative Alert */}
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>🔒 Política Zero-Knowledge + Controle por Lista de Privilégios</Text>
          <Text style={styles.alertText}>
            A senha de criptografia nunca vai na URL. Ao abrir o link, cada pessoa confirma (apenas no
            1º acesso) seu Nome Completo, Grupo e PIN. Quem não estiver na Lista de Privilégios é
            bloqueado. Somente quem tiver o 👑 Selo Admin poderá editar e exportar a planilha.
          </Text>
        </View>

        {/* Governance & Privilege List Summary Box */}
        <View style={styles.governanceBox}>
          <View style={styles.governanceHeaderRow}>
            <Text style={styles.governanceTitle}>🛡️ HIERARQUIA EMBUTIDA NO LINK</Text>
            <Pressable
              onPress={() => setShowPrivilegeModal(true)}
              style={styles.managePrivBtn}
            >
              <Text style={styles.managePrivBtnText}>⚙️ Editar Selo Admin & PINs</Text>
            </Pressable>
          </View>
          <View style={styles.governanceStatsRow}>
            <View style={styles.statBadge}>
              <Text style={[styles.statNumber, { color: '#FDE68A' }]}>
                👑 {governanceStats.adminCount}
              </Text>
              <Text style={styles.statLabel}>Selo Admin (Editar/Exportar)</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={[styles.statNumber, { color: '#38BDF8' }]}>
                👁️ {governanceStats.authorizedViewers - governanceStats.adminCount}
              </Text>
              <Text style={styles.statLabel}>Somente Consulta</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={[styles.statNumber, { color: '#F87171' }]}>
                ⛔ {governanceStats.blockedCount}
              </Text>
              <Text style={styles.statLabel}>Sem Privilégio (Bloqueados)</Text>
            </View>
          </View>
          {governanceStats.adminNames.length > 0 && (
            <Text style={styles.adminListHint} numberOfLines={2}>
              👑 Admins ativos: {governanceStats.adminNames.join(' • ')}
            </Text>
          )}
        </View>

        {/* Input Form */}
        {!shareUrl ? (
          <View style={styles.form}>
            <Text style={styles.label}>SENHA DE CRIPTOGRAFIA E2EE DA SALA</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passphrase}
              onChangeText={setPassphrase}
              placeholder="ex: sekundo-sala-segura-2026"
              placeholderTextColor="#4F5E74"
            />
            <Text style={styles.inputSub}>
              Escolha uma senha forte. Ela deriva a chave AES-256-GCM local para o link e para a sincronização simultânea.
            </Text>

            <Pressable
              onPress={handleGenerateLink}
              disabled={!passphrase.trim() || generating}
              style={[
                styles.primaryBtn,
                (!passphrase.trim() || generating) && styles.btnDisabled,
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#12151C" />
              ) : (
                <Text style={styles.primaryBtnText}>🔐 Criptografar & Gerar Link Simultâneo</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.resultContainer}>
            <Text style={styles.label}>
              LINK COMPARTILHÁVEL PRONTO {roomId ? `• SALA: ${roomId}` : ''}
            </Text>
            
            <View style={styles.urlDisplay}>
              <Text style={styles.urlText} numberOfLines={2}>
                {shareUrl}
              </Text>
            </View>

            <View style={styles.resultActions}>
              <Pressable onPress={handleCopy} style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>
                  {copied ? '✓ Copiado!' : '📋 Copiar Link'}
                </Text>
              </Pressable>
              
              <Pressable onPress={() => setShareUrl(null)} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Nova Senha</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <PrivilegeMatrixModal
        visible={showPrivilegeModal}
        onClose={() => setShowPrivilegeModal(false)}
        participants={privilegeRoster}
        onChangeParticipants={handleUpdatePrivilegeRoster}
      />
    </SafeAreaView>
  );
}

function PlatformShareUrlBase(): string {
  if (typeof window !== 'undefined') {
    // Matches the current hosting URL (works in local dev, staging, prod)
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'https://sekundo.app';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#12151C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  header: {
    marginBottom: 24,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#8A94A6',
    fontSize: 14,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: '#6F7E94',
    fontSize: 13,
    marginTop: 4,
  },
  alertBox: {
    backgroundColor: 'rgba(255, 184, 0, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.15)',
    padding: 16,
    marginBottom: 24,
  },
  alertTitle: {
    color: '#FFB800',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertText: {
    color: '#A9B4C5',
    fontSize: 12,
    lineHeight: 18,
  },
  governanceBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  governanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  governanceTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  managePrivBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#60A5FA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  managePrivBtnText: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '700',
  },
  governanceStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flex: 1,
    backgroundColor: '#090D16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  adminListHint: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#8A94A6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 16,
  },
  inputSub: {
    color: '#4F5E74',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#FFB800',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  primaryBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 16,
  },
  resultContainer: {
    width: '100%',
  },
  urlDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 20,
  },
  urlText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  copyBtn: {
    flex: 1.5,
    backgroundColor: '#FFB800',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 10,
  },
  copyBtnText: {
    color: '#12151C',
    fontWeight: '700',
    fontSize: 14,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  resetBtnText: {
    color: '#A9B4C5',
    fontWeight: '600',
    fontSize: 14,
  },
});

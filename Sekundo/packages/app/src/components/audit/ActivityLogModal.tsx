/**
 * Component: ActivityLogModal
 *
 * Displays the live Tamper-Evident Activity & Governance Audit Log (`ActivityLogEntry[]`)
 * and currently connected simultaneous participants (`CollabPeerPresence[]`).
 * - Filterable by category (`ALL`, `access`, `security`, `view`, `edit`, `export`).
 * - Verifies cryptographic hash chain integrity (`verifyActivityLogChain`).
 * - Allows exporting the audit trail to CSV ONLY if the current user holds the `👑 Selo Admin`.
 */

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  type ActivityLogEntry,
  type CollabPeerPresence,
  type AuthenticatedSessionPrincipal,
  ACTIVITY_ACTION_LABELS,
  verifyActivityLogChain,
  exportActivityLogToCsv,
  canPerformSpreadsheetAction,
} from '@sekundo/core';
import { deliverFile } from '../../utils/deliverFile';

export interface ActivityLogModalProps {
  visible: boolean;
  onClose: () => void;
  eventName?: string;
  entries: ActivityLogEntry[];
  onlinePeers?: CollabPeerPresence[];
  currentPrincipal?: AuthenticatedSessionPrincipal | null;
  onBlockedExportAttempt?: () => void;
  onExportLogRecorded?: () => void;
}

type CategoryFilter = 'ALL' | 'access' | 'security' | 'view' | 'edit' | 'export';

export function ActivityLogModal({
  visible,
  onClose,
  eventName = 'Planilha Sekundo',
  entries,
  onlinePeers = [],
  currentPrincipal,
  onBlockedExportAttempt,
  onExportLogRecorded,
}: ActivityLogModalProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

  const chainCheck = useMemo(() => verifyActivityLogChain(entries), [entries]);

  const canExportAudit = useMemo(
    () =>
      currentPrincipal
        ? canPerformSpreadsheetAction(currentPrincipal, 'EXPORT_AUDIT_LOG')
        : true,
    [currentPrincipal]
  );

  const filteredEntries = useMemo(() => {
    const reversed = [...entries].reverse();
    if (categoryFilter === 'ALL') return reversed;
    return reversed.filter((e) => {
      const meta = ACTIVITY_ACTION_LABELS[e.actionType];
      return meta?.category === categoryFilter;
    });
  }, [entries, categoryFilter]);

  if (!visible) return null;

  const handleExportLogCsv = async () => {
    if (!canExportAudit) {
      onBlockedExportAttempt?.();
      return;
    }
    const csv = exportActivityLogToCsv(entries);
    const stamp = new Date().toISOString().slice(0, 10);
    await deliverFile(
      csv,
      `sekundo-log-atividades-${stamp}.csv`,
      'text/csv;charset=utf-8'
    );
    onExportLogRecorded?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>📜 Log de Atividades & Auditoria</Text>
              <Text style={styles.subtitle}>
                {eventName} • {entries.length} registros •{' '}
                {chainCheck.valid ? '✓ Cadeia SHA/FNV Íntegra' : '⚠️ Alerta de Integridade'}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                testID="activity-log-export-csv-btn"
                onPress={handleExportLogCsv}
                style={[styles.exportBtn, !canExportAudit && styles.exportBtnLocked]}
              >
                <Text style={styles.exportBtnText}>
                  {canExportAudit ? '📤 Exportar Log CSV' : '🔒 Exportar (Só Admin)'}
                </Text>
              </Pressable>

              <Pressable testID="activity-log-close-btn" onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Simultaneous Online Peers Bar */}
          {onlinePeers.length > 0 ? (
            <View style={styles.presenceBox}>
              <Text style={styles.presenceTitle}>
                🟢 PARTICIPANTES SIMULTÂNEOS ONLINE AGORA ({onlinePeers.length})
              </Text>
              <View style={styles.presenceRow}>
                {onlinePeers.map((peer) => (
                  <View
                    key={`${peer.peerId}-${peer.participantId}`}
                    style={[
                      styles.peerChip,
                      peer.hasAdminSeal ? styles.peerChipAdmin : styles.peerChipViewer,
                    ]}
                  >
                    <Text style={styles.peerChipText}>
                      {peer.hasAdminSeal ? '👑 ' : '👁️ '}
                      {peer.fullName} ({peer.groupTag || 'Geral'})
                      {peer.activeSheet ? ` • ${peer.activeSheet}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Category Filter Chips */}
          <View style={styles.filterRow}>
            {(
              [
                { id: 'ALL', label: `🌐 Todos (${entries.length})` },
                { id: 'access', label: '🚪 Acessos & Logout' },
                { id: 'security', label: '🛡️ Bloqueios & Selo' },
                { id: 'view', label: '👁️ Consultas' },
                { id: 'edit', label: '✏️ Edições' },
                { id: 'export', label: '📤 Exportações' },
              ] as Array<{ id: CategoryFilter; label: string }>
            ).map((f) => {
              const active = categoryFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setCategoryFilter(f.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Activity Log Entries List */}
          <ScrollView style={styles.listScroll}>
            {filteredEntries.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Nenhuma atividade registrada neste filtro ainda.
                </Text>
              </View>
            ) : (
              filteredEntries.map((entry) => {
                const actionMeta = ACTIVITY_ACTION_LABELS[entry.actionType] || {
                  icon: '📝',
                  label: entry.actionType,
                  color: '#94A3B8',
                };
                const roleBadge =
                  entry.actorRole === 'ADMIN_SEAL'
                    ? { label: '👑 SELO ADMIN', bg: 'rgba(255, 184, 0, 0.16)', fg: '#FFB800' }
                    : entry.actorRole === 'VIEWER'
                    ? { label: '👁️ CONSULTA', bg: 'rgba(56, 189, 248, 0.15)', fg: '#38BDF8' }
                    : { label: '🚫 BLOQUEADO', bg: 'rgba(239, 68, 68, 0.18)', fg: '#FCA5A5' };

                return (
                  <View key={entry.logId} style={styles.entryCard}>
                    <View style={styles.entryTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                        <Text style={[styles.actionBadge, { color: actionMeta.color }]}>
                          {actionMeta.icon} {actionMeta.label}
                        </Text>
                        <View style={[styles.rolePill, { backgroundColor: roleBadge.bg }]}>
                          <Text style={[styles.rolePillText, { color: roleBadge.fg }]}>
                            {roleBadge.label}
                          </Text>
                        </View>
                        <Text style={styles.actorText}>
                          {entry.actorName}
                          {entry.actorGroup ? ` (${entry.actorGroup})` : ''}
                        </Text>
                      </View>
                      <Text style={styles.timeText}>
                        {entry.timestamp.replace('T', ' ').slice(0, 19)}
                      </Text>
                    </View>

                    <Text style={styles.summaryText}>{entry.summary}</Text>

                    {entry.beforeValue !== undefined || entry.afterValue !== undefined ? (
                      <View style={styles.diffBox}>
                        {entry.beforeValue !== undefined ? (
                          <Text style={styles.diffBefore} numberOfLines={1}>
                            Antes: {entry.beforeValue || '(vazio)'}
                          </Text>
                        ) : null}
                        {entry.afterValue !== undefined ? (
                          <Text style={styles.diffAfter} numberOfLines={1}>
                            Depois: {entry.afterValue || '(vazio)'}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    <Text style={styles.hashText}>
                      Hash: {entry.entryHash} ← {entry.prevHash}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 10, 18, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#34D399',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportBtn: {
    backgroundColor: '#FFB800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportBtnLocked: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  exportBtnText: {
    color: '#0F172A',
    fontSize: 11.5,
    fontWeight: '800',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  presenceBox: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
    marginBottom: 12,
  },
  presenceTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  presenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  peerChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  peerChipAdmin: {
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
    borderColor: '#FFB800',
  },
  peerChipViewer: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38BDF8',
  },
  peerChipText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listScroll: {
    maxHeight: 440,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  entryCard: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    marginBottom: 8,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  actionBadge: {
    fontSize: 12,
    fontWeight: '800',
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  actorText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  timeText: {
    color: '#64748B',
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  summaryText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  diffBox: {
    marginTop: 6,
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  diffBefore: {
    color: '#FCA5A5',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  diffAfter: {
    color: '#6EE7B7',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  hashText: {
    marginTop: 4,
    color: '#475569',
    fontSize: 9.5,
    fontFamily: 'monospace',
  },
});

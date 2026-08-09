/**
 * SyncAuditPanel Component — Assistente Moeda
 *
 * Real-Time Sync Status Badge + Sequence Timeline Version + Audit Log Feed
 * Rendered in Settings screen (settings.tsx).
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useLocalSync, AuditLogItem, SyncStatus } from '@/hooks/useLocalSync';

export function SyncAuditPanel() {
  const router = useRouter();
  const { status, lastSeqNumber, auditLogs, forceSyncPending, undoAuditLog } = useLocalSync();

  const getStatusBadge = (st: SyncStatus) => {
    switch (st) {
      case 'connected':
        return {
          bg: '#D1FAE5',
          color: '#065F46',
          label: '🟢 Conectado em Tempo Real (SSE Local)',
        };
      case 'syncing':
        return {
          bg: '#FEF3C7',
          color: '#92400E',
          label: '🟡 Sincronizando Lançamentos Pendentes...',
        };
      case 'key_rotated':
        return {
          bg: '#FEE2E2',
          color: '#991B1B',
          label: '🔴 Chave API Rotacionada / Revogada',
        };
      case 'error':
      case 'disconnected':
      default:
        return {
          bg: colors.background.tertiary,
          color: colors.text.secondary,
          label: '⚪ Desconectado / Aguardando Chave API',
        };
    }
  };

  const getOriginIcon = (origin: AuditLogItem['origin']) => {
    switch (origin) {
      case 'python':
        return '🐍';
      case 'whatsapp':
        return '🤖';
      case 'csv':
        return '📄';
      case 'web_ui':
      default:
        return '📱';
    }
  };

  const badge = getStatusBadge(status);

  return (
    <View style={styles.container}>
      {/* Header & Status Badge */}
      <View style={styles.header}>
        <Text style={styles.title}>Auditoria & Sincronismo Local em Tempo Real</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      {/* Timeline Sequence & Actions */}
      <View style={styles.infoRow}>
        <View style={styles.seqCard}>
          <Text style={styles.seqLabel}>Versão da Linha do Tempo</Text>
          <Text style={styles.seqValue}>seq #{lastSeqNumber}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.syncButton, pressed && { opacity: 0.8 }]}
          onPress={forceSyncPending}
        >
          <Text style={styles.syncButtonText}>🔄 Sincronizar Agora</Text>
        </Pressable>
      </View>

      {/* Audit Log Feed */}
      <Text style={styles.sectionSubtitle}>Log de Eventos & Mutações ({auditLogs.length})</Text>

      {auditLogs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nenhuma mutação recebida recentemente.</Text>
          <Text style={styles.emptySubtext}>As requisições enviadas via Chave API aparecerão instantaneamente aqui.</Text>
        </View>
      ) : (
        <View style={styles.feedList}>
          {auditLogs.map((item) => (
            <View key={item.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logOrigin}>
                  {getOriginIcon(item.origin)} {item.description}
                </Text>
                <Text style={styles.logMeta}>
                  {item.timestamp} | seq #{item.seqNumber}
                </Text>
              </View>
              <Text style={styles.logImpact}>{item.impactText}</Text>
              <Pressable
                style={({ pressed }) => [styles.undoButton, pressed && { opacity: 0.7 }]}
                onPress={() => undoAuditLog(item.id)}
              >
                <Text style={styles.undoButtonText}>↩️ Desfazer Evento</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  seqCard: {
    flex: 1,
  },
  seqLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  seqValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accent.purple,
  },
  syncButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  emptyState: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: spacing.xs / 2,
    textAlign: 'center',
  },
  feedList: {
    gap: spacing.sm,
  },
  logCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.purple,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  logOrigin: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  logMeta: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  logImpact: {
    fontSize: 12,
    color: colors.text.secondary,
    marginVertical: spacing.xs / 2,
  },
  undoButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  undoButtonText: {
    fontSize: 11,
    color: colors.danger.main,
    fontWeight: '600',
  },
  apiConsoleButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  apiConsoleButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

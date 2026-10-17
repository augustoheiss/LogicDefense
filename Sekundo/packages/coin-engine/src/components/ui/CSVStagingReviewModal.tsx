/**
 * CSV Staging Review Modal — Assistente Moeda
 *
 * Interactive quarantine and review modal for fragmented / agent-generated CSV imports.
 * Prevents heuristic assumptions by allowing the user to bulk-classify ambiguous
 * imports (e.g. credit card bills with positive amounts) into:
 *   - Expense / Custo (🔴)
 *   - Revenue / Receita (🟢)
 *   - Deposit / Aporte (🔵)
 *   - Neutral / Quarentena (🟡 'unresolved')
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type { TableRow } from '@coin/core/types';

interface CSVStagingReviewModalProps {
  visible: boolean;
  onClose: () => void;
  incomingRows: TableRow[];
  isAmbiguous?: boolean;
  activeTableName?: string;
  onConfirmCommit: (classifiedRows: TableRow[], mode: 'merge' | 'replace') => void;
}

type ClassificationAction = 'keep_original' | 'force_expense' | 'force_revenue' | 'force_deposit' | 'force_unresolved';

export function CSVStagingReviewModal({
  visible,
  onClose,
  incomingRows,
  isAmbiguous = false,
  activeTableName = 'Planilha Ativa',
  onConfirmCommit,
}: CSVStagingReviewModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 650;

  const [selectedAction, setSelectedAction] = useState<ClassificationAction>(
    isAmbiguous ? 'force_expense' : 'keep_original'
  );

  useEffect(() => {
    if (visible) {
      setSelectedAction(isAmbiguous ? 'force_expense' : 'keep_original');
    }
  }, [visible, isAmbiguous]);

  // Compute classified rows according to user's bulk decision
  const classifiedRows = useMemo(() => {
    return incomingRows.map((row) => {
      let nextType = row.entryType || 'revenue';

      if (selectedAction === 'force_expense') {
        nextType = 'expense';
      } else if (selectedAction === 'force_revenue') {
        nextType = 'revenue';
      } else if (selectedAction === 'force_deposit') {
        nextType = 'deposit';
      } else if (selectedAction === 'force_unresolved') {
        nextType = 'unresolved';
      }

      return {
        ...row,
        entryType: nextType,
      };
    });
  }, [incomingRows, selectedAction]);

  const totalSum = useMemo(() => {
    return classifiedRows.reduce((acc, r) => acc + (Math.abs(r.value) || 0), 0);
  }, [classifiedRows]);

  const handleCommit = (mode: 'merge' | 'replace') => {
    onConfirmCommit(classifiedRows, mode);
  };

  const getBadgeStyle = (type?: string) => {
    switch (type) {
      case 'expense':
        return { bg: colors.danger.light, text: colors.danger.main, label: 'Despesa' };
      case 'revenue':
        return { bg: colors.success.light, text: colors.success.main, label: 'Receita' };
      case 'deposit':
        return { bg: colors.info.light, text: colors.info.main, label: 'Aporte' };
      case 'unresolved':
      default:
        return { bg: colors.warning.light, text: colors.warning.main, label: 'Neutro' };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isWide && styles.modalContainerWide]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📥 Revisão de Ingestão de Transações</Text>
              <Text style={styles.subtitle}>
                Destino: <Text style={{ color: colors.accent.purple, fontWeight: '700' }}>{activeTableName}</Text>
              </Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaBadgeText}>{classifiedRows.length} itens</Text>
              <Text style={styles.metaBadgeSub}>R$ {totalSum.toFixed(2)}</Text>
            </View>
          </View>

          {/* Ambiguity Alert Banner */}
          {isAmbiguous && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertTitle}>⚠️ Lote sem indicação explícita de Tipo</Text>
              <Text style={styles.alertDesc}>
                Este CSV não contém coluna de tipo (Receita vs Despesa). Em faturas bancárias, valores positivos costumam representar custos.
                Selecione abaixo como deseja interpretar este lote para não distorcer seu faturamento:
              </Text>
            </View>
          )}

          {/* Classification Action Selector */}
          <Text style={styles.sectionLabel}>Classificar lote de lançamentos como:</Text>
          <View style={styles.actionsGrid}>
            <Pressable
              style={[
                styles.actionChip,
                selectedAction === 'force_expense' && styles.actionChipActiveExpense,
              ]}
              onPress={() => setSelectedAction('force_expense')}
            >
              <Text style={styles.chipEmoji}>🔴</Text>
              <View>
                <Text style={styles.chipTitle}>Tudo é Despesa / Custo</Text>
                <Text style={styles.chipSub}>Faturas, boletos e compras</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.actionChip,
                selectedAction === 'force_revenue' && styles.actionChipActiveRevenue,
              ]}
              onPress={() => setSelectedAction('force_revenue')}
            >
              <Text style={styles.chipEmoji}>🟢</Text>
              <View>
                <Text style={styles.chipTitle}>Tudo é Receita</Text>
                <Text style={styles.chipSub}>Ganhos e faturamento</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.actionChip,
                selectedAction === 'force_deposit' && styles.actionChipActiveDeposit,
              ]}
              onPress={() => setSelectedAction('force_deposit')}
            >
              <Text style={styles.chipEmoji}>🔵</Text>
              <View>
                <Text style={styles.chipTitle}>Tudo é Aporte</Text>
                <Text style={styles.chipSub}>Investimentos patrimoniais</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.actionChip,
                selectedAction === 'force_unresolved' && styles.actionChipActiveNeutral,
              ]}
              onPress={() => setSelectedAction('force_unresolved')}
            >
              <Text style={styles.chipEmoji}>🟡</Text>
              <View>
                <Text style={styles.chipTitle}>Manter Neutro / Quarentena</Text>
                <Text style={styles.chipSub}>Isolar do faturamento para arrumar depois</Text>
              </View>
            </Pressable>
          </View>

          {/* Data Sample Preview */}
          <Text style={styles.sectionLabel}>
            Pré-visualização dos primeiros registros ({Math.min(classifiedRows.length, 6)} de {classifiedRows.length}):
          </Text>
          <ScrollView style={styles.previewScroll} nestedScrollEnabled>
            {classifiedRows.slice(0, 6).map((row, idx) => {
              const badge = getBadgeStyle(row.entryType);
              return (
                <View key={row.id || idx} style={styles.previewRow}>
                  <Text style={styles.previewDate}>{row.date}</Text>
                  <Text style={styles.previewDesc} numberOfLines={1}>
                    {row.description || 'Sem descrição'}
                  </Text>
                  <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                  <Text style={styles.previewVal}>R$ {row.value.toFixed(2)}</Text>
                </View>
              );
            })}
          </ScrollView>

          {/* Commit Options */}
          <View style={styles.footerRow}>
            <Pressable
              style={[styles.btn, styles.btnCancel]}
              onPress={onClose}
            >
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnMerge]}
              onPress={() => handleCommit('merge')}
            >
              <Text style={styles.btnMergeText}>➕ Acumular (Mesclar)</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, styles.btnReplace]}
              onPress={() => handleCommit('replace')}
            >
              <Text style={styles.btnReplaceText}>🔄 Substituir Planilha</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderColor: colors.border.strong,
    borderWidth: 1,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalContainerWide: {
    maxWidth: 680,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  metaBadge: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  metaBadgeSub: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  alertBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning.main,
  },
  alertDesc: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionChip: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  actionChipActiveExpense: {
    borderColor: colors.danger.main,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  actionChipActiveRevenue: {
    borderColor: colors.success.main,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  actionChipActiveDeposit: {
    borderColor: colors.info.main,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  actionChipActiveNeutral: {
    borderColor: colors.warning.main,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chipSub: {
    fontSize: 9,
    color: colors.text.tertiary,
  },
  previewScroll: {
    maxHeight: 140,
    backgroundColor: '#0a0d12',
    borderColor: colors.border.default,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    gap: spacing.sm,
  },
  previewDate: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.tertiary,
    width: 68,
  },
  previewDesc: {
    flex: 1,
    fontSize: 11,
    color: colors.text.primary,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  previewVal: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    width: 70,
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    flex: 0.6,
    backgroundColor: colors.background.tertiary,
  },
  btnCancelText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  btnMerge: {
    backgroundColor: colors.accent.purple,
  },
  btnMergeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },
  btnReplace: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border.strong,
    borderWidth: 1,
  },
  btnReplaceText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});

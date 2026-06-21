/**
 * BulkDeleteModal Component — Assistente Moeda
 *
 * Overlay modal allowing users to delete all rows matching a specific Month (YYYY-MM)
 * or Year (YYYY). Features dynamic row counting, warning prompts, and double confirmation.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { TableRow } from '@/core/types';

interface BulkDeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (prefix: string) => void;
  rows: TableRow[];
}

type DeleteScope = 'month' | 'year';

export function BulkDeleteModal({ visible, onClose, onConfirm, rows }: BulkDeleteModalProps) {
  const [scope, setScope] = useState<DeleteScope>('month');
  
  // Extract unique months and years present in rows
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    for (const r of rows) {
      if (r.date) {
        months.add(r.date.slice(0, 7));
      }
    }
    return Array.from(months).sort().reverse();
  }, [rows]);

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of rows) {
      if (r.date) {
        years.add(r.date.slice(0, 4));
      }
    }
    return Array.from(years).sort().reverse();
  }, [rows]);

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // Default selection to first available on open
  useEffect(() => {
    if (visible) {
      if (uniqueMonths.length > 0) {
        setSelectedMonth(uniqueMonths[0]);
      } else {
        setSelectedMonth('');
      }
      if (uniqueYears.length > 0) {
        setSelectedYear(uniqueYears[0]);
      } else {
        setSelectedYear('');
      }
    }
  }, [visible, uniqueMonths, uniqueYears]);

  const selectedPrefix = scope === 'month' ? selectedMonth : selectedYear;

  // Dynamically count matching rows
  const matchingCount = useMemo(() => {
    if (!selectedPrefix) return 0;
    return rows.filter((r) => r.date && r.date.startsWith(selectedPrefix)).length;
  }, [rows, selectedPrefix]);

  const handleConfirm = () => {
    if (!selectedPrefix) {
      Alert.alert('Erro', 'Por favor, selecione um período válido.');
      return;
    }
    if (matchingCount === 0) {
      Alert.alert('Aviso', 'Nenhum lançamento encontrado para o período selecionado.');
      return;
    }

    const label = scope === 'month' 
      ? formatMonthLabel(selectedPrefix) 
      : `Ano de ${selectedPrefix}`;

    const performDelete = () => {
      onConfirm(selectedPrefix);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `🚨 CONFIRMAÇÃO DE EXCLUSÃO 🚨\n\nTem certeza absoluta que deseja apagar permanentemente todas as ${matchingCount} entradas de "${label}"?\n\nEsta ação NÃO pode ser desfeita!`
      );
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        '🚨 Confirmar Exclusão',
        `Tem certeza absoluta que deseja apagar permanentemente todas as ${matchingCount} entradas de "${label}"?\n\nEsta ação não poderá ser desfeita.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: '🗑️ Apagar Lote',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
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
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🗑️ Apagar Lançamentos em Lote</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={styles.body} style={styles.scroll}>
            <Text style={styles.description}>
              Selecione o período que deseja limpar da sua planilha. Todos os lançamentos e despesas correspondentes serão apagados permanentemente.
            </Text>

            {/* Scope Selection */}
            <View style={styles.scopeSelector}>
              <Pressable
                onPress={() => setScope('month')}
                style={[styles.scopeBtn, scope === 'month' && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeBtnText, scope === 'month' && styles.scopeBtnTextActive]}>
                  Mês Específico
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScope('year')}
                style={[styles.scopeBtn, scope === 'year' && styles.scopeBtnActive]}
              >
                <Text style={[styles.scopeBtnText, scope === 'year' && styles.scopeBtnTextActive]}>
                  Ano Inteiro
                </Text>
              </Pressable>
            </View>

            {/* Selection Options List */}
            {scope === 'month' ? (
              <View style={styles.optionsContainer}>
                <Text style={styles.label}>Escolha o Mês:</Text>
                {uniqueMonths.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum mês registrado.</Text>
                ) : (
                  <View style={styles.grid}>
                    {uniqueMonths.map((m) => {
                      const active = selectedMonth === m;
                      return (
                        <Pressable
                          key={m}
                          onPress={() => setSelectedMonth(m)}
                          style={[styles.gridItem, active && styles.gridItemActive]}
                        >
                          <Text style={[styles.gridItemText, active && styles.gridItemTextActive]}>
                            {formatMonthLabelShort(m)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.optionsContainer}>
                <Text style={styles.label}>Escolha o Ano:</Text>
                {uniqueYears.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhum ano registrado.</Text>
                ) : (
                  <View style={styles.grid}>
                    {uniqueYears.map((y) => {
                      const active = selectedYear === y;
                      return (
                        <Pressable
                          key={y}
                          onPress={() => setSelectedYear(y)}
                          style={[styles.gridItem, active && styles.gridItemActive]}
                        >
                          <Text style={[styles.gridItemText, active && styles.gridItemTextActive]}>
                            {y}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Warning Message */}
            {selectedPrefix ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <View style={styles.warningInfo}>
                  <Text style={styles.warningTitle}>Atenção</Text>
                  <Text style={styles.warningText}>
                    Isso apagará permanentemente <Text style={styles.boldText}>{matchingCount}</Text> entrada{matchingCount !== 1 ? 's' : ''} do período <Text style={styles.boldText}>{scope === 'month' ? formatMonthLabelShort(selectedPrefix) : selectedPrefix}</Text>.
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.button, styles.buttonDanger, matchingCount === 0 && styles.buttonDisabled]}
              onPress={handleConfirm}
              disabled={matchingCount === 0}
            >
              <Text style={[styles.buttonText, { color: '#ffffff' }]}>🗑️ Confirmar Exclusão</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.buttonOutline]} onPress={onClose}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx]} de ${y}`;
}

function formatMonthLabelShort(ym: string): string {
  const [y, m] = ym.split('-');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx]} ${y}`;
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
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.text.disabled,
    fontSize: 22,
    fontWeight: 'bold',
  },
  scroll: {
    flexGrow: 0,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  description: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  scopeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  scopeBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  scopeBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 12,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  gridItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    minWidth: 70,
    alignItems: 'center',
  },
  gridItemActive: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purpleLight,
  },
  gridItemText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  gridItemTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.danger.light,
    borderWidth: 1,
    borderColor: colors.danger.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 18,
  },
  warningInfo: {
    flex: 1,
    gap: 2,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger.main,
  },
  warningText: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
  },
  boldText: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  buttonDanger: {
    backgroundColor: colors.danger.main,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  buttonText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});

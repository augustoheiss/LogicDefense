/**
 * Today Screen (Dashboard "Hoje") — Assistente Moeda
 *
 * The protagonist home screen focused on Financial Health, immediate clarity,
 * daily habits, and proactive guidance for families and individuals.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import {
  HealthScoreRing,
  PillarsOverview,
  NextActionCard,
  InsightsCard,
} from '@/components/health';
import { WhatIfSimulator } from '@/components/sim/WhatIfSimulator';
import { LessonsViewer } from '@/components/learning/LessonsViewer';
import { computeHealthScore } from '@/core/healthEngine';
import { computeFinancialInsights } from '@/core/insightsEngine';
import { formatCurrencySmart } from '@/core/formatCurrency';
import {
  AddRowModal,
  TableSwitcherModal,
  ErrorBoundary,
} from '@/components/ui';
import type { TableRow } from '@/core/types';

export default function HojeScreen() {
  const router = useRouter();
  const db = useCoinDB();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);

  // ── Greeting based on current time ──────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  // ── Financial Health Diagnostic ────────────────────────
  const healthReport = useMemo(() => {
    return computeHealthScore(db.metrics);
  }, [db.metrics]);

  // ── Dynamic Insights ───────────────────────────────────
  const activeRows = useMemo(() => {
    return db.activeTable?.rows || [];
  }, [db.activeTable?.rows]);

  const insights = useMemo(() => {
    return computeFinancialInsights(activeRows, db.metrics);
  }, [activeRows, db.metrics]);

  // ── Recent transactions (Last 4) ───────────────────────
  const recentRows = useMemo(() => {
    return [...activeRows]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 4);
  }, [activeRows]);

  // ── Handlers ───────────────────────────────────────────
  const handleNextActionPress = useCallback((actionType?: string) => {
    if (actionType === 'add_row') {
      setShowAddModal(true);
    } else if (actionType === 'adjust_goals') {
      router.push('/(app)/(tabs)/settings' as any);
    } else if (actionType === 'cut_expense' || actionType === 'build_reserve') {
      router.push('/(app)/(tabs)/transactions' as any);
    } else {
      setShowAddModal(true);
    }
  }, [router]);

  const handleAddRow = useCallback((rowOrRows: Omit<TableRow, 'id'> | Omit<TableRow, 'id'>[]) => {
    if (db.tables.length === 0) {
      db.addTable('Minha Planilha', 'Primeira tabela financeira');
    }
    if (Array.isArray(rowOrRows)) {
      for (const r of rowOrRows) {
        db.addRow(r);
      }
    } else {
      db.addRow(rowOrRows);
    }
  }, [db]);

  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  const getEntryTypeColor = (type?: string) => {
    switch (type) {
      case 'revenue':
        return colors.success.main;
      case 'deposit':
        return colors.info.main;
      case 'waiver':
        return colors.warning.main;
      case 'expense':
      default:
        return colors.danger.main;
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Erro ao carregar Painel Hoje" componentName="HojeScreen">
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Header: Greeting + Table Selector ── */}
          <View style={styles.topHeader}>
            <View>
              <Text style={styles.greetingText}>{greeting} 👋</Text>
              <Pressable
                style={styles.tableSelectorButton}
                onPress={() => setShowTableSwitcher(true)}
              >
                <Text style={styles.activeTableName} numberOfLines={1}>
                  {db.activeTable?.name || 'Selecione uma Planilha'}
                </Text>
                <Text style={styles.tableDropdownIcon}>▾</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.chatHeaderButton}
              onPress={() => router.push('/chat')}
            >
              <Text style={styles.chatButtonEmoji}>✨</Text>
              <Text style={styles.chatButtonText}>IA Assistente</Text>
            </Pressable>
          </View>

          {/* ── Undo Bar (When Available) ── */}
          {db.canUndo && (
            <View style={styles.undoBar}>
              <Text style={styles.undoText} numberOfLines={1}>
                {db.lastUndoDescription ? `Última ação: ${db.lastUndoDescription}` : 'Ação registrada no histórico'}
              </Text>
              <Pressable
                style={styles.undoButton}
                onPress={() => db.undo()}
              >
                <Text style={styles.undoButtonText}>↩ Desfazer</Text>
              </Pressable>
            </View>
          )}

          {/* ── Main Score Card ── */}
          <HealthScoreRing
            score={healthReport.score}
            level={healthReport.level}
            headline={healthReport.headline}
          />

          {/* ── Next Best Action ── */}
          <NextActionCard
            action={healthReport.nextBestAction}
            onActionPress={handleNextActionPress}
          />

          {/* ── Month Financial Summary ── */}
          <View style={styles.summarySection}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Entradas</Text>
              <Text style={[styles.summaryValue, { color: colors.success.main }]}>
                {formatCurrencySmart(db.metrics.grossTotal)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: colors.danger.main }]}>
                {formatCurrencySmart(db.metrics.totalExpenses)}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Saldo</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      db.metrics.netBalance >= 0
                        ? colors.accent.purple
                        : colors.danger.main,
                  },
                ]}
              >
                {formatCurrencySmart(db.metrics.netBalance)}
              </Text>
            </View>
          </View>

          {/* ── Pillars Breakdown ── */}
          <PillarsOverview pillars={healthReport.pillars} />

          {/* ── Dynamic Insights ── */}
          <InsightsCard insights={insights} />

          {/* ── What-If Simulator (Sandbox) ── */}
          <WhatIfSimulator
            currentMonthlyExpense={db.metrics.totalExpenses > 0 ? db.metrics.totalExpenses : 3000}
            currentMonthlyRevenue={db.metrics.grossTotal > 0 ? db.metrics.grossTotal : 4500}
          />

          {/* ── Financial Education Lessons ── */}
          <LessonsViewer />

          {/* ── Quick Actions ── */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>Ações Rápidas</Text>
            <View style={styles.quickActionsGrid}>
              <Pressable
                style={styles.quickActionButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.quickActionIcon}>➕</Text>
                <Text style={styles.quickActionText}>Novo Registro</Text>
              </Pressable>

              <Pressable
                style={styles.quickActionButton}
                onPress={() => router.push('/(app)/(tabs)/transactions' as any)}
              >
                <Text style={styles.quickActionIcon}>📋</Text>
                <Text style={styles.quickActionText}>Planilha Completa</Text>
              </Pressable>

              <Pressable
                style={styles.quickActionButton}
                onPress={() => router.push('/(app)/(tabs)/charts' as any)}
              >
                <Text style={styles.quickActionIcon}>📈</Text>
                <Text style={styles.quickActionText}>Ver Gráficos</Text>
              </Pressable>

              <Pressable
                style={styles.quickActionButton}
                onPress={() => router.push('/(app)/(tabs)/settings' as any)}
              >
                <Text style={styles.quickActionIcon}>⚙️</Text>
                <Text style={styles.quickActionText}>Metas & Ajustes</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Recent Activity ── */}
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionTitle}>Últimos Lançamentos</Text>
              <Pressable onPress={() => router.push('/(app)/(tabs)/transactions' as any)}>
                <Text style={styles.seeAllText}>Ver todos ›</Text>
              </Pressable>
            </View>

            {recentRows.length === 0 ? (
              <View style={styles.emptyRecentCard}>
                <Text style={styles.emptyRecentText}>
                  Nenhuma transação registrada nesta planilha ainda.
                </Text>
                <Pressable
                  style={styles.emptyAddButton}
                  onPress={() => setShowAddModal(true)}
                >
                  <Text style={styles.emptyAddButtonText}>+ Criar Primeiro Lançamento</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentRows.map(row => {
                  const isPositive = row.entryType === 'revenue';
                  const sign = isPositive ? '+' : '-';
                  const valColor = getEntryTypeColor(row.entryType);

                  return (
                    <View key={row.id} style={styles.recentItem}>
                      <View style={styles.recentItemLeft}>
                        <Text style={styles.recentItemDate}>
                          {formatRelativeDate(row.date)}
                        </Text>
                        <View style={styles.recentDescCol}>
                          <Text style={styles.recentItemDesc} numberOfLines={1}>
                            {row.description || 'Sem descrição'}
                          </Text>
                          {row.category ? (
                            <Text style={styles.recentItemCategory} numberOfLines={1}>
                              {row.category}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <Text style={[styles.recentItemValue, { color: valColor }]}>
                        {sign} {formatCurrencySmart(row.value)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Extra bottom padding for tab bar */}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* ── Modals ── */}
        <AddRowModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddRow}
        />

        <TableSwitcherModal
          visible={showTableSwitcher}
          onClose={() => setShowTableSwitcher(false)}
          tables={db.tables}
          activeTableIndex={db.activeTableIndex}
          onSelect={db.setActiveTableIndex}
          onAdd={(name) => db.addTable(name)}
          onRename={db.renameTable}
          onDelete={db.deleteTable}
          onReorder={db.reorderTables}
        />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: Platform.OS === 'android' ? spacing.sm : 0,
  },
  greetingText: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '500',
    marginBottom: 2,
  },
  tableSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 220,
  },
  activeTableName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  tableDropdownIcon: {
    fontSize: 14,
    color: colors.accent.purple,
    fontWeight: '800',
  },
  chatHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent.purpleLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  chatButtonEmoji: {
    fontSize: 14,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
  },
  undoText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  undoButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  undoButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  summarySection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  quickActionsSection: {
    marginBottom: spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  quickActionIcon: {
    fontSize: 20,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recentSection: {
    marginBottom: spacing.md,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  seeAllText: {
    fontSize: 13,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  emptyRecentCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRecentText: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyAddButton: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  emptyAddButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  recentList: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  recentItemDate: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.tertiary,
    width: 42,
  },
  recentDescCol: {
    flex: 1,
  },
  recentItemDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recentItemCategory: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  recentItemValue: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

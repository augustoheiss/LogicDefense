/**
 * Charts Tab — Assistente Moeda
 *
 * Integrated financial visualization hub featuring the new Interactive Chart Builder
 * alongside future projections, debt tracking audit, and classic trend views.
 *
 * Unrestricted access across all financial tables with zero sector blockers.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import { useCoinDB } from '@coin/hooks/useCoinDB';
import {
  InteractiveChartBuilder,
  RevenueChart,
  FutureProjectionChart,
  RealInvestmentsChart,
  DebtTrackingList,
} from '@coin/components/charts';

type ChartView = 'builder' | 'projection' | 'audit' | 'revenue' | 'evolution';

const tabs: { key: ChartView; label: string; icon: string }[] = [
  { key: 'builder',    label: 'Construtor', icon: '🔬' },
  { key: 'projection', label: 'Projeção',   icon: '📈' },
  { key: 'audit',      label: 'Auditoria',  icon: '📋' },
  { key: 'revenue',    label: 'Receita',    icon: '📊' },
  { key: 'evolution',  label: 'Evolução',   icon: '🏦' },
];

export default function ChartsScreen() {
  const { metrics, activeTable, deleteRow } = useCoinDB();
  const [activeView, setActiveView] = useState<ChartView>('builder');

  const hasData = activeTable && activeTable.rows.length > 0;

  const handleDeleteRow = (rowId: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Deseja excluir este lançamento original da planilha?')) {
        deleteRow(rowId);
      }
    } else {
      Alert.alert(
        'Excluir lançamento',
        'Tem certeza que deseja excluir este lançamento original?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => deleteRow(rowId),
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Compact CAD Header + Segmented Lens Bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title}>📈 Bancada de Gráficos</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {activeTable?.name ?? 'Visual Analytics'}
          </Text>
        </View>
      </View>

      {/* Segmented Control Navigation */}
      <View style={styles.navWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentContainer}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[
                styles.segment,
                activeView === tab.key && styles.segmentActive,
              ]}
              onPress={() => setActiveView(tab.key)}
              testID={`charts-lens-${tab.key}`}
            >
              <Text style={styles.segmentIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.segmentLabel,
                  activeView === tab.key && styles.segmentLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Main Content */}
      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>Adicione dados primeiro</Text>
          <Text style={styles.emptyText}>
            Os gráficos serão gerados automaticamente assim que você registrar ou importar transações na Planilha.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeView === 'builder' && (
            <InteractiveChartBuilder
              rows={activeTable.rows}
              goals={activeTable.goals}
              onDeleteRow={handleDeleteRow}
            />
          )}

          {activeView === 'projection' && (
            <FutureProjectionChart
              metrics={metrics}
              rows={activeTable.rows}
            />
          )}

          {activeView === 'audit' && (
            <DebtTrackingList
              rows={activeTable.rows}
              goals={activeTable.goals}
              metrics={metrics}
            />
          )}

          {activeView === 'revenue' && (
            <RevenueChart
              metrics={metrics}
              goals={activeTable.goals}
              rows={activeTable.rows}
            />
          )}

          {activeView === 'evolution' && (
            <RealInvestmentsChart
              metrics={metrics}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.text.tertiary,
  },

  // Segmented Control
  navWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.background.primary,
  },
  segmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 6,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: colors.accent.purple,
  },
  segmentIcon: {
    fontSize: 12,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  segmentLabelActive: {
    color: '#c084fc',
    fontWeight: '700',
  },

  // Content
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.sm,
    gap: spacing.sm,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxxl,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});


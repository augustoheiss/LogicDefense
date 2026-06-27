/**
 * Charts Tab — Assistente Moeda
 *
 * Integrated financial visualization hub with three views:
 *   1. Revenue Chart — Monthly gross revenue bars with goal line (native only)
 *   2. Investment Projection — Compound growth line chart (native only)
 *   3. Weekly Audit (Debt Tracking) — Expandable card list (all platforms)
 *
 * On web, charts 1 & 2 show a placeholder card directing users to the app.
 * The DebtTrackingList (Weekly Audit) is fully functional everywhere.
 *
 * Uses a segmented control to switch between chart views.
 * All data flows from useCoinDB.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { DebtTrackingList } from '@/components/charts/DebtTrackingList';

import { RevenueChart } from '@/components/charts/RevenueChart';
import { FutureProjectionChart } from '@/components/charts/FutureProjectionChart';
import { RealInvestmentsChart } from '@/components/charts/RealInvestmentsChart';

const isWeb = Platform.OS === 'web';

type ChartView = 'revenue' | 'evolution' | 'projection' | 'audit';

const tabs: { key: ChartView; label: string; icon: string }[] = [
  { key: 'revenue',    label: 'Receita',    icon: '📊' },
  { key: 'evolution',  label: 'Evolução',   icon: '🏦' },
  { key: 'projection', label: 'Projeção',   icon: '📈' },
  { key: 'audit',      label: 'Auditoria',  icon: '📋' },
];

// ── Web Placeholder for native-only charts ────────────────────────────────────

function WebChartPlaceholder() {
  return (
    <View style={styles.webPlaceholder}>
      <Text style={styles.webPlaceholderEmoji}>📱</Text>
      <Text style={styles.webPlaceholderTitle}>
        Gráficos otimizados para o App
      </Text>
      <Text style={styles.webPlaceholderText}>
        Os gráficos interativos de Receita e Projeção estão disponíveis no aplicativo Android/iOS para melhor performance e experiência visual.
      </Text>
      <Text style={styles.webPlaceholderHint}>
        💡 Use a aba "Auditoria" para ver o acompanhamento semanal completo aqui no navegador.
      </Text>
    </View>
  );
}

export default function ChartsScreen() {
  const { metrics, activeTable } = useCoinDB();
  // Default to 'revenue' on all platforms since we have Recharts on web
  const [activeView, setActiveView] = useState<ChartView>('revenue');

  const hasData = activeTable && activeTable.rows.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📈 Gráficos</Text>
        <Text style={styles.subtitle}>
          {activeTable?.name ?? 'Visualizações financeiras'}
        </Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.segment,
              activeView === tab.key && styles.segmentActive,
            ]}
            onPress={() => setActiveView(tab.key)}
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
      </View>

      {/* Content */}
      {!hasData ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>Adicione dados primeiro</Text>
          <Text style={styles.emptyText}>
            Os gráficos serão gerados automaticamente quando você adicionar entradas na Planilha.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.bottomPad} />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  // Segmented Control
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentActive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  segmentIcon: {
    fontSize: 14,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  segmentLabelActive: {
    color: colors.accent.purple,
    fontWeight: '600',
  },

  // Content
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },

  // Empty
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

  // Web placeholder
  webPlaceholder: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  webPlaceholderEmoji: {
    fontSize: 40,
  },
  webPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  webPlaceholderText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  webPlaceholderHint: {
    fontSize: 12,
    color: colors.accent.purple,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  bottomPad: {
    height: spacing.huge,
  },
});

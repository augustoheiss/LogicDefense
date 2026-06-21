/**
 * DebtTrackingList — Assistente Moeda
 *
 * Mobile-first weekly audit view using the computeWeeklyDebtTimeline engine.
 * Replaces a traditional wide table with expandable cards.
 *
 * Upgrades:
 *   - Grand parity selectable weeks feature
 *   - Select All toggle toolbar
 *   - WhatsApp Dossiê Report generation with interactive Preview Modal
 *   - Tabular PDF "Demonstrativo de Saldo Acumulado" Export
 */

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencySmart } from '@/core/formatCurrency';
import { computeWeeklyDebtTimeline, type WeekDebtEntry } from '@/core/computeWeeklyDebtTimeline';
import type { TableRow, TableGoals, TableMetrics } from '@/core/types';
import { useCoinDB } from '@/hooks/useCoinDB';
import { buildWhatsAppDossie, shareTabularPDFReport } from '@/services/exportService';
import { PreviewModal } from '@/components/ui';

interface DebtTrackingListProps {
  rows: TableRow[];
  goals: TableGoals;
  metrics: TableMetrics;
}

export function DebtTrackingList({ rows, goals, metrics }: DebtTrackingListProps) {
  const { cutoffDate, activeTable } = useCoinDB();

  const timeline = useMemo(
    () => computeWeeklyDebtTimeline(rows, goals),
    [rows, goals],
  );

  // Reverse: most recent week first
  const reversed = useMemo(() => [...timeline].reverse(), [timeline]);

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [prevTimelineLength, setPrevTimelineLength] = useState(0);

  // Preview Modal state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewText, setPreviewText] = useState('');

  // Auto-select all weeks on initial load/timeline updates
  if (timeline.length !== prevTimelineLength) {
    setSelectedKeys(new Set(timeline.map(w => w.mondayKey)));
    setPrevTimelineLength(timeline.length);
  }

  // ── Liquid Math: effectiveWeeksBalance ──────────────────────
  const currentYear = cutoffDate ? parseInt(cutoffDate.slice(0, 4), 10) : new Date().getFullYear();
  const currentWeeklyGoal = goals.weeklyGoals?.[currentYear] ?? 0;
  const effectiveWeeksBalance = currentWeeklyGoal > 0
    ? Math.round((metrics.globalGoalBalance / currentWeeklyGoal) * 100) / 100
    : 0;

  const allSelected = selectedKeys.size === timeline.length;
  
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(timeline.map(w => w.mondayKey)));
    }
  };

  const toggleSelectWeek = (mondayKey: string) => {
    const next = new Set(selectedKeys);
    if (next.has(mondayKey)) {
      next.delete(mondayKey);
    } else {
      next.add(mondayKey);
    }
    setSelectedKeys(next);
  };

  const handleExportWhatsApp = () => {
    const selectedEntries = timeline.filter(w => selectedKeys.has(w.mondayKey));
    if (selectedEntries.length === 0) {
      Alert.alert('Erro', 'Por favor, selecione pelo menos uma semana para exportar.');
      return;
    }
    const reportText = buildWhatsAppDossie(
      selectedEntries,
      metrics.globalGoalBalance,
      rows,
      goals
    );
    setPreviewText(reportText);
    setPreviewVisible(true);
  };

  const handleConfirmShare = async (editedText: string) => {
    setPreviewVisible(false);
    try {
      await Share.share({
        message: editedText,
        title: `Dossiê — ${activeTable?.name ?? 'Planilha'}`,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o dossiê.');
    }
  };

  const handleExportPDF = () => {
    const selectedEntries = timeline.filter(w => selectedKeys.has(w.mondayKey));
    if (selectedEntries.length === 0) {
      Alert.alert('Erro', 'Por favor, selecione pelo menos uma semana para exportar.');
      return;
    }
    shareTabularPDFReport(
      activeTable?.name ?? 'Planilha',
      selectedEntries
    );
  };

  if (timeline.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>📋 Auditoria Semanal</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Adicione receitas para ver a auditoria semanal.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Auditoria Semanal</Text>
        <Text style={styles.subtitle}>{timeline.length} semanas</Text>
      </View>

      {/* Liquid Math Summary */}
      <View style={styles.liquidCard}>
        <View style={styles.liquidRow}>
          <Text style={styles.liquidLabel}>⏱️ Banco de Tempo (Liquid Math)</Text>
          <Text
            style={[
              styles.liquidValue,
              { color: effectiveWeeksBalance >= 0 ? colors.success.main : colors.danger.main },
            ]}
          >
            {effectiveWeeksBalance > 0 ? '+' : ''}{effectiveWeeksBalance.toFixed(1)} sem
          </Text>
        </View>
        <Text style={styles.liquidFormula}>
          = Saldo Meta ({formatCurrencySmart(metrics.globalGoalBalance)}) ÷ Meta Semanal ({formatCurrencySmart(currentWeeklyGoal)})
        </Text>
      </View>

      {/* Selection & Export Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={toggleSelectAll} style={[styles.toolbarBtn, styles.btnOutline]}>
          <Text style={styles.toolbarBtnText}>
            {allSelected ? '⬜ Limpar' : '✅ Marcar Todas'}
          </Text>
        </Pressable>

        <Pressable onPress={handleExportWhatsApp} style={[styles.toolbarBtn, styles.btnWhatsApp]}>
          <Text style={[styles.toolbarBtnText, { color: '#ffffff' }]}>
            💬 Dossiê WhatsApp
          </Text>
        </Pressable>

        <Pressable onPress={handleExportPDF} style={[styles.toolbarBtn, styles.btnPDF]}>
          <Text style={[styles.toolbarBtnText, { color: '#ffffff' }]}>
            📄 Exportar PDF
          </Text>
        </Pressable>
      </View>

      {/* Week Cards */}
      <View style={styles.listContent}>
        {reversed.map((item, idx) => (
          <View key={item.mondayKey}>
            <WeekCard
              entry={item}
              selected={selectedKeys.has(item.mondayKey)}
              onToggleSelect={() => toggleSelectWeek(item.mondayKey)}
            />
            {idx < reversed.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </View>

      {/* Preview Modal */}
      <PreviewModal
        visible={previewVisible}
        mode="whatsapp"
        initialText={previewText}
        onClose={() => setPreviewVisible(false)}
        onConfirm={handleConfirmShare}
      />
    </View>
  );
}

// ── Week Card (expandable) ───────────────────────────────────────────────────

interface WeekCardProps {
  entry: WeekDebtEntry;
  selected: boolean;
  onToggleSelect: () => void;
}

function WeekCard({ entry, selected, onToggleSelect }: WeekCardProps) {
  const [expanded, setExpanded] = useState(false);

  const status = getStatus(entry.cumulativeBalance);
  const deltaColor = entry.weekDelta >= 0 ? colors.success.main : colors.danger.main;

  return (
    <View style={[styles.card, { borderColor: status.borderColor }]}>
      {/* Header Row */}
      <View style={styles.cardHeader}>
        {/* Checkbox */}
        <Pressable onPress={onToggleSelect} style={styles.checkboxContainer}>
          <Text style={styles.checkboxIcon}>
            {selected ? '✅' : '⬜'}
          </Text>
        </Pressable>

        {/* Info area */}
        <Pressable
          style={styles.cardLeft}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.weekLabel}>{entry.weekLabel}</Text>
          <Text style={styles.weekNumber}>Semana {entry.weekNumber}</Text>
        </Pressable>

        {/* Balance badge */}
        <Pressable
          style={styles.cardRight}
          onPress={() => setExpanded(!expanded)}
        >
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.icon} {status.label}
            </Text>
          </View>
          <Text style={[styles.cumBalance, { color: status.color }]}>
            {formatCurrencySmart(entry.cumulativeBalance)}
          </Text>
        </Pressable>
      </View>

      {/* Expandable body */}
      {expanded && (
        <Pressable onPress={() => setExpanded(false)} style={styles.cardBody}>
          <DetailRow label="🎯 Meta Semanal" value={formatCurrencySmart(entry.weeklyGoal)} color={colors.text.secondary} />
          <DetailRow label="💰 Receita" value={formatCurrencySmart(entry.weeklyRevenue)} color={colors.success.main} />
          {entry.weeklyWaivers > 0 && (
            <DetailRow label="🎁 Abonos" value={formatCurrencySmart(entry.weeklyWaivers)} color={colors.warning.main} />
          )}
          {entry.weeklyPartnerNet !== 0 && (
            <DetailRow
              label={entry.weeklyPartnerNet >= 0 ? '🤝 Parceria líq.' : '📤 Parceria líq.'}
              value={`${entry.weeklyPartnerNet >= 0 ? '+' : ''}${formatCurrencySmart(entry.weeklyPartnerNet)}`}
              color={entry.weeklyPartnerNet >= 0 ? '#06b6d4' : '#f97316'}
            />
          )}
          <View style={styles.divider} />
          <DetailRow
            label="Δ Semana"
            value={`${entry.weekDelta >= 0 ? '+' : ''}${formatCurrencySmart(entry.weekDelta)}`}
            color={deltaColor}
            bold
          />
          <DetailRow
            label="Saldo Acumulado"
            value={formatCurrencySmart(entry.cumulativeBalance)}
            color={status.color}
            bold
          />
        </Pressable>
      )}

      {/* Expand hint */}
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Text style={styles.expandHint}>
          {expanded ? '▲ Recolher' : '▼ Expandir'}
        </Text>
      </Pressable>
    </View>
  );
}

function DetailRow({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          { color },
          bold && { fontWeight: '700', fontSize: 14 },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Status helper ────────────────────────────────────────────────────────────

function getStatus(balance: number): {
  label: string;
  icon: string;
  color: string;
  bg: string;
  borderColor: string;
} {
  if (balance < -0.01) {
    return {
      label: 'INADIMPLENTE',
      icon: '🔴',
      color: colors.danger.main,
      bg: colors.danger.light,
      borderColor: colors.danger.border,
    };
  }
  if (balance > 0.01) {
    return {
      label: 'SUPERÁVIT',
      icon: '🟢',
      color: colors.success.main,
      bg: colors.success.light,
      borderColor: colors.success.border,
    };
  }
  return {
    label: 'EQUILIBRADO',
    icon: '🟡',
    color: colors.warning.main,
    bg: colors.warning.light,
    borderColor: colors.warning.border,
  };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.text.disabled,
  },

  // Liquid Math card
  liquidCard: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  liquidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liquidLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  liquidValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  liquidFormula: {
    fontSize: 10,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  toolbarBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnOutline: {
    borderColor: colors.border.default,
    backgroundColor: colors.background.tertiary,
  },
  btnWhatsApp: {
    borderColor: '#25d366',
    backgroundColor: '#25d366',
  },
  btnPDF: {
    borderColor: colors.accent.purple,
    backgroundColor: colors.accent.purple,
  },
  toolbarBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Checkbox
  checkboxContainer: {
    marginRight: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xxs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxIcon: {
    fontSize: 16,
  },

  // List
  listContent: {
    paddingBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    gap: 2,
    flex: 1,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  weekNumber: {
    fontSize: 10,
    color: colors.text.disabled,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cumBalance: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Card body
  cardBody: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xxs,
  },

  expandHint: {
    fontSize: 10,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});

/**
 * Chart Control Panel — Assistente Moeda
 *
 * Interactive builder toolbar allowing manual configuration of time scopes,
 * granular dates, multi-date pickers, metric series toggles, and category filters.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type {
  ChartBuilderConfig,
  TimeScopeType,
  MetricType,
  VisualType,
} from '@coin/core/chartAggregationEngine';

interface ChartControlPanelProps {
  config: ChartBuilderConfig;
  onChangeConfig: (newConfig: ChartBuilderConfig) => void;
  availableYears: number[];
  availableMonths: string[];
  availableCategories: string[];
}

const SCOPE_OPTIONS: { key: TimeScopeType; label: string; icon: string }[] = [
  { key: 'day',          label: 'Dias',             icon: '☀️' },
  { key: 'month',        label: 'Meses',            icon: '📅' },
  { key: 'year',         label: 'Anos',             icon: '🏛️' },
  { key: 'multi_date',   label: 'Múltiplas Datas',  icon: '🎯' },
  { key: 'custom_range', label: 'Intervalo Custom', icon: '⏱️' },
];

const METRIC_OPTIONS: { key: MetricType; label: string; color: string; icon: string }[] = [
  { key: 'revenue', label: 'Receitas',      color: '#10b981', icon: '📥' },
  { key: 'expense', label: 'Custos',        color: '#ef4444', icon: '🏷️' },
  { key: 'balance', label: 'Saldo Líquido', color: '#8b5cf6', icon: '📊' },
  { key: 'deposit', label: 'Aportes',       color: '#3b82f6', icon: '💰' },
  { key: 'waiver',  label: 'Abonos',        color: '#f59e0b', icon: '🛡️' },
];

const VISUAL_OPTIONS: { key: VisualType; label: string; icon: string }[] = [
  { key: 'composed',  label: 'Composto',     icon: '📊' },
  { key: 'bar',       label: 'Barras',       icon: '📶' },
  { key: 'line_area', label: 'Linhas / Área', icon: '📈' },
  { key: 'donut',     label: 'Donut',        icon: '🍩' },
];

const MONTH_NAMES: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março',
  '04': 'Abril',   '05': 'Maio',      '06': 'Junho',
  '07': 'Julho',   '08': 'Agosto',    '09': 'Setembro',
  '10': 'Outubro', '11': 'Novembro',  '12': 'Dezembro',
};

export function ChartControlPanel({
  config,
  onChangeConfig,
  availableYears,
  availableMonths,
  availableCategories,
}: ChartControlPanelProps) {
  const [newDateInput, setNewDateInput] = useState('');

  const setScope = (scopeType: TimeScopeType) => {
    onChangeConfig({ ...config, scopeType });
  };

  const setVisualType = (visualType: VisualType) => {
    onChangeConfig({ ...config, visualType });
  };

  const toggleMetric = (metric: MetricType) => {
    const exists = config.activeMetrics.includes(metric);
    let next: MetricType[];
    if (exists) {
      if (config.activeMetrics.length === 1) return; // keep at least one
      next = config.activeMetrics.filter((m) => m !== metric);
    } else {
      next = [...config.activeMetrics, metric];
    }
    onChangeConfig({ ...config, activeMetrics: next });
  };

  const toggleCategory = (cat: string) => {
    const upper = cat.trim().toUpperCase();
    const exists = config.selectedCategories.map((c) => c.toUpperCase()).includes(upper);
    let next: string[];
    if (exists) {
      next = config.selectedCategories.filter((c) => c.toUpperCase() !== upper);
    } else {
      next = [...config.selectedCategories, upper];
    }
    onChangeConfig({ ...config, selectedCategories: next });
  };

  const selectAllCategories = () => {
    onChangeConfig({ ...config, selectedCategories: [] });
  };

  // ── Month Selector (Next / Prev)
  const shiftMonth = (delta: number) => {
    const [yStr, mStr] = config.selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    const nextMonth = `${y}-${String(m).padStart(2, '0')}`;
    onChangeConfig({ ...config, selectedMonth: nextMonth, selectedYear: y });
  };

  // ── Year Selector (Next / Prev)
  const shiftYear = (delta: number) => {
    const nextYear = config.selectedYear + delta;
    const [_, mStr] = config.selectedMonth.split('-');
    const nextMonth = `${nextYear}-${mStr || '01'}`;
    onChangeConfig({ ...config, selectedYear: nextYear, selectedMonth: nextMonth });
  };

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${MONTH_NAMES[m] || m} de ${y}`;
  };

  const addMultiDate = () => {
    if (!newDateInput.trim()) return;
    const clean = newDateInput.trim().replace(/\//g, '-');
    let iso = clean;
    // support DD-MM-YYYY -> YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split('-');
      iso = `${y}-${m}-${d}`;
    }
    if (!config.multiDates.includes(iso)) {
      onChangeConfig({
        ...config,
        multiDates: [...config.multiDates, iso].sort(),
      });
    }
    setNewDateInput('');
  };

  const removeMultiDate = (d: string) => {
    onChangeConfig({
      ...config,
      multiDates: config.multiDates.filter((item) => item !== d),
    });
  };

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  return (
    <View style={styles.container} testID="chart-control-panel">
      {/* ── Row 1: Compact Time Scope + Inline Stepper + Filter Drawer Toggle ── */}
      <View style={styles.topToolbarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={{ flex: 1 }}
        >
          {SCOPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[
                styles.pill,
                config.scopeType === opt.key && styles.pillActive,
              ]}
              onPress={() => setScope(opt.key)}
            >
              <Text style={styles.pillIcon}>{opt.icon}</Text>
              <Text
                style={[
                  styles.pillLabel,
                  config.scopeType === opt.key && styles.pillLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {config.scopeType === 'day' && (
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => shiftMonth(-1)}>
              <Text style={styles.stepperBtnText}>◀</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{config.selectedMonth}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => shiftMonth(1)}>
              <Text style={styles.stepperBtnText}>▶</Text>
            </Pressable>
          </View>
        )}

        {config.scopeType === 'month' && (
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => shiftYear(-1)}>
              <Text style={styles.stepperBtnText}>◀</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{config.selectedYear}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => shiftYear(1)}>
              <Text style={styles.stepperBtnText}>▶</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.filterDrawerBtn, showAdvancedFilters && styles. pillActive]}
          onPress={() => setShowAdvancedFilters((prev) => !prev)}
          testID="chart-toggle-filters-btn"
        >
          <Text style={styles.filterDrawerBtnText}>
            🎛️ {showAdvancedFilters ? 'Ocultar' : 'Filtros'}
          </Text>
        </Pressable>
      </View>

      {/* ── Row 2: Single-Line Visual Type + Series Strip (Never Crushes Vertically) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactSeriesRow}
      >
        {VISUAL_OPTIONS.map((v) => (
          <Pressable
            key={v.key}
            style={[
              styles.visualPill,
              config.visualType === v.key && styles.visualPillActive,
            ]}
            onPress={() => setVisualType(v.key)}
          >
            <Text style={styles.visualPillIcon}>{v.icon}</Text>
            <Text
              style={[
                styles.visualPillLabel,
                config.visualType === v.key && styles.visualPillLabelActive,
              ]}
            >
              {v.label}
            </Text>
          </Pressable>
        ))}

        <View style={styles.inlineDivider} />

        {METRIC_OPTIONS.map((m) => {
          const active = config.activeMetrics.includes(m.key);
          return (
            <Pressable
              key={m.key}
              testID={`metric-toggle-${m.key}`}
              style={[
                styles.metricChip,
                active && { borderColor: m.color, backgroundColor: `${m.color}20` },
              ]}
              onPress={() => toggleMetric(m.key)}
            >
              <Text style={[styles.metricDot, { color: m.color }]}>●</Text>
              <Text style={[styles.metricChipText, active && { color: '#fff', fontWeight: '700' }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Contextual Multi-Date or Custom Range Inputs (When Selected) ── */}
      {config.scopeType === 'multi_date' && (
        <View style={styles.temporalControlCard}>
          <View style={styles.dateInputRow}>
            <TextInput
              style={styles.dateInput}
              placeholder="AAAA-MM-DD ou DD/MM/AAAA"
              placeholderTextColor={colors.text.disabled}
              value={newDateInput}
              onChangeText={setNewDateInput}
              onSubmitEditing={addMultiDate}
            />
            <Pressable style={styles.addDateBtn} onPress={addMultiDate}>
              <Text style={styles.addDateBtnText}>+ Data</Text>
            </Pressable>
          </View>
          {config.multiDates.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagChipsRow}>
              {config.multiDates.map((d) => (
                <Pressable key={d} style={styles.tagChip} onPress={() => removeMultiDate(d)}>
                  <Text style={styles.tagChipText}>{d}</Text>
                  <Text style={styles.tagChipRemove}>✕</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {config.scopeType === 'custom_range' && (
        <View style={styles.temporalControlCard}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeCol}>
              <Text style={styles.rangeLabel}>De:</Text>
              <TextInput
                style={styles.rangeInput}
                value={config.customRange.start}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.text.disabled}
                onChangeText={(start) =>
                  onChangeConfig({ ...config, customRange: { ...config.customRange, start } })
                }
              />
            </View>
            <View style={styles.rangeCol}>
              <Text style={styles.rangeLabel}>Até:</Text>
              <TextInput
                style={styles.rangeInput}
                value={config.customRange.end}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.text.disabled}
                onChangeText={(end) =>
                  onChangeConfig({ ...config, customRange: { ...config.customRange, end } })
                }
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Collapsible Category & Series Inspector (On-Demand CAD Drawer) ── */}
      {showAdvancedFilters && availableCategories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.categoryHeader}>
            <Text style={styles.sectionTitle}>🏷️ Filtro por Categoria ({availableCategories.length})</Text>
            {config.selectedCategories.length > 0 && (
              <Pressable onPress={selectAllCategories}>
                <Text style={styles.resetCatText}>Mostrar Todas</Text>
              </Pressable>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            <Pressable
              style={[
                styles.catPill,
                config.selectedCategories.length === 0 && styles.catPillActive,
              ]}
              onPress={selectAllCategories}
            >
              <Text style={[styles.catPillText, config.selectedCategories.length === 0 && styles.catPillTextActive]}>
                ✨ Todas ({availableCategories.length})
              </Text>
            </Pressable>

            {availableCategories.map((cat) => {
              const isSelected = config.selectedCategories.map((c) => c.toUpperCase()).includes(cat.toUpperCase());
              return (
                <Pressable
                  key={cat}
                  style={[styles.catPill, isSelected && styles.catPillActive]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text style={[styles.catPillText, isSelected && styles.catPillTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    gap: 6,
  },
  topToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactSeriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  inlineDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border.default,
    marginHorizontal: 2,
  },
  filterDrawerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterDrawerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pillActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderColor: colors.accent.purple,
  },
  pillIcon: {
    fontSize: 12,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  pillLabelActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  temporalControlCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperBtnText: {
    color: colors.accent.purple,
    fontSize: 11,
    fontWeight: '700',
  },
  stepperValue: {
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: '800',
    color: colors.text.primary,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dateInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    color: colors.text.primary,
  },
  addDateBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  addDateBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  tagChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.accent.purpleBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagChipText: {
    fontSize: 11,
    color: colors.text.primary,
    fontWeight: '600',
  },
  tagChipRemove: {
    fontSize: 10,
    color: colors.danger.main,
    fontWeight: 'bold',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeCol: {
    flex: 1,
    gap: 2,
  },
  rangeLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  rangeInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 11,
    color: colors.text.primary,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  metricDot: {
    fontSize: 9,
  },
  metricChipText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  visualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  visualPillActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderColor: colors.accent.purple,
  },
  visualPillIcon: {
    fontSize: 11,
  },
  visualPillLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  visualPillLabelActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resetCatText: {
    fontSize: 11,
    color: colors.accent.purple,
    fontWeight: '600',
  },
  catScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  catPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  catPillActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderColor: colors.accent.purple,
  },
  catPillText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  catPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});


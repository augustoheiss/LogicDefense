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
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type {
  ChartBuilderConfig,
  TimeScopeType,
  MetricType,
  VisualType,
} from '@/core/chartAggregationEngine';

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

  return (
    <View style={styles.container}>
      {/* ── Row 1: Time Scope Pills ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Granularidade de Tempo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
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
      </View>

      {/* ── Row 2: Contextual Temporal Controls ── */}
      <View style={styles.temporalControlCard}>
        {config.scopeType === 'day' && (
          <View style={styles.temporalRow}>
            <Text style={styles.temporalHint}>Mês Selecionado:</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperBtn} onPress={() => shiftMonth(-1)}>
                <Text style={styles.stepperBtnText}>◀</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{formatMonthLabel(config.selectedMonth)}</Text>
              <Pressable style={styles.stepperBtn} onPress={() => shiftMonth(1)}>
                <Text style={styles.stepperBtnText}>▶</Text>
              </Pressable>
            </View>
          </View>
        )}

        {config.scopeType === 'month' && (
          <View style={styles.temporalRow}>
            <Text style={styles.temporalHint}>Ano Selecionado:</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperBtn} onPress={() => shiftYear(-1)}>
                <Text style={styles.stepperBtnText}>◀</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{config.selectedYear}</Text>
              <Pressable style={styles.stepperBtn} onPress={() => shiftYear(1)}>
                <Text style={styles.stepperBtnText}>▶</Text>
              </Pressable>
            </View>
          </View>
        )}

        {config.scopeType === 'year' && (
          <View style={styles.temporalRow}>
            <Text style={styles.temporalHint}>Comparativo de Anos:</Text>
            <Text style={styles.temporalInfoText}>
              Exibindo histórico de todos os {availableYears.length} anos disponíveis na planilha ({availableYears.join(', ')}).
            </Text>
          </View>
        )}

        {config.scopeType === 'multi_date' && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.temporalHint}>Datas Específicas Selecionadas:</Text>
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
                <Text style={styles.addDateBtnText}>+ Adicionar</Text>
              </Pressable>
            </View>

            {config.multiDates.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagChipsRow}>
                {config.multiDates.map((d) => (
                  <Pressable key={d} style={styles.tagChip} onPress={() => removeMultiDate(d)}>
                    <Text style={styles.tagChipText}>{d}</Text>
                    <Text style={styles.tagChipRemove}>✕</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.temporalEmptyHint}>
                Nenhuma data adicionada. Digite uma data acima para focar em dias específicos.
              </Text>
            )}
          </View>
        )}

        {config.scopeType === 'custom_range' && (
          <View style={styles.rangeRow}>
            <View style={styles.rangeCol}>
              <Text style={styles.rangeLabel}>De (Início):</Text>
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
              <Text style={styles.rangeLabel}>Até (Fim):</Text>
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
        )}
      </View>

      {/* ── Row 3: Metrics & Visual Mode ── */}
      <View style={styles.metricsAndVisualRow}>
        {/* Metric Toggles */}
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>📈 Séries & Métricas</Text>
          <View style={styles.metricTogglesWrap}>
            {METRIC_OPTIONS.map((m) => {
              const active = config.activeMetrics.includes(m.key);
              return (
                <Pressable
                  key={m.key}
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
          </View>
        </View>

        {/* Visual Type Selector */}
        <View style={{ minWidth: 180 }}>
          <Text style={styles.sectionTitle}>🎨 Tipo de Gráfico</Text>
          <View style={styles.visualPillsRow}>
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
                <Text style={[styles.visualPillLabel, config.visualType === v.key && styles.visualPillLabelActive]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* ── Row 4: Category Filter Chips ── */}
      {availableCategories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.categoryHeader}>
            <Text style={styles.sectionTitle}>🏷️ Filtro por Categoria</Text>
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
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pillActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.16)',
    borderColor: colors.accent.purple,
  },
  pillIcon: {
    fontSize: 13,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  pillLabelActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },

  // Temporal Card
  temporalControlCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  temporalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  temporalHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  temporalInfoText: {
    fontSize: 12,
    color: colors.text.tertiary,
    flex: 1,
  },
  temporalEmptyHint: {
    fontSize: 11,
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  stepperBtnText: {
    color: colors.accent.purple,
    fontSize: 12,
    fontWeight: '700',
  },
  stepperValue: {
    paddingHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Multi date input
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
    paddingVertical: spacing.xs,
    fontSize: 12,
    color: colors.text.primary,
  },
  addDateBtn: {
    backgroundColor: colors.accent.purple,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  addDateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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

  // Range inputs
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rangeCol: {
    flex: 1,
    gap: 2,
  },
  rangeLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  rangeInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    color: colors.text.primary,
  },

  // Metrics & Visual row
  metricsAndVisualRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  metricTogglesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  metricDot: {
    fontSize: 10,
  },
  metricChipText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  visualPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  visualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
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

  // Category filter chips
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

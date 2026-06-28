/**
 * CategorySummary Component — Assistente Moeda
 *
 * Groups financial rows by category (description) for a specific type.
 * Computes descriptive statistics (Mean, Median, StdDev, Min, Max, Daily/Weekly averages).
 * Features expandable accordions to list and modify individual items.
 *
 * Upgrades:
 *   - Independent scope selector [ Mês | Ano | Global ]
 *   - Proportional Accrual Math (Rateio Proporcional) for period entries
 *   - Prorated values in accordion list, averages, and statistics
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrencyFull, formatCurrencyShort, formatCurrencySmart } from '@/core/formatCurrency';
import type { TableRow } from '@/core/types';

type FilterableType = 'revenue' | 'expense' | 'deposit' | 'waiver' | 'partner_in' | 'partner_out';
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeMode(values: number[]): number {
  if (values.length === 0) return 0;
  const freqMap = new Map<number, number>();
  for (const v of values) {
    const rounded = Math.round(v * 100) / 100;
    freqMap.set(rounded, (freqMap.get(rounded) ?? 0) + 1);
  }
  let modeVal = 0;
  let maxFreq = 1;
  for (const [val, freq] of freqMap) {
    if (freq > maxFreq) {
      maxFreq = freq;
      modeVal = val;
    }
  }
  return modeVal;
}

type CategoryScope = 'month' | 'year' | 'global';

interface CategoryGroup {
  description: string;
  count: number;
  total: number;
  mean: number;
  max: number;
  min: number;
  median: number;
  mode: number;
  stdDev: number;
  dailyAvg: number;
  weeklyAvg: number;
  pct: number;
  rows: (TableRow & { displayValue: number; originalRow: TableRow })[];
}

interface CategorySummaryProps {
  allRows: TableRow[];
  selectedMonth: string;
  cutoffDate: string;
  onEditRow: (row: TableRow) => void;
  onDeleteRow: (rowId: string) => void;
}

const FILTER_OPTIONS: { value: FilterableType; label: string; icon: string; color: string }[] = [
  { value: 'expense',     label: 'Custos',            icon: '🏷️', color: colors.danger.main },
  { value: 'revenue',     label: 'Receitas',          icon: '📥', color: colors.success.main },
  { value: 'deposit',     label: 'Aportes',           icon: '💰', color: colors.info.main },
  { value: 'waiver',      label: 'Abonos',            icon: '🛡️', color: colors.warning.main },
  { value: 'partner_in',  label: 'Parceria ↓',        icon: '🤝', color: '#06b6d4' },
  { value: 'partner_out', label: 'Parceria ↑',        icon: '📤', color: '#f97316' },
];


function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.max(1, Math.round(Math.abs(msB - msA) / 86_400_000) + 1);
}

function getScopeBoundaries(scope: CategoryScope, activeMonth: string, activeYear: string): { start: string; end: string } {
  if (scope === 'month') {
    const [y, m] = activeMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${activeMonth}-01`,
      end: `${activeMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  } else if (scope === 'year') {
    return {
      start: `${activeYear}-01-01`,
      end: `${activeYear}-12-31`,
    };
  } else { // 'global'
    return {
      start: '1970-01-01',
      end: '2099-12-31',
    };
  }
}

function getCategoryActiveSpan(rows: TableRow[], scope: CategoryScope, activeMonth: string, activeYear: string): number {
  const boundaries = getScopeBoundaries(scope, activeMonth, activeYear);
  const scopeStart = boundaries.start;
  const scopeEnd = boundaries.end;

  const activeDates = new Set<string>();

  for (const r of rows) {
    const hasPeriod = !!(r.periodStart && r.periodEnd);
    if (hasPeriod) {
      const overlapStart = r.periodStart! < scopeStart ? scopeStart : r.periodStart!;
      const overlapEnd = r.periodEnd! > scopeEnd ? scopeEnd : r.periodEnd!;
      if (overlapStart <= overlapEnd) {
        let current = new Date(overlapStart + 'T12:00:00');
        const end = new Date(overlapEnd + 'T12:00:00');
        while (current <= end) {
          const dateStr = current.toISOString().slice(0, 10);
          activeDates.add(dateStr);
          current.setDate(current.getDate() + 1);
        }
      }
    } else {
      if (r.date >= scopeStart && r.date <= scopeEnd) {
        activeDates.add(r.date);
      }
    }
  }

  return activeDates.size > 0 ? activeDates.size : 1;
}

function formatMonthLabelShort(ym: string): string {
  const [y, m] = ym.split('-');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx]} ${y.slice(2)}`;
}

// ── Accrual Math helpers ──────────────────────────────────────────────────────

function getDaysActiveInMonth(start: string, end: string, yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  const mStart = `${yearMonth}-01`;
  const mEnd = `${yearMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  if (start > mEnd || end < mStart) return 0;

  const overlapStart = start < mStart ? mStart : start;
  const overlapEnd = end > mEnd ? mEnd : end;

  return daysBetween(overlapStart, overlapEnd);
}

function getDaysActiveInYear(start: string, end: string, yearStr: string): number {
  const yStart = `${yearStr}-01-01`;
  const yEnd = `${yearStr}-12-31`;

  if (start > yEnd || end < yStart) return 0;

  const overlapStart = start < yStart ? yStart : start;
  const overlapEnd = end > yEnd ? yEnd : end;

  return daysBetween(overlapStart, overlapEnd);
}

function getRowProratedValue(row: TableRow, scope: CategoryScope, activeMonth: string, activeYear: string): number {
  const hasPeriod = !!(row.periodStart && row.periodEnd);
  
  if (hasPeriod) {
    const lifespan = daysBetween(row.periodStart!, row.periodEnd!);
    const dailyRate = row.value / lifespan;
    
    if (scope === 'global') {
      return row.value;
    } else if (scope === 'year') {
      const daysActive = getDaysActiveInYear(row.periodStart!, row.periodEnd!, activeYear);
      return dailyRate * daysActive;
    } else { // scope === 'month'
      const daysActive = getDaysActiveInMonth(row.periodStart!, row.periodEnd!, activeMonth);
      return dailyRate * daysActive;
    }
  } else {
    // Normal entry
    if (scope === 'global') {
      return row.value;
    } else if (scope === 'year') {
      return row.date.startsWith(activeYear) ? row.value : 0;
    } else { // scope === 'month'
      return row.date.startsWith(activeMonth) ? row.value : 0;
    }
  }
}

export function CategorySummary({ allRows, selectedMonth, cutoffDate, onEditRow, onDeleteRow }: CategorySummaryProps) {
  const [filterType, setFilterType] = useState<FilterableType>('expense');
  const [categoryScope, setCategoryScope] = useState<CategoryScope>('month');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMonth === 'all') {
      setCategoryScope('global');
    } else {
      setCategoryScope('month');
    }
  }, [selectedMonth]);

  const filterOpt = useMemo(() => FILTER_OPTIONS.find((o) => o.value === filterType)!, [filterType]);

  const typeLabel = useMemo(() => {
    switch (filterType) {
      case 'expense': return 'Custo';
      case 'revenue': return 'Receita';
      case 'deposit': return 'Aporte';
      case 'waiver': return 'Abono';
      case 'partner_in':
      case 'partner_out': return 'Parceria';
      default: return 'Registro';
    }
  }, [filterType]);

  // Apply Time Machine cutoff first
  const baseRows = useMemo(() => {
    if (cutoffDate) {
      return allRows.filter((r) => r.date <= cutoffDate);
    }
    return allRows;
  }, [allRows, cutoffDate]);

  // Determine active scope dates
  const activeMonth = useMemo(() => {
    if (selectedMonth && selectedMonth !== 'all') {
      return selectedMonth;
    }
    if (cutoffDate) {
      return cutoffDate.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  }, [selectedMonth, cutoffDate]);

  const activeYear = useMemo(() => {
    return activeMonth.slice(0, 4);
  }, [activeMonth]);

  // Global time span (for fallback daily averages)
  const globalDaySpan = useMemo(() => {
    const dates = baseRows.map((r) => r.date).filter(Boolean).sort();
    if (dates.length < 2) return 1;
    return daysBetween(dates[0], dates[dates.length - 1]);
  }, [baseRows]);

  // Total days in the active scope for daily averages calculation
  const daysInScope = useMemo(() => {
    if (categoryScope === 'global') {
      return globalDaySpan;
    }
    if (categoryScope === 'year') {
      const y = parseInt(activeYear, 10);
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? 366 : 365;
    }
    // month scope
    const [y, m] = activeMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [categoryScope, globalDaySpan, activeMonth, activeYear]);

  const fallbackDays = useMemo(() => {
    if (categoryScope === 'global') {
      if (!allRows || allRows.length === 0) return 1;
      const dates = allRows.map((r) => r.date).filter(Boolean).sort();
      const oldest = dates[0] || new Date().toISOString().slice(0, 10);
      const start = new Date(oldest);
      const end = new Date();
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diff);
    } else if (categoryScope === 'year') {
      const y = parseInt(activeYear, 10) || new Date().getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? 366 : 365;
    } else { // 'month'
      const [y, m] = activeMonth.split('-').map(Number);
      return new Date(y, m, 0).getDate();
    }
  }, [categoryScope, allRows, activeMonth, activeYear]);

  // Count how many entries exist per type under the active scope (for chips badge counts)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const opt of FILTER_OPTIONS) {
      counts[opt.value] = baseRows.filter((r) => {
        if ((r.entryType || 'revenue') !== opt.value) return false;
        const val = getRowProratedValue(r, categoryScope, activeMonth, activeYear);
        return val > 0;
      }).length;
    }
    return counts;
  }, [baseRows, categoryScope, activeMonth, activeYear]);

  // Category groups for the selected type under the selected scope
  const groups = useMemo<CategoryGroup[]>(() => {
    const typeRows = baseRows.filter((r) => (r.entryType || 'revenue') === filterType);
    if (typeRows.length === 0) return [];

    const map = new Map<string, { row: TableRow; value: number }[]>();
    for (const row of typeRows) {
      const proratedValue = getRowProratedValue(row, categoryScope, activeMonth, activeYear);
      if (proratedValue <= 0) continue;

      const key = (row.description || 'SEM DESCRIÇÃO').toUpperCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ row, value: proratedValue });
    }

    const typeStaged = Array.from(map.values()).flat();
    const grandTotal = typeStaged.reduce((s, item) => s + item.value, 0);

    return Array.from(map.entries())
      .map(([key, items]) => {
        const values = items.map((item) => item.value);
        const total = values.reduce((s, v) => s + v, 0);
        const mean = values.length > 0 ? total / values.length : 0;
        const max = Math.max(...values);
        const min = Math.min(...values);
        const median = computeMedian(values);
        const mode = computeMode(values);
        const stdDev = computeStdDev(values, mean);
        
        let totalDailyRate = 0;
        for (const item of items) {
          const row = item.row;
          const hasPeriod = !!(row.periodStart && row.periodEnd);
          if (hasPeriod) {
            const txDays = daysBetween(row.periodStart!, row.periodEnd!);
            totalDailyRate += (row.value / txDays);
          } else {
            totalDailyRate += (row.value / fallbackDays);
          }
        }
        const dailyAvg = totalDailyRate;
        const weeklyAvg = totalDailyRate * 7;
        const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;

        // Map the rows to include display prorated value and keep reference to original row
        const mappedRows = items.map((item) => ({
          ...item.row,
          displayValue: Math.round(item.value * 100) / 100,
          originalRow: item.row,
        })).sort((a, b) => b.date.localeCompare(a.date));

        return {
          description: key,
          count: items.length,
          total: Math.round(total * 100) / 100,
          mean: Math.round(mean * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          median: Math.round(median * 100) / 100,
          mode: Math.round(mode * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          dailyAvg: Math.round(dailyAvg * 100) / 100,
          weeklyAvg: Math.round(weeklyAvg * 100) / 100,
          pct: Math.round(pct * 10) / 10,
          rows: mappedRows,
        };
      })
      .filter((g) => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [baseRows, filterType, categoryScope, activeMonth, activeYear, daysInScope]);

  const hasAnyData = baseRows.length > 0;
  if (!hasAnyData) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>📊 Categorias e Médias</Text>
      </View>

      {/* Scope Selector */}
      <View style={styles.scopeContainer}>
        <Text style={styles.scopeLabel}>Período de Análise:</Text>
        <View style={styles.segmentedControl}>
          <Pressable
            onPress={() => {
              setCategoryScope('month');
              setExpandedCategory(null);
            }}
            style={[styles.segmentBtn, categoryScope === 'month' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, categoryScope === 'month' && styles.segmentBtnTextActive]}>
              Mês ({formatMonthLabelShort(activeMonth)})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCategoryScope('year');
              setExpandedCategory(null);
            }}
            style={[styles.segmentBtn, categoryScope === 'year' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, categoryScope === 'year' && styles.segmentBtnTextActive]}>
              Ano ({activeYear})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setCategoryScope('global');
              setExpandedCategory(null);
            }}
            style={[styles.segmentBtn, categoryScope === 'global' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentBtnText, categoryScope === 'global' && styles.segmentBtnTextActive]}>
              Global (Tudo)
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Selector chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
        style={styles.scrollView}
      >
        {FILTER_OPTIONS.map((opt) => {
          const count = typeCounts[opt.value];
          const active = filterType === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setFilterType(opt.value);
                setExpandedCategory(null);
              }}
              style={({ pressed }) => [
                styles.chip,
                active && { backgroundColor: opt.color, borderColor: opt.color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {opt.icon} {opt.label}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
                  <Text style={[styles.badgeText, active && { color: opt.color }]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category list */}
      <View style={styles.listContainer}>
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum registro encontrado nesta categoria.</Text>
          </View>
        ) : (
          groups.map((g) => {
            const isExpanded = expandedCategory === g.description;
            return (
              <View key={g.description} style={[styles.categoryCard, isExpanded && styles.categoryCardExpanded]}>
                <Pressable
                  onPress={() => setExpandedCategory(isExpanded ? null : g.description)}
                  style={styles.cardHeader}
                >
                  <View style={styles.headerLeft}>
                    <Text style={styles.arrowIcon}>{isExpanded ? '▼' : '▶'}</Text>
                    <Text style={styles.categoryTitle} numberOfLines={1}>
                      {g.description}
                    </Text>
                  </View>
                  <View style={styles.headerRight}>
                    <Text style={[styles.categoryTotal, { color: filterOpt.color }]}>
                      {formatCurrencyShort(g.total)}
                    </Text>
                    <Text style={styles.categoryMeta}>
                      {g.pct}% ({g.count}x)
                    </Text>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Stat grid */}
                    <View style={styles.statGrid}>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Média</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.mean)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Mediana</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.median)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Desvio Padrão</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.stdDev)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Moda</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.mode)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>{`Maior ${typeLabel}`}</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.max)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>{`Menor ${typeLabel}`}</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.min)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Média Diária</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.dailyAvg)}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Média Semanal</Text>
                        <Text style={styles.statValue}>{formatCurrencyFull(g.weeklyAvg)}</Text>
                      </View>
                    </View>

                    {/* Entries List */}
                    <Text style={styles.entriesTitle}>Lançamentos</Text>
                    {g.rows.map((row, idx) => {
                      const hasPeriod = !!(row.periodStart && row.periodEnd && row.periodStart !== row.periodEnd);
                      return (
                        <View key={row.id || idx} style={styles.rowItem}>
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowDate}>
                              {hasPeriod
                                ? `📆 ${row.periodStart!.split('-').reverse().join('/')} a ${row.periodEnd!.split('-').reverse().join('/')}`
                                : row.date.split('-').reverse().join('/')}
                            </Text>
                            {row.description ? (
                              <Text style={styles.rowDesc} numberOfLines={1}>
                                {row.description}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.rowRight}>
                            <Text style={[styles.rowValue, { color: filterOpt.color }]}>
                              {formatCurrencySmart(row.displayValue)}
                            </Text>
                            <View style={styles.rowActions}>
                              <Pressable
                                onPress={() => onEditRow(row.originalRow)}
                                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                              >
                                <Text style={styles.actionBtnText}>✏️</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  Alert.alert(
                                    'Excluir lançamento',
                                    'Tem certeza que deseja excluir este lançamento original?',
                                    [
                                      { text: 'Cancelar', style: 'cancel' },
                                      {
                                        text: 'Excluir',
                                        style: 'destructive',
                                        onPress: () => onDeleteRow(row.id),
                                      },
                                    ]
                                  );
                                }}
                                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                              >
                                <Text style={styles.actionBtnText}>🗑️</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  scopeContainer: {
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  scopeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.accent.purple,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  segmentBtnTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flexGrow: 0,
  },
  chipsContainer: {
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  listContainer: {
    gap: spacing.sm,
  },
  emptyState: {
    padding: spacing.xl,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyText: {
    fontSize: 13,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  categoryCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  categoryCardExpanded: {
    borderColor: colors.accent.purpleBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  arrowIcon: {
    fontSize: 10,
    color: colors.text.disabled,
    width: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  categoryTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryMeta: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCol: {
    width: '47%',
    backgroundColor: colors.background.tertiary,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statLabel: {
    fontSize: 9,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  entriesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  rowDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  rowDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtnText: {
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
});

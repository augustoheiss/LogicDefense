/**
 * MonthPicker Component — Assistente Moeda
 *
 * Horizontal scrollable pill selector for filtering by:
 *   - "Todos" (all months)
 *   - 1 or more full years ("📅 2026", "📅 2025" -> 12m, 24m, 36m+ in 1 tap per year)
 *   - 1 or more individual months (1st click activates, 2nd click deactivates; auto-reverts to "Todos" if empty)
 */

import { useState, useMemo } from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import {
  parseSelectedMonthsSpec,
  serializeSelectedMonthsSpec,
  toggleMonthSelection,
  toggleYearSelection,
  formatSelectedMonthsLabel,
} from '@/core/dateUtils';

interface MonthPickerProps {
  months: string[]; // YYYY-MM sorted desc
  selected: string; // 'all', 'YYYY-MM', or 'YYYY-MM,YYYY-MM'
  selectedMonths?: string[];
  onSelect: (monthSpec: string) => void;
  onToggleMonth?: (month: string) => void;
  onToggleYear?: (year: string) => void;
}

function formatMonthLabel(ym?: string | null): string {
  if (!ym || ym === 'all' || typeof ym !== 'string') return 'Todos';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const [y, m] = parts;
  const shortMonths = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx >= 12 || isNaN(monthIdx)) return ym;
  const yearSuffix = y && y.length >= 2 ? y.slice(2) : y || '';
  return `${shortMonths[monthIdx]} ${yearSuffix}`.trim();
}

export function MonthPicker({
  months = [],
  selected,
  selectedMonths,
  onSelect,
  onToggleMonth,
  onToggleYear,
}: MonthPickerProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const safeMonths = useMemo(
    () =>
      Array.isArray(months)
        ? months.filter((m): m is string => typeof m === 'string' && /^\d{4}-\d{2}$/.test(m))
        : [],
    [months],
  );

  const activeMonthsList = useMemo(
    () =>
      selectedMonths && Array.isArray(selectedMonths)
        ? parseSelectedMonthsSpec(selectedMonths)
        : parseSelectedMonthsSpec(selected),
    [selectedMonths, selected],
  );

  const selectedSet = useMemo(() => new Set<string>(activeMonthsList), [activeMonthsList]);

  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const ym of safeMonths) {
      yrs.add(ym.slice(0, 4));
    }
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [safeMonths]);

  const activeLabel = useMemo(
    () => formatSelectedMonthsLabel(activeMonthsList, safeMonths),
    [activeMonthsList, safeMonths],
  );

  const handleToggleMonth = (ym: string) => {
    if (onToggleMonth) {
      onToggleMonth(ym);
    } else {
      const next = toggleMonthSelection(activeMonthsList, ym);
      onSelect(serializeSelectedMonthsSpec(next));
    }
  };

  const handleToggleYear = (year: string) => {
    if (onToggleYear) {
      onToggleYear(year);
    } else {
      const next = toggleYearSelection(activeMonthsList, year, safeMonths);
      onSelect(serializeSelectedMonthsSpec(next));
    }
  };

  const handleSelectAll = () => {
    onSelect('all');
    setIsCollapsed(true);
  };

  if (isCollapsed) {
    return (
      <View style={styles.collapsedWrapper}>
        <Pressable
          testID="month-picker-collapsed-trigger"
          onPress={() => setIsCollapsed(false)}
          style={({ pressed }) => [
            styles.collapsedButton,
            activeMonthsList.length > 0 && styles.collapsedButtonFiltered,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.collapsedButtonText}>
            📅 Filtro: <Text style={styles.collapsedValueText}>{activeLabel}</Text> (Alterar)
          </Text>
        </Pressable>
        {activeMonthsList.length > 0 && (
          <Pressable
            testID="month-picker-clear-btn"
            onPress={handleSelectAll}
            style={({ pressed }) => [styles.clearFilterBadge, pressed && styles.pressed]}
          >
            <Text style={styles.clearFilterText}>✕ Todos</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.expandedWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        style={styles.scrollView}
      >
        <Pill
          testID="month-picker-pill-all"
          label="Todos"
          isActive={activeMonthsList.length === 0}
          onPress={handleSelectAll}
        />

        {availableYears.length > 0 && safeMonths.length > 1 && (
          <>
            {availableYears.map((yr) => {
              const yrMonths = safeMonths.filter((m) => m.startsWith(`${yr}-`));
              const isFullYear = yrMonths.length > 0 && yrMonths.every((m) => selectedSet.has(m));
              const isPartialYear = !isFullYear && yrMonths.some((m) => selectedSet.has(m));
              return (
                <Pill
                  key={`year-${yr}`}
                  testID={`month-picker-year-${yr}`}
                  label={`📅 ${yr} (${yrMonths.length}m)`}
                  isActive={isFullYear}
                  isPartial={isPartialYear}
                  onPress={() => handleToggleYear(yr)}
                />
              );
            })}
            <View style={styles.divider} />
          </>
        )}

        {safeMonths.map((m) => (
          <Pill
            key={m}
            testID={`month-picker-month-${m}`}
            label={formatMonthLabel(m)}
            isActive={selectedSet.has(m)}
            onPress={() => handleToggleMonth(m)}
          />
        ))}
      </ScrollView>
      <Pressable
        testID="month-picker-confirm-btn"
        onPress={() => setIsCollapsed(true)}
        style={({ pressed }) => [
          styles.closeButton,
          activeMonthsList.length > 0 && styles.closeButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.closeButtonText, activeMonthsList.length > 0 && styles.closeButtonTextActive]}>
          {activeMonthsList.length > 0 ? `✓ (${activeMonthsList.length})` : '✕'}
        </Text>
      </Pressable>
    </View>
  );
}

function Pill({
  label,
  isActive,
  isPartial,
  onPress,
  testID,
}: {
  label: string;
  isActive: boolean;
  isPartial?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        isPartial && styles.pillPartial,
        isActive && styles.pillActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          isPartial && styles.pillTextPartial,
          isActive && styles.pillTextActive,
        ]}
      >
        {isActive ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  collapsedWrapper: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs,
  },
  collapsedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  collapsedButtonFiltered: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  collapsedButtonText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  collapsedValueText: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  clearFilterBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  expandedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border.default,
    marginHorizontal: 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  pillPartial: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  pillActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  pillTextPartial: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.accent.purple,
    fontWeight: '700',
  },
  closeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonActive: {
    backgroundColor: colors.accent.purpleLight,
    borderColor: colors.accent.purpleBorder,
  },
  closeButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeButtonTextActive: {
    color: colors.accent.purple,
  },
  pressed: {
    opacity: 0.7,
  },
});

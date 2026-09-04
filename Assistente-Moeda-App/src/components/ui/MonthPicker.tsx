/**
 * MonthPicker Component — Assistente Moeda
 *
 * Horizontal scrollable pill selector for filtering by month.
 * Shows "Todos" + each month with data.
 * Can be collapsed to save screen space.
 */

import { useState } from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface MonthPickerProps {
  months: string[]; // YYYY-MM sorted desc
  selected: string; // 'all' or YYYY-MM
  onSelect: (month: string) => void;
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

export function MonthPicker({ months = [], selected, onSelect }: MonthPickerProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const activeLabel = !selected || selected === 'all' ? 'Todos' : formatMonthLabel(selected);
  const safeMonths = Array.isArray(months) ? months.filter((m): m is string => typeof m === 'string' && m.includes('-')) : [];

  if (isCollapsed) {
    return (
      <View style={styles.collapsedWrapper}>
        <Pressable
          onPress={() => setIsCollapsed(false)}
          style={({ pressed }) => [
            styles.collapsedButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.collapsedButtonText}>
            📅 Filtro: <Text style={styles.collapsedValueText}>{activeLabel}</Text> (Alterar)
          </Text>
        </Pressable>
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
          label="Todos"
          isActive={!selected || selected === 'all'}
          onPress={() => {
            onSelect('all');
            setIsCollapsed(true);
          }}
        />
        {safeMonths.map((m) => (
          <Pill
            key={m}
            label={formatMonthLabel(m)}
            isActive={selected === m}
            onPress={() => {
              onSelect(m);
              setIsCollapsed(true);
            }}
          />
        ))}
      </ScrollView>
      <Pressable
        onPress={() => setIsCollapsed(true)}
        style={({ pressed }) => [
          styles.closeButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>
    </View>
  );
}

function Pill({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        isActive && styles.pillActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  collapsedWrapper: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    alignItems: 'flex-start',
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
  collapsedButtonText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  collapsedValueText: {
    color: colors.accent.purple,
    fontWeight: '700',
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
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
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
  pillTextActive: {
    color: colors.accent.purple,
    fontWeight: '600',
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
  closeButtonText: {
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  pressed: {
    opacity: 0.7,
  },
});

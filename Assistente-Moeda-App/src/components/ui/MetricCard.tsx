/**
 * MetricCard Component — Assistente Moeda
 *
 * Displays a single financial metric with label, value, and optional trend.
 * Compact layout optimized for mobile grids (2-col on phone, 3+ on tablet/web).
 */

import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';

interface MetricCardProps {
  label: string;
  value: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  subtitle?: string;
}

export function MetricCard({
  label,
  value,
  icon,
  trend,
  accentColor = colors.accent.purple,
  subtitle,
}: MetricCardProps) {
  const trendColor =
    trend === 'up' ? colors.success.main :
    trend === 'down' ? colors.danger.main :
    colors.text.tertiary;

  const trendIcon =
    trend === 'up' ? '▲' :
    trend === 'down' ? '▼' :
    '';

  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <View style={styles.header}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {(subtitle || trend) && (
          <View style={styles.footer}>
            {trendIcon ? (
              <Text style={[styles.trendText, { color: trendColor }]}>
                {trendIcon}
              </Text>
            ) : null}
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * MetricGrid — Responsive grid container for MetricCards.
 * 2 columns on phone, 3 on tablet, 4 on desktop web.
 */
export function MetricGrid({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const columns = width >= 1024 ? 4 : width >= 600 ? 3 : 2;
  const gap = spacing.sm;

  return (
    <View style={[styles.grid, { gap }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    flexDirection: 'row',
    overflow: 'hidden',
    flex: 1,
    minWidth: 140,
  },
  accent: {
    width: 3,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xxs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flex: 1,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 10,
    color: colors.text.disabled,
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

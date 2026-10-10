import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { FinancialInsight } from '@/core/insightsEngine';

interface InsightsCardProps {
  insights: FinancialInsight[];
}

export function InsightsCard({ insights }: InsightsCardProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  const getInsightIcon = (type: FinancialInsight['type']) => {
    switch (type) {
      case 'projection':
        return '📈';
      case 'anomaly':
        return '⚠️';
      case 'concentration':
        return '📊';
      case 'achievement':
        return '🏆';
      default:
        return '💡';
    }
  };

  const getBorderColor = (impact: FinancialInsight['impactLevel']) => {
    switch (impact) {
      case 'alto':
        return colors.warning.border;
      case 'médio':
        return colors.accent.purpleBorder;
      default:
        return colors.border.default;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Descobertas do Assistente</Text>

      <View style={styles.list}>
        {insights.map(item => (
          <View
            key={item.id}
            style={[
              styles.itemCard,
              { borderColor: getBorderColor(item.impactLevel) },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.iconTitleRow}>
                <Text style={styles.icon}>{getInsightIcon(item.type)}</Text>
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <View
                style={[
                  styles.impactBadge,
                  item.impactLevel === 'alto' && styles.impactAlto,
                ]}
              >
                <Text style={styles.impactText}>
                  Impacto {item.impactLevel.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.message}>{item.message}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  impactBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  impactAlto: {
    backgroundColor: colors.warning.light,
  },
  impactText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 12.5,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type { HealthPillar } from '@coin/core/healthEngine';

interface PillarsOverviewProps {
  pillars: HealthPillar[];
}

const PILLAR_ICONS: Record<string, string> = {
  cashflow: '💧',
  reserve: '🛡️',
  discipline: '🎯',
  efficiency: '⚡',
};

export function PillarsOverview({ pillars }: PillarsOverviewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getStatusColor = (status: HealthPillar['status']) => {
    switch (status) {
      case 'bom':
        return { text: colors.success.main, bg: colors.success.light, border: colors.success.border };
      case 'alerta':
        return { text: colors.warning.main, bg: colors.warning.light, border: colors.warning.border };
      case 'perigo':
      default:
        return { text: colors.danger.main, bg: colors.danger.light, border: colors.danger.border };
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Pilares de Equilíbrio</Text>

      <View style={styles.grid}>
        {pillars.map(pillar => {
          const isExpanded = expandedId === pillar.id;
          const statusStyle = getStatusColor(pillar.status);
          const icon = PILLAR_ICONS[pillar.id] || '📌';

          return (
            <Pressable
              key={pillar.id}
              style={[styles.card, isExpanded && styles.cardExpanded]}
              onPress={() => toggleExpand(pillar.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.pillarTitleRow}>
                  <Text style={styles.pillarIcon}>{icon}</Text>
                  <View style={styles.pillarNameWrapper}>
                    <Text style={styles.pillarName}>{pillar.name}</Text>
                    <Text style={styles.pillarWeight}>Peso {pillar.weight}%</Text>
                  </View>
                </View>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreValue}>{pillar.score}</Text>
                  <Text style={styles.scoreMax}>/100</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.max(5, Math.min(100, pillar.score))}%`,
                      backgroundColor: statusStyle.text,
                    },
                  ]}
                />
              </View>

              {/* Collapsed short hint or expanded full diagnosis */}
              {isExpanded ? (
                <View style={styles.expandedContent}>
                  <Text style={styles.diagnosticText}>{pillar.diagnostic}</Text>
                  <View style={styles.recommendationBox}>
                    <Text style={styles.recLabel}>💡 Recomendação:</Text>
                    <Text style={styles.recText}>{pillar.recommendation}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.shortDiag} numberOfLines={1}>
                  {pillar.diagnostic}
                </Text>
              )}
            </Pressable>
          );
        })}
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
  grid: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardExpanded: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: colors.background.tertiary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  pillarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pillarIcon: {
    fontSize: 18,
  },
  pillarNameWrapper: {
    flexDirection: 'column',
  },
  pillarName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pillarWeight: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  scoreMax: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginVertical: spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.full,
  },
  shortDiag: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  expandedContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  diagnosticText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  recommendationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 4,
  },
  recLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent.purple,
    marginBottom: 2,
  },
  recText: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
});

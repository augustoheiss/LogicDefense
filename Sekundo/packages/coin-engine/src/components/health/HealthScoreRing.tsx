import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@coin/theme/colors';
import { spacing, radius } from '@coin/theme/spacing';
import type { HealthLevel } from '@coin/core/healthEngine';

interface HealthScoreRingProps {
  score: number; // 0 to 100
  level: HealthLevel;
  headline?: string;
  size?: number;
}

export function HealthScoreRing({
  score,
  level,
  headline,
  size = 180,
}: HealthScoreRingProps) {
  const strokeWidth = 14;
  const radiusVal = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusVal;
  const strokeDashoffset = circumference - (circumference * Math.max(0, Math.min(100, score))) / 100;

  // Level configuration
  const config = React.useMemo(() => {
    switch (level) {
      case 'excelente':
        return {
          gradientStart: '#10b981',
          gradientEnd: '#a855f7',
          badgeBg: 'rgba(16, 185, 129, 0.15)',
          badgeBorder: 'rgba(16, 185, 129, 0.40)',
          badgeText: '#34d399',
          label: 'EXCELENTE',
        };
      case 'ótimo':
        return {
          gradientStart: '#3b82f6',
          gradientEnd: '#10b981',
          badgeBg: 'rgba(59, 130, 246, 0.15)',
          badgeBorder: 'rgba(59, 130, 246, 0.40)',
          badgeText: '#60a5fa',
          label: 'ÓTIMO',
        };
      case 'estável':
        return {
          gradientStart: '#f59e0b',
          gradientEnd: '#3b82f6',
          badgeBg: 'rgba(245, 158, 11, 0.15)',
          badgeBorder: 'rgba(245, 158, 11, 0.40)',
          badgeText: '#fbbf24',
          label: 'ESTÁVEL',
        };
      case 'atenção':
        return {
          gradientStart: '#f97316',
          gradientEnd: '#f59e0b',
          badgeBg: 'rgba(249, 115, 22, 0.15)',
          badgeBorder: 'rgba(249, 115, 22, 0.40)',
          badgeText: '#fb923c',
          label: 'ATENÇÃO',
        };
      case 'crítico':
      default:
        return {
          gradientStart: '#ef4444',
          gradientEnd: '#f97316',
          badgeBg: 'rgba(239, 68, 68, 0.15)',
          badgeBorder: 'rgba(239, 68, 68, 0.40)',
          badgeText: '#f87171',
          label: 'CRÍTICO',
        };
    }
  }, [level]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Saúde Financeira</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: config.badgeBg, borderColor: config.badgeBorder },
          ]}
        >
          <Text style={[styles.badgeText, { color: config.badgeText }]}>
            {config.label}
          </Text>
        </View>
      </View>

      <View style={styles.ringContainer}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={config.gradientStart} />
              <Stop offset="100%" stopColor={config.gradientEnd} />
            </LinearGradient>
          </Defs>

          {/* Background Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radiusVal}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Progress Arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radiusVal}
            stroke="url(#scoreGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        <View style={styles.centerContent}>
          <Text style={styles.scoreText}>{score}</Text>
          <Text style={styles.scoreSubtext}>de 100</Text>
        </View>
      </View>

      {headline ? (
        <Text style={styles.headlineText}>{headline}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text.primary,
    lineHeight: 52,
    letterSpacing: -1,
  },
  scoreSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  headlineText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { FinancialHealthReport } from '@/core/healthEngine';

interface NextActionCardProps {
  action: FinancialHealthReport['nextBestAction'];
  onActionPress?: (actionType?: string) => void;
}

export function NextActionCard({ action, onActionPress }: NextActionCardProps) {
  const getButtonLabel = (actionType?: string) => {
    switch (actionType) {
      case 'add_row':
        return '+ Registrar Gasto';
      case 'adjust_goals':
        return '🎯 Ajustar Metas';
      case 'build_reserve':
        return '🛡️ Planejar Reserva';
      case 'cut_expense':
        return '✂️ Revisar Despesas';
      default:
        return 'Executar Ação';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>PRÓXIMO PASSO RECOMENDADO</Text>
        </View>
        <Text style={styles.priorityText}>
          {action.priority === 'alta' ? '🚨 Prioridade Alta' : '⚡ Sugestão'}
        </Text>
      </View>

      <Text style={styles.title}>{action.title}</Text>
      <Text style={styles.description}>{action.description}</Text>

      <Pressable
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.actionButtonPressed,
        ]}
        onPress={() => onActionPress?.(action.actionType)}
      >
        <Text style={styles.actionButtonText}>
          {getButtonLabel(action.actionType)}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.accent.purpleBorder,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tag: {
    backgroundColor: colors.accent.purpleLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent.purple,
    letterSpacing: 0.6,
  },
  priorityText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.accent.purple,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    backgroundColor: colors.accent.purpleHover,
    opacity: 0.9,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});

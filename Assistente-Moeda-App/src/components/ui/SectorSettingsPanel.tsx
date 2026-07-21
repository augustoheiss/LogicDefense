import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useSectorRegistry } from '@/hooks/useSectorRegistry';

export function SectorSettingsPanel() {
  const { allSectors, activeSectors, toggleSector, isSectorActive } = useSectorRegistry();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>⚙️ Configuração de Módulos (Setores)</Text>
      <Text style={styles.sectionSubtitle}>
        Ative ou desative módulos de cálculo e exibições específicas na sua planilha atual.
      </Text>

      <View style={styles.list}>
        {allSectors.map((sector) => {
          const active = isSectorActive(sector.id);
          const isOnlyOne = activeSectors.length <= 1 && active;

          return (
            <Pressable
              key={sector.id}
              style={[
                styles.item,
                active && styles.itemActive,
              ]}
              onPress={() => !isOnlyOne && toggleSector(sector.id)}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{sector.icon}</Text>
              </View>

              <View style={styles.content}>
                <Text style={styles.label}>{sector.label}</Text>
                <Text style={styles.description}>{sector.description}</Text>
              </View>

              <Switch
                value={active}
                onValueChange={() => toggleSector(sector.id)}
                disabled={isOnlyOne}
                trackColor={{ false: '#3f3f46', true: 'rgba(168, 85, 247, 0.5)' }}
                thumbColor={active ? colors.accent.purple : '#a1a1aa'}
              />
            </Pressable>
          );
        })}
      </View>
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
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent.purpleLight || '#e9d5ff',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  itemActive: {
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  description: {
    fontSize: 11,
    color: colors.text.disabled,
    lineHeight: 14,
  },
});

/**
 * UniversalHeaderSheetBar Component — Assistente Moeda
 *
 * Universal top bar present across all tabs (Index, Metrics, Charts, Settings).
 * Allows instant spreadsheet switching, reordering, and table management anywhere in the app.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { useCoinDB } from '@/hooks/useCoinDB';
import { TableSwitcherModal } from './TableSwitcherModal';

export function UniversalHeaderSheetBar() {
  const db = useCoinDB();
  const [modalVisible, setModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const activeTable = db.activeTable;
  const rowCount = activeTable?.rows?.length ?? 0;
  const tableName = activeTable?.name || 'Minha Planilha';

  return (
    <View style={styles.outerContainer}>
      <View style={[styles.innerContainer, isDesktop && styles.desktopContainer]}>
        {/* Active Sheet Pill Button */}
        <Pressable
          style={({ pressed }) => [
            styles.sheetPill,
            pressed && styles.sheetPillPressed,
          ]}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Trocar planilha ativa. Atual: ${tableName}`}
        >
          <View style={styles.pillLeft}>
            <View style={styles.activeDot} />
            <Text style={styles.tableNameText} numberOfLines={1}>
              {tableName}
            </Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{rowCount} {rowCount === 1 ? 'item' : 'itens'}</Text>
            </View>
          </View>
          
          <View style={styles.pillRight}>
            <Text style={styles.chevronIcon}>▾</Text>
          </View>
        </Pressable>

        {/* Total Tables Indicator on Desktop */}
        {isDesktop && (
          <View style={styles.desktopInfo}>
            <Text style={styles.desktopInfoText}>
              {db.tables.length} {db.tables.length === 1 ? 'planilha' : 'planilhas'} • Use setas ↑ ↓ no menu
            </Text>
          </View>
        )}
      </View>

      {/* Modal with Reorder and Keyboard Navigation */}
      <TableSwitcherModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tables={db.tables}
        activeTableIndex={db.activeTableIndex}
        onSelect={(index) => {
          db.setActiveTableIndex(index);
          setModalVisible(false);
        }}
        onAdd={db.addTable}
        onRename={db.renameTable}
        onDelete={db.deleteTable}
        onReorder={db.reorderTables}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 100,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  desktopContainer: {
    maxWidth: 1120,
    alignSelf: 'center',
  },
  sheetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    maxWidth: 360,
  },
  sheetPillPressed: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderColor: colors.accent.purple,
  },
  pillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.purple,
    boxShadow: '0 0 8px rgba(167, 139, 250, 0.8)',
  },
  tableNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent.purpleLight ? colors.accent.purple : '#C4B5FD',
  },
  pillRight: {
    paddingLeft: 2,
  },
  chevronIcon: {
    fontSize: 12,
    color: colors.accent.purple,
    fontWeight: 'bold',
  },
  desktopInfo: {
    paddingRight: spacing.xs,
  },
  desktopInfoText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
});

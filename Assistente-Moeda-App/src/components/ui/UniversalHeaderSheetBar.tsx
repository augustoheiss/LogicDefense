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

  const triggerTimeMachineToggle = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('coin_toggle_time_machine'));
    }
  };

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
              <Text style={styles.countBadgeText}>{rowCount}</Text>
            </View>
          </View>
          
          <View style={styles.pillRight}>
            <Text style={styles.chevronIcon}>▾</Text>
          </View>
        </Pressable>

        {/* Right Controls: Undo/Redo, Time Machine Indicator, Privacy/Street Mode Toggle */}
        <View style={styles.rightControls}>
          {(db.canUndo || db.canRedo) && (
            <View style={styles.undoRedoGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  !db.canUndo && styles.iconActionBtnDisabled,
                  pressed && db.canUndo && styles.iconActionBtnPressed,
                ]}
                disabled={!db.canUndo}
                onPress={() => db.undo()}
                accessibilityRole="button"
                accessibilityLabel={db.lastUndoDescription ? `Desfazer: ${db.lastUndoDescription}` : 'Desfazer'}
              >
                <Text style={[styles.iconActionText, !db.canUndo && styles.iconActionTextDisabled]}>↩</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.iconActionBtn,
                  !db.canRedo && styles.iconActionBtnDisabled,
                  pressed && db.canRedo && styles.iconActionBtnPressed,
                ]}
                disabled={!db.canRedo}
                onPress={() => db.redo()}
                accessibilityRole="button"
                accessibilityLabel="Refazer"
              >
                <Text style={[styles.iconActionText, !db.canRedo && styles.iconActionTextDisabled]}>↪</Text>
              </Pressable>
            </View>
          )}

          {Platform.OS === 'web' && (
            <Pressable
              style={({ pressed }) => [
                styles.actionPill,
                db.cutoffDate !== '' && styles.actionPillTimeActive,
                pressed && styles.iconActionBtnPressed,
              ]}
              onPress={triggerTimeMachineToggle}
              accessibilityRole="button"
              accessibilityLabel="Alternar Máquina do Tempo"
            >
              <Text style={styles.actionPillEmoji}>🕰️</Text>
              {db.cutoffDate !== '' ? (
                <Text style={styles.actionPillTimeText}>
                  {db.cutoffDate.slice(8, 10)}/{db.cutoffDate.slice(5, 7)}
                </Text>
              ) : isDesktop ? (
                <Text style={styles.actionPillText}>Data</Text>
              ) : null}
            </Pressable>
          )}

          {/* Street / Privacy Mode Toggle (👁️ / 🙈) */}
          <Pressable
            style={({ pressed }) => [
              styles.actionPill,
              db.isPrivacyMode && styles.actionPillPrivacyActive,
              pressed && styles.iconActionBtnPressed,
            ]}
            onPress={() => db.togglePrivacyMode()}
            accessibilityRole="button"
            accessibilityLabel={db.isPrivacyMode ? 'Desativar Modo Rua (Mostrar valores)' : 'Ativar Modo Rua (Ocultar valores)'}
          >
            <Text style={styles.actionPillEmoji}>{db.isPrivacyMode ? '🙈' : '👁️'}</Text>
            {isDesktop && (
              <Text style={[styles.actionPillText, db.isPrivacyMode && styles.actionPillPrivacyText]}>
                {db.isPrivacyMode ? 'Modo Rua ON' : 'Modo Rua'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Modal with Reorder and Keyboard Navigation */}
      <TableSwitcherModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        tables={db.activeTables}
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
    gap: spacing.xs,
  },
  desktopContainer: {
    maxWidth: 1280,
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
    gap: spacing.xs,
    maxWidth: 260,
    flexShrink: 1,
  },
  sheetPillPressed: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderColor: colors.accent.purple,
  },
  pillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoRedoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  iconActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionBtnDisabled: {
    opacity: 0.3,
  },
  iconActionBtnPressed: {
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
  },
  iconActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  iconActionTextDisabled: {
    color: colors.text.disabled,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionPillPrivacyActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  actionPillTimeActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    borderColor: 'rgba(6, 182, 212, 0.45)',
  },
  actionPillEmoji: {
    fontSize: 13,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  actionPillPrivacyText: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  actionPillTimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22D3EE',
  },
});

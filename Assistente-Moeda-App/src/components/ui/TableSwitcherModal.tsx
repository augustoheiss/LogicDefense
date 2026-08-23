/**
 * TableSwitcherModal Component — Assistente Moeda
 *
 * Bottom-sheet style modal for managing and switching between spreadsheet tables.
 * Allows creating, renaming, and deleting tables.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { Card } from './Card';
import type { CoinTable } from '@/core/types';

interface TableSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  tables: CoinTable[];
  activeTableIndex: number;
  onSelect: (index: number) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function TableSwitcherModal({
  visible,
  onClose,
  tables,
  activeTableIndex,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: TableSwitcherModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;

  const [newTableName, setNewTableName] = useState('');
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(activeTableIndex);

  React.useEffect(() => {
    if (visible) {
      setFocusedIndex(activeTableIndex);
    }
  }, [visible, activeTableIndex]);

  // Keyboard navigation on Web (Up/Down + Enter to select, Esc to close)
  React.useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTableId) return; // Allow normal typing while renaming

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1 < tables.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : tables.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < tables.length) {
          onSelect(focusedIndex);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, editingTableId, focusedIndex, tables.length, onSelect, onClose]);

  const handleAdd = () => {
    if (!newTableName.trim()) {
      Alert.alert('Erro', 'O nome da tabela não pode estar vazio.');
      return;
    }
    onAdd(newTableName.trim());
    setNewTableName('');
  };

  const handleStartRename = (table: CoinTable) => {
    setEditingTableId(table.id);
    setRenameValue(table.name);
  };

  const handleSaveRename = (id: string) => {
    if (!renameValue.trim()) {
      Alert.alert('Erro', 'O nome da tabela não pode estar vazio.');
      return;
    }
    onRename(id, renameValue.trim());
    setEditingTableId(null);
  };

  const handleDelete = (table: CoinTable) => {
    if (tables.length <= 1) {
      Alert.alert('Aviso', 'Você precisa ter pelo menos uma planilha ativa.');
      return;
    }

    const deleteAction = () => {
      onDelete(table.id);
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Deseja excluir a planilha "${table.name}" e todas as suas entradas?`);
      if (confirmed) {
        deleteAction();
      }
    } else {
      Alert.alert(
        'Excluir Planilha',
        `Tem certeza que deseja excluir a planilha "${table.name}"? Isso apagará todos os dados dela permanentemente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: deleteAction },
        ],
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          {!isWide && <View style={styles.handle} />}
          <View style={styles.header}>
            <Text style={styles.title}>📋 Suas Planilhas</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Fechar (Esc)</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {tables.map((t, index) => {
              const isActive = index === activeTableIndex;
              const isFocused = index === focusedIndex;
              const isEditing = t.id === editingTableId;

              return (
                <Card 
                  key={t.id} 
                  style={StyleSheet.flatten([
                    styles.tableCard, 
                    isActive && styles.activeCard,
                    isFocused && !isActive && styles.focusedCard
                  ])}
                >
                  {isEditing ? (
                    <View style={styles.renameRow}>
                      <TextInput
                        style={styles.renameInput}
                        value={renameValue}
                        onChangeText={setRenameValue}
                        onSubmitEditing={() => handleSaveRename(t.id)}
                        returnKeyType="done"
                        autoFocus
                      />
                      <Pressable
                        style={[styles.actionBtn, styles.saveBtn]}
                        onPress={() => handleSaveRename(t.id)}
                      >
                        <Text style={styles.actionBtnText}>✓</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.cancelBtn]}
                        onPress={() => setEditingTableId(null)}
                      >
                        <Text style={styles.actionBtnText}>✕</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.tableCardContent}>
                      <Pressable
                        style={styles.tableSelectArea}
                        onPress={() => {
                          onSelect(index);
                          onClose();
                        }}
                      >
                        <Text style={[styles.tableName, isActive && styles.activeTableName]}>
                          {isActive ? '🟣 ' : '○ '}
                          {t.name}
                        </Text>
                        <Text style={styles.tableMeta}>{t.rows.length} entradas</Text>
                      </Pressable>

                      <View style={styles.cardActions}>
                        {/* Reorder Up/Down */}
                        {onReorder && (
                          <View style={styles.reorderGroup}>
                            <Pressable
                              style={[styles.iconBtn, index === 0 && styles.disabledBtn]}
                              onPress={() => onReorder(index, index - 1)}
                              disabled={index === 0}
                              accessibilityLabel="Mover para cima"
                            >
                              <Text style={[styles.iconText, index === 0 && styles.disabledText]}>▲</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.iconBtn, index === tables.length - 1 && styles.disabledBtn]}
                              onPress={() => onReorder(index, index + 1)}
                              disabled={index === tables.length - 1}
                              accessibilityLabel="Mover para baixo"
                            >
                              <Text style={[styles.iconText, index === tables.length - 1 && styles.disabledText]}>▼</Text>
                            </Pressable>
                          </View>
                        )}

                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => handleStartRename(t)}
                          accessibilityLabel="Renomear"
                        >
                          <Text style={styles.iconText}>✏️</Text>
                        </Pressable>
                        <Pressable
                          style={styles.iconBtn}
                          onPress={() => handleDelete(t)}
                          accessibilityLabel="Excluir"
                        >
                          <Text style={[styles.iconText, styles.dangerText]}>🗑️</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </Card>
              );
            })}

            {/* Create New Table Form */}
            <View style={styles.addSection}>
              <Text style={styles.sectionLabel}>Criar Nova Planilha</Text>
              <View style={styles.addInputRow}>
                <TextInput
                  style={styles.addInput}
                  value={newTableName}
                  onChangeText={setNewTableName}
                  placeholder="Nome da planilha..."
                  placeholderTextColor={colors.text.disabled}
                  onSubmitEditing={handleAdd}
                  returnKeyType="done"
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleAdd}
                >
                  <Text style={styles.addBtnText}>+ Criar</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  sheetWide: {
    alignSelf: 'center',
    width: 480,
    borderRadius: radius.xl,
    marginBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.strong,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeBtnText: {
    color: colors.accent.purple,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollList: {
    maxHeight: 450,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tableCard: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
  },
  activeCard: {
    borderColor: colors.accent.purpleBorder,
    backgroundColor: colors.accent.purpleLight,
  },
  focusedCard: {
    borderColor: colors.accent.purple,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  tableCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tableSelectArea: {
    flex: 1,
    gap: 4,
  },
  tableName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeTableName: {
    color: colors.accent.purple,
  },
  tableMeta: {
    fontSize: 12,
    color: colors.text.tertiary,
    paddingLeft: 18,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: 2,
    marginRight: 4,
  },
  disabledBtn: {
    opacity: 0.25,
  },
  disabledText: {
    color: colors.text.disabled,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: radius.xs,
    backgroundColor: colors.background.tertiary,
  },
  iconText: {
    fontSize: 14,
  },
  dangerText: {
    color: colors.danger.main,
  },
  renameRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  renameInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 14,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: colors.success.main,
  },
  cancelBtn: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  addSection: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  addInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: colors.accent.purple,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});

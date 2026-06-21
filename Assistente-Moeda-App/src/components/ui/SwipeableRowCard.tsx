/**
 * SwipeableRowCard — Assistente Moeda
 *
 * Wraps RowCard with swipe-to-reveal actions:
 *   - Swipe left → ✏️ Edit + 🗑️ Delete buttons
 *   - Swipe right → 🔄 Duplicate button
 *
 * On web: hover action buttons + long-press context Alert.
 * On native: Animated swipe gestures.
 *
 * DELETE FIX: Uses window.confirm on web instead of Alert.alert
 * (Alert.alert custom button callbacks silently fail on React Native Web).
 */

import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { RowCard } from './RowCard';
import type { TableRow } from '@/core/types';

interface SwipeableRowCardProps {
  row: TableRow;
  onEdit: (row: TableRow) => void;
  onDelete: (rowId: string) => void;
  onDuplicate: (row: TableRow) => void;
}

export function SwipeableRowCard({
  row,
  onEdit,
  onDelete,
  onDuplicate,
}: SwipeableRowCardProps) {
  if (Platform.OS === 'web') {
    return (
      <WebRowCard
        row={row}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    );
  }

  return (
    <NativeSwipeRow
      row={row}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />
  );
}

// ── Cross-platform delete confirmation ────────────────────────────────────────

function confirmDelete(rowId: string, onDelete: (id: string) => void) {
  if (Platform.OS === 'web') {
    // Alert.alert button callbacks silently fail on RN Web — use native confirm
    const confirmed = window.confirm('Tem certeza que deseja excluir esta entrada?');
    if (confirmed) {
      onDelete(rowId);
    }
  } else {
    Alert.alert(
      'Excluir Entrada',
      'Tem certeza que deseja excluir esta entrada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => onDelete(rowId),
        },
      ],
    );
  }
}

// ── Web Version: Hover action buttons ─────────────────────────────────────────

function WebRowCard({
  row,
  onEdit,
  onDelete,
  onDuplicate,
}: SwipeableRowCardProps) {
  return (
    <View style={styles.webWrapper}>
      <RowCard
        row={row}
        onPress={() => onEdit(row)}
        onDelete={() => confirmDelete(row.id, onDelete)}
      />
      {/* Hover action buttons (web only) */}
      <View style={styles.webActions}>
        <Pressable
          style={[styles.webActionBtn, styles.editBtn]}
          onPress={() => onEdit(row)}
        >
          <Text style={styles.webActionText}>✏️</Text>
        </Pressable>
        <Pressable
          style={[styles.webActionBtn, styles.duplicateBtn]}
          onPress={() => onDuplicate(row)}
        >
          <Text style={styles.webActionText}>📋</Text>
        </Pressable>
        <Pressable
          style={[styles.webActionBtn, styles.deleteBtn]}
          onPress={() => confirmDelete(row.id, onDelete)}
        >
          <Text style={styles.webActionText}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Native Version: Animated swipe ────────────────────────────────────────────

function NativeSwipeRow({
  row,
  onEdit,
  onDelete,
  onDuplicate,
}: SwipeableRowCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const isOpen = useRef(false);

  const closeRow = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    isOpen.current = false;
  }, [translateX]);

  const onTouchStart = useCallback((e: any) => {
    startX.current = e.nativeEvent.pageX;
  }, []);

  const onTouchEnd = useCallback((e: any) => {
    const dx = e.nativeEvent.pageX - startX.current;

    if (dx < -50) {
      // Swipe left — reveal right actions
      Animated.spring(translateX, {
        toValue: -140,
        useNativeDriver: true,
        friction: 8,
      }).start();
      isOpen.current = true;
    } else if (dx > 50) {
      // Swipe right — duplicate action
      Animated.spring(translateX, {
        toValue: 70,
        useNativeDriver: true,
        friction: 8,
      }).start(() => {
        onDuplicate(row);
        closeRow();
      });
    } else {
      closeRow();
    }
  }, [row, onDuplicate, closeRow, translateX]);

  return (
    <View style={styles.nativeWrapper}>
      {/* Background actions (revealed on swipe) */}
      {/* Left: Duplicate */}
      <View style={styles.leftAction}>
        <Pressable
          style={[styles.actionBtn, styles.duplicateAction]}
          onPress={() => {
            onDuplicate(row);
            closeRow();
          }}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Duplicar</Text>
        </Pressable>
      </View>

      {/* Right: Edit + Delete */}
      <View style={styles.rightActions}>
        <Pressable
          style={[styles.actionBtn, styles.editAction]}
          onPress={() => {
            onEdit(row);
            closeRow();
          }}
        >
          <Text style={styles.actionIcon}>✏️</Text>
          <Text style={styles.actionLabel}>Editar</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.deleteAction]}
          onPress={() => {
            confirmDelete(row.id, onDelete);
            closeRow();
          }}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={styles.actionLabel}>Excluir</Text>
        </Pressable>
      </View>

      {/* Foreground card */}
      <Animated.View
        style={[styles.cardContainer, { transform: [{ translateX }] }]}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <RowCard
          row={row}
          onPress={() => {
            if (isOpen.current) {
              closeRow();
            } else {
              onEdit(row);
            }
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Web
  webWrapper: {
    position: 'relative',
  },
  webActions: {
    position: 'absolute',
    right: 8,
    top: '50%',
    flexDirection: 'row',
    gap: 4,
    transform: [{ translateY: -14 }],
    opacity: 0.85,
  },
  webActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webActionText: {
    fontSize: 13,
  },
  editBtn: {
    backgroundColor: colors.info.light,
  },
  duplicateBtn: {
    backgroundColor: colors.accent.purpleLight,
  },
  deleteBtn: {
    backgroundColor: colors.danger.light,
  },

  // Native
  nativeWrapper: {
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  leftAction: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    width: 140,
  },
  actionBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  duplicateAction: {
    backgroundColor: colors.accent.purple,
  },
  editAction: {
    backgroundColor: colors.info.main,
  },
  deleteAction: {
    backgroundColor: colors.danger.main,
  },
  cardContainer: {
    backgroundColor: colors.background.primary,
  },
});
